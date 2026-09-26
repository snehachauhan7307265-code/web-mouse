import React from 'react';
import { 
  X, 
  Cast, 
  Tv, 
  Monitor, 
  Settings as SettingsIcon, 
  HelpCircle, 
  FileText, 
  SlidersHorizontal, 
  QrCode, 
  Mic, 
  Bot, 
  Radio, 
  Laptop, 
  Sparkles,
  Layers,
  ChevronRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { Device, ConnectionStatus as ConnectionStatusType } from '../types';

interface MoreMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: ConnectionStatusType;
  activeDevice: Device | null;
  onNavigate: (tab: 'home' | 'mouse' | 'keyboard' | 'share' | 'media' | 'custom' | 'settings' | 'tv_remote' | 'projector' | 'ai') => void;
  onOpenProfilesModal: () => void;
  onOpenConnectionModal: () => void;
  onOpenHelperGuide: () => void;
  onSwitchToReceiverMode?: () => void;
}

export const MoreMenuModal: React.FC<MoreMenuModalProps> = ({
  isOpen,
  onClose,
  status,
  activeDevice,
  onNavigate,
  onOpenProfilesModal,
  onOpenConnectionModal,
  onOpenHelperGuide,
  onSwitchToReceiverMode,
}) => {
  if (!isOpen) return null;

  const handleAction = (cb: () => void) => {
    cb();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div 
        className="w-full sm:max-w-lg bg-zinc-950 border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">More Tools & Settings</h2>
            <p className="text-xs text-zinc-400">WebMouse V2 system controls</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Section 1: Advanced Control Tools */}
          <div>
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block px-1 mb-2">
              Advanced Controllers
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => handleAction(() => onNavigate('projector'))}
                className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20">
                    <Cast className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Screen Projector</h4>
                    <p className="text-[10px] text-zinc-400">P2P display mirroring</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </button>

              <button
                onClick={() => handleAction(() => onNavigate('ai'))}
                className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Voice & AI Control</h4>
                    <p className="text-[10px] text-zinc-400">Speech-to-device intents</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </button>

              <button
                onClick={() => handleAction(() => onNavigate('custom'))}
                className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Custom Macros</h4>
                    <p className="text-[10px] text-zinc-400">Custom keys & deck</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </button>

              <button
                onClick={() => handleAction(() => onNavigate('tv_remote'))}
                className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20">
                    <Tv className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Android TV Remote</h4>
                    <p className="text-[10px] text-zinc-400">D-pad & smart remote</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
          </div>

          {/* Section 2: Hardware & Pairing Management */}
          <div>
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block px-1 mb-2">
              Device & Receiver Management
            </span>
            <div className="space-y-2">
              <button
                onClick={() => handleAction(onOpenProfilesModal)}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Device Manager</h4>
                    <p className="text-[10px] text-zinc-400">Pair, rename & manage multiple PCs and TVs</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </button>

              <button
                onClick={() => handleAction(onOpenConnectionModal)}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">QR Code Pairing & Setup</h4>
                    <p className="text-[10px] text-zinc-400">Scan QR or enter 6-digit PIN</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </button>

              {onSwitchToReceiverMode && (
                <button
                  onClick={() => handleAction(onSwitchToReceiverMode)}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300">
                      <Monitor className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-amber-200">Switch to TV / Smart Board Receiver</h4>
                      <p className="text-[10px] text-amber-300/80">Turn this screen into a presentation display</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-400" />
                </button>
              )}
            </div>
          </div>

          {/* Section 3: Configuration & System Guide */}
          <div>
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block px-1 mb-2">
              System & Preferences
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => handleAction(() => onNavigate('settings'))}
                className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-zinc-800 text-zinc-300 group-hover:bg-zinc-700">
                    <SettingsIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">App Settings</h4>
                    <p className="text-[10px] text-zinc-400">Sensitivity, haptics, theme</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </button>

              <button
                onClick={() => handleAction(onOpenHelperGuide)}
                className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-zinc-800 text-zinc-300 group-hover:bg-zinc-700">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Windows Helper Guide</h4>
                    <p className="text-[10px] text-zinc-400">Setup script & troubleshooting</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer branding */}
        <div className="px-5 py-3 border-t border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between text-[11px] text-zinc-400">
          <span>WebMouse V2</span>
          <span>Universal Device Control</span>
        </div>
      </div>
    </div>
  );
};
