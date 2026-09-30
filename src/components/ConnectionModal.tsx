import React, { useState, useEffect } from 'react';
import { 
  X, Laptop, ArrowRight, CheckCircle2, 
  AlertTriangle, AlertCircle, RefreshCw, QrCode, Scan, 
  Download, Sparkles, Smartphone, Terminal, HelpCircle, ExternalLink, WifiOff
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
  const [activeTab, setActiveTab] = useState<'pc_connect' | 'scanner' | 'qr_host' | 'helper'>(
    initialView === 'scanner' ? 'scanner' : initialView === 'qr_host' ? 'qr_host' : initialView === 'download_helper' ? 'helper' : 'pc_connect'
  );

  const [host, setHost] = useState(config.host || '');
  const [port, setPort] = useState(config.port ? config.port.toString() : '8765');
  const [code, setCode] = useState(config.code || '');
  const [autoReconnect, setAutoReconnect] = useState(config.autoReconnect ?? true);

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
  const [connectingTarget, setConnectingTarget] = useState<{
    host: string;
    port: number;
    code?: string;
    name?: string;
    pairUrl?: string;
  } | null>(null);

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
        setActiveTab('scanner');
      } else if (initialView === 'qr_host') {
        setActiveTab('qr_host');
      } else if (initialView === 'download_helper') {
        setActiveTab('helper');
      } else {
        setActiveTab('pc_connect');
        probeLocalHelper();
      }
    }
  }, [isOpen, initialView, config.host, config.port, config.code, config.autoReconnect]);

  // When connection succeeds while modal is tracking a target
  useEffect(() => {
    if (status === 'connected' && connectingTarget) {
      const timer = setTimeout(() => {
        setConnectingTarget(null);
        onClose();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [status, connectingTarget, onClose]);

  if (!isOpen) return null;

  const handleConnect = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanHost = host.trim();
    const cleanPort = parseInt(port, 10) || 8765;
    const cleanCode = code.trim();

    if (!cleanHost) return;

    setConnectingTarget({
      host: cleanHost,
      port: cleanPort,
      code: cleanCode,
      name: detectedHelper?.deviceName || config.lastComputerName || 'Windows PC',
      pairUrl: `http://${cleanHost}:${cleanPort}/?pair=${cleanCode}`,
    });

    onSaveAndConnect({
      host: cleanHost,
      port: cleanPort,
      code: cleanCode,
      token: config.token,
      lastComputerName: config.lastComputerName || detectedHelper?.deviceName || 'Windows PC',
      autoReconnect,
    });
  };

  const handleScan = (data: any) => {
    setActiveTab('pc_connect');
    if (!data) return;
    const scannedHost = (data.host || (data.receiverId ? 'receiver_local' : '') || '').trim();
    const scannedPort = parseInt(data.port, 10) || 8765;
    const scannedCode = (data.code || data.pin || data.pairingCode || (data.token && String(data.token).length <= 8 ? data.token : '') || '').trim();
    const scannedToken = (data.token || data.qrToken || '').trim();
    const scannedName = data.name || data.deviceName || data.computerName || 'Windows PC';
    const pairUrl = data.pairUrl || (scannedHost ? `http://${scannedHost}:${scannedPort}/?pair=${scannedCode || scannedToken}` : '');

    if (scannedHost) setHost(scannedHost);
    if (scannedPort) setPort(scannedPort.toString());
    if (scannedCode) setCode(scannedCode);

    if (scannedHost) {
      setConnectingTarget({
        host: scannedHost,
        port: scannedPort,
        code: scannedCode || scannedToken,
        name: scannedName,
        pairUrl,
      });

      onSaveAndConnect({
        host: scannedHost,
        port: scannedPort,
        code: scannedCode || scannedToken,
        qrToken: scannedToken,
        token: undefined,
        lastComputerName: scannedName,
        autoReconnect: true,
      });
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

    setTimeout(() => {
      setIsDownloading(false);
      probeLocalHelper();
    }, 4000);
  };

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const computerDisplayName = config.lastComputerName || detectedHelper?.deviceName || 'Windows PC';
  const isHttpsOrigin = typeof window !== 'undefined' && window.location.protocol === 'https:';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Scanner Mode Overlay */}
      {activeTab === 'scanner' && (
        <QRScanner
          onScan={handleScan}
          onClose={() => setActiveTab('pc_connect')}
          onManualPin={() => setActiveTab('pc_connect')}
        />
      )}

      {/* Show Laptop QR Overlay */}
      {activeTab === 'qr_host' && (
        <QRCodePairing 
          helperStatus={helperState === 'detected' ? 'connected' : helperState === 'checking' ? 'checking' : 'disconnected'}
          host={detectedHelper?.lanIp || host || config.host || ''} 
          port={detectedHelper?.port || parseInt(port, 10) || config.port || 8765} 
          token={detectedHelper?.token || detectedHelper?.code || code || config.code || ''} 
          onRefresh={probeLocalHelper}
          onClose={() => setActiveTab('pc_connect')} 
          onSwitchToScanner={() => setActiveTab('scanner')}
          onOpenHelperGuide={onOpenHelperGuide}
        />
      )}

      {/* Main Connection Dialog */}
      <div 
        id="modal-connection-dialog"
        className={`w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col max-h-[92vh] ${activeTab === 'scanner' || activeTab === 'qr_host' ? 'hidden' : ''}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Connect to PC / Laptop</span>
                {isConnected && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                    Connected
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">
                Control mouse, keyboard, and presentation wirelessly
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

        {/* Tab Navigation (Prominent, High-Visibility) */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 p-1.5 gap-1 text-xs">
          <button
            id="tab-pc-connect"
            type="button"
            onClick={() => setActiveTab('pc_connect')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'pc_connect'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>💻 PC Connect</span>
          </button>

          <button
            id="tab-scanner"
            type="button"
            onClick={() => setActiveTab('scanner')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'scanner'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <Scan className="w-4 h-4 text-emerald-400" />
            <span>📷 QR Scanner</span>
          </button>

          <button
            id="tab-qr-host"
            type="button"
            onClick={() => setActiveTab('qr_host')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'qr_host'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <QrCode className="w-4 h-4 text-blue-400" />
            <span>🖥️ Laptop QR</span>
          </button>

          <button
            id="tab-helper"
            type="button"
            onClick={() => setActiveTab('helper')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'helper'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>📥 Helper</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Active Connection Banner if connected */}
          {isConnected && (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{computerDisplayName}</h4>
                  <p className="text-xs text-emerald-400 font-mono">
                    Connected to {config.host}:{config.port}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onDisconnect}
                className="py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition-all"
              >
                Disconnect
              </button>
            </div>
          )}

          {/* Connection Error / Connecting Pipeline Banner */}
          {connectingTarget && (
            <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {status === 'connected' ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  ) : status === 'connecting' || status === 'reconnecting' ? (
                    <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span className="text-xs font-bold text-white">
                    {status === 'connected'
                      ? 'Connected Successfully!'
                      : status === 'connecting' || status === 'reconnecting'
                      ? `Connecting to ${connectingTarget.host}:${connectingTarget.port}...`
                      : 'Connection Failed'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setConnectingTarget(null)}
                  className="text-[11px] text-zinc-400 hover:text-white"
                >
                  Dismiss
                </button>
              </div>

              {/* Status Message and Diagnostics */}
              {(status === 'error' || status === 'auth_failed') && (
                <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>PC se connect nahi ho paya:</span>
                  </div>

                  {isHttpsOrigin && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] text-zinc-300 leading-snug">
                        💡 <strong>Direct Phone Link:</strong> Phone browser HTTPS se local IP WebSocket ko block kar sakta hai. Neeche button tap karein (ye direct phone par chalega):
                      </p>
                      <a
                        href={connectingTarget.pairUrl || `http://${connectingTarget.host}:${connectingTarget.port}/?pair=${connectingTarget.code || ''}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Direct Link (http://{connectingTarget.host}:{connectingTarget.port}/)</span>
                      </a>
                    </div>
                  )}

                  <div className="text-[11px] text-zinc-400 space-y-0.5 pt-1">
                    <p>• Check karein ki Laptop aur Phone dono ek hi Wi-Fi router ya Hotspot par hain.</p>
                    <p>• Laptop par <code>run_webmouse.bat</code> chala hona chahiye.</p>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleConnect()}
                      className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs transition-colors"
                    >
                      🔄 Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('scanner')}
                      className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-lg text-xs transition-colors"
                    >
                      📷 Scan QR Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: PC CONNECT (Direct IP & PIN) */}
          {activeTab === 'pc_connect' && (
            <div className="space-y-4">
              {/* Quick Actions (Scan QR & Show QR Buttons) */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  id="btn-quick-open-scanner"
                  type="button"
                  onClick={() => setActiveTab('scanner')}
                  className="p-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 active:scale-[0.98] text-white shadow-md flex items-center gap-3 transition-all border border-emerald-400/20 text-left"
                >
                  <div className="p-2 rounded-xl bg-white/20 shrink-0">
                    <Scan className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">📷 Scan QR Code</div>
                    <div className="text-[10px] text-emerald-100">Camera se scan karein</div>
                  </div>
                </button>

                <button
                  id="btn-quick-show-qr"
                  type="button"
                  onClick={() => setActiveTab('qr_host')}
                  className="p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 hover:from-indigo-500 hover:to-blue-600 active:scale-[0.98] text-white shadow-md flex items-center gap-3 transition-all border border-indigo-400/20 text-left"
                >
                  <div className="p-2 rounded-xl bg-white/20 shrink-0">
                    <QrCode className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">🖥️ Show Laptop QR</div>
                    <div className="text-[10px] text-indigo-100">Screen par code dikhayein</div>
                  </div>
                </button>
              </div>

              {/* Direct PC Connection Form */}
              <div className="p-4 bg-zinc-950/80 rounded-2xl border border-zinc-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-indigo-400" />
                    <span>PC IP Address &amp; PIN Connection</span>
                  </h3>
                  {helperState === 'detected' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Helper Detected
                    </span>
                  )}
                </div>

                <form onSubmit={handleConnect} className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-300">
                        PC / Laptop IP Address
                      </label>
                      <input
                        id="input-pc-ip"
                        type="text"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        placeholder="e.g. 192.168.1.5 or localhost"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        required
                      />
                      <p className="text-[10px] text-zinc-500">
                        Laptop me <code>run_webmouse.bat</code> chalane par IP green color me dikhegi.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-300">
                        Port
                      </label>
                      <input
                        id="input-pc-port"
                        type="number"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        placeholder="8765"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-white text-center focus:outline-none focus:border-indigo-500 transition-colors"
                        required
                      />
                      <p className="text-[10px] text-zinc-500 text-center">Default: 8765</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-zinc-300 flex items-center justify-between">
                      <span>6-Digit Pairing PIN (Optional)</span>
                      <span className="text-[10px] text-zinc-500 font-normal">CMD window me dikhega</span>
                    </label>
                    <input
                      id="input-pc-code"
                      type="text"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 582914"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono tracking-widest text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoReconnect}
                        onChange={(e) => setAutoReconnect(e.target.checked)}
                        className="w-4 h-4 accent-indigo-500 rounded bg-zinc-900 border-zinc-700"
                      />
                      <span>Auto-reconnect on next open</span>
                    </label>

                    <button
                      type="button"
                      onClick={probeLocalHelper}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${helperState === 'checking' ? 'animate-spin' : ''}`} />
                      <span>Detect PC</span>
                    </button>
                  </div>

                  <button
                    id="btn-submit-pc-connect"
                    type="submit"
                    disabled={isConnecting || !host.trim()}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 active:scale-[0.98] text-white font-bold text-xs transition-all shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Connecting to PC...</span>
                      </>
                    ) : (
                      <>
                        <span>⚡ Connect to PC</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Direct Phone Browser Link */}
                {host.trim() && (
                  <div className="pt-2 border-t border-zinc-800/80">
                    <a
                      href={`http://${host.trim()}:${port.trim() || '8765'}/${code.trim() ? `?pair=${code.trim()}` : ''}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs text-zinc-300 hover:text-white transition-colors group"
                    >
                      <span className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                        <span>Open Direct Link on Mobile Browser</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: WINDOWS HELPER (Setup & Download) */}
          {activeTab === 'helper' && (
            <div className="space-y-4">
              <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-indigo-400" />
                    Windows Helper Status
                  </span>
                  {helperState === 'detected' ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Running 🟢
                    </span>
                  ) : helperState === 'checking' ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Checking...
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-400">Offline / Not detected</span>
                  )}
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  WebMouse ko apne Laptop ya PC se wirelessly jodne ke liye Windows par Helper software chalana hota hai. Ye mouse, keyboard, aur screen share control enable karta hai.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    id="btn-install-helper-batch"
                    type="button"
                    onClick={handleDownloadInstaller}
                    disabled={isDownloading}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isDownloading ? 'Downloading...' : '1-Click Setup (Setup.bat)'}</span>
                  </button>

                  <a
                    href="/WebMouse-Windows.zip"
                    download="WebMouse-Windows.zip"
                    className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-xs border border-zinc-700 flex items-center justify-center gap-2 transition-colors text-center"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Download Portable ZIP</span>
                  </a>
                </div>
              </div>

              {/* Step-by-Step Instructions */}
              <div className="p-4 bg-zinc-950/60 rounded-2xl border border-zinc-800 space-y-2 text-xs">
                <h4 className="font-bold text-zinc-200">Kese shuru karein (Quick Steps):</h4>
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-300 text-[11px] leading-relaxed">
                  <li>Laptop me <strong>WebMouseHelperSetup.bat</strong> download karke Double-Click karein.</li>
                  <li>Setup apne aap Python aur zaroori libraries install kar dega.</li>
                  <li>Black CMD window me green text me Laptop ki <strong>IP Address</strong> aur <strong>6-digit PIN</strong> dikhegi.</li>
                  <li>Phone se <strong>"PC Connect"</strong> tab me IP daalein ya <strong>"Scan QR"</strong> se camera se scan karein!</li>
                </ol>
              </div>

              <div className="flex justify-between items-center text-xs">
                <button
                  type="button"
                  onClick={onOpenHelperGuide}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Full Troubleshooting Guide</span>
                </button>

                <a
                  href="/Uninstall-WebMouseHelper.bat"
                  download="Uninstall-WebMouseHelper.bat"
                  className="text-zinc-500 hover:text-rose-400 text-[11px] transition-colors"
                >
                  Uninstall Helper
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
