// background/oauth.js
// Handles accessToken persistence and Chrome identity OAuth flow.

// -------------------------------------------------------------------------- //
export function chromeStorageGet(keys) {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get(keys, (items) => {
			if (chrome.runtime.lastError) {
				console.error(
					"chrome.storage.local.get error:",
					chrome.runtime.lastError
				);
				return reject(chrome.runtime.lastError);
			}
			resolve(items);
		});
	});
}

// -------------------------------------------------------------------------- //
export function chromeStorageSet(items) {
	return new Promise((resolve, reject) => {
		chrome.storage.local.set(items, () => {
			if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
			resolve();
		});
	});
}

// -------------------------------------------------------------------------- //
export function chromeStorageRemove(keys) {
	return new Promise((resolve, reject) => {
		chrome.storage.local.remove(keys, () => {
			if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
			resolve();
		});
	});
}

// -------------------------------------------------------------------------- //
/**
 * Invalidates the current access token by removing it from storage.
 * Call this when you receive a 401 error to force re-authentication.
 */
export async function invalidateToken() {
	await chromeStorageRemove(["accessToken", "tokenExpiry"]);
	console.log("Token invalidated");
}

// -------------------------------------------------------------------------- //
/**
 * Returns a (cached) OAuth 2.0 access token or launches interactive flow.
 *
 * IMPORTANT LIMITATION: With drive.file scope, we can only access:
 * - Files the user explicitly selects through the Google Picker API
 * - Files created by our application
 *
 * We CANNOT recursively list folder contents or access arbitrary files.
 * The user must select each file individually via the Picker.
 *
 * @param {boolean} interactive - Whether to prompt the user (default: true)
 */
export async function getAccessToken(interactive = true) {
	const { accessToken, tokenExpiry } = await chromeStorageGet([
		"accessToken",
		"tokenExpiry",
	]);

	// Check if token exists and is not expired (buffer of 60s)
	if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
		return accessToken;
	}

	// If we are restricted from being interactive, fail here
	if (!interactive) {
		console.warn("Token expired/missing and interactive mode is OFF.");
		return null;
	}

	// Token missing or expired -> fetch new one
	console.log("Token missing or expired, starting OAuth flow...");

	const CLIENT_ID =
		"1074281984090-u48kuhvpr07has1i5s0tvru2qi790f2p.apps.googleusercontent.com";
	const SCOPES = [
		"https://www.googleapis.com/auth/drive.file",
		"https://www.googleapis.com/auth/youtube.force-ssl",
	].join(" ");

	const redirectUri = chrome.identity.getRedirectURL();
	const authUrl =
		"https://accounts.google.com/o/oauth2/auth" +
		`?client_id=${encodeURIComponent(CLIENT_ID)}` +
		"&response_type=token" +
		`&redirect_uri=${encodeURIComponent(redirectUri)}` +
		`&scope=${encodeURIComponent(SCOPES)}`;

	const redirect = await new Promise((resolve, reject) => {
		chrome.identity.launchWebAuthFlow(
			{ url: authUrl, interactive: true },
			(response) => {
				if (chrome.runtime.lastError) {
					reject(chrome.runtime.lastError);
				} else {
					resolve(response);
				}
			}
		);
	});

	if (!redirect) throw new Error("User closed OAuth window or OAuth failed");

	// Extract #access_token=...
	const tokenMatch = redirect.match(/[#&]access_token=([^&]+)/);
	const expiresMatch = redirect.match(/[#&]expires_in=([^&]+)/);

	if (!tokenMatch) throw new Error("Could not parse OAuth response");

	const token = tokenMatch[1];
	// Default to 3600s (1 hour) if not found
	const expiresInSeconds = expiresMatch ? parseInt(expiresMatch[1], 10) : 3600;

	// Calculate specific expiry timestamp
	const expiryTimestamp = Date.now() + expiresInSeconds * 1000;

	await chromeStorageSet({
		accessToken: token,
		tokenExpiry: expiryTimestamp,
	});

	return token;
}
