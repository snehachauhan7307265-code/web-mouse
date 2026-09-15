# WebMouse V1 — Windows Local Helper

Real Windows mouse cursor and keyboard remote control helper over local Wi-Fi.

---

## Very Simple Windows Instructions

1. **Install Python**
   - Download and install Python 3.8+ from [python.org](https://www.python.org/downloads/).
   - *Important:* Check the box **"Add Python to PATH"** during installation.

2. **Open Command Prompt**
   - Press `Win + R`, type `cmd`, and press Enter.

3. **Go to windows-helper folder**
   ```cmd
   cd windows-helper
   ```

4. **Run:**
   ```cmd
   pip install -r requirements.txt
   ```

5. **Run:**
   ```cmd
   python webmouse_server.py
   ```

6. **Find the displayed IP address**
   - The terminal will display:
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

7. **Open WebMouse on the phone**
   - In Safari (iPhone) or Chrome (Android), open the WebMouse web app.
   - Make sure your phone is on the **same Wi-Fi network** as your Windows PC.

8. **Enter the IP and pairing code**
   - Enter Computer IP: `192.168.1.15` (from step 6)
   - Enter Pairing Code: `483921` (from step 6)

9. **Press Connect**
   - The status changes to **CONNECTED**.

10. **Test the touchpad**
    - Drag your finger on the mobile touchpad area.
    - Your **actual Windows cursor** moves in real-time!
    - Tap to left click.
    - Two-finger tap to right click.
    - Two-finger swipe to scroll.
    - Hold to drag.

---

## Windows Firewall Permission (Important)

When running `webmouse_server.py` for the first time:
- Windows Defender Firewall might show a popup:
  *"Windows Defender Firewall has blocked some features of this app"*.
- **Check the box**: *"Private networks, such as my home or work network"*.
- **Click**: *"Allow access"*.

If you can't connect:
1. Open Start menu -> search for **Allow an app through Windows Firewall**.
2. Click **Change settings**.
3. Find **Python** in the list and check both **Private** and **Public**.
4. Click **OK**.

---

## Terminal Logs
When connected and moving, the helper prints live status in Command Prompt:
```text
CONNECTED: Client from 192.168.1.42:54210
AUTHENTICATED: 'Mobile Phone' from 192.168.1.42:54210 paired successfully.
MOUSE MOVE: dx=12.0, dy=-6.0
LEFT CLICK
RIGHT CLICK
SCROLL: amount=15
DRAG START (mouse_down: left)
DRAG END (mouse_up: left)
DISCONNECTED: Mobile Phone (192.168.1.42:54210)
```
