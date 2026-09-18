import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, ShieldCheck, X } from 'lucide-react';

interface QRCodePairingProps {
  host: string;
  port: number;
  code?: string;
  token?: string;
  expiresAt?: number;
  onRefresh?: () => void;
  onClose: () => void;
}

export function QRCodePairing({ host, port, token, expiresAt, onRefresh, onClose }: QRCodePairingProps) {
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

  const payload = JSON.stringify({
    type: "webmouse-pair",
    version: 2,
    host: host || (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'),
    port: port || 8765,
    ...(token && { token }),
    ...(expiresAt && { expiresAt })
  });

  const isExpired = token ? timeLeft <= 0 : false;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        id="qr-pairing-card"
        className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col items-center p-7 text-center font-sans"
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
        
        <p className="text-sm font-semibold text-zinc-300 mb-5">
          Connect Phone
        </p>

        {/* Real QR Code */}
        <div className="p-4 bg-white rounded-2xl shadow-xl mb-4 relative flex items-center justify-center min-w-[216px] min-h-[216px]">
          {isExpired && (
            <div className="absolute inset-0 bg-white/95 rounded-2xl flex flex-col items-center justify-center backdrop-blur-xs z-10 p-4">
              <p className="text-zinc-900 font-semibold text-sm mb-3">QR Code Expired</p>
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
            value={payload} 
            size={184}
            level="M"
            includeMargin={false}
          />
        </div>

        {/* Prompt label */}
        <p className="text-sm font-medium text-zinc-200 mb-3">
          Scan this with your phone
        </p>

        {/* Live Status indicator */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium mb-3">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span>🟡 Waiting for phone...</span>
        </div>

        {/* Expiry countdown */}
        {token && !isExpired && (
          <p className="text-xs text-zinc-400 font-mono">
            QR expires in <span className="text-amber-400 font-semibold">{timeLeft}</span> seconds
          </p>
        )}

        {isExpired && (
          <button 
            onClick={onRefresh}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline mt-1"
          >
            Generate New QR
          </button>
        )}

        <div className="mt-5 pt-4 border-t border-zinc-800/80 w-full flex items-center justify-between text-[11px] text-zinc-500">
          <span className="font-mono">{host || '127.0.0.1'}:{port || 8765}</span>
          <span className="flex items-center gap-1 text-emerald-400/90 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" /> One-Time Token
          </span>
        </div>
      </div>
    </div>
  );
}
