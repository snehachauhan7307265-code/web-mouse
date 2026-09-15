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
from typing import Set, Dict

try:
    import pyperclip
except ImportError:
    pyperclip = None
    print("[WARNING] pyperclip not installed. Clipboard sync will be disabled.")

try:
    import pyautogui
    # Disable PyAutoGUI's default pause for real-time cursor responsiveness
    pyautogui.PAUSE = 0.0
    # Disable PyAutoGUI failsafe so moving to edge of screen doesn't crash server
    pyautogui.FAILSAFE = False
except ImportError:
    print("\n[ERROR] Missing required package 'pyautogui'!")
    print("Please install requirements using: pip install -r requirements.txt\n")
    sys.exit(1)

try:
    import websockets
    from websockets.server import WebSocketServerProtocol
except ImportError:
    print("\n[ERROR] Missing required package 'websockets'!")
    print("Please install requirements using: pip install -r requirements.txt\n")
    sys.exit(1)


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
    Detect the primary LAN IPv4 address of this computer on the local Wi-Fi/Ethernet.
    Uses a dummy UDP socket to find the routing interface.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Does not actually transmit packets, just routes to default interface
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        try:
            ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            ip = "127.0.0.1"
    finally:
        s.close()
    return ip


class WebMouseServer:
    def __init__(self, host: str, port: int, pairing_code: str):
        self.host = host
        self.port = port
        self.pairing_code = pairing_code
        self.authenticated_clients: Set[WebSocketServerProtocol] = set()
        self.client_info: Dict[WebSocketServerProtocol, str] = {}
        
        # Screen dimensions
        try:
            self.screen_width, self.screen_height = pyautogui.size()
        except Exception:
            self.screen_width, self.screen_height = (1920, 1080)

    def print_banner(self):
        computer_name = socket.gethostname()
        ip = get_local_ip()
        print("\n" + "=" * 48)
        print("                  WEBMOUSE V1")
        print("    Phone -> Computer control over Wi-Fi")
        print("=" * 48)
        print(f"Status:       Running")
        print(f"Computer:     {computer_name}")
        print(f"Computer IP:  {ip}")
        print(f"Port:         {self.port}")
        print(f"Pairing Code: {self.pairing_code}")
        print("-" * 48)
        print("Open WebMouse on your smartphone browser:")
        print("1. Connect phone to same Wi-Fi as this PC")
        print(f"2. Enter Computer IP:  {ip}")
        print(f"3. Enter Pairing Code: {self.pairing_code}")
        print("4. Tap 'Connect'")
        print("=" * 48 + "\n")
        print("Awaiting connection from phone...\n")

    async def handle_connection(self, websocket: WebSocketServerProtocol):
        peer = websocket.remote_address
        client_addr = f"{peer[0]}:{peer[1]}"
        print(f"CONNECTED: Client from {client_addr}")

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

                # 1. Authentication Handshake
                if msg_type == "auth":
                    code = str(data.get("code", "")).strip()
                    device_name = str(data.get("deviceName", "Mobile Phone")).strip()

                    if code == self.pairing_code:
                        self.authenticated_clients.add(websocket)
                        self.client_info[websocket] = f"{device_name} ({client_addr})"
                        print(f"AUTHENTICATED: '{device_name}' from {client_addr} paired successfully.")
                        await websocket.send(json.dumps({
                            "type": "auth_result",
                            "success": True,
                            "computerName": socket.gethostname(),
                            "screenWidth": self.screen_width,
                            "screenHeight": self.screen_height,
                            "message": "Authentication successful"
                        }))
                    else:
                        print(f"AUTH FAILED: Wrong pairing code '{code}' from {client_addr}")
                        await websocket.send(json.dumps({
                            "type": "auth_result",
                            "success": False,
                            "message": "Incorrect 6-digit pairing code"
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
                    self.active_file_transfers[websocket] = open(filepath, "wb")
                    print(f"FILE TRANSFER STARTED: {filepath}")

                elif msg_type == "file_chunk":
                    chunk = data.get("chunk", "")
                    if websocket in getattr(self, "active_file_transfers", {}):
                        try:
                            file_data = base64.b64decode(chunk)
                            self.active_file_transfers[websocket].write(file_data)
                        except Exception as e:
                            print(f"Error writing chunk: {e}")

                elif msg_type == "file_transfer_end":
                    if websocket in getattr(self, "active_file_transfers", {}):
                        try:
                            self.active_file_transfers[websocket].close()
                            del self.active_file_transfers[websocket]
                            print("FILE TRANSFER COMPLETE")
                            await websocket.send(json.dumps({
                                "type": "notification",
                                "message": "File successfully saved to Downloads/WebMouse"
                            }))
                        except Exception as e:
                            print(f"Error closing file: {e}")

        except websockets.ConnectionClosed:
            pass
        except Exception as e:
            print(f"[!] Exception with client {client_addr}: {e}")
        finally:
            info = self.client_info.pop(websocket, client_addr)
            self.authenticated_clients.discard(websocket)
            print(f"DISCONNECTED: {info}")


async def main():
    parser = argparse.ArgumentParser(description="WebMouse V1 — Windows Local Helper")
    parser.add_argument("--port", type=int, default=8765, help="Port to listen on (default: 8765)")
    parser.add_argument("--code", type=str, default="", help="6-digit pairing code (default: auto-generate)")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host interface (default: 0.0.0.0)")
    args = parser.parse_args()

    # Generate 6-digit code if not specified
    if args.code and len(args.code) == 6:
        pairing_code = args.code
    else:
        pairing_code = f"{random.randint(100000, 999999)}"

    server = WebMouseServer(host=args.host, port=args.port, pairing_code=pairing_code)
    server.print_banner()

    # Start the WebSocket server on port 8765
    async with websockets.serve(
        server.handle_connection,
        server.host,
        server.port,
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
