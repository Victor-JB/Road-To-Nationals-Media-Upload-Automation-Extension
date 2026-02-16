# Privacy Policy

**GymACT Road2Nationals Uploader Chrome Extension**

*Last Updated: February 15, 2026*

---

## Overview

The GymACT Road2Nationals Uploader ("the Extension") is designed to help gymnastics teams upload competition videos from Google Drive to YouTube. We are committed to protecting your privacy and being transparent about how your data is handled.

**Key Principle**: This extension accesses only the files you explicitly select. We never browse, scan, or access any files you haven't chosen to share.

---

## What Data Is Accessed

### Google Drive Access

| Data Type | Accessed? | Details |
|-----------|-----------|---------|
| **Selected Video Files** | ✅ Yes | Only videos you explicitly select via Google Picker |
| **File Names** | ✅ Yes | Names of selected files (used for YouTube video titles) |
| **File Contents** | ✅ Yes | Video binary data (to upload to YouTube) |
| **Other Drive Files** | ❌ No | We cannot see or access files you don't select |
| **Folder Structure** | ❌ No | We cannot browse or list your folders |
| **File Metadata** | ❌ No | No access to sharing settings, comments, etc. |

**How This Works**: We use the `drive.file` OAuth scope combined with Google Picker. This means:
- Google's Picker UI handles file browsing (not our code)
- You select exactly which files to share
- We receive access tokens valid only for selected files
- We cannot access anything you didn't explicitly choose

### YouTube Access

| Data Type | Accessed? | Details |
|-----------|-----------|---------|
| **Upload Videos** | ✅ Yes | We upload selected videos to your channel |
| **Create Playlists** | ✅ Yes | Optionally create playlists for organization |
| **Channel Info** | ❌ No | We don't read your channel data |
| **Existing Videos** | ❌ No | We don't access your existing content |
| **Analytics** | ❌ No | No access to your YouTube analytics |

---

## How Data Is Used

### Primary Use Case

1. **You select videos** via Google Picker (Google's official file selector)
2. **Extension downloads** selected video files from your Drive
3. **Extension uploads** videos to your YouTube account
4. **Optionally**, videos are added to a playlist you specify

### What We Do NOT Do

- ❌ We do NOT store your videos on our servers
- ❌ We do NOT share your files with any third party (except YouTube, per your request)
- ❌ We do NOT analyze your video content
- ❌ We do NOT collect personal information
- ❌ We do NOT track your usage with analytics
- ❌ We do NOT sell or monetize any data

---

## Data Retention Policy

### Local Storage (Your Browser)

| Data | Retention Period | Purpose |
|------|------------------|---------|
| **OAuth Access Tokens** | Until expiry (~1 hour) or logout | Authenticate with Google APIs |
| **Selected Video IDs** | 30 minutes | Allow retry/resume of uploads |
| **Form Field Cache** | Until cleared or new selection | Remember video titles/descriptions |
| **Upload Progress** | Until upload completes | Track upload status |

### Data Deletion

- **Automatic**: Cached data expires automatically (30 minutes for video IDs)
- **Manual**: Click "Sign Out" to clear all stored tokens
- **Browser**: Clear browser storage/cookies to remove all extension data
- **Google Account**: Revoke access anytime at [myaccount.google.com/permissions](https://myaccount.google.com/permissions)

### Server-Side Storage

**We have no servers.** This extension runs entirely in your browser. There is no backend, no database, and no server-side storage of your data.

---

## Third-Party Data Sharing

### YouTube (Google)

When you upload videos, they are sent directly to YouTube's servers. This is the explicit purpose of the extension and requires your consent. YouTube's handling of uploaded videos is governed by:
- [YouTube Terms of Service](https://www.youtube.com/t/terms)
- [Google Privacy Policy](https://policies.google.com/privacy)

### Other Third Parties

**We share data with NO other third parties.**

- No analytics services (Google Analytics, Mixpanel, etc.)
- No advertising networks
- No data brokers
- No social media tracking
- No error reporting services that capture user data

---

## OAuth Scopes Explained

This extension requests the following OAuth scopes:

### `https://www.googleapis.com/auth/drive.file`

**What it allows**: Access only to files you select via Google Picker

**What it does NOT allow**:
- Cannot list or browse your Drive
- Cannot access files you haven't selected
- Cannot see your folder structure
- Cannot access shared drives unless you select files from them

### `https://www.googleapis.com/auth/youtube.force-ssl`

**What it allows**: Upload videos and manage playlists on your YouTube channel

**What it does NOT allow**:
- Cannot delete your videos
- Cannot access your analytics
- Cannot read your existing videos' details
- Cannot modify videos uploaded by other means

---

## User Control & Rights

### You Control Access

- **Select Only What You Want**: Use Google Picker to choose specific files
- **Revoke Anytime**: Remove access at [Google Account Permissions](https://myaccount.google.com/permissions)
- **Sign Out**: Clear stored tokens using the extension's Sign Out button
- **Uninstall**: Removing the extension deletes all locally stored data

### Your Rights

- **Right to Know**: This policy explains all data practices
- **Right to Access**: Your data stays on your Google accounts
- **Right to Delete**: Clear local data or revoke Google permissions
- **Right to Refuse**: Don't install/use the extension if you disagree with these terms

---

## Security Measures

### How We Protect Your Data

1. **No Remote Servers**: All processing happens locally in your browser
2. **HTTPS Only**: All API communication uses encrypted connections
3. **Token Security**: OAuth tokens stored in Chrome's secure storage API
4. **Minimal Permissions**: We request only the scopes necessary for functionality
5. **No Persistent Storage**: Video data is streamed, not stored locally

### Chrome Extension Security

- Extension code is reviewed by Chrome Web Store
- Manifest V3 provides enhanced security restrictions
- Content Security Policy prevents unauthorized code execution

---

## Children's Privacy

This extension is not directed at children under 13. We do not knowingly collect information from children. If you believe a child has used this extension, the data would only be their Google-authenticated session which can be revoked via Google Account settings.

---

## Changes to This Policy

We may update this privacy policy to reflect changes in the extension or legal requirements. Changes will be:
- Posted in this document with updated date
- Noted in extension update release notes
- Effective immediately upon posting

---

## Contact Information

For privacy-related questions or concerns:

- **Email**: victorjb2015@gmail.com
- **GitHub Issues**: [Open an issue](https://github.com/Victor-JB/Road-To-Nationals-Media-Upload-Automation-Extension/issues)

---

## Consent

By installing and using this extension, you consent to this privacy policy. If you do not agree with these terms, please do not install or use the extension.

---

*This privacy policy is effective as of February 15, 2026.*
