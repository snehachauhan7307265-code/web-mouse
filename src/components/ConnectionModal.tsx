import React from 'react';
import { X, Laptop, CheckCircle2 } from 'lucide-react';
import { ConnectionConfig, ConnectionStatus, ConnectedDeviceInfo } from '../types';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ConnectionConfig;
  status: ConnectionStatus;
  deviceInfo: ConnectedDeviceInfo | null;
  pairedDevice: ConnectedDeviceInfo | null;
  onSaveAndConnect: (config: ConnectionConfig) => void;
  onDisconnect: () => void;
  onForgetDevice: () => void;
  onOpenHelperGuide: () => void;
  initialView?: 'normal' | 'scanner' | 'qr_host' | 'manual_pin' | 'download_helper';
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  status,
}) => {
  if (!isOpen) return null;

  const isConnected = status === 'connected';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Main Connection Dialog */}
      <div 
        id="modal-connection-dialog"
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>PC Connections</span>
                {isConnected && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                    Connected 🟢
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">
                WebMouse
              </p>
            </div>
          </div>
          <button
            id="btn-close-conn-modal"
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Deleted / Clean Slate Notice */}
        <div className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
            <X className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-white">Connections &amp; Codes Deleted</h3>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
              Sabhi PC connections aur connection codes poori tarah se delete kar diye gaye hain.
            </p>
          </div>
          <button
            type="button"
            id="btn-close-deleted-modal"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 active:scale-[0.98] text-white text-xs font-semibold border border-zinc-700 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
