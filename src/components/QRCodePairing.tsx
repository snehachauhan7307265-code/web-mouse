import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, ShieldCheck, X, AlertCircle, Terminal, ExternalLink, Copy, Check, Download, Camera, QrCode, Laptop, CheckCircle2 } from 'lucide-react';
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
  const [manualIp, setManualIp] = useState(host && !host.includes('localhost') && !host.includes('127.0.0.1') ? host : '192.168.1.100');
  const [manualCode, setManualCode] = useState(token || '1234');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

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

  const isHostValid = helperStatus === 'connected' && host && !isInvalidHost(host);

  // QR Payload: When helper is connected use authoritative token, otherwise use manual/detected host
  const effectiveHost = isHostValid ? host : manualIp.trim();
  const effectivePort = isHostValid ? port : (port || 8765);
  const effectiveToken = isHostValid ? (token || '') : manualCode.trim();

  // Universal QR Payload containing host, port, token, code, and protocol version
  const qrPayload = effectiveHost
    ? `http://${effectiveHost}:${effectivePort}/pair?token=${encodeURIComponent(effectiveToken)}&code=${encodeURIComponent(effectiveToken)}&type=webmouse-pair&v=2`
    : '';

  const isCloudPreview = typeof window !== 'undefined' && (
    window.location.protocol === 'https:' ||
    window.location.hostname.includes('.run.app') ||
    window.location.hostname.includes('.vercel.app')
  );

  const handleOpenLocalWebMouse = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // 1. Try opening new window
    try {
      window.open('http://localhost:8765/', '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.warn('Popup blocked:', err);
    }

    // 2. Safe clipboard copy with fallback
    const copied = await copyToClipboard('http://localhost:8765/');
    if (copied) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 4000);
    }
  };

  const handleDownloadHelper = () => {
    try {
      const a = document.createElement('a');
      a.href = '/install_webmouse.bat';
      a.download = 'install_webmouse.bat';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (e) {
      if (onOpenHelperGuide) onOpenHelperGuide();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        id="qr-pairing-card"
        className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col items-center p-6 text-center font-sans max-h-[95vh] overflow-y-auto"
      >
        <button 
          id="btn-close-qr-host"
          onClick={onClose} 
          className="absolute top-4 right-4 p-2 bg-zinc-900/80 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-2xl" role="img" aria-label="mouse">🖱️</span>
          <h2 className="text-xl font-bold tracking-tight text-white">WebMouse</h2>
        </div>
        
        <p className="text-sm font-semibold text-zinc-300 mb-3">
          Host PC — One-Scan Pairing
        </p>

        {/* CASE 1: Checking helper */}
        {helperStatus === 'checking' && (
          <div className="w-full py-12 flex flex-col items-center justify-center space-y-4">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-200">Querying Windows Helper...</p>
              <p className="text-xs text-zinc-400">Connecting to port 8765 to detect local LAN IP</p>
            </div>
          </div>
        )}

        {/* CASE 2: Helper Disconnected / Cloud Preview Screen */}
        {helperStatus === 'disconnected' && (
          <div className="w-full flex flex-col items-center space-y-3 my-1">
            {/* Mode switch tabs: Show QR Code directly vs Setup Guide */}
            <div className="w-full grid grid-cols-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-semibold">
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
                <span>Show QR Code</span>
              </button>
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
            </div>

            {/* TAB 1: Direct QR Code Generator (Works Instantly!) */}
            {activeTab === 'qr' && (
              <div className="w-full flex flex-col items-center space-y-3 animate-in fade-in duration-150">
                {/* Real Scannable QR Code */}
                <div className="p-3.5 bg-white rounded-2xl shadow-xl flex items-center justify-center min-w-[200px] min-h-[200px]">
                  <QRCodeSVG 
                    value={qrPayload || 'http://192.168.1.100:8765/pair'} 
                    size={176}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                <p className="text-xs font-medium text-emerald-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Scan this with your mobile camera!</span>
                </p>

                {/* Laptop IP Configurator */}
                <div className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-left space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-300 font-medium text-[11px]">
                    <span>Laptop WiFi IP Address:</span>
                    <span className="text-[10px] text-zinc-500">(cmd &gt; ipconfig)</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      id="input-qr-laptop-ip"
                      type="text"
                      value={manualIp}
                      onChange={(e) => setManualIp(e.target.value)}
                      placeholder="e.g. 192.168.1.5"
                      className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      id="input-qr-laptop-code"
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="Code"
                      className="w-16 bg-zinc-950 border border-zinc-700 rounded-xl px-2 py-1.5 text-xs text-center text-amber-300 font-mono focus:outline-none focus:border-emerald-500"
                      title="Pairing Code"
                    />
                  </div>
                </div>

                {/* 1-Click Helper Download */}
                <button
                  id="btn-download-helper-direct"
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
            )}

            {/* TAB 2: Helper Setup & Browser Notice (Matches target CSS selector) */}
            {activeTab === 'helper' && (
              <div className="w-full flex flex-col space-y-3 animate-in fade-in duration-150">
                {/* Notice Card: div:nth-of-type(1) inside container */}
                <div 
                  id="card-browser-security-notice"
                  className="w-full p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-left space-y-3 cursor-pointer transition-colors hover:bg-amber-950/50"
                  onClick={handleOpenLocalWebMouse}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Local Laptop Helper</span>
                    </div>
                    {copySuccess && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-md flex items-center gap-1">
                        <Check className="w-3 h-3" /> Copied!
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-amber-200/90 font-medium leading-relaxed">
                    Agar aapne laptop par WebMouse Helper start kar liya hai, toh local URL par open karein:
                  </p>

                  {/* Interactive Button */}
                  <button
                    id="btn-open-local-webmouse"
                    type="button"
                    onClick={handleOpenLocalWebMouse}
                    className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 active:scale-98 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20"
                  >
                    {copySuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-950" />
                        <span>Link Copied! Open in New Tab (Ctrl+V)</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4" />
                        <span>Open / Copy http://localhost:8765/</span>
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    💡 <strong>Tip:</strong> Button par click karte hi link copy ho jayega. Laptop browser mein nayi tab khol kar <code className="font-mono text-emerald-400 bg-zinc-900 px-1 py-0.5 rounded">Ctrl + V</code> paste karke Enter dabayein!
                  </p>
                </div>

                {/* 1-Click Batch Installer */}
                <button
                  id="btn-download-installer-tab"
                  onClick={handleDownloadHelper}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>📥 Download install_webmouse.bat</span>
                </button>

                {/* Quick Terminal Guide */}
                <div className="w-full p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-left space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-zinc-200">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    <span>Run via CMD:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-zinc-400 font-mono text-[11px]">
                    <li>Helper run karein: <code className="text-emerald-400 bg-zinc-950 px-1.5 py-0.5 rounded">python webmouse_server.py</code></li>
                    <li>Browser mein kholein: <span className="text-amber-300">http://localhost:8765/</span></li>
                  </ol>
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

            {/* Switch to Mobile Camera Scanner */}
            {onSwitchToScanner && (
              <button
                id="btn-switch-to-phone-scanner"
                onClick={onSwitchToScanner}
                className="w-full py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all mt-1"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>📱 Mobile phone par hain? Camera se QR scan karein</span>
              </button>
            )}
          </div>
        )}

        {/* CASE 3: Helper Connected - Display Real Scannable QR */}
        {helperStatus === 'connected' && isHostValid && (
          <div className="w-full flex flex-col items-center">
            {/* Host Status Summary Header */}
            <div className="w-full p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 mb-4 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  🟢 Windows Helper Connected
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                  READY
                </span>
              </div>
              <div className="space-y-1 text-xs text-zinc-300">
                <div className="text-[11px] text-zinc-400 font-medium">Laptop LAN IP:</div>
                <div className="text-white font-mono font-bold text-sm bg-zinc-900/80 px-2 py-1 rounded-lg border border-zinc-800">
                  {host}
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono pt-1">
                <span>Pairing: <strong className="text-emerald-400">READY</strong></span>
                <span>Port: <strong className="text-zinc-200">{port}</strong></span>
              </div>
            </div>

            {/* Real QR Code */}
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
                value={qrPayload} 
                size={184}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Prompt label */}
            <p className="text-sm font-medium text-zinc-200 mb-2">
              Scan this with your phone camera
            </p>

            {/* Live Status indicator */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span>🟡 Waiting for phone...</span>
            </div>

            {/* Expiry countdown */}
            {token && !isExpired && (
              <p className="text-xs text-zinc-400 font-mono mb-2">
                QR expires in <span className="text-amber-400 font-semibold">{timeLeft}</span> seconds
              </p>
            )}

            {isExpired && (
              <button 
                onClick={onRefresh}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline mb-2"
              >
                Generate New QR
              </button>
            )}

            {/* Development / Debug Information */}
            <div className="w-full mt-3 pt-3 border-t border-zinc-800/80 text-left space-y-1 text-[10px] font-mono text-zinc-400 bg-zinc-900/40 p-2.5 rounded-xl">
              <div className="text-[11px] font-semibold text-zinc-300 mb-1 flex items-center justify-between">
                <span>Debug Information</span>
                <span className="text-emerald-400 flex items-center gap-1 font-sans">
                  <ShieldCheck className="w-3 h-3" /> One-Time Token
                </span>
              </div>
              <div className="flex justify-between">
                <span>Windows Helper:</span>
                <span className="text-emerald-400 font-semibold">🟢 Connected</span>
              </div>
              <div className="flex justify-between">
                <span>LAN IP:</span>
                <span className="text-zinc-200">{host}</span>
              </div>
              <div className="flex justify-between">
                <span>WebSocket:</span>
                <span className="text-zinc-200">ws://{host}:{port}</span>
              </div>
              <div className="flex justify-between">
                <span>Gateway URL:</span>
                <span className="text-zinc-400 truncate max-w-[190px]">http://{host}:{port}/pair</span>
              </div>
              <div className="flex justify-between">
                <span>QR Status:</span>
                <span className="text-emerald-400 font-semibold">{isExpired ? 'Expired' : 'Ready'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

