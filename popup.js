// popup.js

document.addEventListener("DOMContentLoaded", () => {
  const selectButton = document.getElementById("selectFile");

  selectButton.addEventListener("click", async () => {
    // 1) Get a valid token (or re-auth if none is stored)
    let token = await getAccessToken();
    if (!token) {
      console.error("Failed to retrieve token!");
      return;
    }

    // 2) Attempt to list Drive videos
    let videos = await listVideosInDriveWithAutoReauth(token);

    if (videos) {
      // 3) Render them in the popup with an "Upload to YouTube" button
      renderVideoList(videos, token);
    }
  });
});

/**
 * Retrieves a stored token from chrome.storage.local. If none is found,
 * launches the OAuth flow to get a new token. Returns the token or null on failure.
 */
async function getAccessToken() {
  const data = await chromeStorageGet(["accessToken"]);
  if (data.accessToken) {
    return data.accessToken;
  }

  // Otherwise, do OAuth
  return await launchOAuthFlow();
}

/**
 * Calls listVideosInDrive. If we get a 401 (invalid/expired token),
 * removes the token, re-auths, and tries again once.
 */
async function listVideosInDriveWithAutoReauth(token) {
  try {
    return await listVideosInDrive(token);
  } catch (error) {
    // Check if it's a 401
    if (error.status === 401) {
      console.warn("Token invalid or expired. Attempting re-auth...");
      // Remove the stored token
      await chromeStorageRemove(["accessToken"]);
      // Re-auth
      const newToken = await getAccessToken();
      if (!newToken) {
        console.error("Re-auth failed.");
        return null;
      }
      // Try listing again
      return await listVideosInDrive(newToken);
    } else {
      // Some other error
      console.error("Failed to list files:", error);
      return null;
    }
  }
}

/**
 * Makes an authenticated request to Drive API to list video files.
 * Throws an error with .status = 401 if the token is invalid.
 */
async function listVideosInDrive(accessToken) {
  const query = encodeURIComponent("mimeType contains 'video/' and trashed = false");
  const fields = encodeURIComponent("files(id,name,mimeType)");

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!response.ok) {
    const err = new Error("Failed to list Drive files");
    err.status = response.status; // so we can detect 401
    throw err;
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Renders a list of video files into the popup UI with an "Upload" button for each.
 */
function renderVideoList(videos, accessToken) {
  const ul = document.getElementById("videoList");
  ul.innerHTML = ""; // Clear any old entries

  if (!videos.length) {
    ul.textContent = "No video files found in Drive.";
    return;
  }

  videos.forEach((file) => {
    const li = document.createElement("li");
    li.textContent = `${file.name} (${file.mimeType}) `;

    const uploadBtn = document.createElement("button");
    uploadBtn.textContent = "Upload to YouTube";
    uploadBtn.addEventListener("click", async () => {
      // Attempt upload
      try {
        await uploadToYouTubeWithAutoReauth(file.id, file.name, accessToken);
      } catch (err) {
        alert("Upload failed. Check console for details.");
        console.error(err);
      }
    });

    li.appendChild(uploadBtn);
    ul.appendChild(li);
  });
}

/**
 * Upload to YouTube. If we see a 401, auto-re-auth once.
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
        console.error("Re-auth failed.");
        throw error;
      }
      await uploadToYouTube(driveFileId, fileName, newToken);
    } else {
      throw error; // some other error
    }
  }
}

/**
 * Resumable upload: fetch the video bytes from Drive, then upload them to YouTube.
 * Throws an error with .status=401 if the token is invalid.
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
          privacyStatus: "public",
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

  // Optionally show a success message
  alert(`Successfully uploaded "${fileName}" to YouTube!`);
}

/* ---------- Helpers for Chrome Storage / OAuth flow ---------- */

/**
 * A small wrapper that returns a Promise for chrome.storage.local.get.
 */
function chromeStorageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result));
  });
}

/**
 * A small wrapper that returns a Promise for chrome.storage.local.remove.
 */
function chromeStorageRemove(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => resolve());
  });
}

/**
 * Actually performs the OAuth flow and returns the new token, or null on error.
 */
function launchOAuthFlow() {
  return new Promise((resolve) => {
    const REDIRECT_URI = chrome.identity.getRedirectURL();
    const CLIENT_ID = "";
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
        // Extract the token from URL fragment (#access_token=...)
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
