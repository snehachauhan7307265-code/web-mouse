import React from 'react';
import { 
  MousePointer2, 
  ChevronDown, 
  Settings as SettingsIcon, 
  HelpCircle, 
  Laptop, 
  Tv, 
  Monitor, 
  Tablet,
  Scan
} from 'lucide-react';
import { ConnectionStatus as ConnectionStatusType, ConnectedDeviceInfo, Device, DeviceType } from '../types';
import { ConnectionStatus } from './ConnectionStatus';

interface HeaderProps {
  status: ConnectionStatusType;
  deviceInfo: ConnectedDeviceInfo | null;
  activeDevice?: Device | null;
  latencyMs?: number;
  devicesCount?: number;
  onOpenConnectionModal: (view?: 'normal' | 'scanner' | 'qr_host' | 'manual_pin') => void;
  onOpenProfilesModal: () => void;
  onOpenSettings: () => void;
  onOpenHelperGuide: () => void;
  onSwitchToReceiverMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  deviceInfo,
  activeDevice,
  latencyMs,
  devicesCount = 1,
  onOpenConnectionModal,
  onOpenProfilesModal,
  onOpenSettings,
  onOpenHelperGuide,
  onSwitchToReceiverMode,
}) => {
  const currentDeviceName = activeDevice?.name || deviceInfo?.computerName || 'My Laptop';
  const currentDeviceType: DeviceType = activeDevice?.type || deviceInfo?.deviceType || 'windows';

  const renderDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'android_tv':
        return <Tv className="w-3.5 h-3.5 text-amber-400" />;
      case 'smart_board':
        return <Monitor className="w-3.5 h-3.5 text-purple-400" />;
      case 'tablet':
        return <Tablet className="w-3.5 h-3.5 text-cyan-400" />;
      case 'windows':
      default:
        return <Laptop className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  return (
    <header className="w-full bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 py-2.5 flex items-center justify-between select-none z-30 shrink-0">
      {/* Left: Brand title & Tagline */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
          <MousePointer2 className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 leading-none">
            <h1 className="text-sm font-bold tracking-tight text-white">WebMouse V2</h1>
          </div>
          <p className="text-[10px] text-zinc-400 mt-0.5 leading-none">
            Universal Device Control
          </p>
        </div>
      </div>

      {/* Center: Current Device / Session Switcher */}
      <div className="hidden sm:flex items-center justify-center flex-1 px-4 max-w-xs mx-auto">
        <button
          onClick={onOpenProfilesModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 text-xs text-zinc-200 transition-all hover:border-zinc-700 active:scale-95 max-w-full"
          title="Switch Active Device"
        >
          {renderDeviceIcon(currentDeviceType)}
          <span className="font-semibold truncate max-w-[120px]">{currentDeviceName}</span>
          <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
        </button>
      </div>

      {/* Right: Connection Status & Quick Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Connection Status Button */}
        <button
          id="btn-connection-status"
          onClick={() => onOpenConnectionModal('normal')}
          className="transition-transform active:scale-95"
          title="Connection details & status"
        >
          <ConnectionStatus status={status} latencyMs={latencyMs} size="sm" />
        </button>

        {/* Devices button (visible on mobile / when needed) */}
        <button
          onClick={onOpenProfilesModal}
          className="sm:hidden p-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg flex items-center gap-1 text-[11px] font-medium text-zinc-300 transition-all active:scale-95"
          title="Switch Devices"
        >
          {renderDeviceIcon(currentDeviceType)}
          <span className="font-semibold">{devicesCount}</span>
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 active:scale-95 rounded-lg transition-colors"
          title="Settings"
          aria-label="Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
