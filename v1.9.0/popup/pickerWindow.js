// pickerWindow.js - Runs in the picker popup window
// This window embeds a sandboxed iframe that loads Google's Picker API

// Get token from URL
const params = new URLSearchParams(window.location.search);
const token = params.get("token");

if (!token) {
	document.body.innerHTML =
		'<p style="color:red;padding:20px;">No OAuth token provided.</p>';
} else if (!window.PICKER_CONFIG || !window.PICKER_CONFIG.developerKey) {
	document.body.innerHTML =
		'<p style="color:red;padding:20px;">Invalid picker configuration.</p>';
} else {
	// Build the sandbox iframe URL with all necessary params
	const config = window.PICKER_CONFIG;
	const sandboxUrl = new URL(chrome.runtime.getURL("popup/pickerSandbox.html"));
	sandboxUrl.searchParams.set("token", token);
	sandboxUrl.searchParams.set("developerKey", config.developerKey);
	sandboxUrl.searchParams.set("appId", config.appId);

	document.getElementById("sandboxFrame").src = sandboxUrl.toString();
}

// Listen for messages from the sandboxed iframe
window.addEventListener("message", (event) => {
	// Verify it's from our sandbox (same extension origin or null for sandbox)
	const data = event.data;
	if (!data || !data.type) return;

	if (data.type === "picked") {
		// Relay to background script
		chrome.runtime.sendMessage(
			{
				type: "pickerSelection",
				docs: data.docs,
			},
			() => {
				window.close();
			}
		);
	} else if (data.type === "cancel") {
		chrome.runtime.sendMessage({ type: "pickerCancel" });
		window.close();
	}
});
