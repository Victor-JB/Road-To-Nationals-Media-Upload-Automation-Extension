fetch(chrome.runtime.getURL("config.json"))
  .then(response => response.json())
  .then(config => {
    const CLIENT_ID = config.client_id;

    chrome.action.onClicked.addListener(() => {
      console.log(`${CLIENT_ID}`)
      chrome.identity.launchWebAuthFlow(
        {
          url: `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&response_type=token&redirect_uri=https://${chrome.runtime.id}.chromiumapp.org&scope=https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/youtube.upload`,
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
  })
  .catch(error => console.error("Failed to load config:", error));
