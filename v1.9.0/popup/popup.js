// popup.js
import { getAccessToken } from "../background/oauth.js";
import {
	listVideosInFolderWithAutoReauth,
	listFoldersInDriveWithCacheAndAutoReauth,
	listFoldersInDriveWithCache,
} from "../services/driveApi.js";
import {
	cacheCurrentVideos,
	getCachedVideos,
	cacheFormState,
	getCachedFormState,
	clearAllCaches,
} from "../services/folderCache.js";
import {
	uploadToYouTubeWithAutoReauth,
	massUploadAllVideosToPlaylist,
	saveVideoIdsToStorage,
	getStoredVideoIDs,
} from "../services/youtubeApi.js";
import { autofillOnSite } from "../services/autofill.js";
import { showUploadStatus, updateHistoryList } from "../utils/utils.js";

// We'll store the fetched folders in this array for searching
let allFolders = [];

// We'll store the currently displayed videos, so we can mass-upload them
let currentVideos = [];

// This is used for the drag-to-resize logic at bottom of file
let isDragging = false;

const divider = document.getElementById("divider");
const foldersSection = document.getElementById("foldersSection");
const videosSection = document.getElementById("videosSection");

// -------------------------------------------------------------------------- //
document.addEventListener("DOMContentLoaded", async () => {
	const openPickerBtn = document.getElementById("openPickerBtn");
	const pickerIframe = document.getElementById("pickerIframe");
	// const folderSearchInput = document.getElementById("folderSearch"); // Removed
	const uploadAllBtn = document.getElementById("uploadAllButton");
	const container = document.getElementById("persistedContainer");

	// Hide resizing panel for folders initially since we don't list folders
	foldersSection.style.display = "none";
	divider.style.display = "none";

	// Initial load of folders from cache
	(async function initialLoad() {
		// Use interactive=false to prevent popup loops on load
		const token = await getAccessToken(false);
		if (token) {
			try {
				// We no longer list all folders automatically.
				// Instead, we just check for cached video state.

				// Check for cached videos content to restore state
				const cachedVideosData = await getCachedVideos();
				if (cachedVideosData) {
					const { videos, folderName } = cachedVideosData;
					const savedFormState = await getCachedFormState();
					renderVideoList(videos, token, folderName, savedFormState);
				}
			} catch (err) {
				console.log("No valid cache or load failed (silent)", err);
			}
		} else {
			console.log("No valid token on init - waiting for user refresh.");
		}
	})();

	// == Open Picker Button == //
	openPickerBtn.addEventListener("click", async () => {
		const token = await getAccessToken();
		if (!token) {
			console.error("Failed to retrieve token!");
			return;
		}

		// Show the picker iframe
		pickerIframe.style.display = "block";
		// Send init message
		// wait slightly for iframe to be ready if it wasn't
		// But iframe src is loaded on DOMContentLoaded.
		pickerIframe.contentWindow.postMessage({ type: "init", token: token }, "*");
	});

	// == Message Listener for Picker == //
	window.addEventListener("message", async (event) => {
		// Important: Verify origin if possible, but sandboxed iframe usually has null origin or specific
		if (event.data.type === "picked") {
			pickerIframe.style.display = "none";
			const docs = event.data.docs;
			await handlePickerSelection(docs);
		} else if (event.data.type === "cancel") {
			pickerIframe.style.display = "none";
		}
	});

	/**
	 * Handles the selection from Google Picker
	 * @param {Array} docs - Array of selected documents
	 */
	async function handlePickerSelection(docs) {
		if (!docs || docs.length === 0) return;

		const token = await getAccessToken();
		const firstDoc = docs[0];

		// Check mimeType to see if it's a folder
		if (firstDoc.mimeType === "application/vnd.google-apps.folder") {
			// User picked a folder
			try {
				// We reuse listVideosInFolderWithAutoReauth logic
				// The doc.id is the folder ID.
				const videos = await listVideosInFolderWithAutoReauth(
					token,
					firstDoc.id
				);

				// Cache it
				await cacheCurrentVideos(videos, firstDoc.name);

				// Render it
				renderVideoList(videos, token, firstDoc.name);
			} catch (err) {
				console.error("Error listing videos from picked folder:", err);
				alert("Failed to list videos from the selected folder.");
			}
		} else {
			// User picked files.
			// We need to format them into the structure expected by renderVideoList.
			// Expected: { id, name, mimeType, thumbnailLink }
			// The picker returns { id, name, mimeType, iconUrl, url, ... }
			// Picker usually returns 'iconUrl', not 'thumbnailLink'.
			// 'thumbnailLink' is from Drive API list.
			// However, we can use the docs array directly, mapping fields if needed.

			// Filter only videos just in case
			const validVideos = docs.filter((d) => d.mimeType.startsWith("video/"));

			const formattedVideos = validVideos.map((d) => ({
				id: d.id,
				name: d.name,
				mimeType: d.mimeType,
				thumbnailLink: d.iconUrl, // Use icon as fallback or try to fetch if critical
			}));

			if (formattedVideos.length > 0) {
				await cacheCurrentVideos(formattedVideos, "Selected Files");
				renderVideoList(formattedVideos, token, "Selected Files");
			} else {
				alert("No video files were selected.");
			}
		}
	}

	const videoData = await getStoredVideoIDs();
	if (videoData.length > 0) {
		console.log("popup.js: got videoData", videoData);

		// collapse/expand logic
		const header = document.getElementById("persistedHeader");
		const body = document.getElementById("persistedBody");
		const toggle = document.getElementById("togglePersisted");
		const clearer = document.getElementById("clearPersisted");
		const autofillButton = document.getElementById("autofillButton-prevIds");

		updateHistoryList(videoData);

		autofillButton.style.display = "inline-block";
		autofillButton.addEventListener("click", async (e) => {
			e.stopPropagation(); // don’t toggle collapse
			autofillOnSite();
		});

		header.addEventListener("click", () => {
			// console.log("toggled persisted container");
			const isOpen = body.style.display === "block";
			body.style.display = isOpen ? "none" : "block";
			// flip arrow: ▼ -> ▲
			toggle.innerHTML = isOpen ? "&#9660;" : "&#9650;";
		});

		// clear storage & hide container
		clearer.addEventListener("click", async (e) => {
			e.stopPropagation(); // don’t toggle collapse
			container.style.display = "none";
		});
	} else {
		container.style.display = "none";
	}

	// == upload all videos button == //
	uploadAllBtn.addEventListener("click", async () => {
		try {
			const playlistName = document
				.getElementById("playlistNameInput")
				.value.trim();
			const playlistDescription = document
				.getElementById("playlistDescriptionInput")
				.value.trim();
			const videoItems = document.querySelectorAll(".videoItem");

			const videoInfoMap = [];

			if (!playlistName) {
				alert("Please enter a playlist name first.");
				return;
			}
			if (!currentVideos.length) {
				alert("No videos to upload in this folder!");
				return;
			}

			videoItems.forEach((videoItem, index) => {
				const scoreInput = videoItem.querySelector(".scoreInput");
				const nameEventInput = videoItem.querySelector(".nameEventInput");
				const file = currentVideos[index]; // Assuming the order is maintained

				const score = scoreInput ? scoreInput.value.trim() : "";
				const nameString = nameEventInput?.value.trim() ?? "";

				const base = nameString || file.name;
				const title =
					nameString && playlistName
						? `${base} ${playlistName}` // override + playlist
						: base;

				if (file && file.id) {
					videoInfoMap[index] = [file, score, title];
				}
			});

			const token = await getAccessToken();
			if (!token) {
				alert("Failed to retrieve token for mass upload.");
				return;
			}

			// Call the mass upload function with a step update callback
			await massUploadAllVideosToPlaylist(
				videoInfoMap,
				playlistName,
				playlistDescription,
				token
			);
		} catch (err) {
			console.error("Error in mass upload:", err);
			showUploadStatus(
				"Mass upload failed. Check console for details.",
				"error"
			);
		}
	});

	// Set initial heights for resizing logic
	const resizablePanel = document.getElementById("resizablePanel");

	const totalHeight = resizablePanel.clientHeight;
	const defaultRatio = 0.5; // 50/50 split to start

	foldersSection.style.flexBasis = `${totalHeight * defaultRatio}px`;
	videosSection.style.flexBasis = `${totalHeight * (1 - defaultRatio) - 6}px`; // minus divider height
});

// -------------------------------------------------------------------------- //
/**
 * Renders the folder list. "Show Videos" calls listVideosInFolderWithAutoReauth.
 */
function renderFolderList(folders, token) {
	const folderListElem = document.getElementById("folderList");
	folderListElem.innerHTML = "";

	if (!folders.length) {
		folderListElem.textContent = "No folders found.";
		return;
	}

	folders.forEach((folder) => {
		const li = document.createElement("li");
		li.className = "folderItem";

		// adding click handler for entire folder box
		li.addEventListener("click", async () => {
			li.classList.add("selected");
			let finalToken = token;
			if (!finalToken) {
				finalToken = await getAccessToken();
				if (!finalToken) return;
			}
			try {
				const videos = await listVideosInFolderWithAutoReauth(
					finalToken,
					folder.id
				);

				// Cache the fresh video list
				await cacheCurrentVideos(videos, folder.name);

				// grab whatever token is now current (auto-reauth may have refreshed it)
				const freshToken = (await getAccessToken(false)) || finalToken;

				renderVideoList(videos, freshToken, folder.name);
			} catch (error) {
				console.error("Error listing videos:", error);
			}
			li.classList.remove("selected");
		});

		// Folder icon
		const icon = document.createElement("img");
		icon.src = "../icons/folder.png";
		li.appendChild(icon);

		// Folder name
		const nameSpan = document.createElement("span");
		nameSpan.textContent = folder.name;
		li.appendChild(nameSpan);

		// "Show Videos" button
		const showBtn = document.createElement("button");
		showBtn.textContent = "Show Videos";
		showBtn.addEventListener("click", async (e) => {
			e.stopPropagation(); // prevent bubbling to parent
			li.classList.add("selected");
			let finalToken = token;
			if (!finalToken) {
				finalToken = await getAccessToken();
				if (!finalToken) return;
			}
			try {
				const videos = await listVideosInFolderWithAutoReauth(
					finalToken,
					folder.id
				);

				// Cache the fresh video list
				await cacheCurrentVideos(videos, folder.name);

				// grab whatever token is now current (auto-reauth may have refreshed it)
				const freshToken = (await getAccessToken(false)) || finalToken;

				renderVideoList(videos, freshToken, folder.name);
			} catch (error) {
				console.error("Error listing videos:", error);
			}
			li.classList.remove("selected");
		});

		li.appendChild(showBtn);
		folderListElem.appendChild(li);
	});
}

// -------------------------------------------------------------------------- //
/**
 * Renders a list of videos with "Upload to YouTube" buttons
 * and also updates currentVideos so we can mass-upload them.
 * @param {Array} videos - List of video files
 * @param {string} accessToken - Current auth token
 * @param {string} folderName - Name of folder
 * @param {Object} [savedState=null] - Optional map of fileId -> {name, score}
 */
function renderVideoList(videos, accessToken, folderName, savedState = null) {
	const videoListElem = document.getElementById("videoList");
	videoListElem.innerHTML = "";

	// NEW: store globally so "mass upload" can see them
	currentVideos = videos;

	if (!videos.length) {
		videoListElem.textContent = `No video files found in ${folderName}.`;
		return;
	}

	// Helper to save current form state to cache
	const persistState = () => {
		const state = {};
		// Iterate over currentVideos to find their inputs
		currentVideos.forEach((vid, idx) => {
			// We can find the inputs by traversing the DOM or by ID if we set one.
			// Since we rebuild the list, we can rely on order matching if we are careful,
			// but using the file ID in the dataset is safer.
			const li = videoListElem.children[idx]; // roughly corresponds if list matches
			if (!li) return;

			const nameInput = li.querySelector(".nameEventInput");
			const scoreInput = li.querySelector(".scoreInput");

			if (nameInput || scoreInput) {
				state[vid.id] = {
					name: nameInput ? nameInput.value : "",
					score: scoreInput ? scoreInput.value : "",
				};
			}
		});
		cacheFormState(state);
	};

	videos.forEach((file) => {
		// lastIndexOf('.') returns -1 if no dot is found ⇢ slice(0, -0) ⇒ full name unchanged
		const baseName =
			file.name.slice(0, file.name.lastIndexOf(".")) || file.name;
		file.name = baseName;

		const li = document.createElement("li");
		li.className = "videoItem";
		li.dataset.id = file.id; // Mark the LI with ID for easier lookup via DOM if needed

		/* --- NEW: Stack container for Preview + Name --- */
		const infoStack = document.createElement("div");
		infoStack.className = "video-info-stack";

		// -- Link Video Preview Block --
		const previewWrapper = document.createElement("div");
		previewWrapper.className = "video-preview-wrapper";

		const thumbnailImg = document.createElement("img");
		thumbnailImg.className = "video-preview-thumb";
		// drive sometimes returns no thumbnailLink, or we can use a placeholder
		thumbnailImg.src = file.thumbnailLink || "../icons/icon48.png";
		previewWrapper.appendChild(thumbnailImg);

		// We will create the video element ONLY on hover to save resources
		let videoEl = null;
		let destroyTimer = null;
		let lastScrub = 0;

		previewWrapper.addEventListener("mouseenter", () => {
			// if you previously scheduled a destroy, cancel it
			if (destroyTimer) {
				clearTimeout(destroyTimer);
				destroyTimer = null;
			}

			if (!videoEl) {
				previewWrapper.classList.add("loading");

				videoEl = document.createElement("video");
				videoEl.className = "video-preview-player";
				videoEl.muted = true;
				videoEl.playsInline = true;

				// preload and keep buffer
				videoEl.preload = "auto";

				videoEl.oncanplay = () => {
					previewWrapper.classList.remove("loading");
					videoEl.style.display = "block";
				};

				videoEl.onerror = () => {
					console.error("Video load error:", videoEl.error);
					previewWrapper.classList.remove("loading");
				};

				previewWrapper.appendChild(videoEl);

				// keep your current src approach for now
				// UPDATED: Using declarativeNetRequest session rule for authentication
				// This avoids putting the access token in the URL query params
				videoEl.src = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
				videoEl.load(); // ensure fetch starts
			} else {
				videoEl.style.display = "block";
			}
		});

		previewWrapper.addEventListener("mousemove", (e) => {
			if (!videoEl || !isFinite(videoEl.duration) || videoEl.duration <= 0)
				return;

			const now = performance.now();
			if (now - lastScrub < 50) return; // 20 Hz
			lastScrub = now;

			const rect = previewWrapper.getBoundingClientRect();
			const percent = Math.max(
				0,
				Math.min(1, (e.clientX - rect.left) / rect.width)
			);
			videoEl.currentTime = videoEl.duration * percent;
		});
		previewWrapper.addEventListener("mouseleave", () => {
			if (!videoEl) return;

			// Freeze on the current frame:
			videoEl.pause();
			videoEl.style.display = "none";
		});

		infoStack.appendChild(previewWrapper);
		// -- End Video Preview Block --

		const nameSpan = document.createElement("span");
		nameSpan.className = "video-name";
		nameSpan.textContent = file.name; // Short name for the stack
		nameSpan.title = file.name; // Full name on hover
		infoStack.appendChild(nameSpan);

		li.appendChild(infoStack);

		// -- NEW: Input Stack Block --
		const inputStack = document.createElement("div");
		inputStack.className = "input-stack";

		// creating name + event input
		const nameEvt = document.createElement("input");
		nameEvt.type = "text";
		nameEvt.placeholder = "Athlete & event (optional)…";
		nameEvt.className = "nameEventInput";
		inputStack.appendChild(nameEvt);

		// creating score input
		const scoreInput = document.createElement("input");
		scoreInput.type = "text";
		scoreInput.placeholder = "Score (optional)";
		scoreInput.className = "scoreInput";
		inputStack.appendChild(scoreInput);

		// Restore state if available
		if (savedState && savedState[file.id]) {
			if (savedState[file.id].name) nameEvt.value = savedState[file.id].name;
			if (savedState[file.id].score)
				scoreInput.value = savedState[file.id].score;
		}

		// Add listeners to persist state on change
		nameEvt.addEventListener("input", persistState);
		scoreInput.addEventListener("input", persistState);

		li.appendChild(inputStack);
		// ----------------------------

		// Existing single upload
		const uploadBtn = document.createElement("button");
		uploadBtn.textContent = "Upload to YouTube";

		const playlistElmt = document.getElementById("playlistNameInput");

		uploadBtn.addEventListener("click", async () => {
			try {
				const playlistName = playlistElmt.value.trim();
				const score = scoreInput.value.trim();
				const athleteString = nameEvt.value.trim();

				const base = athleteString || file.name;
				const title =
					athleteString && playlistName
						? `${base} ${playlistName}` // override + playlist
						: base;

				showUploadStatus(
					`Uploading ${title}...`,
					3,
					1,
					"progress",
					[],
					"Step 1: Initiating upload session"
				);

				console.log("Uploading video:", file.name, "with title:", title);

				const uploadedVideo = await uploadToYouTubeWithAutoReauth(
					file.id,
					title,
					score,
					accessToken
				);

				showUploadStatus(
					`Uploading ${title}...`,
					3,
					2,
					"progress",
					[],
					"Step 2: Saving video ID to storage"
				);

				// Save the uploaded video ID to storage
				const videoData = [{ title: title, id: uploadedVideo.id }];
				await saveVideoIdsToStorage(videoData, true);

				showUploadStatus(
					`Successfully uploaded ${title}!`,
					3,
					3,
					"success",
					videoData
				);

				const updatedVideoData = await getStoredVideoIDs();
				updateHistoryList(updatedVideoData);
			} catch (err) {
				console.error("Upload failed:", err);
				showUploadStatus(`Failed to upload ${title}`, "error");
			}
		});
		li.appendChild(uploadBtn);
		videoListElem.appendChild(li);
	});
}

// -------------------------------------------------------------------------- //
/*
  Logic for resizing the folder and video sections
  This is a simple drag-to-resize implementation.
*/

let startY = 0;
let startHeight = 0;

divider.addEventListener("mousedown", (e) => {
	isDragging = true;
	startY = e.clientY;
	startHeight = foldersSection.offsetHeight;
	document.body.style.userSelect = "none"; // prevent text selection
});

document.addEventListener("mousemove", (e) => {
	if (!isDragging) return;
	const dy = e.clientY - startY;
	let newHeight = startHeight + dy;
	newHeight = Math.max(60, Math.min(300, newHeight)); // clamp between 60–300 px
	foldersSection.style.height = `${newHeight}px`;
	foldersSection.style.flex = `0 0 ${newHeight}px`; // force fixed height
});

document.addEventListener("mouseup", () => {
	isDragging = false;
	document.body.style.userSelect = "";
});
