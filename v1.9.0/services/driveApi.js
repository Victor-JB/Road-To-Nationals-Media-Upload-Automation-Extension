// driveApi.js

import { withAutoReauth } from "../utils/utils.js";

// -------------------------------------------------------------------------- //
/**
 * Recursively gathers *all* video files inside `folderId`,
 * skipping sub-folders in the output.
 *
 * @param {string} accessToken – OAuth token with at least Drive.readonly scope
 * @param {string} folderId    – ID of the root folder the user clicked
 * @returns {Promise<Array<{id:string,name:string,mimeType:string,parent:string}>>}
 */
export async function listVideosInFolder(accessToken, folderId) {
	const allVideos = [];

	async function walkFolder(id) {
		let pageToken = null;

		do {
			const q = encodeURIComponent(`'${id}' in parents and trashed = false`);
			const fields = encodeURIComponent(
				"nextPageToken, files(id,name,mimeType,parents,thumbnailLink)"
			);
			const base = `https://www.googleapis.com/drive/v3/files`;
			const params =
				`?q=${q}&fields=${fields}&pageSize=1000` +
				(pageToken ? `&pageToken=${pageToken}` : "");
			const url = base + params;

			const resp = await fetch(url, {
				headers: { Authorization: `Bearer ${accessToken}` },
			});
			if (!resp.ok) {
				throw new Error(`Drive list failed (${resp.status})`);
			}
			const data = await resp.json();
			pageToken = data.nextPageToken || null;

			// process each entry
			for (const f of data.files || []) {
				if (f.mimeType === "application/vnd.google-apps.folder") {
					// recurse into sub-folder (and await it)
					await walkFolder(f.id);
				} else if (f.mimeType.startsWith("video/")) {
					allVideos.push({
						id: f.id,
						name: f.name,
						mimeType: f.mimeType,
						parent: id,
						thumbnailLink: f.thumbnailLink,
					});
				}
			}
		} while (pageToken);
	}

	await walkFolder(folderId);
	return allVideos;
}

export const listVideosInFolderWithAutoReauth =
	withAutoReauth(listVideosInFolder);
