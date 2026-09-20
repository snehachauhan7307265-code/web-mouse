import React from 'react';
import { 
  MousePointer2, 
  Keyboard as KeyboardIcon, 
  FolderUp, 
  Image as ImageIcon, 
  Link, 
  MonitorPlay, 
  MonitorUp, 
  History,
  Trash2,
  Scan,
  RefreshCw,
  AlertTriangle,
  Camera,
  QrCode,
  Terminal,
  KeyRound
} from 'lucide-react';
import { ConnectionStatus, ConnectedDeviceInfo, LogEntry } from '../types';

interface HomeTabProps {
  status: ConnectionStatus;
  deviceInfo: ConnectedDeviceInfo | null;
  pairedDevice: ConnectedDeviceInfo | null;
  latencyMs?: number;
  logs: LogEntry[];
  onNavigate: (tab: 'home' | 'mouse' | 'keyboard' | 'share' | 'media' | 'settings') => void;
  onClearLogs: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onOpenConnectionModal?: (view?: 'normal' | 'scanner' | 'qr_host' | 'manual_pin') => void;
  onForgetDevice?: () => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  status,
  deviceInfo,
  pairedDevice,
  latencyMs,
  logs,
  onNavigate,
  onClearLogs,
  onReconnect,
  onDisconnect,
  onOpenConnectionModal,
  onForgetDevice
}) => {
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || status === 'reconnecting';
  const computerName = deviceInfo?.computerName || pairedDevice?.computerName || 'My Laptop';

  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-5 pb-8 bg-zinc-950 text-white">
      {/* 1. Connection Status Card */}
      {isConnected ? (
        <div className="w-full p-5 rounded-3xl bg-emerald-950/30 border border-emerald-500/40 flex flex-col items-center justify-center text-center shadow-lg shadow-emerald-950/20 animate-in fade-in duration-200">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>🟢 Connected to {computerName}</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">{computerName}</h2>
          <p className="text-xs text-emerald-300/90 font-medium mt-0.5 font-mono">
            {deviceInfo?.ip}:{deviceInfo?.port || 8765}
          </p>
          
          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-emerald-500/20 w-full justify-between text-xs">
            <span className="text-zinc-400 font-mono">
              ⚡ {latencyMs !== undefined ? `${latencyMs} ms latency` : 'Active'}
            </span>
            <button
              onClick={onDisconnect}
              className="px-3 py-1 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-xs font-medium border border-zinc-800"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : status === 'connecting' ? (
        <div className="w-full p-4 rounded-2xl bg-blue-950/30 border border-blue-500/40 flex items-center justify-between shadow-lg shadow-blue-950/20">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
            <div>
              <span className="text-xs font-semibold text-blue-400">Connecting to {pairedDevice?.ip || 'Laptop'}:8765...</span>
              <p className="text-[11px] text-zinc-400">Authenticating with Windows Helper...</p>
            </div>
          </div>
        </div>
      ) : isConnecting ? (
        <div className="w-full p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex items-center justify-between shadow-lg shadow-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <div>
              <span className="text-xs font-semibold text-amber-400">🟡 Reconnecting...</span>
              <h3 className="text-sm font-bold text-white">{computerName}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onReconnect}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-all active:scale-95 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
            {onForgetDevice && (
              <button
                onClick={onForgetDevice}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 text-xs transition-colors"
              >
                Forget
              </button>
            )}
          </div>
        </div>
      ) : status === 'auth_failed' ? (
        <div className="w-full p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 space-y-3 shadow-lg">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-rose-300">Authentication Failed</h3>
              <p className="text-xs text-zinc-300 mt-0.5">
                {deviceInfo?.errorMessage || 'Invalid pairing code or expired QR token. Scan a fresh QR code on your laptop.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => onOpenConnectionModal?.('scanner')}
              className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
            >
              <Scan className="w-3.5 h-3.5 text-emerald-300" />
              <span>Scan New QR</span>
            </button>
            <button
              onClick={onReconnect}
              className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      ) : status === 'error' || pairedDevice ? (
        <div className="w-full p-4 rounded-2xl bg-zinc-900/90 border border-amber-500/30 space-y-3 shadow-lg">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-white">Connection Failed</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Could not reach <strong className="text-zinc-200">{computerName}</strong> on port 8765. Ensure laptop and phone are on the same Wi-Fi.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => onOpenConnectionModal?.('manual_pin')}
              className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
            >
              <KeyRound className="w-3.5 h-3.5 text-indigo-200" />
              <span>Enter PIN</span>
            </button>
            <button
              onClick={() => onOpenConnectionModal?.('scanner')}
              className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Scan className="w-3.5 h-3.5 text-emerald-300" />
              <span>Scan QR</span>
            </button>
            <button
              onClick={onReconnect}
              className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition-colors"
            >
              Retry
            </button>
            {onForgetDevice && (
              <button
                onClick={onForgetDevice}
                className="py-2 px-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 font-medium text-xs transition-colors"
              >
                Forget
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full p-5 rounded-3xl bg-zinc-900/90 border border-zinc-800 flex flex-col items-center text-center space-y-4 shadow-xl">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20 shadow-inner">
            <KeyRound className="w-7 h-7 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Connect Phone to Laptop</h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
              Scan the QR code or enter the 6-digit PIN shown on your laptop.
            </p>
          </div>

          <div className="w-full max-w-xs space-y-2.5 pt-1">
            {/* Primary 1: Camera Scan */}
            <button
              id="btn-scan-qr-phone"
              onClick={() => onOpenConnectionModal?.('scanner')}
              className="w-full py-3 px-4 rounded-2xl bg-emerald-600/90 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
            >
              <Camera className="w-4 h-4 text-emerald-100" />
              <span>Scan QR Code</span>
            </button>

            {/* Primary 2: Host PC Screen Show QR / Open CMD */}
            <button
              id="btn-show-qr-laptop"
              onClick={() => onOpenConnectionModal?.('qr_host')}
              className="w-full py-2.5 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700/80 active:scale-[0.98] border border-zinc-700/80 text-zinc-300 font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <QrCode className="w-4 h-4 text-indigo-400" />
              <span>Laptop QR & Helper</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Touchpad Card */}
      <button 
        onClick={() => onNavigate('mouse')}
        className="w-full relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600/30 to-purple-600/10 border border-indigo-500/30 p-6 flex flex-col items-center justify-center min-h-[150px] group transition-all active:scale-[0.98]"
      >
        <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-colors"></div>
        <div className="p-4 bg-indigo-500/20 rounded-2xl mb-3 group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/20">
          <MousePointer2 className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Touchpad</h2>
        <p className="text-xs text-indigo-200/70">Swipe to control your computer</p>
      </button>

      {/* 3. Quick Action Grid */}
      <div className="grid grid-cols-2 gap-3">
        <button 
          onClick={() => onNavigate('keyboard')}
          className="flex flex-col items-start p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-95"
        >
          <div className="p-2 bg-zinc-800 rounded-lg mb-3 text-zinc-300 group-hover:text-white">
            <KeyboardIcon className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-zinc-100 text-sm">Keyboard</h3>
          <p className="text-xs text-zinc-500 mt-1 text-left leading-relaxed">Type on your computer</p>
        </button>

        <button 
          onClick={() => onNavigate('share')}
          className="flex flex-col items-start p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-95"
        >
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg mb-3">
            <FolderUp className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-zinc-100 text-sm">File Share</h3>
          <p className="text-xs text-zinc-500 mt-1 text-left leading-relaxed">Send files to PC</p>
        </button>

        <button 
          onClick={() => onNavigate('share')}
          className="flex flex-col items-start p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-95"
        >
          <div className="p-2 bg-pink-500/10 text-pink-400 rounded-lg mb-3">
            <ImageIcon className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-zinc-100 text-sm">Photos</h3>
          <p className="text-xs text-zinc-500 mt-1 text-left leading-relaxed">Share photos</p>
        </button>

        <button 
          onClick={() => onNavigate('share')}
          className="flex flex-col items-start p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-95"
        >
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg mb-3">
            <Link className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-zinc-100 text-sm">Quick Share</h3>
          <p className="text-xs text-zinc-500 mt-1 text-left leading-relaxed">Send links & text</p>
        </button>

        <button 
          onClick={() => onNavigate('media')}
          className="flex flex-col items-start p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-95"
        >
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg mb-3">
            <MonitorPlay className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-zinc-100 text-sm">Media</h3>
          <p className="text-xs text-zinc-500 mt-1 text-left leading-relaxed">Control media</p>
        </button>

        <button 
          id="btn-quick-projector"
          onClick={() => onNavigate('projector')}
          className="flex flex-col items-start p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-emerald-500/40 transition-all active:scale-95"
        >
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg mb-3">
            <MonitorUp className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-zinc-100 text-sm flex items-center gap-1.5">
            <span>Screen Share</span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400">WA</span>
          </h3>
          <p className="text-xs text-zinc-500 mt-1 text-left leading-relaxed">WhatsApp style share</p>
        </button>
      </div>

      {/* 4. Recent Activity */}
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-bold flex items-center gap-2 text-zinc-100">
            <History className="w-4 h-4 text-zinc-400" />
            Recent Activity
          </h3>
          {logs.length > 0 && (
            <button 
              onClick={onClearLogs}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
          {logs.length === 0 ? (
            <div className="p-5 text-center text-xs text-zinc-500">
              No recent activity
            </div>
          ) : (
            <div className="flex flex-col max-h-40 overflow-y-auto divide-y divide-zinc-800/50">
              {[...logs].reverse().slice(0, 8).map((log) => (
                <div key={log.id} className="p-3 flex items-start gap-3">
                  <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                    log.type === 'error' ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]' :
                    log.type === 'success' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' :
                    log.type === 'warning' ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]' :
                    'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-200 truncate">{log.message}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
