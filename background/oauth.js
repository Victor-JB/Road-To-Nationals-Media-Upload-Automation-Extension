// background/oauth.js
// Handles accessToken persistence and Chrome identity OAuth flow.

// -------------------------------------------------------------------------- //
export function chromeStorageGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (items) => {
      if (chrome.runtime.lastError) {
        console.error("chrome.storage.local.get error:", chrome.runtime.lastError);
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
 * Returns a (cached) OAuth 2.0 access token or launches interactive flow.
 */
export async function getAccessToken() {
  const { accessToken } = await chromeStorageGet(['accessToken']);
  if (accessToken) return accessToken;

  const CLIENT_ID =
    "1074281984090-u48kuhvpr07has1i5s0tvru2qi790f2p.apps.googleusercontent.com";
  const SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/youtube.force-ssl",
  ].join(" ");

  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl =
    "https://accounts.google.com/o/oauth2/auth" +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    "&response_type=token" +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(SCOPES)}`;

  const redirect = await new Promise((resolve) =>
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, resolve)
  );

  if (!redirect) throw new Error("User closed OAuth window or OAuth failed");

  // Extract #access_token=...
  const tokenMatch = redirect.match(/[#&]access_token=([^&]+)/);
  if (!tokenMatch) throw new Error("Could not parse OAuth response");
  const token = tokenMatch[1];

  await chromeStorageSet({ accessToken: token });
  return token;
}
