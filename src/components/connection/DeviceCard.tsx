import React, { useState } from 'react';
import { Laptop, MoreVertical, CheckCircle2, RefreshCw, Trash2, Edit2, WifiOff, Power } from 'lucide-react';
import { TrustedDevice, ConnectionState } from '../../types';

interface DeviceCardProps {
  device: TrustedDevice;
  activeDeviceId: string | null;
  connectionState: ConnectionState;
  onConnect: (device: TrustedDevice) => void;
  onDisconnect: () => void;
  onRename: (deviceId: string, newName: string) => void;
  onForget: (deviceId: string) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  activeDeviceId,
  connectionState,
  onConnect,
  onDisconnect,
  onRename,
  onForget,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(device.deviceName);
  const [showForgetConfirm, setShowForgetConfirm] = useState(false);

  const isActive = activeDeviceId === device.deviceId;
  const isConnected = isActive && connectionState === 'CONNECTED';
  const isConnecting = isActive && connectionState === 'CONNECTING';
  const isReconnecting = isActive && connectionState === 'RECONNECTING';
  const isOffline = isActive && connectionState === 'OFFLINE';

  const handleSaveRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onRename(device.deviceId, newName.trim());
      setIsRenaming(false);
    }
  };

  return (
    <>
      <div className={`w-full rounded-2xl bg-zinc-900 border transition-all p-5 shadow-xl space-y-4 ${
        isConnected
          ? 'border-emerald-500/40 shadow-emerald-500/10'
          : isReconnecting
          ? 'border-amber-500/40'
          : 'border-zinc-800 hover:border-zinc-700'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl border shrink-0 transition-colors ${
              isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-zinc-800/80 border-zinc-700/60 text-indigo-400'
            }`}>
              <Laptop className="w-6 h-6" />
            </div>

            <div>
              {isRenaming ? (
                <form onSubmit={handleSaveRename} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 bg-indigo-600 rounded text-xs font-semibold text-white"
                  >
                    Save
                  </button>
                </form>
              ) : (
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span>💻 {device.deviceName}</span>
                </h3>
              )}

              {/* Status Indicator */}
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>🟢 Trusted</span>
                </span>
                <span className="text-zinc-500 text-xs">•</span>
                <span className="text-zinc-400 text-xs font-medium">Windows PC</span>
              </div>
            </div>
          </div>

          {/* Action Menu [ ⋮ ] */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Device options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-10 w-44 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-1.5 z-30 animate-in fade-in zoom-in-95 text-xs">
                {isConnected ? (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDisconnect();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-amber-400 hover:bg-amber-500/10 font-medium transition-colors text-left"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onConnect(device);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-emerald-400 hover:bg-emerald-500/10 font-medium transition-colors text-left"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Connect</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowMenu(false);
                    setIsRenaming(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:bg-zinc-850 font-medium transition-colors text-left"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Rename</span>
                </button>

                <div className="my-1 border-t border-zinc-850" />

                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowForgetConfirm(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 font-medium transition-colors text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Forget Device</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Live Reconnecting / Offline Notice */}
        {isReconnecting && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-2 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>🟡 Reconnecting...</span>
          </div>
        )}

        {isOffline && (
          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 text-xs font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-zinc-600" />
            <span>⚫ Offline</span>
          </div>
        )}

        {/* Bottom Actions Row: [ CONNECT ] */}
        <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/80">
          {isConnected ? (
            <button
              onClick={onDisconnect}
              className="flex-1 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 active:scale-[0.98] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 border border-zinc-700"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>🟢 Connected (Tap to Disconnect)</span>
            </button>
          ) : isConnecting ? (
            <button
              disabled
              className="flex-1 py-3 px-4 rounded-xl bg-indigo-600/70 text-white text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>🟡 Connecting...</span>
            </button>
          ) : (
            <button
              onClick={() => onConnect(device)}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-[0.98] text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span>[ CONNECT ]</span>
            </button>
          )}
        </div>
      </div>

      {/* Forget Device Confirmation Modal */}
      {showForgetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in select-none">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h4 className="text-base font-bold text-white">
                Forget {device.deviceName}?
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                After forgetting, pairing with QR code will be required again to connect.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForgetConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-xs font-semibold text-zinc-300 transition-colors"
              >
                [ Cancel ]
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForgetConfirm(false);
                  onForget(device.deviceId);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-md shadow-rose-600/30 transition-all"
              >
                [ Forget ]
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
