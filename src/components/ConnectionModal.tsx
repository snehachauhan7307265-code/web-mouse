import React, { useState, useEffect } from 'react';
import { 
  X, Laptop, ArrowRight, CheckCircle2, 
  AlertCircle, RefreshCw, QrCode, Scan, 
  Download, Smartphone, Terminal, HelpCircle
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

  const [connectingTarget, setConnectingTarget] = useState<{
    host: string;
    port: number;
    code?: string;
    name?: string;
  } | null>(null);

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
      }
    }
  }, [isOpen, initialView, config.host, config.port, config.code, config.autoReconnect]);

  // When connection succeeds while modal is open, auto-close
  useEffect(() => {
    if (status === 'connected' && connectingTarget) {
      const timer = setTimeout(() => {
        setConnectingTarget(null);
        onClose();
      }, 1000);
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
      name: config.lastComputerName || 'Windows PC',
    });

    onSaveAndConnect({
      host: cleanHost,
      port: cleanPort,
      code: cleanCode,
      token: config.token,
      lastComputerName: config.lastComputerName || 'Windows PC',
      autoReconnect,
    });
  };

  const handleScan = (data: any) => {
    setActiveTab('pc_connect');
    if (!data) return;
    const scannedHost = (data.host || '').trim();
    const scannedPort = parseInt(data.port, 10) || 8765;
    const scannedCode = (data.code || data.pin || data.pairingCode || (data.token && String(data.token).length <= 8 ? data.token : '') || '').trim();
    const scannedToken = (data.token || '').trim();
    const scannedName = data.name || data.deviceName || 'Windows PC';

    if (scannedHost) setHost(scannedHost);
    if (scannedPort) setPort(scannedPort.toString());
    if (scannedCode) setCode(scannedCode);

    if (scannedHost) {
      setConnectingTarget({
        host: scannedHost,
        port: scannedPort,
        code: scannedCode || scannedToken,
        name: scannedName,
      });

      onSaveAndConnect({
        host: scannedHost,
        port: scannedPort,
        code: scannedCode || scannedToken,
        token: scannedToken || scannedCode,
        lastComputerName: scannedName,
        autoReconnect: true,
      });
    }
  };

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const computerDisplayName = config.lastComputerName || 'Windows PC';

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
          helperStatus={isConnected ? 'connected' : 'disconnected'}
          host={host || config.host || ''} 
          port={parseInt(port, 10) || config.port || 8765} 
          token={code || config.code || ''} 
          onRefresh={() => {}}
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
                <span>Connect to Laptop / PC</span>
                {isConnected && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                    Connected 🟢
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">
                WebMouse Local Wi-Fi Connection
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

        {/* Tab Navigation */}
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
            <span>💻 Connection</span>
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
            <span>📷 Scan QR</span>
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
            <span>📥 Helper Files</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Active Connection Banner */}
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

          {/* Connecting Feedback Banner */}
          {connectingTarget && !isConnected && (
            <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {status === 'connecting' || status === 'reconnecting' ? (
                    <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span className="text-xs font-bold text-white">
                    {status === 'connecting' || status === 'reconnecting'
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

              {(status === 'error' || status === 'auth_failed') && (
                <div className="text-[11px] text-zinc-400 space-y-1 pt-1">
                  <p className="text-rose-300 font-medium">
                    {status === 'auth_failed' ? '❌ Invalid 6-digit PIN code.' : '❌ Could not reach laptop helper.'}
                  </p>
                  <p>• Verify that <code>run_webmouse.bat</code> is running in the laptop CMD window.</p>
                  <p>• Verify that phone and laptop are on the same Wi-Fi / Hotspot.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: PC CONNECT (Standard IP & 6-Digit PIN) */}
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
                    <div className="text-[10px] text-emerald-100">Scan from Laptop screen</div>
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
                    <div className="font-bold text-xs">🖥️ Laptop Screen QR</div>
                    <div className="text-[10px] text-indigo-100">Display QR code</div>
                  </div>
                </button>
              </div>

              {/* Standard Connection Form */}
              <div className="p-4 bg-zinc-950/80 rounded-2xl border border-zinc-800 space-y-3.5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-indigo-400" />
                  <span>Windows Helper Connection</span>
                </h3>

                <form onSubmit={handleConnect} className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-300">
                        Laptop Wi-Fi IP Address
                      </label>
                      <input
                        id="input-pc-ip"
                        type="text"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        placeholder="e.g. 192.168.1.15"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        required
                      />
                      <p className="text-[10px] text-zinc-500">
                        Shown in green text in laptop CMD window.
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
                      <span>6-Digit Pairing Code</span>
                      <span className="text-[10px] text-zinc-500 font-normal">Shown in CMD banner</span>
                    </label>
                    <input
                      id="input-pc-code"
                      type="text"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 123456"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono tracking-widest text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      required
                    />
                  </div>

                  <div className="pt-1">
                    <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoReconnect}
                        onChange={(e) => setAutoReconnect(e.target.checked)}
                        className="w-4 h-4 accent-indigo-500 rounded bg-zinc-900 border-zinc-700"
                      />
                      <span>Remember this computer &amp; auto-reconnect</span>
                    </label>
                  </div>

                  <button
                    id="btn-submit-pc-connect"
                    type="submit"
                    disabled={isConnecting || !host.trim() || !code.trim()}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 active:scale-[0.98] text-white font-bold text-xs transition-all shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Connecting to Laptop...</span>
                      </>
                    ) : (
                      <>
                        <span>⚡ Connect</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: HELPER FILES (run_webmouse.bat & webmouse_server.py) */}
          {activeTab === 'helper' && (
            <div className="space-y-4">
              <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-indigo-400" />
                  Windows Helper Files
                </span>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  WebMouse requires the Windows Helper script running in Command Prompt on your PC.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <a
                    href="/run_webmouse.bat"
                    download="run_webmouse.bat"
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all text-center"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download run_webmouse.bat</span>
                  </a>

                  <a
                    href="/WebMouse-Windows.zip"
                    download="WebMouse-Windows.zip"
                    className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-xs border border-zinc-700 flex items-center justify-center gap-2 transition-colors text-center"
                  >
                    <Download className="w-4 h-4 text-indigo-400" />
                    <span>Download All (ZIP)</span>
                  </a>
                </div>
              </div>

              <div className="p-4 bg-zinc-950/60 rounded-2xl border border-zinc-800 space-y-2 text-xs">
                <h4 className="font-bold text-zinc-200">How to run:</h4>
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-300 text-[11px] leading-relaxed">
                  <li>Download and double-click <strong>run_webmouse.bat</strong> on your Windows PC.</li>
                  <li>A black CMD window opens showing your Laptop IP and 6-digit Pairing Code in green.</li>
                  <li>Scan the QR code with phone or type the IP and PIN in the Connection tab!</li>
                </ol>
              </div>

              <div className="flex justify-between items-center text-xs">
                <button
                  type="button"
                  onClick={onOpenHelperGuide}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Troubleshooting Guide</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
