import React from 'react';
import { MousePointer2, Wifi, WifiOff, RefreshCw, AlertCircle, HelpCircle, Activity, Scan, Tv } from 'lucide-react';
import { ConnectionStatus, ConnectedDeviceInfo } from '../types';

interface HeaderProps {
  status: ConnectionStatus;
  deviceInfo: ConnectedDeviceInfo | null;
  latencyMs?: number;
  isActive?: boolean;
  onOpenConnectionModal: (view?: 'normal' | 'scanner' | 'qr_host' | 'manual_pin') => void;
  onOpenHelperGuide: () => void;
  onSwitchToReceiverMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  deviceInfo,
  latencyMs,
  isActive,
  onOpenConnectionModal,
  onOpenHelperGuide,
  onSwitchToReceiverMode,
}) => {
  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-medium tracking-wide">
            <span className={`w-2 h-2 rounded-full bg-emerald-400 ${isActive ? 'scale-125 opacity-100' : 'scale-100 opacity-60'} transition-all duration-150`} />
            <span>Connected</span>
            {latencyMs !== undefined && (
              <span className="text-[10px] text-emerald-400/70 border-l border-emerald-500/20 pl-1.5 ml-0.5">
                {latencyMs}ms
              </span>
            )}
          </div>
        );
      case 'connecting':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950/80 border border-blue-500/30 text-blue-400 text-xs font-medium">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Connecting...</span>
          </div>
        );
      case 'reconnecting':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-500/30 text-amber-400 text-xs font-medium">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Reconnecting...</span>
          </div>
        );
      case 'auth_failed':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/80 border border-rose-500/30 text-rose-400 text-xs font-medium">
            <AlertCircle className="w-3 h-3" />
            <span>Wrong Code</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/80 border border-rose-500/30 text-rose-400 text-xs font-medium">
            <WifiOff className="w-3 h-3" />
            <span>Offline</span>
          </div>
        );
      case 'disconnected':
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800/90 border border-zinc-700/60 text-zinc-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Disconnected</span>
          </div>
        );
    }
  };

  return (
    <header className="w-full bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-4 py-2.5 flex items-center justify-between select-none z-30 shrink-0">
      {/* Brand & Tagline */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <MousePointer2 className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 leading-none">
            <h1 className="text-base font-bold tracking-tight text-white">Wireless Mouse</h1>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5 leading-none">
            Control your PC remotely
          </p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1.5">
        {onSwitchToReceiverMode && (
          <button
            id="btn-switch-receiver-mode"
            onClick={onSwitchToReceiverMode}
            className="p-1.5 px-2 bg-zinc-800/90 hover:bg-zinc-700 text-amber-400 hover:text-amber-300 border border-zinc-700/60 rounded-lg flex items-center gap-1 text-[11px] font-semibold shadow-sm transition-all active:scale-95"
            title="Switch this device to TV / Smart Board Receiver Mode"
          >
            <Tv className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Receiver</span>
          </button>
        )}

        {status !== 'connected' && (
          <button
            id="btn-header-quick-scan"
            onClick={() => onOpenConnectionModal('scanner')}
            className="p-1.5 px-2 bg-emerald-600/90 hover:bg-emerald-500 active:scale-95 text-white rounded-lg flex items-center gap-1 text-[11px] font-semibold shadow-sm transition-all"
            title="Scan Laptop QR Code"
          >
            <Scan className="w-3.5 h-3.5 text-emerald-200" />
            <span className="hidden sm:inline">Scan</span>
          </button>
        )}

        {/* Helper Guide Button */}
        <button
          id="btn-helper-guide"
          onClick={onOpenHelperGuide}
          className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 active:scale-95 rounded-lg transition-colors"
          title="Windows Helper Setup & Code"
          aria-label="Windows Helper Setup"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* Connection Status Button */}
        <button
          id="btn-connection-status"
          onClick={() => onOpenConnectionModal('normal')}
          className="transition-transform active:scale-95"
          title={
            deviceInfo
              ? `Connected to ${deviceInfo.computerName} (${deviceInfo.ip})`
              : 'Tap to configure connection'
          }
        >
          {getStatusBadge()}
        </button>
      </div>
    </header>
  );
};
