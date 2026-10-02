import React, { useState, useEffect } from 'react';
import { 
  Laptop, 
  Tv, 
  Monitor, 
  Tablet, 
  MousePointer, 
  Keyboard as KeyboardIcon, 
  Disc, 
  Presentation, 
  Bot, 
  Mic, 
  Cast, 
  FolderUp, 
  ChevronRight,
  Wifi,
  Sparkles,
  Sliders,
  ArrowRight,
  QrCode,
  Scan,
  Download,
  AlertTriangle,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { Device, DeviceType, ConnectionStatus as ConnectionStatusType, ConnectedDeviceInfo, ConnectionConfig } from '../../types';
import { ConnectionStatus } from '../ConnectionStatus';

interface HomeViewProps {
  status: ConnectionStatusType;
  deviceInfo: ConnectedDeviceInfo | null;
  activeDevice: Device | null;
  latencyMs?: number;
  config?: ConnectionConfig;
  onSaveAndConnect?: (config: ConnectionConfig) => void;
  onNavigate: (tab: 'home' | 'control' | 'share' | 'ai' | 'devices', controlMode?: 'mouse' | 'keyboard' | 'media' | 'presentation' | 'tv_remote' | 'projector' | 'custom') => void;
  onOpenDeviceSelector: () => void;
  onOpenAddDevice: () => void;
  onOpenConnectionModal?: () => void;
  onConnect?: () => void;
  onTriggerVoice: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  status,
  deviceInfo,
  activeDevice,
  latencyMs,
  config,
  onSaveAndConnect,
  onNavigate,
  onOpenDeviceSelector,
  onOpenAddDevice,
  onOpenConnectionModal,
  onConnect,
  onTriggerVoice,
}) => {
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || status === 'reconnecting';
  const deviceName = activeDevice?.name || deviceInfo?.computerName || 'My Laptop';
  const deviceType: DeviceType = activeDevice?.type || deviceInfo?.deviceType || 'windows';

  const [directIp, setDirectIp] = useState(config?.host || '');
  const [directPort, setDirectPort] = useState(config?.port ? config.port.toString() : '8765');
  const [directPin, setDirectPin] = useState(config?.code || '');

  useEffect(() => {
    if (config?.host) setDirectIp(config.host);
    if (config?.port) setDirectPort(config.port.toString());
    if (config?.code) setDirectPin(config.code);
  }, [config?.host, config?.port, config?.code]);

  const handleDirectSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanHost = directIp.trim();
    const cleanPort = parseInt(directPort, 10) || 8765;
    const cleanCode = directPin.trim();

    if (!cleanHost) return;

    if (onSaveAndConnect) {
      onSaveAndConnect({
        host: cleanHost,
        port: cleanPort,
        code: cleanCode,
        token: config?.token,
        lastComputerName: config?.lastComputerName || 'Windows PC',
        autoReconnect: true,
      });
    } else if (onConnect) {
      onConnect();
    }
  };

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'android_tv':
        return <Tv className="w-6 h-6 text-amber-400" />;
      case 'smart_board':
        return <Monitor className="w-6 h-6 text-purple-400" />;
      case 'tablet':
        return <Tablet className="w-6 h-6 text-cyan-400" />;
      case 'windows':
      default:
        return <Laptop className="w-6 h-6 text-indigo-400" />;
    }
  };

  const getDeviceSubtitle = (type: DeviceType) => {
    switch (type) {
      case 'android_tv': return 'Android TV';
      case 'smart_board': return 'Android Smart Board';
      case 'tablet': return 'Android Tablet';
      case 'windows':
      default:
        return 'Windows PC';
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 animate-in fade-in duration-200">
      {/* Brand Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          WEBMOUSE V2
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
          Universal Device Control
        </p>
      </div>

      {/* Current Device Card (Section 5) */}
      <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-5 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/60 shrink-0">
              {getDeviceIcon(deviceType)}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight leading-tight">
                {deviceName}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 font-medium">
                {getDeviceSubtitle(deviceType)}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <ConnectionStatus status={status} latencyMs={latencyMs} size="sm" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/80">
          {isConnected ? (
            <>
              <button
                onClick={() => onNavigate('control', deviceType === 'android_tv' ? 'tv_remote' : 'mouse')}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Control</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenDeviceSelector}
                className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 active:scale-[0.98] text-zinc-200 border border-zinc-700/80 text-xs font-semibold transition-all flex items-center justify-center gap-2"
              >
                <span>Change Device</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col w-full gap-3 pt-1">
              {/* Direct IP and PIN form */}
              <form onSubmit={handleDirectSubmit} className="space-y-3 bg-zinc-950/70 p-3.5 sm:p-4 rounded-xl border border-zinc-800/80">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-semibold text-zinc-300 flex items-center justify-between">
                      <span>Local IP Address (Laptop CMD me dikhega)</span>
                      <span className="text-[10px] text-emerald-400 font-mono">Wi-Fi IP</span>
                    </label>
                    <input
                      id="home-input-ip"
                      type="text"
                      value={directIp}
                      onChange={(e) => setDirectIp(e.target.value)}
                      placeholder="Enter the IP shown in the CMD window (e.g., 192.168.1.15)"
                      className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                      required
                    />
                    <p className="text-[10px] text-zinc-400">
                      Enter the IP shown in the CMD window (e.g., 192.168.1.15)
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-zinc-300 flex items-center justify-between">
                      <span>Pairing Code</span>
                      <span className="text-[10px] text-indigo-400 font-mono">6 Digits</span>
                    </label>
                    <input
                      id="home-input-pin"
                      type="text"
                      maxLength={6}
                      value={directPin}
                      onChange={(e) => setDirectPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter the 6-digit PIN (e.g., 483921)"
                      className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                      required
                    />
                    <p className="text-[10px] text-zinc-400">
                      Enter the 6-digit PIN (e.g., 483921)
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    id="btn-home-direct-connect"
                    type="submit"
                    disabled={isConnecting || !directIp.trim() || !directPin.trim()}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-[0.98] text-white text-xs font-bold shadow-md shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting to PC...</span>
                      </>
                    ) : (
                      <>
                        <span>⚡ Connect to PC (IP &amp; PIN)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>

                  <button
                    id="btn-home-scan-qr"
                    type="button"
                    onClick={onOpenAddDevice}
                    className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5"
                    title="Scan QR Code from Laptop Screen"
                  >
                    <Scan className="w-3.5 h-3.5" />
                    <span>📷 Scan CMD QR Code</span>
                  </button>
                </div>
              </form>

              {/* HTTPS Mixed Content Help Notice with Direct Link */}
              {typeof window !== 'undefined' && window.location.protocol === 'https:' && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200/90 space-y-1.5">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Phone se direct control ke liye phone browser me ye link kholein:</span>
                  </div>
                  <p className="text-[10px] text-zinc-300 leading-relaxed">
                    Browser security HTTPS se local PC WebSocket block karti hai. Phone me direct local server kholein:
                  </p>
                  <a
                    href={`http://${directIp ? directIp.replace(/^(https?:\/\/|wss?:\/\/)/, '').split(':')[0] : '192.168.1.15'}:${directPort || '8765'}/?pair=${directPin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono font-bold text-emerald-400 bg-black/60 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 hover:bg-black transition-colors break-all"
                  >
                    <span>http://{directIp ? directIp.replace(/^(https?:\/\/|wss?:\/\/)/, '').split(':')[0] : '192.168.1.15'}:{directPort || '8765'}/?pair={directPin}</span>
                    <ExternalLink className="w-3 h-3 text-emerald-400 shrink-0" />
                  </a>
                </div>
              )}

              {/* Quick links to download run_webmouse.bat */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400 px-1">
                <span>Laptop me CMD window kholne ke liye:</span>
                <a
                  href="/run_webmouse.bat"
                  download="run_webmouse.bat"
                  className="inline-flex items-center gap-1 font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 px-2 py-1 rounded-lg"
                >
                  <Download className="w-3 h-3" />
                  <span>Download run_webmouse.bat</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions (Section 5) */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            id="quick-action-mouse"
            onClick={() => {
              if (!isConnected && onOpenConnectionModal) {
                onOpenConnectionModal();
              } else {
                onNavigate('control', 'mouse');
              }
            }}
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
                  <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>Connect</span>
                  </span>
                )}
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Mouse</span>
              <span className="text-[10px] text-zinc-500">Touchpad & Click</span>
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
              <span className="text-[10px] text-zinc-500">Typing & Keys</span>
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
              <span className="text-[10px] text-zinc-500">Playback & Vol</span>
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
              <span className="text-[10px] text-zinc-500">Shortcuts & Buttons</span>
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
              <span className="text-[10px] text-zinc-500">File & Clipboard</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
