/**
 * WebMouse V1 — Phone -> PC Universal Control Center
 * Turns a smartphone into a wireless Mouse, Keyboard, Media Controller, Presentation Remote,
 * File Transfer Tool, Quick Share Tool, and Custom Control Surface for Windows.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MousePointer, 
  Keyboard as KeyboardIcon, 
  Settings as SettingsIcon, 
  AlertCircle, 
  Wifi, 
  FolderUp, 
  Disc, 
  Scan,
  Command,
  LayoutDashboard,
  Tv,
  Cast,
  Bot,
  Mic
} from 'lucide-react';
import { Header } from './components/Header';
import { HomeTab } from './components/HomeTab';
import { Touchpad } from './components/Touchpad';
import { KeyboardTab } from './components/KeyboardTab';
import { ShareTab } from './components/ShareTab';
import { MediaTab } from './components/MediaTab';
import { CustomControlsTab } from './components/CustomControlsTab';
import { SettingsTab } from './components/SettingsTab';
import { ProjectorPanel } from './components/projector/ProjectorPanel';
import { AIControlPanel } from './features/ai/AIControlPanel';
import { ConnectionModal } from './components/ConnectionModal';
import { WindowsHelperModal } from './components/WindowsHelperModal';
import { ScreenshotModal } from './components/ScreenshotModal';
import { ComputerProfilesModal } from './components/ComputerProfilesModal';
import { TvRemoteTab } from './components/TvRemoteTab';
import { ReceiverView } from './components/receiver/ReceiverView';
import { receiverService } from './services/receiverService';
import { 
  AppSettings, 
  ConnectionConfig, 
  ConnectionStatus, 
  ConnectedDeviceInfo, 
  LogEntry, 
  OutgoingMessage,
  ComputerProfile,
  QuickActionId,
  Device,
  DeviceType
} from './types';
import { WebSocketClient, triggerHaptic } from './services/websocketService';
import { deviceManager } from './services/deviceManager';
import { useFileTransfer } from './hooks/useFileTransfer';
import { copyToClipboard } from './utils/clipboard';
import { 
  getComputerProfiles, 
  saveComputerProfiles, 
  upsertComputerProfile, 
  renameComputerProfile, 
  deleteComputerProfile 
} from './utils/profiles';

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

  // Application Mode: 'controller' (Phone/Tablet) or 'receiver' (Android TV/Smart Board)
  const [appMode, setAppMode] = useState<'controller' | 'receiver'>(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'receiver') return 'receiver';
      }
      const saved = localStorage.getItem('webmouse_app_mode');
      return saved === 'receiver' ? 'receiver' : 'controller';
    } catch {
      return 'controller';
    }
  });

  // Tab navigation: 'home' | 'mouse' | 'keyboard' | 'share' | 'media' | 'custom' | 'settings' | 'tv_remote' | 'projector' | 'ai'
  const [activeTab, setActiveTab] = useState<'home' | 'mouse' | 'keyboard' | 'share' | 'media' | 'custom' | 'settings' | 'tv_remote' | 'projector' | 'ai'>('home');

  // Universal Devices & Profiles (V2 Architecture)
  const [devices, setDevices] = useState<Device[]>(() => deviceManager.getDevices());
  const [activeDevice, setActiveDevice] = useState<Device | null>(() => deviceManager.getActiveDevice());
  const [profiles, setProfiles] = useState<ComputerProfile[]>(getComputerProfiles);
  const [activeProfileId, setActiveProfileId] = useState<string | undefined>(() => {
    return deviceManager.getActiveDevice()?.id || undefined;
  });

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
  const [connectionModalView, setConnectionModalView] = useState<'normal' | 'scanner' | 'qr_host' | 'manual_pin' | 'download_helper'>('normal');
  const [isHelperGuideOpen, setIsHelperGuideOpen] = useState(false);
  const [isProfilesModalOpen, setIsProfilesModalOpen] = useState(false);

  // Screenshot modal & data
  const [isScreenshotModalOpen, setIsScreenshotModalOpen] = useState(false);
  const [isScreenshotLoading, setIsScreenshotLoading] = useState(false);
  const [screenshotData, setScreenshotData] = useState<{
    image?: string;
    filename?: string;
    timestamp?: number;
    error?: string;
  } | null>(null);

  const openConnectionModal = (view: 'normal' | 'scanner' | 'qr_host' | 'manual_pin' | 'download_helper' = 'normal') => {
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

  // Save settings to localStorage
  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('webmouse_settings', JSON.stringify(updated));
      } catch (e) {
        // ignore
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
        // ignore
      }
      return updated;
    });
  }, []);

  // Take screenshot handler
  const handleTakeScreenshot = useCallback(() => {
    triggerHaptic('medium', settings.vibration);
    setIsScreenshotLoading(true);
    setIsScreenshotModalOpen(true);
    setScreenshotData(null);
    handleSendMessage({ type: 'take_screenshot' });
  }, [handleSendMessage, settings.vibration]);

  // Quick Action Dispatcher (PART 12)
  const handleQuickAction = useCallback((action: QuickActionId) => {
    triggerHaptic('medium', settings.vibration);

    switch (action) {
      case 'screenshot':
        handleTakeScreenshot();
        break;
      case 'mouse':
        setActiveTab('mouse');
        break;
      case 'keyboard':
        setActiveTab('keyboard');
        break;
      case 'media':
      case 'presentation':
        setActiveTab('media');
        break;
      case 'files':
      case 'share':
        setActiveTab('share');
        break;
      case 'custom':
        setActiveTab('custom');
        break;
      case 'desktop':
        handleSendMessage({ type: 'quick_control', action: 'desktop' });
        showToast('Desktop Toggled');
        break;
      case 'alttab':
        handleSendMessage({ type: 'quick_control', action: 'alttab' });
        showToast('Alt + Tab');
        break;
      case 'lock':
        handleSendMessage({ type: 'quick_control', action: 'lock' });
        showToast('PC Session Locked');
        break;
      case 'mute':
        handleSendMessage({ type: 'media_control', action: 'volumemute' });
        showToast('Audio Mute Toggled');
        break;
      case 'volume_up':
        handleSendMessage({ type: 'media_control', action: 'volumeup' });
        break;
      case 'volume_down':
        handleSendMessage({ type: 'media_control', action: 'volumedown' });
        break;
      case 'copy':
        handleSendMessage({ type: 'shortcut', keys: ['ctrl', 'c'] });
        showToast('Ctrl + C Sent');
        break;
      case 'paste':
        handleSendMessage({ type: 'shortcut', keys: ['ctrl', 'v'] });
        showToast('Ctrl + V Sent');
        break;
    }
  }, [handleSendMessage, handleTakeScreenshot, settings.vibration, showToast]);

  // Initialize or update WebSocket Client
  useEffect(() => {
    wsClientRef.current = new WebSocketClient(config, settings.deviceName, {
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
        if (newStatus === 'connected') {
          triggerHaptic('double', settings.vibration);
          showToast('🟢 Connected to Windows PC');
          // Update profile status
          setProfiles((prev) =>
            prev.map((p) =>
              p.host === config.host ? { ...p, status: 'connected', lastConnected: Date.now() } : p
            )
          );
        } else if (newStatus === 'auth_failed' || newStatus === 'error') {
          triggerHaptic('error', settings.vibration);
          if (newStatus === 'error') showToast('Connection lost');
          setProfiles((prev) =>
            prev.map((p) => (p.host === config.host ? { ...p, status: 'offline' } : p))
          );
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
          } catch (e) {}
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
          showToast('Received clipboard text from PC.');
        }
      },
      onIncomingMessage: (msg) => {
        setLastIncomingMessage(msg);
        
        if (msg.type === 'webrtc_signaling') {
          setWebrtcMessages((prev) => [...prev, msg]);
        }
        
        // Handle Screenshot Result (PART 13)
        if (msg.type === 'screenshot_result') {
          setIsScreenshotLoading(false);
          if (msg.success && msg.image) {
            setScreenshotData({
              image: msg.image,
              filename: msg.filename,
              timestamp: msg.timestamp || Date.now(),
            });
            setIsScreenshotModalOpen(true);
            showToast('📸 Screenshot received from Windows PC!');
          } else {
            setScreenshotData({
              error: msg.message || 'Could not capture screenshot on PC.',
            });
            setIsScreenshotModalOpen(true);
          }
        }

        // Save token to configuration & profiles for persistent pairing
        if (msg.type === 'auth_result' && msg.success) {
          const compName = msg.computerName || activeDevice?.name || 'Device';
          const clientCfg = wsClientRef.current?.getConfig();
          const targetHost = clientCfg?.host || config.host;
          const targetPort = clientCfg?.port || config.port;

          if (msg.token) {
            updateConfig({
              token: msg.token,
              qrToken: undefined,
              lastComputerName: compName,
            });
          }

          const newPaired: ConnectedDeviceInfo = {
            computerName: compName,
            deviceType: msg.deviceType || activeDevice?.type || 'windows',
            platform: msg.platform || activeDevice?.platform || 'windows',
            capabilities: msg.capabilities || activeDevice?.capabilities,
            screenWidth: msg.screenWidth,
            screenHeight: msg.screenHeight,
            ip: targetHost,
            port: targetPort,
          };
          setPairedDevice(newPaired);
          try {
            localStorage.setItem('webmouse_paired_device', JSON.stringify(newPaired));
          } catch (e) {}

          // Update DeviceManager
          const updatedDev = deviceManager.addDevice({
            id: activeDevice?.id,
            name: compName,
            host: targetHost,
            port: targetPort,
            token: msg.token || config.token,
            type: msg.deviceType || activeDevice?.type || 'windows',
            platform: msg.platform || activeDevice?.platform || 'windows',
            capabilities: msg.capabilities || activeDevice?.capabilities,
            connectionState: 'connected',
            screenWidth: msg.screenWidth,
            screenHeight: msg.screenHeight,
          });
          setActiveDevice(updatedDev);
          setDevices(deviceManager.getDevices());

          // Update profiles collection
          const updated = upsertComputerProfile({
            id: updatedDev.id,
            name: compName,
            host: targetHost,
            port: targetPort,
            token: msg.token || config.token,
            type: updatedDev.type,
            platform: updatedDev.platform,
            capabilities: updatedDev.capabilities,
            status: 'connected',
            lastConnected: Date.now(),
          });
          setProfiles(getComputerProfiles());
          setActiveProfileId(updated.id);
        }
      }
    });

    return () => {
      wsClientRef.current?.disconnect();
    };
  }, []);

  // Auto-connect on mount if token and autoReconnect are set OR if URL query parameters exist (?host=...&token=...)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlHost = urlParams.get('host')?.trim();
        const urlPort = parseInt(urlParams.get('port') || '8765', 10);
        const urlToken = (urlParams.get('token') || urlParams.get('qrToken') || '').trim();
        const urlCode = (urlParams.get('code') || (urlToken && urlToken.length <= 8 ? urlToken : '') || '').trim();

        if (urlHost) {
          const directConfig: ConnectionConfig = {
            ...config,
            host: urlHost,
            port: urlPort,
            code: urlCode || urlToken,
            qrToken: urlToken || undefined,
            token: undefined,
            autoReconnect: true,
          };
          updateConfig(directConfig);
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
          showToast('⚡ Connecting to ' + urlHost + '...');
          setTimeout(() => {
            wsClientRef.current?.updateConfig(directConfig, settings.deviceName);
            wsClientRef.current?.connect(false);
          }, 100);
          return;
        }
      }
    } catch {
      // ignore
    }

    if (config.token && config.autoReconnect && wsClientRef.current) {
      wsClientRef.current.connect(true);
    }
  }, []);

  // Synchronize config changes with client
  useEffect(() => {
    wsClientRef.current?.updateConfig(config, settings.deviceName);
  }, [config, settings.deviceName]);

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

  // Clean connection cleanup on window close/beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      wsClientRef.current?.disconnect();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

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
      localStorage.removeItem('webmouse_trusted_token');
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
    showToast('Device pairing forgotten');
  };

  // Profile Switching Handlers (PART 2 & V2 Device Architecture)
  const handleSelectProfile = (profile: ComputerProfile) => {
    setActiveProfileId(profile.id);
    const dev = deviceManager.setActiveDevice(profile.id);
    if (dev) {
      setActiveDevice(dev);
    }
    const newConfig: ConnectionConfig = {
      host: profile.host,
      port: profile.port || 8765,
      code: profile.pairingCode || '',
      token: profile.token,
      lastComputerName: profile.name,
      autoReconnect: true,
    };
    updateConfig(newConfig);
    wsClientRef.current?.updateConfig(newConfig, settings.deviceName);
    wsClientRef.current?.connect(false);
    showToast(`Connecting to ${profile.name}...`);
  };

  const handleSelectDevice = (dev: Device) => {
    setActiveProfileId(dev.id);
    deviceManager.setActiveDevice(dev.id);
    setActiveDevice(dev);
    const newConfig: ConnectionConfig = {
      host: dev.host,
      port: dev.port || 8765,
      code: dev.pairingCode || '',
      token: dev.token,
      lastComputerName: dev.name,
      autoReconnect: true,
    };
    updateConfig(newConfig);
    wsClientRef.current?.updateConfig(newConfig, settings.deviceName);
    wsClientRef.current?.connect(false);
    showToast(`Switched to ${dev.name}`);
  };

  const handleRenameProfile = (id: string, newName: string) => {
    deviceManager.updateDevice(id, { name: newName });
    const updated = renameComputerProfile(id, newName);
    setProfiles(updated);
    setDevices(deviceManager.getDevices());
    showToast(`Renamed to "${newName}"`);
  };

  const handleDeleteProfile = (id: string) => {
    deviceManager.removeDevice(id);
    const updated = deleteComputerProfile(id);
    setProfiles(updated);
    setDevices(deviceManager.getDevices());
    if (activeProfileId === id) {
      handleForgetDevice();
    }
    showToast('Device removed');
  };

  const handleTabChange = (tab: 'home' | 'mouse' | 'keyboard' | 'share' | 'media' | 'custom' | 'settings' | 'tv_remote' | 'projector' | 'ai') => {
    triggerHaptic('light', settings.vibration);
    setActiveTab(tab);
  };

  const isDark = settings.theme === 'dark';

  // If in Receiver Mode (Android TV or Smart Board display)
  if (appMode === 'receiver') {
    return (
      <ReceiverView
        onExitReceiverMode={() => {
          setAppMode('controller');
          try {
            localStorage.setItem('webmouse_app_mode', 'controller');
          } catch (e) {}
        }}
        onLaunchControllerForTesting={() => {
          const recvCfg = receiverService.getConfig();
          const targetConfig: ConnectionConfig = {
            host: 'receiver_local',
            port: recvCfg.port || 8765,
            code: recvCfg.pairingCode,
            token: recvCfg.token,
            lastComputerName: recvCfg.name,
            autoReconnect: true,
          };
          updateConfig(targetConfig);
          const dev = deviceManager.addDevice({
            name: recvCfg.name,
            type: recvCfg.type,
            host: 'receiver_local',
            port: recvCfg.port || 8765,
            pairingCode: recvCfg.pairingCode,
            token: recvCfg.token,
            capabilities: recvCfg.capabilities,
          });
          setActiveDevice(dev);
          setActiveProfileId(dev.id);
          setAppMode('controller');
          try {
            localStorage.setItem('webmouse_app_mode', 'controller');
          } catch (e) {}
          setTimeout(() => {
            wsClientRef.current?.updateConfig(targetConfig, settings.deviceName);
            wsClientRef.current?.connect(false);
            showToast(`Connected to ${recvCfg.name}`);
          }, 150);
        }}
      />
    );
  }

  return (
    <div className={`w-full h-[100dvh] flex justify-center bg-black font-sans ${isDark ? 'dark text-zinc-100' : 'text-zinc-900'}`}>
      <div className={`w-full max-w-md h-full flex flex-col overflow-hidden relative shadow-2xl ${isDark ? 'bg-zinc-950' : 'bg-zinc-100'}`}>
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-full shadow-lg shadow-indigo-600/30 animate-in fade-in slide-in-from-top-4 flex items-center gap-2">
            <span>{toastMessage}</span>
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
          onSwitchToReceiverMode={() => {
            setAppMode('receiver');
            try {
              localStorage.setItem('webmouse_app_mode', 'receiver');
            } catch (e) {}
          }}
        />

        {/* Quick Connection Banner if Disconnected */}
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

        {/* Main View Screen */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {activeTab === 'home' && (
            <HomeTab
              status={status}
              deviceInfo={deviceInfo}
              pairedDevice={pairedDevice}
              latencyMs={latencyMs}
              logs={logs}
              profiles={profiles}
              devices={devices}
              activeDevice={activeDevice}
              activeProfileId={activeProfileId}
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
              onOpenProfilesModal={() => setIsProfilesModalOpen(true)}
              onOpenScreenshot={handleTakeScreenshot}
              onQuickAction={handleQuickAction}
              onSwitchToReceiverMode={() => {
                setAppMode('receiver');
                try {
                  localStorage.setItem('webmouse_app_mode', 'receiver');
                } catch (e) {}
              }}
            />
          )}

          {activeTab === 'tv_remote' && (
            <TvRemoteTab
              device={activeDevice}
              isConnected={status === 'connected'}
              onSendMessage={handleSendMessage}
              vibrationEnabled={settings.vibration}
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

          {activeTab === 'custom' && (
            <CustomControlsTab
              onSendMessage={handleSendMessage}
              settings={settings}
              onOpenScreenshot={handleTakeScreenshot}
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

          {activeTab === 'projector' && (
            <ProjectorPanel
              devices={devices}
              activeDevice={activeDevice}
              onSendMessage={handleSendMessage}
              lastIncomingMessage={lastIncomingMessage}
              vibrationEnabled={settings.vibration}
            />
          )}

          {activeTab === 'ai' && (
            <AIControlPanel
              devices={devices}
              activeDevice={activeDevice}
              onSendMessage={handleSendMessage}
              onSelectDevice={(dev) => handleSelectDevice(dev)}
              onStartProjection={async () => {
                setActiveTab('projector');
                return true;
              }}
              onStopProjection={() => {
                handleSendMessage({ type: 'projector_stop', sessionId: '' });
              }}
              onPauseProjection={() => {
                handleSendMessage({ type: 'projector_pause', sessionId: '' });
              }}
              onResumeProjection={() => {
                handleSendMessage({ type: 'projector_resume', sessionId: '' });
              }}
              onOpenShareModal={() => {
                setActiveTab('share');
              }}
              vibrationEnabled={settings.vibration}
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

        {/* Bottom Mobile Navigation Bar (7 Streamlined Modes) */}
        <nav 
          id="nav-bottom-tabs" 
          className="h-16 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/80 px-1 flex items-center justify-around select-none shrink-0 z-30"
        >
          <button
            id="tab-btn-home"
            onClick={() => handleTabChange('home')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              activeTab === 'home' ? 'text-indigo-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'home' ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30' : ''
            }`}>
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <span className="text-[9px] mt-0.5 tracking-tight">Home</span>
          </button>

          {activeDevice?.type === 'android_tv' ? (
            <button
              id="tab-btn-remote"
              onClick={() => handleTabChange('tv_remote')}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                activeTab === 'tv_remote' ? 'text-amber-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'tv_remote' ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30' : ''
              }`}>
                <Tv className="w-4 h-4" />
              </div>
              <span className="text-[9px] mt-0.5 tracking-tight">Remote</span>
            </button>
          ) : (
            <button
              id="tab-btn-mouse"
              onClick={() => handleTabChange('mouse')}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                activeTab === 'mouse' ? 'text-indigo-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'mouse' ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30' : ''
              }`}>
                <MousePointer className="w-4 h-4" />
              </div>
              <span className="text-[9px] mt-0.5 tracking-tight">Mouse</span>
            </button>
          )}

          <button
            id="tab-btn-keyboard"
            onClick={() => handleTabChange('keyboard')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              activeTab === 'keyboard' ? 'text-indigo-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'keyboard' ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30' : ''
            }`}>
              <KeyboardIcon className="w-4 h-4" />
            </div>
            <span className="text-[9px] mt-0.5 tracking-tight">Keys</span>
          </button>

          <button
            id="tab-btn-media"
            onClick={() => handleTabChange('media')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              activeTab === 'media' ? 'text-indigo-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'media' ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30' : ''
            }`}>
              <Disc className="w-4 h-4" />
            </div>
            <span className="text-[9px] mt-0.5 tracking-tight">Media</span>
          </button>

          <button
            id="tab-btn-share"
            onClick={() => handleTabChange('share')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              activeTab === 'share' ? 'text-indigo-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'share' ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30' : ''
            }`}>
              <FolderUp className="w-4 h-4" />
            </div>
            <span className="text-[9px] mt-0.5 tracking-tight">Share</span>
          </button>

          <button
            id="tab-btn-projector"
            onClick={() => handleTabChange('projector')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              activeTab === 'projector' ? 'text-indigo-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'projector' ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30' : ''
            }`}>
              <Cast className="w-4 h-4" />
            </div>
            <span className="text-[9px] mt-0.5 tracking-tight">Project</span>
          </button>

          <button
            id="tab-btn-ai"
            onClick={() => handleTabChange('ai')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              activeTab === 'ai' ? 'text-rose-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'ai' ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/30' : ''
            }`}>
              <Mic className="w-4 h-4" />
            </div>
            <span className="text-[9px] mt-0.5 tracking-tight font-bold">Voice/AI</span>
          </button>

          <button
            id="tab-btn-custom"
            onClick={() => handleTabChange('custom')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              activeTab === 'custom' ? 'text-indigo-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'custom' ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30' : ''
            }`}>
              <Command className="w-4 h-4" />
            </div>
            <span className="text-[9px] mt-0.5 tracking-tight">Custom</span>
          </button>

          <button
            id="tab-btn-settings"
            onClick={() => handleTabChange('settings')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              activeTab === 'settings' ? 'text-indigo-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'settings' ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30' : ''
            }`}>
              <SettingsIcon className="w-4 h-4" />
            </div>
            <span className="text-[9px] mt-0.5 tracking-tight">Settings</span>
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

        {/* Windows Helper Guide Modal */}
        <WindowsHelperModal
          isOpen={isHelperGuideOpen}
          onClose={() => setIsHelperGuideOpen(false)}
        />

        {/* Computer Profiles Modal */}
        <ComputerProfilesModal
          isOpen={isProfilesModalOpen}
          onClose={() => setIsProfilesModalOpen(false)}
          profiles={profiles}
          activeProfileId={activeProfileId}
          currentStatus={status}
          onSelectProfile={handleSelectProfile}
          onRenameProfile={handleRenameProfile}
          onDeleteProfile={handleDeleteProfile}
          onAddNewComputer={(method) => openConnectionModal(method)}
        />

        {/* Screenshot Result Modal */}
        <ScreenshotModal
          isOpen={isScreenshotModalOpen}
          onClose={() => setIsScreenshotModalOpen(false)}
          screenshotData={screenshotData}
          isLoading={isScreenshotLoading}
        />
      </div>
    </div>
  );
}
