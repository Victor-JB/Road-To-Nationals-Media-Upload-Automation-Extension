

/**
 * Retrieves stored video IDs from chrome.storage.local.
 */
async function getStoredVideoIds() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(null, (items) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log("Retrieved video IDs from storage:", items);
          resolve(items);
        }
      });
    });
  }