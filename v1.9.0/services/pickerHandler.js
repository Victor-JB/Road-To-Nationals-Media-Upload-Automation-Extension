// services/pickerHandler.js
// High-level handler for Google Picker operations.
// This module provides a simple interface for the popup to use.

import {
	openVideoPicker,
	processPickerDocs,
	validatePickerConfig,
} from "./picker.js";

/**
 * Opens the Google Picker and returns selected video files.
 * This is the main entry point for picker operations.
 *
 * @returns {Promise<{success: boolean, videos: Array, error?: string}>}
 */
export async function selectVideosFromDrive() {
	try {
		// Validate configuration first
		validatePickerConfig();

		// Open picker and wait for selection
		const rawDocs = await openVideoPicker();

		if (!rawDocs || rawDocs.length === 0) {
			return {
				success: true,
				videos: [],
				cancelled: true,
			};
		}

		// Process and filter to only video files
		const videos = processPickerDocs(rawDocs);

		if (videos.length === 0) {
			return {
				success: false,
				videos: [],
				error: "No video files were selected. Please select video files only.",
			};
		}

		return {
			success: true,
			videos: videos,
			count: videos.length,
		};
	} catch (error) {
		console.error("Picker error:", error);
		return {
			success: false,
			videos: [],
			error: error.message || "Failed to open file picker",
		};
	}
}

/**
 * Checks if the picker is properly configured.
 * Use this to show/hide the picker button or display configuration warnings.
 *
 * @returns {{configured: boolean, error?: string}}
 */
export function isPickerConfigured() {
	try {
		validatePickerConfig();
		return { configured: true };
	} catch (error) {
		return {
			configured: false,
			error: error.message,
		};
	}
}
