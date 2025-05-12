// utils.js -- just auxiliary functions

/**
* Utility functions for the GymACT Road2Nationals Uploader.
* These functions are used to build the description for the uploaded videos
* and to handle the score input.
*/
export function buildDescription(originalDescription) {
    // fall back to blank if user left the box empty
    const scoreLine = "Score: " + originalDescription + "\n\n\nUploaded via GymACT Road2Nationals Uploader\nbit.ly/4jwNnJk"
    return scoreLine;
  }

/*
  * Functions for showing upload status and progress.
  * These are used in the uploadToYouTubeWithAutoReauth function.
*/
export function showUploadStatus(message, mode = "neutral", videoData = [], stepMessage = "") {
    const container = document.getElementById("uploadStatus");
    const msg = document.getElementById("uploadMessage");
    const progress = document.getElementById("uploadProgress");
    const collapsibleBox = document.getElementById("collapsibleBox");
    const copyButton = document.getElementById("copyButton");
  
    msg.textContent = `${message} ${stepMessage}`;
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
