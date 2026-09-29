/**
 * WebMouse V2 — Universal Device Control
 * Redesigned architecture: 5 primary areas (Home, Control, Share, AI, Devices)
 * Preserves 100% of underlying WebSocket protocols, WebRTC, QR pairing, Windows helper,
 * Android TV / Smart Board receivers, AI Intent engine, and file transfers.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { AppShell, PrimaryArea } from './components/layout/AppShell';
import { HomeView } from './components/views/HomeView';
import { ControlView, ControlMode } from './components/views/ControlView';
import { ShareView } from './components/views/ShareView';
import { AIView } from './components/views/AIView';
import { DevicesView } from './components/views/DevicesView';
import { SettingsTab } from './components/SettingsTab';
import { ConnectionModal } from './components/ConnectionModal';
import { WindowsHelperModal } from './components/WindowsHelperModal';
import { ScreenshotModal } from './components/ScreenshotModal';
import { ComputerProfilesModal } from './components/ComputerProfilesModal';
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

  // Application Mode: 'controller' or 'receiver'
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

  // Primary Navigation Areas: 'home' | 'control' | 'share' | 'ai' | 'devices' | 'settings'
  const [currentArea, setCurrentArea] = useState<PrimaryArea>('home');
  const [controlInitialMode, setControlInitialMode] = useState<ControlMode>('mouse');
  const [autoStartVoice, setAutoStartVoice] = useState(false);

  // Universal Devices & Profiles
  const [devices, setDevices] = useState<Device[]>(() => deviceManager.getDevices());
  const [activeDevice, setActiveDevice] = useState<Device | null>(() => deviceManager.getActiveDevice());
  const [profiles, setProfiles] = useState<ComputerProfile[]>(() => {
    const loaded = getComputerProfiles();
    return Array.isArray(loaded) ? loaded : [];
  });
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
  const [logs, setLogs] = useState<LogEntry[]>([]);

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
  }, []);

  const { transfers, startUpload, cancelTransfer, acceptDownload, rejectDownload, removeTransfer } = useFileTransfer(
    handleSendMessage,
    lastIncomingMessage,
    activeDevice,
    status === 'connected',
    settings.deviceName,
    triggerHaptic,
    settings.vibration
  );

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('webmouse_settings', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const updateConfig = (newConfig: Partial<ConnectionConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      try {
        localStorage.setItem('webmouse_config', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleTakeScreenshot = useCallback(() => {
    setIsScreenshotLoading(true);
    setIsScreenshotModalOpen(true);
    handleSendMessage({ type: 'take_screenshot' });
  }, [handleSendMessage]);

  const handleQuickAction = useCallback((action: QuickActionId) => {
    triggerHaptic('medium', settings.vibration);
    switch (action) {
      case 'mute':
        handleSendMessage({ type: 'media_control', action: 'volumemute' });
        break;
      case 'alttab':
        handleSendMessage({ type: 'shortcut', keys: ['alt', 'tab'] });
        break;
      case 'desktop':
        handleSendMessage({ type: 'shortcut', keys: ['win', 'd'] });
        break;
      case 'screenshot':
        handleTakeScreenshot();
        break;
      case 'lock':
        handleSendMessage({ type: 'shortcut', keys: ['win', 'l'] });
        break;
    }
  }, [handleSendMessage, handleTakeScreenshot, settings.vibration]);

  const handleSelectDevice = useCallback((device: Device) => {
    setActiveDevice(device);
    setActiveProfileId(device.id);
    deviceManager.setActiveDevice(device.id);

    if (device.pairingCode) {
      const newConfig: ConnectionConfig = {
        ...config,
        host: device.host || config.host,
        port: device.port || config.port,
        code: device.pairingCode,
        token: device.token || config.token,
      };
      updateConfig(newConfig);
      wsClientRef.current?.updateConfig(newConfig, settings.deviceName);
      wsClientRef.current?.connect(true);
    }
  }, [config, settings.deviceName]);

  const handleSelectProfile = (profile: ComputerProfile) => {
    setActiveProfileId(profile.id);
    const newConfig: ConnectionConfig = {
      ...config,
      host: profile.host,
      port: profile.port,
      code: profile.pairingCode,
      token: profile.token,
    };
    updateConfig(newConfig);

    const dev = deviceManager.addDevice({
      id: profile.id,
      name: profile.name,
      type: profile.type || 'windows',
      host: profile.host,
      port: profile.port,
      pairingCode: profile.pairingCode,
      token: profile.token,
      capabilities: profile.capabilities,
    });
    setActiveDevice(dev);

    setTimeout(() => {
      wsClientRef.current?.updateConfig(newConfig, settings.deviceName);
      wsClientRef.current?.connect(true);
    }, 100);
  };

  const handleRenameProfile = (id: string, newName: string) => {
    const updated = renameComputerProfile(id, newName);
    setProfiles(updated);
    deviceManager.renameDevice(id, newName);
    setDevices(deviceManager.getDevices());
  };

  const handleDeleteProfile = (id: string) => {
    const updated = deleteComputerProfile(id);
    setProfiles(updated);
    deviceManager.removeDevice(id);
    setDevices(deviceManager.getDevices());
    if (activeProfileId === id) {
      setActiveProfileId(undefined);
      setActiveDevice(null);
    }
  };

  const handleConnect = (newConfig: ConnectionConfig) => {
    updateConfig(newConfig);
    wsClientRef.current?.updateConfig(newConfig, settings.deviceName);
    wsClientRef.current?.connect(false);
  };

  const handleDisconnect = () => {
    wsClientRef.current?.disconnect();
    setStatus('disconnected');
    setDeviceInfo(null);
  };

  const handleForgetDevice = () => {
    handleDisconnect();
    setPairedDevice(null);
    try {
      localStorage.removeItem('webmouse_paired_device');
      const updatedConfig = { ...config, token: undefined, code: '' };
      updateConfig(updatedConfig);
    } catch (e) {}
    showToast('Device forgotten');
  };

  // Initialize WebSocket Client once on mount
  useEffect(() => {
    const client = new WebSocketClient(
      config,
      settings.deviceName,
      {
        onStatusChange: (newStatus) => {
          setStatus(newStatus);
          if (newStatus === 'connected') {
            triggerHaptic('double', settings.vibration);
          }
        },
        onDeviceInfo: (info) => {
          setDeviceInfo(info);
          if (info && info.computerName) {
            setPairedDevice(info);
            try {
              localStorage.setItem('webmouse_paired_device', JSON.stringify(info));
            } catch (e) {}

            const updatedProfiles = upsertComputerProfile({
              name: info.computerName,
              host: config.host || 'localhost',
              port: config.port || 8765,
              pairingCode: config.code || '',
              token: config.token,
              type: info.deviceType || 'windows',
              capabilities: info.capabilities,
            });
            setProfiles(Array.isArray(updatedProfiles) ? updatedProfiles : []);

            const dev = deviceManager.addDevice({
              name: info.computerName,
              type: info.deviceType || 'windows',
              host: config.host || 'localhost',
              port: config.port || 8765,
              pairingCode: config.code || '',
              token: config.token,
              capabilities: info.capabilities,
            });
            setActiveDevice(dev);
            setActiveProfileId(dev.id);
            setDevices(deviceManager.getDevices());
          }
        },
        onLatency: (ms) => {
          setLatencyMs(ms);
        },
        onIncomingMessage: (message) => {
          setLastIncomingMessage(message);

          if (message.type === 'clipboard_data' && message.text) {
            copyToClipboard(message.text);
            showToast('Copied text from computer to phone clipboard');
          } else if (message.type === 'screenshot_result') {
            setIsScreenshotLoading(false);
            if (message.success && message.data) {
              setScreenshotData({
                image: message.data,
                filename: message.filename || 'pc_screenshot.png',
                timestamp: Date.now(),
              });
            } else {
              setScreenshotData({
                error: message.error || 'Failed to capture screen',
                timestamp: Date.now(),
              });
            }
          }
        },
        onLog: (entry) => {
          setLogs((prev) => [...prev.slice(-99), entry]);
        },
      }
    );

    wsClientRef.current = client;

    // Auto-connect if pairing token exists and autoReconnect enabled
    if (config.autoReconnect && (config.token || config.code)) {
      client.connect(true);
    }

    return () => {
      client.disconnect();
    };
  }, []);

  const handleNavigate = (
    area: PrimaryArea,
    controlMode?: ControlMode
  ) => {
    if (controlMode) {
      setControlInitialMode(controlMode);
    }
    setCurrentArea(area);
    setAutoStartVoice(false);
  };

  const handleTriggerVoice = () => {
    setAutoStartVoice(true);
    setCurrentArea('ai');
  };

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
    <AppShell
      currentArea={currentArea}
      onNavigate={(area) => handleNavigate(area)}
      status={status}
      deviceInfo={deviceInfo}
      activeDevice={activeDevice}
      latencyMs={latencyMs}
      onOpenSettings={() => setCurrentArea('settings')}
      onOpenConnectionModal={() => openConnectionModal('normal')}
      onDisconnect={handleDisconnect}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-full shadow-lg shadow-indigo-600/30 animate-in fade-in slide-in-from-top-4 flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Incoming File Requests Overlay */}
      <div className="absolute top-4 left-0 right-0 z-40 px-4 flex flex-col gap-2 pointer-events-none max-w-md mx-auto">
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

      {/* Primary Area Renderers */}
      {currentArea === 'home' && (
        <HomeView
          status={status}
          deviceInfo={deviceInfo}
          activeDevice={activeDevice}
          latencyMs={latencyMs}
          onNavigate={(area, mode) => handleNavigate(area, mode)}
          onOpenDeviceSelector={() => setIsProfilesModalOpen(true)}
          onOpenAddDevice={() => openConnectionModal('scanner')}
          onTriggerVoice={handleTriggerVoice}
        />
      )}

      {currentArea === 'control' && (
        <ControlView
          initialMode={controlInitialMode}
          activeDevice={activeDevice}
          devices={devices}
          isConnected={status === 'connected'}
          settings={settings}
          onUpdateSettings={updateSettings}
          onSendMessage={handleSendMessage}
          onOpenDeviceSelector={() => setIsProfilesModalOpen(true)}
          onOpenScreenshot={handleTakeScreenshot}
          lastIncomingMessage={lastIncomingMessage}
        />
      )}

      {currentArea === 'share' && (
        <ShareView
          onSendMessage={handleSendMessage}
          settings={settings}
          transfers={transfers}
          activeDevice={activeDevice}
          devices={devices}
          isConnected={status === 'connected'}
          onSelectDevice={handleSelectDevice}
          onOpenDeviceSelector={() => setIsProfilesModalOpen(true)}
          onStartUpload={startUpload}
          onCancelTransfer={cancelTransfer}
          onAcceptDownload={acceptDownload}
          onRejectDownload={rejectDownload}
          onRemoveTransfer={removeTransfer}
        />
      )}

      {currentArea === 'ai' && (
        <AIView
          devices={devices}
          activeDevice={activeDevice}
          onSendMessage={handleSendMessage}
          onSelectDevice={handleSelectDevice}
          onStartProjection={async () => {
            handleNavigate('control', 'projector');
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
            handleNavigate('share');
          }}
          vibrationEnabled={settings.vibration}
          autoStartVoice={autoStartVoice}
        />
      )}

      {currentArea === 'devices' && (
        <DevicesView
          devices={devices}
          activeDevice={activeDevice}
          status={status}
          deviceInfo={deviceInfo}
          latencyMs={latencyMs}
          onSelectDevice={handleSelectDevice}
          onNavigateToControl={(dev) => {
            handleSelectDevice(dev);
            handleNavigate('control', dev.type === 'android_tv' ? 'tv_remote' : 'mouse');
          }}
          onOpenAddDevice={() => openConnectionModal('scanner')}
          onRenameDevice={(id, newName) => {
            handleRenameProfile(id, newName);
            deviceManager.renameDevice(id, newName);
            setDevices(deviceManager.getDevices());
          }}
          onDeleteDevice={(id) => {
            handleDeleteProfile(id);
            deviceManager.removeDevice(id);
            setDevices(deviceManager.getDevices());
          }}
          onDisconnect={handleDisconnect}
          onSwitchToReceiverMode={() => {
            setAppMode('receiver');
            try {
              localStorage.setItem('webmouse_app_mode', 'receiver');
            } catch (e) {}
          }}
        />
      )}

      {currentArea === 'settings' && (
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

      {/* Connection Modal (QR Scanner / Manual PIN / Download Helper) */}
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
    </AppShell>
  );
}
