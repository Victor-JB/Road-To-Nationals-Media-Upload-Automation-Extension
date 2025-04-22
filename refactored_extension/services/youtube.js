// services/youtube.js
import { gFetch } from "./googleApi.js";
import { saveVideoIds } from "../storage/videoStore.js";
import { throttle } from "../util/progress.js";

const YT = "https://www.googleapis.com/youtube/v3";

/** Creates a private playlist, returns its id */
export async function createPlaylist(title) {
  const body = { snippet: { title }, status: { privacyStatus: "unlisted" } };
  const res = await gFetch(`${YT}/playlists?part=snippet,status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data.id;
}

/** Add a video to a playlist */
async function addVideoToPlaylist(playlistId, videoId) {
  const body = { snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } } };
  await gFetch(`${YT}/playlistItems?part=snippet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Uploads a Blob, returns { id, title } */
export async function uploadVideo(fileBlob, filename, onProgressCb = () => {}) {
  // 1. Start resumable session
  const initRes = await gFetch(
    `${YT}/videos?uploadType=resumable&part=snippet,status`,
    {
      method: "POST",
      headers: {
        "X-Upload-Content-Length": fileBlob.size,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: { title: filename },
        status: { privacyStatus: "unlisted" },
      }),
    }
  );
  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("Could not obtain resumable upload URL");

  // 2. Upload bytes; hook into progress if supported
  const controller = new AbortController();
  const throttled = throttle(onProgressCb, 150);
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    body: fileBlob,
    headers: { "Content-Type": "video/*" },
    signal: controller.signal,
  });
  if (!uploadRes.ok) {
    const msg = await uploadRes.text().catch(() => "<unreadable>");
    throw new Error(`Video upload failed: ${uploadRes.status} ${msg}`);
  }
  const { id } = await uploadRes.json();
  return { id, title: filename };
}

/**
 * Upload a list of Drive video files to YouTube and insert all into
 * a newly‑created playlist. Emits progress via callback.
 */
export async function uploadFolderVideos(videoFiles, playlistName, progressCb = () => {}) {
  const playlistId = await createPlaylist(playlistName);

  const uploaded = [];
  for (let i = 0; i < videoFiles.length; i++) {
    const file = videoFiles[i];
    progressCb({ phase: "download", idx: i, total: videoFiles.length });

    // First download from Drive (we get a Blob)
    const driveRes = await gFetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`
    );
    const blob = await driveRes.blob();

    // Upload to YouTube
    progressCb({ phase: "upload", idx: i });
    const video = await uploadVideo(blob, file.name, (pct) =>
      progressCb({ phase: "upload-progress", idx: i, pct })
    );

    // Add to playlist
    progressCb({ phase: "playlist", idx: i });
    await addVideoToPlaylist(playlistId, video.id);
    uploaded.push(video);

    progressCb({ phase: "complete-video", idx: i });
  }

  await saveVideoIds(uploaded);
  progressCb({ phase: "complete-batch", uploaded });
  return { playlistId, uploaded };
}
