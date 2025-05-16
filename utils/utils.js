// utils.js -- just auxiliary functions

import { getAccessToken, chromeStorageRemove } from "../background/oauth.js";

/**
 * Wrap any async function whose first arg is `accessToken`,
 * retrying once if it throws an error with `.status === 401`.
 *
 * @param {Function} fn – async (accessToken, ...args) ⇒ Promise<…>
 * @returns {Function} same signature as fn, but with auto-reauth
 */
export function withAutoReauth(fn) {
  return async function(accessToken, ...restArgs) {
    try {
      return await fn(accessToken, ...restArgs);
    } catch (err) {
      if (err.status === 401) {
        console.warn(`${fn.name} got 401; re-authenticating…`);
        // clear stale token & fetch a new one
        await chromeStorageRemove(["accessToken"]);
        const newToken = await getAccessToken();
        if (!newToken) {
          throw new Error(`Re-auth failed in wrapper for ${fn.name}`);
        }
        // retry original call with fresh token
        return await fn(newToken, ...restArgs);
      }
      throw err;
    }
  };
}

// -------------------------------------------------------------------------- //
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

// -------------------------------------------------------------------------- //
/*
  * Functions for showing upload status and progress.
  * These are used in the uploadToYouTubeWithAutoReauth function.
*/
export function showUploadStatus(message, mode = "neutral", videoData = [], stepMessage = "") {
    const container = document.getElementById("uploadStatus");
    const msg = document.getElementById("uploadMessage");
    const autofillButton = document.getElementById("autofillButton");
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

      // show & wire up our new Autofill button
      autofillButton.style.display = "inline-block";
      autofillButton.onclick = () => {
        autofillOnSite();
      };
    } else {
      collapsibleBox.style.display = "none";
      copyButton.style.display = "none";
      autofillButton.style.display = "none";
    }
  }
