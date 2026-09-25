import React, { useState } from 'react';
import { X, Download, Copy, Check, Eye, ExternalLink, Camera, AlertCircle } from 'lucide-react';

interface ScreenshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenshotData: {
    image?: string;
    filename?: string;
    timestamp?: number;
    error?: string;
  } | null;
  isLoading?: boolean;
}

export const ScreenshotModal: React.FC<ScreenshotModalProps> = ({
  isOpen,
  onClose,
  screenshotData,
  isLoading,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!screenshotData?.image) return;
    const link = document.createElement('a');
    link.href = screenshotData.image;
    link.download = screenshotData.filename || `WebMouse_Screenshot_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = async () => {
    if (!screenshotData?.image) return;
    try {
      // Fetch blob from data url
      const res = await fetch(screenshotData.image);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      try {
        await navigator.clipboard.writeText(screenshotData.image);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">PC Screen Capture</h3>
              <p className="text-[11px] text-zinc-400">
                {screenshotData?.filename || 'Windows Desktop'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center min-h-[220px]">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-zinc-400 font-medium">Capturing Windows screen...</p>
            </div>
          ) : screenshotData?.error ? (
            <div className="p-6 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <p className="text-sm font-semibold text-rose-300">Screenshot Failed</p>
              <p className="text-xs text-zinc-400">{screenshotData.error}</p>
            </div>
          ) : screenshotData?.image ? (
            <div className="w-full rounded-2xl overflow-hidden border border-zinc-800 bg-black flex items-center justify-center">
              <img
                src={screenshotData.image}
                alt="PC Screenshot"
                className="w-full h-auto max-h-[55vh] object-contain"
              />
            </div>
          ) : (
            <div className="text-zinc-500 text-xs py-8">No screenshot available</div>
          )}
        </div>

        {/* Footer Actions */}
        {screenshotData?.image && !isLoading && (
          <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download Image</span>
            </button>
            <button
              onClick={handleCopy}
              className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition-all border border-zinc-700"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
