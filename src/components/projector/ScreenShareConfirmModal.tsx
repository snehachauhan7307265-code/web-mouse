import React from 'react';
import { Cast, AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { Device } from '../../types';

interface ScreenShareConfirmModalProps {
  isOpen: boolean;
  targetDevice: Device | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ScreenShareConfirmModal: React.FC<ScreenShareConfirmModalProps> = ({
  isOpen,
  targetDevice,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !targetDevice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-400">
            <Cast className="w-6 h-6 animate-pulse" />
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-zinc-500 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
            Confirm Projection Target
          </span>
          <h3 className="text-lg font-bold text-white mt-1">
            Project screen to: <span className="text-indigo-300">{targetDevice.name}</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
            Choose what you want to share. You can share your <strong>Entire Screen</strong>, a specific <strong>Window</strong>, or a single <strong>Browser Tab</strong>.
          </p>
        </div>

        <div className="p-3 bg-zinc-900/80 rounded-2xl border border-zinc-800/80 flex items-start gap-2.5 text-xs text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            Encrypted WebRTC P2P stream. Only the authenticated device <strong className="text-white">{targetDevice.name}</strong> will receive your screen.
          </span>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5"
          >
            <Cast className="w-4 h-4" />
            <span>Start Projecting</span>
          </button>
        </div>
      </div>
    </div>
  );
};
