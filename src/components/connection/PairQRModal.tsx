import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  X, 
  Camera, 
  RefreshCw, 
  Upload, 
  CheckCircle2, 
  ShieldCheck, 
  Laptop, 
  AlertCircle, 
  SwitchCamera, 
  Key, 
  QrCode,
  Link,
  ChevronRight
} from 'lucide-react';
import { QRPairPayload } from '../../types';
import { connectionManager } from '../../services/connectionManager';

interface PairQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPairSuccess: () => void;
}

export const PairQRModal: React.FC<PairQRModalProps> = ({ isOpen, onClose, onPairSuccess }) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [step, setStep] = useState<'scanning' | 'preview' | 'pairing' | 'success'>('scanning');
  const [scannedPayload, setScannedPayload] = useState<QRPairPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Manual fallback inputs
  const [manualHost, setManualHost] = useState('');
  const [manualPort, setManualPort] = useState('8765');
  const [manualToken, setManualToken] = useState('');
  const [manualName, setManualName] = useState('My Laptop');
  const [jsonPaste, setJsonPaste] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isStoppingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setStep('scanning');
      setActiveTab('camera');
      setScannedPayload(null);
      setErrorMessage(null);
      startScanner('environment');
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const disarmReaderVideos = () => {
    try {
      const videos = document.querySelectorAll('#qr-modal-reader video');
      videos.forEach((v: any) => {
        v.onabort = (e: any) => e?.stopPropagation?.();
        v.onerror = (e: any) => e?.stopPropagation?.();
      });
    } catch {}
  };

  const startScanner = async (requestedFacing = facingMode) => {
    try {
      setErrorMessage(null);
      await stopScanner();

      // Wait a tick for DOM element to mount
      setTimeout(async () => {
        const qrElement = document.getElementById('qr-modal-reader');
        if (!qrElement) return;

        isStoppingRef.current = false;
        const html5QrCode = new Html5Qrcode('qr-modal-reader');
        scannerRef.current = html5QrCode;

        // Disarm video abort errors continuously
        const interval = setInterval(disarmReaderVideos, 300);

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        try {
          // Attempt back camera (environment)
          await html5QrCode.start(
            { facingMode: requestedFacing },
            config,
            (decodedText) => {
              clearInterval(interval);
              handleDecodedText(decodedText);
            },
            () => {}
          );
          setIsCameraActive(true);
          setFacingMode(requestedFacing);
        } catch (errFacing) {
          console.warn('[PairQRModal] Primary facing mode failed, trying fallback:', errFacing);
          try {
            // Alternate facing mode
            const altFacing = requestedFacing === 'environment' ? 'user' : 'environment';
            await html5QrCode.start(
              { facingMode: altFacing },
              config,
              (decodedText) => {
                clearInterval(interval);
                handleDecodedText(decodedText);
              },
              () => {}
            );
            setIsCameraActive(true);
            setFacingMode(altFacing);
          } catch (errAlt) {
            // Try getCameras
            const cameras = await Html5Qrcode.getCameras().catch(() => []);
            if (cameras && cameras.length > 0) {
              const camId = cameras.length > 1 ? cameras[cameras.length - 1].id : cameras[0].id;
              await html5QrCode.start(
                camId,
                config,
                (decodedText) => {
                  clearInterval(interval);
                  handleDecodedText(decodedText);
                },
                () => {}
              );
              setIsCameraActive(true);
            } else {
              throw errAlt;
            }
          }
        }
      }, 120);
    } catch (e: any) {
      console.warn('[PairQRModal] Scanner error:', e);
      setIsCameraActive(false);
      setErrorMessage(
        'Camera is unavailable or permission denied. You can take a photo of the QR code or use Manual IP.'
      );
    }
  };

  const stopScanner = async () => {
    isStoppingRef.current = true;
    disarmReaderVideos();
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

  const toggleCameraFacing = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    await startScanner(nextFacing);
  };

  const handleDecodedText = (text: string) => {
    try {
      const trimmed = text.trim();
      let parsed: any = null;

      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        parsed = JSON.parse(trimmed);
      } else {
        const urlMatch = trimmed.match(/webmouse:\/\/(.+)/i) || trimmed.match(/https?:\/\/[^\s]+[?&]pair=([^&]+)/i);
        if (urlMatch) {
          try {
            parsed = JSON.parse(decodeURIComponent(urlMatch[1]));
          } catch {}
        }
      }

      if (!parsed) {
        setErrorMessage('This QR code is not a WebMouse pairing code.');
        return;
      }

      // VALIDATE QR PAYLOAD (Section 1 & 4)
      if (
        parsed.type !== 'webmouse_pair' ||
        !parsed.deviceId ||
        !parsed.host ||
        !parsed.port ||
        !parsed.pairingToken
      ) {
        setErrorMessage('This QR code is not a valid WebMouse pairing code.');
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
      await stopScanner();
      const html5QrCode = new Html5Qrcode('qr-modal-reader');
      scannerRef.current = html5QrCode;

      const result = await html5QrCode.scanFile(file, true);
      handleDecodedText(result);
    } catch (err) {
      setErrorMessage('No QR code detected in the selected image. Please try another photo.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Try parsing json paste first
    if (jsonPaste.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(jsonPaste.trim());
        if (parsed.host && parsed.pairingToken) {
          handleDecodedText(jsonPaste.trim());
          return;
        }
      } catch {}
    }

    if (!manualHost.trim() || !manualToken.trim()) {
      setErrorMessage('Please enter the PC IP address and pairing token shown on your PC screen.');
      return;
    }

    const payload: QRPairPayload = {
      type: 'webmouse_pair',
      version: 1,
      deviceId: 'pc-' + manualHost.replace(/\./g, '-'),
      deviceName: manualName.trim() || 'My Laptop',
      host: manualHost.trim(),
      port: parseInt(manualPort, 10) || 8765,
      pairingToken: manualToken.trim(),
    };

    setScannedPayload(payload);
    setStep('preview');
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
      setErrorMessage('Pairing failed. Make sure your PC and phone are on the same Wi-Fi or Mobile Hotspot.');
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
                Install WebMouse Helper &rarr; Scan QR &rarr; Trust Device
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

        {/* Mode Switch Tabs (Scanner vs Manual) */}
        {step === 'scanning' && (
          <div className="flex items-center border-b border-zinc-800/80 bg-zinc-950 px-4 pt-2">
            <button
              onClick={() => {
                setActiveTab('camera');
                startScanner();
              }}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'camera'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Camera QR Scanner</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('manual');
                stopScanner();
              }}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'manual'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Manual IP / Token</span>
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* STEP 1: SCANNING / CAMERA */}
          {step === 'scanning' && activeTab === 'camera' && (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-square border border-zinc-800 flex items-center justify-center">
                <div id="qr-modal-reader" className="w-full h-full" />

                {!isCameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-950/95 gap-3 z-10">
                    <Camera className="w-10 h-10 text-indigo-400 animate-pulse" />
                    <p className="text-xs text-zinc-300 max-w-xs">
                      Tap below to grant camera access and scan the QR code on your PC screen.
                    </p>
                    <button
                      type="button"
                      onClick={() => startScanner()}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md transition-all flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Start Camera</span>
                    </button>
                  </div>
                )}

                {/* Flip camera control overlay */}
                {isCameraActive && (
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/10 text-xs transition-all z-20 flex items-center gap-1"
                    title="Switch camera"
                  >
                    <SwitchCamera className="w-4 h-4" />
                    <span className="text-[10px] hidden sm:inline">Flip</span>
                  </button>
                )}
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Upload screenshot alternative */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-xs font-semibold text-zinc-200 border border-zinc-700 transition-all flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>Upload QR Screenshot / Take Photo</span>
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

          {/* STEP 1B: MANUAL INPUT FALLBACK */}
          {step === 'scanning' && activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-3 animate-in fade-in duration-150">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-zinc-400">PC IP Address</label>
                <input
                  type="text"
                  value={manualHost}
                  onChange={(e) => setManualHost(e.target.value)}
                  placeholder="e.g. 192.168.1.15"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-400">Port</label>
                  <input
                    type="number"
                    value={manualPort}
                    onChange={(e) => setManualPort(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-400">Device Name</label>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="My Laptop"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-zinc-400">Pairing Token (From Helper Window)</label>
                <input
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="e.g. secure-random-token"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all mt-2"
              >
                Continue to Trust Device
              </button>
            </form>
          )}

          {/* STEP 2: PREVIEW — EXACT SPECIFICATION (Section 1 & 5) */}
          {step === 'preview' && scannedPayload && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <Laptop className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      💻 {scannedPayload.deviceName}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Windows PC found
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Security Status:</span>
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
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
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
                  Scan Again
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

          {/* STEP 4: SUCCESS — EXACT SPECIFICATION (Section 1 & 6) */}
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
