#!/usr/bin/env python3
"""
WebMouse V1 — Windows Local Helper Server
=========================================
Turns an Android or iPhone smartphone into a wireless mouse & keyboard
for a Windows computer over the same local Wi-Fi network.

Controls the REAL Windows cursor using PyAutoGUI (with ctypes user32 fallback).
Listens on WebSocket port 8765 with 6-digit pairing code authentication.
Accurately detects laptop Wi-Fi IP, displays scannable QR in CMD,
and gracefully handles HTTP browser requests without 'invalid Connection header: keep-alive'.
"""

import asyncio
import json
import random
import socket
import sys
import argparse
import os
import base64
import http
import subprocess
import re
import webbrowser
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

    # 1. On Windows: inspect ipconfig to find the Wireless / Wi-Fi adapter IPv4
    if sys.platform == "win32":
        try:
            output = subprocess.check_output("ipconfig", shell=True, text=True, errors="ignore")
            current_adapter = ""
            is_wifi = False
            for line in output.splitlines():
                stripped = line.strip()
                if line and not line.startswith(" ") and not line.startswith("\t"):
                    current_adapter = line.lower()
                    is_wifi = any(k in current_adapter for k in ["wireless", "wi-fi", "wifi", "wlan"])
                elif is_wifi and "ipv4" in stripped.lower():
                    match = re.search(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})", stripped)
                    if match:
                        found_ip = match.group(1)
                        if not found_ip.startswith("127.") and not found_ip.startswith("169.254."):
                            wifi_ip = found_ip
                            if found_ip not in all_ips:
                                all_ips.append(found_ip)
        except Exception:
            pass

    # 2. Probe default UDP routing interface (e.g. Wi-Fi router gateway)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        probe_ip = s.getsockname()[0]
        s.close()
        if probe_ip and not probe_ip.startswith("127.") and not probe_ip.startswith("169.254."):
            if not wifi_ip:
                wifi_ip = probe_ip
            if probe_ip not in all_ips:
                all_ips.append(probe_ip)
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
            print("=" * 60)
            print("        📷 PHONE SCANNER SE YE QR CODE SCAN KAREIN:")
            print("=" * 60)
            qr.print_ascii(invert=True)
            print("=" * 60 + "\n")
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
        print(" 2. Phone me WebMouse open karein:")
        print(f"    - Local IP:    {wifi_ip}")
        print(f"    - Pairing PIN: {self.pairing_code}")
        print(" 3. '⚡ Connect to PC' dabayein ya niche diya gaya QR scan karein!")
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

                # 1. Authentication Handshake with 6-digit pairing code
                if msg_type == "auth":
                    code = str(data.get("code", data.get("pin", data.get("token", "")))).strip()
                    device_name = str(data.get("deviceName", "Mobile Phone")).strip()

                    # Validate 6-digit pairing code
                    if code == self.pairing_code or (len(code) == 6 and code == self.pairing_code):
                        self.authenticated_clients.add(websocket)
                        self.client_info[websocket] = f"{device_name} ({client_addr})"
                        print(f"[OK] AUTHENTICATED: '{device_name}' from {client_addr} paired successfully!")
                        await websocket.send(json.dumps({
                            "type": "auth_result",
                            "success": True,
                            "computerName": socket.gethostname(),
                            "screenWidth": self.screen_width,
                            "screenHeight": self.screen_height,
                            "message": "Authentication successful"
                        }))
                    else:
                        print(f"[X] AUTH FAILED: Wrong pairing code '{code}' from {client_addr} (Expected: {self.pairing_code})")
                        await websocket.send(json.dumps({
                            "type": "auth_result",
                            "success": False,
                            "message": "Incorrect 6-digit pairing code. Please enter the code shown in the Windows terminal."
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

                # 18. Link Sharing
                elif msg_type == "share_link":
                    url = str(data.get("url", ""))
                    if url:
                        print(f"[*] Opening browser link: {url}")
                        webbrowser.open(url)

                # 19. Text Sharing (Copy to PC Clipboard)
                elif msg_type == "share_text":
                    text = str(data.get("text", ""))
                    if text and pyperclip:
                        pyperclip.copy(text)
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
                    filename = data.get("filename", "received_file")
                    downloads_dir = Path.home() / "Downloads" / "WebMouse"
                    downloads_dir.mkdir(parents=True, exist_ok=True)
                    
                    filename = os.path.basename(filename)
                    filepath = downloads_dir / filename
                    
                    base, ext = os.path.splitext(filename)
                    counter = 1
                    while filepath.exists():
                        filepath = downloads_dir / f"{base}_{counter}{ext}"
                        counter += 1
                        
                    self.active_file_transfers[websocket] = open(filepath, "wb")
                    print(f"[*] File transfer starting: {filepath}")

                elif msg_type == "file_chunk":
                    chunk = data.get("chunk", "")
                    if websocket in self.active_file_transfers:
                        try:
                            file_data = base64.b64decode(chunk)
                            self.active_file_transfers[websocket].write(file_data)
                        except Exception as e:
                            print(f"Error writing chunk: {e}")

                elif msg_type == "file_transfer_end":
                    if websocket in self.active_file_transfers:
                        try:
                            self.active_file_transfers[websocket].close()
                            del self.active_file_transfers[websocket]
                            print("[*] File transfer completed and saved to Downloads/WebMouse.")
                            await websocket.send(json.dumps({
                                "type": "notification",
                                "message": "File successfully saved to Downloads/WebMouse"
                            }))
                        except Exception as e:
                            print(f"Error closing file: {e}")

        except websockets.ConnectionClosed:
            pass
        except Exception as e:
            print(f"[!] Connection exception with {client_addr}: {e}")
        finally:
            info = self.client_info.pop(websocket, client_addr)
            self.authenticated_clients.discard(websocket)
            if websocket in self.active_file_transfers:
                try:
                    self.active_file_transfers[websocket].close()
                except Exception:
                    pass
                del self.active_file_transfers[websocket]
            print(f"[-] DISCONNECTED: {info}")


async def process_http_request(path: str, request_headers: Any, pairing_code: str, ip: str, port: int):
    """
    Handle plain HTTP browser requests gracefully on port 8765.
    Prevents: 'Failed to open a WebSocket connection: invalid Connection header: keep-alive.
    You cannot access a WebSocket server directly with a browser. You need a WebSocket client.'
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
        # Regular HTTP request from a browser! Serve informative status & connection page
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WebMouse V1 Helper Server</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #09090b;
      color: #f4f4f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }}
    .card {{
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 1.25rem;
      padding: 2rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }}
    .status-badge {{
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #052e16;
      color: #4ade80;
      border: 1px solid #166534;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-bottom: 1.25rem;
    }}
    .status-dot {{
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 10px #22c55e;
    }}
    h1 {{ font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; color: #fff; }}
    p.desc {{ font-size: 0.875rem; color: #a1a1aa; margin-bottom: 1.5rem; }}
    .info-box {{
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 0.75rem;
      padding: 1rem;
      margin-bottom: 1.25rem;
      text-align: left;
    }}
    .info-row {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.4rem 0;
      font-size: 0.85rem;
      border-bottom: 1px solid #1f1f23;
    }}
    .info-row:last-child {{ border-bottom: none; }}
    .info-label {{ color: #71717a; }}
    .info-val {{ color: #fafafa; font-family: monospace; font-weight: 600; }}
    .pin-box {{
      background: linear-gradient(135deg, #1e1b4b, #0f172a);
      border: 1px solid #4338ca;
      border-radius: 0.75rem;
      padding: 1rem;
      margin-bottom: 1.5rem;
    }}
    .pin-label {{ font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: #a5b4fc; font-weight: 700; margin-bottom: 0.25rem; }}
    .pin-code {{ font-size: 2.25rem; font-family: monospace; font-weight: 800; letter-spacing: 0.25em; color: #38bdf8; }}
    .instructions {{
      font-size: 0.8rem;
      color: #94a3b8;
      line-height: 1.5;
      text-align: left;
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 0.75rem;
      padding: 0.85rem 1rem;
      margin-bottom: 1.25rem;
    }}
    .instructions ol {{ margin-left: 1.25rem; }}
    .instructions li {{ margin-bottom: 0.35rem; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="status-badge">
      <span class="status-dot"></span>
      HELPER SERVER ACTIVE
    </div>
    <h1>WebMouse V1 Helper</h1>
    <p class="desc">Wireless Mouse & Keyboard Server for Windows</p>
    
    <div class="pin-box">
      <div class="pin-label">6-Digit Pairing Code</div>
      <div class="pin-code">{pairing_code}</div>
    </div>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Computer</span>
        <span class="info-val">{socket.gethostname()}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Wi-Fi IP Address</span>
        <span class="info-val">{ip}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Port</span>
        <span class="info-val">{port}</span>
      </div>
    </div>

    <div class="instructions">
      <ol>
        <li>Connect phone to the <strong>same Wi-Fi</strong>.</li>
        <li>In WebMouse on phone:</li>
        <li>Enter IP <code>{ip}</code> and PIN <code>{pairing_code}</code>.</li>
        <li>Tap <strong>Connect to PC</strong>!</li>
      </ol>
    </div>

    <div style="font-size: 0.75rem; color: #71717a;">
      WebSocket endpoint: <code>ws://{ip}:{port}/</code>
    </div>
  </div>
</body>
</html>"""
        body = html.encode("utf-8")
        return (
            http.HTTPStatus.OK,
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
