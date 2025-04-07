// oauth.js

// Minimal wrappers for chrome.storage
export function chromeStorageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (data) => resolve(data));
  });
}

export function chromeStorageRemove(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => resolve());
  });
}

/**
 * Checks chrome.storage.local for an existing token. If none, calls launchOAuthFlow.
 */
export async function getAccessToken() {
  const data = await chromeStorageGet(["accessToken"]);
  if (data.accessToken) {
    return data.accessToken;
  }
  return await launchOAuthFlow();
}

/**
 * Launches the OAuth flow using chrome.identity.launchWebAuthFlow,
 * saves the token in storage, and returns it.
 */
export function launchOAuthFlow() {
  return new Promise((resolve) => {
    const IS_DEV = !chrome.runtime.getManifest().update_url; // true if loaded unpacked

    const CLIENT_ID = IS_DEV
      ? "1074281984090-n75o8b77ldedh7cmgstd3s7m7envvhg1.apps.googleusercontent.com"
      : "1074281984090-u48kuhvpr07has1i5s0tvru2qi790f2p.apps.googleusercontent.com";

    const REDIRECT_URI = chrome.identity.getRedirectURL();

    const SCOPES = [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/youtube.upload"
    ].join(" ");

    const authUrl =
      "https://accounts.google.com/o/oauth2/auth" +
      "?client_id=" + encodeURIComponent(CLIENT_ID) +
      "&response_type=token" +
      "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) +
      "&scope=" + encodeURIComponent(SCOPES);

    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectUrl) => {
      if (chrome.runtime.lastError) {
        console.error("OAuth failed:", chrome.runtime.lastError);
        resolve(null);
        return;
      }
      if (redirectUrl) {
        const token = new URL(redirectUrl).hash.split("&")[0].split("=")[1];
        chrome.storage.local.set({ accessToken: token }, () => {
          resolve(token);
        });
      } else {
        resolve(null);
      }
    });
  });
}
