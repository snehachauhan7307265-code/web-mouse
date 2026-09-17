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
  Trash2
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
  onDisconnect
}) => {
  const isConnected = status === 'connected';
  const computerName = deviceInfo?.computerName || pairedDevice?.computerName || 'Windows PC';

  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-6 pb-6 bg-zinc-950 text-white">
      {/* 1. Dashboard Header */}
      <div className="flex flex-col gap-1 mt-2">
        <h1 className="text-3xl font-bold tracking-tight">Control</h1>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
              <span className="text-sm font-medium text-zinc-300">Connected to <span className="text-white font-semibold">{computerName}</span></span>
              <span className="text-xs text-zinc-500 ml-1 px-1.5 py-0.5 rounded-md bg-zinc-800/50">
                ⚡ {latencyMs !== undefined ? `${latencyMs} ms` : 'Measuring...'}
              </span>
            </>
          ) : (
            <>
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
              <span className="text-sm font-medium text-zinc-400">Disconnected</span>
              <button 
                onClick={onReconnect}
                className="ml-2 text-xs text-indigo-400 font-semibold hover:text-indigo-300 transition-colors"
              >
                Reconnect
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Main Touchpad Card */}
      <button 
        onClick={() => onNavigate('mouse')}
        className="w-full relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600/30 to-purple-600/10 border border-indigo-500/30 p-6 flex flex-col items-center justify-center min-h-[160px] group transition-all active:scale-[0.98]"
      >
        <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-colors"></div>
        <div className="p-4 bg-indigo-500/20 rounded-2xl mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/20">
          <MousePointer2 className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Touchpad</h2>
        <p className="text-sm text-indigo-200/70">Swipe to control your computer</p>
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
          <h3 className="font-semibold text-zinc-100">Keyboard</h3>
          <p className="text-xs text-zinc-500 mt-1 text-left leading-relaxed">Type on your computer</p>
        </button>

        <button 
          onClick={() => onNavigate('share')}
          className="flex flex-col items-start p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-95"
        >
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg mb-3">
            <FolderUp className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-zinc-100">File Share</h3>
          <p className="text-xs text-zinc-500 mt-1 text-left leading-relaxed">Send files to PC</p>
        </button>

        <button 
          onClick={() => onNavigate('share')}
          className="flex flex-col items-start p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-95"
        >
          <div className="p-2 bg-pink-500/10 text-pink-400 rounded-lg mb-3">
            <ImageIcon className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-zinc-100">Photos</h3>
          <p className="text-xs text-zinc-500 mt-1 text-left leading-relaxed">Share photos</p>
        </button>

        {/* 4. Quick Share */}
        <button 
          onClick={() => onNavigate('share')}
          className="flex flex-col items-start p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-95"
        >
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg mb-3">
            <Link className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-zinc-100">Quick Share</h3>
          <p className="text-xs text-zinc-500 mt-1 text-left leading-relaxed">Send links & text</p>
        </button>

        <button 
          onClick={() => onNavigate('media')}
          className="flex flex-col items-start p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-95"
        >
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg mb-3">
            <MonitorPlay className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-zinc-100">Media</h3>
          <p className="text-xs text-zinc-500 mt-1 text-left leading-relaxed">Control media</p>
        </button>

        <button 
          onClick={() => onNavigate('projector')}
          className="flex flex-col items-start p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-95"
        >
          <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg mb-3">
            <MonitorUp className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-100">Projector</h3>
          </div>
          <p className="text-xs text-zinc-500 mt-1 text-left leading-relaxed">Share live screen</p>
        </button>
      </div>

      {/* 5. Recent Activity */}
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-bold flex items-center gap-2 text-zinc-100">
            <History className="w-5 h-5 text-zinc-400" />
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
            <div className="p-6 text-center text-sm text-zinc-500">
              No recent activity
            </div>
          ) : (
            <div className="flex flex-col max-h-48 overflow-y-auto divide-y divide-zinc-800/50">
              {[...logs].reverse().slice(0, 10).map((log) => (
                <div key={log.id} className="p-3 flex items-start gap-3">
                  <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                    log.type === 'error' ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]' :
                    log.type === 'success' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' :
                    log.type === 'warning' ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]' :
                    'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{log.message}</p>
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

      {/* 6. Connection Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-4 mt-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isConnected ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
              <MonitorPlay className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-100">{computerName}</h3>
              <p className={`text-xs mt-0.5 font-medium ${isConnected ? 'text-green-400' : 'text-zinc-500'}`}>
                {isConnected ? `Connected • ${latencyMs !== undefined ? `${latencyMs} ms` : 'Measuring...'}` : 'Disconnected'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          {isConnected ? (
            <button 
              onClick={onDisconnect}
              className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold rounded-xl transition-colors active:scale-95"
            >
              Disconnect
            </button>
          ) : (
            <button 
              onClick={onReconnect}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors active:scale-95"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
