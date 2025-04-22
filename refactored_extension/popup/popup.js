// popup/popup.js
import { listFolders, listVideosInFolder } from "../services/drive.js";
import { uploadFolderVideos } from "../services/youtube.js";

const folderListEl = document.getElementById("folderList");
let allFolders = [];
let selectedFolderId = null;

function renderFolderList(folders) {
  folderListEl.innerHTML = folders
    .map(
      (f) =>
        `<li data-id="${f.id}" class="folder-item${selectedFolderId === f.id ? " active" : ""}">
          ${f.name}
        </li>`
    )
    .join("");
}

function showStatus(text) {
  const s = document.getElementById("status");
  s.textContent = text;
  s.style.display = "block";
}

function wireFolderClicks() {
  folderListEl.addEventListener("click", (e) => {
    const li = e.target.closest(".folder-item");
    if (!li) return;
    selectedFolderId = li.dataset.id;
    renderFolderList(allFolders);
  });
}

async function init() {
  try {
    allFolders = await listFolders();
    renderFolderList(allFolders);
    wireFolderClicks();
  } catch (err) {
    showStatus(`Error fetching folders: ${err.message}`);
  }

  document.getElementById("folderSearchInput").oninput = (e) => {
    const term = e.target.value.toLowerCase();
    renderFolderList(allFolders.filter((f) => f.name.toLowerCase().includes(term)));
  };

  document.getElementById("uploadAllButton").onclick = async () => {
    if (!selectedFolderId) return alert("Select a Drive folder first.");
    const playlistName = document.getElementById("playlistNameInput").value.trim() || "New Playlist";

    try {
      showStatus("Fetching videos...");
      const videos = await listVideosInFolder(selectedFolderId);
      if (!videos.length) return showStatus("Folder contains no videos.");

      showStatus("Uploading...");
      await uploadFolderVideos(videos, playlistName, (evt) => {
        if (evt.phase === "upload-progress") {
          showStatus(`Uploading ${evt.idx + 1}/${videos.length}: ${evt.pct || 0}%`);
        }
      });
      showStatus("Done!");
    } catch (err) {
      console.error(err);
      showStatus(`Error: ${err.message}`);
    }
  };
}

document.addEventListener("DOMContentLoaded", init);
