import React from 'react';
import { 
  Home, 
  Sliders, 
  FolderUp, 
  Bot, 
  Smartphone, 
  Settings as SettingsIcon,
  MousePointer2
} from 'lucide-react';
import { TopBar } from './TopBar';
import { ConnectionStatus as ConnectionStatusType, ConnectedDeviceInfo, Device } from '../../types';

export type PrimaryArea = 'home' | 'control' | 'share' | 'ai' | 'devices' | 'settings';

interface AppShellProps {
  currentArea: PrimaryArea;
  onNavigate: (area: PrimaryArea) => void;
  status: ConnectionStatusType;
  deviceInfo: ConnectedDeviceInfo | null;
  activeDevice: Device | null;
  latencyMs?: number;
  onOpenSettings: () => void;
  onOpenConnectionModal: () => void;
  onDisconnect?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentArea,
  onNavigate,
  status,
  deviceInfo,
  activeDevice,
  latencyMs,
  onOpenSettings,
  onOpenConnectionModal,
  onDisconnect,
  children,
}) => {
  const navItems: { id: PrimaryArea; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'control', label: 'Control', icon: <Sliders className="w-5 h-5" /> },
    { id: 'share', label: 'Share', icon: <FolderUp className="w-5 h-5" /> },
    { id: 'ai', label: 'AI', icon: <Bot className="w-5 h-5" /> },
    { id: 'devices', label: 'Devices', icon: <Smartphone className="w-5 h-5" /> },
  ];

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-zinc-950 text-zinc-100 font-sans overflow-hidden select-none">
      {/* Top Bar (Unified for both Desktop & Mobile) */}
      <TopBar
        status={status}
        deviceInfo={deviceInfo}
        activeDevice={activeDevice}
        latencyMs={latencyMs}
        onOpenSettings={onOpenSettings}
        onOpenConnectionModal={onOpenConnectionModal}
        onDisconnect={onDisconnect}
      />

      {/* Body: Desktop Left Sidebar + Central Viewport */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Sidebar (Section 3: Left sidebar structure) */}
        <aside className="hidden md:flex flex-col justify-between w-56 lg:w-64 bg-zinc-950 border-r border-zinc-800/80 p-3 lg:p-4 shrink-0">
          {/* Primary Navigation Links */}
          <nav className="space-y-1.5">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block px-3 py-1">
              Menu
            </span>
            {navItems.map((item) => {
              const isActive = currentArea === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Desktop Sidebar Bottom: Settings button */}
          <div className="pt-3 border-t border-zinc-800/80">
            <button
              onClick={onOpenSettings}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                currentArea === 'settings'
                  ? 'bg-zinc-850 text-white'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span>Settings</span>
            </button>
          </div>
        </aside>

        {/* Central Main Content Viewport */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-zinc-950">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (Section 4: 5 clean items: Home | Control | Share | AI | Devices) */}
      <nav 
        id="nav-bottom-tabs" 
        className="md:hidden h-16 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/80 px-2 flex items-center justify-around select-none shrink-0 z-30 pb-safe"
      >
        {navItems.map((item) => {
          const isActive = currentArea === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                isActive ? 'text-indigo-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${
                isActive ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30' : ''
              }`}>
                {item.icon}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
