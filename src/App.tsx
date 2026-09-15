/**
 * WebMouse V1 — Mobile Web App
 * Turns an Android/iPhone smartphone into a wireless mouse & keyboard for Windows.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MousePointer, Keyboard as KeyboardIcon, Scroll, Settings as SettingsIcon, AlertCircle, Wifi, Share2, MonitorPlay } from 'lucide-react';
import { Header } from './components/Header';
import { Touchpad } from './components/Touchpad';
import { KeyboardTab } from './components/KeyboardTab';
import { ShareTab } from './components/ShareTab';
import { MediaTab } from './components/MediaTab';
import { SettingsTab } from './components/SettingsTab';
import { ConnectionModal } from './components/ConnectionModal';
import { WindowsHelperModal } from './components/WindowsHelperModal';
import { AppSettings, ConnectionConfig, ConnectionStatus, ConnectedDeviceInfo, LogEntry, OutgoingMessage } from './types';
import { WebSocketClient, triggerHaptic } from './services/websocketService';

const DEFAULT_SETTINGS: AppSettings = {
  deviceName: 'WebMouse Phone',
  pointerSensitivity: 1.2,
  pointerSpeed: 1.0,
  pointerAcceleration: true,
  scrollSensitivity: 1.2,
  invertScroll: false,
  vibration: true,
  clickSound: true,
  theme: 'dark',
  clipboardSync: false,
};

// Derive initial host/port from environment variables if provided
const getInitialConnectionConfig = (): ConnectionConfig => {
  const envWsUrl = import.meta.env.VITE_WEBSOCKET_URL;
  const envHost = import.meta.env.VITE_DEFAULT_HELPER_HOST;
  const envPort = import.meta.env.VITE_DEFAULT_HELPER_PORT;

  let host = '';
  let port = 8765;

  if (envWsUrl) {
    try {
      const url = new URL(envWsUrl.startsWith('ws') ? envWsUrl : `ws://${envWsUrl}`);
      host = url.hostname;
      if (url.port) port = parseInt(url.port, 10);
    } catch {
      host = envWsUrl;
    }
  } else if (envHost) {
    host = envHost;
  }

  if (envPort) {
    const parsed = parseInt(envPort, 10);
    if (!isNaN(parsed)) port = parsed;
  }

  return {
    host,
    port,
    code: '',
    autoReconnect: true,
  };
};

const DEFAULT_CONFIG: ConnectionConfig = getInitialConnectionConfig();

export default function App() {
  // Load initial settings & config from localStorage
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('webmouse_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [config, setConfig] = useState<ConnectionConfig>(() => {
    try {
      const saved = localStorage.getItem('webmouse_config');
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  // Tab navigation: 'mouse' | 'keyboard' | 'share' | 'media' | 'settings'
  const [activeTab, setActiveTab] = useState<'mouse' | 'keyboard' | 'share' | 'media' | 'settings'>('mouse');

  const [pairedDevice, setPairedDevice] = useState<ConnectedDeviceInfo | null>(() => {
    try {
      const saved = localStorage.getItem('webmouse_paired_device');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Connection states
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [deviceInfo, setDeviceInfo] = useState<ConnectedDeviceInfo | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | undefined>(undefined);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isActive, setIsActive] = useState(false);
  const activeTimerRef = useRef<any>(null);

  // Modals
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isHelperGuideOpen, setIsHelperGuideOpen] = useState(false);

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // WebSocket Client reference
  const wsClientRef = useRef<WebSocketClient | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Save settings to localStorage
  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('webmouse_settings', JSON.stringify(updated));
      } catch (e) {
        // ignore storage error
      }
      return updated;
    });
  }, []);

  // Save config to localStorage
  const updateConfig = useCallback((newConfig: Partial<ConnectionConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      try {
        localStorage.setItem('webmouse_config', JSON.stringify(updated));
      } catch (e) {
        // ignore storage error
      }
      return updated;
    });
  }, []);

  // Initialize or update WebSocket Client
  useEffect(() => {
    wsClientRef.current = new WebSocketClient(config, settings.deviceName, {
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
        if (newStatus === 'connected') {
          triggerHaptic('double', settings.vibration);
          showToast(`Connected to ${wsClientRef.current?.getDeviceInfo()?.computerName || 'Windows PC'}`);
        } else if (newStatus === 'auth_failed' || newStatus === 'error') {
          triggerHaptic('error', settings.vibration);
          if (newStatus === 'error') showToast('Connection lost');
        } else if (newStatus === 'reconnecting') {
          showToast('Reconnecting...');
        }
      },
      onDeviceInfo: (info) => {
        setDeviceInfo(info);
        if (info) {
          setPairedDevice(info);
          try {
            localStorage.setItem('webmouse_paired_device', JSON.stringify(info));
          } catch (e) {
            // ignore
          }
        }
      },
      onLog: (newLog) => {
        setLogs((prev) => [...prev.slice(-150), newLog]);
      },
      onLatency: (ms) => {
        setLatencyMs(ms);
      },
      onNotification: (msg) => {
        showToast(msg);
      },
      onClipboardData: (text) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => {
            showToast('PC Clipboard copied to phone!');
          }).catch(() => {
            showToast('Received clipboard, but phone denied paste permission.');
          });
        }
      }
    });

    return () => {
      wsClientRef.current?.disconnect();
    };
  }, []);

  // Synchronize config changes with client
  useEffect(() => {
    wsClientRef.current?.updateConfig(config, settings.deviceName);
  }, [config, settings.deviceName]);

  // Auto Clipboard Sync poll
  useEffect(() => {
    let interval: any;
    if (settings.clipboardSync && status === 'connected') {
      interval = setInterval(() => {
        if (wsClientRef.current) {
          wsClientRef.current.send({ type: 'get_clipboard' });
        }
      }, 5000); // Check every 5s
    }
    return () => clearInterval(interval);
  }, [settings.clipboardSync, status]);

  // Online / Offline Auto-reconnect
  useEffect(() => {
    const handleOnline = () => {
      if (config.autoReconnect && status !== 'connected' && wsClientRef.current) {
        wsClientRef.current.connect(true);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [config.autoReconnect, status]);

  // Connect / Disconnect handlers
  const handleConnect = (newConfig: ConnectionConfig) => {
    updateConfig(newConfig);
    wsClientRef.current?.updateConfig(newConfig, settings.deviceName);
    wsClientRef.current?.connect();
    setIsConnectionModalOpen(false);
  };

  const handleDisconnect = () => {
    wsClientRef.current?.disconnect();
    showToast('Disconnected manually');
  };

  const handleForgetDevice = () => {
    wsClientRef.current?.disconnect();
    setPairedDevice(null);
    try {
      localStorage.removeItem('webmouse_paired_device');
    } catch (e) {}
    updateConfig({ ...config, code: '' }); // Clear auth code
  };

  const handleSendMessage = useCallback((msg: OutgoingMessage) => {
    wsClientRef.current?.send(msg);
    setIsActive(true);
    if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
    activeTimerRef.current = setTimeout(() => setIsActive(false), 200);
  }, []);

  const handleTabChange = (tab: 'mouse' | 'keyboard' | 'share' | 'media' | 'settings') => {
    triggerHaptic('light', settings.vibration);
    setActiveTab(tab);
  };

  const isDark = settings.theme === 'dark';

  return (
    <div className={`w-full h-[100dvh] flex justify-center bg-black font-sans ${isDark ? 'dark text-zinc-100' : 'text-zinc-900'}`}>
      <div className={`w-full max-w-md h-full flex flex-col overflow-hidden relative shadow-2xl ${isDark ? 'bg-zinc-950' : 'bg-zinc-100'}`}>
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-full shadow-lg shadow-indigo-600/30 animate-in fade-in slide-in-from-top-4">
            {toastMessage}
          </div>
        )}

        {/* Top Header */}
        <Header
        status={status}
        deviceInfo={deviceInfo}
        latencyMs={latencyMs}
        isActive={isActive}
        onOpenConnectionModal={() => setIsConnectionModalOpen(true)}
        onOpenHelperGuide={() => setIsHelperGuideOpen(true)}
      />

      {/* Connection Notice Banner if Disconnected (Easy One-Tap Connect) */}
      {status === 'disconnected' && (
        <div className="bg-gradient-to-r from-indigo-950/70 via-zinc-900/90 to-indigo-950/70 border-b border-indigo-500/20 px-4 py-2 flex items-center justify-between text-xs text-indigo-200 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <Wifi className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">Not connected to Windows PC</span>
          </div>
          <button
            id="btn-quick-connect-banner"
            onClick={() => setIsConnectionModalOpen(true)}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-[11px] shrink-0 active:scale-95 transition-all shadow-sm"
          >
            Connect
          </button>
        </div>
      )}

      {status === 'auth_failed' && (
        <div className="bg-rose-950/80 border-b border-rose-500/30 px-4 py-2 flex items-center justify-between text-xs text-rose-200 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Pairing Code Rejected by Windows Helper</span>
          </div>
          <button
            onClick={() => setIsConnectionModalOpen(true)}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold text-[11px] shrink-0 active:scale-95"
          >
            Change Code
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-amber-950/80 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-200 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Cannot reach {config.host}:{config.port}</span>
          </div>
          <button
            onClick={() => setIsConnectionModalOpen(true)}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold text-[11px] shrink-0 active:scale-95"
          >
            Check Setup
          </button>
        </div>
      )}

      {/* Main Screen Content View */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {activeTab === 'mouse' && (
          <Touchpad
            onSendMessage={handleSendMessage}
            settings={settings}
            onUpdateSettings={updateSettings}
            isConnected={status === 'connected'}
          />
        )}

        {activeTab === 'keyboard' && (
          <KeyboardTab
            onSendMessage={handleSendMessage}
            settings={settings}
          />
        )}

        {activeTab === 'share' && (
          <ShareTab
            onSendMessage={handleSendMessage}
            settings={settings}
            onUpdateSettings={updateSettings}
          />
        )}

        {activeTab === 'media' && (
          <MediaTab
            onSendMessage={handleSendMessage}
            settings={settings}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            onUpdateSettings={updateSettings}
            config={config}
            onUpdateConfig={updateConfig}
            logs={logs}
            onClearLogs={() => setLogs([])}
            onOpenHelperGuide={() => setIsHelperGuideOpen(true)}
          />
        )}
      </main>

      {/* Bottom Mobile Navigation Bar */}
      <nav 
        id="nav-bottom-tabs" 
        className="h-16 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 px-3 flex items-center justify-around select-none shrink-0 z-30"
      >
        <button
          id="tab-btn-mouse"
          onClick={() => handleTabChange('mouse')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
            activeTab === 'mouse'
              ? 'text-indigo-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-all ${
            activeTab === 'mouse' ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30' : ''
          }`}>
            <MousePointer className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Mouse</span>
        </button>

        <button
          id="tab-btn-keyboard"
          onClick={() => handleTabChange('keyboard')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
            activeTab === 'keyboard'
              ? 'text-indigo-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-all ${
            activeTab === 'keyboard' ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30' : ''
          }`}>
            <KeyboardIcon className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Keyboard</span>
        </button>

        <button
          id="tab-btn-share"
          onClick={() => handleTabChange('share')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
            activeTab === 'share'
              ? 'text-indigo-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-all ${
            activeTab === 'share' ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30' : ''
          }`}>
            <Share2 className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Share</span>
        </button>

        <button
          id="tab-btn-media"
          onClick={() => handleTabChange('media')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
            activeTab === 'media'
              ? 'text-indigo-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-all ${
            activeTab === 'media' ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30' : ''
          }`}>
            <MonitorPlay className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Media</span>
        </button>

        <button
          id="tab-btn-settings"
          onClick={() => handleTabChange('settings')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
            activeTab === 'settings'
              ? 'text-indigo-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-all ${
            activeTab === 'settings' ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30' : ''
          }`}>
            <SettingsIcon className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Settings</span>
        </button>
      </nav>

      {/* Connection Modal */}
      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
        config={config}
        status={status}
        deviceInfo={deviceInfo}
        pairedDevice={pairedDevice}
        onSaveAndConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onForgetDevice={handleForgetDevice}
        onOpenHelperGuide={() => {
          setIsConnectionModalOpen(false);
          setIsHelperGuideOpen(true);
        }}
      />

      {/* Windows Helper Guide & Code Viewer Modal */}
      <WindowsHelperModal
        isOpen={isHelperGuideOpen}
        onClose={() => setIsHelperGuideOpen(false)}
      />
      </div>
    </div>
  );
}

