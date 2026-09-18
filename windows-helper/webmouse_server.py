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
        return valid_ips[0]

    return "127.0.0.1"


class WebMouseServer:
    def __init__(self, host: str, port: int, pairing_code: str):
        self.host = host
        self.port = port
        self.pairing_code = pairing_code
        self.authenticated_clients: Set[WebSocketServerProtocol] = set()
        self.client_info: Dict[WebSocketServerProtocol, str] = {}
        self.qr_tokens: Dict[str, float] = {} # temp token -> expiry timestamp
        
        # Token storage for persistent pairing
        self.trusted_devices_file = Path.home() / "Downloads" / "WebMouse" / "trusted_devices.json"
        self.trusted_devices_file.parent.mkdir(parents=True, exist_ok=True)
        self.trusted_tokens = self._load_trusted_tokens()
        
        # Screen dimensions
        try:
            self.screen_width, self.screen_height = pyautogui.size()
        except Exception:
            self.screen_width, self.screen_height = (1920, 1080)

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

    def print_banner(self):
        lan_ip = get_local_ip()
        print("\n" + "=" * 40)
        print("          WEBMOUSE V1")
        print("=" * 40 + "\n")
        print("Windows Helper: RUNNING")
        print(f"WebSocket: 0.0.0.0:{self.port}")
        print(f"LAN IP: {lan_ip}\n")
        print("QR Pairing Gateway:")
        print(f"http://{lan_ip}:{self.port}/\n")
        print(f"PAIRING CODE: {self.pairing_code}\n")
        print("Waiting for phone...\n")
        print("=" * 40 + "\n")

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

        # Helper to construct HTTP responses for both websockets APIs
        def send_http(status_code: int, content_type: str, body: str):
            body_bytes = body.encode('utf-8')
            resp_headers = [
                ("Content-Type", f"{content_type}; charset=utf-8"),
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
                expires_at = time.time() + 60
                self.qr_tokens[temp_token] = expires_at

                current_lan_ip = get_local_ip()
                pair_url = f"http://{current_lan_ip}:{self.port}/pair?token={temp_token}"

                data = {
                    "type": "host_pairing_info",
                    "host": current_lan_ip,
                    "ip": current_lan_ip,
                    "port": self.port,
                    "version": 2,
                    "token": temp_token,
                    "pairingToken": temp_token,
                    "expiresAt": int(expires_at),
                    "pairUrl": pair_url
                }
                return send_http(200, "application/json", json.dumps(data))

            # 3. Mobile Phone QR Pairing Gateway: GET /pair?token=<TOKEN>
            if req_path == "/pair":
                token_list = query_params.get("token", [])
                token = token_list[0].strip() if token_list else ""
                current_time = time.time()
                current_lan_ip = get_local_ip()

                # Validate token
                if token and token in self.qr_tokens and self.qr_tokens[token] > current_time:
                    new_trusted_token = secrets.token_hex(32)
                    self.trusted_tokens[new_trusted_token] = {
                        "device_name": "Mobile Phone (QR)",
                        "paired_at": str(time.time()),
                        "method": "qr_gateway"
                    }
                    self._save_trusted_tokens()
                    del self.qr_tokens[token] # One-time token consumed!
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

            # 4. Status or root landing: GET / or /health
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
                if msg_type in ("host_pairing_info", "request_qr_token"):
                    import time, secrets
                    temp_token = secrets.token_hex(16)
                    expires_at = time.time() + 60
                    self.qr_tokens[temp_token] = expires_at
                    current_lan_ip = get_local_ip()
                    print(f"PAIRING: Issued token to {client_addr} for ws://{current_lan_ip}:{self.port} (expires in 60s)")
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
                    continue

                # 1. Authentication Handshake
                if msg_type == "auth":
                    code = str(data.get("code", "")).strip()
                    token = str(data.get("token", "")).strip()
                    device_name = str(data.get("deviceName", "Mobile Phone")).strip()

                    is_authenticated = False
                    new_token = None

                    if token and token in self.trusted_tokens:
                        is_authenticated = True
                        print(f"AUTHENTICATED: '{device_name}' from {client_addr} auto-reconnected via trusted token.")
                    elif token and token in self.qr_tokens:
                        import time
                        if self.qr_tokens[token] > time.time():
                            is_authenticated = True
                            import secrets
                            new_token = secrets.token_hex(32)
                            self.trusted_tokens[new_token] = {"device_name": device_name, "paired_at": str(Path.home())}
                            self._save_trusted_tokens()
                            del self.qr_tokens[token] # Use once
                            print(f"AUTHENTICATED: '{device_name}' from {client_addr} paired successfully via QR one-time token.")
                        else:
                            print(f"AUTH FAILED: Expired QR token from {client_addr}")
                    elif code == self.pairing_code:
                        is_authenticated = True
                        import secrets
                        new_token = secrets.token_hex(32)
                        self.trusted_tokens[new_token] = {"device_name": device_name, "paired_at": str(Path.home())}
                        self._save_trusted_tokens()
                        print(f"AUTHENTICATED: '{device_name}' from {client_addr} paired successfully via code.")

                    if is_authenticated:
                        self.authenticated_clients.add(websocket)
                        self.client_info[websocket] = f"{device_name} ({client_addr})"
                        
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
                        print(f"AUTH FAILED: Invalid token or code from {client_addr}")
                        await websocket.send(json.dumps({
                            "type": "auth_result",
                            "success": False,
                            "message": "Incorrect pairing code or expired session"
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
        import secrets
        pairing_code = f"{secrets.randbelow(900000) + 100000}"

    server = WebMouseServer(host=args.host, port=args.port, pairing_code=pairing_code)
    server.print_banner()

    # Start the WebSocket server (with integrated HTTP Gateway) and the folder watcher concurrently
    ws_server = websockets.serve(
        server.handle_connection,
        server.host,
        server.port,
        process_request=server.process_request,
        ping_interval=20,
        ping_timeout=20,
        max_size=10_000_000
    )
    
    await asyncio.gather(
        ws_server,
        server.watch_send_folder()
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[!] WebMouse Server stopped by user.")
        sys.exit(0)
