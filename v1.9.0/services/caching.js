// caching.js - Handles caching of Picker-selected videos in local storage
//
// NOTE: With drive.file scope, users select individual video files via the
// Google Picker. We cache these selections so they persist across popup opens.
// Folder traversal is not supported with this OAuth scope.

import {
	chromeStorageGet,
	chromeStorageSet,
	chromeStorageRemove,
} from "../background/oauth.js";

const VIDEO_CACHE_KEY = "currentVideosCache";
const FORM_CACHE_KEY = "videoFormStateCache";
const CACHE_EXPIRY_KEY = "selectionCacheExpiry";
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// -------------------------------------------------------------------------- //
/**
 * Caches the current list of Picker-selected videos
 * @param {Array} videos - Array of video objects from Picker selection
 * @param {string} selectionName - Label for this selection batch (e.g., "Selected Videos")
 */
export async function cacheCurrentVideos(videos, selectionName) {
	try {
		// Maintain a single expiry so videos and form states align.

		let { [CACHE_EXPIRY_KEY]: expiryTime } = await chromeStorageGet([
			CACHE_EXPIRY_KEY,
		]);

		if (!expiryTime || Date.now() > expiryTime) {
			// Start a new session if none exists
			expiryTime = Date.now() + CACHE_DURATION_MS;
			await chromeStorageSet({ [CACHE_EXPIRY_KEY]: expiryTime });
		}

		await chromeStorageSet({
			[VIDEO_CACHE_KEY]: {
				videos,
				selectionName,
			},
		});

		console.log(`Cached ${videos.length} videos (${selectionName})`);
	} catch (error) {
		console.error("Failed to cache videos:", error);
	}
}

/**
 * Retrieves cached videos if valid
 * @returns {Object|null} - { videos, selectionName } or null if expired/missing
 */
export async function getCachedVideos() {
	try {
		const { [VIDEO_CACHE_KEY]: cachedData, [CACHE_EXPIRY_KEY]: expiryTime } =
			await chromeStorageGet([VIDEO_CACHE_KEY, CACHE_EXPIRY_KEY]);

		if (!cachedData || !expiryTime || Date.now() > expiryTime) {
			return null;
		}

		// Support both old (folderName) and new (selectionName) cache formats
		const selectionName =
			cachedData.selectionName || cachedData.folderName || "Selected Videos";
		console.log(`Using cached videos (${selectionName})`);
		return { videos: cachedData.videos, selectionName };
	} catch (error) {
		console.error("Failed to retrieve cached videos:", error);
		return null;
	}
}

// -------------------------------------------------------------------------- //
/**
 * Caches the form state (inputs) for the video list
 * @param {Object} formState - Key-value pair of video index/id -> { score, name }
 */
export async function cacheFormState(formState) {
	try {
		// Just save the state; reliance on global expiry is checked on retrieve
		await chromeStorageSet({ [FORM_CACHE_KEY]: formState });
		// console.log("Form state cached", formState);
	} catch (error) {
		console.error("Failed to cache form state:", error);
	}
}

/**
 * Retrieves cached form state if valid
 * @returns {Object|null} - The form state object or null
 */
export async function getCachedFormState() {
	try {
		const { [FORM_CACHE_KEY]: formState, [CACHE_EXPIRY_KEY]: expiryTime } =
			await chromeStorageGet([FORM_CACHE_KEY, CACHE_EXPIRY_KEY]);

		if (!formState || !expiryTime || Date.now() > expiryTime) {
			return null;
		}

		return formState;
	} catch (error) {
		console.error("Failed to get cached form state:", error);
		return null; // Return null on error so we don't break anything
	}
}

// -------------------------------------------------------------------------- //
export async function clearPickerCache() {
	try {
		await chromeStorageRemove([
			VIDEO_CACHE_KEY,
			FORM_CACHE_KEY,
			CACHE_EXPIRY_KEY,
		]);
	} catch (error) {
		console.error("Failed to clear picker cache", error);
	}
}
