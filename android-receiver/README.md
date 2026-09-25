# WebMouse V2 — Native Android TV & Smart Board Receiver Architecture

This module specifies the native Android application architecture for **WebMouse V2 Receiver** running on **Android TV** (Leanback) and **Android Smart Boards** (Interactive Flat Panels).

---

## 1. System Architecture Overview

```
                      +-----------------------------+
                      |   WebMouse Controller       |
                      |   (Phone / Tablet Browser)  |
                      +--------------+--------------+
                                     |
               Local Wi-Fi Network   |  WebSocket (ws://:8765)
               Zero-Config QR / PIN  |  WebRTC DataChannel
                                     v
                 +-----------------------------------+
                 |   WebMouse Android TV Receiver    |
                 |      (Native Kotlin / Compose)    |
                 +-----------------+-----------------+
                                   |
           +-----------------------+-----------------------+
           |                                               |
           v                                               v
+------------------------+                     +------------------------+
|      Android TV        |                     |   Android Smart Board  |
|  - D-Pad Key Injection |                     |  - Whiteboard Touch    |
|  - MediaSession Remote |                     |  - Presentation Slides |
|  - 10-Foot Leanback UI |                     |  - Controlled Storage  |
+------------------------+                     +------------------------+
```

---

## 2. Command Protocol & KeyEvent Mapping

When the WebMouse phone controller sends a command, the Android receiver validates the pairing token and dispatches native Android KeyEvents or MediaSession actions:

| WebMouse Protocol Command | Target Action | Android TV Native Implementation |
|---|---|---|
| `receiver_navigation` (`up`) | D-Pad Up | `KeyEvent(ACTION_DOWN, KEYCODE_DPAD_UP)` |
| `receiver_navigation` (`down`) | D-Pad Down | `KeyEvent(ACTION_DOWN, KEYCODE_DPAD_DOWN)` |
| `receiver_navigation` (`left`) | D-Pad Left | `KeyEvent(ACTION_DOWN, KEYCODE_DPAD_LEFT)` |
| `receiver_navigation` (`right`) | D-Pad Right | `KeyEvent(ACTION_DOWN, KEYCODE_DPAD_RIGHT)` |
| `receiver_select` | OK / Enter | `KeyEvent(ACTION_DOWN, KEYCODE_DPAD_CENTER)` |
| `receiver_back` | Back Button | `KeyEvent(ACTION_DOWN, KEYCODE_BACK)` |
| `receiver_home` | Home Launcher | `Intent(Intent.ACTION_MAIN).addCategory(CATEGORY_HOME)` |
| `receiver_volume` (`increase`) | Volume + | `AudioManager.adjustVolume(ADJUST_RAISE, FLAG_SHOW_UI)` |
| `receiver_volume` (`decrease`) | Volume - | `AudioManager.adjustVolume(ADJUST_LOWER, FLAG_SHOW_UI)` |
| `receiver_volume` (`mute`) | Mute Toggle | `AudioManager.adjustVolume(ADJUST_TOGGLE_MUTE, FLAG_SHOW_UI)` |
| `receiver_media` (`playpause`)| Media Toggle | `KeyEvent(ACTION_DOWN, KEYCODE_MEDIA_PLAY_PAUSE)` |
| `share_link` (`url`) | Open Link | `Intent(Intent.ACTION_VIEW, Uri.parse(url))` |
| `file_transfer_*` | Save to Storage | `context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)` |

---

## 3. Pairing & Security Flow

1. **Local Discovery & QR Announcement**:
   - The Receiver generates a dynamic 6-digit cryptographic PIN and a 256-bit token.
   - It exposes the configuration over local mDNS / SSDP and renders a high-contrast QR code for the phone camera.
2. **Handshake Verification**:
   - The phone controller initiates an `auth` message:
     ```json
     {
       "type": "auth",
       "code": "482910",
       "token": "recv_sec_...",
       "deviceName": "Sneha Phone"
     }
     ```
   - If the PIN matches, the Receiver responds with:
     ```json
     {
       "type": "auth_result",
       "success": true,
       "deviceType": "android_tv",
       "computerName": "Living Room TV",
       "token": "recv_sec_permanent_token...",
       "capabilities": ["remote_control", "media", "presentation", "file_receiver", "screen_receiver", "quick_share"]
     }
     ```
   - Unauthorized commands without a valid session token are dropped immediately.

---

## 4. File Safety & Storage Sandbox

- Files received from the controller are sandboxed inside the app's private external storage directory (`Android/data/com.webmouse.receiver/files/Downloads`).
- Filenames are sanitized against path traversal (`../`, `\`, `:`).
- No arbitrary executable execution is permitted without explicit user confirmation.
