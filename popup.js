document.getElementById("selectFolder").addEventListener("click", async () => {
  chrome.storage.local.get("accessToken", async (data) => {
    const token = data.accessToken;
    if (!token) {
      console.error("No access token found.");
      return;
    }

    // Step 1: Let user pick a folder from Google Drive
    const folderId = prompt("Enter Google Drive Folder ID:");

    // Step 2: Fetch videos from the selected folder
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents and mimeType contains 'video/'&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await response.json();
    const videoList = document.getElementById("videoList");
    videoList.innerHTML = "";

    data.files.forEach((video) => {
      let listItem = document.createElement("li");
      listItem.textContent = video.name;
      let uploadBtn = document.createElement("button");
      uploadBtn.textContent = "Upload to YouTube";
      uploadBtn.onclick = () => uploadToYouTube(video.id, video.name, token);
      listItem.appendChild(uploadBtn);
      videoList.appendChild(listItem);
    });
  });
});

async function uploadToYouTube(driveFileId, fileName, accessToken) {
  try {
    // Step 3: Get file from Google Drive
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const fileBlob = await driveResponse.blob();

    // Step 4: Upload to YouTube
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
