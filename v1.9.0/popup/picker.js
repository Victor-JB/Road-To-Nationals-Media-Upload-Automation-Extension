// picker.js

let oauthToken = null;
let pickerApiLoaded = false;
let pickerConfig = null;

// In an extension page, this is "chrome-extension://<extension-id>"
const EXTENSION_ORIGIN = window.location.origin;

// 1) Receive OAuth token from parent (popup)
window.addEventListener("message", (event) => {
	// Only accept messages from the same extension origin
	if (event.origin !== EXTENSION_ORIGIN) return;

	const data = event.data;
	if (!data || data.type !== "init") return;

	if (typeof data.token !== "string" || data.token.length < 20) {
		console.error("Picker init: invalid token");
		document.getElementById("loading").textContent = "Invalid OAuth token.";
		return;
	}

	if (!isValidConfig(data.config)) {
		document.getElementById("loading").textContent =
			"Picker configuration missing. Update pickerConfig.js.";
		return;
	}

	oauthToken = data.token;
	pickerConfig = data.config;
	maybeCreatePicker();
});

// 2) Load the Google API script and Picker module
function loadScript() {
	const script = document.createElement("script");
	script.src = "https://apis.google.com/js/api.js";
	script.onload = () => {
		// gapi is now available
		gapi.load("picker", { callback: onPickerApiLoad });
	};
	script.onerror = () => {
		document.getElementById("loading").textContent =
			"Error loading Google API (api.js).";
	};
	document.body.appendChild(script);
}

function onPickerApiLoad() {
	pickerApiLoaded = true;
	maybeCreatePicker();
}

// 3) Build the picker when both token + picker API are ready
function maybeCreatePicker() {
	if (!pickerApiLoaded || !oauthToken || !pickerConfig) return;

	const loadingEl = document.getElementById("loading");
	if (loadingEl) loadingEl.style.display = "none";

	// Video-only view
	const videoView = new google.picker.DocsView()
		.setIncludeFolders(false)
		.setSelectFolderEnabled(false)
		.setMimeTypes("video/mp4,video/quicktime,video/x-msvideo");

	const picker = new google.picker.PickerBuilder()
		.setAppId(pickerConfig.appId)
		.setDeveloperKey(pickerConfig.developerKey)
		.setOAuthToken(oauthToken)
		.enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
		// NAV_HIDDEN hides left nav; remove if you want normal navigation UI
		.enableFeature(google.picker.Feature.NAV_HIDDEN)
		// If you want users to pick folders too, keep this:
		.addView(google.picker.ViewId.FOLDERS)
		.addView(videoView)
		.setCallback(pickerCallback)
		.build();

	picker.setVisible(true);
}

// 4) Handle selection and send back to parent safely
function pickerCallback(data) {
	const action = data[google.picker.Response.ACTION];

	if (action === google.picker.Action.PICKED) {
		const docs = data[google.picker.Response.DOCUMENTS] || [];
		window.parent.postMessage({ type: "picked", docs }, EXTENSION_ORIGIN);
	} else if (action === google.picker.Action.CANCEL) {
		window.parent.postMessage({ type: "cancel" }, EXTENSION_ORIGIN);
	}
}

function isValidConfig(config) {
	if (!config) return false;
	const { developerKey, appId } = config;
	if (typeof developerKey !== "string" || developerKey.length < 10) {
		console.error("Developer key missing or invalid");
		return false;
	}
	if (typeof appId !== "string" || !appId.trim()) {
		console.error("App ID missing or invalid");
		return false;
	}
	return true;
}

loadScript();
