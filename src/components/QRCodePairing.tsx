import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, ShieldCheck, X, AlertCircle, Terminal, ExternalLink, Download, Camera, QrCode, Laptop, CheckCircle2 } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface QRCodePairingProps {
  helperStatus: 'checking' | 'connected' | 'disconnected';
  host: string;
  port: number;
  token?: string;
  expiresAt?: number;
  errorMessage?: string;
  onRefresh: () => void;
  onClose: () => void;
  onSwitchToScanner?: () => void;
  onOpenHelperGuide?: () => void;
}

export function QRCodePairing({
  helperStatus,
  host,
  port,
  token,
  expiresAt,
  errorMessage,
  onRefresh,
  onClose,
  onSwitchToScanner,
  onOpenHelperGuide,
}: QRCodePairingProps) {
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (!expiresAt) return 60;
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, expiresAt - now);
  });

  const [copySuccess, setCopySuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'helper'>('qr');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Strict validation: NEVER allow localhost, 127.0.0.1, or cloud preview domains inside the QR
  const isInvalidHost = (h: string) => {
    if (!h) return true;
    const lower = h.toLowerCase().trim();
    return (
      lower === 'localhost' ||
      lower === '127.0.0.1' ||
      lower.startsWith('127.') ||
      lower.includes('.run.app') ||
      lower.includes('.vercel.app') ||
      lower.includes('google')
    );
  };

  // Manual fallback inputs (default to empty string, NEVER hardcoded 192.168.1.100 or 1234)
  const [manualIp, setManualIp] = useState(host && !isInvalidHost(host) ? host : '');
  const [manualCode, setManualCode] = useState(token && token !== '1234' ? token : '');

  React.useEffect(() => {
    if (!expiresAt) return;

    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = expiresAt - now;
      return remaining > 0 ? remaining : 0;
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  const isExpired = token ? timeLeft <= 0 : false;

  React.useEffect(() => {
    if (host && !isInvalidHost(host)) {
      setManualIp(host.trim());
    }
  }, [host]);

  React.useEffect(() => {
    if (token) {
      setManualCode(token.trim());
    }
  }, [token]);

  const isHostValid = helperStatus === 'connected' && Boolean(host) && !isInvalidHost(host);

  // Determine effective values
  const effectiveHost = isHostValid ? host.trim() : (manualIp && !isInvalidHost(manualIp) ? manualIp.trim() : '');
  const effectivePort = isHostValid ? port : (port || 8765);
  const effectiveToken = isHostValid ? (token || '') : manualCode.trim();
  const effectiveExpiresAt = expiresAt || Math.floor(Date.now() / 1000) + 60;

  // Universal QR Payload as required by Requirement 5
  const qrPayloadObj = effectiveHost ? {
    type: "webmouse_pair",
    version: 1,
    host: effectiveHost,
    port: effectivePort,
    token: effectiveToken,
    expiresAt: effectiveExpiresAt
  } : null;

  const qrPayloadString = qrPayloadObj ? JSON.stringify(qrPayloadObj) : '';

  // Console / Debug Logging (Requirement 19)
  React.useEffect(() => {
    if (effectiveHost && qrPayloadString) {
      console.log('[WebMouse] QR generated:', {
        host: effectiveHost,
        port: effectivePort,
        token: effectiveToken ? effectiveToken.substring(0, 8) + '...' : '',
        expiresAt: effectiveExpiresAt
      });
      console.log('[WebMouse] QR payload:', qrPayloadString);
      console.log('[WebMouse] detected LAN IP:', effectiveHost);
    }
  }, [effectiveHost, effectivePort, effectiveToken, effectiveExpiresAt, qrPayloadString]);

  const handleOpenLocalWebMouse = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const localUrl = 'http://localhost:8765/';
    await copyToClipboard(localUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 4000);
    try {
      window.open(localUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // Ignore popup blocker
    }
  };

  const handleDownloadHelper = () => {
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 4000);
    const link = document.createElement('a');
    link.href = '/install_webmouse.bat';
    link.download = 'install_webmouse.bat';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full text-center relative shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          id="btn-close-qr-modal"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-900 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
            <span>Connect Your Phone</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Scan with your mobile camera to control this laptop
          </p>
        </div>

        {/* CASE 1: Checking helper */}
        {helperStatus === 'checking' && (
          <div className="w-full py-8 flex flex-col items-center justify-center space-y-4">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-200">Checking WebMouse Helper...</p>
              <p className="text-xs text-zinc-400">Connecting to port 8765 to detect your Wi-Fi LAN IP</p>
            </div>
            {/* Diagnostic section while checking */}
            <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-left space-y-1.5 text-xs font-mono mt-2">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-sans mb-1">
                Diagnostics
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 font-sans">Helper status:</span>
                <span className="text-amber-400 font-semibold">Checking...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 font-sans">LAN IP:</span>
                <span className="text-zinc-400">Detecting...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 font-sans">Port:</span>
                <span className="text-zinc-200">8765</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 font-sans">WebSocket:</span>
                <span className="text-amber-400 font-semibold">Checking...</span>
              </div>
            </div>
          </div>
        )}

        {/* CASE 2: Helper Disconnected / Offline on this laptop */}
        {helperStatus === 'disconnected' && (
          <div className="w-full flex flex-col items-center space-y-3 my-1">
            {/* Mode switch tabs */}
            <div className="w-full grid grid-cols-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-semibold">
              <button
                id="btn-tab-helper-guide"
                onClick={() => setActiveTab('helper')}
                className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'helper'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Helper Setup</span>
              </button>
              <button
                id="btn-tab-instant-qr"
                onClick={() => setActiveTab('qr')}
                className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'qr'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Manual IP Entry</span>
              </button>
            </div>

            {/* TAB 1: Helper Setup (Primary when disconnected) */}
            {activeTab === 'helper' && (
              <div className="w-full flex flex-col space-y-3 animate-in fade-in duration-150">
                {/* Notice: Requirement 14 */}
                <div 
                  id="card-browser-security-notice"
                  className="w-full p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-left space-y-2.5"
                >
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>WebMouse Helper is not running on this laptop.</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    To connect your phone, the Windows Helper service must be active on this laptop to detect your Wi-Fi LAN IP and accept mouse controls.
                  </p>
                  
                  {/* Step 1: Download helper */}
                  <div className="pt-1">
                    <button
                      id="btn-download-installer-tab"
                      onClick={handleDownloadHelper}
                      className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
                    >
                      {downloadSuccess ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                          <span>Downloaded install_webmouse.bat!</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Download Windows Helper (.bat)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Step 2: Open local interface (Laptop only) */}
                  <div className="pt-2 border-t border-amber-500/20 space-y-1.5">
                    <p className="text-[11px] text-zinc-300 font-medium">
                      Once helper is running on your laptop:
                    </p>
                    <button
                      id="btn-open-local-webmouse"
                      type="button"
                      onClick={handleOpenLocalWebMouse}
                      className="w-full py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 active:scale-98 text-amber-300 font-mono text-xs rounded-xl flex items-center justify-center gap-2 border border-zinc-700 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                      <span>{copySuccess ? 'Copied! Open in New Tab' : 'Open http://localhost:8765/'}</span>
                    </button>
                    <p className="text-[10px] text-amber-300/80 italic text-center">
                      (Laptop Only: Do not use localhost on your phone)
                    </p>
                  </div>
                </div>

                {/* Diagnostics Section: Requirement 13 */}
                <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-left space-y-1.5 text-xs font-mono">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-sans mb-1">
                    Diagnostics
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 font-sans">Helper status:</span>
                    <span className="text-red-400 font-semibold">Offline</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 font-sans">LAN IP:</span>
                    <span className="text-zinc-400">Not detected</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 font-sans">Port:</span>
                    <span className="text-zinc-200">8765</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 font-sans">WebSocket:</span>
                    <span className="text-zinc-500 font-semibold">Offline</span>
                  </div>
                </div>

                {/* Retry Button */}
                <button 
                  id="btn-retry-helper"
                  onClick={onRefresh}
                  className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 active:scale-98 text-zinc-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-check Helper Connection</span>
                </button>
              </div>
            )}

            {/* TAB 2: Manual IP Entry (If helper is already running in CMD and user knows their LAN IP) */}
            {activeTab === 'qr' && (
              <div className="w-full flex flex-col items-center space-y-3 animate-in fade-in duration-150">
                {/* QR Code display (Only if valid LAN IP entered) */}
                {effectiveHost ? (
                  <>
                    <div className="p-3.5 bg-white rounded-2xl shadow-xl flex items-center justify-center min-w-[200px] min-h-[200px]">
                      <QRCodeSVG 
                        value={qrPayloadString} 
                        size={176}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    <p className="text-xs font-medium text-emerald-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>Scan this with your phone camera!</span>
                    </p>
                  </>
                ) : (
                  <div className="w-full py-8 px-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-center space-y-2">
                    <Terminal className="w-6 h-6 text-amber-400 mx-auto" />
                    <p className="text-xs text-zinc-300 font-medium">
                      Enter your Laptop's Wi-Fi IP address below to generate your pairing QR code.
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      Find it in CMD by typing: <code className="text-amber-400">ipconfig</code>
                    </p>
                  </div>
                )}

                {/* Laptop IP & Port Display (Requirement 11) */}
                <div className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-left space-y-2 text-xs">
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
                      Laptop WiFi IP:
                    </span>
                    <input
                      id="input-qr-laptop-ip"
                      type="text"
                      value={manualIp}
                      onChange={(e) => setManualIp(e.target.value)}
                      placeholder="e.g. 192.168.1.5"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <span className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
                        Port:
                      </span>
                      <div className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 font-mono">
                        8765
                      </div>
                    </div>
                    <div className="w-24 space-y-1">
                      <span className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
                        Pair Code:
                      </span>
                      <input
                        id="input-qr-laptop-code"
                        type="text"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        placeholder="e.g. 1234"
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-2 py-1.5 text-xs text-center text-amber-300 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Diagnostics Section: Requirement 13 */}
                <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-left space-y-1.5 text-xs font-mono">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-sans mb-1">
                    Diagnostics
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 font-sans">Helper status:</span>
                    <span className="text-amber-400 font-semibold">Manual Input</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 font-sans">LAN IP:</span>
                    <span className="text-zinc-200">{effectiveHost || 'Not entered'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 font-sans">Port:</span>
                    <span className="text-zinc-200">8765</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 font-sans">WebSocket:</span>
                    <span className={effectiveHost ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}>
                      {effectiveHost ? 'Ready on LAN' : 'Awaiting IP'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Switch to Mobile Camera Scanner */}
            {onSwitchToScanner && (
              <button
                id="btn-switch-to-phone-scanner"
                onClick={onSwitchToScanner}
                className="w-full py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all mt-1"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>On your phone? Scan QR with Camera</span>
              </button>
            )}
          </div>
        )}

        {/* CASE 3: Helper Connected & Primary LAN IP Detected */}
        {helperStatus === 'connected' && isHostValid && (
          <div className="w-full flex flex-col items-center">
            {/* Host PC UI IP and Port Display (Requirement 11) */}
            <div className="w-full p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 mb-3 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  🟢 WebMouse Helper Running
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                  PORT 8765
                </span>
              </div>
              <div className="space-y-0.5 pt-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Laptop WiFi IP:
                </span>
                <div className="text-white font-mono font-bold text-base bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800 flex items-center justify-between">
                  <span>{host}</span>
                  <span className="text-xs text-emerald-400 font-sans font-normal">Wi-Fi LAN</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono pt-0.5">
                <span>Port: <strong className="text-zinc-200">{port || 8765}</strong></span>
                <span className="text-emerald-400 flex items-center gap-1 font-sans text-[10px]">
                  <ShieldCheck className="w-3 h-3" /> One-Time Token
                </span>
              </div>
            </div>

            {/* Real QR Code encoding the exact same IP and Port (Requirement 12) */}
            <div className="p-4 bg-white rounded-2xl shadow-2xl mb-3 relative flex items-center justify-center min-w-[216px] min-h-[216px]">
              {isExpired && (
                <div className="absolute inset-0 bg-white/95 rounded-2xl flex flex-col items-center justify-center backdrop-blur-xs z-10 p-4">
                  <p className="text-zinc-900 font-bold text-sm mb-3">QR Expired</p>
                  <button 
                    id="btn-generate-new-qr"
                    onClick={onRefresh}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-2 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Generate New QR</span>
                  </button>
                </div>
              )}
              <QRCodeSVG 
                value={qrPayloadString} 
                size={184}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Prompt label */}
            <p className="text-sm font-medium text-zinc-200 mb-1.5">
              Scan this with your phone camera
            </p>

            {/* Live Status indicator */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span>Waiting for phone connection...</span>
            </div>

            {/* Expiry countdown */}
            {token && !isExpired && (
              <p className="text-xs text-zinc-400 font-mono mb-2">
                QR expires in <span className="text-amber-400 font-semibold">{timeLeft}</span>s (One-time use)
              </p>
            )}

            {/* Diagnostics Section: Requirement 13 */}
            <div className="w-full mt-2 pt-2.5 border-t border-zinc-800 text-left space-y-1 text-[11px] font-mono bg-zinc-900/40 p-2.5 rounded-xl">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-sans mb-1 flex items-center justify-between">
                <span>Diagnostics</span>
                <span className="text-emerald-400 font-sans font-semibold">● Ready</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 font-sans">Helper status:</span>
                <span className="text-emerald-400 font-semibold">Running</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 font-sans">LAN IP:</span>
                <span className="text-zinc-200 font-semibold">{host}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 font-sans">Port:</span>
                <span className="text-zinc-200">8765</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 font-sans">WebSocket:</span>
                <span className="text-emerald-400 font-semibold">Ready</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
