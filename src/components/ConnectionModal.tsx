import React, { useState, useEffect } from 'react';
import { 
  X, Wifi, ShieldCheck, Laptop, HelpCircle, ArrowRight, CheckCircle2, 
  AlertTriangle, RefreshCw, QrCode, Scan, ChevronDown, ChevronUp, 
  Download, Sparkles, Check, Smartphone, Monitor
} from 'lucide-react';
import { ConnectionConfig, ConnectionStatus, ConnectedDeviceInfo } from '../types';
import { QRScanner } from './QRScanner';
import { QRCodePairing } from './QRCodePairing';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ConnectionConfig;
  status: ConnectionStatus;
  deviceInfo: ConnectedDeviceInfo | null;
  pairedDevice: ConnectedDeviceInfo | null;
  onSaveAndConnect: (config: ConnectionConfig) => void;
  onDisconnect: () => void;
  onForgetDevice: () => void;
  onOpenHelperGuide: () => void;
  initialView?: 'normal' | 'scanner' | 'qr_host' | 'manual_pin' | 'download_helper';
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  config,
  status,
  deviceInfo,
  pairedDevice,
  onSaveAndConnect,
  onDisconnect,
  onForgetDevice,
  onOpenHelperGuide,
  initialView = 'normal',
}) => {
  const [host, setHost] = useState(config.host || '');
  const [port, setPort] = useState(config.port ? config.port.toString() : '8765');
  const [code, setCode] = useState(config.code || '');
  const [autoReconnect, setAutoReconnect] = useState(config.autoReconnect ?? true);

  const [showScanner, setShowScanner] = useState(false);
  const [showQRHost, setShowQRHost] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [helperState, setHelperState] = useState<'checking' | 'detected' | 'not_found'>('checking');
  const [detectedHelper, setDetectedHelper] = useState<{
    deviceName: string;
    lanIp: string;
    port: number;
    token?: string;
    code?: string;
    version?: string;
  } | null>(null);

  const [isDownloading, setIsDownloading] = useState(false);

  // Proactive helper detection via HTTP / Health & WebSocket
  const probeLocalHelper = async () => {
    setHelperState('checking');
    let found = false;

    // 1. Try local health endpoints
    const endpoints = [
      'http://127.0.0.1:8765/health',
      'http://localhost:8765/health',
      'http://127.0.0.1:8765/api/pairing-info',
      'http://localhost:8765/api/pairing-info'
    ];

    for (const ep of endpoints) {
      if (found) break;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        const res = await fetch(ep, { signal: controller.signal, mode: 'cors' });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          const lanIp = (data.lanIp || data.host || data.ip || '').trim();
          if (lanIp && lanIp !== 'localhost' && !lanIp.startsWith('127.')) {
            found = true;
            setDetectedHelper({
              deviceName: data.deviceName || 'My Laptop',
              lanIp,
              port: parseInt(data.port, 10) || 8765,
              token: data.pairingToken || data.token,
              code: data.code || data.pairingCode,
              version: data.version || '2.0.0'
            });
            setHost(lanIp);
            setPort((data.port || 8765).toString());
            if (data.code) setCode(data.code);
            setHelperState('detected');
            return;
          }
        }
      } catch (e) {
        // Continue trying next endpoint
      }
    }

    // 2. Try WebSocket Probe if HTTP was blocked by browser sandbox
    if (!found) {
      try {
        const ws = new WebSocket('ws://127.0.0.1:8765');
        const wsTimeout = setTimeout(() => {
          try { ws.close(); } catch (e) {}
          if (!found) setHelperState('not_found');
        }, 1500);

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'host_pairing_info' }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'host_pairing_info' || data.type === 'server_info') {
              found = true;
              clearTimeout(wsTimeout);
              const lanIp = (data.host || data.lanIp || data.ip || '').trim();
              setDetectedHelper({
                deviceName: data.deviceName || 'My Laptop',
                lanIp: lanIp || '127.0.0.1',
                port: parseInt(data.port, 10) || 8765,
                token: data.pairingToken || data.token,
                code: data.code || data.pairingCode,
                version: data.version || '2.0.0'
              });
              if (lanIp && !lanIp.startsWith('127.')) setHost(lanIp);
              setHelperState('detected');
              ws.close();
            }
          } catch (e) {}
        };

        ws.onerror = () => {
          clearTimeout(wsTimeout);
          if (!found) setHelperState('not_found');
        };
      } catch (err) {
        if (!found) setHelperState('not_found');
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setHost(config.host || '');
      setPort(config.port ? config.port.toString() : '8765');
      setCode(config.code || '');
      setAutoReconnect(config.autoReconnect ?? true);

      if (initialView === 'scanner') {
        setShowScanner(true);
        setShowQRHost(false);
      } else if (initialView === 'qr_host') {
        setShowQRHost(true);
        setShowScanner(false);
      } else {
        setShowScanner(false);
        setShowQRHost(false);
        // Automatically check if helper is active
        probeLocalHelper();
      }
    }
  }, [isOpen, initialView, config.host, config.port, config.code, config.autoReconnect]);

  if (!isOpen) return null;

  const handleConnect = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSaveAndConnect({
      host: host.trim(),
      port: parseInt(port, 10) || 8765,
      code: code.trim(),
      token: config.token,
      lastComputerName: config.lastComputerName || detectedHelper?.deviceName || 'My Laptop',
      autoReconnect,
    });
  };

  const handleScan = (data: any) => {
    setShowScanner(false);
    if (!data) return;
    const scannedHost = (data.host || (data.receiverId ? 'receiver_local' : '') || '').trim();
    const scannedPort = parseInt(data.port, 10) || 8765;
    const scannedCode = (data.code || data.pin || data.pairingCode || (data.token && String(data.token).length <= 8 ? data.token : '') || '').trim();
    const scannedToken = (data.token || data.qrToken || '').trim();
    const scannedName = data.name || data.deviceName || data.computerName || 'My Laptop';

    if (scannedHost) setHost(scannedHost);
    if (scannedPort) setPort(scannedPort.toString());
    if (scannedCode) setCode(scannedCode);

    if (scannedHost) {
      onSaveAndConnect({
        host: scannedHost,
        port: scannedPort,
        code: scannedCode || scannedToken,
        qrToken: scannedToken,
        token: undefined,
        lastComputerName: scannedName,
        autoReconnect: true,
      });
      onClose();
    }
  };

  const handleDownloadInstaller = () => {
    setIsDownloading(true);
    const link = document.createElement('a');
    link.href = '/WebMouseHelperSetup.bat';
    link.download = 'WebMouseHelperSetup.bat';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // After 3 seconds, automatically re-probe for the newly installed helper
    setTimeout(() => {
      setIsDownloading(false);
      probeLocalHelper();
    }, 4000);
  };

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const hasTrustedDevice = Boolean(config.host && (config.token || config.code));
  const computerDisplayName = config.lastComputerName || detectedHelper?.deviceName || 'My Laptop';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      {showScanner && (
        <QRScanner
          onScan={handleScan}
          onClose={() => {
            setShowScanner(false);
            if (initialView === 'scanner') onClose();
          }}
          onManualPin={() => {
            setShowScanner(false);
            setShowAdvanced(true);
          }}
        />
      )}

      {showQRHost && (
        <QRCodePairing 
          helperStatus={helperState === 'detected' ? 'connected' : helperState === 'checking' ? 'checking' : 'disconnected'}
          host={detectedHelper?.lanIp || host || config.host || ''} 
          port={detectedHelper?.port || parseInt(port, 10) || config.port || 8765} 
          token={detectedHelper?.token || detectedHelper?.code || code || config.code || ''} 
          onRefresh={probeLocalHelper}
          onClose={() => {
            setShowQRHost(false);
            if (initialView === 'qr_host') onClose();
          }} 
          onSwitchToScanner={() => {
            setShowQRHost(false);
            setShowScanner(true);
          }}
          onOpenHelperGuide={onOpenHelperGuide}
        />
      )}

      <div 
        id="modal-connection-dialog"
        className={`w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col max-h-[92vh] ${(showScanner || showQRHost) ? 'hidden' : ''}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">WebMouse Connection</h2>
              <p className="text-xs text-zinc-400">
                {hasTrustedDevice ? `Paired with ${computerDisplayName}` : 'Zero-Setup Wi-Fi Control'}
              </p>
            </div>
          </div>
          <button
            id="btn-close-conn-modal"
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* SCENARIO A: RETURNING USER WITH SAVED DEVICE */}
          {hasTrustedDevice && (
            <div className="space-y-4">
              {/* Connected Badge */}
              {isConnected ? (
                <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>🟢 Connected</span>
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">{computerDisplayName}</h3>
                  <p className="text-xs text-zinc-400 font-mono">{config.host}:{config.port}</p>
                  
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onDisconnect}
                      className="w-full py-2.5 px-4 rounded-xl bg-rose-600/90 hover:bg-rose-500 active:scale-95 text-white font-medium text-xs transition-all shadow-md"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                /* Saved Device Reconnect Card */
                <div className="p-5 rounded-2xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-indigo-950/30 border border-indigo-500/30 space-y-3.5 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Known Device
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Available
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xl font-bold shrink-0">
                      💻
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-white truncate">{computerDisplayName}</h3>
                      <p className="text-xs text-zinc-400 font-mono truncate">{config.host}:{config.port}</p>
                    </div>
                  </div>

                  {status === 'error' && (
                    <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs space-y-2.5">
                      <div className="flex items-center gap-2 text-amber-300 font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>Connect nahi ho raha? Ye 3 cheezein check karein:</span>
                      </div>
                      <div className="space-y-1.5 text-zinc-300 text-[11px] leading-relaxed">
                        <p>
                          <strong className="text-white">1. Same Wi-Fi ya Hotspot:</strong> Phone aur Laptop dono ek hi network par hone chahiye. <span className="text-amber-200 font-semibold">💡 Sabse accha tarika:</span> Phone ka <strong>Personal Hotspot</strong> ON karke laptop ko usse connect karein!
                        </p>
                        <p>
                          <strong className="text-white">2. Laptop Helper:</strong> Laptop par WebMouse Helper on hona chahiye (taskbar system tray me 🟢 icon).
                        </p>
                        <p>
                          <strong className="text-white">3. Direct Phone Link:</strong> Phone ke Chrome me seedha ye kholein: <code className="text-emerald-400 bg-black/60 px-1 py-0.5 rounded font-mono">http://{config.host || '192.168.x.x'}:{config.port || 8765}/</code>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Connect Button */}
                  <button
                    id="btn-reconnect-saved-device"
                    type="button"
                    onClick={() => handleConnect()}
                    disabled={isConnecting}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 active:scale-[0.98] text-white font-bold text-sm transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Connecting to {computerDisplayName}...</span>
                      </>
                    ) : (
                      <>
                        <span>Connect</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="text-zinc-400 hover:text-indigo-400 flex items-center gap-1 transition-colors"
                    >
                      <Scan className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Scan New QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={onForgetDevice}
                      className="text-zinc-500 hover:text-rose-400 transition-colors"
                    >
                      Forget Device
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SCENARIO B: FIRST TIME SETUP / NEW DEVICE */}
          {!hasTrustedDevice && (
            <div className="space-y-4">
              {/* Step 1: WebMouse Windows Helper */}
              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[11px] font-bold">1</span>
                    Install WebMouse Helper
                  </span>
                  {helperState === 'detected' ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Helper Ready
                    </span>
                  ) : helperState === 'checking' ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Checking laptop...
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-zinc-400">One-time setup</span>
                  )}
                </div>

                {helperState === 'detected' && detectedHelper ? (
                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-white">{detectedHelper.deviceName}</p>
                      <p className="text-zinc-400 font-mono text-[11px]">{detectedHelper.lanIp}:{detectedHelper.port}</p>
                    </div>
                    <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                      <Check className="w-4 h-4" /> Ready
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Download and run the 1-click Windows helper. It automatically configures Windows startup, firewall, and runs in the system tray.
                    </p>
                    <div className="flex gap-2">
                      <button
                        id="btn-install-webmouse-helper"
                        type="button"
                        onClick={handleDownloadInstaller}
                        disabled={isDownloading}
                        className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
                      >
                        <Download className="w-4 h-4 text-indigo-100" />
                        <span>{isDownloading ? 'Downloading Installer...' : 'Install WebMouse Helper'}</span>
                      </button>
                      <button
                        id="btn-detect-helper"
                        type="button"
                        onClick={probeLocalHelper}
                        title="Check if Helper is already running"
                        className="py-3 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 text-xs font-semibold flex items-center justify-center border border-zinc-700 transition-colors"
                      >
                        <RefreshCw className={`w-4 h-4 text-indigo-400 ${helperState === 'checking' ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Scan QR Code */}
              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px] font-bold">2</span>
                  Scan QR Code
                </span>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    id="btn-open-scanner"
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="py-3.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <Scan className="w-4 h-4" />
                    <span>Scan from Phone</span>
                  </button>
                  <button
                    id="btn-show-laptop-qr"
                    type="button"
                    onClick={() => setShowQRHost(true)}
                    className="py-3.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-zinc-200 font-semibold text-xs flex items-center justify-center gap-2 border border-zinc-700 transition-all"
                  >
                    <QrCode className="w-4 h-4 text-indigo-400" />
                    <span>Show Laptop QR</span>
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
                  Open WebMouse on your phone and scan the QR code to connect instantly.
                </p>
              </div>
            </div>
          )}

          {/* ADVANCED ACCORDION (DEVELOPER & MANUAL FALLBACK) */}
          <div className="pt-2 border-t border-zinc-800/80">
            <button
              id="btn-toggle-advanced-conn"
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full py-2 px-3 rounded-xl bg-zinc-950/40 hover:bg-zinc-950 border border-zinc-800/60 text-xs text-zinc-400 hover:text-zinc-200 flex items-center justify-between transition-colors"
            >
              <span>Advanced Connection Options</span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="mt-3 p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 animate-in fade-in duration-150">
                <form onSubmit={handleConnect} className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[11px] font-medium text-zinc-400">Manual IP Address</label>
                      <input
                        id="input-adv-ip"
                        type="text"
                        value={host ?? ''}
                        onChange={(e) => setHost(e.target.value)}
                        placeholder="192.168.1.x"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-zinc-400">Port</label>
                      <input
                        id="input-adv-port"
                        type="number"
                        value={port ?? '8765'}
                        onChange={(e) => setPort(e.target.value)}
                        placeholder="8765"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-white text-center focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-zinc-400">6-Digit PIN (if required)</label>
                    <input
                      id="input-adv-code"
                      type="text"
                      maxLength={6}
                      value={code ?? ''}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 582914"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono tracking-widest text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <label htmlFor="chk-auto-reconnect-adv" className="text-xs text-zinc-400 cursor-pointer">
                      Auto-reconnect on signal drop
                    </label>
                    <input
                      id="chk-auto-reconnect-adv"
                      type="checkbox"
                      checked={autoReconnect}
                      onChange={(e) => setAutoReconnect(e.target.checked)}
                      className="w-4 h-4 accent-indigo-500 rounded bg-zinc-900 border-zinc-700 cursor-pointer"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-md"
                  >
                    Direct Connect
                  </button>
                </form>

                {/* Developer / Portable ZIP */}
                <div className="pt-2 border-t border-zinc-800 text-[11px] space-y-2">
                  <span className="font-semibold text-zinc-400">Developer &amp; Portable Package:</span>
                  <div className="flex gap-2">
                    <a
                      href="/WebMouse-Windows.zip"
                      download="WebMouse-Windows.zip"
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-center transition-colors truncate"
                    >
                      📦 Portable ZIP
                    </a>
                    <a
                      href="/Uninstall-WebMouseHelper.bat"
                      download="Uninstall-WebMouseHelper.bat"
                      className="py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-rose-400 text-center transition-colors"
                    >
                      Uninstall Helper
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
