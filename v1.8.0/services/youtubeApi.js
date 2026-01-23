// youtubeApi.js

import { chromeStorageGet, chromeStorageSet } from "../background/oauth.js";
import {
	showUploadStatus,
	withAutoReauth,
	buildDescription,
	updateHistoryList,
} from "../utils/utils.js";

const MUPLOAD_STEPS = 3;
const SESSION_KEY = "massUploadSession";

/**
 * {
 *   folderId:    '1aBcD',          // Google-Drive folder
 *   playlistId:  'PLxyz',          // created at runtime (or '')
 *   playlistName:'2025 Nationals', // for title concatenation
 *   index:       0,                // NEXT video to upload
 *   jobs: [                      // same order as the folder listing
 *     {
 *       driveId:     'file123',
 *       customTitle: 'Joseph Conley FX',
 *       score:       '13.05',      // if you keep that field
 *       status:      'pending' | 'done' | 'error',
 *       youtubeId:   'abcdEFGhijk' // set when done
 *     }, …
 *   ]
 * }
 */

function loadSession() {
	return new Promise((resolve) =>
		chrome.storage.local.get(SESSION_KEY, (data) =>
			resolve(data[SESSION_KEY] || null)
		)
	);
}

function saveSession(session) {
	return new Promise((resolve) =>
		chrome.storage.local.set({ [SESSION_KEY]: session }, resolve)
	);
}

function clearSession() {
	return new Promise((resolve) =>
		chrome.storage.local.remove(SESSION_KEY, resolve)
	);
}

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
 * Resumable upload: fetch the video bytes from Drive, then upload them to YouTube.
 * If token is invalid, we throw an Error with .status = 401.
 */
export async function uploadToYouTube(driveFileId, title, desc, accessToken) {
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

	// Step 2: Download the video blob from Drive
	response = await fetch(
		`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
		{ headers: { Authorization: `Bearer ${accessToken}` } }
	);

	if (!response.ok) {
		const err = new Error("Failed to fetch file from Drive");
		err.status = response.status;
		throw err;
	}

	const fileBlob = await response.blob();

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

export const uploadToYouTubeWithAutoReauth = withAutoReauth(
	uploadToYouTube,
	/* tokenIndex= */ 3
);

//--------------------------------------------------------------------------- //
/**
 * Creates a new YouTube playlist with the given name.
 * Requires a token with playlist write permission (often "youtube" or "youtube.force-ssl" scope).
 */
async function createPlaylist(accessToken, playlistName, playlistDescription) {
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
async function addVideoToPlaylist(accessToken, playlistId, videoId) {
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
	playlistDescription,
	accessToken
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
	const playlist = await createPlaylist(
		accessToken,
		playlistName,
		playlistDescription
	);
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
			score_desc,
			accessToken
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
		await addVideoToPlaylist(accessToken, playlistId, uploadedVideo.id);

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
