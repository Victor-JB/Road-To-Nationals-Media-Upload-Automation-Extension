# GymACT Road2Nationals Uploader (Chrome Extension)

> Automatically uploads competition videos from Google Drive to YouTube, optionally organizing them into playlists for RoadToNationals.com (not affiliated).

---

## 🔧 How It Works

This Chrome Extension:
1. Authenticates the user via Google OAuth
2. Lets the user browse folders in their Google Drive
3. Filters video files inside folders
4. Uploads selected videos to YouTube via the YouTube Data API
5. Optionally creates a playlist and adds all uploaded videos to it

---

## 🔐 OAuth Setup

We use **two separate Google OAuth clients** to avoid redirect URI mismatch issues:

### ➤ Production OAuth Client (for Web Store installs)
- **Client ID**: `xxxxxxxxxx-prod.apps.googleusercontent.com`
- **Redirect URI**: `https://<PROD_EXTENSION_ID>.chromiumapp.org/`
- This ID is stable for all installs from the Chrome Web Store

### ➤ Dev OAuth Client (for unpacked testing installs)
- **Client ID**: `xxxxxxxxxx-dev.apps.googleusercontent.com`
- **Redirect URI**: `https://<DEV_EXTENSION_ID>.chromiumapp.org/`
- This ID changes per machine or per fresh install

We detect the environment with this line:
```js
const IS_DEV = !chrome.runtime.getManifest().update_url;
```
This is `true` for unpacked extensions, and `false` for Web Store installs.

---

## 🔍 Required Chrome Permissions

- `identity`: Used for OAuth login to access Drive and YouTube
- `storage`: Temporarily caches access tokens for session reuse
- `host_permissions`:
  - `https://www.googleapis.com/auth/drive.readonly`
  - `https://www.googleapis.com/auth/youtube.upload`

> ✅ We do **not** use `tabs`, `cookies`, or any remote scripts.

---

## ✅ Privacy Summary

- No personal information is collected or stored
- OAuth tokens are kept in browser memory only for the active session
- Videos are uploaded only with user consent, and only from their Drive to their own YouTube account
- No analytics, tracking, or data sharing occurs

For full details, see the included [`privacy-policy.html`](./privacy-policy.html).

---

## 📦 Building / Testing

1. Clone the repo
2. Add your own `manifest.json` if developing privately
3. Replace the OAuth client IDs inside `oauth.js`
4. Load the extension unpacked via `chrome://extensions`

---

## 🧩 Chrome Web Store Submission Notes

If you plan to publish this extension, make sure to:
- Register the production extension's ID in your OAuth Client
- Provide a public privacy policy (see provided `.html`)
- Fill out Chrome's Privacy tab (no data types collected)

---

## 🤝 Not Affiliated

This tool is not affiliated with or endorsed by RoadToNationals.com. It is designed to help teams streamline competition video publishing workflows that happen to align with their platform's input formats.

---

## 📬 Contact
For questions or help, reach out to [your-email@example.com] or open an issue.
