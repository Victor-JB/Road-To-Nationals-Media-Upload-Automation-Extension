# GymACT Road2Nationals Uploader (Chrome Extension)

> Automatically uploads competition videos from Google Drive to YouTube, optionally organizing them into playlists for RoadToNationals.com (not affiliated).

---

## 🔧 How It Works

This Chrome Extension:
1. Authenticates the user via Google OAuth
2. Opens the **Google Picker** so users can select specific video files from their Drive
3. Downloads only the user-selected videos (no folder browsing or broad access)
4. Uploads selected videos to YouTube via the YouTube Data API
5. Optionally creates a playlist and adds all uploaded videos to it

---

## 🔐 OAuth & Permissions Philosophy

### Why We Use `drive.file` Scope (Not `drive.readonly`)

This extension uses the **restricted `drive.file` scope** instead of the broader `drive.readonly` scope. Here's why:

| Aspect | `drive.readonly` | `drive.file` (Our Choice) |
|--------|------------------|---------------------------|
| **Access Level** | Read ALL files in Drive | Only files user explicitly selects |
| **User Control** | Extension can browse everything | User chooses exactly what to share |
| **Privacy** | Requires trusting the app with full access | Minimal access - only selected files |
| **Google Verification** | Requires extensive review | More straightforward verification |

**Key Benefits:**
- **Privacy-First**: We never see your folder structure or file list
- **User Control**: You explicitly select each video via Google Picker
- **Minimal Permissions**: The extension only accesses files you choose to share
- **Transparency**: No background access to your Drive

### How the Google Picker Works

The Google Picker is Google's official file selection UI that gives users full control:

1. User clicks "Select Videos from Drive" in the extension
2. Google's Picker UI opens (hosted by Google, not our code)
3. User navigates their own Drive and selects videos
4. Picker returns **only** the selected file IDs to the extension
5. Extension can now access **only** those specific files

This means:
- ✅ We never see files you don't select
- ✅ Google handles the file browsing securely
- ✅ You grant access per-file, not blanket access
- ✅ Access is revocable at any time via Google Account settings

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

## 🔍 Required Chrome & OAuth Permissions

### Chrome Extension Permissions
- `identity`: Used for OAuth login to access Drive and YouTube
- `storage`: Caches access tokens and video selections temporarily
- `host_permissions`:
  - `https://www.googleapis.com/*` - For Drive file downloads and YouTube uploads
  - `https://apis.google.com/*` - For Google Picker API

### OAuth Scopes Requested
- `https://www.googleapis.com/auth/drive.file` - Access **only** to Picker-selected files
- `https://www.googleapis.com/auth/youtube.force-ssl` - Upload videos to user's YouTube

> ✅ We do **not** use `tabs`, `cookies`, broad Drive access, or any remote scripts.

---

## 🔒 Privacy Policy

**For the full privacy policy, see [PRIVACY.md](./PRIVACY.md).**

### Summary

- **Data Accessed**: Only videos you explicitly select via Google Picker
- **Data Usage**: Selected videos are uploaded to YOUR YouTube account
- **Data Storage**: Video IDs cached locally for 30 minutes (for retry/resume)
- **Data Sharing**: Videos go only to YouTube (your account) - no third parties
- **No Tracking**: No analytics, telemetry, or personal data collection

---

## 📸 Consent Flow Screenshots

*Screenshots demonstrating the user consent and file selection flow:*

### 1. OAuth Consent Screen
<!-- TODO: Add screenshot of Google OAuth consent screen showing requested permissions -->
`[Screenshot Placeholder: OAuth consent screen showing drive.file and youtube scopes]`

### 2. Google Picker File Selection
<!-- TODO: Add screenshot of Google Picker UI with video files -->
`[Screenshot Placeholder: Google Picker UI showing user selecting video files]`

### 3. Selected Videos Confirmation
<!-- TODO: Add screenshot of extension popup showing selected videos -->
`[Screenshot Placeholder: Extension popup displaying selected videos ready for upload]`

### 4. Upload Progress
<!-- TODO: Add screenshot of upload progress indicator -->
`[Screenshot Placeholder: Upload progress showing videos being uploaded to YouTube]`

---

## 📦 Building / Testing

1. Clone the repo
2. Add your own `manifest.json` if developing privately
3. Replace the OAuth client IDs inside `oauth.js`
4. Configure `pickerConfig.js` with your Google API Key and App ID
5. Load the extension unpacked via `chrome://extensions`

---

## 🧩 Chrome Web Store & OAuth Verification Notes

If you plan to publish this extension, make sure to:
- Register the production extension's ID in your OAuth Client
- Provide a public privacy policy (see [PRIVACY.md](./PRIVACY.md))
- Fill out Chrome's Privacy tab (no data types collected)
- Complete Google OAuth verification (see [OAUTH_VERIFICATION.md](./OAUTH_VERIFICATION.md))

---

## 🤝 Not Affiliated

This tool is not affiliated with or endorsed by RoadToNationals.com. It is designed to help teams streamline competition video publishing workflows that happen to align with their platform's input formats.

---

## 📬 Contact
For questions or help, reach out to [victorjb2015@gmail.com] or open an issue.
