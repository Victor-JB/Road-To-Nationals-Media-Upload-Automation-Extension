// services/pickerHandler.js
// High-level handler for Google Picker operations.
// This module provides validation utilities for the popup to use.

import { validatePickerConfig } from "./picker.js";

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
