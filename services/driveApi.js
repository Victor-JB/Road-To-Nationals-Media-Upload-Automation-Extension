// driveApi.js

import { getAccessToken, chromeStorageRemove } from "../background/oauth.js";

/**
 * Basic function to list all folders in Drive. May throw an error with .status on failure.
 */
export async function listFoldersInDrive(accessToken) {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false");
  const fields = encodeURIComponent("files(id,name)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const err = new Error(`Failed to list folders: ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Lists only video files in a given folder. May throw an error with .status on failure.
 */
export async function listVideosInFolder(accessToken, folderId) {
  const query = encodeURIComponent(
    `'${folderId}' in parents and mimeType contains 'video/' and trashed=false`
  );
  const fields = encodeURIComponent("files(id,name,mimeType)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const err = new Error(`Failed to list videos in folder: ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Wrapper that auto‑reauths if we get a 401 from listFoldersInDrive.
 */
export async function listFoldersInDriveWithAutoReauth(token) {
  try {
    return await listFoldersInDrive(token);
  } catch (error) {
    if (error.status === 401) {
      console.warn("Token invalid while listing folders. Re-authing...");
      await chromeStorageRemove(["accessToken"]);
      const newToken = await getAccessToken();
      if (!newToken) {
        throw new Error("Re-auth failed for listing folders.");
      }
      return await listFoldersInDrive(newToken);
    }
    throw error;
  }
}

/**
 * Wrapper that auto‑reauths if we get a 401 from listVideosInFolder.
 */
export async function listVideosInFolderWithAutoReauth(token, folderId) {
  try {
    return await listVideosInFolder(token, folderId);
  } catch (error) {
    if (error.status === 401) {
      console.warn("Token invalid while listing videos. Re-authing...");
      await chromeStorageRemove(["accessToken"]);
      const newToken = await getAccessToken();
      if (!newToken) {
        throw new Error("Re-auth failed for listing videos.");
      }
      return await listVideosInFolder(newToken, folderId);
    }
    throw error;
  }
}
