// popup.js
import {
  getAccessToken
} from "./oauth.js";

import {
  listFoldersInDriveWithAutoReauth,
  listVideosInFolderWithAutoReauth
} from "./driveApi.js";

import {
  uploadToYouTubeWithAutoReauth
} from "./youtubeApi.js";

// We'll store the fetched folders in this array for searching
let allFolders = [];

document.addEventListener("DOMContentLoaded", () => {
  const refreshFoldersBtn = document.getElementById("refreshFolders");
  const folderSearchInput = document.getElementById("folderSearch");

  refreshFoldersBtn.addEventListener("click", async () => {
    // 1) Get a token
    const token = await getAccessToken();
    if (!token) {
      console.error("Failed to retrieve token!");
      return;
    }

    // 2) Auto-reauth if 401
    try {
      allFolders = await listFoldersInDriveWithAutoReauth(token);
      renderFolderList(allFolders, token);
    } catch (err) {
      console.error("Error listing folders:", err);
    }
  });

  // Filter the folder list as user types
  folderSearchInput.addEventListener("input", () => {
    const searchValue = folderSearchInput.value.toLowerCase();
    const filtered = allFolders.filter((folder) =>
      folder.name.toLowerCase().includes(searchValue)
    );
    // Re-render with just the filtered array
    renderFolderList(filtered, null);
  });
});

/**
 * Renders the folder list. "Show Videos" calls listVideosInFolderWithAutoReauth.
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
    showBtn.addEventListener("click", async () => {
      // If token is null, re-fetch
      let finalToken = token;
      if (!finalToken) {
        finalToken = await getAccessToken();
        if (!finalToken) return;
      }

      try {
        const videos = await listVideosInFolderWithAutoReauth(finalToken, folder.id);
        renderVideoList(videos, finalToken);
      } catch (error) {
        console.error("Error listing videos:", error);
      }
    });

    li.appendChild(showBtn);
    folderListElem.appendChild(li);
  });
}

/**
 * Renders a list of videos with "Upload to YouTube" buttons.
 */
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
      try {
        await uploadToYouTubeWithAutoReauth(file.id, file.name, accessToken);
      } catch (err) {
        console.error("Upload failed:", err);
        alert("Error uploading to YouTube. Check console for details.");
      }
    });

    li.appendChild(uploadBtn);
    videoListElem.appendChild(li);
  });
}
