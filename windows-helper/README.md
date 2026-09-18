# WebMouse V1 — Windows Background Application

Turns any smartphone (iPhone or Android) into a low-latency wireless mouse, trackpad, and keyboard for your Windows laptop over local Wi-Fi.

Controls the **REAL Windows cursor** using PyAutoGUI.

---

## ⚡ Zero-CMD One-Scan Experience

With WebMouse V1, **no manual terminal commands are needed** during normal daily usage.

### 1. One-Click Setup (Run Once)
- Double-click `install_webmouse.bat`.
- That's it! It automatically:
  1. Installs necessary Python packages (`pyautogui`, `websockets`, `pystray`, `pillow`, `qrcode`, `pyperclip`).
  2. Configures Windows Firewall for local network access (port 8765).
  3. Registers WebMouse in Windows Startup so it starts silently in the background on every boot.
  4. Places a **WebMouse** shortcut on your Desktop.
  5. Launches WebMouse immediately in the background with **NO CMD window**.

---

## 🖱️ How to Use

### On your Laptop:
1. WebMouse runs silently in your **Windows System Tray** (look for the mouse icon next to the Windows clock in the bottom-right corner).
2. Right-click the WebMouse tray icon:
   - **📷 Show QR** — Pops up the native dark-themed pairing window with a big QR code, laptop IP, and live countdown timer.
   - **🌐 Open WebMouse** — Opens the WebMouse desktop dashboard in your default browser (`http://localhost:8765/`).
   - **📊 Connection Status** — Shows current connected phones, LAN IP, and server port.
   - **🔄 Restart Helper** — Restarts the helper process.
   - **🛑 Stop Helper** — Stops the helper.
   - **⚙️ Start with Windows** — Toggle whether WebMouse boots automatically with Windows.
   - **❌ Quit** — Closes the tray icon and exits.

### On your Phone:
1. Open your phone camera or the WebMouse app.
2. Scan the QR code displayed on your laptop screen.
3. Your phone automatically connects!
4. Status turns **🟢 Connected** and your phone switches directly to the trackpad.
5. Move your thumb — your laptop's **actual Windows cursor moves in real time!**

### Subsequent Connections:
- Just open WebMouse on your phone.
- It remembers your laptop via its secure trusted token and connects automatically with **zero typing** and **no QR needed**!

---

## 📦 Files in this Directory

| File | Description |
|------|-------------|
| `install_webmouse.bat` | One-click setup: installs dependencies, firewall rule, autostart registry, and starts helper silently. |
| `WebMouse.vbs` | Silent VBS launcher that runs the helper in the background with ZERO console window. |
| `uninstall_webmouse.bat` | Removes the Windows startup registry entry, stops running helper processes, and cleans up rules. |
| `build_exe.bat` | Compiles `webmouse_server.py` into a single standalone `dist/WebMouseHelper.exe` using PyInstaller. |
| `webmouse_server.py` | Core Python helper: WebSocket + HTTP server on port 8765, PyAutoGUI mouse/keyboard control, system tray, and static web serving. |
| `requirements.txt` | Python packages required. |
| `web_dist/` | Bundled WebMouse frontend static web application served directly by `webmouse_server.py` on `http://localhost:8765/`. |

---

## 🛡️ Security & Privacy
- **Local Wi-Fi Only:** All communication stays on your local wireless network (`0.0.0.0:8765`). No external cloud relay or telemetry.
- **One-Time Expiring QR Tokens:** QR codes contain temporary 60-second tokens that expire immediately upon use.
- **Trusted Device Tokens:** Once paired, phones receive a unique 256-bit cryptographically secure token stored in your user profile for seamless, passwordless re-connection.
