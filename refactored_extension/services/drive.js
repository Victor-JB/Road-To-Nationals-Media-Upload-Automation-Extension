// services/drive.js
import { gFetch } from "./googleApi.js";

const BASE = "https://www.googleapis.com/drive/v3/files";
const FIELDS = encodeURIComponent("files(id,name,mimeType)");

export async function listFolders() {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false");
  const res = await gFetch(`${BASE}?q=${q}&fields=${FIELDS}`);
  const { files = [] } = await res.json();
  return files;
}

export async function listVideosInFolder(folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and mimeType contains 'video/' and trashed=false`);
  const res = await gFetch(`${BASE}?q=${q}&fields=${FIELDS}`);
  const { files = [] } = await res.json();
  return files;
}
