// background.js - Service worker for the extension
// Handles message relay between picker content script and main popup

// Listen for messages from the picker content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === "pickerSelection") {
		// Close the Google Drive tab that was opened for the picker
		if (sender.tab && sender.tab.id) {
			chrome.tabs.remove(sender.tab.id).catch(() => {});
		}

		// Relay the picker selection to all extension pages (the popup)
		chrome.runtime
			.sendMessage({
				type: "pickerResult",
				docs: message.docs,
			})
			.catch(() => {
				// Popup might be closed, that's okay
				console.log("Could not relay picker result - popup may be closed");
			});
		sendResponse({ received: true });
		return true;
	}

	if (message.type === "pickerCancel") {
		// Close the Google Drive tab
		if (sender.tab && sender.tab.id) {
			chrome.tabs.remove(sender.tab.id).catch(() => {});
		}
		sendResponse({ received: true });
		return true;
	}

	if (message.type === "pickerError") {
		console.error("Picker error:", message.message);
		// Close the tab on error
		if (sender.tab && sender.tab.id) {
			chrome.tabs.remove(sender.tab.id).catch(() => {});
		}
		sendResponse({ received: true });
		return true;
	}
});
