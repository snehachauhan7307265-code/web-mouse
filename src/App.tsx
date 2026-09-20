/**
 * WebMouse V1 — Mobile Web App
 * Turns an Android/iPhone smartphone into a wireless mouse & keyboard for Windows.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MousePointer, Keyboard as KeyboardIcon, Scroll, Settings as SettingsIcon, AlertCircle, Wifi, Share2, MonitorPlay, Scan } from 'lucide-react';
import { Header } from './components/Header';
import { HomeTab } from './components/HomeTab';
import { Touchpad } from './components/Touchpad';
import { KeyboardTab } from './components/KeyboardTab';
import { ShareTab } from './components/ShareTab';
import { MediaTab } from './components/MediaTab';
import { SettingsTab } from './components/SettingsTab';
import { ScreenProjectorTab } from './components/ScreenProjectorTab';
import { ConnectionModal } from './components/ConnectionModal';
import { WindowsHelperModal } from './components/WindowsHelperModal';
import { AppSettings, ConnectionConfig, ConnectionStatus, ConnectedDeviceInfo, LogEntry, OutgoingMessage } from './types';
import { WebSocketClient, triggerHaptic } from './services/websocketService';
import { useFileTransfer } from './hooks/useFileTransfer';
import { copyToClipboard } from './utils/clipboard';

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

  // Tab navigation: 'home' | 'mouse' | 'keyboard' | 'share' | 'media' | 'settings' | 'projector'
  const [activeTab, setActiveTab] = useState<'home' | 'mouse' | 'keyboard' | 'share' | 'media' | 'settings' | 'projector'>('home');

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
  const [lastIncomingMessage, setLastIncomingMessage] = useState<any>(null);
  const [webrtcMessages, setWebrtcMessages] = useState<any[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isActive, setIsActive] = useState(false);
  const activeTimerRef = useRef<any>(null);

  // Modals
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [connectionModalView, setConnectionModalView] = useState<'normal' | 'scanner' | 'qr_host' | 'manual_pin'>('normal');
  const [isHelperGuideOpen, setIsHelperGuideOpen] = useState(false);

  const openConnectionModal = (view: 'normal' | 'scanner' | 'qr_host' | 'manual_pin' = 'normal') => {
    setConnectionModalView(view);
    setIsConnectionModalOpen(true);
  };

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // WebSocket Client reference
  const wsClientRef = useRef<WebSocketClient | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const handleSendMessage = useCallback((msg: OutgoingMessage) => {
    wsClientRef.current?.send(msg);
    setIsActive(true);
    if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
    activeTimerRef.current = setTimeout(() => setIsActive(false), 200);
  }, []);

  const { transfers, startUpload, cancelTransfer, acceptDownload, rejectDownload } = useFileTransfer(
    handleSendMessage,
    lastIncomingMessage,
    triggerHaptic,
    settings.vibration
  );

  // Auto-switch to projector when an offer is received
  useEffect(() => {
    const latest = webrtcMessages[webrtcMessages.length - 1];
    if (latest?.type === 'webrtc_signaling' && latest.signalType === 'offer') {
      setActiveTab('projector');
      showToast('Incoming Screen Projection...');
    }
  }, [webrtcMessages, showToast]);

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
          showToast('🟢 Connected to Windows PC');
          setActiveTab('mouse');
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
      onClipboardData: async (text) => {
        const copied = await copyToClipboard(text);
        if (copied) {
          showToast('PC Clipboard copied to phone!');
        } else {
          showToast('Received clipboard, but phone denied paste permission.');
        }
      },
      onIncomingMessage: (msg) => {
        setLastIncomingMessage(msg);
        
        if (msg.type === 'webrtc_signaling') {
          setWebrtcMessages((prev) => [...prev, msg]);
        }
        
        // Save the token to configuration for persistent pairing
        if (msg.type === 'auth_result' && msg.success && msg.token) {
          const computerName = msg.computerName || 'My Laptop';
          const clientCfg = wsClientRef.current?.getConfig();
          updateConfig({
            token: msg.token,
            qrToken: undefined,
            lastComputerName: computerName,
          });
          const newPaired: ConnectedDeviceInfo = {
            computerName,
            screenWidth: msg.screenWidth,
            screenHeight: msg.screenHeight,
            ip: clientCfg?.host || config.host,
            port: clientCfg?.port || config.port,
          };
          setPairedDevice(newPaired);
          try {
            localStorage.setItem('webmouse_paired_device', JSON.stringify(newPaired));
          } catch (e) {}
        }
      }
    });

    return () => {
      wsClientRef.current?.disconnect();
    };
  }, []);

  // Auto-connect on mount if token and autoReconnect are set
  useEffect(() => {
    if (config.token && config.autoReconnect && wsClientRef.current) {
      wsClientRef.current.connect(true);
    }
  }, []); // Run only once on mount

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
    setConfig((prev) => {
      const updated: ConnectionConfig = {
        ...prev,
        code: '',
        token: undefined,
        qrToken: undefined,
        lastComputerName: undefined,
      };
      try {
        localStorage.setItem('webmouse_config', JSON.stringify(updated));
      } catch (e) {}
      wsClientRef.current?.updateConfig(updated, settings.deviceName);
      return updated;
    });
    showToast('Device forgotten');
  };

  const handleTabChange = (tab: 'home' | 'mouse' | 'keyboard' | 'share' | 'media' | 'settings' | 'projector') => {
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
          onOpenConnectionModal={(view) => openConnectionModal(view || 'normal')}
          onOpenHelperGuide={() => setIsHelperGuideOpen(true)}
        />

        {/* Connection Notice Banner if Disconnected (Easy One-Tap Connect) */}
        {status === 'disconnected' && (
          <div className="bg-gradient-to-r from-indigo-950/70 via-zinc-900/90 to-indigo-950/70 border-b border-indigo-500/20 px-4 py-2 flex items-center justify-between text-xs text-indigo-200 shrink-0">
            <div className="flex items-center gap-2 truncate">
              <Wifi className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">Scan QR to connect laptop</span>
            </div>
            <button
              id="btn-quick-connect-banner"
              onClick={() => openConnectionModal('scanner')}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-[11px] shrink-0 active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
            >
              <Scan className="w-3.5 h-3.5 text-emerald-100" />
              <span>Scan QR</span>
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
        {activeTab === 'home' && (
          <HomeTab
            status={status}
            deviceInfo={deviceInfo}
            pairedDevice={pairedDevice}
            latencyMs={latencyMs}
            logs={logs}
            onNavigate={handleTabChange}
            onClearLogs={() => setLogs([])}
            onReconnect={() => {
              if (config.token && config.autoReconnect && wsClientRef.current) {
                wsClientRef.current.connect(true);
              } else {
                setIsConnectionModalOpen(true);
              }
            }}
            onDisconnect={handleDisconnect}
            onOpenConnectionModal={(view) => openConnectionModal(view || 'normal')}
            onForgetDevice={handleForgetDevice}
          />
        )}

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
            transfers={transfers}
            onStartUpload={startUpload}
            onCancelTransfer={cancelTransfer}
          />
        )}

        {activeTab === 'media' && (
          <MediaTab
            onSendMessage={handleSendMessage}
            settings={settings}
          />
        )}

        {activeTab === 'projector' && (
          <ScreenProjectorTab
            onSendMessage={handleSendMessage}
            lastIncomingMessage={lastIncomingMessage}
            status={status}
            deviceInfo={deviceInfo}
            settings={settings}
            isDark={isDark}
            onExit={() => handleTabChange('home')}
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
      
      {/* Incoming File Requests Overlay */}
      <div className="absolute top-16 left-0 right-0 z-40 px-4 flex flex-col gap-2 pointer-events-none">
        {transfers.filter(t => t.direction === 'download' && t.status === 'waiting_for_approval').map(t => (
          <div key={t.id} className="pointer-events-auto bg-zinc-900 border border-indigo-500 shadow-2xl rounded-2xl p-4 flex flex-col gap-3 animate-in slide-in-from-top-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">Incoming File</h3>
                <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[200px]">{t.filename}</p>
                <p className="text-xs text-zinc-500">{(t.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-full">
                 <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              <button onClick={() => acceptDownload(t.id)} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors">
                Accept
              </button>
              <button onClick={() => rejectDownload(t.id)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-semibold transition-colors">
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Mobile Navigation Bar */}
      <nav 
        id="nav-bottom-tabs" 
        className="h-16 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 px-3 flex items-center justify-around select-none shrink-0 z-30"
      >
        <button
          id="tab-btn-home"
          onClick={() => handleTabChange('home')}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
            activeTab === 'home'
              ? 'text-indigo-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-all ${
            activeTab === 'home' ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30' : ''
          }`}>
            <MonitorPlay className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Home</span>
        </button>

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
        initialView={connectionModalView}
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

