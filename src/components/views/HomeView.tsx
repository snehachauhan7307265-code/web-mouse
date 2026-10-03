import React from 'react';
import { 
  Laptop,
  Plus,
  Download,
  MousePointer, 
  Keyboard as KeyboardIcon, 
  Disc, 
  Presentation, 
  Bot, 
  Mic, 
  Cast, 
  FolderUp, 
  Sliders
} from 'lucide-react';
import { TrustedDevice, ConnectionState } from '../../types';
import { DeviceCard } from '../connection/DeviceCard';

interface HomeViewProps {
  trustedDevices: TrustedDevice[];
  activeTrustedDevice: TrustedDevice | null;
  connectionState: ConnectionState;
  onConnectDevice: (device: TrustedDevice) => void;
  onDisconnectDevice: () => void;
  onRenameDevice: (deviceId: string, newName: string) => void;
  onForgetDevice: (deviceId: string) => void;
  onOpenPairModal: () => void;
  onNavigate: (
    tab: 'home' | 'control' | 'share' | 'ai' | 'devices',
    controlMode?: 'mouse' | 'keyboard' | 'media' | 'presentation' | 'tv_remote' | 'projector' | 'custom'
  ) => void;
  onTriggerVoice: () => void;
  onOpenDiagnostics?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  trustedDevices,
  activeTrustedDevice,
  connectionState,
  onConnectDevice,
  onDisconnectDevice,
  onRenameDevice,
  onForgetDevice,
  onOpenPairModal,
  onNavigate,
  onTriggerVoice,
  onOpenDiagnostics,
}) => {
  const isConnected = connectionState === 'CONNECTED';

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 animate-in fade-in duration-200">
      {/* Brand Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              WEBMOUSE
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px]">
              V1 STABLE
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Universal Windows PC Touchpad &amp; Keyboard
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenDiagnostics && (
            <button
              onClick={onOpenDiagnostics}
              className="py-2 px-3 rounded-xl bg-zinc-850 hover:bg-zinc-800 active:scale-[0.98] text-zinc-300 hover:text-white border border-zinc-700 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
              title="Run Connection Diagnostics and Real Input Tests"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Diagnostics</span>
            </button>
          )}

          <button
            onClick={onOpenPairModal}
            className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>[ + Pair Windows PC ]</span>
          </button>
        </div>
      </div>

      {/* MY DEVICES SECTION (NEW ZERO-BASED TRUSTED DEVICE CARDS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Laptop className="w-3.5 h-3.5 text-indigo-400" />
            <span>My Devices</span>
          </h3>
          <span className="text-[11px] text-zinc-500 font-medium">
            {trustedDevices.length} {trustedDevices.length === 1 ? 'PC' : 'PCs'} Saved
          </span>
        </div>

        {trustedDevices.length === 0 ? (
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-dashed border-zinc-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <Laptop className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">No Trusted Windows PC</h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                Run WebMouse Helper on your PC, then scan the Pair QR code to connect.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
              <button
                onClick={onOpenPairModal}
                className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>[ + Pair Windows PC ]</span>
              </button>

              <a
                href="/WebMouse-Helper-Windows.zip"
                download="WebMouse-Helper-Windows.zip"
                className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Download Windows Helper (.zip)</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {trustedDevices.map((device) => (
              <DeviceCard
                key={device.deviceId}
                device={device}
                activeDeviceId={activeTrustedDevice?.deviceId || null}
                connectionState={connectionState}
                onConnect={onConnectDevice}
                onDisconnect={onDisconnectDevice}
                onRename={onRenameDevice}
                onForget={onForgetDevice}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions (Section 5) */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            id="quick-action-mouse"
            onClick={() => onNavigate('control', 'mouse')}
            className={`p-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border transition-all active:scale-[0.98] text-left group flex flex-col justify-between h-28 relative overflow-hidden ${
              isConnected ? 'border-emerald-500/40 shadow-sm shadow-emerald-500/10' : 'border-zinc-800 hover:border-indigo-500/40'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 w-fit group-hover:bg-indigo-500/20">
                <MousePointer className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>🟢 Active</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
                    <span>Touchpad</span>
                  </span>
                )}
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Mouse</span>
              <span className="text-[10px] text-zinc-500">Touchpad &amp; Click</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('control', 'keyboard')}
            className="p-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 transition-all active:scale-[0.98] text-left group flex flex-col justify-between h-28"
          >
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 w-fit group-hover:bg-indigo-500/20">
              <KeyboardIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Keyboard</span>
              <span className="text-[10px] text-zinc-500">Typing &amp; Keys</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('control', 'media')}
            className="p-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 transition-all active:scale-[0.98] text-left group flex flex-col justify-between h-28"
          >
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 w-fit group-hover:bg-emerald-500/20">
              <Disc className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Media</span>
              <span className="text-[10px] text-zinc-500">Playback &amp; Vol</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('control', 'presentation')}
            className="p-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 transition-all active:scale-[0.98] text-left group flex flex-col justify-between h-28"
          >
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 w-fit group-hover:bg-purple-500/20">
              <Presentation className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Present</span>
              <span className="text-[10px] text-zinc-500">Slide Clicker</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('control', 'custom')}
            className="p-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 transition-all active:scale-[0.98] text-left group flex flex-col justify-between h-28"
          >
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 w-fit group-hover:bg-amber-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Custom Keys</span>
              <span className="text-[10px] text-zinc-500">Shortcuts &amp; Buttons</span>
            </div>
          </button>
        </div>
      </div>

      {/* Smart Controls (Section 5) */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
          Smart Controls
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('ai')}
            className="p-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 transition-all active:scale-[0.98] text-left group flex flex-col justify-between h-28"
          >
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 w-fit group-hover:bg-rose-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">AI</span>
              <span className="text-[10px] text-zinc-500">Natural Language</span>
            </div>
          </button>

          <button
            onClick={onTriggerVoice}
            className="p-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 transition-all active:scale-[0.98] text-left group flex flex-col justify-between h-28"
          >
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 w-fit group-hover:bg-rose-500/20">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Voice</span>
              <span className="text-[10px] text-zinc-500">Hindi / English</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('control', 'projector')}
            className="p-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 transition-all active:scale-[0.98] text-left group flex flex-col justify-between h-28"
          >
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 w-fit group-hover:bg-blue-500/20">
              <Cast className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Project</span>
              <span className="text-[10px] text-zinc-500">Screen Mirror</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('share')}
            className="p-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 transition-all active:scale-[0.98] text-left group flex flex-col justify-between h-28"
          >
            <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 w-fit group-hover:bg-cyan-500/20">
              <FolderUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Share</span>
              <span className="text-[10px] text-zinc-500">File &amp; Clipboard</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
