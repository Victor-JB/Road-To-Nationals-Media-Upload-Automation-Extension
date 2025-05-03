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
  