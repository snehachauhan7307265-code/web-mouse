import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, Upload, CheckCircle2, ShieldCheck, Laptop, AlertCircle } from 'lucide-react';
import { QRPairPayload } from '../../types';
import { connectionManager } from '../../services/connectionManager';

interface PairQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPairSuccess: () => void;
}

export const PairQRModal: React.FC<PairQRModalProps> = ({ isOpen, onClose, onPairSuccess }) => {
  const [step, setStep] = useState<'scanning' | 'preview' | 'pairing' | 'success'>('scanning');
  const [scannedPayload, setScannedPayload] = useState<QRPairPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('scanning');
      setScannedPayload(null);
      setErrorMessage(null);
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    try {
      setErrorMessage(null);
      // Wait for DOM element
      setTimeout(async () => {
        const qrElement = document.getElementById('qr-modal-reader');
        if (!qrElement) return;

        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
          } catch {}
          scannerRef.current = null;
        }

        const html5QrCode = new Html5Qrcode('qr-modal-reader');
        scannerRef.current = html5QrCode;

        try {
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras || cameras.length === 0) {
            setErrorMessage('No camera found on this device. You can upload a QR screenshot.');
            return;
          }

          // Prefer back camera on mobile
          const cameraId = cameras.length > 1 ? cameras[cameras.length - 1].id : cameras[0].id;
          await html5QrCode.start(
            cameraId,
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              handleDecodedText(decodedText);
            },
            () => {}
          );
          setIsCameraActive(true);
        } catch (err: any) {
          console.warn('[PairQRModal] Camera start error:', err);
          setErrorMessage('Camera access denied or unavailable in this view. Use Upload QR Screenshot below.');
        }
      }, 100);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to start camera');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleDecodedText = (text: string) => {
    try {
      const trimmed = text.trim();
      let parsed: any = null;

      // Handle direct JSON
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        parsed = JSON.parse(trimmed);
      } else {
        // Check for URL containing json or params
        const urlMatch = trimmed.match(/webmouse:\/\/(.+)/i) || trimmed.match(/https?:\/\/[^\s]+[?&]pair=([^&]+)/i);
        if (urlMatch) {
          try {
            parsed = JSON.parse(decodeURIComponent(urlMatch[1]));
          } catch {}
        }
      }

      if (!parsed) {
        setErrorMessage('Invalid QR Code. Please scan the QR Code shown in the WebMouse Helper window on your PC.');
        return;
      }

      // STRICT VALIDATION
      if (
        parsed.type !== 'webmouse_pair' ||
        !parsed.deviceId ||
        !parsed.host ||
        !parsed.port ||
        !parsed.pairingToken
      ) {
        setErrorMessage('Incompatible QR Code format. Please ensure you are running the new WebMouse Helper.');
        return;
      }

      const validPayload: QRPairPayload = {
        type: 'webmouse_pair',
        version: parsed.version || 1,
        deviceId: String(parsed.deviceId).trim(),
        deviceName: String(parsed.deviceName || 'My Laptop').trim(),
        host: String(parsed.host).trim(),
        port: parseInt(parsed.port, 10) || 8765,
        pairingToken: String(parsed.pairingToken).trim(),
      };

      // Stop camera and show preview
      stopScanner();
      setScannedPayload(validPayload);
      setStep('preview');
      setErrorMessage(null);
    } catch (e: any) {
      setErrorMessage('Could not read QR data: ' + (e?.message || 'Invalid format'));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMessage(null);
      const html5QrCode = scannerRef.current || new Html5Qrcode('qr-modal-reader');
      scannerRef.current = html5QrCode;

      const result = await html5QrCode.scanFile(file, true);
      handleDecodedText(result);
    } catch (err) {
      setErrorMessage('No QR code detected in the selected image. Please try again.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTrustAndConnect = async () => {
    if (!scannedPayload) return;
    setStep('pairing');
    setErrorMessage(null);

    const success = await connectionManager.pairAndTrust(scannedPayload);
    if (success) {
      setStep('success');
      setTimeout(() => {
        onPairSuccess();
        onClose();
      }, 1200);
    } else {
      setStep('preview');
      setErrorMessage('Pairing failed. Make sure your PC and phone are on the same Wi-Fi and WebMouse Helper is running.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Pair Windows PC
              </h2>
              <p className="text-[11px] text-zinc-400">
                Scan the QR code shown in WebMouse Helper
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* STEP 1: SCANNING */}
          {step === 'scanning' && (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-square border border-zinc-800 flex items-center justify-center">
                <div id="qr-modal-reader" className="w-full h-full" />

                {!isCameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-950/90 gap-3">
                    <Camera className="w-10 h-10 text-indigo-400 animate-pulse" />
                    <p className="text-xs text-zinc-300">
                      Point camera at the QR code in the WebMouse Helper window on your PC screen.
                    </p>
                    <button
                      type="button"
                      onClick={startScanner}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md transition-all flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Start Camera</span>
                    </button>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Upload screenshot alternative */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-xs font-semibold text-zinc-200 border border-zinc-700 transition-all flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>Upload QR Image / Screenshot</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW — EXACT REQUIRED FORMAT */}
          {step === 'preview' && scannedPayload && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                      <Laptop className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">
                        {scannedPayload.deviceName}
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Windows PC found
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Trust Status:</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>🟡 Not Trusted</span>
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  id="btn-trust-and-connect"
                  onClick={handleTrustAndConnect}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>[ TRUST &amp; CONNECT ]</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('scanning');
                    startScanner();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-xs font-semibold text-zinc-300 border border-zinc-700 transition-all text-center"
                >
                  Scan Different QR
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PAIRING IN PROGRESS */}
          {step === 'pairing' && (
            <div className="py-10 text-center space-y-4 animate-in fade-in duration-200">
              <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Trusting &amp; Connecting...</h3>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                  Exchanging secure cryptographic credentials with {scannedPayload?.deviceName || 'Windows PC'}.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS — EXACT REQUIRED FORMAT */}
          {step === 'success' && scannedPayload && (
            <div className="py-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  💻 {scannedPayload.deviceName}
                </h3>
                <p className="text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>🟢 {scannedPayload.deviceName} Trusted</span>
                </p>
                <p className="text-xs text-zinc-400 pt-1">
                  Connected
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
