// youtubeApi.js

import { getAccessToken, chromeStorageRemove } from "./oauth.js";

/**
 * Resumable upload: fetch the video bytes from Drive, then upload them to YouTube.
 * If token is invalid, we throw an Error with .status = 401.
 */
export async function uploadToYouTube(driveFileId, fileName, accessToken) {
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

/**
 * Upload to YouTube, but if we see a 401, remove the token & reauth once.
 */
export async function uploadToYouTubeWithAutoReauth(driveFileId, fileName, token) {
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
