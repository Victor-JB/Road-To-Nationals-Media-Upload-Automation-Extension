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
  saveVideoIdsToStorage,
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

      const token = await getAccessToken();
      if (!token) {
        alert("Failed to retrieve token for mass upload.");
        return;
      }

      showUploadStatus("Uploading all videos to playlist...", "progress");

      // You can update this to reflect real-time progress later:
      for (let i = 0; i < currentVideos.length; i++) {
        const percent = Math.round((i / currentVideos.length) * 100);
        updateProgress(percent);
      }

      await massUploadAllVideosToPlaylist(currentVideos, playlistName, token);

      // After mass upload, show the collapsible box with all video data
      showUploadStatus(
        "All videos uploaded and added to the playlist!",
        "success",
        currentVideos.map((file, index) => ({
          title: file.name,
          id: uploadedVideos[index].id,
        }))
      );
      setTimeout(hideUploadStatus, 4000);
    } catch (err) {
      console.error("Error in mass upload:", err);
      showUploadStatus("Mass upload failed. Check console for details.", "error");
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
        showUploadStatus(`Uploading ${file.name}...`, "progress");
    
        const uploadedVideo = await uploadToYouTubeWithAutoReauth(file.id, file.name, accessToken);
    
        // Save the uploaded video ID to storage
        const videoData = [{ title: file.name, id: uploadedVideo.id }];
        await saveVideoIdsToStorage(videoData);
    
        showUploadStatus(`Successfully uploaded ${file.name}!`, "success", videoData);
    
        setTimeout(hideUploadStatus, 3000);
      } catch (err) {
        console.error("Upload failed:", err);
        showUploadStatus(`Failed to upload ${file.name}`, "error");
      }
    });

    // contentScript.js
    chrome.storage.local.get(null, (items) => {
      for (const [title, videoId] of Object.entries(items)) {
        console.log(`Autofilling video: ${title} with ID: ${videoId}`);
        // Add logic to find the correct field on the page and autofill it
        //const field = document.querySelector(`[data-title="${title}"]`);
        //if (field) {
        //  field.value = videoId;
       // }
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

/*
  * Functions for showing upload status and progress.
  * These are used in the uploadToYouTubeWithAutoReauth function.
*/
function showUploadStatus(message, mode = "neutral", videoData = []) {
  const container = document.getElementById("uploadStatus");
  const msg = document.getElementById("uploadMessage");
  const progress = document.getElementById("uploadProgress");
  const collapsibleBox = document.getElementById("collapsibleBox");
  const copyButton = document.getElementById("copyButton");

  msg.textContent = message;
  container.style.display = "block";
  progress.style.display = mode === "progress" ? "block" : "none";

  container.classList.remove("success", "error");
  if (mode === "success") container.classList.add("success");
  else if (mode === "error") container.classList.add("error");

  // Populate the collapsible box with video data
  if (videoData.length > 0) {
    collapsibleBox.innerHTML = videoData
      .map(({ title, id }) => `<div>${title}: ${id}</div>`)
      .join("");
    collapsibleBox.style.display = "block";
    copyButton.style.display = "block";

    // Add copy functionality
    copyButton.onclick = () => {
      const textToCopy = videoData.map(({ title, id }) => `${title}: ${id}`).join("\n");
      navigator.clipboard.writeText(textToCopy).then(() => {
        alert("Copied to clipboard!");
      });
    };
  } else {
    collapsibleBox.style.display = "none";
    copyButton.style.display = "none";
  }
}

/**
 * Hides the upload status UI.
 */
function hideUploadStatus() {
  const container = document.getElementById("uploadStatus");
  const progress = document.getElementById("uploadProgress");
  const collapsibleBox = document.getElementById("collapsibleBox");
  const copyButton = document.getElementById("copyButton");

  // Hide all elements related to the upload status
  container.style.display = "none";
  progress.style.display = "none";
  collapsibleBox.style.display = "none";
  copyButton.style.display = "none";
}