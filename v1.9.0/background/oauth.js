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
 * Checks if a stored token is valid.
 * This is a basic check. For robustness, you can try calling an API endpoint (like tokeninfo).
 * But relying on the API calls returning 401 is usually more efficient than pre-checking.
 * However, since you asked for checking expiry, we can add a check if we store expiry time.
 * If we don't store expiry time (Implicit Flow often doesn't give it easily in the fragment without parsing 'expires_in'),
 * we can rely on the re-auth flow.
 *
 * NOTE: The existing 'getAccessToken' implements the Implicit Grant flow manually via `launchWebAuthFlow`.
 * The response usually looks like: ...#access_token=ya29...&token_type=Bearer&expires_in=3599
 * We should parse `expires_in` to know when it expires locally.
 */

/**
 * Sets a session-scoped declarativeNetRequest rule to automatically inject
 * the Authorization header for Drive media requests.
 * This allows <video src="..."> to work without exposing the token in the URL.
 */
async function setDriveAuthHeaderRule(accessToken) {
	const RULE_ID = 1001;

	await chrome.declarativeNetRequest.updateSessionRules({
		removeRuleIds: [RULE_ID],
		addRules: [
			{
				id: RULE_ID,
				priority: 1,
				action: {
					type: "modifyHeaders",
					requestHeaders: [
						{
							header: "Authorization",
							operation: "set",
							value: `Bearer ${accessToken}`,
						},
					],
				},
				condition: {
					// Verify this pattern matches your drive file URLs
					// "||" = domain anchor. "*" = wildcard.
					urlFilter: "||www.googleapis.com/drive/v3/files/*",
					// We include 'media', 'xmlhttprequest', and 'other' to cover <video> and fetch
					resourceTypes: ["media", "xmlhttprequest", "other"],
				},
			},
		],
	});
	console.log("Updated session rule for Drive auth header.");
}

/**
 * Returns a (cached) OAuth 2.0 access token or launches interactive flow.
 * @param {boolean} interactive - Whether to prompt the user (default: true)
 */
export async function getAccessToken(interactive = true) {
	const { accessToken, tokenExpiry } = await chromeStorageGet([
		"accessToken",
		"tokenExpiry",
	]);

	// Check if token exists and is not expired (buffer of 60s)
	if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
		// Refresh the rule just in case (e.g. browser restart preserved storage but cleared rules)
		await setDriveAuthHeaderRule(accessToken);
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

	// Install the session rule with the fresh token
	await setDriveAuthHeaderRule(token);

	return token;
}
