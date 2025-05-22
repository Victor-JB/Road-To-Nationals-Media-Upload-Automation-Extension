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
  const uploadedVideos = await getStoredVideoIDs();   // [{ title, id }, …]
  const lookup = {};
  const issues  = [];

  uploadedVideos.forEach(({ title, id }) => {
    const low     = title.toLowerCase();
    const tokens  = low.split(/[^a-z]+/);

    // 1) find the event in the title
    const event = Object.keys(EVENT_ALIAS)
      .find(ev => tokens.some(t => EVENT_ALIAS[ev].includes(t)));
    if (!event) {
      issues.push(`No event found in "${title}"`);
      return;           // no event found
    }

    // 2) crude name extraction: the two tokens before event alias
    const idx   = tokens.findIndex(t => EVENT_ALIAS[event].includes(t));
    const first = tokens[idx - 2] ?? '';
    const last  = tokens[idx - 1] ?? '';
    if (!first && !last) {
      issues.push(`No athlete name found in "${title}"`);
      return;                         // skip this video
    }

    const meta = { id, first, last };      // ← now defined

    lookup[event]            ??= { last:{}, first:{}, combo:{} };
    if (last)  lookup[event].last [last]            = meta;
    if (first) lookup[event].first[first]           = meta;
    if (first && last)
               lookup[event].combo[first + last]    = meta;
  });

  return { lookup, issues }; // { floor:{last:{…}, first:{…}, combo:{…}}, … }
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
    
    const bucket = lookup[event] || {};
    console.log('bucket', bucket);
    const match  = bucket.last?.[last]               // ← now safe
                || bucket.first?.[first]
                || bucket.combo?.[first + last];

    if (match) {
      row.querySelector('input.id').value = match.id;
      row.style.outline = '2px solid #4caf50';
      filled++;
      console.log('Matched', event, first, last, '→', match.id);
    } else {
      console.log('No match for', event, first, last);
    }

  });

  return filled;
}

//--------------------------------------------------------------------------- //
/** Main entry called from popup */
export async function autofillOnSite() {

  const { lookup, issues } = await buildLookup();
  if (issues.length) {
    alert(
    `Skipped ${issues.length} video${issues.length > 1 ? 's' : ''}:\n` +
    issues.join('\n')
    );
  }

  if (!Object.keys(lookup).length) {
    alert('No parsable uploads to autofill.');
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