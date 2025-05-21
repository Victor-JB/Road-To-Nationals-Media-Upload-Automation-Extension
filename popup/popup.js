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
  getStoredVideoIDs,
} from "../services/youtubeApi.js";
import { autofillOnSite } from "../services/autofill.js";
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
document.addEventListener("DOMContentLoaded", async () => {

  const refreshFoldersBtn = document.getElementById("refreshFolders");
  const folderSearchInput = document.getElementById("folderSearch");
  const uploadAllBtn = document.getElementById("uploadAllButton");
  const container = document.getElementById('persistedContainer');

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

  const videoData = await getStoredVideoIDs();
  if (videoData.length > 0) {
    console.log("popup.js: got videoData", videoData);

    // collapse/expand logic
    const header   = document.getElementById('persistedHeader');
    const body     = document.getElementById('persistedBody');
    const toggle   = document.getElementById('togglePersisted');
    const clearer  = document.getElementById('clearPersisted');
    const list  = document.getElementById('persistedList');
    const autofillButton = document.getElementById('autofillButton-prevIds');

    if (videoData.length) {
      container.style.display = 'block';
      list.innerHTML = '';
      videoData.forEach(({ title, id }) => {
        const li = document.createElement('li');
        li.textContent = `${title} — `;
        const a = document.createElement('a');
        a.href   = `https://youtu.be/${id}`;
        a.target = '_blank';
        a.textContent = id;
        li.appendChild(a);
        list.appendChild(li);
      });
    }

    autofillButton.style.display = "inline-block";
    autofillButton.addEventListener('click', async (e) => {
      e.stopPropagation();           // don’t toggle collapse
      autofillOnSite();
    });
    
    header.addEventListener('click', () => {
      // console.log("toggled persisted container");
      const isOpen = body.style.display === 'block';
      body.style.display = isOpen ? 'none' : 'block';
      // flip arrow: ▼ -> ▲
      toggle.innerHTML = isOpen ? '&#9660;' : '&#9650;';
    });

    // clear storage & hide container
    clearer.addEventListener('click', async (e) => {
      e.stopPropagation();           // don’t toggle collapse
      container.style.display = 'none';
    });
  }
  else {
    container.style.display = 'none';
  }
  

  // == upload all videos button == //
  uploadAllBtn.addEventListener("click", async () => {
    try {
      const playlistName = document.getElementById("playlistNameInput").value.trim();
      const playlistDescription  = document.getElementById("playlistDescriptionInput").value.trim(); 
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
  
      // Call the mass upload function with a step update callback
      await massUploadAllVideosToPlaylist(
        videoScoreMap,
        playlistName,
        playlistDescription,
        token
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
    

    // adding click handler for entire folder box
    li.addEventListener('click', async () => {
      li.classList.add('selected');
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
      li.classList.remove('selected');
    });

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
    showBtn.addEventListener("click", async (e) => {
      e.stopPropagation(); // prevent bubbling to parent
      li.classList.add('selected');
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
      li.classList.remove('selected');
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
    // lastIndexOf('.') returns -1 if no dot is found ⇢ slice(0, -0) ⇒ full name unchanged
    const baseName = file.name.slice(0, file.name.lastIndexOf('.')) || file.name;
    file.name = baseName;   

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
        showUploadStatus(`Uploading ${file.name}...`, 3, 1, "progress", [], "Step 1: Initiating upload session");
        
        const uploadedVideo = await uploadToYouTubeWithAutoReauth(file.id, file.name, score, accessToken);
    
        showUploadStatus(`Uploading ${file.name}...`, 3, 2, "progress", [], "Step 2: Saving video ID to storage");
    
        // Save the uploaded video ID to storage
        const videoData = [{ title: file.name, id: uploadedVideo.id }];
        await saveVideoIdsToStorage(videoData);
        
        showUploadStatus(`Successfully uploaded ${file.name}!`, 3, 3, "success", videoData);
    
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

let startY = 0;
let startHeight = 0;

divider.addEventListener('mousedown', (e) => {
  isDragging = true;
  startY = e.clientY;
  startHeight = foldersSection.offsetHeight;
  document.body.style.userSelect = 'none'; // prevent text selection
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dy = e.clientY - startY;
  let newHeight = startHeight + dy;
  newHeight = Math.max(60, Math.min(300, newHeight)); // clamp between 60–300 px
  foldersSection.style.height = `${newHeight}px`;
  foldersSection.style.flex = `0 0 ${newHeight}px`; // force fixed height
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  document.body.style.userSelect = '';
});