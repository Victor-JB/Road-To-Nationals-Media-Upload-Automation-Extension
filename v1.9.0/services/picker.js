// services/picker.js
// Google Picker API integration for selecting video files from Drive.
//
// IMPORTANT: Due to Chrome Extension CSP restrictions, the Google Picker API
// cannot be loaded directly in extension pages. This module coordinates with
// a picker page that runs in a web-accessible context.

import { getAccessToken } from "../background/oauth.js";
import { PICKER_CONFIG } from "../popup/pickerConfig.js";

/**
 * Validates that the picker configuration is properly set up.
 * @throws {Error} if configuration is missing or invalid
 */
export function validatePickerConfig() {
	if (!PICKER_CONFIG) {
		throw new Error("Picker configuration is missing");
	}
	if (
		!PICKER_CONFIG.developerKey ||
		PICKER_CONFIG.developerKey === "YOUR_API_KEY"
	) {
		throw new Error("Please configure your Google API Key in pickerConfig.js");
	}
	if (!PICKER_CONFIG.appId || PICKER_CONFIG.appId === "YOUR_APP_ID") {
		throw new Error("Please configure your App ID in pickerConfig.js");
	}
	return PICKER_CONFIG;
}

/**
 * Opens the Google Picker to select video files.
 * Returns a Promise that resolves with the selected files or rejects on cancel/error.
 *
 * Note: With drive.file scope, the picker grants access to selected files.
 * We cannot browse folders programmatically - users must select individual files.
 *
 * @returns {Promise<Array<{id: string, name: string, mimeType: string, url: string}>>}
 */
export async function openVideoPicker() {
	// Validate configuration
	const config = validatePickerConfig();

	// Get OAuth token
	const accessToken = await getAccessToken();
	if (!accessToken) {
		throw new Error("Failed to get access token for Picker");
	}

	// Open the picker page in a new tab
	// The picker page will load the Google API and handle the picker UI
	return new Promise((resolve, reject) => {
		const pickerPageUrl = chrome.runtime.getURL("popup/pickerPage.html");

		// Create a message listener for the picker result
		const messageListener = (message, sender, sendResponse) => {
			if (message.type === "PICKER_RESULT") {
				chrome.runtime.onMessage.removeListener(messageListener);

				if (message.error) {
					reject(new Error(message.error));
				} else if (message.action === "cancel") {
					resolve([]); // User cancelled - return empty array
				} else if (message.docs) {
					resolve(message.docs);
				} else {
					resolve([]);
				}
			}
		};

		chrome.runtime.onMessage.addListener(messageListener);

		// Open picker page in new window with token and config
		const params = new URLSearchParams({
			token: accessToken,
			apiKey: config.developerKey,
			appId: config.appId,
		});

		window.open(
			`${pickerPageUrl}?${params.toString()}`,
			"googlePicker",
			"width=900,height=600,menubar=no,toolbar=no,location=no,status=no"
		);

		// Timeout after 5 minutes
		setTimeout(() => {
			chrome.runtime.onMessage.removeListener(messageListener);
			reject(new Error("Picker timed out"));
		}, 5 * 60 * 1000);
	});
}

/**
 * Processes raw picker documents into a standardized format.
 * @param {Array} docs - Raw documents from Google Picker
 * @returns {Array<{id: string, name: string, mimeType: string, parent: string|null}>}
 */
export function processPickerDocs(docs) {
	if (!Array.isArray(docs)) {
		return [];
	}

	return docs
		.filter((doc) => doc.mimeType && doc.mimeType.startsWith("video/"))
		.map((doc) => ({
			id: doc.id,
			name: doc.name,
			mimeType: doc.mimeType,
			parent: doc.parentId || null,
			url: doc.url || null,
			thumbnailLink: doc.iconUrl || null,
		}));
}
