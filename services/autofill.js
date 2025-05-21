// autofill.js -- just logic to handle autofilling of the IDs

import { getStoredVideoIDs } from "./youtubeApi.js";

const EVENT_ALIAS = {
  floor:  ['floor', 'fx'],
  phorse: ['phorse', 'pommel', 'ph'],
  rings:  ['rings', 'sr'],
  vault:  ['vault', 'vt'],
  pbars:  ['pbars', 'parallel', 'pb'],
  hbar:   ['hbar',  'high', 'hb']
};


//--------------------------------------------------------------------------- //
/** Build { "event:last": {id, first, last} } for quick lookup */
async function buildLookup() {
  const uploadedVideos = await getStoredVideoIDs();
  const map = {};

  uploadedVideos.forEach(({ title, id }) => {
    const low = title.toLowerCase();
    const tokens = low.split(/[^a-z]+/);

    // find event alias in title
    const event = Object.keys(EVENT_ALIAS)
      .find(ev => tokens.some(t => EVENT_ALIAS[ev].includes(t)));
    if (!event) return;

    // crude: assume last two tokens before alias are first/last
    const idx = tokens.findIndex(t => EVENT_ALIAS[event].includes(t));
    const first = tokens[idx - 2] ?? '';
    const last  = tokens[idx - 1] ?? '';
    if (!last) return;

    map[`${event}:${last}`] = { id, first, last };
  });

  return map;
}

//--------------------------------------------------------------------------- //
/** Content-script body – runs inside Road2Nationals tab */
function fillTable(lookup) {
  // EV_FROM_CODE defined here so also injected in site context
  const EV_FROM_CODE = { fx:'floor', ph:'phorse', sr:'rings',
    vt:'vault', pb:'pbars',   hb:'hbar' 
  };

  let filled = 0;

  document.querySelectorAll('div.table-responsive table tbody tr')
          .forEach(row => {
    const tds   = row.children;
    const first = tds[0].textContent.trim().toLowerCase();
    const last  = tds[1].textContent.trim().toLowerCase();

    // event code lives in ?ev=xx on the Submit link
    const href  = row.querySelector('a.submit_btn')?.href || '';
    const code  = new URLSearchParams(href.split('?')[1] || '')
                      .get('ev')?.toLowerCase();
    const event = EV_FROM_CODE[code] || '';
    

    const key   = `${event}:${last}`;
    console.log("found key: ", key);
    const match = lookup[key];

    // optional: fuzzy fallback if first names mismatch slightly
    if (match && (!match.first || match.first.startsWith(first[0]))) {
      row.querySelector('input.id').value = match.id;
      filled++;
      // tiny visual cue
      row.style.outline = '2px solid #4caf50';
    }
  });

  return filled;
}

//--------------------------------------------------------------------------- //
/** Main entry called from popup */
export async function autofillOnSite() {
  const lookup = await buildLookup();
  if (!Object.keys(lookup).length) {
    alert('No cached uploads to autofill.');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    alert('Please open the RoadToNationals edit page before clicking “Autofill”.');
    return;
  }
  
  const url = new URL(tab.url);
  
  // 1) host must be RoadToNationals
  if (!url.hostname.endsWith('roadtonationals.com')) {
    alert('Please navigate to a Road2Nationals page first.');
    return;
  }
  
  // 2) option-al: path must contain “results” (or whatever section you require)
  if (!url.pathname.includes('/results')) {
    alert('Please open the Meet-Videos entry page before using Autofill.');
    return;
  }

  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      args:   [lookup],
      func:   fillTable
    },
    ([{ result: count }]) => {
      alert(`Autofill finished - ${count} row${count === 1 ? '' : 's'} updated.`);
    }
  );
}