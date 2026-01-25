// folderCache.js - Handles caching of Drive folder data in local storage

import {
	chromeStorageGet,
	chromeStorageSet,
	chromeStorageRemove,
} from "../background/oauth.js";

// Cache configuration
const CACHE_KEY = "driveFoldersCache";
const VIDEO_CACHE_KEY = "currentVideosCache";
const FORM_CACHE_KEY = "videoFormStateCache";
const CACHE_EXPIRY_KEY = "driveFoldersCacheExpiry";
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// -------------------------------------------------------------------------- //
/**
 * Stores folders data in local storage with expiry timestamp
 * @param {Array} folders - Array of folder objects from Drive API
 */
export async function cacheFolders(folders) {
	try {
		const expiryTime = Date.now() + CACHE_DURATION_MS;

		await chromeStorageSet({
			[CACHE_KEY]: folders,
			[CACHE_EXPIRY_KEY]: expiryTime,
		});

		console.log(
			`Cached ${folders.length} folders until ${new Date(
				expiryTime
			).toLocaleTimeString()}`
		);
	} catch (error) {
		console.error("Failed to cache folders:", error);
	}
}

// -------------------------------------------------------------------------- //
/**
 * Retrieves cached folders if they exist and haven't expired
 * @returns {Array|null} - Cached folders array or null if cache miss/expired
 */
export async function getCachedFolders() {
	try {
		const { [CACHE_KEY]: cachedFolders, [CACHE_EXPIRY_KEY]: expiryTime } =
			await chromeStorageGet([CACHE_KEY, CACHE_EXPIRY_KEY]);

		// Check if cache exists and hasn't expired
		if (!cachedFolders || !expiryTime || Date.now() > expiryTime) {
			console.log("Cache miss or expired, will fetch fresh data");
			return null;
		}

		console.log(`Using cached folders (${cachedFolders.length} items)`);
		return cachedFolders;
	} catch (error) {
		console.error("Failed to retrieve cached folders:", error);
		return null;
	}
}

// -------------------------------------------------------------------------- //
/**
 * Caches the current list of videos and folder name
 * @param {Array} videos - Array of video objects
 * @param {string} folderName - Name of the folder these videos belong to
 */
export async function cacheCurrentVideos(videos, folderName) {
	try {
		// We do NOT set a new expiry here; we respect the existing one
		// or ensure one exists if for some reason it doesn't.
		// But typically, folders are cached first, setting the global expiry.
		// If folders aren't cached, start a fresh expiry window.

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
				folderName,
			},
		});

		console.log(`Cached ${videos.length} videos for folder "${folderName}"`);
	} catch (error) {
		console.error("Failed to cache videos:", error);
	}
}

/**
 * Retrieves cached videos if valid
 * @returns {Object|null} - { videos, folderName } or null
 */
export async function getCachedVideos() {
	try {
		const { [VIDEO_CACHE_KEY]: cachedData, [CACHE_EXPIRY_KEY]: expiryTime } =
			await chromeStorageGet([VIDEO_CACHE_KEY, CACHE_EXPIRY_KEY]);

		if (!cachedData || !expiryTime || Date.now() > expiryTime) {
			return null;
		}

		console.log(`Using cached videos for folder "${cachedData.folderName}"`);
		return cachedData;
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
/**
 * Clears ALL caches (folders, videos, forms)
 */
export async function clearAllCaches() {
	try {
		await chromeStorageRemove([
			CACHE_KEY,
			VIDEO_CACHE_KEY,
			FORM_CACHE_KEY,
			CACHE_EXPIRY_KEY,
		]);
		console.log("All caches cleared");
	} catch (error) {
		console.error("Failed to clear caches:", error);
	}
}

/**
 * Clears the folders cache (useful for forced refresh or logout)
 */
export async function clearFoldersCache() {
	// Redirect to clearAllCaches to keep them in sync,
	// or keep separate if user only wants to refresh folders vs videos?
	// User asked: "expire when the app token and folders expire, all at the same time"
	// So clearing one should probably clear all to avoid mismatched states.
	return clearAllCaches();
}

// -------------------------------------------------------------------------- //
/**
 * Checks if the cache is valid (exists and not expired)
 * @returns {boolean} - True if cache is valid, false otherwise
 */
export async function isCacheValid() {
	try {
		const { [CACHE_EXPIRY_KEY]: expiryTime } = await chromeStorageGet([
			CACHE_EXPIRY_KEY,
		]);
		return expiryTime && Date.now() < expiryTime;
	} catch (error) {
		console.error("Failed to check cache validity:", error);
		return false;
	}
}

// -------------------------------------------------------------------------- //
/**
 * Gets cache metadata for debugging/UI purposes
 * @returns {Object} - Cache info including expiry time and item count
 */
export async function getCacheInfo() {
	try {
		const { [CACHE_KEY]: cachedFolders, [CACHE_EXPIRY_KEY]: expiryTime } =
			await chromeStorageGet([CACHE_KEY, CACHE_EXPIRY_KEY]);

		return {
			hasCache: !!cachedFolders,
			itemCount: cachedFolders?.length || 0,
			expiryTime: expiryTime || null,
			isExpired: expiryTime ? Date.now() > expiryTime : true,
			timeUntilExpiry: expiryTime ? Math.max(0, expiryTime - Date.now()) : 0,
		};
	} catch (error) {
		console.error("Failed to get cache info:", error);
		return {
			hasCache: false,
			itemCount: 0,
			expiryTime: null,
			isExpired: true,
			timeUntilExpiry: 0,
		};
	}
}
