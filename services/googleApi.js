// services/googleApi.js
import { getAccessToken, invalidateToken } from "../background/oauth.js";

export async function gFetch(endpoint, { method = "GET", body, headers = {}, retries = 1 } = {}) {
  let token = await getAccessToken();
  const doFetch = () =>
    fetch(endpoint, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...headers },
      body,
    });

  let res = await doFetch();
  if (res.status === 401 && retries) {
    await invalidateToken();    // wipe from storage
    token = await getAccessToken();   // re‑auth
    res = await doFetch();
  }
  if (!res.ok) throw Object.assign(new Error(res.statusText), { status: res.status });
  return res;
}
