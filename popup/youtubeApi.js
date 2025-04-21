// youtubeApi.js

import { getAccessToken, chromeStorageRemove } from "./oauth.js";

/**
 * Saves uploaded video IDs to chrome.storage.local.
 * The key is the video title, and the value is the video ID.
 */
export async function saveVideoIdsToStorage(videoData) {
  const storageData = {};
  videoData.forEach(({ title, id }) => {
    storageData[title] = id;
  });

  return new Promise((resolve, reject) => {
    chrome.storage.local.set(storageData, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        console.log("Video IDs saved to storage:", storageData);
        resolve();
      }
    });
  });
}

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

  // Return the final data so we can get the uploaded video's ID
  return youtubeData;
}

/**
 * Upload to YouTube, but if we see a 401, remove the token & reauth once.
 * IMPORTANT: we now return the final youtubeData so we know the new videoId
 */
export async function uploadToYouTubeWithAutoReauth(driveFileId, fileName, token) {
  try {
    return await uploadToYouTube(driveFileId, fileName, token);
  } catch (error) {
    if (error.status === 401) {
      console.warn("Token invalid during upload. Re-authing...");
      await chromeStorageRemove(["accessToken"]);
      const newToken = await getAccessToken();
      if (!newToken) {
        throw new Error("Re-auth failed.");
      }
      // Try again with a fresh token
      return await uploadToYouTube(driveFileId, fileName, newToken);
    } else {
      throw error;
    }
  }
}

/* ------------------------------------------------------------------
   --------------------- NEW PLAYLIST LOGIC -------------------------
   ----------------------------------------------------------------- */
/**
 * Creates a new YouTube playlist with the given name.
 * Requires a token with playlist write permission (often "youtube" or "youtube.force-ssl" scope).
 */
async function createPlaylist(accessToken, playlistName) {
  const playlistMeta = {
    snippet: {
      title: playlistName,
      description: "Created via extension mass upload",
    },
    status: {
      privacyStatus: "public", // or "unlisted"/"private"
    },
  };

  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/playlists?part=snippet%2Cstatus",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(playlistMeta),
    }
  );

  if (!response.ok) {
    const err = new Error("Failed to create playlist");
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  console.log("Created playlist:", data);
  return data; // data.id is the new playlist ID
}

/**
 * Adds the given YouTube videoId to the specified playlistId.
 */
async function addVideoToPlaylist(accessToken, playlistId, videoId) {
  const body = {
    snippet: {
      playlistId: playlistId,
      resourceId: {
        kind: "youtube#video",
        videoId: videoId,
      },
    },
  };

  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const err = new Error("Failed to add video to playlist");
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  console.log(`Added video ${videoId} to playlist ${playlistId}:`, data);
  return data;
}

/**
 * Mass-uploads all Drive videos to YouTube and puts them in a NEW playlist.
 * - 1) Create a brand new playlist
 * - 2) For each video, upload to YouTube
 * - 3) Insert the uploaded videoId into that playlist
 */
export async function massUploadAllVideosToPlaylist(videos, playlistName, accessToken) {
  // 1) Create new playlist
  const playlist = await createPlaylist(accessToken, playlistName);
  const playlistId = playlist.id;

  const uploadedVideos = [];

  // 2) Loop each video => upload => add to playlist
  for (const file of videos) {
    console.log(`Uploading "${file.name}"...`);
    const uploadedVideo = await uploadToYouTubeWithAutoReauth(file.id, file.name, accessToken);

    // Save the uploaded video's title and ID
    uploadedVideos.push({ title: file.name, id: uploadedVideo.id });

    console.log(`Adding uploaded video ${uploadedVideo.id} to playlist ${playlistId}...`);
    await addVideoToPlaylist(accessToken, playlistId, uploadedVideo.id);
  }

  // Save all uploaded video IDs to storage
  await saveVideoIdsToStorage(uploadedVideos);
}
