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
  const isStoppingRef = useRef(false);
  const startPromiseRef = useRef<Promise<null> | null>(null);

  const pauseAndDetachVideo = () => {
    try {
      const video = document.querySelector('#qr-reader video') as HTMLVideoElement | null;
      if (video) {
        try {
          video.pause();
        } catch (e) {}
        if (video.srcObject) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach((t) => {
            try { t.stop(); } catch (e) {}
          });
          video.srcObject = null;
        }
      }
    } catch (e) {}
  };

  const safelyStopScanner = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    pauseAndDetachVideo();

    if (startPromiseRef.current) {
      try {
        await startPromiseRef.current;
      } catch (e) {}
    }

    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (e) {}

      try {
        scannerRef.current.clear();
      } catch (e) {}
      scannerRef.current = null;
    }
  };

  const handleClose = async () => {
    await safelyStopScanner();
    onClose();
  };

  useEffect(() => {
    let isMounted = true;
    isStoppingRef.current = false;

    let scanner: Html5Qrcode;
    try {
      scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
    } catch (e) {
      console.warn("Failed to initialize Html5Qrcode", e);
      return;
    }

    const startPromise = scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      (decodedText) => {
        try {
          let pairData: any = null;
          const trimmed = (decodedText || '').trim();

          // 1. Check for URL format (http://, https://, ws://, or embedded in text)
          const urlMatch = trimmed.match(/(https?:\/\/[^\s"'<>]+|ws:\/\/[^\s"'<>]+)/i);
          if (urlMatch) {
            try {
              const urlStr = urlMatch[1].replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');
              const url = new URL(urlStr);
              const tokenParam = url.searchParams.get('token');
              const codeParam = url.searchParams.get('code');
              const typeParam = url.searchParams.get('type');
              const verParam = url.searchParams.get('v');
              const expParam = url.searchParams.get('exp');

              pairData = {
                type: typeParam || 'webmouse-pair',
                version: verParam ? parseInt(verParam, 10) : 2,
                host: url.hostname,
                port: parseInt(url.port, 10) || 8765,
                token: tokenParam || codeParam || undefined,
                code: codeParam || (tokenParam && tokenParam.length <= 8 ? tokenParam : undefined),
                expiresAt: expParam ? parseInt(expParam, 10) : undefined,
              };
            } catch (urlErr) {
              console.warn("Failed to parse QR as URL", urlErr);
            }
          }

          // 2. If not URL, try JSON payload
          if (!pairData && trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed && typeof parsed === 'object') {
                pairData = {
                  type: parsed.type || 'webmouse-pair',
                  version: parsed.version || parsed.v || 2,
                  host: parsed.host || parsed.ip,
                  port: parseInt(parsed.port, 10) || 8765,
                  token: parsed.token || parsed.qrToken,
                  code: parsed.code || (parsed.token && String(parsed.token).length <= 8 ? String(parsed.token) : undefined),
                  expiresAt: parsed.expiresAt ? parseInt(parsed.expiresAt, 10) : undefined,
                };
              }
            } catch (jsonErr) {
              // Not JSON
            }
          }

          // 3. Check for plain IP:Port or IP format (e.g. 192.168.1.5:8765 or 192.168.1.5)
          if (!pairData) {
            const ipPortMatch = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::(\d{1,5}))?$/);
            if (ipPortMatch) {
              pairData = {
                type: 'webmouse-pair',
                version: 2,
                host: ipPortMatch[1],
                port: ipPortMatch[2] ? parseInt(ipPortMatch[2], 10) : 8765,
                token: undefined,
                code: undefined,
              };
            }
          }

          if (!pairData) {
            setError("Invalid QR Code: WebMouse pairing info not found.");
            return;
          }

          // 4. Validate host
          if (!pairData.host) {
            setError("QR Code is missing computer IP address.");
            return;
          }

          const hostLower = String(pairData.host).toLowerCase().trim();
          if (
            hostLower === 'localhost' ||
            hostLower === '127.0.0.1' ||
            hostLower.startsWith('127.') ||
            hostLower.includes('.run.app') ||
            hostLower.includes('.vercel.app') ||
            hostLower.includes('google')
          ) {
            setError("Invalid host in QR: Cannot connect to 'localhost' from phone. Please make sure the laptop's Wi-Fi IP (e.g. 192.168.x.x) is used.");
            return;
          }

          // 5. Check expiration with generous leeway (5 minutes) for device clock skew
          if (pairData.expiresAt) {
            const now = Math.floor(Date.now() / 1000);
            if (now > pairData.expiresAt + 300) {
              setError("This QR code has expired. Please refresh the QR code on your laptop.");
              return;
            }
          }

          safelyStopScanner().finally(() => {
            if (isMounted) onScan(pairData);
          });
        } catch (e) {
          setError("Failed to process QR Code.");
        }
      },
      () => {
        // Ignore normal scanning errors (no code found)
      }
    );

    startPromiseRef.current = startPromise;

    startPromise.then(() => {
      if (!isMounted || isStoppingRef.current) {
        safelyStopScanner();
      }
    }).catch((err) => {
      if (!isMounted) return;
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied') || err?.message?.includes('NotAllowedError')) {
        setError("Camera permission denied. Please allow camera access in your browser settings.");
      } else {
        setError("Failed to start camera. Please ensure camera permissions are granted.");
      }
      console.warn("Camera start error:", err);
    });

    return () => {
      isMounted = false;
      safelyStopScanner();
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
          <button 
            id="btn-close-qr-scanner"
            onClick={handleClose} 
            className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"
          >
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
