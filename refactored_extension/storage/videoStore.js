// storage/videoStore.js
export function saveVideoIds(videoData) {
  const map = Object.fromEntries(videoData.map(({ title, id }) => [title, id]));
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(map, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });
}

export const getVideoIds = () =>
  new Promise((res, rej) =>
    chrome.storage.local.get(null, (items) => {
      if (chrome.runtime.lastError) return rej(chrome.runtime.lastError);
      res(items);
    })
  );

export const clearVideoIds = () =>
  new Promise((res, rej) =>
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) return rej(chrome.runtime.lastError);
      res();
    })
  );
