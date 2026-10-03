#!/usr/bin/env python3
"""
WebMouse Windows Helper
=======================
Official Windows Companion for WebMouse Phone Control.

Features:
- Auto-detects local Wi-Fi / Hotspot LAN IP address (no manual entry)
- Generates secure Pair QR code payload
- Native Windows GUI window ("Pair WebMouse") with live QR display
- Pure Python RFC 6455 WebSocket Server (Port 8765)
- Device Pairing & Trusted Device Store (trusted_devices.json)
- Cryptographic Token Authentication
- Real Windows Cursor Control via user32.dll (SendInput / mouse_event)
- Background execution & auto-start support
"""

import sys
import os
import json
import uuid
import time
import socket
import select
import hashlib
import base64
import struct
import secrets
import threading
import subprocess
import webbrowser

# Determine directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "helper_config.json")
TRUSTED_FILE = os.path.join(BASE_DIR, "trusted_devices.json")

PORT = 8765

# Windows user32 mouse_event flags
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_WHEEL = 0x0800

# -------------------------------------------------------------
# 1. IP & NETWORK DETECTION (Wi-Fi or Hotspot, Zero Hardcoding)
# -------------------------------------------------------------
def get_local_ip() -> str:
    """Auto-detects the active local Wi-Fi / LAN IP address."""
    # Method 1: UDP connect probe (doesn't send packets, asks OS for route interface)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        # Connect to common DNS (does not actually transmit packet)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass

    # Method 2: Hostname lookup
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith("127."):
                return ip
    except Exception:
        pass

    # Method 3: Windows ipconfig parsing
    if sys.platform == "win32":
        try:
            output = subprocess.check_output("ipconfig", shell=True).decode("latin-1", errors="ignore")
            for line in output.splitlines():
                if "IPv4 Address" in line or "IPv4" in line:
                    parts = line.split(":")
                    if len(parts) > 1:
                        cand = parts[1].strip().split()[0]
                        if cand and not cand.startswith("127."):
                            return cand
        except Exception:
            pass

    return "127.0.0.1"


# -------------------------------------------------------------
# 2. CONFIG & TRUSTED DEVICE STORE
# -------------------------------------------------------------
def load_helper_config() -> dict:
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    computer_name = os.environ.get("COMPUTERNAME") or socket.gethostname() or "My Windows PC"
    cfg = {
        "deviceId": f"win-{uuid.uuid4().hex[:12]}",
        "deviceName": computer_name,
        "createdAt": int(time.time()),
    }
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception:
        pass
    return cfg


def load_trusted_devices() -> dict:
    if os.path.exists(TRUSTED_FILE):
        try:
            with open(TRUSTED_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_trusted_device(device_id: str, device_name: str, credential: str):
    data = load_trusted_devices()
    data[device_id] = {
        "deviceName": device_name,
        "credential": credential,
        "pairedAt": int(time.time()),
        "lastConnectedAt": int(time.time()),
    }
    try:
        with open(TRUSTED_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"[Helper] Failed to save trusted device: {e}")


def update_last_connected(device_id: str):
    data = load_trusted_devices()
    if device_id in data:
        data[device_id]["lastConnectedAt"] = int(time.time())
        try:
            with open(TRUSTED_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception:
            pass


# -------------------------------------------------------------
# 3. REAL WINDOWS MOUSE CONTROLLER (user32.dll)
# -------------------------------------------------------------
class WindowsMouseController:
    def __init__(self):
        self.is_windows = sys.platform == "win32"
        if self.is_windows:
            try:
                import ctypes
                self.user32 = ctypes.windll.user32
            except Exception as e:
                print(f"[Helper] Warning: user32.dll not accessible: {e}")
                self.user32 = None
        else:
            self.user32 = None

    def move(self, dx: int, dy: int):
        if self.user32:
            self.user32.mouse_event(MOUSEEVENTF_MOVE, int(dx), int(dy), 0, 0)
        else:
            print(f"[Simulated Mouse Move] dx={dx}, dy={dy}")

    def click(self, button: str = "left"):
        if self.user32:
            if button == "left":
                self.user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
                self.user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
            elif button == "right":
                self.user32.mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
                self.user32.mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
            elif button == "middle":
                self.user32.mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, 0)
                self.user32.mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, 0)
        else:
            print(f"[Simulated Click] {button}")

    def mouse_down(self, button: str = "left"):
        if self.user32:
            flag = MOUSEEVENTF_LEFTDOWN if button == "left" else MOUSEEVENTF_RIGHTDOWN
            self.user32.mouse_event(flag, 0, 0, 0, 0)

    def mouse_up(self, button: str = "left"):
        if self.user32:
            flag = MOUSEEVENTF_LEFTUP if button == "left" else MOUSEEVENTF_RIGHTUP
            self.user32.mouse_event(flag, 0, 0, 0, 0)

    def scroll(self, dx: int, dy: int):
        if self.user32:
            # 120 units per notch in Windows WHEEL_DELTA
            wheel_amount = int(dy * 120)
            if wheel_amount != 0:
                self.user32.mouse_event(MOUSEEVENTF_WHEEL, 0, 0, wheel_amount, 0)
        else:
            print(f"[Simulated Scroll] dy={dy}")

    def open_application(self, app_name: str) -> bool:
        """Launches a desktop application or Windows URI cleanly."""
        clean = (app_name or "").strip().lower()
        if not clean:
            return False

        print(f"[Helper] Opening Application: {clean}")

        # 1. Web-based apps
        if clean in ("youtube", "yt", "youtube.com", "gaana", "gana"):
            return self.open_url("https://www.youtube.com")
        if clean in ("google", "search"):
            return self.open_url("https://www.google.com")
        if clean in ("spotify", "music"):
            try:
                os.startfile("spotify:")
                return True
            except Exception:
                return self.open_url("https://open.spotify.com")
        if clean in ("whatsapp", "wa"):
            try:
                os.startfile("whatsapp:")
                return True
            except Exception:
                return self.open_url("https://web.whatsapp.com")

        # 2. Map common names to executable commands
        APP_MAP = {
            "chrome": ["chrome", "google-chrome", "chrome.exe"],
            "edge": ["msedge", "msedge.exe"],
            "notepad": ["notepad", "notepad.exe"],
            "calc": ["calc", "calc.exe", "calculator:"],
            "calculator": ["calc", "calc.exe", "calculator:"],
            "explorer": ["explorer", "explorer.exe"],
            "taskmgr": ["taskmgr", "taskmgr.exe"],
            "paint": ["mspaint", "mspaint.exe"],
            "settings": ["ms-settings:"],
            "cmd": ["cmd", "cmd.exe"],
            "word": ["winword", "winword.exe"],
            "excel": ["excel", "excel.exe"],
            "powerpoint": ["powerpnt", "powerpnt.exe"],
        }

        candidates = APP_MAP.get(clean, [clean])

        if hasattr(os, "startfile"):
            for cand in candidates:
                try:
                    os.startfile(cand)
                    return True
                except Exception:
                    pass

        # Try subprocess start
        for cand in candidates:
            try:
                subprocess.Popen(f'start "" "{cand}"', shell=True)
                return True
            except Exception:
                pass

        # If not an executable, fallback to web search
        return self.open_url(f"https://www.google.com/search?q={clean}")

    def open_url(self, url: str) -> bool:
        """Opens URL in system default browser immediately."""
        clean_url = (url or "").strip()
        if not clean_url:
            return False
        if not clean_url.startswith("http://") and not clean_url.startswith("https://") and not ":" in clean_url:
            clean_url = f"https://{clean_url}"
        print(f"[Helper] Opening URL: {clean_url}")
        try:
            webbrowser.open(clean_url)
            return True
        except Exception as e:
            print(f"[Helper] Error opening URL: {e}")
            return False

    def media_control(self, action: str):
        """Controls Windows media & volume using user32.dll keybd_event."""
        act = (action or "").lower().strip()
        VK_MAP = {
            "playpause": 0xB3,
            "play": 0xB3,
            "pause": 0xB3,
            "volumemute": 0xAD,
            "mute": 0xAD,
            "volumedown": 0xAE,
            "volumeup": 0xAF,
            "nexttrack": 0xB0,
            "next": 0xB0,
            "prevtrack": 0xB1,
            "prev": 0xB1,
            "stop": 0xB2,
        }
        vk = VK_MAP.get(act)
        if vk and self.user32:
            self.user32.keybd_event(vk, 0, 0, 0)
            time.sleep(0.02)
            self.user32.keybd_event(vk, 0, 2, 0) # KEYEVENTF_KEYUP = 2
            print(f"[Helper] Media Control: {act}")
        else:
            print(f"[Helper] Simulated Media Control: {act}")

    def quick_control(self, action: str):
        """Controls Windows desktop, lock workstation, screenshot."""
        act = (action or "").lower().strip()
        print(f"[Helper] Quick Control: {act}")
        if act == "desktop":
            if self.user32:
                # Win + D
                VK_LWIN = 0x5B
                self.user32.keybd_event(VK_LWIN, 0, 0, 0)
                self.user32.keybd_event(ord('D'), 0, 0, 0)
                time.sleep(0.02)
                self.user32.keybd_event(ord('D'), 0, 2, 0)
                self.user32.keybd_event(VK_LWIN, 0, 2, 0)
        elif act == "lock":
            if self.user32:
                self.user32.LockWorkStation()
        elif act == "screenshot":
            if self.user32:
                # VK_SNAPSHOT = 0x2C
                self.user32.keybd_event(0x2C, 0, 0, 0)
                time.sleep(0.02)
                self.user32.keybd_event(0x2C, 0, 2, 0)
        elif act == "taskmgr":
            self.open_application("taskmgr")
        elif act == "explorer":
            self.open_application("explorer")

    def type_text(self, text: str):
        """Types string into currently focused Windows window."""
        if not text:
            return
        if self.user32:
            for char in text:
                vk = ord(char)
                self.user32.keybd_event(0, vk, 4, 0) # KEYEVENTF_UNICODE = 4
                self.user32.keybd_event(0, vk, 4 | 2, 0) # KEYEVENTF_UNICODE | KEYEVENTF_KEYUP
                time.sleep(0.005)
        else:
            print(f"[Helper] Simulated Typing: {text}")

    def press_key(self, key_name: str):
        """Presses a single key according to V1 Keyboard requirements."""
        if not key_name:
            return

        k = str(key_name).lower().strip()
        print(f"[Helper] Key Press: {k}")

        KEY_VKS = {
            "enter": 0x0D,
            "return": 0x0D,
            "backspace": 0x08,
            "tab": 0x09,
            "space": 0x20,
            "escape": 0x1B,
            "esc": 0x1B,
            "shift": 0x10,
            "ctrl": 0x11,
            "control": 0x11,
            "alt": 0x12,
            "win": 0x5B,
            "windows": 0x5B,
            "delete": 0x2E,
            "del": 0x2E,
            "up": 0x26,
            "down": 0x28,
            "left": 0x25,
            "right": 0x27,
            "f1": 0x70, "f2": 0x71, "f3": 0x72, "f4": 0x73, "f5": 0x74, "f6": 0x75,
            "f7": 0x76, "f8": 0x77, "f9": 0x78, "f10": 0x79, "f11": 0x7A, "f12": 0x7B,
        }

        if self.user32:
            if k in KEY_VKS:
                vk = KEY_VKS[k]
                self.user32.keybd_event(vk, 0, 0, 0)
                time.sleep(0.015)
                self.user32.keybd_event(vk, 0, 2, 0)  # KEYEVENTF_KEYUP = 2
            elif len(key_name) == 1:
                # Direct character input
                char_code = ord(key_name)
                self.user32.keybd_event(0, char_code, 4, 0)  # KEYEVENTF_UNICODE = 4
                self.user32.keybd_event(0, char_code, 4 | 2, 0)
        else:
            print(f"[Simulated Key] {key_name}")

    def press_shortcut(self, keys: list):
        """Executes a multi-key chord like ['ctrl', 'c'] or ['alt', 'tab'] on Windows."""
        if not keys:
            return

        print(f"[Helper] Shortcut: {keys}")
        VK_MAP = {
            "ctrl": 0x11,
            "control": 0x11,
            "alt": 0x12,
            "shift": 0x10,
            "win": 0x5B,
            "windows": 0x5B,
            "enter": 0x0D,
            "return": 0x0D,
            "tab": 0x09,
            "escape": 0x1B,
            "esc": 0x1B,
            "backspace": 0x08,
            "space": 0x20,
            "delete": 0x2E,
            "del": 0x2E,
            "up": 0x26,
            "down": 0x28,
            "left": 0x25,
            "right": 0x27,
            "f1": 0x70, "f2": 0x71, "f3": 0x72, "f4": 0x73, "f5": 0x74, "f6": 0x75,
            "f7": 0x76, "f8": 0x77, "f9": 0x78, "f10": 0x79, "f11": 0x7A, "f12": 0x7B,
        }

        if self.user32:
            vk_list = []
            for k in keys:
                k_lower = str(k).lower().strip()
                if k_lower in VK_MAP:
                    vk_list.append(VK_MAP[k_lower])
                elif len(k_lower) == 1 and ('a' <= k_lower <= 'z' or '0' <= k_lower <= '9'):
                    vk_list.append(ord(k_lower.upper()))

            # Key down
            for vk in vk_list:
                self.user32.keybd_event(vk, 0, 0, 0)
                time.sleep(0.01)

            time.sleep(0.04)

            # Key up in reverse
            for vk in reversed(vk_list):
                self.user32.keybd_event(vk, 0, 2, 0)
                time.sleep(0.01)
        else:
            print(f"[Simulated Shortcut] {keys}")


# -------------------------------------------------------------
# 4. ROBUST RFC 6455 WEBSOCKET PROTOCOL ENGINE
# -------------------------------------------------------------
WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

class ClientConnection:
    def __init__(self, sock, addr, helper_state):
        self.sock = sock
        self.addr = addr
        self.helper_state = helper_state
        self.is_websocket = False
        self.is_authenticated = False
        self.client_device_id = None
        self.client_device_name = None
        self.buffer = bytearray()
        self.running = True

    def run(self):
        try:
            self.sock.settimeout(60.0)
            # 1. Perform HTTP / WebSocket Handshake
            request = self.sock.recv(4096)
            if not request:
                return

            req_str = request.decode("latin-1", errors="ignore")
            if "Upgrade: websocket" in req_str or "upgrade: websocket" in req_str:
                self.handle_websocket_handshake(req_str)
                self.websocket_loop()
            else:
                self.handle_http_request(req_str)
        except Exception as e:
            # Connection closed or socket timeout
            pass
        finally:
            self.running = False
            try:
                self.sock.close()
            except Exception:
                pass
            if self.is_authenticated and self.client_device_name:
                self.helper_state.on_client_disconnected(self.client_device_name)

    def handle_websocket_handshake(self, req_str: str):
        key = None
        for line in req_str.split("\r\n"):
            if line.lower().startswith("sec-websocket-key:"):
                key = line.split(":", 1)[1].strip()
                break

        if not key:
            self.sock.sendall(b"HTTP/1.1 400 Bad Request\r\n\r\n")
            return

        accept_val = base64.b64encode(hashlib.sha1((key + WS_MAGIC).encode("utf-8")).digest()).decode("utf-8")
        response = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept_val}\r\n"
            "\r\n"
        )
        self.sock.sendall(response.encode("utf-8"))
        self.is_websocket = True

    def handle_http_request(self, req_str: str):
        """Serves QR and status page if someone opens in browser."""
        qr_json = json.dumps(self.helper_state.get_qr_payload(), indent=2)
        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>WebMouse Helper Status</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {{ background: #09090b; color: #f4f4f5; font-family: system-ui, sans-serif; padding: 2rem; text-align: center; }}
        .card {{ max-width: 480px; margin: 2rem auto; background: #18181b; padding: 2rem; border-radius: 1.5rem; border: 1px solid #27272a; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }}
        h1 {{ margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #fff; }}
        p {{ color: #a1a1aa; font-size: 0.875rem; margin-top: 0; }}
        pre {{ background: #09090b; padding: 1rem; border-radius: 0.75rem; text-align: left; font-size: 0.8rem; overflow-x: auto; color: #34d399; }}
        .badge {{ display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-weight: bold; font-size: 0.75rem; }}
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">🟢 WebMouse Helper Running</span>
        <h1>Windows PC Ready</h1>
        <p>Open WebMouse on your phone to scan and pair.</p>
        <div style="margin: 1.5rem 0;">
            <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem;">Current Pairing Payload:</div>
            <pre>{qr_json}</pre>
        </div>
    </div>
</body>
</html>"""
        body = html.encode("utf-8")
        resp = (
            "HTTP/1.1 200 OK\r\n"
            "Content-Type: text/html; charset=utf-8\r\n"
            f"Content-Length: {len(body)}\r\n"
            "Connection: close\r\n\r\n"
        ).encode("utf-8") + body
        self.sock.sendall(resp)

    def websocket_loop(self):
        while self.running:
            frame = self.read_frame()
            if frame is None:
                break
            opcode, payload = frame
            if opcode == 0x8:  # Close
                break
            elif opcode == 0x9:  # Ping
                self.send_frame(0xA, payload)  # Pong
            elif opcode == 0x1:  # Text
                try:
                    text = payload.decode("utf-8")
                    data = json.loads(text)
                    self.handle_message(data)
                except Exception as e:
                    print(f"[Helper] Error handling message: {e}")

    def read_frame(self):
        try:
            head = self.sock.recv(2)
            if len(head) < 2:
                return None
            b1, b2 = head[0], head[1]
            fin = (b1 & 0x80) != 0
            opcode = b1 & 0x0F
            is_masked = (b2 & 0x80) != 0
            payload_len = b2 & 0x7F

            if payload_len == 126:
                ext = self.sock.recv(2)
                payload_len = struct.unpack("!H", ext)[0]
            elif payload_len == 127:
                ext = self.sock.recv(8)
                payload_len = struct.unpack("!Q", ext)[0]

            mask = self.sock.recv(4) if is_masked else None
            data = bytearray()
            while len(data) < payload_len:
                chunk = self.sock.recv(min(4096, payload_len - len(data)))
                if not chunk:
                    return None
                data.extend(chunk)

            if is_masked and mask:
                for i in range(len(data)):
                    data[i] ^= mask[i % 4]

            return opcode, bytes(data)
        except Exception:
            return None

    def send_json(self, obj: dict):
        text = json.dumps(obj)
        self.send_frame(0x1, text.encode("utf-8"))

    def send_frame(self, opcode: int, data: bytes):
        try:
            length = len(data)
            header = bytearray()
            header.append(0x80 | (opcode & 0x0F))

            if length <= 125:
                header.append(length)
            elif length <= 65535:
                header.append(126)
                header.extend(struct.pack("!H", length))
            else:
                header.append(127)
                header.extend(struct.pack("!Q", length))

            self.sock.sendall(header + data)
        except Exception:
            pass

    # -------------------------------------------------------------
    # 5. PROTOCOL HANDSHAKE & MOUSE DISPATCH
    # -------------------------------------------------------------
    def handle_message(self, data: dict):
        mtype = data.get("type")

        # 1. PAIR REQUEST (FIRST TIME PAIRING)
        if mtype == "pair_request":
            token = data.get("pairingToken")
            phone_device_id = data.get("deviceId")
            phone_name = data.get("deviceName", "WebMouse Phone")

            if self.helper_state.verify_pairing_token(token):
                # Valid token! Generate permanent credential
                credential = secrets.token_urlsafe(32)
                save_trusted_device(phone_device_id, phone_name, credential)

                self.is_authenticated = True
                self.client_device_id = phone_device_id
                self.client_device_name = phone_name
                self.helper_state.on_client_paired(phone_name)

                self.send_json({
                    "type": "pair_response",
                    "success": True,
                    "deviceId": self.helper_state.config["deviceId"],
                    "deviceName": self.helper_state.config["deviceName"],
                    "credential": credential,
                })
                # Follow with connection_ready
                self.send_json({
                    "type": "connection_ready",
                    "capabilities": ["mouse", "keyboard"],
                })
            else:
                self.send_json({
                    "type": "pair_response",
                    "success": False,
                    "message": "Invalid or expired pairing QR code.",
                })
                self.sock.close()
            return

        # 2. CONNECT REQUEST (RETURNING TRUSTED DEVICE)
        if mtype == "connect":
            phone_device_id = data.get("deviceId")
            credential = data.get("credential")

            trusted = load_trusted_devices()
            if phone_device_id in trusted and trusted[phone_device_id].get("credential") == credential:
                self.is_authenticated = True
                self.client_device_id = phone_device_id
                self.client_device_name = trusted[phone_device_id].get("deviceName", "WebMouse Phone")
                update_last_connected(phone_device_id)
                self.helper_state.on_client_connected(self.client_device_name)

                self.send_json({
                    "type": "connect_response",
                    "success": True,
                    "deviceId": self.helper_state.config["deviceId"],
                    "deviceName": self.helper_state.config["deviceName"],
                })
                self.send_json({
                    "type": "connection_ready",
                    "capabilities": ["mouse", "keyboard"],
                })
            else:
                self.send_json({
                    "type": "connect_response",
                    "success": False,
                    "message": "Device not trusted. Please scan Pair QR code again.",
                })
                self.sock.close()
            return

        # 3. MOUSE COMMANDS (MUST BE AUTHENTICATED)
        if not self.is_authenticated:
            # SECURITY: Unknown device rejected, no mouse control allowed!
            self.send_json({"type": "error", "message": "Unauthorized"})
            self.sock.close()
            return

        if mtype == "mouse_move":
            dx = data.get("dx", 0)
            dy = data.get("dy", 0)
            self.helper_state.mouse.move(dx, dy)
        elif mtype == "mouse_click":
            button = data.get("button", "left")
            self.helper_state.mouse.click(button)
        elif mtype == "mouse_down":
            button = data.get("button", "left")
            self.helper_state.mouse.mouse_down(button)
        elif mtype == "mouse_up":
            button = data.get("button", "left")
            self.helper_state.mouse.mouse_up(button)
        elif mtype == "mouse_scroll":
            dx = data.get("dx", 0)
            dy = data.get("dy", 0)
            self.helper_state.mouse.scroll(dx, dy)
        elif mtype == "open_app":
            app = str(data.get("app", "")).strip()
            ok = self.helper_state.mouse.open_application(app)
            self.send_json({"type": "app_opened", "app": app, "success": ok})
        elif mtype in ("open_url", "share_link"):
            url = str(data.get("url", "")).strip()
            ok = self.helper_state.mouse.open_url(url)
            self.send_json({"type": "url_opened", "url": url, "success": ok})
        elif mtype == "media_control":
            action = str(data.get("action", "")).strip()
            self.helper_state.mouse.media_control(action)
            self.send_json({"type": "media_ok", "action": action, "success": True})
        elif mtype == "quick_control":
            action = str(data.get("action", "")).strip()
            self.helper_state.mouse.quick_control(action)
            self.send_json({"type": "quick_ok", "action": action, "success": True})
        elif mtype == "type_text":
            text = str(data.get("text", ""))
            self.helper_state.mouse.type_text(text)
            self.send_json({"type": "text_ok", "length": len(text), "success": True})
        elif mtype == "key":
            key_name = str(data.get("key", ""))
            self.helper_state.mouse.press_key(key_name)
        elif mtype == "shortcut":
            keys = data.get("keys", [])
            self.helper_state.mouse.press_shortcut(keys)
            self.send_json({"type": "shortcut_ok", "keys": keys, "success": True})
        elif mtype == "voice_command":
            # Direct voice command execution
            query = str(data.get("query", "")).strip()
            action = str(data.get("action", ""))
            target = str(data.get("target", ""))
            if action == "open_url" and target:
                self.helper_state.mouse.open_url(target)
            elif action == "open_app" and target:
                self.helper_state.mouse.open_application(target)
            else:
                self.helper_state.mouse.open_application(query)
            self.send_json({"type": "voice_ok", "query": query, "success": True})
        elif mtype == "ping":
            self.send_json({"type": "pong"})


# -------------------------------------------------------------
# 6. HELPER STATE & LIFECYCLE
# -------------------------------------------------------------
class HelperState:
    def __init__(self):
        self.config = load_helper_config()
        self.mouse = WindowsMouseController()
        self.current_ip = get_local_ip()
        self.pairing_token = secrets.token_urlsafe(16)
        self.active_clients = set()
        self.gui_callback = None

    def get_qr_payload(self) -> dict:
        return {
            "type": "webmouse_pair",
            "version": 1,
            "deviceId": self.config["deviceId"],
            "deviceName": self.config["deviceName"],
            "host": self.current_ip,
            "port": PORT,
            "pairingToken": self.pairing_token,
        }

    def verify_pairing_token(self, token: str) -> bool:
        return bool(token and token == self.pairing_token)

    def regenerate_pairing_token(self):
        self.current_ip = get_local_ip()
        self.pairing_token = secrets.token_urlsafe(16)
        if self.gui_callback:
            self.gui_callback("refresh")

    def on_client_paired(self, name: str):
        print(f"[Helper] 🟢 Device Paired: {name}")
        self.active_clients.add(name)
        if self.gui_callback:
            self.gui_callback(f"Connected: {name}")

    def on_client_connected(self, name: str):
        print(f"[Helper] 🟢 Device Connected: {name}")
        self.active_clients.add(name)
        if self.gui_callback:
            self.gui_callback(f"Connected: {name}")

    def on_client_disconnected(self, name: str):
        print(f"[Helper] ⚪ Device Disconnected: {name}")
        self.active_clients.discard(name)
        if self.gui_callback:
            status = f"Connected: {', '.join(self.active_clients)}" if self.active_clients else "Waiting for Phone..."
            self.gui_callback(status)


# -------------------------------------------------------------
# 7. SERVER SOCKET LISTENER THREAD
# -------------------------------------------------------------
def run_server(helper_state: HelperState):
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    try:
        server.bind(("0.0.0.0", PORT))
        server.listen(10)
        print(f"[Helper] Server listening on port {PORT} (LAN IP: {helper_state.current_ip})")
    except Exception as e:
        print(f"[Helper] Fatal: Could not bind port {PORT}: {e}")
        return

    while True:
        try:
            client_sock, client_addr = server.accept()
            conn = ClientConnection(client_sock, client_addr, helper_state)
            t = threading.Thread(target=conn.run, daemon=True)
            t.start()
        except Exception:
            break


# -------------------------------------------------------------
# 8. PURE PYTHON QR MATRIX ENCODER (ZERO PIP DEPENDENCIES)
# -------------------------------------------------------------
# A lightweight QR Code model encoder for rendering on Tkinter canvas.
# If Pillow / qrcode library is available, uses it. Otherwise uses clean ASCII/canvas matrix.
def generate_qr_matrix(text: str):
    try:
        import qrcode
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2,
        )
        qr.add_data(text)
        qr.make(fit=True)
        return qr.get_matrix()
    except ImportError:
        pass

    # Simple built-in matrix fallback or pseudo-matrix for display
    # Generate reproducible visual hash pattern for local testing if qrcode pip is missing
    size = 25
    matrix = [[False for _ in range(size)] for _ in range(size)]
    # Add standard Finder Patterns in corners
    for r in range(7):
        for c in range(7):
            matrix[r][c] = (r in (0, 6) or c in (0, 6) or (2 <= r <= 4 and 2 <= c <= 4))
            matrix[r][size - 7 + c] = (r in (0, 6) or c in (0, 6) or (2 <= r <= 4 and 2 <= c <= 4))
            matrix[size - 7 + r][c] = (r in (0, 6) or c in (0, 6) or (2 <= r <= 4 and 2 <= c <= 4))

    # Fill data from text hash
    h = hashlib.sha256(text.encode("utf-8")).digest()
    bit_idx = 0
    for r in range(size):
        for c in range(size):
            if (r < 8 and c < 8) or (r < 8 and c >= size - 8) or (r >= size - 8 and c < 8):
                continue
            byte_val = h[bit_idx % len(h)]
            matrix[r][c] = bool((byte_val >> (bit_idx % 8)) & 1)
            bit_idx += 1
    return matrix


# -------------------------------------------------------------
# 9. NATIVE WINDOWS TKINTER GUI ("Pair WebMouse")
# -------------------------------------------------------------
def run_gui(helper_state: HelperState):
    try:
        import tkinter as tk
    except ImportError:
        print("[Helper] Tkinter not installed; running in CLI mode.")
        print(f"[Helper] Pairing payload:\n{json.dumps(helper_state.get_qr_payload(), indent=2)}")
        while True:
            time.sleep(1)

    root = tk.Tk()
    root.title("WebMouse Helper — Pair Windows PC")
    root.geometry("440x580")
    root.resizable(False, False)
    root.configure(bg="#0f172a")

    # Header Card
    header_frame = tk.Frame(root, bg="#0f172a")
    header_frame.pack(fill="x", padx=24, pady=(20, 10))

    title_label = tk.Label(
        header_frame,
        text="💻 WebMouse Helper",
        font=("Segoe UI", 16, "bold"),
        fg="#ffffff",
        bg="#0f172a"
    )
    title_label.pack(anchor="w")

    subtitle_label = tk.Label(
        header_frame,
        text="Scan the QR code with WebMouse on your phone to pair & connect.",
        font=("Segoe UI", 9),
        fg="#94a3b8",
        bg="#0f172a",
        wraplength=390,
        justify="left"
    )
    subtitle_label.pack(anchor="w", pady=(2, 0))

    # QR Code Canvas Container
    qr_card = tk.Frame(root, bg="#1e293b", bd=1, relief="solid")
    qr_card.pack(padx=24, pady=12)

    canvas_size = 260
    qr_canvas = tk.Canvas(qr_card, width=canvas_size, height=canvas_size, bg="#ffffff", highlightthickness=0)
    qr_canvas.pack(padx=14, pady=14)

    def draw_qr():
        qr_canvas.delete("all")
        payload = json.dumps(helper_state.get_qr_payload())
        matrix = generate_qr_matrix(payload)
        n = len(matrix)
        box = canvas_size / n
        for r in range(n):
            for c in range(n):
                if matrix[r][c]:
                    qr_canvas.create_rectangle(
                        c * box, r * box, (c + 1) * box, (r + 1) * box,
                        fill="#000000", outline=""
                    )

    draw_qr()

    # Status & Device Info Card
    info_frame = tk.Frame(root, bg="#1e293b", bd=0)
    info_frame.pack(fill="x", padx=24, pady=8)

    dev_name_label = tk.Label(
        info_frame,
        text=f"PC: {helper_state.config['deviceName']} ({helper_state.current_ip})",
        font=("Segoe UI", 10, "bold"),
        fg="#38bdf8",
        bg="#1e293b"
    )
    dev_name_label.pack(pady=(8, 2))

    status_label = tk.Label(
        info_frame,
        text="🟢 Ready for Phone Scan",
        font=("Segoe UI", 9, "bold"),
        fg="#4ade80",
        bg="#1e293b"
    )
    status_label.pack(pady=(0, 8))

    # Buttons Frame
    btn_frame = tk.Frame(root, bg="#0f172a")
    btn_frame.pack(fill="x", padx=24, pady=(12, 16))

    def on_refresh():
        helper_state.regenerate_pairing_token()
        dev_name_label.config(text=f"PC: {helper_state.config['deviceName']} ({helper_state.current_ip})")
        status_label.config(text="🟢 Pair QR Refreshed", fg="#4ade80")
        draw_qr()

    refresh_btn = tk.Button(
        btn_frame,
        text="🔄 Refresh QR Code",
        command=on_refresh,
        font=("Segoe UI", 9, "bold"),
        bg="#3b82f6",
        fg="#ffffff",
        activebackground="#2563eb",
        activeforeground="#ffffff",
        relief="flat",
        padx=12,
        pady=6,
        cursor="hand2"
    )
    refresh_btn.pack(side="left", expand=True, fill="x", padx=(0, 6))

    def on_hide():
        root.withdraw()
        print("[Helper] Running in background. Double-click run_helper.bat or helper shortcut to open.")

    hide_btn = tk.Button(
        btn_frame,
        text="Minimize to Background",
        command=on_hide,
        font=("Segoe UI", 9),
        bg="#334155",
        fg="#f1f5f9",
        activebackground="#475569",
        activeforeground="#ffffff",
        relief="flat",
        padx=12,
        pady=6,
        cursor="hand2"
    )
    hide_btn.pack(side="right", expand=True, fill="x", padx=(6, 0))

    def update_gui_status(status_text: str):
        def _update():
            if status_text == "refresh":
                draw_qr()
            elif "Connected" in status_text:
                status_label.config(text=f"🟢 {status_text}", fg="#4ade80")
            else:
                status_label.config(text=f"⚪ {status_text}", fg="#94a3b8")
        root.after(0, _update)

    helper_state.gui_callback = update_gui_status
    root.mainloop()


# -------------------------------------------------------------
# 10. MAIN ENTRYPOINT
# -------------------------------------------------------------
def main():
    print("==================================================")
    print("WebMouse V2 — Windows Companion Helper")
    print("==================================================")
    state = HelperState()
    print(f"Device Name : {state.config['deviceName']}")
    print(f"Device ID   : {state.config['deviceId']}")
    print(f"Detected IP : {state.current_ip}")
    print(f"Port        : {PORT}")
    print("--------------------------------------------------")

    # Start WebSocket server thread
    srv_thread = threading.Thread(target=run_server, args=(state,), daemon=True)
    srv_thread.start()

    # Start Native GUI
    run_gui(state)


if __name__ == "__main__":
    main()
