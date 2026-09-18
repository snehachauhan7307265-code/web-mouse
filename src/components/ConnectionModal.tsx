import React, { useState } from 'react';
import { X, Wifi, ShieldCheck, Monitor, HelpCircle, ArrowRight, CheckCircle2, AlertTriangle, RefreshCw, QrCode, Scan } from 'lucide-react';
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
  initialView?: 'normal' | 'scanner' | 'qr_host';
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
  const [host, setHost] = useState(config.host);
  const [port, setPort] = useState(config.port.toString());
  const [code, setCode] = useState(config.code);
  const [autoReconnect, setAutoReconnect] = useState(config.autoReconnect);

  const [showScanner, setShowScanner] = useState(false);
  const [showQRHost, setShowQRHost] = useState(false);
  const [helperStatus, setHelperStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [qrHostIp, setQrHostIp] = useState('');
  const [qrHostPort, setQrHostPort] = useState(8765);
  const [qrToken, setQrToken] = useState<string | undefined>();
  const [qrExpiresAt, setQrExpiresAt] = useState<number | undefined>();
  const [helperError, setHelperError] = useState<string | undefined>();
  const [showManual, setShowManual] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setHost(config.host);
      setPort(config.port.toString());
      setCode(config.code);
      setAutoReconnect(config.autoReconnect);

      if (initialView === 'scanner') {
        setShowScanner(true);
        setShowQRHost(false);
      } else if (initialView === 'qr_host') {
        fetchLocalHostAndShowQR();
      } else {
        setShowScanner(false);
        setShowQRHost(false);
      }
    }
  }, [isOpen, initialView, config.host, config.port, config.code, config.autoReconnect]);

  if (!isOpen) return null;

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveAndConnect({
      host: host.trim(),
      port: parseInt(port, 10) || 8765,
      code: code.trim(),
      token: config.token,
      lastComputerName: config.lastComputerName,
      autoReconnect,
    });
  };

  const handleScan = (data: any) => {
    setShowScanner(false);
    if (data.host) setHost(data.host);
    if (data.port) setPort(data.port.toString());
    
    if (data.token) {
      // Auto-connect with one-time token from QR
      onSaveAndConnect({
        host: data.host,
        port: parseInt(data.port, 10) || 8765,
        code: '', // Not needed for QR
        qrToken: data.token,
        token: undefined, // Clear old token until server grants new permanent token
        lastComputerName: 'My Laptop',
        autoReconnect: true, // Always auto-reconnect on successful scan
      });
      onClose();
    } else if (!code) {
      setTimeout(() => document.getElementById('input-pairing-code')?.focus(), 100);
    }
  };

  const fetchLocalHostAndShowQR = () => {
    setShowQRHost(true);
    setHelperStatus('checking');
    setHelperError(undefined);

    const isCloudPreview = typeof window !== 'undefined' && (
      window.location.protocol === 'https:' ||
      window.location.hostname.includes('.run.app') ||
      window.location.hostname.includes('.vercel.app')
    );

    let activeWs: WebSocket | null = null;
    let completed = false;

    const handleSuccess = (detectedIp: string, portNum: number, tokenVal: string, expiresAt?: number) => {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);
      try { activeWs?.close(); } catch (e) {}

      setHelperStatus('connected');
      setQrHostIp(detectedIp);
      setQrHostPort(portNum);
      setQrToken(tokenVal);
      setQrExpiresAt(expiresAt);
      setHost(detectedIp);
      setPort(portNum.toString());
    };

    const handleFail = () => {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);
      try { activeWs?.close(); } catch (e) {}

      setHelperStatus('disconnected');
      if (isCloudPreview) {
        setHelperError('QR pairing must be started from the WebMouse app running locally on this laptop.');
      } else {
        setHelperError('Start the WebMouse Windows Helper and try again.');
      }
    };

    const timeout = setTimeout(() => {
      if (!completed) {
        handleFail();
      }
    }, 3000);

    // 1. Try Fast Local HTTP API Gateway (handles port 8765 directly)
    const tryHttp = async () => {
      const endpoints = [
        'http://127.0.0.1:8765/api/pairing-info',
        'http://localhost:8765/api/pairing-info'
      ];
      for (const ep of endpoints) {
        if (completed) return;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1200);
          const res = await fetch(ep, { signal: controller.signal, mode: 'cors' });
          clearTimeout(timer);
          if (res.ok) {
            const data = await res.json();
            const detectedIp = (data.host || data.ip || '').trim();
            const portNum = parseInt(data.port, 10) || 8765;
            const tokenVal = data.token || data.pairingToken;

            if (
              detectedIp &&
              detectedIp !== 'localhost' &&
              detectedIp !== '127.0.0.1' &&
              !detectedIp.startsWith('127.') &&
              tokenVal
            ) {
              handleSuccess(detectedIp, portNum, tokenVal, data.expiresAt);
              return;
            }
          }
        } catch (e) {}
      }
    };
    tryHttp();

    // 2. Try WebSocket Gateway
    const trySocket = (url: string, onFail: () => void) => {
      if (completed) return;
      try {
        const ws = new WebSocket(url);
        activeWs = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'host_pairing_info' }));
        };

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'host_pairing_info' || data.type === 'server_info') {
              const detectedIp = (data.host || data.ip || '').trim();
              const portNum = parseInt(data.port, 10) || 8765;
              const tokenVal = data.pairingToken || data.token;

              if (
                detectedIp &&
                detectedIp !== 'localhost' &&
                detectedIp !== '127.0.0.1' &&
                !detectedIp.startsWith('127.') &&
                !detectedIp.includes('.run.app') &&
                !detectedIp.includes('.vercel.app') &&
                tokenVal
              ) {
                handleSuccess(detectedIp, portNum, tokenVal, data.expiresAt);
              }
            }
          } catch (err) {}
        };

        ws.onerror = () => {
          if (!completed) onFail();
        };
      } catch (err) {
        if (!completed) onFail();
      }
    };

    trySocket('ws://127.0.0.1:8765', () => {
      trySocket('ws://localhost:8765', () => {
        // If HTTP also failed or is blocked by browser mixed-content
        setTimeout(() => {
          if (!completed) handleFail();
        }, 1200);
      });
    });
  };

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || status === 'reconnecting';
  const hasTrustedDevice = Boolean(config.token);
  const computerDisplayName = config.lastComputerName || pairedDevice?.computerName || 'My Laptop';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      
      {showScanner && (
        <QRScanner
          onScan={handleScan}
          onClose={() => {
            setShowScanner(false);
            if (initialView === 'scanner') onClose();
          }}
        />
      )}
      {showQRHost && (
        <QRCodePairing 
          helperStatus={helperStatus}
          host={qrHostIp || config.host || ''} 
          port={qrHostPort || config.port || 8765} 
          token={qrToken || config.code || ''} 
          expiresAt={qrExpiresAt} 
          errorMessage={helperError}
          onRefresh={fetchLocalHostAndShowQR}
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
        className={`w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col max-h-[90vh] ${(showScanner || showQRHost) ? 'hidden' : ''}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight">Connection Area</h2>
              <p className="text-xs text-zinc-400">
                {hasTrustedDevice ? 'Paired Trusted Device' : 'Connect to Windows Local Helper'}
              </p>
            </div>
          </div>
          <button
            id="btn-close-conn-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Paired Device Section */}
          {hasTrustedDevice ? (
            <div className="space-y-4">
              {/* 1. Connected State */}
              {isConnected && (
                <div className="p-6 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-center flex flex-col items-center justify-center space-y-2 shadow-inner">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    🟢 Connected
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {computerDisplayName}
                  </h3>
                  <p className="text-xs text-emerald-300 font-medium">WebMouse Ready</p>
                  <p className="text-[11px] text-zinc-400 font-mono pt-1">
                    {config.host}:{config.port}
                  </p>
                </div>
              )}

              {/* 2. Reconnecting / Connecting State */}
              {isConnecting && (
                <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-center flex flex-col items-center justify-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    🟡 Reconnecting...
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {computerDisplayName}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Saved connection &bull; {config.host}:{config.port}
                  </p>
                </div>
              )}

              {/* 3. Error / Computer not found State (IP Changed or Offline) */}
              {status === 'error' && (
                <div className="p-5 rounded-2xl bg-zinc-950/90 border border-amber-500/30 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Computer not found</h3>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        Could not reach <strong className="text-zinc-200">{computerDisplayName}</strong> at <code className="text-indigo-300 bg-zinc-900 px-1 py-0.5 rounded font-mono">{config.host}:{config.port}</code>. If your laptop&apos;s local network address changed, scan a new QR code.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25"
                    >
                      <Scan className="w-4 h-4" />
                      <span>Scan New QR</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 4. Auth Failed State (Credentials Invalid / Server restarted without saved tokens) */}
              {status === 'auth_failed' && (
                <div className="p-5 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-center space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    Pairing Credentials Invalid
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    The saved pairing credential was rejected. Scan a new QR code on your PC to refresh pairing.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Scan className="w-4 h-4" />
                    <span>Scan New QR</span>
                  </button>
                </div>
              )}

              {/* Auto-reconnect Toggle */}
              <div className="flex items-center justify-between py-2 border-t border-zinc-800/50">
                <label htmlFor="chk-auto-reconnect-paired" className="text-xs text-zinc-300 cursor-pointer">
                  Automatically reconnect
                </label>
                <input
                  id="chk-auto-reconnect-paired"
                  type="checkbox"
                  checked={autoReconnect}
                  onChange={(e) => {
                     setAutoReconnect(e.target.checked);
                     onSaveAndConnect({ ...config, autoReconnect: e.target.checked });
                  }}
                  className="w-4 h-4 accent-indigo-500 rounded bg-zinc-900 border-zinc-700 cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5">
                {isConnected ? (
                  <button
                    type="button"
                    onClick={onDisconnect}
                    className="w-full py-3 px-4 rounded-xl bg-rose-600/90 hover:bg-rose-500 active:scale-[0.98] text-white font-medium text-sm transition-all shadow-lg shadow-rose-600/20"
                  >
                    Disconnect
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); handleConnect(e); }}
                      disabled={isConnecting}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 active:scale-[0.98] text-white font-medium text-sm transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isConnecting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Reconnecting...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Retry Connection</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="py-3 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-zinc-200 hover:text-white font-medium text-sm transition-all flex items-center justify-center gap-1.5 border border-zinc-700"
                      title="Scan new QR in case IP changed"
                    >
                      <Scan className="w-4 h-4 text-emerald-400" />
                      <span>New QR</span>
                    </button>
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={onForgetDevice}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 active:scale-[0.98] text-zinc-400 hover:text-rose-400 font-medium text-xs transition-all text-center"
                >
                  Forget Device
                </button>
              </div>
            </div>
          ) : (
            /* First-time or Unpaired Device Section */
            <div className="space-y-4">
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="w-full py-4 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/25"
                >
                  <Scan className="w-5 h-5" />
                  <span>Scan QR Code to Pair Phone</span>
                </button>
                
                <button
                  type="button"
                  onClick={fetchLocalHostAndShowQR}
                  className="w-full py-3 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-900 active:scale-[0.98] text-zinc-300 font-medium text-sm transition-all flex items-center justify-center gap-2 border border-zinc-800"
                >
                  <QrCode className="w-4 h-4 text-indigo-400" />
                  <span>I am the Host PC - Show QR</span>
                </button>
              </div>
            </div>
          )}

          {/* Advanced / Manual Connection Fallback */}
          <div className="pt-2">
            <div 
              className="flex items-center gap-3 text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors py-1" 
              onClick={() => setShowManual(!showManual)}
            >
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
                Advanced / Manual Connection
                <ArrowRight className={`w-3 h-3 transition-transform duration-200 ${showManual ? 'rotate-90' : ''}`} />
              </span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            {showManual && (
              <form onSubmit={handleConnect} className="space-y-3.5 animate-in slide-in-from-top-2 fade-in duration-200 pt-2">
                {/* IP Address & Port */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                      <span>Local IP Address</span>
                      <button
                        type="button"
                        onClick={onOpenHelperGuide}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                      >
                        <span>How to find?</span>
                      </button>
                    </label>
                    <input
                      id="input-computer-ip"
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="e.g. 192.168.1.5"
                      disabled={isConnected}
                      className="w-full bg-zinc-950/80 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">Port</label>
                    <input
                      id="input-computer-port"
                      type="number"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      placeholder="8765"
                      disabled={isConnected}
                      className="w-full bg-zinc-950/80 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50 text-center font-mono"
                      required
                    />
                  </div>
                </div>

                {/* 6-Digit Pairing Code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                    <span>Pairing Code (6 Digits)</span>
                    <span className="text-[11px] text-zinc-400">Printed in PC terminal</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <input
                      id="input-pairing-code"
                      type="text"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 483921"
                      disabled={isConnected}
                      className="w-full bg-zinc-950/80 border border-zinc-700 rounded-xl pl-9 pr-3.5 py-2.5 text-base font-mono tracking-widest text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Auto-reconnect Checkbox */}
                <div className="flex items-center justify-between py-1">
                  <label htmlFor="chk-auto-reconnect" className="text-xs text-zinc-300 cursor-pointer">
                    Automatically reconnect if signal drops
                  </label>
                  <input
                    id="chk-auto-reconnect"
                    type="checkbox"
                    checked={autoReconnect}
                    onChange={(e) => setAutoReconnect(e.target.checked)}
                    className="w-4 h-4 accent-indigo-500 rounded bg-zinc-900 border-zinc-700 cursor-pointer"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex gap-2.5">
                  {isConnected ? (
                    <button
                      id="btn-disconnect"
                      type="button"
                      onClick={onDisconnect}
                      className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white font-medium text-sm transition-all shadow-lg shadow-rose-600/20"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      id="btn-connect-submit"
                      type="submit"
                      disabled={isConnecting}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 active:scale-[0.98] text-white font-medium text-sm transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isConnecting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <>
                          <span>Save & Connect</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* Quick Helper Guide Callout */}
          <div className="pt-2 border-t border-zinc-800/80">
            <button
              id="btn-open-helper-instructions"
              type="button"
              onClick={onOpenHelperGuide}
              className="w-full py-2 px-3 rounded-xl bg-zinc-950/60 hover:bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 hover:text-indigo-400 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                <span>Windows Helper Setup Instructions</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
