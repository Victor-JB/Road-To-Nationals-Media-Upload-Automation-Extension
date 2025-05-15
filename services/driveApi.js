// driveApi.js

import { getAccessToken, chromeStorageRemove } from "../background/oauth.js";

// -------------------------------------------------------------------------- //
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

// -------------------------------------------------------------------------- //
/**
 * Recursively gathers *all* video files inside `folderId`,
 * skipping sub-folders in the output.
 *
 * @param {string} accessToken – OAuth token with at least Drive.readonly scope
 * @param {string} folderId    – ID of the root folder the user clicked
 * @returns {Promise<Array<{id:string,name:string,mimeType:string,parent:string}>>}
 */
export async function listVideosInFolder(accessToken, folderId) {
  const allVideos = [];

  async function walkFolder(id) {
    let pageToken = null;

    do {
      const q      = encodeURIComponent(`'${id}' in parents and trashed = false`);
      const fields = encodeURIComponent("nextPageToken, files(id,name,mimeType,parents)");
      const base   = `https://www.googleapis.com/drive/v3/files`;
      const params = `?q=${q}&fields=${fields}&pageSize=1000` +
                     (pageToken ? `&pageToken=${pageToken}` : "");
      const url    = base + params;

      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) {
        throw new Error(`Drive list failed (${resp.status})`);
      }
      const data = await resp.json();
      pageToken  = data.nextPageToken || null;

      // process each entry
      for (const f of data.files || []) {
        if (f.mimeType === "application/vnd.google-apps.folder") {
          // recurse into sub-folder (and await it)
          await walkFolder(f.id);
        }
        else if (f.mimeType.startsWith("video/")) {
          allVideos.push({
            id:       f.id,
            name:     f.name,
            mimeType: f.mimeType,
            parent:   id
          });
        }
      }
    } while (pageToken);
  }

  await walkFolder(folderId);
  return allVideos;
}


// clean up the redundance here, make it so that any function can be modofuyed to be called with reauth
// -------------------------------------------------------------------------- //
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

// -------------------------------------------------------------------------- //
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
