import React, { useState } from 'react';
import { X, Copy, Check, Download, Terminal, ShieldAlert, Wifi, Info, Monitor, FileCode, CheckCircle2 } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface WindowsHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HELPER_SERVER_CODE = `#!/usr/bin/env python3
"""
WebMouse V1 — Windows Local Helper Server
=========================================
Turns an Android or iPhone smartphone into a wireless mouse & keyboard
for a Windows computer over the same local Wi-Fi network.
"""

import asyncio
import json
import random
import socket
import sys
import argparse
from typing import Set, Dict

try:
    import pyautogui
    pyautogui.PAUSE = 0.0
    pyautogui.FAILSAFE = False
except ImportError:
    print("[ERROR] Missing required package 'pyautogui'!")
    print("Run: pip install -r requirements.txt")
    sys.exit(1)

try:
    import websockets
    from websockets.server import WebSocketServerProtocol
except ImportError:
    print("[ERROR] Missing required package 'websockets'!")
    print("Run: pip install -r requirements.txt")
    sys.exit(1)

KEY_MAP = {
    "enter": "enter", "return": "enter", "backspace": "backspace",
    "delete": "delete", "tab": "tab", "escape": "esc", "esc": "esc",
    "space": "space", "up": "up", "down": "down", "left": "left",
    "right": "right", "shift": "shift", "ctrl": "ctrl", "control": "ctrl",
    "alt": "alt", "win": "win", "windows": "win", "meta": "win",
    "home": "home", "end": "end", "pageup": "pageup", "pagedown": "pagedown",
    "volumemute": "volumemute", "volumedown": "volumedown", "volumeup": "volumeup",
    "playpause": "playpause", "printscreen": "printscreen",
    "f1": "f1", "f2": "f2", "f3": "f3", "f4": "f4",
    "f5": "f5", "f6": "f6", "f7": "f7", "f8": "f8",
    "f9": "f9", "f10": "f10", "f11": "f11", "f12": "f12",
}

def get_local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
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
        try:
            self.screen_width, self.screen_height = pyautogui.size()
        except Exception:
            self.screen_width, self.screen_height = (1920, 1080)

    def print_banner(self):
        computer_name = socket.gethostname()
        ip = get_local_ip()
        print("\\n" + "=" * 48)
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
        print(f"1. Connect phone to same Wi-Fi as this PC")
        print(f"2. Enter Computer IP:  {ip}")
        print(f"3. Enter Pairing Code: {self.pairing_code}")
        print(f"4. Tap 'Connect'")
        print("=" * 48 + "\\n")
        print("Awaiting connection from phone...\\n")

    async def handle_connection(self, websocket: WebSocketServerProtocol):
        peer = websocket.remote_address
        client_addr = f"{peer[0]}:{peer[1]}"
        print(f"CONNECTED: Client from {client_addr}")

        try:
            async for raw_message in websocket:
                try:
                    data = json.loads(raw_message)
                except json.JSONDecodeError:
                    continue

                msg_type = data.get("type", "")

                if msg_type == "auth":
                    code = str(data.get("code", "")).strip()
                    device_name = str(data.get("deviceName", "Phone")).strip()
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
                        }))
                    else:
                        print(f"AUTH FAILED: Code mismatch from {client_addr}")
                        await websocket.send(json.dumps({
                            "type": "auth_result",
                            "success": False,
                            "message": "Wrong pairing code"
                        }))
                    continue

                if websocket not in self.authenticated_clients:
                    await websocket.send(json.dumps({"type": "error", "message": "Unauthorized"}))
                    continue

                if msg_type == "ping":
                    await websocket.send(json.dumps({"type": "pong", "timestamp": data.get("timestamp")}))
                elif msg_type == "mouse_move":
                    dx = float(data.get("dx", 0))
                    dy = float(data.get("dy", 0))
                    pyautogui.moveRel(dx, dy, _pause=False)
                    print(f"MOUSE MOVE: dx={dx}, dy={dy}")
                elif msg_type == "left_click":
                    pyautogui.click(button="left")
                    print("LEFT CLICK")
                elif msg_type == "right_click":
                    pyautogui.click(button="right")
                    print("RIGHT CLICK")
                elif msg_type == "middle_click":
                    pyautogui.click(button="middle")
                elif msg_type == "double_click":
                    pyautogui.doubleClick(button="left")
                elif msg_type == "mouse_down":
                    pyautogui.mouseDown(button=data.get("button", "left"))
                    print("DRAG START (mouse_down: left)")
                elif msg_type == "mouse_up":
                    pyautogui.mouseUp(button=data.get("button", "left"))
                    print("DRAG END (mouse_up: left)")
                elif msg_type == "scroll":
                    amt = int(data.get("amount", 0))
                    pyautogui.scroll(amt)
                    print(f"SCROLL: amount={amt}")
                elif msg_type == "hscroll" and hasattr(pyautogui, "hscroll"):
                    pyautogui.hscroll(int(data.get("amount", 0)))
                elif msg_type == "key":
                    key_val = str(data.get("key", "")).lower()
                    pyautogui.press(KEY_MAP.get(key_val, key_val))
                elif msg_type == "type_text":
                    pyautogui.write(str(data.get("text", "")), interval=0.005)
                elif msg_type == "shortcut":
                    keys = [KEY_MAP.get(k.lower(), k.lower()) for k in data.get("keys", [])]
                    if keys:
                        pyautogui.hotkey(*keys)

        except websockets.ConnectionClosed:
            pass
        finally:
            info = self.client_info.pop(websocket, client_addr)
            self.authenticated_clients.discard(websocket)
            print(f"DISCONNECTED: {info}")

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--code", type=str, default="")
    args = parser.parse_args()
    code = args.code if (args.code and len(args.code) == 6) else f"{random.randint(100000, 999999)}"
    server = WebMouseServer("0.0.0.0", args.port, code)
    server.print_banner()
    async with websockets.serve(server.handle_connection, server.host, server.port):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
`;

const REQUIREMENTS_CODE = `pyautogui>=0.9.54
websockets>=12.0
pillow>=10.0.0
`;

export const WindowsHelperModal: React.FC<WindowsHelperModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'server' | 'requirements'>('guide');
  const [copiedServer, setCopiedServer] = useState(false);
  const [copiedReqs, setCopiedReqs] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async (text: string, type: 'server' | 'reqs') => {
    await copyToClipboard(text);
    if (type === 'server') {
      setCopiedServer(true);
      setTimeout(() => setCopiedServer(false), 2000);
    } else {
      setCopiedReqs(true);
      setTimeout(() => setCopiedReqs(false), 2000);
    }
  };

  const handleDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        id="modal-windows-helper-dialog"
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Windows Helper Program</h2>
              <p className="text-xs text-zinc-400">Controls cursor and keyboard natively on Windows</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/30 px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors ${
              activeTab === 'guide'
                ? 'border-indigo-500 text-white bg-zinc-850'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Setup Guide & Troubleshooting
          </button>
          <button
            onClick={() => setActiveTab('server')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'server'
                ? 'border-indigo-500 text-white bg-zinc-850'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>webmouse_server.py</span>
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'requirements'
                ? 'border-indigo-500 text-white bg-zinc-850'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>requirements.txt</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs text-zinc-300">
          {/* TAB 1: Step-by-Step Guide */}
          {activeTab === 'guide' && (
            <div className="space-y-4 leading-relaxed">
              {/* 10-Step Simple Instructions */}
              <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                <div className="text-indigo-400 font-bold text-xs uppercase tracking-wider">
                  Very Simple Windows Instructions
                </div>
                <ol className="space-y-2 text-[11px] text-zinc-300 list-decimal list-inside">
                  <li><strong className="text-zinc-100">Install Python:</strong> Download Python 3.8+ from <span className="text-indigo-400">python.org</span> (check "Add to PATH").</li>
                  <li><strong className="text-zinc-100">Open Command Prompt:</strong> Press <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">Win + R</kbd>, type <code className="text-emerald-400">cmd</code>, and press Enter.</li>
                  <li><strong className="text-zinc-100">Go to windows-helper folder:</strong> <code className="text-emerald-400">cd windows-helper</code></li>
                  <li>
                    <strong className="text-zinc-100">Run:</strong>
                    <div className="bg-black/80 rounded-lg p-2 font-mono text-[11px] text-emerald-400 border border-zinc-800 my-1">
                      pip install -r requirements.txt
                    </div>
                  </li>
                  <li>
                    <strong className="text-zinc-100">Run:</strong>
                    <div className="bg-black/80 rounded-lg p-2 font-mono text-[11px] text-emerald-400 border border-zinc-800 my-1">
                      python webmouse_server.py
                    </div>
                  </li>
                  <li><strong className="text-zinc-100">Find the displayed IP address:</strong> Look at the terminal output (e.g. <code className="text-indigo-400">192.168.1.15</code>).</li>
                  <li><strong className="text-zinc-100">Open WebMouse on the phone:</strong> In Safari/Chrome, ensure phone is on the same Wi-Fi.</li>
                  <li><strong className="text-zinc-100">Enter the IP and pairing code:</strong> Enter both in the Connect dialog.</li>
                  <li><strong className="text-zinc-100">Press Connect:</strong> Status changes to <span className="text-emerald-400 font-semibold">Connected</span>.</li>
                  <li><strong className="text-zinc-100">Test the touchpad:</strong> Drag to move your real Windows cursor, tap for left click, two fingers for right click.</li>
                </ol>
              </div>

              {/* Windows Firewall Permission */}
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Windows Firewall Permission (Important)</span>
                </div>
                <p className="text-[11px] text-zinc-300">
                  When running for the first time, Windows Defender Firewall may prompt: <em>"Windows Defender Firewall has blocked some features of this app"</em>.
                </p>
                <ul className="space-y-1 text-[11px] text-zinc-300 list-disc list-inside">
                  <li>Check the box: <strong>"Private networks, such as my home or work network"</strong></li>
                  <li>Click: <strong>"Allow access"</strong></li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: Source Code */}
          {activeTab === 'server' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-mono">windows-helper/webmouse_server.py</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(HELPER_SERVER_CODE, 'server')}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1 text-xs"
                  >
                    {copiedServer ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedServer ? 'Copied' : 'Copy Code'}</span>
                  </button>
                  <button
                    onClick={() => handleDownload('webmouse_server.py', HELPER_SERVER_CODE)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 text-xs shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </button>
                </div>
              </div>

              <pre className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-[11px] text-zinc-300 overflow-x-auto max-h-96 leading-relaxed select-text">
                {HELPER_SERVER_CODE}
              </pre>
            </div>
          )}

          {/* TAB 3: requirements.txt */}
          {activeTab === 'requirements' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-mono">windows-helper/requirements.txt</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(REQUIREMENTS_CODE, 'reqs')}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1 text-xs"
                  >
                    {copiedReqs ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedReqs ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={() => handleDownload('requirements.txt', REQUIREMENTS_CODE)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 text-xs shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </button>
                </div>
              </div>

              <pre className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-[11px] text-emerald-400 overflow-x-auto leading-relaxed select-text">
                {REQUIREMENTS_CODE}
              </pre>

              <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800 text-xs text-zinc-400 space-y-1">
                <p className="font-semibold text-zinc-200">How to install:</p>
                <code className="text-indigo-300 block">pip install -r requirements.txt</code>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
