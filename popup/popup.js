// popup.js
import { getAccessToken } from "../background/oauth.js";
import {
  listFoldersInDriveWithAutoReauth,
  listVideosInFolderWithAutoReauth,
} from "../services/driveApi.js";
import {
  uploadToYouTubeWithAutoReauth,
  massUploadAllVideosToPlaylist,
  saveVideoIdsToStorage,
} from "../services/youtubeApi.js";
import { showUploadStatus } from "../utils/utils.js";

// We'll store the fetched folders in this array for searching
let allFolders = [];

// We'll store the currently displayed videos, so we can mass-upload them
let currentVideos = [];

// This is used for the drag-to-resize logic at bottom of file
let isDragging = false;

const divider = document.getElementById("divider");
const foldersSection = document.getElementById("foldersSection");
const videosSection = document.getElementById("videosSection");

// -------------------------------------------------------------------------- //
document.addEventListener("DOMContentLoaded", () => {
  
  const refreshFoldersBtn = document.getElementById("refreshFolders");
  const folderSearchInput = document.getElementById("folderSearch");
  const uploadAllBtn = document.getElementById("uploadAllButton");

  // == refresh folders button == //
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

  // == search folders event listener == //
  folderSearchInput.addEventListener("input", () => {
    const searchValue = folderSearchInput.value.toLowerCase();
    const filtered = allFolders.filter((folder) =>
      folder.name.toLowerCase().includes(searchValue)
    );
    renderFolderList(filtered, null);
  });


  // == upload all videos button == //
  uploadAllBtn.addEventListener("click", async () => {
    try {
      const playlistName = document.getElementById("playlistNameInput").value.trim();
      const videoItems = document.querySelectorAll(".videoItem");
      const videoScoreMap = [];

      if (!playlistName) {
        alert("Please enter a playlist name first.");
        return;
      }
      if (!currentVideos.length) {
        alert("No videos to upload in this folder!");
        return;
      }

      videoItems.forEach((videoItem, index) => {
        const scoreInput = videoItem.querySelector(".scoreInput");
        const score = scoreInput ? scoreInput.value.trim() : "";

        const file = currentVideos[index]; // Assuming the order is maintained
        if (file && file.id) {
          videoScoreMap[index] = [file, score];
        }
      });
  
      const token = await getAccessToken();
      if (!token) {
        alert("Failed to retrieve token for mass upload.");
        return;
      }
  
      // Show initial status
      showUploadStatus("Uploading all videos to playlist...", "progress", [], "Step 1: Initializing...");
  
      // Call the mass upload function with a step update callback
      const uploadedVideos = await massUploadAllVideosToPlaylist(
        videoScoreMap,
        playlistName,
        token,
        (stepMessage) => {
          showUploadStatus("Uploading all videos to playlist...", "progress", [], stepMessage);
        }
      );
  
      // Show success message with all uploaded video data
      showUploadStatus(
        "All videos uploaded and added to the playlist!",
        "success",
        uploadedVideos
      );
      
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

// -------------------------------------------------------------------------- //
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

// -------------------------------------------------------------------------- //
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
    li.className = "videoItem";
    li.textContent = `${file.name} (${file.mimeType}) `;

    const scoreInput = document.createElement("input");
    scoreInput.type = "text";
    scoreInput.placeholder = "Score (optional)";
    scoreInput.className = "scoreInput";
    li.appendChild(scoreInput);

    // Existing single upload
    const uploadBtn = document.createElement("button");
    uploadBtn.textContent = "Upload to YouTube";
    
    uploadBtn.addEventListener("click", async () => {
      try {
        const score = scoreInput.value.trim();
        showUploadStatus(`Uploading ${file.name}...`, "progress", [], "Step 1: Initiating upload session");
        
        const uploadedVideo = await uploadToYouTubeWithAutoReauth(file.id, file.name, score, accessToken);
    
        showUploadStatus(`Uploading ${file.name}...`, "progress", [], "Step 2: Saving video ID to storage");
    
        // Save the uploaded video ID to storage
        const videoData = [{ title: file.name, id: uploadedVideo.id }];
        await saveVideoIdsToStorage(videoData);
        
        showUploadStatus(`Successfully uploaded ${file.name}!`, "success", videoData);
    
      } catch (err) {
        console.error("Upload failed:", err);
        showUploadStatus(`Failed to upload ${file.name}`, "error");
      }
    });
    li.appendChild(uploadBtn);
    videoListElem.appendChild(li);
  });
}

// -------------------------------------------------------------------------- //
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
