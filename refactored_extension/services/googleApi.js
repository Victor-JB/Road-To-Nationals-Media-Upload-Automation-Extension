// services/googleApi.js
import { getAccessToken, invalidateToken } from "../background/oauth.js";

/**
 * Centralised Google fetch wrapper with 401 retry and basic 5xx back‑off.
 */
export async function gFetch(url, {
  method = "GET",
  headers = {},
  body = undefined,
  retries = 1,         // 401 retry
  backoff = 2,         // exponential back‑off attempts for 5xx
} = {}) {
  let token = await getAccessToken();

  const doFetch = () =>
    fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...headers },
      body,
    });

  let res;
  try {
    res = await doFetch();
  } catch (networkErr) {
    networkErr.message = `Network error while calling ${url}: ${networkErr.message}`;
    throw networkErr;
  }

  // Handle 401 once
  if (res.status === 401 && retries) {
    await invalidateToken();
    token = await getAccessToken();
    res = await doFetch();
  }

  // Handle 5xx with exponential back‑off
  let attempt = 0;
  while (res.status >= 500 && attempt < backoff) {
    const wait = 2 ** attempt * 500; // 0.5s, 1s, 2s, ...
    await new Promise((r) => setTimeout(r, wait));
    res = await doFetch();
    attempt += 1;
  }

  if (!res.ok) {
    const err = new Error(`Google API responded ${res.status} for ${url}`);
    err.status = res.status;
    err.url = url;
    err.body = await res.text().catch(() => "<unreadable>");
    throw err;
  }
  return res;
}
