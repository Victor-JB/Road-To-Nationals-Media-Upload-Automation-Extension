// background.js - Service worker for the extension
// Handles message relay between picker popup window and main popup

// Listen for messages from the picker window
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === "pickerSelection") {
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
		// User cancelled, no action needed
		sendResponse({ received: true });
		return true;
	}
});
