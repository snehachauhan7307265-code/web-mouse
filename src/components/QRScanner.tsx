import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, RefreshCw, Upload, Terminal, SwitchCamera, ExternalLink } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: any) => void;
  onClose: () => void;
  onManualPin?: () => void;
}

export function QRScanner({ onScan, onClose, onManualPin }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isScanningFile, setIsScanningFile] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, []);

  const disarmReaderVideos = () => {
    try {
      const videos = document.querySelectorAll('#qr-reader video');
      videos.forEach((v: any) => {
        v.onabort = null;
        v.onerror = null;
      });
    } catch {}
  };

  // Continuously disarm and guard video elements created by html5-qrcode
  useEffect(() => {
    const container = document.getElementById('qr-reader');
    if (!container) return;

    const guardVideos = () => {
      const videos = container.querySelectorAll('video');
      videos.forEach((v: any) => {
        if (!v.__abortGuarded) {
          v.__abortGuarded = true;
          const origAbort = v.onabort;
          v.onabort = (e: any) => {
            try {
              if (origAbort) origAbort.call(v, e);
            } catch (err) {
              // Benign suppression of RenderedCameraImpl video surface onabort() called
            }
          };
          const origError = v.onerror;
          v.onerror = (e: any) => {
            try {
              if (origError) origError.call(v, e);
            } catch (err) {
              // Benign suppression of RenderedCameraImpl video surface onerror() called
            }
          };
        }
      });
    };

    const observer = new MutationObserver(guardVideos);
    observer.observe(container, { childList: true, subtree: true });
    guardVideos();

    return () => {
      observer.disconnect();
    };
  }, []);

  const pauseAndDetachVideo = () => {
    try {
      disarmReaderVideos();
      const videos = document.querySelectorAll('#qr-reader video');
      videos.forEach((video) => {
        const vid = video as HTMLVideoElement;
        vid.onabort = null;
        vid.onerror = null;
        try {
          vid.pause();
        } catch {}
        if (vid.srcObject) {
          const stream = vid.srcObject as MediaStream;
          stream.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {}
          });
          vid.srcObject = null;
        }
      });
    } catch {}
  };

  const safelyStopScanner = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    disarmReaderVideos();

    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch {}

      disarmReaderVideos();

      try {
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }

    pauseAndDetachVideo();
  };

  const handleClose = async () => {
    await safelyStopScanner();
    onClose();
  };

  // Process decoded QR text
  const processDecodedText = useCallback(
    (decodedText: string) => {
      try {
        let pairData: any = null;
        const trimmed = (decodedText || '').trim();
        console.log('[WebMouse] Scanned QR text:', trimmed);

        // 1. JSON payload
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === 'object') {
              pairData = {
                type: parsed.type || 'webmouse_pair',
                version: parsed.version || parsed.v || 1,
                host: (parsed.host || parsed.ip || '').trim(),
                port: parseInt(parsed.port, 10) || 8765,
                token: (parsed.token || parsed.qrToken || '').trim() || undefined,
                code: (parsed.code || (parsed.token && String(parsed.token).length <= 8 ? String(parsed.token) : '') || '').trim() || undefined,
                expiresAt: parsed.expiresAt ? parseInt(parsed.expiresAt, 10) : undefined,
              };
            }
          } catch (jsonErr) {
            console.warn('[WebMouse] JSON QR parse error:', jsonErr);
          }
        }

        // 2. URL format fallback
        if (!pairData) {
          const urlMatch = trimmed.match(/(https?:\/\/[^\s"'<>]+|ws:\/\/[^\s"'<>]+)/i);
          if (urlMatch) {
            try {
              const urlStr = urlMatch[1].replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');
              const url = new URL(urlStr);
              const tokenParam = url.searchParams.get('token');
              const codeParam = url.searchParams.get('code');
              const typeParam = url.searchParams.get('type');
              const verParam = url.searchParams.get('v');
              const expParam = url.searchParams.get('exp') || url.searchParams.get('expiresAt');

              pairData = {
                type: typeParam || 'webmouse_pair',
                version: verParam ? parseInt(verParam, 10) : 1,
                host: url.hostname.trim(),
                port: parseInt(url.port, 10) || 8765,
                token: (tokenParam || codeParam || '').trim() || undefined,
                code: (codeParam || (tokenParam && tokenParam.length <= 8 ? tokenParam : '') || '').trim() || undefined,
                expiresAt: expParam ? parseInt(expParam, 10) : undefined,
              };
            } catch (urlErr) {
              console.warn('[WebMouse] URL QR parse error:', urlErr);
            }
          }
        }

        // 3. Plain IP or IP:Port format
        if (!pairData) {
          const ipPortMatch = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::(\d{1,5}))?$/);
          if (ipPortMatch) {
            pairData = {
              type: 'webmouse_pair',
              version: 1,
              host: ipPortMatch[1].trim(),
              port: ipPortMatch[2] ? parseInt(ipPortMatch[2], 10) : 8765,
              token: undefined,
              code: undefined,
            };
          }
        }

        if (!pairData) {
          setError('अमान्य QR कोड: WebMouse pairing info नहीं मिला। (Invalid QR code)');
          return;
        }

        if (!pairData.host) {
          setError('QR कोड में PC का IP एड्रेस नहीं मिला। (Missing IP address)');
          return;
        }

        const hostLower = String(pairData.host).toLowerCase().trim();
        if (
          hostLower === 'localhost' ||
          hostLower === '127.0.0.1' ||
          hostLower.startsWith('127.') ||
          hostLower.includes('.run.app') ||
          hostLower.includes('.vercel.app')
        ) {
          setError('QR कोड में लोकलहोस्ट (localhost) है। कृपया PC का Wi-Fi IP (उदा: 192.168.x.x) वाला QR कोड स्कैन करें।');
          return;
        }

        // Check expiration
        if (pairData.expiresAt) {
          const now = Math.floor(Date.now() / 1000);
          if (now > pairData.expiresAt + 60) {
            setError('यह QR कोड एक्सपायर हो चुका है। कृपया PC पर नया QR कोड रिफ्रेश करें।');
            return;
          }
        }

        safelyStopScanner().finally(() => {
          onScan(pairData);
        });
      } catch {
        setError('QR कोड प्रोसेस करने में त्रुटि हुई।');
      }
    },
    [onScan]
  );

  // Start Camera with resilient fallbacks
  const startCamera = useCallback(
    async (cameraList: Array<{ id: string; label: string }>, targetIndex = 0) => {
      setIsInitializing(true);
      setError(null);
      isStoppingRef.current = false;

      try {
        disarmReaderVideos();
        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode('qr-reader');
        } else if (scannerRef.current.isScanning) {
          try {
            await scannerRef.current.stop();
          } catch {}
          disarmReaderVideos();
        }

        const qrConfig = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        if (cameraList.length > 0) {
          const cam = cameraList[targetIndex % cameraList.length];
          try {
            await scannerRef.current.start(cam.id, qrConfig, processDecodedText, () => {});
            setIsInitializing(false);
            return;
          } catch (camErr) {
            console.warn('Selected camera ID failed, attempting facingMode fallback:', camErr);
            disarmReaderVideos();
          }
        }

        // Attempt facingMode environment
        try {
          await scannerRef.current.start(
            { facingMode: { ideal: 'environment' } },
            qrConfig,
            processDecodedText,
            () => {}
          );
          setIsInitializing(false);
          return;
        } catch {
          disarmReaderVideos();
          // Attempt facingMode user (front camera)
          await scannerRef.current.start(
            { facingMode: 'user' },
            qrConfig,
            processDecodedText,
            () => {}
          );
          setIsInitializing(false);
        }
      } catch (err: any) {
        console.warn('Camera start fatal error:', err);
        setIsInitializing(false);
        if (
          err?.name === 'NotAllowedError' ||
          err?.message?.includes('Permission denied') ||
          err?.message?.includes('NotAllowedError')
        ) {
          setError(
            'कैमरा परमिशन नहीं मिली (Camera permission denied)। ब्राउज़र सेटिंग्स में कैमरा Allow करें या नीचे से फोटो अपलोड करें।'
          );
        } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
          setError('कैमरा हार्डवेयर नहीं मिला या किसी अन्य ऐप (Zoom/WhatsApp) द्वारा उपयोग में है।');
        } else {
          setError('कैमरा शुरू करने में समस्या आई। आप फोटो अपलोड कर सकते हैं या 6-अंकों का PIN दर्ज कर सकते हैं।');
        }
      }
    },
    [processDecodedText]
  );

  // Initialize and list cameras on mount
  useEffect(() => {
    let active = true;

    async function initCameras() {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (!active) return;
        if (devices && devices.length > 0) {
          setAvailableCameras(devices);
          // Prefer back camera if found
          let defaultIndex = 0;
          const backIndex = devices.findIndex((d) => {
            const lbl = (d.label || '').toLowerCase();
            return lbl.includes('back') || lbl.includes('rear') || lbl.includes('environment');
          });
          if (backIndex !== -1) defaultIndex = backIndex;
          setCurrentCameraIndex(defaultIndex);
          await startCamera(devices, defaultIndex);
        } else {
          await startCamera([], 0);
        }
      } catch (e) {
        if (!active) return;
        console.warn('Failed to enumerate cameras:', e);
        await startCamera([], 0);
      }
    }

    initCameras();

    return () => {
      active = false;
      safelyStopScanner();
    };
  }, [startCamera]);

  // Switch to next camera
  const handleSwitchCamera = () => {
    if (availableCameras.length <= 1) {
      // Toggle between environment and user
      const nextIdx = currentCameraIndex === 0 ? 1 : 0;
      setCurrentCameraIndex(nextIdx);
      startCamera([], nextIdx);
      return;
    }
    const nextIdx = (currentCameraIndex + 1) % availableCameras.length;
    setCurrentCameraIndex(nextIdx);
    startCamera(availableCameras, nextIdx);
  };

  // Scan from Photo / Image file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningFile(true);
    setError(null);

    try {
      // Stop live camera to prevent conflict
      await safelyStopScanner();

      const tempScanner = new Html5Qrcode('qr-reader');
      scannerRef.current = tempScanner;
      const decodedText = await tempScanner.scanFile(file, true);
      processDecodedText(decodedText);
    } catch (err) {
      console.warn('Scan file error:', err);
      setError('इस फोटो में QR कोड नहीं मिला। कृपया PC स्क्रीन का स्पष्ट फोटो लें।');
    } finally {
      setIsScanningFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Scan WebMouse QR Code</span>
          </div>
          <div className="flex items-center gap-1">
            {availableCameras.length > 1 && (
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="p-2 bg-zinc-900 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                title="कैमरा बदलें (Switch Camera)"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            )}
            <button
              id="btn-close-qr-scanner"
              type="button"
              onClick={handleClose}
              className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera Container */}
        <div className="p-4 flex-1 relative bg-black flex flex-col items-center justify-center min-h-[290px]">
          <div
            id="qr-reader"
            className="w-full h-full min-h-[260px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 flex items-center justify-center relative"
          />

          {isInitializing && (
            <div className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center gap-2 z-10">
              <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
              <span className="text-xs text-zinc-300 font-medium">कैमरा शुरू हो रहा है... (Starting Camera)</span>
            </div>
          )}

          {isScanningFile && (
            <div className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center gap-2 z-10">
              <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
              <span className="text-xs text-zinc-300 font-medium">फोटो स्कैन की जा रही है...</span>
            </div>
          )}

          {/* Error Banner with helpful direct solutions */}
          {error && (
            <div className="absolute inset-x-4 bottom-4 p-3.5 bg-zinc-950/95 border border-rose-500/50 rounded-2xl text-zinc-200 text-xs shadow-2xl backdrop-blur-md z-20 space-y-2">
              <div className="flex items-start gap-2 text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-snug">{error}</span>
              </div>

              {/* Quick Action options when camera fails */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => startCamera(availableCameras, (currentCameraIndex + 1) % (availableCameras.length || 1))}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>पुनः प्रयास (Retry)</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm"
                >
                  <Upload className="w-3 h-3" />
                  <span>फोटो चुनें</span>
                </button>
              </div>

              {isInIframe && (
                <p className="text-[10px] text-amber-300/80 pt-0.5 leading-tight">
                  💡 टिप: प्रीव्यू विंडो में कैमरा ब्लॉक होने पर ऐप को न्यू टैब (New Tab) में खोलें।
                </p>
              )}
            </div>
          )}
        </div>

        {/* Hidden file input for Photo QR scan */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Bottom Bar: Alternate Pairing Options */}
        <div className="p-3 bg-zinc-950 border-t border-zinc-800/80 space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>फोटो / स्क्रीनशॉट से स्कैन करें</span>
            </button>

            {onManualPin && (
              <button
                type="button"
                onClick={() => {
                  safelyStopScanner();
                  onManualPin();
                }}
                className="py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>PIN डालें</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-zinc-400 text-center">
            लैपटॉप के CMD में दिख रहे QR कोड पर फोन का कैमरा फोकस करें।
          </p>
        </div>
      </div>
    </div>
  );
}
