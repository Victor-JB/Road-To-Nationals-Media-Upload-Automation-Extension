// services/picker.js
// Google Picker API configuration and validation.
//
// NOTE: The Google Picker itself is loaded in pickerPage.html which runs
// outside the extension's CSP restrictions. This module provides validation
// and config utilities.

import { PICKER_CONFIG } from "../popup/pickerConfig.js";

/**
 * Validates that the picker configuration is properly set up.
 * @throws {Error} if configuration is missing or invalid
 * @returns {Object} The validated PICKER_CONFIG
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
