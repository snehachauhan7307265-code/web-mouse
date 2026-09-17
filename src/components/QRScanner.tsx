import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: any) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let isMounted = true;
    let isScanning = false;
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      (decodedText) => {
        try {
          // Attempt to parse JSON
          const data = JSON.parse(decodedText);
          if (data.type === 'webmouse-pair') {
            if (isScanning) {
              isScanning = false;
              scanner.stop().then(() => {
                if (isMounted) onScan(data);
              }).catch(console.error);
            } else {
              if (isMounted) onScan(data);
            }
          } else {
            setError("Invalid QR Code for WebMouse.");
          }
        } catch (e) {
          setError("Invalid QR Code format.");
        }
      },
      (err) => {
        // Ignore normal scanning errors (no code found)
      }
    ).then(() => {
      isScanning = true;
    }).catch((err) => {
      if (!isMounted) return;
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied') || err?.message?.includes('NotAllowedError')) {
        setError("Camera permission denied. Please allow camera access in your browser settings.");
      } else {
        setError("Failed to start camera. Please ensure camera permissions are granted.");
      }
      console.error(err);
    });

    return () => {
      isMounted = false;
      if (scannerRef.current && isScanning) {
        isScanning = false;
        try {
          scannerRef.current.stop().catch(() => {});
        } catch (e) {}
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-100 font-medium">
            <Camera className="w-5 h-5 text-indigo-400" />
            Scan QR Code
          </div>
          <button onClick={onClose} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 flex-1 relative bg-black">
          <div id="qr-reader" className="w-full h-full min-h-[300px] overflow-hidden rounded-xl border border-zinc-800 bg-black" />
          
          {error && (
            <div className="absolute bottom-6 left-6 right-6 p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-sm flex items-start gap-2 shadow-lg backdrop-blur-md">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-zinc-950 text-center text-xs text-zinc-400">
          Point your phone camera at the WebMouse QR code displayed on your laptop.
        </div>
      </div>
    </div>
  );
}
