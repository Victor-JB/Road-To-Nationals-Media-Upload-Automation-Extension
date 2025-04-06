// popup.js
import { getAccessToken } from "./oauth.js";
import {
  listFoldersInDriveWithAutoReauth,
  listVideosInFolderWithAutoReauth,
} from "./driveApi.js";

// NEW: import the mass upload function we'll add in youtubeApi.js
import {
  uploadToYouTubeWithAutoReauth,
  massUploadAllVideosToPlaylist,
} from "./youtubeApi.js";

// We'll store the fetched folders in this array for searching
let allFolders = [];

// We'll store the currently displayed videos, so we can mass-upload them
let currentVideos = [];

// This is used for the drag-to-resize logic at bottom of file
let isDragging = false;

const divider = document.getElementById("divider");
const foldersSection = document.getElementById("foldersSection");
const videosSection = document.getElementById("videosSection");

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
    renderFolderList(filtered, null);
  });

  // === NEW: "Mass Upload" button event ===
  const uploadAllBtn = document.getElementById("uploadAllButton");
  uploadAllBtn.addEventListener("click", async () => {
    try {
      // Grab the user-entered playlist name
      const playlistName = document
        .getElementById("playlistNameInput")
        .value.trim();

      if (!playlistName) {
        alert("Please enter a playlist name first.");
        return;
      }
      if (!currentVideos.length) {
        alert("No videos to upload in this folder!");
        return;
      }

      // Get or refresh token
      const token = await getAccessToken();
      if (!token) {
        alert("Failed to retrieve token for mass upload.");
        return;
      }

      // Call our new mass-upload function
      await massUploadAllVideosToPlaylist(currentVideos, playlistName, token);
      alert("All videos uploaded and added to the playlist!");
    } catch (err) {
      console.error("Error in mass upload:", err);
      alert("Mass upload failed. Check console for details.");
    }
  });

  // Set initial heights for resizing logic
  const resizablePanel = document.getElementById("resizablePanel");

  const totalHeight = resizablePanel.clientHeight;
  const defaultRatio = 0.5; // 50/50 split to start

  foldersSection.style.flexBasis = `${totalHeight * defaultRatio}px`;
  videosSection.style.flexBasis = `${totalHeight * (1 - defaultRatio) - 6}px`; // minus divider height

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
    icon.src = "../icons/folder.png";
    li.appendChild(icon);

    // Folder name
    const nameSpan = document.createElement("span");
    nameSpan.textContent = folder.name;
    li.appendChild(nameSpan);

    // "Show Videos" button
    const showBtn = document.createElement("button");
    showBtn.textContent = "Show Videos";
    showBtn.addEventListener("click", async () => {
      let finalToken = token;
      if (!finalToken) {
        finalToken = await getAccessToken();
        if (!finalToken) return;
      }
      try {
        const videos = await listVideosInFolderWithAutoReauth(finalToken, folder.id);
        renderVideoList(videos, finalToken, folder.name);
      } catch (error) {
        console.error("Error listing videos:", error);
      }
    });

    li.appendChild(showBtn);
    folderListElem.appendChild(li);
  });
}

/**
 * Renders a list of videos with "Upload to YouTube" buttons
 * and also updates currentVideos so we can mass-upload them.
 */
function renderVideoList(videos, accessToken, folderName) {
  const videoListElem = document.getElementById("videoList");
  videoListElem.innerHTML = "";

  // NEW: store globally so "mass upload" can see them
  currentVideos = videos;

  if (!videos.length) {
    videoListElem.textContent = `No video files found in ${folderName}.`;
    return;
  }

  videos.forEach((file) => {
    const li = document.createElement("li");
    li.textContent = `${file.name} (${file.mimeType}) `;

    // Existing single upload
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

/*
Logic for resizing the folder and video sections
This is a simple drag-to-resize implementation.
*/

divider.addEventListener("mousedown", (e) => {
  e.preventDefault();
  isDragging = true;
});

document.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const containerTop = document.getElementById("resizablePanel").getBoundingClientRect().top;
  const offset = e.clientY - containerTop;

  const minHeight = 80;
  const containerHeight = document.getElementById("resizablePanel").offsetHeight;

  const foldersHeight = Math.max(minHeight, offset);
  const videosHeight = Math.max(minHeight, containerHeight - foldersHeight - 6); // minus divider height

  foldersSection.style.flexBasis = `${foldersHeight}px`;
  videosSection.style.flexBasis = `${videosHeight}px`;
});

document.addEventListener("mouseup", () => {
  isDragging = false;
});
