// youtubeApi.js

import {
	chromeStorageGet,
	chromeStorageSet,
	getAccessToken,
} from "../background/oauth.js";
import {
	showUploadStatus,
	withAutoReauth,
	buildDescription,
	updateHistoryList,
} from "../utils/utils.js";

const MUPLOAD_STEPS = 3;

/**
 * Saves uploaded video IDs to chrome.storage.local.
 * The key is the video title, and the value is the video ID.
 */
export async function saveVideoIdsToStorage(newVideoData, append = false) {
	if (append) {
		const { videoData = [] } = await chromeStorageGet("videoData");
		newVideoData = [...videoData, ...newVideoData];
	}
	chromeStorageSet({ videoData: newVideoData })
		.then(() => {
			console.log("Video data saved:", newVideoData);
		})
		.catch((error) => {
			console.error("Error saving video data:", error);
		});
}

/**
 * Fetch all stored video-ID entries and return
 * them as an array of { title, id } objects.
 */
export async function getStoredVideoIDs() {
	const { videoData = [] } = await chromeStorageGet("videoData");
	return videoData;
}

//--------------------------------------------------------------------------- //
/**
 * Fetches a file from Google Drive with retry logic for temporary failures.
 * Works with Picker-selected files (drive.file scope grants access).
 *
 * @param {string} driveFileId - The Google Drive file ID
 * @param {string} accessToken - OAuth access token
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @returns {Promise<Blob>} - The file as a Blob
 */
async function fetchDriveFileWithRetry(
	driveFileId,
	accessToken,
	maxRetries = 3
) {
	let lastError = null;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await fetch(
				`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
				{ headers: { Authorization: `Bearer ${accessToken}` } }
			);

			if (response.ok) {
				return await response.blob();
			}

			// Handle specific error codes
			if (response.status === 403) {
				throw new Error(
					`Access denied to file (403). The file may not have been selected via Picker, ` +
						`or the drive.file scope doesn't grant access to this file.`
				);
			}

			if (response.status === 404) {
				throw new Error(
					`File not found (404). The file may have been deleted or moved.`
				);
			}

			if (response.status === 401) {
				const err = new Error("Authentication failed - token may be expired");
				err.status = 401;
				throw err;
			}

			// For 5xx errors or rate limits (429), retry
			if (response.status >= 500 || response.status === 429) {
				lastError = new Error(`Drive API error: ${response.status}`);
				lastError.status = response.status;

				if (attempt < maxRetries) {
					const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
					console.warn(
						`Attempt ${attempt} failed with ${response.status}, retrying in ${delay}ms...`
					);
					await new Promise((resolve) => setTimeout(resolve, delay));
					continue;
				}
			}

			// Other errors - don't retry
			const err = new Error(
				`Failed to fetch file from Drive: ${response.status}`
			);
			err.status = response.status;
			throw err;
		} catch (error) {
			if (
				error.status === 401 ||
				error.status === 403 ||
				error.status === 404
			) {
				throw error; // Don't retry auth/access/not-found errors
			}
			lastError = error;
			if (attempt === maxRetries) {
				throw lastError;
			}
		}
	}

	throw lastError || new Error("Failed to fetch file after retries");
}

/**
 * Validates that we can access a Drive file before attempting upload.
 * This catches permission issues early with a lightweight metadata request.
 *
 * @param {string} driveFileId - The Google Drive file ID
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<{id: string, name: string, mimeType: string}>} - File metadata
 */
async function validateDriveFileAccess(driveFileId, accessToken) {
	const response = await fetch(
		`https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=id,name,mimeType`,
		{ headers: { Authorization: `Bearer ${accessToken}` } }
	);

	if (!response.ok) {
		if (response.status === 403) {
			throw new Error(
				`Cannot access file (403 Forbidden). With drive.file scope, you can only access ` +
					`files selected through the Picker or created by this app.`
			);
		}
		if (response.status === 404) {
			throw new Error(
				`File not found (404). It may have been deleted or moved.`
			);
		}
		if (response.status === 401) {
			const err = new Error("Authentication failed");
			err.status = 401;
			throw err;
		}
		throw new Error(`Cannot access file: ${response.status}`);
	}

	return await response.json();
}

//--------------------------------------------------------------------------- //
/**
 * Resumable upload: fetch the video bytes from Drive, then upload them to YouTube.
 * If token is invalid, we throw an Error with .status = 401.
 *
 * With drive.file scope, this only works for files that were:
 * - Selected through the Google Picker API, OR
 * - Created by this application
 *
 * @param {string} driveFileId - The Google Drive file ID
 * @param {string} title - Video title
 * @param {string} desc - Video description (score)
 */
export async function uploadToYouTube(driveFileId, title, desc) {
	const accessToken = await getAccessToken();
	if (!accessToken) {
		throw new Error("Failed to get access token");
	}

	// Step 0: Validate file access before starting upload
	console.log(`Validating access to Drive file: ${driveFileId}`);
	const fileInfo = await validateDriveFileAccess(driveFileId, accessToken);
	console.log(`File access confirmed: ${fileInfo.name} (${fileInfo.mimeType})`);

	// Step 1: Initiate the upload session
	const fixed_desc = buildDescription(desc);

	let response = await fetch(
		"https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				"X-Upload-Content-Type": "video/*",
			},
			body: JSON.stringify({
				snippet: {
					title: title,
					description: fixed_desc,
					categoryId: "22", // People & Blogs
				},
				status: {
					privacyStatus: "public", // or "unlisted"/"private"
					selfDeclaredMadeForKids: true,
				},
			}),
		}
	);

	if (!response.ok) {
		const err = new Error("Failed to start YouTube upload");
		err.status = response.status;
		throw err;
	}

	const uploadUrl = response.headers.get("Location");

	// Step 2: Download the video blob from Drive (with retry logic)
	console.log(`Downloading video from Drive: ${driveFileId}`);
	const fileBlob = await fetchDriveFileWithRetry(driveFileId, accessToken);
	console.log(`Downloaded ${fileBlob.size} bytes`);

	// Step 3: PUT the blob to the YouTube resumable session
	response = await fetch(uploadUrl, {
		method: "PUT",
		headers: { "Content-Length": fileBlob.size },
		body: fileBlob,
	});

	if (!response.ok) {
		const err = new Error("YouTube upload failed");
		err.status = response.status;
		throw err;
	}

	const youtubeData = await response.json();
	console.log("Uploaded to YouTube:", youtubeData);

	// Return the final data so we can get the uploaded video's ID
	return youtubeData;
}

export const uploadToYouTubeWithAutoReauth = withAutoReauth(uploadToYouTube);

//--------------------------------------------------------------------------- //
/**
 * Creates a new YouTube playlist with the given name.
 * Requires a token with playlist write permission (often "youtube" or "youtube.force-ssl" scope).
 */
async function createPlaylist(playlistName, playlistDescription) {
	const accessToken = await getAccessToken();
	const desc_str =
		"\n\n\nPlaylist automatically generated via GymACT Road2Nationals Uploader";
	const playlistMeta = {
		snippet: {
			title: playlistName,
			description: playlistDescription + desc_str || desc_str,
		},
		status: {
			privacyStatus: "public", // or "unlisted"/"private"
		},
	};

	const response = await fetch(
		"https://www.googleapis.com/youtube/v3/playlists?part=snippet%2Cstatus",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(playlistMeta),
		}
	);

	if (!response.ok) {
		const errorBody = await response.text(); // Log the response body for debugging
		console.error("Failed to create playlist:", response.status, errorBody);
		const err = new Error("Failed to create playlist");
		err.status = response.status;
		console.log("Error response:", response);
		console.log(err);
		err.response = errorBody;
		throw err;
	}

	const data = await response.json();
	console.log("Created playlist:", data);
	return data; // data.id is the new playlist ID
}

//--------------------------------------------------------------------------- //
/**
 * Adds the given YouTube videoId to the specified playlistId.
 */
async function addVideoToPlaylist(playlistId, videoId) {
	const accessToken = await getAccessToken();
	const body = {
		snippet: {
			playlistId: playlistId,
			resourceId: {
				kind: "youtube#video",
				videoId: videoId,
			},
		},
	};

	const response = await fetch(
		"https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		}
	);

	if (!response.ok) {
		const err = new Error("Failed to add video to playlist");
		err.status = response.status;
		throw err;
	}

	const data = await response.json();
	console.log(`Added video ${videoId} to playlist ${playlistId}:`, data);
	return data;
}

//--------------------------------------------------------------------------- //
/**
 * Mass-uploads all Drive videos to YouTube and puts them in a NEW playlist.
 * - 1) Create a brand new playlist
 * - 2) For each video, upload to YouTube
 * - 3) Insert the uploaded videoId into that playlist
 */
export async function massUploadAllVideosToPlaylist(
	videosInfoMap,
	playlistName,
	playlistDescription
) {
	const uploadedVideos = [];
	let stepMessage = "";
	const totalVideos = videosInfoMap.length;
	const TSTEPS = MUPLOAD_STEPS + totalVideos;

	// Show initial status
	showUploadStatus(
		"Uploading all videos to playlist...",
		TSTEPS,
		1,
		"progress",
		[],
		"Step 1: Creating playlist..."
	);

	// 1) Create a new playlist
	const playlist = await createPlaylist(playlistName, playlistDescription);
	const playlistId = playlist.id;

	showUploadStatus(
		"Uploading all videos to playlist...",
		TSTEPS,
		2,
		"progress",
		[],
		"Step 2: Uploading videos..."
	);
	// 2) Loop through each video => upload => add to playlist
	for (let i = 0; i < totalVideos; i++) {
		const file = videosInfoMap[i][0];
		const score_desc = videosInfoMap[i][1];
		const title = videosInfoMap[i][2];

		stepMessage = `Step 2.${i + 1}: Uploading video ${
			i + 1
		} of ${totalVideos} (${title})...`;
		showUploadStatus(
			"Uploading all videos to playlist...",
			TSTEPS,
			3 + i,
			"progress",
			[],
			stepMessage
		);

		const uploadedVideo = await uploadToYouTubeWithAutoReauth(
			file.id,
			title,
			score_desc
		);

		stepMessage = `Step 2.${i + 2}: Adding video ${
			i + 1
		} of ${totalVideos} (${title}) to playlist...`;
		showUploadStatus(
			"Uploading all videos to playlist...",
			TSTEPS,
			3 + i,
			"progress",
			[],
			stepMessage
		);
		await addVideoToPlaylist(playlistId, uploadedVideo.id);

		// Save the uploaded video's title and ID
		uploadedVideos.push({ title: title, id: uploadedVideo.id });
	}

	// 3) Save all uploaded video IDs to storage
	showUploadStatus(
		"Saving video IDs to storage...",
		TSTEPS,
		TSTEPS - 1,
		"progress",
		[]
	);

	await saveVideoIdsToStorage(uploadedVideos, false);
	updateHistoryList(uploadedVideos);

	// Show success message with all uploaded video data
	showUploadStatus(
		"All videos uploaded and added to the playlist!",
		TSTEPS,
		TSTEPS,
		"success",
		uploadedVideos
	);
}
