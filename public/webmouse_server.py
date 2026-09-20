#!/usr/bin/env python3
"""
WebMouse V1 — Windows Local Helper Server
=========================================
Turns an Android or iPhone smartphone into a wireless mouse & keyboard
for a Windows computer over the same local Wi-Fi network.

Controls the REAL Windows cursor using PyAutoGUI.
"""

import asyncio
import json
import random
import socket
import sys
import argparse
import os
import base64
import webbrowser
from pathlib import Path
from typing import Set, Dict, Any, Optional

try:
    import pyperclip
except ImportError:
    pyperclip = None
    print("[WARNING] pyperclip not installed. Clipboard sync will be disabled.")

# Auto-install or fallback for websockets
HAS_WEBSOCKETS_PKG = False
try:
    import websockets
    from websockets.server import WebSocketServerProtocol
    HAS_WEBSOCKETS_PKG = True
except ImportError:
    try:
        import subprocess
        print("[*] Checking 'websockets' library...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        import websockets
        from websockets.server import WebSocketServerProtocol
        HAS_WEBSOCKETS_PKG = True
        print("[OK] 'websockets' installed successfully.")
    except Exception:
        HAS_WEBSOCKETS_PKG = False
        print("[INFO] Running in Zero-Dependency Mode (Pure Python RFC 6455 WebSocket Engine active).")

WebSocketServerProtocol = Any

# Windows Virtual Key Code mappings for native user32 input
VK_CODE_MAP = {
    "enter": 0x0D, "return": 0x0D, "backspace": 0x08, "tab": 0x09, "escape": 0x1B, "esc": 0x1B,
    "space": 0x20, "left": 0x25, "up": 0x26, "right": 0x27, "down": 0x28, "delete": 0x2E,
    "shift": 0x10, "ctrl": 0x11, "control": 0x11, "alt": 0x12, "win": 0x5B, "capslock": 0x14,
    "home": 0x24, "end": 0x23, "pageup": 0x21, "pagedown": 0x22, "insert": 0x2D, "printscreen": 0x2C,
    "volumemute": 0xAD, "volumedown": 0xAE, "volumeup": 0xAF, "playpause": 0xB3,
    "f1": 0x70, "f2": 0x71, "f3": 0x72, "f4": 0x73, "f5": 0x74, "f6": 0x75,
    "f7": 0x76, "f8": 0x77, "f9": 0x78, "f10": 0x79, "f11": 0x7A, "f12": 0x7B,
    "a": 0x41, "b": 0x42, "c": 0x43, "d": 0x44, "v": 0x56, "t": 0x54, "w": 0x57,
}

class WindowsNativeInput:
    """Built-in Windows cursor and keyboard controller using ctypes.windll.user32.
    Requires ZERO pip dependencies and works on all Windows systems."""
    def __init__(self):
        import ctypes
        self.user32 = ctypes.windll.user32
        self.PAUSE = 0.0
        self.FAILSAFE = False

    def size(self):
        return (self.user32.GetSystemMetrics(0), self.user32.GetSystemMetrics(1))

    def moveRel(self, dx, dy, _pause=False):
        # MOUSEEVENTF_MOVE = 0x0001
        self.user32.mouse_event(0x0001, int(dx), int(dy), 0, 0)

    def click(self, button="left"):
        if button == "left":
            self.user32.mouse_event(0x0002, 0, 0, 0, 0) # LEFTDOWN
            self.user32.mouse_event(0x0004, 0, 0, 0, 0) # LEFTUP
        elif button == "right":
            self.user32.mouse_event(0x0008, 0, 0, 0, 0) # RIGHTDOWN
            self.user32.mouse_event(0x0010, 0, 0, 0, 0) # RIGHTUP
        elif button == "middle":
            self.user32.mouse_event(0x0020, 0, 0, 0, 0) # MIDDLEDOWN
            self.user32.mouse_event(0x0040, 0, 0, 0, 0) # MIDDLEUP

    def doubleClick(self, button="left"):
        import time
        self.click(button)
        time.sleep(0.05)
        self.click(button)

    def mouseDown(self, button="left"):
        if button == "left":
            self.user32.mouse_event(0x0002, 0, 0, 0, 0)
        elif button == "right":
            self.user32.mouse_event(0x0008, 0, 0, 0, 0)
        elif button == "middle":
            self.user32.mouse_event(0x0020, 0, 0, 0, 0)

    def mouseUp(self, button="left"):
        if button == "left":
            self.user32.mouse_event(0x0004, 0, 0, 0, 0)
        elif button == "right":
            self.user32.mouse_event(0x0010, 0, 0, 0, 0)
        elif button == "middle":
            self.user32.mouse_event(0x0040, 0, 0, 0, 0)

    def scroll(self, amount):
        # MOUSEEVENTF_WHEEL = 0x0800
        self.user32.mouse_event(0x0800, 0, 0, int(amount * 120), 0)

    def hscroll(self, amount):
        # MOUSEEVENTF_HWHEEL = 0x1000
        self.user32.mouse_event(0x1000, 0, 0, int(amount * 120), 0)

    def press(self, key):
        vk = VK_CODE_MAP.get(str(key).lower())
        if vk:
            self.user32.keybd_event(vk, 0, 0, 0)
            self.user32.keybd_event(vk, 0, 2, 0) # KEYEVENTF_KEYUP = 2

    def write(self, text, interval=0.001):
        for char in text:
            code = ord(char)
            # KEYEVENTF_UNICODE = 4, KEYEVENTF_KEYUP = 2
            self.user32.keybd_event(0, code, 4, 0)
            self.user32.keybd_event(0, code, 4 | 2, 0)

    def hotkey(self, *keys):
        vks = [VK_CODE_MAP.get(str(k).lower()) for k in keys if VK_CODE_MAP.get(str(k).lower())]
        for vk in vks:
            self.user32.keybd_event(vk, 0, 0, 0)
        for vk in reversed(vks):
            self.user32.keybd_event(vk, 0, 2, 0)

# Auto-install or fallback for pyautogui
try:
    import pyautogui
    pyautogui.PAUSE = 0.0
    pyautogui.FAILSAFE = False
except ImportError:
    import subprocess
    print("[*] 'pyautogui' not found. Trying automatic pip installation...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyautogui"])
        import pyautogui
        pyautogui.PAUSE = 0.0
        pyautogui.FAILSAFE = False
        print("[OK] 'pyautogui' installed successfully.")
    except Exception as _pya_err:
        print(f"[INFO] Using native Windows user32 controller (zero pip dependencies needed).")
        pyautogui = WindowsNativeInput()


class PurePythonWebSocketClient:
    """Zero-dependency RFC 6455 WebSocket client adapter for standard library asyncio."""
    def __init__(self, reader, writer, client_addr):
        self.reader = reader
        self.writer = writer
        self.remote_address = client_addr
        self.closed = False

    async def send(self, message):
        if self.closed:
            return
        import struct
        payload = message.encode("utf-8") if isinstance(message, str) else message
        length = len(payload)
        opcode = 0x1 if isinstance(message, str) else 0x2
        if length <= 125:
            header = struct.pack("!BB", 0x80 | opcode, length)
        elif length <= 65535:
            header = struct.pack("!BBH", 0x80 | opcode, 126, length)
        else:
            header = struct.pack("!BBQ", 0x80 | opcode, 127, length)
        try:
            self.writer.write(header + payload)
            await self.writer.drain()
        except Exception:
            self.closed = True

    async def close(self):
        self.closed = True
        try:
            self.writer.close()
            await self.writer.wait_closed()
        except Exception:
            pass

    async def __aiter__(self):
        import struct
        while not self.closed:
            try:
                head = await self.reader.readexactly(2)
                b1, b2 = head[0], head[1]
                opcode = b1 & 0x0F
                length = b2 & 0x7F
                is_masked = bool(b2 & 0x80)

                if opcode == 0x8:  # Close
                    self.closed = True
                    break
                elif opcode == 0x9:  # Ping
                    self.writer.write(struct.pack("!BB", 0x8A, 0))
                    await self.writer.drain()
                    continue
                elif opcode == 0xA:  # Pong
                    continue

                if length == 126:
                    len_bytes = await self.reader.readexactly(2)
                    length = struct.unpack("!H", len_bytes)[0]
                elif length == 127:
                    len_bytes = await self.reader.readexactly(8)
                    length = struct.unpack("!Q", len_bytes)[0]

                if is_masked:
                    mask = await self.reader.readexactly(4)
                    raw_data = await self.reader.readexactly(length)
                    payload = bytearray(raw_data)
                    for i in range(length):
                        payload[i] ^= mask[i % 4]
                else:
                    payload = await self.reader.readexactly(length)

                if opcode == 0x1:
                    yield payload.decode("utf-8", errors="ignore")
                elif opcode == 0x2:
                    yield bytes(payload)
            except Exception:
                self.closed = True
                break


class PurePythonWebSocketServer:
    """Zero-dependency asyncio WebSocket & HTTP server for WebMouse."""
    def __init__(self, server: 'WebMouseServer'):
        self.server = server

    async def handle_client(self, reader, writer):
        import hashlib, base64
        client_addr = writer.get_extra_info('peername') or ("127.0.0.1", 0)
        try:
            request_data = b""
            while b"\r\n\r\n" not in request_data:
                chunk = await reader.read(4096)
                if not chunk:
                    writer.close()
                    return
                request_data += chunk
                if len(request_data) > 65536:
                    writer.close()
                    return

            header_part, _ = request_data.split(b"\r\n\r\n", 1)
            lines = header_part.decode('utf-8', errors='ignore').split("\r\n")
            request_line = lines[0] if lines else ""
            parts = request_line.split(" ")
            method = parts[0].upper() if len(parts) > 0 else "GET"
            path = parts[1] if len(parts) > 1 else "/"

            headers = {}
            for line in lines[1:]:
                if ":" in line:
                    k, v = line.split(":", 1)
                    headers[k.strip().lower()] = v.strip()

            if "upgrade" in headers.get("connection", "").lower() and headers.get("upgrade", "").lower() == "websocket":
                sec_key = headers.get("sec-websocket-key", "")
                if not sec_key:
                    writer.close()
                    return
                guid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
                accept_key = base64.b64encode(hashlib.sha1((sec_key + guid).encode()).digest()).decode()
                handshake_resp = (
                    "HTTP/1.1 101 Switching Protocols\r\n"
                    "Upgrade: websocket\r\n"
                    "Connection: Upgrade\r\n"
                    f"Sec-WebSocket-Accept: {accept_key}\r\n\r\n"
                )
                writer.write(handshake_resp.encode())
                await writer.drain()

                ws_client = PurePythonWebSocketClient(reader, writer, client_addr)
                await self.server.handle_connection(ws_client)
            else:
                await self.handle_http(method, path, headers, writer)
        except Exception:
            pass
        finally:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

    async def handle_http(self, method, path, headers, writer):
        current_lan_ip = get_local_ip()
        if method == "OPTIONS":
            resp = (
                "HTTP/1.1 204 No Content\r\n"
                "Access-Control-Allow-Origin: *\r\n"
                "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
                "Access-Control-Allow-Headers: *\r\n"
                "Connection: close\r\n\r\n"
            )
            writer.write(resp.encode())
            await writer.drain()
            return

        import urllib.parse
        parsed = urllib.parse.urlparse(path)
        req_path = parsed.path
        if req_path in ("/api/pairing-info", "/api/info", "/info"):
            import secrets, time
            temp_token = secrets.token_hex(16)
            expires_at = int(time.time() + 60)
            self.server.qr_tokens[temp_token] = expires_at
            qr_payload = {
                "type": "webmouse_pair",
                "version": 1,
                "host": current_lan_ip,
                "port": self.server.port,
                "token": temp_token,
                "expiresAt": expires_at
            }
            data = {
                "type": "host_pairing_info",
                "host": current_lan_ip,
                "ip": current_lan_ip,
                "port": self.server.port,
                "version": 1,
                "token": temp_token,
                "pairingToken": temp_token,
                "code": self.server.pairing_code,
                "expiresAt": expires_at,
                "qrPayload": qr_payload,
                "connectedDevices": len(self.server.authenticated_clients)
            }
            body = json.dumps(data).encode('utf-8')
            resp = (
                "HTTP/1.1 200 OK\r\n"
                "Content-Type: application/json; charset=utf-8\r\n"
                f"Content-Length: {len(body)}\r\n"
                "Access-Control-Allow-Origin: *\r\n"
                "Connection: close\r\n\r\n"
            )
            writer.write(resp.encode() + body)
            await writer.drain()
        else:
            body = b"WebMouse V1 Helper Server Active"
            resp = (
                "HTTP/1.1 200 OK\r\n"
                "Content-Type: text/plain; charset=utf-8\r\n"
                f"Content-Length: {len(body)}\r\n"
                "Access-Control-Allow-Origin: *\r\n"
                "Connection: close\r\n\r\n"
            )
            writer.write(resp.encode() + body)
            await writer.drain()

    async def start(self):
        srv = await asyncio.start_server(self.handle_client, self.server.host, self.server.port)
        print(f"[*] WebMouse Helper is ACTIVE on port {self.server.port} (Zero-Dependency Engine).")
        print("[*] Keep this Command Prompt window OPEN while using WebMouse.\n")
        async with srv:
            await srv.serve_forever()


# Key mapping dictionary from web keys to PyAutoGUI key names
KEY_MAP = {
    "enter": "enter",
    "return": "enter",
    "backspace": "backspace",
    "delete": "delete",
    "tab": "tab",
    "escape": "esc",
    "esc": "esc",
    "space": "space",
    "up": "up",
    "down": "down",
    "left": "left",
    "right": "right",
    "shift": "shift",
    "ctrl": "ctrl",
    "control": "ctrl",
    "alt": "alt",
    "win": "win",
    "windows": "win",
    "meta": "win",
    "super": "win",
    "capslock": "capslock",
    "home": "home",
    "end": "end",
    "pageup": "pageup",
    "pagedown": "pagedown",
    "insert": "insert",
    "prtscr": "printscreen",
    "printscreen": "printscreen",
    "volumemute": "volumemute",
    "volumedown": "volumedown",
    "volumeup": "volumeup",
    "playpause": "playpause",
    "f1": "f1", "f2": "f2", "f3": "f3", "f4": "f4",
    "f5": "f5", "f6": "f6", "f7": "f7", "f8": "f8",
    "f9": "f9", "f10": "f10", "f11": "f11", "f12": "f12",
}


def get_local_ip() -> str:
    """
    Detect the authoritative primary LAN IPv4 address of this Windows computer.
    Prioritizes real private LAN subnets (192.168.x.x, 10.x.x.x, 172.16-31.x.x) and avoids
    virtual adapters (VirtualBox 192.168.56.x, APIPA 169.254.x.x, WSL, Docker, Loopback 127.0.0.1).
    """
    detected_ips = []

    # Strategy 1: Active routing interface via UDP socket connect
    for target in [("8.8.8.8", 80), ("1.1.1.1", 80), ("192.168.1.1", 80), ("10.0.0.1", 80)]:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0.4)
            s.connect(target)
            ip = s.getsockname()[0]
            s.close()
            if ip and not ip.startswith("127.") and not ip.startswith("169.254.") and ip != "0.0.0.0":
                detected_ips.append(ip)
                break
        except Exception:
            pass

    # Strategy 2: Windows ipconfig analysis for active adapter with Default Gateway
    try:
        import subprocess
        creationflags = 0x08000000 if sys.platform == 'win32' else 0 # CREATE_NO_WINDOW
        output = subprocess.run(
            ["ipconfig"],
            capture_output=True,
            text=True,
            timeout=2,
            creationflags=creationflags
        ).stdout

        current_adapter = ""
        adapter_has_gateway = False
        adapter_ip = ""
        is_primary_type = False

        for raw_line in output.splitlines():
            line = raw_line.strip()
            if not raw_line.startswith(" ") and line.endswith(":"):
                if adapter_has_gateway and adapter_ip:
                    if is_primary_type:
                        detected_ips.insert(0, adapter_ip)
                    else:
                        detected_ips.append(adapter_ip)
                current_adapter = line.lower()
                adapter_has_gateway = False
                adapter_ip = ""
                is_primary_type = (
                    ("wi-fi" in current_adapter or "wireless" in current_adapter or "ethernet" in current_adapter or "wlan" in current_adapter)
                    and "virtual" not in current_adapter
                    and "vethernet" not in current_adapter
                    and "docker" not in current_adapter
                    and "bluetooth" not in current_adapter
                )
            elif "ipv4 address" in line.lower() or "ip address" in line.lower():
                parts = line.split(":")
                if len(parts) > 1:
                    candidate = parts[1].replace("(Preferred)", "").strip()
                    if candidate and not candidate.startswith("127.") and not candidate.startswith("169.254."):
                        adapter_ip = candidate
            elif "default gateway" in line.lower():
                parts = line.split(":")
                if len(parts) > 1:
                    gw = parts[1].strip()
                    if gw and gw != "::" and gw != "0.0.0.0":
                        adapter_has_gateway = True

        if adapter_has_gateway and adapter_ip:
            if is_primary_type:
                detected_ips.insert(0, adapter_ip)
            else:
                detected_ips.append(adapter_ip)
    except Exception:
        pass

    # Strategy 3: Inspect socket.gethostbyname_ex
    try:
        hostname = socket.gethostname()
        _, _, ip_list = socket.gethostbyname_ex(hostname)
        for ip in ip_list:
            if ip and not ip.startswith("127.") and not ip.startswith("169.254.") and ip != "0.0.0.0":
                if not ip.startswith("192.168.56."): # Skip VirtualBox host-only
                    detected_ips.append(ip)
    except Exception:
        pass

    # Scoring to select best active LAN IP
    def ip_score(ip: str) -> int:
        if ip.startswith("192.168.") and not ip.startswith("192.168.56."):
            return 100
        if ip.startswith("10."):
            return 90
        if ip.startswith("172."):
            try:
                second = int(ip.split(".")[1])
                if 16 <= second <= 31:
                    return 80
            except Exception:
                pass
        if not ip.startswith("127.") and not ip.startswith("169.254."):
            return 50
        return 0

    valid_ips = [ip for ip in detected_ips if ip_score(ip) > 0]
    if valid_ips:
        # Sort descending by priority score
        valid_ips.sort(key=ip_score, reverse=True)
        primary_lan_ip = valid_ips[0]
        print(f"[DEBUG] detected LAN IP: {primary_lan_ip}")
        return primary_lan_ip

    print("[DEBUG] detected LAN IP: 127.0.0.1 (No active private LAN detected)")
    return "127.0.0.1"


# =====================================================================
# Windows Background Application, System Tray, Startup & Native UI
# =====================================================================

try:
    import winreg
    HAS_WINREG = True
except ImportError:
    HAS_WINREG = False

try:
    import pystray
    from PIL import Image, ImageDraw, ImageTk
    HAS_PYSTRAY = True
except ImportError:
    HAS_PYSTRAY = False

try:
    import qrcode
    HAS_QRCODE = True
except ImportError:
    HAS_QRCODE = False

try:
    import tkinter as tk
    from tkinter import ttk, messagebox
    HAS_TKINTER = True
except ImportError:
    HAS_TKINTER = False


def is_startup_enabled() -> bool:
    """Check if WebMouse Helper is configured to auto-start with Windows in HKCU registry."""
    if not HAS_WINREG or sys.platform != "win32":
        return False
    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            0,
            winreg.KEY_READ
        ) as key:
            val, _ = winreg.QueryValueEx(key, "WebMouseHelper")
            return bool(val)
    except Exception:
        return False


def set_startup_enabled(enabled: bool) -> bool:
    """Enable or disable WebMouse Helper auto-start with Windows via HKCU Run key."""
    if not HAS_WINREG or sys.platform != "win32":
        return False
    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            0,
            winreg.KEY_SET_VALUE
        ) as key:
            if enabled:
                if getattr(sys, 'frozen', False):
                    # PyInstaller compiled executable
                    cmd = f'"{sys.executable}" --background'
                else:
                    exe_path = sys.executable
                    if exe_path.lower().endswith("python.exe"):
                        pythonw = os.path.join(os.path.dirname(exe_path), "pythonw.exe")
                        if os.path.exists(pythonw):
                            exe_path = pythonw
                    script_path = os.path.abspath(__file__)
                    cmd = f'"{exe_path}" "{script_path}" --background'
                winreg.SetValueEx(key, "WebMouseHelper", 0, winreg.REG_SZ, cmd)
                print(f"[+] Windows Startup Enabled: {cmd}")
            else:
                try:
                    winreg.DeleteValue(key, "WebMouseHelper")
                    print("[-] Windows Startup Disabled")
                except FileNotFoundError:
                    pass
            return True
    except Exception as e:
        print(f"[!] Error updating Windows startup registry: {e}")
        return False


def create_tray_icon():
    """Generates a 64x64 sleek dark mouse icon with green status dot."""
    if not HAS_PYSTRAY:
        return None
    try:
        image = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        # Mouse outer body
        draw.rounded_rectangle((16, 8, 48, 56), radius=16, fill=(24, 24, 27), outline=(99, 102, 241), width=3)
        # Mouse divider
        draw.line((32, 10, 32, 28), fill=(63, 63, 70), width=2)
        # Scroll wheel
        draw.rounded_rectangle((30, 16, 34, 26), radius=2, fill=(168, 85, 247))
        # Status dot (green)
        draw.ellipse((42, 42, 54, 54), fill=(34, 197, 94), outline=(15, 23, 42), width=2)
        return image
    except Exception:
        return Image.new('RGB', (16, 16), color=(34, 197, 94))


class SystemTrayManager:
    """
    Manages the Windows System Tray Icon, context menu, and native QR pairing dialog.
    Runs silently in background with no CMD window.
    """
    def __init__(self, server: 'WebMouseServer'):
        self.server = server
        self.icon = None
        self.active_qr_window = None
        self.server.tray_manager = self

    def get_status_text(self) -> str:
        count = len(self.server.authenticated_clients)
        if count > 0:
            return f"🟢 Connected ({count} Phone{'s' if count > 1 else ''})"
        return "🟢 WebMouse Running"

    def update_status(self):
        if self.icon:
            try:
                self.icon.title = f"WebMouse V1 — {self.get_status_text()}"
                self.icon.menu = self.create_menu()
            except Exception:
                pass

    def create_menu(self):
        return pystray.Menu(
            pystray.MenuItem(self.get_status_text(), None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("📷 Show QR", self.on_show_qr, default=True),
            pystray.MenuItem("🌐 Open WebMouse", self.on_open_webmouse),
            pystray.MenuItem("📊 Connection Status", self.on_connection_status),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("🔄 Restart Helper", self.on_restart),
            pystray.MenuItem("🛑 Stop Helper", self.on_stop),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("⚙️ Start with Windows", self.on_toggle_startup, checked=lambda item: is_startup_enabled()),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("❌ Quit", self.on_quit)
        )

    def on_show_qr(self, icon=None, item=None):
        """Pops up the native dark-themed pairing window with QR code and countdown."""
        import threading
        threading.Thread(target=self._launch_qr_gui, daemon=True).start()

    def _launch_qr_gui(self):
        if not HAS_TKINTER:
            webbrowser.open(f"http://localhost:{self.server.port}/")
            return

        try:
            import secrets, time
            temp_token = secrets.token_hex(16)
            expires_at = time.time() + 300
            self.server.qr_tokens[temp_token] = expires_at
            current_lan_ip = get_local_ip()
            pair_url = f"http://{current_lan_ip}:{self.server.port}/pair?token={temp_token}&code={self.server.pairing_code}"

            root = tk.Tk()
            root.title("WebMouse — Scan QR with Phone")
            root.geometry("400x530")
            root.configure(bg="#09090b")
            root.attributes("-topmost", True)
            root.resizable(False, False)

            # Header
            header = tk.Label(root, text="🖱️ WebMouse V1", font=("Segoe UI", 16, "bold"), fg="#fafafa", bg="#09090b")
            header.pack(pady=(20, 2))

            sub = tk.Label(root, text=f"Laptop: {socket.gethostname()} ({current_lan_ip})", font=("Segoe UI", 10), fg="#a1a1aa", bg="#09090b")
            sub.pack(pady=(0, 15))

            # QR Code Container
            qr_frame = tk.Frame(root, bg="#18181b", bd=1, relief="solid")
            qr_frame.pack(padx=20, pady=5)

            qr_label = tk.Label(qr_frame, bg="#ffffff")
            qr_label.pack(padx=12, pady=12)

            def render_qr(url_to_encode):
                if HAS_QRCODE and HAS_PYSTRAY:
                    qr = qrcode.QRCode(version=1, box_size=6, border=2)
                    qr.add_data(url_to_encode)
                    qr.make(fit=True)
                    qr_img = qr.make_image(fill_color="black", back_color="white")
                    photo = ImageTk.PhotoImage(qr_img)
                    qr_label.config(image=photo, text="")
                    qr_label.image = photo
                else:
                    qr_label.config(text=f"Pairing Code:\n{self.server.pairing_code}\n\nOpen:\n{url_to_encode}", font=("Consolas", 10), fg="#000", bg="#fff")

            render_qr(pair_url)

            # Countdown & Status
            status_var = tk.StringVar(value="⏳ Token valid for 5 min")
            status_label = tk.Label(root, textvariable=status_var, font=("Segoe UI", 10, "bold"), fg="#34d399", bg="#09090b")
            status_label.pack(pady=(12, 6))

            hint_label = tk.Label(root, text="Open phone camera or WebMouse app to scan", font=("Segoe UI", 9), fg="#71717a", bg="#09090b")
            hint_label.pack(pady=(0, 15))

            btn_frame = tk.Frame(root, bg="#09090b")
            btn_frame.pack(pady=(0, 15))

            def refresh_token():
                nonlocal temp_token, expires_at, pair_url
                temp_token = secrets.token_hex(16)
                expires_at = time.time() + 300
                self.server.qr_tokens[temp_token] = expires_at
                pair_url = f"http://{current_lan_ip}:{self.server.port}/pair?token={temp_token}&code={self.server.pairing_code}"
                render_qr(pair_url)
                status_var.set("⏳ Token valid for 5 min")
                status_label.config(fg="#34d399")

            btn_refresh = tk.Button(btn_frame, text="🔄 New QR", command=refresh_token, font=("Segoe UI", 9, "bold"), fg="#ffffff", bg="#27272a", activebackground="#3f3f46", activeforeground="#fff", bd=0, padx=12, pady=6)
            btn_refresh.pack(side="left", padx=5)

            btn_browser = tk.Button(btn_frame, text="🌐 Open WebMouse", command=lambda: webbrowser.open(f"http://localhost:{self.server.port}/"), font=("Segoe UI", 9, "bold"), fg="#ffffff", bg="#6366f1", activebackground="#4f46e5", activeforeground="#fff", bd=0, padx=12, pady=6)
            btn_browser.pack(side="left", padx=5)

            btn_close = tk.Button(btn_frame, text="Close", command=root.destroy, font=("Segoe UI", 9), fg="#a1a1aa", bg="#18181b", bd=0, padx=12, pady=6)
            btn_close.pack(side="left", padx=5)

            # Hook for connection detection
            def on_connected():
                try:
                    status_var.set("🟢 Phone Connected! Ready to use.")
                    status_label.config(fg="#34d399")
                    hint_label.config(text="Move your thumb on your phone to control the cursor!", fg="#34d399")
                except Exception:
                    pass

            self.server.on_client_connected = on_connected

            def tick():
                remaining = int(expires_at - time.time())
                if len(self.server.authenticated_clients) > 0:
                    status_var.set("🟢 Phone Connected! Ready to use.")
                    status_label.config(fg="#34d399")
                elif remaining > 0:
                    status_var.set(f"⏳ Token expires in {remaining}s")
                    root.after(1000, tick)
                else:
                    status_var.set("🔴 Token Expired — Click 'New QR'")
                    status_label.config(fg="#f87171")

            root.after(1000, tick)
            root.mainloop()
        except Exception as e:
            print(f"[!] Error opening QR GUI: {e}")
            webbrowser.open(f"http://localhost:{self.server.port}/")

    def on_open_webmouse(self, icon=None, item=None):
        webbrowser.open(f"http://localhost:{self.server.port}/")

    def on_connection_status(self, icon=None, item=None):
        count = len(self.server.authenticated_clients)
        lan_ip = get_local_ip()
        msg = f"WebMouse V1 Windows Helper\n\nStatus: {'🟢 Connected' if count else '🟢 Ready (Waiting for phone)'}\nActive Devices: {count}\nLAN IP: {lan_ip}\nPort: {self.server.port}\nAuto-Start: {'Enabled' if is_startup_enabled() else 'Disabled'}"
        if HAS_TKINTER:
            try:
                root = tk.Tk()
                root.withdraw()
                messagebox.showinfo("WebMouse Connection Status", msg)
                root.destroy()
                return
            except Exception:
                pass
        print(f"\n{msg}\n")

    def on_restart(self, icon=None, item=None):
        if self.icon:
            self.icon.stop()
        os.execv(sys.executable, [sys.executable] + sys.argv)

    def on_stop(self, icon=None, item=None):
        if self.icon:
            self.icon.stop()
        os._exit(0)

    def on_toggle_startup(self, icon=None, item=None):
        new_state = not is_startup_enabled()
        set_startup_enabled(new_state)
        self.update_status()

    def on_quit(self, icon=None, item=None):
        if self.icon:
            self.icon.stop()
        os._exit(0)

    def start(self):
        """Starts the tray icon message loop in a background thread."""
        if not HAS_PYSTRAY:
            print("[INFO] pystray not installed. Tray icon disabled; helper running normally.")
            return
        try:
            image = create_tray_icon()
            self.icon = pystray.Icon(
                "WebMouse",
                image,
                "WebMouse V1 — Windows Helper",
                menu=self.create_menu()
            )
            self.icon.run_detached()
            print("[+] Windows System Tray icon active.")
        except Exception as e:
            print(f"[!] Warning: Could not initialize system tray: {e}")


class WebMouseServer:
    def __init__(self, host: str, port: int, pairing_code: str):
        self.host = host
        self.port = port
        self.pairing_code = pairing_code
        self.authenticated_clients: Set[WebSocketServerProtocol] = set()
        self.client_info: Dict[WebSocketServerProtocol, str] = {}
        self.qr_tokens: Dict[str, float] = {} # temp token -> expiry timestamp
        self.tray_manager = None
        self.on_client_connected = None
        
        # Token storage for persistent pairing
        self.trusted_devices_file = Path.home() / "Downloads" / "WebMouse" / "trusted_devices.json"
        self.trusted_devices_file.parent.mkdir(parents=True, exist_ok=True)
        self.trusted_tokens = self._load_trusted_tokens()
        
        # Screen dimensions
        try:
            self.screen_width, self.screen_height = pyautogui.size()
        except Exception:
            self.screen_width, self.screen_height = (1920, 1080)

        # Active Projector streaming tasks per client: { websocket: asyncio.Task }
        self.projector_tasks: Dict[WebSocketServerProtocol, asyncio.Task] = {}

    def update_tray_status(self):
        if self.tray_manager:
            try:
                self.tray_manager.update_status()
            except Exception:
                pass


    def _load_trusted_tokens(self) -> Dict[str, dict]:
        try:
            if self.trusted_devices_file.exists():
                with open(self.trusted_devices_file, "r") as f:
                    return json.load(f)
        except Exception as e:
            print(f"Error loading trusted tokens: {e}")
        return {}

    def _save_trusted_tokens(self):
        try:
            with open(self.trusted_devices_file, "w") as f:
                json.dump(self.trusted_tokens, f)
        except Exception as e:
            print(f"Error saving trusted tokens: {e}")

    async def send_next_chunk(self, websocket, transfer_id):
        self.active_uploads = getattr(self, "active_uploads", {})
        if transfer_id not in self.active_uploads:
            return
            
        upload = self.active_uploads[transfer_id]
        chunk_size = 1024 * 512
        offset = upload["chunk_index"] * chunk_size
        
        with open(upload["path"], "rb") as f:
            f.seek(offset)
            data = f.read(chunk_size)
            
        if data:
            await websocket.send(json.dumps({
                "type": "file_chunk",
                "transfer_id": transfer_id,
                "chunk_index": upload["chunk_index"],
                "chunk": base64.b64encode(data).decode("utf-8")
            }))
        else:
            await websocket.send(json.dumps({
                "type": "file_transfer_end",
                "transfer_id": transfer_id
            }))
            del self.active_uploads[transfer_id]
            print(f"Finished sending file {transfer_id} to phone.")

    async def watch_send_folder(self):
        send_dir = Path.home() / "Downloads" / "WebMouse" / "SendToPhone"
        send_dir.mkdir(parents=True, exist_ok=True)
        print(f"Watching folder for outgoing files to phone:\n  {send_dir}")
        
        while True:
            await asyncio.sleep(2)
            if not self.authenticated_clients:
                continue
                
            for filepath in send_dir.iterdir():
                if filepath.is_file():
                    try:
                        filename = filepath.name
                        size = filepath.stat().st_size
                        transfer_id = f"up_{random.randint(1000, 9999)}"
                        
                        self.active_uploads = getattr(self, "active_uploads", {})
                        self.active_uploads[transfer_id] = {
                            "path": filepath,
                            "chunk_index": 0,
                            "size": size
                        }
                        
                        total_chunks = (size + (1024 * 512) - 1) // (1024 * 512)
                        
                        # Just send to the first authenticated client for now
                        websocket = next(iter(self.authenticated_clients))
                        await websocket.send(json.dumps({
                            "type": "incoming_file_request",
                            "transfer_id": transfer_id,
                            "filename": filename,
                            "size": size,
                            "total_chunks": total_chunks
                        }))
                        print(f"Sent incoming_file_request for {filename}")
                        
                        # Move file so we don't send it again
                        sent_dir = send_dir / "Sent"
                        sent_dir.mkdir(exist_ok=True)
                        dest_path = sent_dir / filename
                        # Handle collision
                        if dest_path.exists():
                            base, ext = os.path.splitext(filename)
                            dest_path = sent_dir / f"{base}_{random.randint(100, 999)}{ext}"
                        os.rename(filepath, dest_path)
                    except Exception as e:
                        print(f"Error processing {filepath}: {e}")

    async def stream_projector_loop(self, websocket):
        """
        Tarika A: Captures real Windows desktop screen and streams JPEG base64 frames
        directly to the phone over the open WebSocket connection.
        Supports PIL ImageGrab, mss, or Windows native GDI screenshot fallback.
        """
        import io, time
        print(f"[PROJECTOR] Started real-time screen stream to client.")
        target_fps = 15
        interval = 1.0 / target_fps
        quality = 55
        target_width = 1024

        while True:
            t_start = time.time()
            img = None

            # Attempt 1: PIL ImageGrab (standard with pyautogui)
            try:
                from PIL import ImageGrab, Image
                img = ImageGrab.grab()
            except Exception:
                # Attempt 2: mss if installed
                try:
                    import mss
                    with mss.mss() as sct:
                        monitor = sct.monitors[1]
                        sct_img = sct.grab(monitor)
                        from PIL import Image
                        img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
                except Exception:
                    # Attempt 3: Windows GDI via ctypes
                    try:
                        import ctypes
                        from ctypes import wintypes
                        from PIL import Image
                        user32 = ctypes.windll.user32
                        gdi32 = ctypes.windll.gdi32
                        w = user32.GetSystemMetrics(0)
                        h = user32.GetSystemMetrics(1)
                        hdesktop = user32.GetDesktopWindow()
                        hdc = user32.GetDC(hdesktop)
                        memdc = gdi32.CreateCompatibleDC(hdc)
                        bitmap = gdi32.CreateCompatibleBitmap(hdc, w, h)
                        gdi32.SelectObject(memdc, bitmap)
                        gdi32.BitBlt(memdc, 0, 0, w, h, hdc, 0, 0, 0x00CC0020) # SRCCOPY
                        # Copy bits
                        bmpinfo = (ctypes.c_byte * 40)()
                        ctypes.c_uint32.from_buffer(bmpinfo, 0).value = 40
                        ctypes.c_int32.from_buffer(bmpinfo, 4).value = w
                        ctypes.c_int32.from_buffer(bmpinfo, 8).value = -h
                        ctypes.c_uint16.from_buffer(bmpinfo, 12).value = 1
                        ctypes.c_uint16.from_buffer(bmpinfo, 14).value = 32 # 32 bpp
                        buf = (ctypes.c_byte * (w * h * 4))()
                        gdi32.GetDIBits(memdc, bitmap, 0, h, buf, bmpinfo, 0)
                        raw_bytes = bytes(buf)
                        img = Image.frombytes("RGB", (w, h), raw_bytes, "raw", "BGRX")
                        gdi32.DeleteObject(bitmap)
                        gdi32.DeleteDC(memdc)
                        user32.ReleaseDC(hdesktop, hdc)
                    except Exception as e:
                        print(f"[PROJECTOR] Screen capture error: {e}")
                        img = None

            if img:
                try:
                    orig_w, orig_h = img.size
                    if orig_w > target_width:
                        scale = target_width / float(orig_w)
                        new_h = int(orig_h * scale)
                        img = img.resize((target_width, new_h))
                    
                    buf = io.BytesIO()
                    img.save(buf, format="JPEG", quality=quality, optimize=True)
                    b64_img = base64.b64encode(buf.getvalue()).decode("ascii")
                    
                    frame_msg = json.dumps({
                        "type": "screen_frame",
                        "image": f"data:image/jpeg;base64,{b64_img}",
                        "timestamp": int(time.time() * 1000)
                    })
                    await websocket.send(frame_msg)
                except Exception as send_err:
                    print(f"[PROJECTOR] Error sending frame: {send_err}")
                    break

            elapsed = time.time() - t_start
            sleep_time = max(0.01, interval - elapsed)
            await asyncio.sleep(sleep_time)

    def print_banner(self):
        lan_ip = get_local_ip()
        code_spaced = "  ".join(list(self.pairing_code))
        print("\n" + "=" * 62)
        print("           WEBMOUSE V1 — WINDOWS HELPER (CMD)")
        print("=" * 62)
        print(f"  [STATUS]           RUNNING (DO NOT CLOSE THIS WINDOW)")
        print(f"  [LAPTOP WI-FI IP]  {lan_ip}")
        print(f"  [PORT]             {self.port}")
        print("=" * 62)
        print(f"  >>> 6-DIGIT PAIRING PIN:   [  {code_spaced}  ] <<<")
        print("=" * 62)
        print("  HOW TO CONNECT FROM YOUR PHONE:")
        print(f"  1. Open WebMouse on your phone browser")
        print(f"  2. Tap 'Enter 6-Digit PIN' (or scan QR)")
        print(f"  3. Enter IP: {lan_ip}  and  PIN: {self.pairing_code}")
        print(f"  4. Tap 'Connect' — Your phone controls your mouse!")
        print("=" * 62 + "\n")

    async def process_request(self, *args, **kwargs):
        """
        Local Pairing Gateway HTTP Handler.
        Operates on the SAME port (8765) as WebSocket.
        Handles:
        - GET /pair?token=<TOKEN> -> Validates token, generates trusted session, returns mobile pairing page
        - GET /api/pairing-info    -> Returns JSON with LAN IP, port, fresh token, and QR URL (CORS enabled)
        - OPTIONS *                -> CORS preflight response
        - GET / or /health         -> Simple status and gateway landing page
        - WebSocket handshake      -> Returns None, letting websockets handle the connection
        """
        path = "/"
        headers = {}
        connection = None
        is_new_api = False

        if len(args) == 2 and isinstance(args[0], str):
            # websockets < 12: process_request(path: str, headers: Headers)
            path = args[0]
            headers = args[1]
        elif len(args) == 2:
            # websockets >= 12: process_request(connection: ServerConnection, request: Request)
            is_new_api = True
            connection = args[0]
            request = args[1]
            path = getattr(request, 'path', '/')
            headers = getattr(request, 'headers', {})
        elif 'path' in kwargs:
            path = kwargs['path']

        # If it's a WebSocket upgrade, return None to proceed with WebSocket handshake
        header_map = {k.lower(): v for k, v in (headers.items() if hasattr(headers, 'items') else [])}
        upgrade = header_map.get('upgrade', '').lower()
        if 'websocket' in upgrade:
            return None

        # Helper to construct HTTP responses for both websockets APIs (binary or text)
        def send_http(status_code: int, content_type: str, body):
            body_bytes = body if isinstance(body, bytes) else body.encode('utf-8')
            ct_header = content_type if ("charset" in content_type or not content_type.startswith("text/")) else f"{content_type}; charset=utf-8"
            resp_headers = [
                ("Content-Type", ct_header),
                ("Content-Length", str(len(body_bytes))),
                ("Access-Control-Allow-Origin", "*"),
                ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
                ("Access-Control-Allow-Headers", "*"),
                ("Connection", "close")
            ]
            if is_new_api and connection is not None and hasattr(connection, 'respond'):
                import http
                return connection.respond(http.HTTPStatus(status_code), body_bytes)
            import http
            return (http.HTTPStatus(status_code), resp_headers, body_bytes)

        try:
            import urllib.parse, time, secrets
            parsed_url = urllib.parse.urlparse(path)
            req_path = parsed_url.path
            query_params = urllib.parse.parse_qs(parsed_url.query)

            # 1. CORS Preflight
            if header_map.get(':method', '').upper() == 'OPTIONS' or 'options' in path.lower():
                return send_http(204, "text/plain", "")

            # 2. Local Pairing API endpoint for host browser (CORS allowed for localhost & local network)
            if req_path in ("/api/pairing-info", "/api/info", "/info"):
                temp_token = secrets.token_hex(16)
                expires_at = int(time.time() + 60) # 60 seconds one-time temporary token
                self.qr_tokens[temp_token] = expires_at

                current_lan_ip = get_local_ip()
                qr_payload = {
                    "type": "webmouse_pair",
                    "version": 1,
                    "host": current_lan_ip,
                    "port": self.port,
                    "token": temp_token,
                    "expiresAt": expires_at
                }

                print(f"[DEBUG] QR generated: host={current_lan_ip}:{self.port}, token={temp_token[:8]}..., expires_at={expires_at}")
                print(f"[DEBUG] QR payload: {json.dumps(qr_payload)}")
                print(f"[DEBUG] detected LAN IP: {current_lan_ip}")

                pair_url = f"http://{current_lan_ip}:{self.port}/pair?token={temp_token}&code={self.pairing_code}"

                data = {
                    "type": "host_pairing_info",
                    "host": current_lan_ip,
                    "ip": current_lan_ip,
                    "port": self.port,
                    "version": 1,
                    "token": temp_token,
                    "pairingToken": temp_token,
                    "code": self.pairing_code,
                    "expiresAt": expires_at,
                    "qrPayload": qr_payload,
                    "pairUrl": pair_url
                }
                return send_http(200, "application/json", json.dumps(data))

            # 3. Mobile Phone QR Pairing Gateway: GET /pair?token=<TOKEN>
            if req_path == "/pair":
                token_list = query_params.get("token", [])
                code_list = query_params.get("code", [])
                token = token_list[0].strip() if token_list else ""
                code = code_list[0].strip() if code_list else ""
                current_time = time.time()
                current_lan_ip = get_local_ip()

                # Validate token or code
                is_valid = False
                if token and token in self.qr_tokens and self.qr_tokens[token] > current_time:
                    is_valid = True
                elif token and token == self.pairing_code:
                    is_valid = True
                elif code and code == self.pairing_code:
                    is_valid = True

                if is_valid:
                    new_trusted_token = secrets.token_hex(32)
                    self.trusted_tokens[new_trusted_token] = {
                        "device_name": "Mobile Phone (QR)",
                        "paired_at": str(time.time()),
                        "method": "qr_gateway"
                    }
                    self._save_trusted_tokens()
                    print(f"\n[+] QR GATEWAY PAIRING SUCCESS: Phone paired via HTTP gateway! Issued trusted token.")

                    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>WebMouse — Paired Successfully</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background-color: #09090b;
      color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
    }}
    .card {{
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 28px;
      padding: 36px 24px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }}
    .icon {{ font-size: 52px; margin-bottom: 12px; }}
    h1 {{ font-size: 26px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.5px; color: #ffffff; }}
    .computer {{ font-size: 15px; color: #a1a1aa; font-weight: 500; margin-bottom: 24px; }}
    .badge {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 700;
      background-color: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #34d399;
      margin-bottom: 20px;
    }}
    .pulse {{
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #34d399;
      box-shadow: 0 0 10px #34d399;
    }}
    p.desc {{ font-size: 14px; color: #d4d4d8; line-height: 1.6; margin-bottom: 28px; }}
    .btn {{
      display: block;
      width: 100%;
      padding: 15px 24px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 16px;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.5);
      margin-bottom: 12px;
    }}
    .btn:active {{ transform: scale(0.98); }}
    .details {{
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px solid #27272a;
      font-size: 11px;
      color: #71717a;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      line-height: 1.6;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🖱️</div>
    <h1>WebMouse</h1>
    <p class="computer">{socket.gethostname()}</p>
    <div class="badge">
      <span class="pulse"></span>
      <span>🟢 Paired Successfully</span>
    </div>
    <p class="desc">Your phone is securely paired with this Windows laptop. You can now use your phone as a wireless trackpad and keyboard.</p>
    <button onclick="window.history.back();" class="btn">Open WebMouse</button>
    <div class="details">
      Host: {current_lan_ip}<br>
      Port: {self.port}<br>
      Session: Authenticated
    </div>
  </div>
  <script>
    try {{
      localStorage.setItem('webmouse_trusted_token', '{new_trusted_token}');
      localStorage.setItem('webmouse_host', '{current_lan_ip}');
      localStorage.setItem('webmouse_port', '{self.port}');
      localStorage.setItem('webmouse_computer_name', '{socket.gethostname()}');
    }} catch(e) {{}}
  </script>
</body>
</html>"""
                    return send_http(200, "text/html", html)
                else:
                    # Token expired or invalid
                    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>WebMouse — Pairing Error</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background-color: #09090b;
      color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
    }}
    .card {{
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 28px;
      padding: 36px 24px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }}
    .icon {{ font-size: 52px; margin-bottom: 12px; }}
    h1 {{ font-size: 24px; font-weight: 800; margin-bottom: 6px; color: #ffffff; }}
    .badge {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 700;
      background-color: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.35);
      color: #f87171;
      margin-bottom: 20px;
    }}
    p.desc {{ font-size: 14px; color: #d4d4d8; line-height: 1.6; margin-bottom: 24px; }}
    .tip {{ font-size: 12px; color: #a1a1aa; line-height: 1.5; background: #27272a; padding: 14px; border-radius: 14px; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🖱️</div>
    <h1>WebMouse</h1>
    <div class="badge">
      <span>🔴 QR Code Expired or Invalid</span>
    </div>
    <p class="desc">This temporary pairing token has expired or has already been used.</p>
    <div class="tip">
      👉 Click <strong>"Generate New QR"</strong> on your Windows laptop screen and scan the new QR code.
    </div>
  </div>
</body>
</html>"""
                    return send_http(400, "text/html", html)

            # 4. Static Web Application Serving (dist or web_dist)
            web_dirs = [
                Path(__file__).parent / "web_dist",
                Path(__file__).parent.parent / "dist",
                Path(__file__).parent / "dist",
            ]
            dist_dir = next((d for d in web_dirs if d.exists() and (d / "index.html").exists()), None)

            if dist_dir:
                clean_path = req_path.lstrip("/")
                
                # Check for specific asset file request (e.g. /assets/index-xxx.js, /favicon.ico)
                if clean_path:
                    target_file = (dist_dir / clean_path).resolve()
                    if dist_dir.resolve() in target_file.parents and target_file.is_file():
                        import mimetypes
                        ctype, _ = mimetypes.guess_type(str(target_file))
                        if not ctype:
                            if target_file.suffix == ".js":
                                ctype = "application/javascript"
                            elif target_file.suffix == ".css":
                                ctype = "text/css"
                            elif target_file.suffix == ".json":
                                ctype = "application/json"
                            elif target_file.suffix == ".svg":
                                ctype = "image/svg+xml"
                            else:
                                ctype = "application/octet-stream"
                        with open(target_file, "rb") as f:
                            return send_http(200, ctype, f.read())

                # Root or SPA fallback (e.g. /, /mouse, /keyboard)
                if not clean_path or "." not in clean_path:
                    index_file = dist_dir / "index.html"
                    if index_file.is_file():
                        with open(index_file, "rb") as f:
                            return send_http(200, "text/html", f.read())

            # 5. Status or root landing fallback (if dist not built): GET / or /health
            if req_path in ("/", "/status", "/health"):
                current_lan_ip = get_local_ip()
                html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WebMouse Gateway</title>
  <style>
    body {{ background: #09090b; color: #fafafa; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; }}
    .card {{ background: #18181b; border: 1px solid #27272a; border-radius: 24px; padding: 32px; max-width: 380px; }}
    h1 {{ font-size: 22px; margin-bottom: 8px; }}
    p {{ color: #a1a1aa; font-size: 14px; margin-bottom: 16px; }}
    .status {{ color: #34d399; font-weight: bold; font-size: 14px; }}
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 40px; margin-bottom: 10px;">🖱️</div>
    <h1>WebMouse V1</h1>
    <p>Windows Helper Server is running.</p>
    <div class="status">🟢 Ready on {current_lan_ip}:{self.port}</div>
  </div>
</body>
</html>"""
                return send_http(200, "text/html", html)

        except Exception as e:
            print(f"[!] HTTP Gateway error: {e}")
            return None

        # Fall through to normal WebSocket handshake
        return None

    async def handle_connection(self, websocket: WebSocketServerProtocol):
        peer = websocket.remote_address
        client_addr = f"{peer[0]}:{peer[1]}"
        print(f"CONNECTED: Client from {client_addr}")

        # Send immediate host pairing info so a local laptop client can generate a QR code
        try:
            import time, secrets
            temp_token = secrets.token_hex(16)
            expires_at = time.time() + 60
            self.qr_tokens[temp_token] = expires_at
            
            # Cleanup old tokens
            current_time = time.time()
            self.qr_tokens = {k: v for k, v in self.qr_tokens.items() if v > current_time}

            current_lan_ip = get_local_ip()

            await websocket.send(json.dumps({
                "type": "host_pairing_info",
                "host": current_lan_ip,
                "ip": current_lan_ip,
                "port": self.port,
                "version": 2,
                "token": temp_token,
                "pairingToken": temp_token,
                "expiresAt": int(expires_at)
            }))
        except Exception as e:
            print(f"Error sending host_pairing_info: {e}")

        try:
            async for raw_message in websocket:
                try:
                    data = json.loads(raw_message)
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": "Invalid JSON payload"
                    }))
                    continue

                msg_type = data.get("type", "")

                # 0. Request fresh pairing info / QR token from Host PC
                if msg_type in ("host_pairing_info", "request_qr_token", "get_pairing_info"):
                    import time, secrets
                    temp_token = secrets.token_hex(16)
                    expires_at = int(time.time() + 60)
                    self.qr_tokens[temp_token] = expires_at
                    current_lan_ip = get_local_ip()
                    qr_payload = {
                        "type": "webmouse_pair",
                        "version": 1,
                        "host": current_lan_ip,
                        "port": self.port,
                        "token": temp_token,
                        "expiresAt": expires_at
                    }
                    print(f"[DEBUG] helper connection: host browser requested pairing info via WebSocket")
                    print(f"[DEBUG] QR generated: host={current_lan_ip}:{self.port}, token={temp_token[:8]}..., expires_at={expires_at}")
                    print(f"[DEBUG] QR payload: {json.dumps(qr_payload)}")
                    print(f"[DEBUG] detected LAN IP: {current_lan_ip}")
                    await websocket.send(json.dumps({
                        "type": "host_pairing_info",
                        "host": current_lan_ip,
                        "ip": current_lan_ip,
                        "port": self.port,
                        "version": 1,
                        "token": temp_token,
                        "pairingToken": temp_token,
                        "code": self.pairing_code,
                        "expiresAt": expires_at,
                        "qrPayload": qr_payload
                    }))
                    continue

                # 1. Authentication Handshake
                if msg_type == "auth":
                    code = str(data.get("code", "")).strip()
                    token = str(data.get("token", "")).strip()
                    device_name = str(data.get("deviceName", "Mobile Phone")).strip()

                    print(f"[DEBUG] phone pairing request from {client_addr}: device='{device_name}', has_token={bool(token)}, has_code={bool(code)}")
                    print(f"[DEBUG] token validation: checking incoming credentials...")

                    is_authenticated = False
                    new_token = None
                    fail_reason = ""

                    if token and token in self.trusted_tokens:
                        is_authenticated = True
                        print(f"[DEBUG] token validation: trusted device token matched! Reconnected '{device_name}' from {client_addr}")
                    elif token and token in self.qr_tokens:
                        import time
                        if self.qr_tokens[token] > time.time():
                            is_authenticated = True
                            import secrets
                            new_token = secrets.token_hex(32)
                            self.trusted_tokens[new_token] = {"device_name": device_name, "paired_at": str(time.time()), "method": "qr"}
                            self._save_trusted_tokens()
                            del self.qr_tokens[token] # One-time use: invalid after successful pairing
                            print(f"[DEBUG] token validation: valid 60s temporary QR token!")
                            print(f"[DEBUG] successful pairing: generated persistent trusted token for '{device_name}'")
                        else:
                            fail_reason = "Expired temporary QR token"
                            print(f"[DEBUG] token validation: {fail_reason}")
                    elif code and code == self.pairing_code:
                        is_authenticated = True
                        import secrets
                        new_token = secrets.token_hex(32)
                        self.trusted_tokens[new_token] = {"device_name": device_name, "paired_at": str(time.time()), "method": "manual_code"}
                        self._save_trusted_tokens()
                        print(f"[DEBUG] token validation: 6-digit pairing code matched!")
                        print(f"[DEBUG] successful pairing: generated persistent trusted token for '{device_name}'")
                    else:
                        fail_reason = "Invalid token or incorrect pairing code"
                        print(f"[DEBUG] token validation: {fail_reason}")

                    print(f"[DEBUG] WebSocket authentication: client authenticated = {is_authenticated}")

                    if is_authenticated:
                        self.authenticated_clients.add(websocket)
                        self.client_info[websocket] = f"{device_name} ({client_addr})"
                        self.update_tray_status()
                        if callable(self.on_client_connected):
                            try:
                                self.on_client_connected()
                            except Exception:
                                pass
                        
                        print(f"[DEBUG] successful pairing: '{device_name}' from {client_addr} connected to Windows cursor!")

                        response = {
                            "type": "auth_result",
                            "success": True,
                            "computerName": socket.gethostname(),
                            "screenWidth": self.screen_width,
                            "screenHeight": self.screen_height,
                            "message": "Authentication successful"
                        }
                        if new_token:
                            response["token"] = new_token
                            
                        await websocket.send(json.dumps(response))
                    else:
                        print(f"[DEBUG] connection failure reason: {fail_reason} from {client_addr}")
                        await websocket.send(json.dumps({
                            "type": "auth_result",
                            "success": False,
                            "message": f"Authentication failed: {fail_reason}"
                        }))
                    continue

                # Block commands if not authenticated
                if websocket not in self.authenticated_clients:
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": "Unauthorized. Please authenticate with pairing code first."
                    }))
                    continue

                # 2. Ping / Pong latency check
                if msg_type == "ping":
                    await websocket.send(json.dumps({
                        "type": "pong",
                        "timestamp": data.get("timestamp")
                    }))
                    continue

                # 3. Mouse Movement (Real Windows Cursor via PyAutoGUI)
                elif msg_type == "mouse_move":
                    dx = float(data.get("dx", 0))
                    dy = float(data.get("dy", 0))
                    try:
                        # Move actual Windows cursor relative to current position
                        pyautogui.moveRel(dx, dy, _pause=False)
                        print(f"MOUSE MOVE: dx={dx}, dy={dy}")
                    except Exception as e:
                        print(f"Error moving mouse: {e}")

                # 4. Left Click
                elif msg_type == "left_click":
                    try:
                        pyautogui.click(button="left")
                        print("LEFT CLICK")
                    except Exception as e:
                        print(f"Error left_click: {e}")

                # 5. Right Click
                elif msg_type == "right_click":
                    try:
                        pyautogui.click(button="right")
                        print("RIGHT CLICK")
                    except Exception as e:
                        print(f"Error right_click: {e}")

                # 6. Middle Click
                elif msg_type == "middle_click":
                    try:
                        pyautogui.click(button="middle")
                        print("MIDDLE CLICK")
                    except Exception as e:
                        print(f"Error middle_click: {e}")

                # 7. Double Click
                elif msg_type == "double_click":
                    try:
                        pyautogui.doubleClick(button="left")
                        print("DOUBLE CLICK")
                    except Exception as e:
                        print(f"Error double_click: {e}")

                # 8. Mouse Down (Drag Mode engage)
                elif msg_type == "mouse_down":
                    button = data.get("button", "left")
                    if button not in ["left", "right", "middle"]:
                        button = "left"
                    try:
                        pyautogui.mouseDown(button=button)
                        print(f"DRAG START (mouse_down: {button})")
                    except Exception as e:
                        print(f"Error mouse_down: {e}")

                # 9. Mouse Up (Drag Mode release)
                elif msg_type == "mouse_up":
                    button = data.get("button", "left")
                    if button not in ["left", "right", "middle"]:
                        button = "left"
                    try:
                        pyautogui.mouseUp(button=button)
                        print(f"DRAG END (mouse_up: {button})")
                    except Exception as e:
                        print(f"Error mouse_up: {e}")

                # 10. Mouse Wheel Scroll
                elif msg_type == "scroll":
                    amount = int(data.get("amount", 0))
                    try:
                        pyautogui.scroll(amount)
                        print(f"SCROLL: amount={amount}")
                    except Exception as e:
                        print(f"Error scroll: {e}")

                # 11. Horizontal Scroll
                elif msg_type == "hscroll":
                    amount = int(data.get("amount", 0))
                    try:
                        if hasattr(pyautogui, "hscroll"):
                            pyautogui.hscroll(amount)
                            print(f"HSCROLL: amount={amount}")
                    except Exception:
                        pass

                # 12. Single Key Press
                elif msg_type == "key":
                    key_val = str(data.get("key", "")).lower()
                    mapped_key = KEY_MAP.get(key_val, key_val)
                    try:
                        pyautogui.press(mapped_key)
                        print(f"KEY: {mapped_key}")
                    except Exception as e:
                        print(f"Error pressing key '{key_val}': {e}")

                # 13. Type Full Text String
                elif msg_type == "type_text":
                    text = str(data.get("text", ""))
                    if text:
                        try:
                            pyautogui.write(text, interval=0.005)
                            print(f"TYPE TEXT: {text}")
                        except Exception as e:
                            print(f"Error typing text: {e}")

                # 14. Keyboard Shortcuts (e.g. ['ctrl', 'c'])
                elif msg_type == "shortcut":
                    keys = data.get("keys", [])
                    if isinstance(keys, list) and len(keys) > 0:
                        mapped_keys = [KEY_MAP.get(k.lower(), k.lower()) for k in keys]
                        try:
                            pyautogui.hotkey(*mapped_keys)
                            print(f"SHORTCUT: {' + '.join(mapped_keys)}")
                        except Exception as e:
                            print(f"Error executing shortcut {keys}: {e}")

                # 15. Media Controls
                elif msg_type == "media_control":
                    action = str(data.get("action", "")).lower()
                    if action in ["playpause", "nexttrack", "prevtrack", "volumeup", "volumedown", "volumemute"]:
                        try:
                            pyautogui.press(action)
                            print(f"MEDIA: {action}")
                        except Exception as e:
                            print(f"Error media control: {e}")

                # 16. Presentation Controls
                elif msg_type == "presentation_control":
                    action = str(data.get("action", "")).lower()
                    try:
                        if action == "start":
                            pyautogui.press("f5")
                        elif action == "stop":
                            pyautogui.press("esc")
                        elif action == "next":
                            pyautogui.press("right")
                        elif action == "prev":
                            pyautogui.press("left")
                        elif action == "black":
                            pyautogui.press("b")
                        print(f"PRESENTATION: {action}")
                    except Exception as e:
                        print(f"Error presentation control: {e}")

                # 17. Quick Controls
                elif msg_type == "quick_control":
                    action = str(data.get("action", "")).lower()
                    try:
                        if action == "desktop":
                            pyautogui.hotkey("win", "d")
                        elif action == "lock":
                            import ctypes
                            ctypes.windll.user32.LockWorkStation()
                        elif action == "screenshot":
                            pyautogui.press("printscreen")
                        elif action == "alttab":
                            pyautogui.hotkey("alt", "tab")
                        print(f"QUICK CONTROL: {action}")
                    except Exception as e:
                        print(f"Error quick control: {e}")

                # 18. Link Sharing
                elif msg_type == "share_link":
                    url = str(data.get("url", ""))
                    if url:
                        print(f"OPENING LINK: {url}")
                        webbrowser.open(url)

                # 19. Text Sharing (Copy to PC Clipboard)
                elif msg_type == "share_text":
                    text = str(data.get("text", ""))
                    if text and pyperclip:
                        pyperclip.copy(text)
                        print(f"COPIED TEXT TO CLIPBOARD: {text[:20]}...")
                        await websocket.send(json.dumps({
                            "type": "notification",
                            "message": "Text copied to PC clipboard"
                        }))

                # 20. Clipboard Sync (Get PC Clipboard)
                elif msg_type == "get_clipboard":
                    if pyperclip:
                        try:
                            text = pyperclip.paste()
                            if text:
                                await websocket.send(json.dumps({
                                    "type": "clipboard_data",
                                    "text": text
                                }))
                        except Exception as e:
                            print(f"Error getting clipboard: {e}")

                # 21. File Transfer Phone -> PC
                elif msg_type == "file_transfer_start":
                    filename = data.get("filename", "unknown_file")
                    transfer_id = data.get("transfer_id", "")
                    downloads_dir = Path.home() / "Downloads" / "WebMouse"
                    downloads_dir.mkdir(parents=True, exist_ok=True)
                    
                    # Prevent path traversal
                    filename = os.path.basename(filename)
                    filepath = downloads_dir / filename
                    
                    # Make unique if exists
                    base, ext = os.path.splitext(filename)
                    counter = 1
                    while filepath.exists():
                        filepath = downloads_dir / f"{base}_{counter}{ext}"
                        counter += 1
                        
                    self.active_file_transfers = getattr(self, "active_file_transfers", {})
                    if websocket not in self.active_file_transfers:
                        self.active_file_transfers[websocket] = {}
                        
                    try:
                        f = open(filepath, "wb")
                        self.active_file_transfers[websocket][transfer_id] = {
                            "file": f,
                            "path": filepath
                        }
                        print(f"FILE TRANSFER ACCEPTED: {filepath}")
                        await websocket.send(json.dumps({
                            "type": "file_transfer_accepted",
                            "transfer_id": transfer_id
                        }))
                    except Exception as e:
                        print(f"Error opening file for transfer: {e}")
                        await websocket.send(json.dumps({
                            "type": "file_transfer_rejected",
                            "transfer_id": transfer_id,
                            "reason": str(e)
                        }))

                elif msg_type == "file_chunk":
                    transfer_id = data.get("transfer_id", "")
                    chunk_index = data.get("chunk_index", 0)
                    chunk = data.get("chunk", "")
                    
                    active = getattr(self, "active_file_transfers", {}).get(websocket, {})
                    if transfer_id in active:
                        try:
                            file_data = base64.b64decode(chunk)
                            active[transfer_id]["file"].write(file_data)
                            await websocket.send(json.dumps({
                                "type": "file_chunk_ack",
                                "transfer_id": transfer_id,
                                "chunk_index": chunk_index
                            }))
                        except Exception as e:
                            print(f"Error writing chunk: {e}")

                elif msg_type == "file_transfer_end":
                    transfer_id = data.get("transfer_id", "")
                    active = getattr(self, "active_file_transfers", {}).get(websocket, {})
                    if transfer_id in active:
                        try:
                            active[transfer_id]["file"].close()
                            del active[transfer_id]
                            print("FILE TRANSFER SUCCESS")
                            await websocket.send(json.dumps({
                                "type": "file_transfer_success",
                                "transfer_id": transfer_id
                            }))
                            await websocket.send(json.dumps({
                                "type": "notification",
                                "message": "File received and saved to Downloads/WebMouse"
                            }))
                        except Exception as e:
                            print(f"Error closing file: {e}")
                            
                elif msg_type == "file_transfer_cancel":
                    transfer_id = data.get("transfer_id", "")
                    active = getattr(self, "active_file_transfers", {}).get(websocket, {})
                    if transfer_id in active:
                        try:
                            active[transfer_id]["file"].close()
                            filepath = active[transfer_id]["path"]
                            if filepath.exists():
                                os.remove(filepath)
                            del active[transfer_id]
                            print(f"FILE TRANSFER CANCELLED: {filepath}")
                        except Exception as e:
                            print(f"Error cancelling transfer: {e}")

                # 22. Computer -> Phone Transfer (Architecture stub)
                # To send a file from computer to phone, the server should send:
                # { "type": "incoming_file_request", "transfer_id": "...", "filename": "...", "size": ... }
                # Phone responds with "incoming_file_accept" or "incoming_file_reject"
                elif msg_type == "incoming_file_accept":
                    transfer_id = data.get("transfer_id", "")
                    print(f"Phone accepted file transfer {transfer_id}. Server can now push chunks.")
                    # Trigger chunk sending
                    self.active_uploads = getattr(self, "active_uploads", {})
                    if transfer_id in self.active_uploads:
                        await self.send_next_chunk(websocket, transfer_id)
                        
                elif msg_type == "incoming_file_reject":
                    transfer_id = data.get("transfer_id", "")
                    print(f"Phone rejected file transfer {transfer_id}.")
                    self.active_uploads = getattr(self, "active_uploads", {})
                    if transfer_id in self.active_uploads:
                        del self.active_uploads[transfer_id]
                        
                elif msg_type == "file_chunk_ack":
                    transfer_id = data.get("transfer_id", "")
                    chunk_index = data.get("chunk_index", 0)
                    self.active_uploads = getattr(self, "active_uploads", {})
                    if transfer_id in self.active_uploads:
                        upload = self.active_uploads[transfer_id]
                        upload["chunk_index"] = chunk_index + 1
                        await self.send_next_chunk(websocket, transfer_id)
                        
                # 23. WebRTC Signaling Relay
                elif msg_type == "webrtc_signaling":
                    # Broadcast the signaling message to all other authenticated clients
                    for client in self.authenticated_clients:
                        if client != websocket:
                            try:
                                await client.send(json.dumps(data))
                            except Exception as e:
                                print(f"Error relaying WebRTC signal: {e}")

                # 24. PC Screen Mirroring (Projector: Tarika A)
                elif msg_type == "start_projector":
                    print(f"[PROJECTOR] Client requested start_projector")
                    # Cancel existing task if any
                    if websocket in self.projector_tasks:
                        task = self.projector_tasks[websocket]
                        if not task.done():
                            task.cancel()
                    
                    # Start streaming loop in background
                    loop_task = asyncio.create_task(self.stream_projector_loop(websocket))
                    self.projector_tasks[websocket] = loop_task
                    await websocket.send(json.dumps({
                        "type": "projector_status",
                        "active": True,
                        "message": "PC screen streaming active"
                    }))

                elif msg_type == "stop_projector":
                    print(f"[PROJECTOR] Client requested stop_projector")
                    if websocket in self.projector_tasks:
                        task = self.projector_tasks.pop(websocket, None)
                        if task and not task.done():
                            task.cancel()
                    await websocket.send(json.dumps({
                        "type": "projector_status",
                        "active": False,
                        "message": "PC screen streaming stopped"
                    }))

        except websockets.ConnectionClosed:
            pass
        except Exception as e:
            print(f"[!] Exception with client {client_addr}: {e}")
        finally:
            # Stop any running projector task for this client
            if websocket in self.projector_tasks:
                task = self.projector_tasks.pop(websocket, None)
                if task and not task.done():
                    task.cancel()
            info = self.client_info.pop(websocket, client_addr)
            self.authenticated_clients.discard(websocket)
            self.update_tray_status()
            print(f"DISCONNECTED: {info}")


async def main():
    parser = argparse.ArgumentParser(description="WebMouse V1 — Windows Local Helper")
    parser.add_argument("--port", type=int, default=8765, help="Port to listen on (default: 8765)")
    parser.add_argument("--code", type=str, default="", help="6-digit pairing code (default: auto-generate)")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host interface (default: 0.0.0.0)")
    parser.add_argument("--background", action="store_true", help="Run silently in background with system tray icon")
    parser.add_argument("--no-tray", action="store_true", help="Disable system tray icon (headless or CLI mode)")
    args = parser.parse_args()

    # Generate 6-digit code if not specified
    if args.code and len(args.code) == 6:
        pairing_code = args.code
    else:
        import secrets
        pairing_code = f"{secrets.randbelow(900000) + 100000}"

    server = WebMouseServer(host=args.host, port=args.port, pairing_code=pairing_code)

    # Initialize and start System Tray Manager if not explicitly disabled
    if not args.no_tray:
        tray_manager = SystemTrayManager(server)
        tray_manager.start()

    if not args.background:
        server.print_banner()
    else:
        print(f"[+] WebMouse V1 Background Helper active on port {server.port} with System Tray.")

    async def safe_watch_send_folder():
        try:
            await server.watch_send_folder()
        except Exception as e:
            print(f"[INFO] Outgoing folder watcher paused: {e}")

    # Start the WebSocket server (with integrated HTTP Gateway)
    asyncio.create_task(safe_watch_send_folder())

    try:
        if HAS_WEBSOCKETS_PKG:
            async with websockets.serve(
                server.handle_connection,
                server.host,
                server.port,
                process_request=server.process_request,
                ping_interval=20,
                ping_timeout=20,
                max_size=10_000_000
            ):
                print(f"[*] WebMouse Helper is ACTIVE and listening on port {server.port}.")
                print("[*] Keep this Command Prompt window OPEN while using WebMouse.\n")
                # Run forever
                await asyncio.Future()
        else:
            server_runner = PurePythonWebSocketServer(server)
            await server_runner.start()
    except OSError as e:
        err_str = str(e).lower()
        lan_ip = get_local_ip()
        print("\n" + "=" * 62)
        print(" [!] NOTICE: Port 8765 is already in use by a running process.")
        print("=" * 62)
        print(" WebMouse Helper is ALREADY RUNNING on this computer!")
        print(f" Connect your phone to Laptop Wi-Fi IP : {lan_ip}")
        print(f" WebSocket Port                        : {server.port}")
        print(f" 6-Digit Pairing PIN                   : {server.pairing_code}")
        print("=" * 62)
        print(" Window will stay OPEN so you can use the code above.")
        print(" (To restart completely, close other python windows or end task in Task Manager)")
        print("=" * 62 + "\n")
        # Keep window running forever so user can see code
        while True:
            await asyncio.sleep(3600)
    except Exception as e:
        print(f"[!] Server exception: {e}")
        # Keep window alive
        while True:
            await asyncio.sleep(3600)


if __name__ == "__main__":
    import time
    while True:
        try:
            asyncio.run(main())
            # If main ever exits, keep CMD open forever
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            print("\n[!] WebMouse Server stopped by user (Ctrl+C).")
            print("Press Enter to close window...")
            try:
                input()
            except:
                pass
            sys.exit(0)
        except Exception as e:
            import traceback
            print("\n" + "=" * 62)
            print(" [!] WebMouse Server encountered an error:")
            print("=" * 62)
            traceback.print_exc()
            print("=" * 62)
            print("Tip: If dependencies are missing, run: pip install websockets pyautogui")
            print("Keeping window OPEN so you can read this. Retrying in 10 seconds...\n")
            time.sleep(10)
