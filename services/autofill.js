// autofill.js -- just logic to handle autofilling of the IDs

import { getStoredVideoIDs } from "./youtubeApi.js";

export async function autofillOnSite() {

  // 1) get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url    = new URL(tab.url);

  // 2) verify domain
  if (!url.hostname.includes("roadtonationals.com/results")) {
    alert("Please navigate to the Road2Nationals Meet Videos entry page first.");
    return;
  }
  
  // 1) get uploaded video meta
  const uploadedVideos = await getStoredVideoIDs();
  if (!uploadedVideos.length) {
    alert('No uploaded videos cached for autofill.');
    return;
  }

  // 2) build lookup
  const EVENT_MAP = { floor:['floor','fx'], phorse:['phorse','pommel','ph'], rings:['rings','sr'],
                      vault:['vault','vt'], pbars:['pbars','parallel','pb'], hbar:['hbar','high','hb'] };
  const lookup = {};

  for (const { title, id } of uploadedVideos) {
    const tokens = title.toLowerCase().split(/[^a-z]+/);
    const event  = Object.keys(EVENT_MAP)
                          .find(ev => tokens.some(t => EVENT_MAP[ev].includes(t)));
    if (!event) continue;

    // assume last token before event aliases is the last name
    const idx = tokens.findIndex(t => EVENT_MAP[event].includes(t));
    const first = tokens[idx - 2] ?? '';   // very heuristic, but works for "Joseph Conley Floor"
    const last  = tokens[idx - 1] ?? '';
    lookup[`${event}:${last}`] = { id, first, last };
  }

  // 3) inject a content script in the active tab
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [lookup],
    func: (lookup) => {
      const filled = [];
      document.querySelectorAll('table').forEach(tbl => {
        const eventKey = tbl.previousElementSibling.textContent.trim().toLowerCase();
        tbl.querySelectorAll('tr').forEach(row => {
          const last = row.children[1].textContent.trim().toLowerCase();
          const key  = `${eventKey}:${last}`;
          if (lookup[key]) {
            row.querySelector('input[type="text"][name*="youtube"]').value = lookup[key].id;
            filled.push(key);
          }
        });
      });
      return filled.length;
    }
  }, ([{ result: count }]) => {
      alert(`Autofill complete - ${count} rows updated.`);
  });
}
