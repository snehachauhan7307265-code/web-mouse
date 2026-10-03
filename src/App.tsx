import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppShell, PrimaryArea } from './components/layout/AppShell';
import { HomeView } from './components/views/HomeView';
import { ControlView, ControlMode } from './components/views/ControlView';
import { ShareView } from './components/views/ShareView';
import { AIView } from './components/views/AIView';
import { DevicesView } from './components/views/DevicesView';
import { SettingsTab } from './components/SettingsTab';
import { PairQRModal } from './components/connection/PairQRModal';
import { ConnectionDiagnosticsModal } from './components/diagnostics/ConnectionDiagnosticsModal';
import { ScreenshotModal } from './components/ScreenshotModal';
import { 
  AppSettings, 
  ConnectionConfig, 
  ConnectionStatus, 
  ConnectedDeviceInfo, 
  Device,
  OutgoingMessage,
  LogEntry,
  ConnectionState,
  TrustedDevice
} from './types';
import { connectionManager } from './services/connectionManager';
import { 
  getTrustedDevices, 
  removeTrustedDevice, 
  renameTrustedDevice, 
  getLastConnectedDeviceId 
} from './services/deviceStore';
import { useFileTransfer } from './hooks/useFileTransfer';

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

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('webmouse_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Navigation state
  const [currentArea, setCurrentArea] = useState<PrimaryArea>('home');
  const [controlInitialMode, setControlInitialMode] = useState<ControlMode>('mouse');

  // Connection & Trusted Devices State
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [activeTrustedDevice, setActiveTrustedDevice] = useState<TrustedDevice | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Modals
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [isScreenshotModalOpen, setIsScreenshotModalOpen] = useState(false);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [isScreenshotLoading, setIsScreenshotLoading] = useState(false);
  const [incomingMessage, setIncomingMessage] = useState<any>(null);

  // Convert for compatibility with legacy view props
  const mapConnectionStateToStatus = (state: ConnectionState): ConnectionStatus => {
    switch (state) {
      case 'CONNECTED': return 'connected';
      case 'CONNECTING':
      case 'PAIRING': return 'connecting';
      case 'RECONNECTING': return 'reconnecting';
      case 'ERROR': return 'error';
      case 'OFFLINE':
      case 'DISCONNECTED':
      default: return 'disconnected';
    }
  };

  const isConnected = connectionState === 'CONNECTED';
  const legacyStatus = mapConnectionStateToStatus(connectionState);

  const activeDeviceObject: Device | null = activeTrustedDevice ? {
    id: activeTrustedDevice.deviceId,
    name: activeTrustedDevice.deviceName,
    type: 'windows',
    platform: 'windows',
    connectionState: isConnected ? 'connected' : 'disconnected',
    capabilities: ['mouse', 'keyboard', 'media', 'presentation', 'custom_controls'],
    paired: true,
    host: activeTrustedDevice.host,
    port: activeTrustedDevice.port,
    token: activeTrustedDevice.credential,
    lastSeen: activeTrustedDevice.lastConnectedAt || activeTrustedDevice.pairedAt,
  } : null;

  const handleSendMessage = (msg: OutgoingMessage | any) => {
    if (msg.type === 'mouse_move') {
      connectionManager.sendMouseMove(msg.dx, msg.dy);
    } else if (msg.type === 'mouse_click') {
      connectionManager.sendMouseClick(msg.button);
    } else if (msg.type === 'mouse_down') {
      connectionManager.sendMouseDown(msg.button);
    } else if (msg.type === 'mouse_up') {
      connectionManager.sendMouseUp(msg.button);
    } else if (msg.type === 'mouse_scroll') {
      connectionManager.sendMouseScroll(msg.dx || 0, msg.dy || 0);
    } else {
      connectionManager.sendMessage(msg);
    }
  };

  // File transfers hook
  const {
    transfers,
    startUpload,
    cancelTransfer,
    acceptDownload,
    rejectDownload,
    removeTransfer,
  } = useFileTransfer(
    handleSendMessage,
    incomingMessage,
    activeDeviceObject,
    isConnected,
    settings.deviceName,
    () => {},
    settings.vibration
  );

  // Subscribe to connectionManager
  useEffect(() => {
    refreshDevicesList();

    const unsubState = connectionManager.onStateChange((state, msg) => {
      setConnectionState(state);
      if (msg) {
        addLog('system', msg);
      }
    });

    const unsubDevice = connectionManager.onDeviceChange((device) => {
      setActiveTrustedDevice(device);
      refreshDevicesList();
    });

    const unsubMessage = connectionManager.onMessage((data) => {
      setIncomingMessage(data);
      if (data.type === 'screenshot_response' && data.image) {
        setScreenshotData(data.image);
        setIsScreenshotLoading(false);
      }
    });

    return () => {
      unsubState();
      unsubDevice();
      unsubMessage();
    };
  }, []);

  const addLog = (type: 'tx' | 'rx' | 'system', message: string) => {
    setLogs((prev) => [
      { id: Date.now().toString() + Math.random(), type, message, timestamp: Date.now() },
      ...prev.slice(0, 49),
    ]);
  };

  const refreshDevicesList = () => {
    const list = getTrustedDevices();
    setTrustedDevices(list);

    if (!connectionManager.getCurrentDevice()) {
      const lastId = getLastConnectedDeviceId();
      const lastDev = list.find((d) => d.deviceId === lastId) || list[0] || null;
      if (lastDev) {
        setActiveTrustedDevice(lastDev);
      }
    }
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('webmouse_settings', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleConnectDevice = (device: TrustedDevice) => {
    setActiveTrustedDevice(device);
    connectionManager.connectTrusted(device);
  };

  const handleDisconnect = () => {
    connectionManager.disconnect();
  };

  const handleRenameDevice = (deviceId: string, newName: string) => {
    renameTrustedDevice(deviceId, newName);
    refreshDevicesList();
  };

  const handleForgetDevice = (deviceId: string) => {
    if (activeTrustedDevice?.deviceId === deviceId) {
      connectionManager.disconnect();
      setActiveTrustedDevice(null);
    }
    removeTrustedDevice(deviceId);
    refreshDevicesList();
  };

  const handleTakeScreenshot = () => {
    setIsScreenshotModalOpen(true);
    setIsScreenshotLoading(true);
    setScreenshotData(null);
    connectionManager.sendMessage({ type: 'screenshot_request' });
  };

  const devicesList: Device[] = trustedDevices.map((d) => ({
    id: d.deviceId,
    name: d.deviceName,
    type: 'windows',
    platform: 'windows',
    connectionState: activeTrustedDevice?.deviceId === d.deviceId && isConnected ? 'connected' : 'disconnected',
    capabilities: ['mouse', 'keyboard', 'media', 'presentation', 'custom_controls'],
    paired: true,
    host: d.host,
    port: d.port,
    token: d.credential,
    lastSeen: d.lastConnectedAt || d.pairedAt,
  }));

  const deviceInfo: ConnectedDeviceInfo | null = activeTrustedDevice ? {
    computerName: activeTrustedDevice.deviceName,
    ip: activeTrustedDevice.host,
    port: activeTrustedDevice.port,
    deviceType: 'windows',
    platform: 'windows',
    capabilities: ['mouse', 'keyboard', 'media', 'presentation', 'custom_controls'],
  } : null;

  const dummyConfig: ConnectionConfig = {
    host: activeTrustedDevice?.host || '',
    port: activeTrustedDevice?.port || 8765,
    code: '',
    autoReconnect: true,
  };

  return (
    <AppShell
      currentArea={currentArea}
      onNavigate={(area) => setCurrentArea(area)}
      status={legacyStatus}
      deviceInfo={deviceInfo}
      activeDevice={activeDeviceObject}
      latencyMs={isConnected ? 4 : undefined}
      onOpenSettings={() => setCurrentArea('settings')}
      onOpenConnectionModal={() => setIsPairModalOpen(true)}
      onDisconnect={handleDisconnect}
    >
      {/* 1. HOME AREA */}
      {currentArea === 'home' && (
        <HomeView
          trustedDevices={trustedDevices}
          activeTrustedDevice={activeTrustedDevice}
          connectionState={connectionState}
          onConnectDevice={handleConnectDevice}
          onDisconnectDevice={handleDisconnect}
          onRenameDevice={handleRenameDevice}
          onForgetDevice={handleForgetDevice}
          onOpenPairModal={() => setIsPairModalOpen(true)}
          onNavigate={(tab, mode) => {
            if (tab === 'control' && mode) {
              setControlInitialMode(mode);
            }
            setCurrentArea(tab);
          }}
          onTriggerVoice={() => setCurrentArea('ai')}
        />
      )}

      {/* 2. CONTROL AREA (Mouse, Keyboard, Media, Presentation, Custom, TV Remote, Projector) */}
      {currentArea === 'control' && (
        <ControlView
          initialMode={controlInitialMode}
          activeDevice={activeDeviceObject}
          devices={devicesList}
          isConnected={isConnected}
          settings={settings}
          onUpdateSettings={updateSettings}
          onSendMessage={handleSendMessage}
          onOpenDeviceSelector={() => setCurrentArea('devices')}
          onOpenConnectionModal={() => setIsPairModalOpen(true)}
          onOpenScreenshot={handleTakeScreenshot}
        />
      )}

      {/* 3. SHARE AREA (File Transfers & Clipboard Sync) */}
      {currentArea === 'share' && (
        <ShareView
          onSendMessage={handleSendMessage}
          settings={settings}
          transfers={transfers}
          activeDevice={activeDeviceObject}
          devices={devicesList}
          isConnected={isConnected}
          onSelectDevice={(dev) => {
            const td = trustedDevices.find((d) => d.deviceId === dev.id);
            if (td) handleConnectDevice(td);
          }}
          onOpenDeviceSelector={() => setCurrentArea('devices')}
          onStartUpload={startUpload}
          onCancelTransfer={cancelTransfer}
          onAcceptDownload={acceptDownload}
          onRejectDownload={rejectDownload}
          onRemoveTransfer={removeTransfer}
        />
      )}

      {/* 4. AI AREA */}
      {currentArea === 'ai' && (
        <AIView
          isConnected={isConnected}
          activeDevice={activeDeviceObject}
          devices={devicesList}
          onSendMessage={handleSendMessage}
          onNavigateToControl={(mode) => {
            setControlInitialMode(mode);
            setCurrentArea('control');
          }}
          onOpenConnectionModal={() => setIsPairModalOpen(true)}
          vibrationEnabled={settings.vibration}
        />
      )}

      {/* 5. DEVICES AREA */}
      {currentArea === 'devices' && (
        <DevicesView
          devices={devicesList}
          activeDevice={activeDeviceObject}
          status={legacyStatus}
          deviceInfo={deviceInfo}
          onSelectDevice={(dev) => {
            const td = trustedDevices.find((d) => d.deviceId === dev.id);
            if (td) handleConnectDevice(td);
          }}
          onNavigateToControl={(dev) => {
            const td = trustedDevices.find((d) => d.deviceId === dev.id);
            if (td && (!isConnected || activeTrustedDevice?.deviceId !== td.deviceId)) {
              handleConnectDevice(td);
            }
            setCurrentArea('control');
          }}
          onOpenAddDevice={() => setIsPairModalOpen(true)}
          onRenameDevice={handleRenameDevice}
          onDeleteDevice={handleForgetDevice}
          onDisconnect={handleDisconnect}
        />
      )}

      {/* 6. SETTINGS AREA */}
      {currentArea === 'settings' && (
        <SettingsTab
          settings={settings}
          onUpdateSettings={updateSettings}
          config={dummyConfig}
          onUpdateConfig={() => {}}
          logs={logs}
          onClearLogs={() => setLogs([])}
          onOpenHelperGuide={() => setIsPairModalOpen(true)}
        />
      )}

      {/* PAIR QR MODAL (ZERO-BASED NEW CONNECTION SYSTEM) */}
      <PairQRModal
        isOpen={isPairModalOpen}
        onClose={() => setIsPairModalOpen(false)}
        onPairSuccess={() => {
          refreshDevicesList();
        }}
      />

      {/* SCREENSHOT MODAL */}
      <ScreenshotModal
        isOpen={isScreenshotModalOpen}
        onClose={() => setIsScreenshotModalOpen(false)}
        screenshotData={screenshotData}
        isLoading={isScreenshotLoading}
      />
    </AppShell>
  );
}
