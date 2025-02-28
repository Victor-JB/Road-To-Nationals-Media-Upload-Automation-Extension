// popup.js

let allFolders = []; // We'll store the fetched folders in this array

document.addEventListener("DOMContentLoaded", () => {
  const refreshFoldersBtn = document.getElementById("refreshFolders");
  const folderSearchInput = document.getElementById("folderSearch");

  refreshFoldersBtn.addEventListener("click", async () => {
    const token = await getAccessToken();
    if (!token) {
      console.error("Failed to retrieve token!");
      return;
    }

    try {
      // Fetch and store all folders in memory
      allFolders = await listFoldersInDrive(token);
      // Render them unfiltered
      renderFolderList(allFolders, token);
    } catch (err) {
      console.error("Error listing folders:", err);
    }
  });

  // As the user types, filter the full folder list
  folderSearchInput.addEventListener("input", () => {
    // Simple case-insensitive filter
    const searchValue = folderSearchInput.value.toLowerCase();
    // Filter the global allFolders array
    const filtered = allFolders.filter((folder) =>
      folder.name.toLowerCase().includes(searchValue)
    );

    // Re-render with just the filtered array
    // We don't need another token fetch here because
    // we're simply re-displaying the same items.
    renderFolderList(filtered, null);
  });
});

/*
  -------------
   OAUTH LOGIC
  -------------
   (Your existing code to fetch or refresh the token, etc.)
*/

async function getAccessToken() {
  // Pseudocode from your existing approach
  const data = await chromeStorageGet(["accessToken"]);
  if (data.accessToken) {
    return data.accessToken;
  }
  return await launchOAuthFlow();
}

function launchOAuthFlow() {
  return new Promise((resolve) => {
    const REDIRECT_URI = chrome.identity.getRedirectURL();
    const CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com";
    const SCOPES = [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/youtube.upload",
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

function chromeStorageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (data) => resolve(data));
  });
}

/*
  -------------
   DRIVE API: LIST FOLDERS
  -------------
*/

async function listFoldersInDrive(accessToken) {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false");
  const fields = encodeURIComponent("files(id,name)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to list folders: ${response.status}`);
  }

  const data = await response.json();
  return data.files || [];
}

/*
  -------------
   RENDER FOLDERS
  -------------
*/
function renderFolderList(folders, token) {
  const folderListElem = document.getElementById("folderList");
  folderListElem.innerHTML = "";

  if (!folders.length) {
    folderListElem.textContent = "No folders found.";
    return;
  }

  folders.forEach((folder) => {
    const li = document.createElement("li");
    li.className = "folderItem";

    // Folder icon
    const icon = document.createElement("img");
    icon.src = "icons/folder.png"; // your folder icon path
    li.appendChild(icon);

    // Folder name
    const nameSpan = document.createElement("span");
    nameSpan.textContent = folder.name;
    li.appendChild(nameSpan);

    // "Show Videos" button
    const showBtn = document.createElement("button");
    showBtn.textContent = "Show Videos";
    // If we do need a token for the next step, use the one we fetched.
    // If token is null, we can re-fetch inside the click if needed.
    showBtn.addEventListener("click", async () => {
      const accessToken = token || (await getAccessToken());
      if (!accessToken) return;
      const videos = await listVideosInFolder(accessToken, folder.id);
      renderVideoList(videos, accessToken);
    });
    li.appendChild(showBtn);

    folderListElem.appendChild(li);
  });
}

/*
  -------------
   LIST & RENDER VIDEOS
  -------------
   (Your code to fetch videos from folder and display them)
*/
async function listVideosInFolder(accessToken, folderId) {
  const query = encodeURIComponent(
    `'${folderId}' in parents and mimeType contains 'video/' and trashed=false`
  );
  const fields = encodeURIComponent("files(id,name,mimeType)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to list videos in folder: ${response.status}`);
  }
  const data = await response.json();
  return data.files || [];
}

function renderVideoList(videos, accessToken) {
  const videoListElem = document.getElementById("videoList");
  videoListElem.innerHTML = "";

  if (!videos.length) {
    videoListElem.textContent = "No video files found in this folder.";
    return;
  }

  videos.forEach((file) => {
    const li = document.createElement("li");
    li.textContent = `${file.name} (${file.mimeType}) `;

    // "Upload" button
    const uploadBtn = document.createElement("button");
    uploadBtn.textContent = "Upload to YouTube";
    uploadBtn.addEventListener("click", async () => {
      // We use the existing YouTube upload code, with auto-reauth if you like
      try {
        await uploadToYouTubeWithAutoReauth(file.id, file.name, accessToken);
      } catch (err) {
        console.error("Upload failed:", err);
        alert("Error uploading to YouTube. Check console for details.");
      }
    });

    li.appendChild(uploadBtn);
    videoList.appendChild(li);
  });
}

/* ------------------------------------------------------------------
   --------------- YouTube Upload Logic & Auto-Reauth ---------------
   ----------------------------------------------------------------- */

/**
 * Upload to YouTube, but if we see a 401, remove the token & reauth once.
 */
async function uploadToYouTubeWithAutoReauth(driveFileId, fileName, token) {
  try {
    await uploadToYouTube(driveFileId, fileName, token);
  } catch (error) {
    if (error.status === 401) {
      console.warn("Token invalid during upload. Re-authing...");
      await chromeStorageRemove(["accessToken"]);
      const newToken = await getAccessToken();
      if (!newToken) {
        throw new Error("Re-auth failed.");
      }
      // Try again with a fresh token
      await uploadToYouTube(driveFileId, fileName, newToken);
    } else {
      throw error;
    }
  }
}

/**
 * Resumable upload: fetch the video bytes from Drive, then upload them to YouTube.
 * If token is invalid, we throw an Error with .status = 401.
 */
async function uploadToYouTube(driveFileId, fileName, accessToken) {
  // Step 1: Initiate the upload session
  let response = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/*",
      },
      body: JSON.stringify({
        snippet: {
          title: fileName,
          description: "Uploaded via Google Drive to YouTube",
          categoryId: "22", // People & Blogs
        },
        status: {
          privacyStatus: "public", // or "unlisted"/"private"
        },
      }),
    }
  );

  if (!response.ok) {
    const err = new Error("Failed to start YouTube upload");
    err.status = response.status;
    throw err;
  }

  const uploadUrl = response.headers.get("Location");

  // Step 2: Download the video blob from Drive
  response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    const err = new Error("Failed to fetch file from Drive");
    err.status = response.status;
    throw err;
  }

  const fileBlob = await response.blob();

  // Step 3: PUT the blob to the YouTube resumable session
  response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Length": fileBlob.size },
    body: fileBlob,
  });

  if (!response.ok) {
    const err = new Error("YouTube upload failed");
    err.status = response.status;
    throw err;
  }

  const youtubeData = await response.json();
  console.log("Uploaded to YouTube:", youtubeData);
  alert(`Successfully uploaded "${fileName}" to YouTube!`);
}

/* ---------- OAuth + Chrome Storage Helper Functions ---------- */

/**
 * Minimal wrapper that returns a Promise for chrome.storage.local.get.
 */
function chromeStorageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (data) => resolve(data));
  });
}

/**
 * Minimal wrapper that returns a Promise for chrome.storage.local.remove.
 */
function chromeStorageRemove(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => resolve());
  });
}

/**
 * Launches the OAuth flow using chrome.identity.launchWebAuthFlow, returns token or null on error.
 */
function launchOAuthFlow() {
  return new Promise((resolve) => {
    const REDIRECT_URI = chrome.identity.getRedirectURL();
    const CLIENT_ID = "1074281984090-n75o8b77ldedh7cmgstd3s7m7envvhg1.apps.googleusercontent.com";
    const SCOPES = [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/youtube.upload",
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
