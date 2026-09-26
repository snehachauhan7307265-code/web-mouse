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
  KeyRound, 
  Tv, 
  Command, 
  Link2, 
  VolumeX, 
  Layers, 
  Monitor, 
  ChevronDown, 
  Laptop, 
  Tablet,
  CheckCircle2, 
  Wifi, 
  Sparkles, 
  SlidersHorizontal,
  Plus,
  Cast,
  Bot,
  Mic
} from 'lucide-react';
import { ConnectionStatus, ConnectedDeviceInfo, LogEntry, ComputerProfile, QuickActionId, Device, DeviceType, DeviceCapability } from '../types';
import { getLatencyQuality, getDeviceTypeLabel, getDeviceTypeColor } from '../utils/profiles';
import { triggerHaptic } from '../services/websocketService';

interface HomeTabProps {
  status: ConnectionStatus;
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
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || status === 'reconnecting';
  const computerName = deviceInfo?.computerName || activeDevice?.name || pairedDevice?.computerName || 'My Laptop';
  const latencyQuality = getLatencyQuality(latencyMs);

  const deviceType: DeviceType = activeDevice?.type || deviceInfo?.deviceType || 'windows';
  const typeColor = getDeviceTypeColor(deviceType);
  const typeLabel = getDeviceTypeLabel(deviceType);

  const capabilities: DeviceCapability[] = activeDevice?.capabilities || deviceInfo?.capabilities || [
    'mouse', 'keyboard', 'media', 'presentation', 'file_transfer', 'quick_share', 'custom_controls'
  ];

  const hasCap = (cap: DeviceCapability) => capabilities.includes(cap);

  const renderTypeIcon = (type: DeviceType, className = "w-3.5 h-3.5") => {
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

  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4 pb-8 bg-zinc-950 text-white select-none">
      
      {/* 1. Status & Active Universal Device Card */}
      {isConnected ? (
        <div className="w-full p-4 rounded-3xl bg-gradient-to-b from-emerald-950/40 via-zinc-900/60 to-zinc-950 border border-emerald-500/30 shadow-xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            {/* Status indicator with real pulse */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>🟢 Connected</span>
            </div>

            {/* Devices Switcher Button */}
            <button
              onClick={onOpenProfilesModal}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 text-xs font-medium border border-zinc-700/60 transition-colors"
              title="Switch Device"
            >
              {renderTypeIcon(deviceType, 'w-3.5 h-3.5 text-indigo-400')}
              <span>Devices ({devices ? devices.length : profiles.length})</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">{computerName}</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${typeColor.badgeBg} ${typeColor.textColor}`}>
                  {typeLabel}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                {deviceInfo?.ip || activeDevice?.host || pairedDevice?.ip}:{deviceInfo?.port || activeDevice?.port || pairedDevice?.port || 8765}
              </p>
            </div>

            {/* Real Latency Badge */}
            <div className="text-right">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-bold border ${latencyQuality.badgeBg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${latencyQuality.dotColor}`} />
                <span>{latencyMs !== undefined ? `${latencyMs} ms` : 'Active'}</span>
                <span className="text-[10px] uppercase font-sans opacity-80">({latencyQuality.label})</span>
              </span>
            </div>
          </div>

          {/* Capability Badges List */}
          <div className="pt-1 flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-zinc-500 font-semibold mr-1">Capabilities:</span>
            {capabilities.slice(0, 5).map((cap) => (
              <span
                key={cap}
                className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-800/90 text-zinc-300 border border-zinc-700/60 font-medium"
              >
                {cap.replace('_', ' ')}
              </span>
            ))}
            {capabilities.length > 5 && (
              <span className="text-[9px] text-zinc-500">
                +{capabilities.length - 5} more
              </span>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs">
            <span className="text-zinc-500 text-[11px]">Wi-Fi Universal Link Active</span>
            <button
              onClick={onDisconnect}
              className="px-3 py-1 rounded-xl bg-zinc-900 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 transition-colors text-xs font-medium"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : isConnecting ? (
        <div className="w-full p-4 rounded-3xl bg-amber-950/30 border border-amber-500/30 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
            <div>
              <span className="text-xs font-semibold text-amber-400">🟡 Reconnecting...</span>
              <h3 className="text-sm font-bold text-white">{computerName}</h3>
              <p className="text-[10px] text-zinc-400 font-mono">Attempting exponential backoff handshake</p>
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
                title="Forget this device"
              >
                Forget
              </button>
            )}
          </div>
        </div>
      ) : status === 'auth_failed' ? (
        <div className="w-full p-4 rounded-3xl bg-rose-950/30 border border-rose-500/40 space-y-3 shadow-xl">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-rose-300">Authentication Rejected</h3>
              <p className="text-xs text-zinc-300 mt-0.5">
                {deviceInfo?.errorMessage || 'Invalid 6-digit PIN or expired pairing token. Scan a new QR code on your device.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => onOpenConnectionModal?.('scanner')}
              className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
            >
              <Scan className="w-3.5 h-3.5 text-emerald-300" />
              <span>Scan Fresh QR</span>
            </button>
            <button
              onClick={onReconnect}
              className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        /* Disconnected State Card */
        <div className="w-full p-5 rounded-3xl bg-zinc-900/90 border border-zinc-800 flex flex-col items-center text-center space-y-3 shadow-xl">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20 shadow-inner">
            <KeyRound className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700/60 text-zinc-400 text-[11px] mb-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>🔴 Disconnected</span>
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">Connect to PC, Android TV or Board</h2>
            <p className="text-xs text-zinc-400 mt-0.5 max-w-xs">
              Make sure your phone and target device are on the same Wi-Fi.
            </p>
          </div>

          <div className="w-full max-w-xs space-y-2 pt-1">
            <button
              id="btn-scan-qr-phone"
              onClick={() => onOpenConnectionModal?.('scanner')}
              className="w-full py-2.5 px-4 rounded-2xl bg-emerald-600/90 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
            >
              <Camera className="w-4 h-4 text-emerald-100" />
              <span>Scan QR Code (Direct Connect)</span>
            </button>

            <button
              id="btn-show-qr-laptop"
              onClick={() => onOpenConnectionModal?.('qr_host')}
              className="w-full py-2 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] border border-zinc-700/80 text-zinc-300 font-medium text-xs flex items-center justify-center gap-2 transition-all"
            >
              <QrCode className="w-4 h-4 text-indigo-400" />
              <span>Show QR & Download Helper</span>
            </button>

            {onSwitchToReceiverMode && (
              <button
                id="btn-open-receiver-mode"
                onClick={onSwitchToReceiverMode}
                className="w-full py-2 px-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 active:scale-[0.98] border border-amber-500/30 text-amber-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Tv className="w-4 h-4 text-amber-400" />
                <span>Switch to Android TV / Board Receiver</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Configurable Quick Actions Bar */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-2.5 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Quick Actions
          </span>
          <span className="text-[10px] text-zinc-500">Instant Commands</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {deviceType === 'android_tv' || deviceType === 'smart_board' ? (
            <button
              onClick={() => onNavigate('tv_remote')}
              className="py-2 px-1 bg-zinc-800/90 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-sm border border-zinc-700/60"
              title="Open TV Remote"
            >
              <Tv className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-medium">TV Remote</span>
            </button>
          ) : (
            <button
              onClick={() => onOpenScreenshot()}
              className="py-2 px-1 bg-zinc-800/90 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-sm border border-zinc-700/60"
              title="Take Screenshot"
            >
              <Camera className="w-4 h-4 text-rose-400" />
              <span className="text-[10px] font-medium">Screenshot</span>
            </button>
          )}

          <button
            onClick={() => onQuickAction('mute')}
            className="py-2 px-1 bg-zinc-800/90 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-sm border border-zinc-700/60"
            title="Mute Audio"
          >
            <VolumeX className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-medium">Mute</span>
          </button>

          <button
            onClick={() => onQuickAction('alttab')}
            className="py-2 px-1 bg-zinc-800/90 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-sm border border-zinc-700/60"
            title="Alt + Tab"
          >
            <Layers className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-medium">Alt + Tab</span>
          </button>

          <button
            onClick={() => onQuickAction('desktop')}
            className="py-2 px-1 bg-zinc-800/90 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-sm border border-zinc-700/60"
            title="Show Desktop"
          >
            <Monitor className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-medium">Desktop</span>
          </button>
        </div>
      </div>

      {/* 3. Universal Control Modes Hub */}
      <div className="space-y-2.5">
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block px-1">
          Universal Remote Modes
        </span>

        {/* Primary Hero Launcher: Touchpad Mouse or TV Remote based on device */}
        {deviceType === 'android_tv' ? (
          <button 
            onClick={() => onNavigate('tv_remote')}
            className="w-full relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-600/30 to-orange-600/10 border border-amber-500/30 p-5 flex items-center justify-between group transition-all active:scale-[0.98] shadow-lg"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-3.5 bg-amber-500/20 text-amber-400 rounded-2xl group-hover:scale-105 transition-transform shadow-lg shadow-amber-500/20">
                <Tv className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="text-base font-bold text-white">Android TV Remote</h3>
                <p className="text-xs text-amber-200/70">D-Pad navigation, Home, Back & Media</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl bg-amber-600 text-white text-xs font-semibold shadow-md">
              Launch
            </span>
          </button>
        ) : (
          <button 
            onClick={() => onNavigate('mouse')}
            className="w-full relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600/30 to-purple-600/10 border border-indigo-500/30 p-5 flex items-center justify-between group transition-all active:scale-[0.98] shadow-lg"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-3.5 bg-indigo-500/20 text-indigo-400 rounded-2xl group-hover:scale-105 transition-transform shadow-lg shadow-indigo-500/20">
                <MousePointer2 className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="text-base font-bold text-white">Wireless Touchpad</h3>
                <p className="text-xs text-indigo-200/70">Smooth cursor, gestures & clicks</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-md">
              Launch
            </span>
          </button>
        )}

        {/* Primary Screen Projector Launcher */}
        <button 
          id="btn-launch-screen-projector"
          onClick={() => onNavigate('projector')}
          className="w-full relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-zinc-900 border border-indigo-500/30 p-4 flex items-center justify-between group transition-all active:scale-[0.98] shadow-lg"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl group-hover:scale-105 transition-transform shadow-lg shadow-indigo-500/20">
              <Cast className="w-6 h-6 animate-pulse" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-white">Project My Screen</h3>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  WebRTC P2P
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">Stream display to Laptop, TV or Smart Board</p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md flex items-center gap-1">
            <Cast className="w-3.5 h-3.5" />
            Project
          </span>
        </button>

        {/* Primary Voice & AI Control Engine Launcher */}
        <button 
          id="btn-launch-ai-control"
          onClick={() => onNavigate('ai')}
          className="w-full relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-950/40 via-rose-950/20 to-zinc-900 border border-rose-500/30 p-4 flex items-center justify-between group transition-all active:scale-[0.98] shadow-lg"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-gradient-to-tr from-rose-500/20 to-purple-500/20 text-rose-400 rounded-2xl group-hover:scale-105 transition-transform shadow-lg shadow-rose-500/20">
              <Mic className="w-6 h-6 text-rose-400 animate-pulse" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-white">Voice & AI Control</h3>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                  Speech & Intent
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">Speak in Hindi or English to control PC, TV & Smart Board</p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5" />
            Voice
          </span>
        </button>

        {/* 6 Grid Remote Tools with capability-aware badges */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* TV Remote tile (available for TV, Smart Board, or all devices) */}
          <button 
            onClick={() => onNavigate('tv_remote')}
            className={`flex flex-col items-start p-3.5 rounded-2xl border transition-all active:scale-95 ${
              hasCap('tv_remote')
                ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80'
                : 'bg-zinc-900/50 border-zinc-800/50 opacity-90'
            }`}
          >
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl mb-2 flex items-center justify-between w-full">
              <Tv className="w-5 h-5" />
              {hasCap('tv_remote') && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">Active</span>
              )}
            </div>
            <h4 className="font-bold text-zinc-100 text-xs">TV Remote</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5 text-left">D-Pad & Smart TV Controls</p>
          </button>

          <button 
            onClick={() => onNavigate('keyboard')}
            className="flex flex-col items-start p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 transition-all active:scale-95"
          >
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl mb-2">
              <KeyboardIcon className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-zinc-100 text-xs">Keyboard</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5 text-left">Type text & shortcuts</p>
          </button>

          <button 
            onClick={() => onNavigate('media')}
            className="flex flex-col items-start p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 transition-all active:scale-95"
          >
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl mb-2">
              <MonitorPlay className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-zinc-100 text-xs">Media Player</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5 text-left">Volume & playback</p>
          </button>

          <button 
            onClick={() => onNavigate('media')}
            className="flex flex-col items-start p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 transition-all active:scale-95"
          >
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl mb-2">
              <Monitor className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-zinc-100 text-xs">Presentation</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5 text-left">Slides & pointer</p>
          </button>

          <button 
            onClick={() => onNavigate('share')}
            className="flex flex-col items-start p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 transition-all active:scale-95"
          >
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl mb-2">
              <FolderUp className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-zinc-100 text-xs">File Transfer</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5 text-left">Send files & photos</p>
          </button>

          <button 
            onClick={() => onNavigate('custom')}
            className="flex flex-col items-start p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 transition-all active:scale-95"
          >
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl mb-2">
              <Command className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-zinc-100 text-xs">Custom Deck</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5 text-left">Macros & key shortcuts</p>
          </button>
        </div>
      </div>

      {/* 4. Universal Devices Quick Switcher */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Paired Devices
          </span>
          <button
            onClick={onOpenProfilesModal}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
          >
            <span>Manage</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(devices && devices.length > 0 ? devices : profiles).map((d) => {
            const isCurr = d.id === activeProfileId;
            const itemType: DeviceType = (d as any).type || 'windows';
            return (
              <button
                key={d.id}
                onClick={onOpenProfilesModal}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all ${
                  isCurr && isConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : isCurr
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
                }`}
              >
                {renderTypeIcon(itemType, 'w-3 h-3')}
                <span className={`w-1.5 h-1.5 rounded-full ${isCurr && isConnected ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                <span>{d.name}</span>
              </button>
            );
          })}

          <button
            onClick={onOpenProfilesModal}
            className="px-2.5 py-1.5 rounded-xl border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs shrink-0 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* 5. Recent Activity Logs */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold flex items-center gap-1.5 text-zinc-300 uppercase tracking-wider">
            <History className="w-3.5 h-3.5 text-zinc-400" />
            <span>Recent Activity</span>
          </h3>
          {logs.length > 0 && (
            <button 
              onClick={onClearLogs}
              className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
          {logs.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-500">
              No recent activity
            </div>
          ) : (
            <div className="flex flex-col max-h-36 overflow-y-auto divide-y divide-zinc-800/50">
              {[...logs].reverse().slice(0, 6).map((log) => (
                <div key={log.id} className="p-2.5 px-3 flex items-start gap-2.5">
                  <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                    log.type === 'err' ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]' :
                    log.type === 'rx' ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' :
                    log.type === 'tx' ? 'bg-blue-500' :
                    'bg-indigo-400'
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
