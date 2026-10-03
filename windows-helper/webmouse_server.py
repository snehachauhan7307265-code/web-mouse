#!/usr/bin/env python3
"""
WebMouse V1 — Windows Local Helper Server
=========================================
Turns an Android or iPhone smartphone into a wireless mouse & keyboard
for a Windows computer over the same local Wi-Fi network.

Controls the REAL Windows cursor using PyAutoGUI (with ctypes user32 fallback).
Listens on WebSocket port 8765 with 6-digit pairing code authentication.
Accurately detects laptop Wi-Fi IP, displays scannable QR in CMD,
serves the WebMouse web controller over HTTP directly on port 8765,
and gracefully avoids Mixed Content errors.
"""

import asyncio
import json
import random
import socket
import sys
import argparse
import os
import mimetypes
import subprocess
import re
from pathlib import Path
from typing import Set, Dict, Any, Optional, Tuple, List

# Windows Native user32 fallback controller
class WindowsNativeController:
    """Zero-dependency Windows cursor & keyboard controller using ctypes.windll.user32."""
    def __init__(self):
        import ctypes
        windll = getattr(ctypes, "windll", None)
        self.user32 = windll.user32 if windll else None
        self.PAUSE = 0.0
        self.FAILSAFE = False

    def size(self):
        if self.user32:
            try:
                return (self.user32.GetSystemMetrics(0), self.user32.GetSystemMetrics(1))
            except Exception:
                pass
        return (1920, 1080)

    def moveRel(self, dx, dy, _pause=False):
        if self.user32:
            self.user32.mouse_event(0x0001, int(dx), int(dy), 0, 0)

    def click(self, button="left"):
        if not self.user32: return
        if button == "left":
            self.user32.mouse_event(0x0002, 0, 0, 0, 0)
            self.user32.mouse_event(0x0004, 0, 0, 0, 0)
        elif button == "right":
            self.user32.mouse_event(0x0008, 0, 0, 0, 0)
            self.user32.mouse_event(0x0010, 0, 0, 0, 0)
        elif button == "middle":
            self.user32.mouse_event(0x0020, 0, 0, 0, 0)
            self.user32.mouse_event(0x0040, 0, 0, 0, 0)

    def doubleClick(self, button="left"):
        import time
        self.click(button)
        time.sleep(0.05)
        self.click(button)

    def mouseDown(self, button="left"):
        if not self.user32: return
        if button == "left":
            self.user32.mouse_event(0x0002, 0, 0, 0, 0)
        elif button == "right":
            self.user32.mouse_event(0x0008, 0, 0, 0, 0)
        elif button == "middle":
            self.user32.mouse_event(0x0020, 0, 0, 0, 0)

    def mouseUp(self, button="left"):
        if not self.user32: return
        if button == "left":
            self.user32.mouse_event(0x0004, 0, 0, 0, 0)
        elif button == "right":
            self.user32.mouse_event(0x0010, 0, 0, 0, 0)
        elif button == "middle":
            self.user32.mouse_event(0x0040, 0, 0, 0, 0)

    def scroll(self, amount):
        if not self.user32: return
        self.user32.mouse_event(0x0800, 0, 0, int(amount * 120), 0)

    def hscroll(self, amount):
        if not self.user32: return
        self.user32.mouse_event(0x1000, 0, 0, int(amount * 120), 0)

    def press(self, key):
        if not self.user32: return
        vk = VK_CODE_MAP.get(str(key).lower())
        if vk:
            self.user32.keybd_event(vk, 0, 0, 0)
            self.user32.keybd_event(vk, 0, 2, 0)

    def write(self, text, interval=0.001):
        if not self.user32: return
        for char in text:
            code = ord(char)
            self.user32.keybd_event(0, code, 4, 0)
            self.user32.keybd_event(0, code, 4 | 2, 0)

    def hotkey(self, *keys):
        if not self.user32: return
        vks = [VK_CODE_MAP.get(str(k).lower()) for k in keys if VK_CODE_MAP.get(str(k).lower())]
        for vk in vks:
            self.user32.keybd_event(vk, 0, 0, 0)
        for vk in reversed(vks):
            self.user32.keybd_event(vk, 0, 2, 0)

VK_CODE_MAP = {
    "enter": 0x0D, "return": 0x0D, "backspace": 0x08, "tab": 0x09, "escape": 0x1B, "esc": 0x1B,
    "space": 0x20, "left": 0x25, "up": 0x26, "right": 0x27, "down": 0x28, "delete": 0x2E,
    "shift": 0x10, "ctrl": 0x11, "control": 0x11, "alt": 0x12, "win": 0x5B, "capslock": 0x14,
    "home": 0x24, "end": 0x23, "pageup": 0x21, "pagedown": 0x22, "insert": 0x2D, "printscreen": 0x2C,
    "volumemute": 0xAD, "volumedown": 0xAE, "volumeup": 0xAF, "playpause": 0xB3,
    "f1": 0x70, "f2": 0x71, "f3": 0x72, "f4": 0x73, "f5": 0x74, "f6": 0x75,
    "f7": 0x76, "f8": 0x77, "f9": 0x78, "f10": 0x79, "f11": 0x7A, "f12": 0x7B,
}

# Mouse / Keyboard backend initialization
pyautogui = None
try:
    import pyautogui
    pyautogui.PAUSE = 0.0
    pyautogui.FAILSAFE = False
except Exception:
    pyautogui = WindowsNativeController()

try:
    import pyperclip
except ImportError:
    pyperclip = None

# Websockets import with automatic pip fallback
try:
    import websockets
    from websockets.server import WebSocketServerProtocol
except ImportError:
    try:
        print("[*] Installing 'websockets' library...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        import websockets
        from websockets.server import WebSocketServerProtocol
    except Exception:
        print("\n[ERROR] Missing required package 'websockets'!")
        print("Please install requirements using: pip install websockets pyautogui pyperclip\n")
        sys.exit(1)

# QR Code import with automatic pip fallback
qrcode = None
try:
    import qrcode
except ImportError:
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "qrcode"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        import qrcode
    except Exception:
        qrcode = None

KEY_MAP = {
    "enter": "enter", "return": "enter", "backspace": "backspace", "delete": "delete",
    "tab": "tab", "escape": "esc", "esc": "esc", "space": "space",
    "up": "up", "down": "down", "left": "left", "right": "right",
    "shift": "shift", "ctrl": "ctrl", "control": "ctrl", "alt": "alt",
    "win": "win", "windows": "win", "meta": "win", "super": "win",
    "capslock": "capslock", "home": "home", "end": "end", "pageup": "pageup",
    "pagedown": "pagedown", "insert": "insert", "prtscr": "printscreen", "printscreen": "printscreen",
    "volumemute": "volumemute", "volumedown": "volumedown", "volumeup": "volumeup", "playpause": "playpause",
    "f1": "f1", "f2": "f2", "f3": "f3", "f4": "f4", "f5": "f5", "f6": "f6",
    "f7": "f7", "f8": "f8", "f9": "f9", "f10": "f10", "f11": "f11", "f12": "f12",
}

def get_wifi_and_all_ips() -> Tuple[str, List[str]]:
    """
    Detect the exact Wi-Fi IP address on Windows, along with any other local network IPs.
    Prioritizes real active Wi-Fi adapters over virtual/loopback adapters.
    """
    wifi_ip = None
    all_ips: List[str] = []

    # 1. Active network route probe: Connect UDP socket to public gateway (most accurate on Windows)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        probe_ip = s.getsockname()[0]
        s.close()
        if probe_ip and not probe_ip.startswith("127.") and not probe_ip.startswith("169.254."):
            wifi_ip = probe_ip
            all_ips.append(probe_ip)
    except Exception:
        pass

    # 2. On Windows: inspect ipconfig to find the Wireless / Wi-Fi adapter IPv4
    if sys.platform == "win32":
        try:
            output = subprocess.check_output("ipconfig", shell=True, text=True, errors="ignore")
            current_adapter = ""
            is_real_wifi = False
            for line in output.splitlines():
                stripped = line.strip()
                if line and not line.startswith(" ") and not line.startswith("\t"):
                    current_adapter = line.lower()
                    # Check for genuine Wi-Fi adapter, exclude virtual adapters like Wi-Fi Direct or VirtualBox
                    has_wifi_keyword = any(k in current_adapter for k in ["wireless", "wi-fi", "wifi", "wlan"])
                    is_virtual = any(k in current_adapter for k in ["virtual", "direct", "vmware", "virtualbox", "bluetooth", "loopback", "vethernet"])
                    is_real_wifi = has_wifi_keyword and not is_virtual
                elif is_real_wifi and "ipv4" in stripped.lower():
                    match = re.search(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})", stripped)
                    if match:
                        found_ip = match.group(1)
                        if not found_ip.startswith("127.") and not found_ip.startswith("169.254."):
                            if not wifi_ip:
                                wifi_ip = found_ip
                            if found_ip not in all_ips:
                                all_ips.append(found_ip)
        except Exception:
            pass

    # 3. Hostname resolution fallback
    try:
        host_ip = socket.gethostbyname(socket.gethostname())
        if host_ip and not host_ip.startswith("127.") and not host_ip.startswith("169.254."):
            if not wifi_ip:
                wifi_ip = host_ip
            if host_ip not in all_ips:
                all_ips.append(host_ip)
    except Exception:
        pass

    if not wifi_ip:
        wifi_ip = "127.0.0.1"
    if not all_ips:
        all_ips = [wifi_ip]

    return wifi_ip, all_ips

def print_ascii_qr(data: str):
    """Render a clean QR code in the Windows CMD terminal."""
    global qrcode
    if qrcode is None:
        try:
            import qrcode as _qr
            qrcode = _qr
        except Exception:
            pass

    if qrcode is not None:
        try:
            qr = qrcode.QRCode(border=1)
            qr.add_data(data)
            qr.make(fit=True)
            print("=" * 62)
            print("        📷 PHONE CAMERA SE YE QR CODE SCAN KAREIN:")
            print("=" * 62)
            qr.print_ascii(invert=True)
            print("=" * 62 + "\n")
            return
        except Exception:
            pass

    print("\n[NOTE] Terminal QR: Install 'qrcode' (pip install qrcode) to view QR in CMD.")


class WebMouseServer:
    def __init__(self, host: str, port: int, pairing_code: str):
        self.host = host
        self.port = port
        self.pairing_code = pairing_code
        self.authenticated_clients: Set[Any] = set()
        self.client_info: Dict[Any, str] = {}
        self.active_file_transfers: Dict[Any, Any] = {}
        
        try:
            self.screen_width, self.screen_height = pyautogui.size()
        except Exception:
            self.screen_width, self.screen_height = (1920, 1080)

    def print_banner(self, wifi_ip: str, all_ips: List[str]):
        computer_name = socket.gethostname()
        print("\n" + "=" * 62)
        print("             WEBMOUSE V1 — WINDOWS HELPER SERVER")
        print("          Phone -> Computer control over Wi-Fi")
        print("=" * 62)
        print(f" Status:       RUNNING (Port {self.port})")
        print(f" Computer:     {computer_name}")
        print(f" Wi-Fi IP:     {wifi_ip}   <=== [Enter this IP in Phone]")
        print(f" Port:         {self.port}")
        print(f" Pairing PIN:  {self.pairing_code}       <=== [Enter this 6-Digit PIN]")
        if len(all_ips) > 1:
            other_ips = [ip for ip in all_ips if ip != wifi_ip]
            if other_ips:
                print(f" Other IPs:    {', '.join(other_ips)}")
        print("-" * 62)
        print(" HOW TO CONNECT FROM PHONE:")
        print(" 1. Phone aur Laptop ko SAME Wi-Fi se connect karein.")
        print(" 2. Phone me WebMouse open karke ye enter karein:")
        print(f"    - Local IP:    {wifi_ip}")
        print(f"    - Pairing PIN: {self.pairing_code}")
        print(" 3. Ya Phone Camera se niche diya gaya QR Code scan karein!")
        print(f"    Direct URL: http://{wifi_ip}:{self.port}/?pair={self.pairing_code}")
        print("=" * 62)
        
        # QR Code payload: standard URL that opens the local app directly with zero Mixed Content issues
        qr_payload = f"http://{wifi_ip}:{self.port}/?pair={self.pairing_code}"
        print_ascii_qr(qr_payload)
        print(f"[*] Awaiting connection from phone on port {self.port}...\n")

    async def handle_connection(self, websocket: Any):
        peer = getattr(websocket, "remote_address", ("unknown", 0))
        client_addr = f"{peer[0]}:{peer[1]}"
        print(f"[+] CONNECTED: Phone from {client_addr}")

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

                # 1. Universal Authentication Handshake with 6-digit pairing code
                if msg_type in ["auth", "hello", "pair", "authenticate"]:
                    code = str(data.get("code") or data.get("pin") or data.get("pairingCode") or data.get("token") or data.get("pairingToken") or "").strip()
                    device_name = str(data.get("deviceName", "Mobile Phone")).strip()

                    # Validate 6-digit pairing code
                    if code == self.pairing_code or (len(code) == 6 and code == self.pairing_code):
                        self.authenticated_clients.add(websocket)
                        self.client_info[websocket] = f"{device_name} ({client_addr})"
                        print(f"[OK] AUTHENTICATED: '{device_name}' from {client_addr} paired successfully!")
                        
                        # Send auth_result (V1 standard)
                        await websocket.send(json.dumps({
                            "type": "auth_result",
                            "status": "authenticated",
                            "success": True,
                            "computerName": socket.gethostname(),
                            "deviceName": socket.gethostname(),
                            "screenWidth": self.screen_width,
                            "screenHeight": self.screen_height,
                            "capabilities": ["mouse", "keyboard", "media", "presentation"],
                            "message": "Authentication successful"
                        }))
                        # Also send hello_ack & connection_ready for V2 protocol compatibility
                        await websocket.send(json.dumps({
                            "type": "hello_ack",
                            "status": "authenticated",
                            "computerName": socket.gethostname(),
                            "capabilities": ["mouse", "keyboard", "media", "presentation"]
                        }))
                        await websocket.send(json.dumps({
                            "type": "connection_ready"
                        }))
                    else:
                        print(f"[X] AUTH FAILED: Wrong pairing code '{code}' from {client_addr} (Expected: {self.pairing_code})")
                        await websocket.send(json.dumps({
                            "type": "auth_result",
                            "success": False,
                            "message": "Incorrect 6-digit pairing code. Please enter the code shown in the Windows CMD window."
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

                # 3. Mouse Movement (Real Windows Cursor)
                elif msg_type == "mouse_move":
                    dx = float(data.get("dx", 0))
                    dy = float(data.get("dy", 0))
                    try:
                        pyautogui.moveRel(dx, dy, _pause=False)
                    except Exception as e:
                        print(f"Error moving mouse: {e}")

                # 4. Left Click
                elif msg_type == "left_click":
                    try:
                        pyautogui.click(button="left")
                    except Exception as e:
                        print(f"Error left_click: {e}")

                # 5. Right Click
                elif msg_type == "right_click":
                    try:
                        pyautogui.click(button="right")
                    except Exception as e:
                        print(f"Error right_click: {e}")

                # 6. Middle Click
                elif msg_type == "middle_click":
                    try:
                        pyautogui.click(button="middle")
                    except Exception as e:
                        print(f"Error middle_click: {e}")

                # 7. Double Click
                elif msg_type == "double_click":
                    try:
                        pyautogui.doubleClick(button="left")
                    except Exception as e:
                        print(f"Error double_click: {e}")

                # 8. Mouse Down (Drag Mode engage)
                elif msg_type == "mouse_down":
                    button = data.get("button", "left")
                    if button not in ["left", "right", "middle"]:
                        button = "left"
                    try:
                        pyautogui.mouseDown(button=button)
                    except Exception as e:
                        print(f"Error mouse_down: {e}")

                # 9. Mouse Up (Drag Mode release)
                elif msg_type == "mouse_up":
                    button = data.get("button", "left")
                    if button not in ["left", "right", "middle"]:
                        button = "left"
                    try:
                        pyautogui.mouseUp(button=button)
                    except Exception as e:
                        print(f"Error mouse_up: {e}")

                # 10. Mouse Wheel Scroll
                elif msg_type == "scroll":
                    amount = int(data.get("amount", 0))
                    try:
                        pyautogui.scroll(amount)
                    except Exception as e:
                        print(f"Error scroll: {e}")

                # 11. Horizontal Scroll
                elif msg_type == "hscroll":
                    amount = int(data.get("amount", 0))
                    try:
                        if hasattr(pyautogui, "hscroll"):
                            pyautogui.hscroll(amount)
                    except Exception:
                        pass

                # 12. Single Key Press
                elif msg_type == "key":
                    key_val = str(data.get("key", "")).lower()
                    mapped_key = KEY_MAP.get(key_val, key_val)
                    try:
                        pyautogui.press(mapped_key)
                    except Exception as e:
                        print(f"Error pressing key '{key_val}': {e}")

                # 13. Type Full Text String
                elif msg_type == "type_text":
                    text = str(data.get("text", ""))
                    if text:
                        try:
                            pyautogui.write(text, interval=0.005)
                        except Exception as e:
                            print(f"Error typing text: {e}")

                # 14. Keyboard Shortcuts (e.g. ['ctrl', 'c'])
                elif msg_type == "shortcut":
                    keys = data.get("keys", [])
                    if isinstance(keys, list) and len(keys) > 0:
                        mapped_keys = [KEY_MAP.get(k.lower(), k.lower()) for k in keys]
                        try:
                            pyautogui.hotkey(*mapped_keys)
                        except Exception as e:
                            print(f"Error executing shortcut {keys}: {e}")

                # 15. Media Controls
                elif msg_type == "media_control":
                    action = str(data.get("action", "")).lower()
                    if action in ["playpause", "nexttrack", "prevtrack", "volumeup", "volumedown", "volumemute"]:
                        try:
                            pyautogui.press(action)
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
                    except Exception as e:
                        print(f"Error quick control: {e}")

                # 18. Link Sharing & Open URL
                elif msg_type in ("open_url", "share_link"):
                    url = str(data.get("url", ""))
                    if url:
                        try:
                            import webbrowser
                            if not url.startswith("http://") and not url.startswith("https://") and not ":" in url:
                                url = f"https://{url}"
                            webbrowser.open(url)
                            await websocket.send(json.dumps({
                                "type": "notification",
                                "message": f"Opened link: {url}"
                            }))
                        except Exception as e:
                            print(f"Error opening link: {e}")

                # 18b. Open Application (YouTube, Chrome, Notepad, etc.)
                elif msg_type == "open_app":
                    app_name = str(data.get("app", "")).lower().strip()
                    try:
                        import webbrowser, os, subprocess
                        if app_name in ("youtube", "yt", "youtube.com"):
                            webbrowser.open("https://www.youtube.com")
                        elif app_name in ("google", "search"):
                            webbrowser.open("https://www.google.com")
                        elif app_name in ("spotify", "music"):
                            try:
                                os.startfile("spotify:")
                            except Exception:
                                webbrowser.open("https://open.spotify.com")
                        elif app_name in ("whatsapp", "wa"):
                            try:
                                os.startfile("whatsapp:")
                            except Exception:
                                webbrowser.open("https://web.whatsapp.com")
                        elif app_name in ("chrome", "google-chrome", "google chrome"):
                            subprocess.Popen('start "" "chrome"', shell=True)
                        elif app_name in ("edge", "msedge"):
                            subprocess.Popen('start "" "msedge"', shell=True)
                        elif app_name in ("notepad", "notepad.exe"):
                            subprocess.Popen('start "" "notepad"', shell=True)
                        elif app_name in ("calc", "calculator"):
                            subprocess.Popen('start "" "calc"', shell=True)
                        elif app_name in ("explorer", "files"):
                            subprocess.Popen('start "" "explorer"', shell=True)
                        elif app_name in ("taskmgr", "task manager"):
                            subprocess.Popen('start "" "taskmgr"', shell=True)
                        elif app_name in ("paint", "mspaint"):
                            subprocess.Popen('start "" "mspaint"', shell=True)
                        elif app_name in ("settings", "control"):
                            subprocess.Popen('start ms-settings:', shell=True)
                        else:
                            try:
                                subprocess.Popen(f'start "" "{app_name}"', shell=True)
                            except Exception:
                                webbrowser.open(f"https://www.google.com/search?q={app_name}")
                        await websocket.send(json.dumps({
                            "type": "notification",
                            "message": f"Opened application: {app_name}"
                        }))
                    except Exception as e:
                        print(f"Error opening app {app_name}: {e}")

                # 18c. Voice Command execution
                elif msg_type == "voice_command":
                    query = str(data.get("query", "")).strip().lower()
                    target = str(data.get("target", ""))
                    action = str(data.get("action", ""))
                    import webbrowser, subprocess
                    try:
                        if "youtube" in query:
                            webbrowser.open("https://www.youtube.com")
                        elif "chrome" in query:
                            subprocess.Popen('start "" "chrome"', shell=True)
                        elif target and action == "open_url":
                            webbrowser.open(target)
                        else:
                            subprocess.Popen(f'start "" "{query}"', shell=True)
                    except Exception as e:
                        print(f"Error executing voice command: {e}")

                # 19. Clipboard Sharing
                elif msg_type == "clipboard":
                    text = str(data.get("text", ""))
                    if text and pyperclip:
                        try:
                            pyperclip.copy(text)
                            await websocket.send(json.dumps({
                                "type": "notification",
                                "message": "Copied text to Windows clipboard"
                            }))
                        except Exception as e:
                            print(f"Error copying to clipboard: {e}")

                # 20. Screen Capture / Screenshot
                elif msg_type == "take_screenshot":
                    try:
                        import io
                        import base64
                        from PIL import ImageGrab
                        screenshot = ImageGrab.grab()
                        # Resize thumbnail for performance
                        screenshot.thumbnail((1280, 720))
                        buffer = io.BytesIO()
                        screenshot.save(buffer, format="JPEG", quality=75)
                        img_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
                        await websocket.send(json.dumps({
                            "type": "screenshot_result",
                            "success": True,
                            "data": f"data:image/jpeg;base64,{img_str}",
                            "filename": f"screenshot_{int(asyncio.get_event_loop().time())}.jpg"
                        }))
                    except Exception as e:
                        await websocket.send(json.dumps({
                            "type": "screenshot_result",
                            "success": False,
                            "error": str(e)
                        }))

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            if websocket in self.authenticated_clients:
                self.authenticated_clients.remove(websocket)
            info = self.client_info.pop(websocket, client_addr)
            print(f"[-] DISCONNECTED: {info}")


def get_static_web_file(req_path: str) -> Optional[Tuple[bytes, str]]:
    """Look for static web files in web_dist, dist, or adjacent folders."""
    script_dir = Path(__file__).parent.resolve()
    candidate_dirs = [
        script_dir / "web_dist",
        script_dir / "dist",
        script_dir.parent / "dist",
        script_dir / "windows-helper" / "web_dist",
    ]

    clean_path = req_path.split("?")[0].lstrip("/")
    if not clean_path or clean_path == "":
        clean_path = "index.html"

    for base_dir in candidate_dirs:
        if base_dir.is_dir():
            target = (base_dir / clean_path).resolve()
            # Ensure within base_dir to avoid directory traversal
            if str(target).startswith(str(base_dir.resolve())) and target.is_file():
                try:
                    mime, _ = mimetypes.guess_type(str(target))
                    if not mime:
                        if target.suffix == ".js": mime = "application/javascript"
                        elif target.suffix == ".css": mime = "text/css"
                        elif target.suffix == ".html": mime = "text/html"
                        else: mime = "application/octet-stream"
                    return target.read_bytes(), mime
                except Exception:
                    pass

            # SPA fallback: if not found and doesn't have an extension, try index.html
            if "." not in clean_path:
                spa_index = base_dir / "index.html"
                if spa_index.is_file():
                    try:
                        return spa_index.read_bytes(), "text/html; charset=utf-8"
                    except Exception:
                        pass
    return None


def get_standalone_touch_controller_html(pairing_code: str, ip: str, port: int) -> bytes:
    """Built-in ultra-fast mobile touch controller served directly from Python."""
    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>WebMouse Controller</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #09090b;
      color: #f4f4f5;
      height: 100vh;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: #18181b;
      border-bottom: 1px solid #27272a;
    }
    .brand { font-weight: 800; font-size: 0.95rem; color: #fff; letter-spacing: -0.02em; }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      background: #052e16;
      color: #4ade80;
      border: 1px solid #166534;
    }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; }
    .trackpad {
      flex: 1;
      margin: 0.75rem;
      background: #121215;
      border: 2px dashed #27272a;
      border-radius: 1.25rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      touch-action: none;
      position: relative;
    }
    .trackpad-hint { font-size: 0.8rem; color: #71717a; pointer-events: none; }
    .click-bar {
      display: flex;
      gap: 0.5rem;
      padding: 0 0.75rem 0.5rem;
      height: 4.5rem;
    }
    .btn-click {
      flex: 1;
      background: #1e1e24;
      border: 1px solid #3f3f46;
      border-radius: 0.85rem;
      color: #fff;
      font-weight: 700;
      font-size: 0.85rem;
      touch-action: manipulation;
    }
    .btn-click:active { background: #4f46e5; }
    .toolbar {
      display: flex;
      gap: 0.4rem;
      padding: 0 0.75rem 0.75rem;
    }
    .tool-btn {
      flex: 1;
      padding: 0.6rem 0.2rem;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.65rem;
      color: #a1a1aa;
      font-size: 0.7rem;
      font-weight: 600;
      text-align: center;
    }
    .tool-btn:active { background: #27272a; color: #fff; }
    .input-row {
      display: flex;
      gap: 0.4rem;
      padding: 0 0.75rem 0.5rem;
    }
    .text-input {
      flex: 1;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.65rem;
      padding: 0.5rem 0.75rem;
      color: #fff;
      font-size: 0.8rem;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">🖱️ WebMouse V1</div>
    <div id="statusBadge" class="status">
      <span class="status-dot"></span>
      <span id="statusText">Connecting...</span>
    </div>
  </header>

  <div id="trackpad" class="trackpad">
    <div class="trackpad-hint">Touch &amp; Drag to move real PC cursor</div>
    <div class="trackpad-hint" style="font-size:0.7rem; margin-top:4px;">Tap to Left Click • 2 Fingers to Right Click</div>
  </div>

  <div class="click-bar">
    <button id="btnLeft" class="btn-click">LEFT CLICK</button>
    <button id="btnRight" class="btn-click">RIGHT CLICK</button>
  </div>

  <div class="input-row">
    <input id="typeInput" class="text-input" placeholder="Type text to send to PC..." />
    <button id="btnSendText" class="tool-btn" style="flex:0 0 4rem; background:#4f46e5; color:#fff;">Send</button>
  </div>

  <div class="toolbar">
    <button onclick="sendShortcut(['win','d'])" class="tool-btn">Desktop</button>
    <button onclick="sendMedia('volumeup')" class="tool-btn">Vol +</button>
    <button onclick="sendMedia('volumedown')" class="tool-btn">Vol -</button>
    <button onclick="sendMedia('playpause')" class="tool-btn">Play/Pause</button>
    <button onclick="sendShortcut(['win','l'])" class="tool-btn">Lock</button>
  </div>

  <script>
    const urlParams = new URLSearchParams(window.location.search);
    const pin = urlParams.get('pair') || urlParams.get('code') || '__PAIRING_CODE__';
    const hostName = window.location.hostname || '__IP__';
    const portNum = window.location.port || '__PORT__';
    const wsUrl = 'ws://' + hostName + ':' + portNum;

    let ws = null;
    function connect() {
      document.getElementById('statusText').innerText = 'Connecting...';
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        document.getElementById('statusText').innerText = 'Authenticating...';
        ws.send(JSON.stringify({
          type: 'auth',
          code: pin,
          pin: pin,
          deviceName: navigator.userAgent.includes('iPhone') ? 'iPhone' : 'Android Phone'
        }));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'auth_result' && msg.success) {
            document.getElementById('statusText').innerText = 'Connected 🟢';
            document.getElementById('statusBadge').style.background = '#052e16';
          }
        } catch(err) {}
      };

      ws.onclose = () => {
        document.getElementById('statusText').innerText = 'Disconnected';
        document.getElementById('statusBadge').style.background = '#450a0a';
        setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        document.getElementById('statusText').innerText = 'Error';
      };
    }
    connect();

    function sendCmd(cmd) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(cmd));
      }
    }

    const pad = document.getElementById('trackpad');
    let lastX = 0, lastY = 0, touchCount = 0, tapStart = 0;

    pad.addEventListener('touchstart', (e) => {
      touchCount = e.touches.length;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      tapStart = Date.now();
    }, { passive: false });

    pad.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const dx = (e.touches[0].clientX - lastX) * 1.6;
        const dy = (e.touches[0].clientY - lastY) * 1.6;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        sendCmd({ type: 'mouse_move', dx: Math.round(dx), dy: Math.round(dy) });
      } else if (e.touches.length === 2) {
        const dy = e.touches[0].clientY - lastY;
        lastY = e.touches[0].clientY;
        if (Math.abs(dy) > 2) {
          sendCmd({ type: 'scroll', amount: dy > 0 ? 1 : -1 });
        }
      }
    }, { passive: false });

    pad.addEventListener('touchend', (e) => {
      const duration = Date.now() - tapStart;
      if (duration < 250) {
        if (touchCount === 1) sendCmd({ type: 'left_click' });
        else if (touchCount === 2) sendCmd({ type: 'right_click' });
      }
    });

    document.getElementById('btnLeft').addEventListener('click', () => sendCmd({ type: 'left_click' }));
    document.getElementById('btnRight').addEventListener('click', () => sendCmd({ type: 'right_click' }));

    document.getElementById('btnSendText').addEventListener('click', () => {
      const inp = document.getElementById('typeInput');
      if (inp.value) {
        sendCmd({ type: 'type_text', text: inp.value });
        inp.value = '';
      }
    });

    window.sendMedia = (action) => sendCmd({ type: 'media_control', action });
    window.sendShortcut = (keys) => sendCmd({ type: 'shortcut', keys });
  </script>
</body>
</html>"""
    html = html.replace("__PAIRING_CODE__", pairing_code).replace("__IP__", ip).replace("__PORT__", str(port))
    return html.encode("utf-8")


async def process_http_request(path: str, request_headers: Any, pairing_code: str, ip: str, port: int):
    """
    Handle plain HTTP browser requests gracefully on port 8765.
    1. Check if Upgrade is 'websocket' - if so, allow normal WebSocket upgrade.
    2. If regular browser HTTP GET:
       - Check for static files in web_dist / dist (serves the full WebMouse React app)
       - If not present, serve the standalone touch controller HTML!
    """
    upgrade = ""
    if hasattr(request_headers, "get"):
        upgrade = request_headers.get("Upgrade", "")
    elif isinstance(request_headers, (list, tuple)):
        for name, value in request_headers:
            if str(name).lower() == "upgrade":
                upgrade = str(value)
                break

    if upgrade.lower() != "websocket":
        # Check for static assets from built web client
        static_res = get_static_web_file(path)
        if static_res:
            body, mime = static_res
            return (
                200,
                [
                    ("Content-Type", mime),
                    ("Content-Length", str(len(body))),
                    ("Access-Control-Allow-Origin", "*"),
                    ("Cache-Control", "no-cache"),
                    ("Connection", "close"),
                ],
                body
            )

        # Fallback to standalone mobile touch controller
        body = get_standalone_touch_controller_html(pairing_code, ip, port)
        return (
            200,
            [
                ("Content-Type", "text/html; charset=utf-8"),
                ("Content-Length", str(len(body))),
                ("Access-Control-Allow-Origin", "*"),
                ("Connection", "close"),
            ],
            body
        )
    return None


async def main():
    parser = argparse.ArgumentParser(description="WebMouse V1 — Windows Local Helper")
    parser.add_argument("--port", type=int, default=8765, help="Port to listen on (default: 8765)")
    parser.add_argument("--code", type=str, default="", help="6-digit pairing code (default: auto-generate)")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host interface (default: 0.0.0.0)")
    args = parser.parse_args()

    # Generate 6-digit code if not specified
    if args.code and len(args.code) == 6 and args.code.isdigit():
        pairing_code = args.code
    else:
        pairing_code = f"{random.randint(100000, 999999)}"

    wifi_ip, all_ips = get_wifi_and_all_ips()
    server = WebMouseServer(host=args.host, port=args.port, pairing_code=pairing_code)
    server.print_banner(wifi_ip, all_ips)

    # Custom process_request hook to gracefully handle browser HTTP requests
    async def request_hook(path, request_headers):
        return await process_http_request(path, request_headers, pairing_code, wifi_ip, args.port)

    # Start the WebSocket server on port 8765
    async with websockets.serve(
        server.handle_connection,
        server.host,
        server.port,
        process_request=request_hook,
        ping_interval=20,
        ping_timeout=20,
        max_size=10_000_000
    ):
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[!] WebMouse Server stopped by user.")
        sys.exit(0)
