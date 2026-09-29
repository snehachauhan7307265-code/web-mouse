import React, { useState } from 'react';
import { 
  MousePointer, 
  Keyboard as KeyboardIcon, 
  Disc, 
  Presentation, 
  Tv, 
  Cast, 
  ChevronDown,
  Laptop,
  Monitor,
  Tablet,
  Sliders
} from 'lucide-react';
import { Device, DeviceType, OutgoingMessage, AppSettings } from '../../types';
import { Touchpad } from '../Touchpad';
import { KeyboardTab } from '../KeyboardTab';
import { MediaTab } from '../MediaTab';
import { TvRemoteTab } from '../TvRemoteTab';
import { ProjectorPanel } from '../projector/ProjectorPanel';
import { CustomControlsTab } from '../CustomControlsTab';

export type ControlMode = 'mouse' | 'keyboard' | 'media' | 'presentation' | 'tv_remote' | 'projector' | 'custom';

interface ControlViewProps {
  initialMode?: ControlMode;
  activeDevice: Device | null;
  devices: Device[];
  isConnected: boolean;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onSendMessage: (msg: OutgoingMessage) => void;
  onOpenDeviceSelector: () => void;
  onOpenScreenshot?: () => void;
  lastIncomingMessage?: any;
}

export const ControlView: React.FC<ControlViewProps> = ({
  initialMode = 'mouse',
  activeDevice,
  devices,
  isConnected,
  settings,
  onUpdateSettings,
  onSendMessage,
  onOpenDeviceSelector,
  onOpenScreenshot,
  lastIncomingMessage,
}) => {
  const [mode, setMode] = useState<ControlMode>(() => {
    if (activeDevice?.type === 'android_tv') return 'tv_remote';
    return initialMode;
  });

  const deviceName = activeDevice?.name || 'My Laptop';
  const deviceType: DeviceType = activeDevice?.type || 'windows';

  const renderDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'android_tv': return <Tv className="w-3.5 h-3.5 text-amber-400" />;
      case 'smart_board': return <Monitor className="w-3.5 h-3.5 text-purple-400" />;
      case 'tablet': return <Tablet className="w-3.5 h-3.5 text-cyan-400" />;
      case 'windows':
      default:
        return <Laptop className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  const tabs: { id: ControlMode; label: string; icon: React.ReactNode }[] = [
    { id: 'mouse', label: 'Mouse', icon: <MousePointer className="w-4 h-4" /> },
    { id: 'keyboard', label: 'Keyboard', icon: <KeyboardIcon className="w-4 h-4" /> },
    { id: 'custom', label: 'Custom', icon: <Sliders className="w-4 h-4 text-amber-400" /> },
    { id: 'media', label: 'Media', icon: <Disc className="w-4 h-4" /> },
    { id: 'presentation', label: 'Presentation', icon: <Presentation className="w-4 h-4" /> },
    { id: 'tv_remote', label: 'TV Remote', icon: <Tv className="w-4 h-4" /> },
    { id: 'projector', label: 'Project', icon: <Cast className="w-4 h-4" /> },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden select-none">
      {/* Control Page Header & Device Selector */}
      <div className="px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/40 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-4">
          <h1 className="text-base font-bold text-white tracking-tight">CONTROL</h1>
          
          {/* Connected Device Selector [ My Laptop ▼ ] */}
          <button
            onClick={onOpenDeviceSelector}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-semibold text-zinc-200 transition-all active:scale-95 shadow-sm"
          >
            {renderDeviceIcon(deviceType)}
            <span className="truncate max-w-[130px]">{deviceName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          </button>
        </div>

        {/* Sub-mode Segmented Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = mode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Mode Viewport */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {mode === 'mouse' && (
          <Touchpad
            onSendMessage={onSendMessage}
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            isConnected={isConnected}
          />
        )}

        {mode === 'keyboard' && (
          <KeyboardTab
            onSendMessage={onSendMessage}
            settings={settings}
          />
        )}

        {mode === 'custom' && (
          <CustomControlsTab
            onSendMessage={onSendMessage}
            settings={settings}
            onOpenScreenshot={onOpenScreenshot}
          />
        )}

        {mode === 'media' && (
          <MediaTab
            onSendMessage={onSendMessage}
            settings={settings}
          />
        )}

        {mode === 'presentation' && (
          <MediaTab
            onSendMessage={onSendMessage}
            settings={settings}
          />
        )}

        {mode === 'tv_remote' && (
          <TvRemoteTab
            device={activeDevice}
            isConnected={isConnected}
            onSendMessage={onSendMessage}
            vibrationEnabled={settings.vibration}
          />
        )}

        {mode === 'projector' && (
          <ProjectorPanel
            devices={devices}
            activeDevice={activeDevice}
            onSendMessage={onSendMessage}
            lastIncomingMessage={lastIncomingMessage}
            vibrationEnabled={settings.vibration}
          />
        )}
      </div>
    </div>
  );
};
