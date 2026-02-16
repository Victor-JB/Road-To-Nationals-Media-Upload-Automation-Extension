# OAuth Verification Submission Materials

**GymACT Road2Nationals Uploader Chrome Extension**

*Prepared for Google OAuth Verification Review*

---

## Table of Contents

1. [Application Overview](#application-overview)
2. [Use Case Explanation](#use-case-explanation)
3. [Why drive.file Scope Is Sufficient](#why-drivefile-scope-is-sufficient)
4. [User Consent Flow](#user-consent-flow)
5. [Data Handling Practices](#data-handling-practices)
6. [Screenshots & Demonstrations](#screenshots--demonstrations)
7. [Security Implementation](#security-implementation)
8. [Verification Checklist](#verification-checklist)

---

## Application Overview

### What Is This Extension?

The GymACT Road2Nationals Uploader is a Chrome Extension designed for gymnastics competition teams. It streamlines the workflow of uploading competition videos from Google Drive to YouTube for sharing on RoadToNationals.com.

### Target Users

- Gymnastics team coaches and staff
- Competition video managers
- Athletic department personnel

### Core Functionality

1. User authenticates with Google (OAuth 2.0)
2. User selects video files using Google Picker
3. Extension downloads selected videos from Drive
4. Extension uploads videos to user's YouTube channel
5. Optionally organizes videos into playlists

---

## Use Case Explanation

### The Problem We Solve

Gymnastics teams record multiple competition routines and need to share them via RoadToNationals.com. The manual process involves:
1. Download videos from Drive to local computer
2. Upload each video to YouTube individually
3. Copy-paste titles and descriptions
4. Organize into playlists

This is time-consuming and error-prone for teams with dozens of videos.

### Our Solution

This extension automates the upload process while keeping users in complete control:
- Users select exactly which videos to upload (via Google Picker)
- Extension handles the Drive-to-YouTube transfer
- Batch processing saves hours of manual work
- No broad access to user's Drive required

### Why OAuth Is Necessary

- **Drive Access**: To download user-selected video files
- **YouTube Access**: To upload videos to user's channel

Without OAuth, users would need to manually download/re-upload each file.

---

## Why drive.file Scope Is Sufficient

### We Do NOT Need drive.readonly

The broader `drive.readonly` scope would allow our extension to:
- List all files and folders in a user's Drive
- Read metadata of every file
- Access shared files and folders

**We don't need any of this.**

### drive.file Is Perfect For Our Use Case

The `drive.file` scope, combined with Google Picker, provides exactly what we need:

| Requirement | How drive.file + Picker Meets It |
|-------------|----------------------------------|
| Access video files | ✅ Picker grants access to selected files |
| User chooses files | ✅ Picker UI gives user full control |
| Download video content | ✅ Access token valid for selected files |
| Respect privacy | ✅ No access to unselected files |

### Technical Implementation

```
User Flow:
┌─────────────────────────────────────────────────────────────┐
│  1. User clicks "Select Videos"                             │
│                    ↓                                        │
│  2. Google Picker opens (Google's UI, not ours)            │
│                    ↓                                        │
│  3. User navigates their Drive and selects videos          │
│                    ↓                                        │
│  4. Picker returns file IDs + grants access via drive.file │
│                    ↓                                        │
│  5. Extension can now access ONLY those specific files     │
│                    ↓                                        │
│  6. Videos downloaded and uploaded to YouTube              │
└─────────────────────────────────────────────────────────────┘
```

### What We Cannot Do With drive.file

- ❌ Cannot list files in user's Drive
- ❌ Cannot browse folder contents
- ❌ Cannot see file names until user selects them
- ❌ Cannot access files user didn't explicitly choose
- ❌ Cannot access files shared with user (unless selected)

This is **by design** - we intentionally chose the most restrictive scope that meets our needs.

---

## User Consent Flow

### Step-by-Step User Experience

#### Step 1: Initial Authentication

When user first uses the extension:
1. User clicks "Sign In with Google"
2. Chrome's identity API opens Google's OAuth consent screen
3. User sees requested permissions:
   - "See and download files you select from Google Drive"
   - "Manage your YouTube videos"
4. User clicks "Allow" to grant access

#### Step 2: File Selection (Every Use)

Each time user wants to upload:
1. User clicks "Select Videos from Drive"
2. Google Picker opens in a popup window
3. User browses THEIR OWN Drive (we don't see this)
4. User selects one or more video files
5. User clicks "Select" to confirm
6. Extension receives access to ONLY those files

#### Step 3: Upload Confirmation

Before uploading:
1. Extension shows list of selected videos
2. User can remove videos from selection
3. User confirms upload destination (their YouTube channel)
4. User initiates upload

### User Control Points

Users maintain control at every step:
- **Before OAuth**: Can decline to grant permissions
- **File Selection**: Choose exactly which files to share
- **Before Upload**: Review and modify selection
- **After Upload**: Videos appear on THEIR YouTube channel
- **Anytime**: Revoke access via Google Account settings

---

## Data Handling Practices

### Data We Access

| Data | Purpose | Retention |
|------|---------|-----------|
| OAuth tokens | API authentication | Until expiry (~1hr) or sign-out |
| Selected file IDs | Download files | 30 minutes (for retry) |
| File names | Display & YouTube title | Session only |
| Video content | Upload to YouTube | Streamed, not stored |

### Data We Do NOT Collect

- ❌ Personal information
- ❌ Usage analytics
- ❌ File browsing history
- ❌ Drive folder structure
- ❌ Non-selected file information

### Data Sharing

- **YouTube**: Videos are uploaded (this is the explicit purpose)
- **No other parties**: We have no servers, no analytics, no third-party integrations

### Compliance

- GDPR: Minimal data processing, user consent, right to delete
- CCPA: No sale of personal information
- Children's Privacy: Not directed at children under 13

See [PRIVACY.md](./PRIVACY.md) for complete privacy policy.

---

## Screenshots & Demonstrations

### Screenshot 1: OAuth Consent Screen

*Shows the Google OAuth consent dialog with requested permissions*

<!-- INSERT SCREENSHOT: oauth-consent-screen.png -->
```
┌─────────────────────────────────────────────────────────────┐
│                    Sign in with Google                      │
│                                                             │
│  GymACT Road2Nationals Uploader wants to:                  │
│                                                             │
│  ☑ See and download files you select from Google Drive     │
│    (drive.file scope)                                       │
│                                                             │
│  ☑ Manage your YouTube videos                              │
│    (youtube.force-ssl scope)                               │
│                                                             │
│              [Cancel]    [Allow]                           │
└─────────────────────────────────────────────────────────────┘
```
`[Screenshot Placeholder: Actual OAuth consent screen]`

### Screenshot 2: Google Picker File Selection

*Shows Google Picker UI where user selects video files*

<!-- INSERT SCREENSHOT: google-picker-selection.png -->
```
┌─────────────────────────────────────────────────────────────┐
│  Google Picker                                    [X]       │
│─────────────────────────────────────────────────────────────│
│  My Drive > Competition Videos                              │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ 🎬       │ │ 🎬       │ │ 🎬       │ │ 🎬       │      │
│  │routine1  │ │routine2  │ │routine3  │ │routine4  │      │
│  │.mp4    ☑ │ │.mp4    ☑ │ │.mp4    ☐ │ │.mp4    ☐ │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│  2 files selected                     [Cancel] [Select]    │
└─────────────────────────────────────────────────────────────┘
```
`[Screenshot Placeholder: Actual Google Picker interface]`

### Screenshot 3: Extension Popup with Selected Videos

*Shows extension UI after files are selected*

<!-- INSERT SCREENSHOT: extension-selected-videos.png -->
```
┌───────────────────────────────────────┐
│  GymACT Road2Nationals Uploader       │
│───────────────────────────────────────│
│  ✓ Signed in as user@email.com       │
│                                       │
│  Selected Videos (2):                 │
│  ├─ routine1.mp4                      │
│  └─ routine2.mp4                      │
│                                       │
│  [Select Different Videos]            │
│                                       │
│  Upload Settings:                     │
│  ☑ Create playlist: "Competition"    │
│                                       │
│  [Upload to YouTube]                  │
└───────────────────────────────────────┘
```
`[Screenshot Placeholder: Actual extension popup]`

### Screenshot 4: Upload Progress

*Shows upload progress indicator*

<!-- INSERT SCREENSHOT: upload-progress.png -->
```
┌───────────────────────────────────────┐
│  Uploading to YouTube...              │
│───────────────────────────────────────│
│  routine1.mp4                         │
│  [████████████████░░░░] 75%          │
│                                       │
│  routine2.mp4                         │
│  [░░░░░░░░░░░░░░░░░░░░] Waiting...   │
│                                       │
│  Uploaded: 0/2                        │
└───────────────────────────────────────┘
```
`[Screenshot Placeholder: Actual upload progress]`

### Video Demonstration

A screen recording demonstrating the complete flow is available at:
`[Link Placeholder: Screen recording of complete user flow]`

---

## Security Implementation

### Chrome Extension Security (Manifest V3)

```json
{
  "manifest_version": 3,
  "permissions": ["identity", "storage"],
  "host_permissions": [
    "https://www.googleapis.com/*",
    "https://apis.google.com/*"
  ]
}
```

- **Manifest V3**: Latest security model with stricter CSP
- **Minimal Permissions**: Only what's necessary
- **No Remote Code**: All code bundled in extension

### OAuth Security

- **Token Storage**: Chrome's secure `chrome.storage.local`
- **Token Expiry**: Tokens expire and are refreshed automatically
- **HTTPS Only**: All API calls over encrypted connections
- **No Token Logging**: Tokens never written to console or files

### Data Security

- **No Backend**: Extension runs entirely in browser
- **Streaming**: Videos streamed, not stored locally
- **Memory Only**: Sensitive data kept in memory, not persisted

---

## Verification Checklist

### For Google OAuth Verification Team

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Justified scope usage | ✅ | drive.file is minimum needed |
| User consent flow | ✅ | Google Picker gives explicit control |
| Privacy policy | ✅ | PRIVACY.md included |
| Data handling explained | ✅ | This document |
| Security measures | ✅ | Manifest V3, HTTPS, secure storage |
| No sensitive scope abuse | ✅ | Cannot access unselected files |
| Legitimate use case | ✅ | Gymnastics video upload automation |

### Scope Justification Summary

| Scope | Justification |
|-------|---------------|
| `drive.file` | Download videos user selects via Picker (minimum access) |
| `youtube.force-ssl` | Upload videos to user's YouTube channel (core feature) |

### Why We Don't Need Broader Scopes

| Broader Scope | Why We Don't Need It |
|---------------|---------------------|
| `drive.readonly` | We don't need to list/browse files |
| `drive` | We don't need to modify Drive files |
| `youtube` | We only upload, don't manage existing videos |

---

## Contact Information

**Developer**: Victor JB
**Email**: victorjb2015@gmail.com
**GitHub**: https://github.com/Victor-JB/Road-To-Nationals-Media-Upload-Automation-Extension

For verification questions or additional information, please contact via email.

---

*Document prepared: February 15, 2026*
*Extension Version: 1.9.0*
