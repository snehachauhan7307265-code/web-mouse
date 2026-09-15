# WebMouse V1 — Your Phone • Your Mouse

Turn an Android or iPhone smartphone into a wireless mouse, touchpad, and keyboard for a Windows computer over local Wi-Fi.

This controls the **REAL Windows cursor** on your PC using native OS mouse and keyboard input APIs via PyAutoGUI.

---

## System Architecture

```text
Phone (Android Chrome / iPhone Safari)
         ↓
  Vercel WebMouse Frontend (https://your-webmouse.vercel.app)
         ↓ Wi-Fi Local Network (WebSocket: ws://<WINDOWS_IP>:8765)
  Windows WebMouse Helper (webmouse_server.py)
         ↓ Native OS APIs (PyAutoGUI)
  REAL Windows Cursor & Keyboard
```

> **Important Architecture Notes:**
> - **Vercel hosts ONLY the WebMouse frontend** (static React/Vite single-page application).
> - **The Python helper runs locally** on your Windows computer. It does NOT run on Vercel.
> - **Zero fake browser cursors:** All mouse movements and clicks stream directly to Windows OS APIs.

---

## Deploy WebMouse to Vercel

Follow these beginner-friendly steps to deploy the WebMouse frontend to Vercel in less than 2 minutes:

### Method 1: Deploy with GitHub & Vercel Dashboard (Recommended)

1. **Push your code to GitHub**
   - Create a new repository on [GitHub](https://github.com/new).
   - Push this project to your repository:
     ```bash
     git init
     git add .
     git commit -m "Initial WebMouse deployment"
     git branch -M main
     git remote add origin https://github.com/<YOUR_USERNAME>/<REPO_NAME>.git
     git push -u origin main
     ```

2. **Import to Vercel**
   - Go to [Vercel](https://vercel.com) and log in.
   - Click **"Add New..."** &rarr; **"Project"**.
   - Select your GitHub repository from the list and click **"Import"**.

3. **Configure Project Settings**
   - **Framework Preset:** Vite (detected automatically).
   - **Root Directory:** `./` (default).
   - **Build Command:** `npm run build` (detected automatically).
   - **Output Directory:** `dist` (detected automatically).
   - **Environment Variables (Optional):**
     - You can optionally set `VITE_WEBSOCKET_URL` (e.g. `ws://192.168.1.5:8765`) if you want a pre-filled default IP. Otherwise, you can always enter your PC's IP directly in the web app UI.

4. **Click "Deploy"**
   - Vercel will build and deploy your frontend in ~30 seconds.
   - You will get a live URL such as `https://webmouse.vercel.app`.

---

### Method 2: Deploy with Vercel CLI

If you have the Vercel CLI installed:

```bash
# 1. Install Vercel CLI (if not already installed)
npm install -g vercel

# 2. Deploy
vercel

# 3. For production release:
vercel --prod
```

---

## Connecting from Vercel (HTTPS) to Local Windows PC

When your frontend is hosted on Vercel (`https://...`), mobile browsers enforce security restrictions between an HTTPS website and an unencrypted local IP address (`ws://192.168.x.x:8765`).

Here is how to ensure smooth connectivity on your phone:

### On Android (Chrome)
1. Open your Vercel URL (e.g., `https://webmouse.vercel.app`).
2. Tap the **tune / settings icon** (or lock icon) on the left side of the address bar.
3. Tap **"Site settings"**.
4. Scroll down to **"Insecure content"** and change it from *Block* to **"Allow"**.
5. Return to the tab and connect to your PC's IP address.

### On iPhone (Safari)
1. Open your Vercel URL in Safari.
2. Tap the **Share** button (box with an arrow pointing up).
3. Tap **"Add to Home Screen"**.
4. Open the WebMouse app from your Home Screen (running in standalone app mode).

---

## Windows Helper Setup (Run on Your Windows PC)

The Windows helper is located in the `windows-helper/` directory.

### 1. Install Python
- Download and install Python 3.8+ from [python.org](https://www.python.org/downloads/).
- **Crucial:** Make sure to check the box **"Add Python to PATH"** during installation.

### 2. Open Command Prompt
- Press `Win + R`, type `cmd`, and press Enter.

### 3. Install Dependencies
```cmd
cd windows-helper
pip install -r requirements.txt
```

### 4. Start the Helper Server
```cmd
python webmouse_server.py
```

### 5. Check the Displayed Details
The terminal will display your computer's local Wi-Fi IP and a 6-digit pairing code:
```text
================================================
                  WEBMOUSE V1
    Phone -> Computer control over Wi-Fi
================================================
Status:       Running
Computer IP:  192.168.1.15
Port:         8765
Pairing Code: 483921
================================================
```

### 6. Connect from Your Phone
1. Open your deployed WebMouse URL on your phone.
2. Ensure both your phone and PC are connected to the **same Wi-Fi** network.
3. Tap **Connect** in WebMouse.
4. Enter the **Computer IP** and **6-digit pairing code** from the terminal.
5. Tap **Connect & Pair**.
6. The status badge will turn green (**Connected**) and show live millisecond latency.

---

## Windows Firewall Permission

When running `webmouse_server.py` for the first time:
- Windows Defender Firewall might show a popup:
  *"Windows Defender Firewall has blocked some features of this app"*.
- **Check the box**: *"Private networks, such as my home or work network"*.
- **Click**: *"Allow access"*.

If you cannot connect:
1. Open Start menu &rarr; search for **Allow an app through Windows Firewall**.
2. Click **Change settings**.
3. Find **Python** in the list and check both **Private** and **Public**.
4. Click **OK**.

---

## Touchpad Gestures Reference

| Action | Mobile Gesture |
| :--- | :--- |
| **Move Cursor** | Drag one finger across the touchpad area |
| **Left Click** | Tap with one finger |
| **Right Click** | Tap with two fingers simultaneously |
| **Vertical Scroll** | Swipe up or down with two fingers |
| **Drag and Drop** | Long press (hold finger down for >250ms), then drag |
| **Text Typing** | Switch to the Keyboard tab and type or use shortcuts |

---

## Local Development

```bash
# Install dependencies
npm install

# Run Vite development server
npm run dev

# Run TypeScript type check
npm run lint

# Build for production
npm run build

# Preview production build locally
npm run preview
```
