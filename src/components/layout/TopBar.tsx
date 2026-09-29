import React, { useState } from 'react';
import { 
  MousePointer2, 
  Settings as SettingsIcon, 
  Info, 
  X, 
  Laptop, 
  RefreshCw,
  AlertCircle,
  WifiOff,
  CheckCircle2
} from 'lucide-react';
import { ConnectionStatus as ConnectionStatusType, ConnectedDeviceInfo, Device } from '../../types';

interface TopBarProps {
  status: ConnectionStatusType;
  deviceInfo: ConnectedDeviceInfo | null;
  activeDevice: Device | null;
  latencyMs?: number;
  onOpenSettings: () => void;
  onOpenConnectionModal: () => void;
  onDisconnect?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  status,
  deviceInfo,
  activeDevice,
  latencyMs,
  onOpenSettings,
  onOpenConnectionModal,
  onDisconnect,
}) => {
  const [showStatusPopover, setShowStatusPopover] = useState(false);
  const deviceName = activeDevice?.name || deviceInfo?.computerName || 'My Laptop';

  return (
    <header className="w-full bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-6 py-3 flex items-center justify-between select-none z-30 shrink-0 relative">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
          <MousePointer2 className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-white leading-none">
            WEBMOUSE V2
          </h1>
          <p className="text-[10px] text-zinc-400 mt-0.5 leading-none hidden sm:block">
            Universal Device Control
          </p>
        </div>
      </div>

      {/* Right: Single Connection Status + Settings (Section 15) */}
      <div className="flex items-center gap-2.5">
        {/* ONE Primary Connection Indicator */}
        <button
          onClick={() => setShowStatusPopover(!showStatusPopover)}
          className="transition-transform active:scale-95"
          title="Click for connection details"
        >
          {status === 'connected' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 hover:border-emerald-500/50 transition-colors">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Connected</span>
              {latencyMs !== undefined && (
                <span className="font-mono text-[11px] text-emerald-400/80 border-l border-emerald-500/30 pl-1.5 ml-0.5">
                  {latencyMs} ms
                </span>
              )}
            </span>
          )}

          {status === 'connecting' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-950/80 border border-blue-500/30 text-blue-400">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Connecting...</span>
            </span>
          )}

          {status === 'reconnecting' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-950/80 border border-amber-500/30 text-amber-400">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Reconnecting...</span>
            </span>
          )}

          {status === 'auth_failed' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-rose-950/80 border border-rose-500/30 text-rose-400">
              <AlertCircle className="w-3 h-3" />
              <span>Wrong PIN</span>
            </span>
          )}

          {status === 'error' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-rose-950/80 border border-rose-500/30 text-rose-400">
              <WifiOff className="w-3 h-3" />
              <span>Offline</span>
            </span>
          )}

          {status === 'disconnected' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-700">
              <span className="w-2 h-2 rounded-full bg-rose-500/80" />
              <span>Disconnected</span>
            </span>
          )}
        </button>

        {/* Settings Icon */}
        <button
          onClick={onOpenSettings}
          className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-850 active:scale-95 transition-all"
          title="Settings"
          aria-label="Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Connection Details Popover (Section 15: When clicked shows Device, Latency, Connection, Authentication) */}
      {showStatusPopover && (
        <div 
          className="absolute right-4 top-14 w-72 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Connection Details
            </span>
            <button
              onClick={() => setShowStatusPopover(false)}
              className="p-1 text-zinc-500 hover:text-white rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-500">Device:</span>
              <span className="font-semibold text-white truncate max-w-[140px]">{deviceName}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-zinc-500">Latency:</span>
              <span className="font-mono text-emerald-400 font-semibold">
                {latencyMs !== undefined ? `${latencyMs} ms` : 'Active'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-zinc-500">Connection:</span>
              <span className="text-zinc-300">WebSocket Fast-Lane</span>
            </div>

            <div className="flex justify-between">
              <span className="text-zinc-500">Authentication:</span>
              <span className="text-emerald-400 font-medium inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Authenticated</span>
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-800/80 flex gap-2">
            <button
              onClick={() => {
                setShowStatusPopover(false);
                onOpenConnectionModal();
              }}
              className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors text-center"
            >
              Pairing / QR
            </button>

            {status === 'connected' && onDisconnect && (
              <button
                onClick={() => {
                  setShowStatusPopover(false);
                  onDisconnect();
                }}
                className="py-1.5 px-3 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold rounded-lg border border-rose-500/20 transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
