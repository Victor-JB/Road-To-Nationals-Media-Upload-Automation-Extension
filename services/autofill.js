export async function autofillOnSite() {
  // 1) get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url    = new URL(tab.url);

  // 2) verify domain
  if (!url.hostname.includes("roadtonationals.com/results")) {
    alert("Please navigate to the Road2Nationals Meet Videos entry page first.");
    return;
  }

  // 3) fetch all stored IDs
  chrome.storage.local.get(null, items => {
    // 4) inject into page
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (storedItems) => {
        for (const [title, id] of Object.entries(storedItems)) {
          const [namePart, eventOrScore = ""] = title.split(" - ");
          const normalized = namePart.trim().toLowerCase();

          document.querySelectorAll("tr").forEach(row => {
            const cells = row.querySelectorAll("td");
            if (cells.length < 4) return;

            const first = cells[0].innerText.trim().toLowerCase();
            const last  = cells[1].innerText.trim().toLowerCase();
            if (`${first} ${last}` !== normalized) return;

            // if multiple matches, check that the score cell text appears in eventOrScore
            const scoreText = cells[2].innerText.trim();
            if (eventOrScore && !eventOrScore.includes(scoreText)) return;

            // found it → fill input in cell 3
            const input = cells[3].querySelector("input");
            if (input) input.value = id;
          });
        }
      },
      args: [items]
    });
  });
}
