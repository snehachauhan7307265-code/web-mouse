import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { MonitorUp, ShieldCheck, X } from 'lucide-react';

interface QRCodePairingProps {
  host: string;
  port: number;
  code?: string;
  onClose: () => void;
}

export function QRCodePairing({ host, port, code, onClose }: QRCodePairingProps) {
  const payload = JSON.stringify({
    type: "webmouse-pair",
    version: 1,
    host,
    port,
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col items-center p-8">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl mb-4">
          <MonitorUp className="w-8 h-8" />
        </div>
        
        <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Connect Phone</h2>
        <p className="text-sm text-zinc-400 text-center mb-6">
          Scan this QR code from the WebMouse app on your phone.
        </p>

        <div className="p-4 bg-white rounded-2xl shadow-xl mb-6">
          <QRCodeSVG 
            value={payload} 
            size={200}
            level="M"
            includeMargin={false}
          />
        </div>
        
        <div className="flex flex-col items-center gap-1 w-full text-center mb-2">
          <h3 className="font-semibold text-white">Host PC</h3>
          <p className="text-zinc-400 font-mono text-sm bg-zinc-900 px-3 py-1 rounded-lg">
            {host ? `${host}:${port}` : `IP Not Set : ${port}`}
          </p>
          {code && (
            <p className="text-zinc-400 font-mono text-sm bg-zinc-900 px-3 py-1 rounded-lg mt-1">
              Pairing Code: {code}
            </p>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-zinc-800/80 w-full">
          <p className="text-xs text-zinc-500 text-center flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            End-to-End Local Connection
          </p>
        </div>
      </div>
    </div>
  );
}
