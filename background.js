chrome.action.onClicked.addListener(() => {
  chrome.identity.launchWebAuthFlow(
    {
      url: "https://accounts.google.com/o/oauth2/auth?client_id=YOUR_CLIENT_ID&response_type=token&redirect_uri=https://YOUR_EXTENSION_ID.chromiumapp.org&scope=https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/youtube.upload",
      interactive: true
    },
    (redirectUrl) => {
      if (chrome.runtime.lastError) {
        console.error("OAuth failed:", chrome.runtime.lastError);
        return;
      }
      const token = new URL(redirectUrl).hash.split("&")[0].split("=")[1];
      chrome.storage.local.set({ accessToken: token });
    }
  );
});
