document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("selectFile").addEventListener("click", openGooglePicker);
});

async function openGooglePicker() {
  chrome.storage.local.get("accessToken", async (data) => {
    const token = data.accessToken;
    if (!token) {
      console.error("No access token found.");
      return;
    }

    await gapi.load("client:picker", async () => {
      await gapi.client.load("drive", "v3");

      const picker = new google.picker.PickerBuilder()
        .addView(google.picker.ViewId.DOCS_VIDEOS)
        .setOAuthToken(token)
        .setDeveloperKey("AIzaSyC_20z4FRpUaYMW4i4syjvay1FQiv7jY20")
        .setCallback((data) => {
          if (data.action === google.picker.Action.PICKED) {
            const fileId = data.docs[0].id;
            const fileName = data.docs[0].name;
            console.log("Selected File ID:", fileId);
            uploadToYouTube(fileId, fileName, token);
          }
        })
        .build();

      picker.setVisible(true);
    });
  });
}


async function uploadToYouTube(driveFileId, fileName, accessToken) {
  try {
    // Step 1: Initiate upload session
    const initResponse = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": "video/*",
        },
        body: JSON.stringify({
          snippet: {
            title: fileName,
            description: "Uploaded via Google Drive to YouTube",
            categoryId: "22",
          },
          status: {
            privacyStatus: "public",
          },
        }),
      }
    );

    if (!initResponse.ok) throw new Error("Failed to start upload");

    const uploadUrl = initResponse.headers.get("Location");

    // Step 2: Fetch video from Drive
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const fileBlob = await driveResponse.blob();

    // Step 3: Upload file
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Length": fileBlob.size },
      body: fileBlob,
    });

    const youtubeData = await uploadResponse.json();
    console.log("Uploaded to YouTube:", youtubeData);
  } catch (error) {
    console.error("Error uploading video to YouTube:", error);
  }
}
