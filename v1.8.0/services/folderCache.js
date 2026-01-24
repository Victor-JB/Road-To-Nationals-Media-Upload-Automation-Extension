// folderCache.js - Handles caching of Drive folder data in local storage

import {
	chromeStorageGet,
	chromeStorageSet,
	chromeStorageRemove,
} from "../background/oauth.js";

// Cache configuration
const CACHE_KEY = "driveFoldersCache";
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
 * Clears the folders cache (useful for forced refresh or logout)
 */
export async function clearFoldersCache() {
	try {
		await chromeStorageRemove([CACHE_KEY, CACHE_EXPIRY_KEY]);
		console.log("Folders cache cleared");
	} catch (error) {
		console.error("Failed to clear folders cache:", error);
	}
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
