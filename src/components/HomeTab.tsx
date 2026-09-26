import React, { useState } from 'react';
import { 
  MousePointer2, 
  Keyboard as KeyboardIcon, 
  FolderUp, 
  MonitorPlay, 
  History, 
  Trash2, 
  Scan, 
  RefreshCw, 
  AlertTriangle, 
  Camera, 
  QrCode, 
  Tv, 
  VolumeX, 
  Layers, 
  Monitor, 
  ChevronDown, 
  ChevronUp,
  Laptop, 
  Tablet,
  Cast,
  Mic,
  MessageSquare,
  Sparkles,
  Wifi,
  MoreHorizontal
} from 'lucide-react';
import { ConnectionStatus as ConnectionStatusType, ConnectedDeviceInfo, LogEntry, ComputerProfile, QuickActionId, Device, DeviceType, DeviceCapability } from '../types';
import { getDeviceTypeLabel, getDeviceTypeColor } from '../utils/profiles';
import { ConnectionStatus } from './ConnectionStatus';

interface HomeTabProps {
  status: ConnectionStatusType;
  deviceInfo: ConnectedDeviceInfo | null;
  pairedDevice: ConnectedDeviceInfo | null;
  latencyMs?: number;
  logs: LogEntry[];
  profiles: ComputerProfile[];
  devices?: Device[];
  activeProfileId?: string;
  activeDevice?: Device | null;
  onNavigate: (tab: 'home' | 'mouse' | 'keyboard' | 'share' | 'media' | 'custom' | 'settings' | 'tv_remote' | 'projector' | 'ai') => void;
  onClearLogs: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onOpenConnectionModal?: (view?: 'normal' | 'scanner' | 'qr_host' | 'manual_pin' | 'download_helper') => void;
  onForgetDevice?: () => void;
  onOpenProfilesModal: () => void;
  onOpenScreenshot: () => void;
  onQuickAction: (action: QuickActionId) => void;
  onSwitchToReceiverMode?: () => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  status,
  deviceInfo,
  pairedDevice,
  latencyMs,
  logs,
  profiles,
  devices,
  activeProfileId,
  activeDevice,
  onNavigate,
  onClearLogs,
  onReconnect,
  onDisconnect,
  onOpenConnectionModal,
  onForgetDevice,
  onOpenProfilesModal,
  onOpenScreenshot,
  onQuickAction,
  onSwitchToReceiverMode,
}) => {
  const [showDeviceDetails, setShowDeviceDetails] = useState(false);
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || status === 'reconnecting';
  
  const computerName = activeDevice?.name || deviceInfo?.computerName || pairedDevice?.computerName || 'My Laptop';
  const deviceType: DeviceType = activeDevice?.type || deviceInfo?.deviceType || 'windows';
  const typeLabel = getDeviceTypeLabel(deviceType);

  const capabilities: DeviceCapability[] = activeDevice?.capabilities || deviceInfo?.capabilities || [
    'mouse', 'keyboard', 'media', 'presentation', 'file_transfer', 'quick_share', 'custom_controls'
  ];

  const formatCapabilityName = (cap: DeviceCapability) => {
    switch (cap) {
      case 'tv_remote': return 'TV Remote';
      case 'screen_receiver': return 'Screen Receiver';
      case 'presentation': return 'Presentation';
      case 'mouse': return 'Touchpad';
      case 'keyboard': return 'Keyboard';
      case 'media': return 'Media Controller';
      case 'file_transfer': return 'Quick Share';
      case 'custom_controls': return 'Custom Deck';
      default: return cap.replace(/_/g, ' ');
    }
  };

  const renderTypeIcon = (type: DeviceType, className = "w-4 h-4") => {
    switch (type) {
      case 'android_tv':
        return <Tv className={className} />;
      case 'smart_board':
        return <Monitor className={className} />;
      case 'tablet':
        return <Tablet className={className} />;
      case 'windows':
      default:
        return <Laptop className={className} />;
    }
  };

  const primaryControlTab = deviceType === 'android_tv' ? 'tv_remote' : 'mouse';

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto space-y-5 pb-12 bg-zinc-950 text-white select-none max-w-4xl mx-auto w-full">
      
      {/* 1. DEVICE CARD (Section 6: Clean, minimal, uncluttered) */}
      {isConnected ? (
        <div className="w-full p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xl space-y-4">
          {/* Card Top: Device Info & Status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0 mt-0.5">
                {renderTypeIcon(deviceType, "w-5 h-5")}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-tight leading-tight">{computerName}</h2>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 font-medium">{typeLabel}</p>
              </div>
            </div>

            {/* Single Reusable Connection Status (Section 5) */}
            <div className="shrink-0">
              <ConnectionStatus status={status} latencyMs={latencyMs} size="sm" />
            </div>
          </div>

          {/* Capabilities: Clean unboxed text with typographic separators (Section 6 & Frontend Design Skill) */}
          <div className="text-xs text-zinc-400 flex items-center gap-1.5 flex-wrap">
            <span className="text-zinc-500 font-medium">Capabilities:</span>
            {capabilities.slice(0, 4).map((cap, idx) => (
              <React.Fragment key={cap}>
                <span className="text-zinc-300">{formatCapabilityName(cap)}</span>
                {idx < Math.min(capabilities.length, 4) - 1 && <span className="text-zinc-600">·</span>}
              </React.Fragment>
            ))}
            {capabilities.length > 4 && (
              <span className="text-zinc-500 text-[11px]">+{capabilities.length - 4} more</span>
            )}
          </div>

          {/* Expandable Technical Details */}
          {showDeviceDetails && (
            <div className="pt-3 border-t border-zinc-800/80 text-xs text-zinc-400 space-y-1.5 font-mono animate-in fade-in duration-150">
              <div className="flex justify-between">
                <span className="text-zinc-500 font-sans">Network Address:</span>
                <span className="text-zinc-200">
                  {deviceInfo?.ip || activeDevice?.host || pairedDevice?.ip || '192.168.x.x'}:{deviceInfo?.port || activeDevice?.port || pairedDevice?.port || 8765}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-sans">Active Profile ID:</span>
                <span className="text-zinc-400 truncate max-w-[200px]">{activeDevice?.id || activeProfileId || 'default'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-sans">Security Transport:</span>
                <span className="text-emerald-400 font-sans">Encrypted Local WebSocket</span>
              </div>
            </div>
          )}

          {/* Actions Bar: [ Control ] [ Project ] [ More ] */}
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
            <button
              onClick={() => onNavigate(primaryControlTab)}
              className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
            >
              {deviceType === 'android_tv' ? <Tv className="w-4 h-4" /> : <MousePointer2 className="w-4 h-4" />}
              <span>Control</span>
            </button>

            <button
              onClick={() => onNavigate('projector')}
              className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 active:scale-[0.98] text-zinc-100 border border-zinc-700/80 text-xs font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Cast className="w-4 h-4 text-indigo-400" />
              <span>Project</span>
            </button>

            <button
              onClick={() => setShowDeviceDetails(!showDeviceDetails)}
              className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-[0.98] text-zinc-400 hover:text-zinc-200 border border-zinc-800 text-xs font-medium transition-all flex items-center gap-1"
              title="Expand Details"
            >
              <span className="hidden sm:inline">Details</span>
              {showDeviceDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <button
              onClick={onDisconnect}
              className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 text-xs font-medium transition-all"
              title="Disconnect"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : isConnecting ? (
        <div className="w-full p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
            <div>
              <h3 className="text-sm font-bold text-white">{computerName}</h3>
              <p className="text-xs text-amber-300/80">Connecting over local network...</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onReconnect}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-all active:scale-95"
            >
              Retry
            </button>
            {onForgetDevice && (
              <button
                onClick={onForgetDevice}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 text-xs transition-colors"
              >
                Forget
              </button>
            )}
          </div>
        </div>
      ) : status === 'auth_failed' ? (
        <div className="w-full p-5 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-3 shadow-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-rose-300">Authentication Failed</h3>
              <p className="text-xs text-zinc-300 mt-0.5">
                {deviceInfo?.errorMessage || 'Invalid 6-digit PIN. Verify the code on your PC screen.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => onOpenConnectionModal?.('scanner')}
              className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <Scan className="w-4 h-4" />
              <span>Scan QR Code</span>
            </button>
            <button
              onClick={onReconnect}
              className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        /* Empty State: Not Connected (Section 19: Clean, informative, single primary action) */
        <div className="w-full p-6 sm:p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Wifi className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Connect to a Device</h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
              Connect your phone to your PC, Android TV, or Smart Board on the same Wi-Fi network.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 max-w-md mx-auto pt-1">
            <button
              id="btn-scan-qr-phone"
              onClick={() => onOpenConnectionModal?.('scanner')}
              className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
            >
              <Scan className="w-4 h-4" />
              <span>Scan QR Code</span>
            </button>

            <button
              id="btn-show-qr-laptop"
              onClick={() => onOpenConnectionModal?.('normal')}
              className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] border border-zinc-700/80 text-zinc-300 font-medium text-xs flex items-center justify-center gap-2 transition-all"
            >
              <QrCode className="w-4 h-4 text-indigo-400" />
              <span>Manual PIN / Helper</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. QUICK ACTIONS (Section 7: Max 4–6 frequently used actions in clean responsive grid) */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {deviceType === 'android_tv' || deviceType === 'smart_board' ? (
            <button
              onClick={() => onNavigate('tv_remote')}
              className="p-3.5 bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] text-left group"
            >
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20">
                <Tv className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-zinc-200 block">TV Remote</span>
                <span className="text-[10px] text-zinc-500">D-Pad & Menu</span>
              </div>
            </button>
          ) : (
            <button
              onClick={onOpenScreenshot}
              className="p-3.5 bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] text-left group"
            >
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-zinc-200 block">Screenshot</span>
                <span className="text-[10px] text-zinc-500">Capture display</span>
              </div>
            </button>
          )}

          <button
            onClick={() => onQuickAction('mute')}
            className="p-3.5 bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] text-left group"
          >
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20">
              <VolumeX className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Mute Audio</span>
              <span className="text-[10px] text-zinc-500">Toggle sound</span>
            </div>
          </button>

          <button
            onClick={() => onQuickAction('alttab')}
            className="p-3.5 bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] text-left group"
          >
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Alt + Tab</span>
              <span className="text-[10px] text-zinc-500">Switch apps</span>
            </div>
          </button>

          <button
            onClick={() => onQuickAction('desktop')}
            className="p-3.5 bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] text-left group"
          >
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20">
              <Monitor className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Desktop</span>
              <span className="text-[10px] text-zinc-500">Show desktop</span>
            </div>
          </button>
        </div>
      </div>

      {/* 3. AI & VOICE CONTROL ENTRY POINT (Section 14: Minimal, elegant quick launcher) */}
      <div className="rounded-2xl p-4 bg-zinc-900/80 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
            <Mic className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-white">WebMouse AI & Voice</h4>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-300 font-semibold border border-rose-500/20">
                Phase 4
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Ask or speak commands in English or Hindi to control devices
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-voice-quick-speak"
            onClick={() => onNavigate('ai')}
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 active:scale-95 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20 transition-all"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Speak</span>
          </button>

          <button
            id="btn-voice-quick-type"
            onClick={() => onNavigate('ai')}
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 active:scale-95 text-zinc-200 border border-zinc-700/80 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
            <span>Type</span>
          </button>
        </div>
      </div>

      {/* 4. UNIVERSAL REMOTE MODES (Section 8: Dedicated mode switching grid) */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
          Universal Remote Modes
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {/* Trackpad */}
          <button 
            onClick={() => onNavigate('mouse')}
            className="flex flex-col items-start p-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 transition-all active:scale-[0.98] group text-left"
          >
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 mb-2.5">
              <MousePointer2 className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-zinc-100 text-xs">Touchpad & Mouse</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">Smooth cursor & gestures</p>
          </button>

          {/* Keyboard */}
          <button 
            onClick={() => onNavigate('keyboard')}
            className="flex flex-col items-start p-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 transition-all active:scale-[0.98] group text-left"
          >
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 mb-2.5">
              <KeyboardIcon className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-zinc-100 text-xs">Keyboard</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">Shortcuts & typing</p>
          </button>

          {/* Media Controller */}
          <button 
            onClick={() => onNavigate('media')}
            className="flex flex-col items-start p-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 transition-all active:scale-[0.98] group text-left"
          >
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 mb-2.5">
              <MonitorPlay className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-zinc-100 text-xs">Media Controller</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">Volume & playback</p>
          </button>

          {/* Presentation Clicker */}
          <button 
            onClick={() => onNavigate('media')}
            className="flex flex-col items-start p-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 transition-all active:scale-[0.98] group text-left"
          >
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 mb-2.5">
              <Monitor className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-zinc-100 text-xs">Presentation</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">Slide deck clicker</p>
          </button>

          {/* TV Remote */}
          <button 
            onClick={() => onNavigate('tv_remote')}
            className="flex flex-col items-start p-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 transition-all active:scale-[0.98] group text-left"
          >
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 mb-2.5">
              <Tv className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-zinc-100 text-xs">TV Remote</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">Smart TV & D-Pad</p>
          </button>

          {/* Screen Projector */}
          <button 
            onClick={() => onNavigate('projector')}
            className="flex flex-col items-start p-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 active:bg-zinc-950 border border-zinc-800 transition-all active:scale-[0.98] group text-left"
          >
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 mb-2.5">
              <Cast className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-zinc-100 text-xs">Screen Projector</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">WebRTC screen share</p>
          </button>
        </div>
      </div>

      {/* 5. RECENT ACTIVITY (Collapsible & clean) */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-zinc-500" />
            <span>Recent Activity</span>
          </h3>
          {logs.length > 0 && (
            <button 
              onClick={onClearLogs}
              className="text-[11px] font-medium text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
        
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
          {logs.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-500">
              No recent activity
            </div>
          ) : (
            <div className="flex flex-col max-h-32 overflow-y-auto divide-y divide-zinc-800/50">
              {[...logs].reverse().slice(0, 5).map((log) => (
                <div key={log.id} className="p-2.5 px-3 flex items-start gap-2.5">
                  <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                    log.type === 'err' ? 'bg-rose-500' :
                    log.type === 'rx' ? 'bg-emerald-500' :
                    log.type === 'tx' ? 'bg-indigo-400' :
                    'bg-zinc-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-200 truncate">{log.content}</p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{log.time}</p>
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
