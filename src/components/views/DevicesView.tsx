import React, { useState } from 'react';
import { 
  Laptop, 
  Tv, 
  Monitor, 
  Tablet, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Cast, 
  ShieldCheck,
  Power,
  RefreshCw,
  MoreVertical
} from 'lucide-react';
import { Device, DeviceType, ConnectionStatus as ConnectionStatusType, ConnectedDeviceInfo } from '../../types';
import { ConnectionStatus } from '../ConnectionStatus';

interface DevicesViewProps {
  devices: Device[];
  activeDevice: Device | null;
  status: ConnectionStatusType;
  deviceInfo: ConnectedDeviceInfo | null;
  latencyMs?: number;
  onSelectDevice: (device: Device) => void;
  onNavigateToControl: (device: Device) => void;
  onOpenAddDevice: () => void;
  onRenameDevice?: (id: string, newName: string) => void;
  onDeleteDevice?: (id: string) => void;
  onDisconnect?: () => void;
  onSwitchToReceiverMode?: () => void;
}

export const DevicesView: React.FC<DevicesViewProps> = ({
  devices,
  activeDevice,
  status,
  deviceInfo,
  latencyMs,
  onSelectDevice,
  onNavigateToControl,
  onOpenAddDevice,
  onRenameDevice,
  onDeleteDevice,
  onDisconnect,
  onSwitchToReceiverMode,
}) => {
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const renderDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'android_tv':
        return <Tv className="w-5 h-5 text-amber-400" />;
      case 'smart_board':
        return <Monitor className="w-5 h-5 text-purple-400" />;
      case 'tablet':
        return <Tablet className="w-5 h-5 text-cyan-400" />;
      case 'windows':
      default:
        return <Laptop className="w-5 h-5 text-indigo-400" />;
    }
  };

  const getDeviceSubtitle = (type: DeviceType) => {
    switch (type) {
      case 'android_tv': return 'Android TV';
      case 'smart_board': return 'Android Smart Board';
      case 'tablet': return 'Android Tablet';
      case 'windows':
      default:
        return 'Windows';
    }
  };

  const handleStartRename = (dev: Device) => {
    setEditingId(dev.id);
    setEditingName(dev.name);
  };

  const handleSaveRename = (dev: Device) => {
    if (editingName.trim() && onRenameDevice) {
      onRenameDevice(dev.id, editingName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 overflow-y-auto pb-12 select-none animate-in fade-in duration-200">
      {/* Page Header with Prominent + Add Device (Section 10 & 11) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">MY DEVICES</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Manage your connected Windows PCs, Android TVs, and Smart Boards
          </p>
        </div>

        <button
          onClick={onOpenAddDevice}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Device</span>
        </button>
      </div>

      {/* Device List (Section 10) */}
      <div className="space-y-3">
        {devices.map((dev) => {
          const isCurrentActive = activeDevice?.id === dev.id;
          const isCurrentConnected = isCurrentActive && status === 'connected';
          const isExpanded = expandedDeviceId === dev.id;

          return (
            <div
              key={dev.id}
              className={`rounded-2xl border transition-all ${
                isCurrentConnected
                  ? 'bg-zinc-900/90 border-emerald-500/40 shadow-lg'
                  : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {/* Primary Card View */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-3 rounded-xl bg-zinc-850 border border-zinc-750 shrink-0">
                    {renderDeviceIcon(dev.type)}
                  </div>

                  <div className="min-w-0">
                    {editingId === dev.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName ?? ''}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="bg-zinc-950 border border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveRename(dev)}
                          className="p-1 text-emerald-400 hover:text-emerald-300"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-zinc-500 hover:text-zinc-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white truncate">{dev.name}</h3>
                        <button
                          onClick={() => handleStartRename(dev)}
                          className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors"
                          title="Rename"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-zinc-400 font-medium">{getDeviceSubtitle(dev.type)}</span>
                      <span className="text-zinc-600">·</span>
                      {isCurrentConnected ? (
                        <span className="text-xs text-emerald-400 font-medium inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Connected</span>
                          {latencyMs !== undefined && (
                            <span className="font-mono text-[11px] text-emerald-400/80">({latencyMs} ms)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">Not connected</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions: [ Control ] [ Details ] (Section 10) */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => {
                      onSelectDevice(dev);
                      onNavigateToControl(dev);
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
                  >
                    Control
                  </button>

                  <button
                    onClick={() => setExpandedDeviceId(isExpanded ? null : dev.id)}
                    className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-medium border border-zinc-700/80 transition-all flex items-center gap-1"
                  >
                    <span>Details</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Expandable Details Section (Section 10: Device capabilities appear inside Details) */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-zinc-800/80 space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-zinc-500 block mb-1">Network Host & Port:</span>
                      <span className="font-mono text-zinc-300">{dev.host || 'Local Wi-Fi'}:{dev.port || 8765}</span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block mb-1">Paired Status:</span>
                      <span className="text-emerald-400 font-medium">Authenticated Pairing Token Stored</span>
                    </div>
                  </div>

                  {/* Capabilities inside details */}
                  <div>
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                      Device Capabilities
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(dev.capabilities || ['mouse', 'keyboard', 'media', 'presentation', 'file_transfer', 'quick_share']).map((cap) => (
                        <span
                          key={cap}
                          className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-[11px] font-medium border border-zinc-700/60"
                        >
                          {cap.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Delete / Disconnect Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                    {isCurrentConnected && onDisconnect ? (
                      <button
                        onClick={onDisconnect}
                        className="text-xs text-amber-400 hover:text-amber-300 font-medium"
                      >
                        Disconnect Device
                      </button>
                    ) : <div />}

                    {onDeleteDevice && (
                      <button
                        onClick={() => onDeleteDevice(dev.id)}
                        className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Forget Device</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Receiver Mode Switcher (Section 1) */}
      {onSwitchToReceiverMode && (
        <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-white">Receiver Mode</h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Turn this device into an Android TV or Smart Board presentation receiver
            </p>
          </div>
          <button
            onClick={onSwitchToReceiverMode}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-amber-400 border border-zinc-700/80 text-xs font-semibold transition-all active:scale-95 shrink-0 flex items-center gap-2"
          >
            <Tv className="w-4 h-4" />
            <span>Switch to Receiver</span>
          </button>
        </div>
      )}
    </div>
  );
};
