// Configuration
// TODO: Replace with your actual API Key from Google Cloud Console
// The Picker API requires an API Key to load.
const DEVELOPER_KEY = "";

// Extracted from your Client ID: 1074281984090-...
const APP_ID = "1074281984090";

let oauthToken;
let pickerApiLoaded = false;

// 1. Listen for the token from the parent (Popup)
window.addEventListener("message", function (event) {
	if (event.data.type === "init") {
		oauthToken = event.data.token;
		if (event.data.apiKey) {
			// Allow overriding key if passed
			// (But we might strictly need it hardcoded or passed)
		}
		createPicker();
	}
});

// 2. Load the Google API Script
function loadScript() {
	const script = document.createElement("script");
	script.src = "https://apis.google.com/js/api.js";
	script.onload = onApiLoad;
	script.onerror = function () {
		document.getElementById("loading").textContent =
			"Error loading Google API.";
	};
	document.body.appendChild(script);
}

function onApiLoad() {
	gapi.load("picker", { callback: onPickerApiLoad });
}

function onPickerApiLoad() {
	pickerApiLoaded = true;
	createPicker();
}

// 3. Create the Picker
function createPicker() {
	if (pickerApiLoaded && oauthToken) {
		document.getElementById("loading").style.display = "none";

		const view = new google.picker.DocsView()
			.setIncludeFolders(false)
			.setSelectFolderEnabled(false)
			.setMimeTypes("video/mp4,video/quicktime,video/x-msvideo");

		const picker = new google.picker.PickerBuilder()
			.enableFeature(google.picker.Feature.NAV_HIDDEN)
			.enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
			.setAppId(APP_ID)
			.setOAuthToken(oauthToken)
			.addView(google.picker.ViewId.FOLDERS) // Allow picking folders
			.addView(view) // Allow picking files
			.setDeveloperKey(DEVELOPER_KEY)
			.setCallback(pickerCallback)
			.build();

		picker.setVisible(true);
	}
}

// 4. Handle selection
function pickerCallback(data) {
	if (data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {
		const docs = data[google.picker.Response.DOCUMENTS];
		// Send back to parent
		window.parent.postMessage({ type: "picked", docs: docs }, "*");
	} else if (
		data[google.picker.Response.ACTION] == google.picker.Action.CANCEL
	) {
		window.parent.postMessage({ type: "cancel" }, "*");
	}
}

loadScript();
