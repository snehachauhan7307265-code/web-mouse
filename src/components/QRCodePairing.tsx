import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, ShieldCheck, X, AlertCircle, Terminal, ExternalLink } from 'lucide-react';

interface QRCodePairingProps {
  helperStatus: 'checking' | 'connected' | 'disconnected';
  host: string;
  port: number;
  token?: string;
  expiresAt?: number;
  errorMessage?: string;
  onRefresh: () => void;
  onClose: () => void;
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
}: QRCodePairingProps) {
  const [timeLeft, setTimeLeft] = React.useState<number>(() => {
    if (!expiresAt) return 60;
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, expiresAt - now);
  });

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

  const isHostValid = helperStatus === 'connected' && host && !isInvalidHost(host);

  // Authoritative QR Payload: Local HTTP Pairing URL for the Windows Helper
  // Example: http://192.168.137.1:8765/pair?token=TEMPORARY_TOKEN
  const qrPayload = isHostValid && token
    ? `http://${host.trim()}:${port || 8765}/pair?token=${token.trim()}&type=webmouse-pair&v=2&exp=${expiresAt || ''}`
    : '';

  const isCloudPreview = typeof window !== 'undefined' && (
    window.location.protocol === 'https:' ||
    window.location.hostname.includes('.run.app') ||
    window.location.hostname.includes('.vercel.app')
  );

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
        
        <p className="text-sm font-semibold text-zinc-300 mb-4">
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

        {/* CASE 2: Helper Disconnected / Cloud Preview Warning */}
        {helperStatus === 'disconnected' && (
          <div className="w-full flex flex-col items-center space-y-4 my-2">
            {isCloudPreview ? (
              /* Cloud Preview HTTPS Security Restriction Screen */
              <div className="w-full p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-left space-y-3">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Browser Security Notice</span>
                </div>
                <p className="text-xs text-amber-200/90 font-medium leading-relaxed">
                  &ldquo;QR pairing must be started from the WebMouse app running locally on this laptop.&rdquo;
                </p>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Because this AI Studio preview runs over secure HTTPS, browser security blocks direct connections to local helper interfaces. Running WebMouse locally over HTTP allows immediate communication with <code className="font-mono text-emerald-400">ws://127.0.0.1:8765</code>.
                </p>
                
                <a
                  id="btn-open-local-webmouse"
                  href="http://localhost:5173/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 active:scale-98 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Local WebMouse (http://localhost:5173/)</span>
                </a>
              </div>
            ) : (
              /* Standard Disconnected Screen */
              <div className="w-full p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-left space-y-2.5">
                <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                  <span>🔴 Windows Helper Not Connected</span>
                </div>
                <p className="text-xs text-rose-200/90 font-medium">
                  &ldquo;Start the WebMouse Windows Helper and try again.&rdquo;
                </p>
                {errorMessage && (
                  <p className="text-[11px] text-rose-400 font-mono">
                    {errorMessage}
                  </p>
                )}
              </div>
            )}

            {/* Terminal Instructions */}
            <div className="w-full p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-left space-y-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-zinc-200">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span>How to run on this Laptop:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-zinc-400 font-mono text-[11px]">
                <li>Start Helper: <code className="text-emerald-400 bg-zinc-950 px-1.5 py-0.5 rounded">python webmouse_server.py</code></li>
                <li>Start Vite: <code className="text-indigo-400 bg-zinc-950 px-1.5 py-0.5 rounded">npm run dev -- --host 0.0.0.0</code></li>
                <li>Open: <span className="text-amber-300 underline">http://localhost:5173/</span></li>
              </ol>
            </div>

            <button 
              id="btn-retry-helper"
              onClick={onRefresh}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all mt-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Helper Connection</span>
            </button>
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
