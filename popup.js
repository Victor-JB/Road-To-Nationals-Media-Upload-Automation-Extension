// popup.js

document.addEventListener("DOMContentLoaded", () => {
  // Button that lets user select which folder to list videos from
  const selectFolderBtn = document.getElementById("selectFolder");

  // Step 1: On click, get token, list folders
  selectFolderBtn.addEventListener("click", async () => {
    const token = await getAccessToken();
    if (!token) {
      console.error("Failed to retrieve token!");
      return;
    }

    try {
      // List all folders in Drive
      const folders = await listFoldersInDrive(token);
      renderFolderList(folders, token);
    } catch (err) {
      console.error("Error listing folders:", err);
    }
  });
});

/**
 * Checks for an existing access token. If none is found, starts an OAuth flow.
 * Returns a Promise that resolves to the access token string or null on failure.
 */
async function getAccessToken() {
  // See if we have a token in chrome.storage.local
  const data = await chromeStorageGet(["accessToken"]);
  if (data.accessToken) {
    return data.accessToken;
  }
  // Otherwise, run OAuth
  return await launchOAuthFlow();
}

/**
 * Lists all folders in the user's Drive (not trashed).
 */
async function listFoldersInDrive(accessToken) {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false");
  const fields = encodeURIComponent("files(id,name)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const err = new Error("Failed to list folders");
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  // data.files => an array of objects { id, name }
  return data.files || [];
}

/**
 * Renders the Drive folders so the user can pick one. Clicking a folder's "Show Videos"
 * button calls listVideosInFolder and shows them in the popup.
 */
function renderFolderList(folders, token) {
  const folderList = document.getElementById("folderList");
  folderList.innerHTML = "";

  if (!folders.length) {
    folderList.textContent = "No folders found in Drive.";
    return;
  }

  folders.forEach((folder) => {
  
    const li = document.createElement("li");
    li.className = "folderItem";

    // Folder icon
    const icon = document.createElement("img");
    icon.src = "icons/folder.png"; // Replace with your folder icon path
    li.appendChild(icon);

    // Folder name
    const nameSpan = document.createElement("span");
    nameSpan.textContent = folder.name;
    li.appendChild(nameSpan);


    // "Show Videos" button to list the videos in this folder
    const selectBtn = document.createElement("button");
    selectBtn.textContent = "Show Videos";
    selectBtn.addEventListener("click", async () => {
      try {
        const videos = await listVideosInFolder(token, folder.id);
        renderVideoList(videos, token);
      } catch (error) {
        console.error("Error listing videos:", error);
      }
    });

    li.appendChild(selectBtn);
    folderList.appendChild(li);
  });
}

/**
 * Lists only video files in a given folder.
 */
async function listVideosInFolder(accessToken, folderId) {
  // 'folderId' in parents => only files in that folder
  // mimeType contains 'video/' => only video files
  const query = encodeURIComponent(
    `'${folderId}' in parents and mimeType contains 'video/' and trashed=false`
  );
  const fields = encodeURIComponent("files(id,name,mimeType)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const err = new Error("Failed to list videos in folder");
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Renders a list of video files into the popup UI with an "Upload" button for each.
 */
function renderVideoList(videos, accessToken) {
  const videoList = document.getElementById("videoList");
  videoList.innerHTML = ""; // Clear any old entries

  if (!videos.length) {
    videoList.textContent = "No video files found in this folder.";
    return;
  }

  videos.forEach((file) => {
    const li = document.createElement("li");
    li.textContent = `${file.name} (${file.mimeType}) `;

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
