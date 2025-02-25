document.addEventListener("DOMContentLoaded", async () => {
  // Get the current tab's URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0].url;

    if (url.includes("drive.google.com/drive/")) {
      const folderId = url.split("/folders/")[1].split("?")[0]; // Extract folder ID from URL
      console.log("Detected Google Drive Folder ID:", folderId);

      // Enable upload button and pass the folder ID
      const uploadButton = document.getElementById("uploadVideos");
      uploadButton.style.display = "block";
      uploadButton.onclick = () => fetchDriveVideos(folderId);
    } else {
      console.log("Not inside a Google Drive folder.");
    }
  });
});

async function fetchDriveVideos(folderId) {
  chrome.storage.local.get("accessToken", async (result) => { // Renamed `data` to `result`
    const token = result.accessToken;
    if (!token) {
      console.error("No access token found.");
      return;
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents and mimeType contains 'video/'&fields=files(id,name)`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const responseData = await response.json(); // Renamed `data` to `responseData`
      console.log("Videos found:", responseData.files);

      // Show videos in the popup
      const videoList = document.getElementById("videoList");
      videoList.innerHTML = "";

      responseData.files.forEach((video) => {
        let listItem = document.createElement("li");
        listItem.textContent = video.name;
        let uploadBtn = document.createElement("button");
        uploadBtn.textContent = "Upload to YouTube";
        uploadBtn.onclick = () => uploadToYouTube(video.id, video.name, token);
        listItem.appendChild(uploadBtn);
        videoList.appendChild(listItem);
      });
    } catch (error) {
      console.error("Error fetching videos:", error);
    }
  });
}

async function uploadToYouTube(driveFileId, fileName, accessToken) {
  try {
    // Get file from Google Drive
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const fileBlob = await driveResponse.blob();

    // Upload to YouTube
    const metadata = {
      snippet: {
        title: fileName,
        description: "Uploaded via Google Drive to YouTube",
        categoryId: "22",
      },
      status: {
        privacyStatus: "public",
      },
    };

    const formData = new FormData();
    formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    formData.append("video", fileBlob);

    const youtubeResponse = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      }
    );

    const youtubeData = await youtubeResponse.json();
    console.log("Uploaded to YouTube:", youtubeData);
  } catch (error) {
    console.error("Error uploading video:", error);
  }
}
