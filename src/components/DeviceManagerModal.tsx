import React, { useState } from 'react';
import { 
  X, Laptop, Plus, Check, Trash2, Edit2, RefreshCw, 
  Wifi, WifiOff, Scan, KeyRound, Monitor, Tv, Tablet,
  Sparkles, CheckCircle2, ChevronRight
} from 'lucide-react';
import { Device, DeviceType, ConnectionStatus } from '../types';
import { getDeviceTypeLabel, getDeviceTypeColor } from '../utils/profiles';

interface DeviceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
  activeDeviceId?: string;
  currentStatus: ConnectionStatus;
  onSelectDevice: (device: Device) => void;
  onRenameDevice: (id: string, newName: string) => void;
  onDeleteDevice: (id: string) => void;
  onAddNewDevice: (type: DeviceType, method: 'scanner' | 'manual_pin') => void;
}

export const DeviceManagerModal: React.FC<DeviceManagerModalProps> = ({
  isOpen,
  onClose,
  devices,
  activeDeviceId,
  currentStatus,
  onSelectDevice,
  onRenameDevice,
  onDeleteDevice,
  onAddNewDevice,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedNewType, setSelectedNewType] = useState<DeviceType>('windows');

  if (!isOpen) return null;

  const startRename = (device: Device) => {
    setEditingId(device.id);
    setEditName(device.name);
  };

  const handleSaveRename = (id: string) => {
    if (editName.trim()) {
      onRenameDevice(id, editName.trim());
    }
    setEditingId(null);
  };

  const renderDeviceIcon = (type: DeviceType, className = "w-5 h-5") => {
    switch (type) {
      case 'android_tv':
        return <Tv className={className} />;
      case 'smart_board':
        return <Monitor className={className} />;
      case 'tablet':
        return <Tablet className={className} />;
      case 'windows':
      default:
        return <Laptop className={className} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Universal Devices</h3>
              <p className="text-[11px] text-zinc-400">Windows PC, Android TV & Smart Boards</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isAddingNew ? (
            /* Add Device Flow */
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                <h4 className="text-xs font-bold text-indigo-300">Choose Device Type</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">Select the target platform to pair over Wi-Fi</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { type: 'windows' as DeviceType, label: 'Windows PC', desc: 'Touchpad, Keys, Media', icon: Laptop },
                  { type: 'android_tv' as DeviceType, label: 'Android TV', desc: 'D-Pad Remote, Media', icon: Tv },
                  { type: 'smart_board' as DeviceType, label: 'Smart Board', desc: 'Presentation & Touch', icon: Monitor },
                  { type: 'tablet' as DeviceType, label: 'Android Tablet', desc: 'Share & Remote Input', icon: Tablet },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedNewType === item.type;
                  return (
                    <button
                      key={item.type}
                      onClick={() => setSelectedNewType(item.type)}
                      className={`p-3 rounded-2xl border text-left flex flex-col items-start gap-1 transition-all ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-1 ${isSelected ? 'text-indigo-400' : 'text-zinc-400'}`} />
                      <span className="text-xs font-bold">{item.label}</span>
                      <span className="text-[10px] text-zinc-500 leading-tight">{item.desc}</span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Select Pairing Method
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setIsAddingNew(false);
                      onAddNewDevice(selectedNewType, 'scanner');
                    }}
                    className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md"
                  >
                    <Scan className="w-5 h-5" />
                    <span className="text-xs font-bold">Scan QR Code</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsAddingNew(false);
                      onAddNewDevice(selectedNewType, 'manual_pin');
                    }}
                    className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md"
                  >
                    <KeyRound className="w-5 h-5 text-indigo-400" />
                    <span className="text-xs font-bold">Manual IP & PIN</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsAddingNew(false)}
                  className="w-full py-2 text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors pt-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Devices List */
            <>
              {devices.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs">
                  No paired devices found. Add a Windows PC or Android TV below!
                </div>
              ) : (
                devices.map((device) => {
                  const isSelected = device.id === activeDeviceId;
                  const isConnected = isSelected && currentStatus === 'connected';
                  const isEditing = editingId === device.id;
                  const color = getDeviceTypeColor(device.type);

                  return (
                    <div
                      key={device.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isConnected
                          ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm shadow-emerald-950/30'
                          : isSelected
                          ? 'bg-indigo-950/20 border-indigo-500/40'
                          : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`p-2.5 rounded-xl shrink-0 ${
                              isConnected
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : isSelected
                                ? 'bg-indigo-500/20 text-indigo-400'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {renderDeviceIcon(device.type)}
                          </div>

                          <div className="min-w-0 flex-1">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 w-full"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRename(device.id);
                                    if (e.key === 'Escape') setEditingId(null);
                                  }}
                                />
                                <button
                                  onClick={() => handleSaveRename(device.id)}
                                  className="p-1 text-emerald-400 hover:bg-zinc-800 rounded-lg"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-xs text-white truncate">{device.name}</h4>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md border font-semibold ${color.badgeBg} ${color.textColor}`}>
                                  {getDeviceTypeLabel(device.type)}
                                </span>
                              </div>
                            )}

                            <p className="text-[11px] text-zinc-400 font-mono mt-0.5 truncate">
                              {device.host ? `${device.host}:${device.port || 8765}` : 'No address set'}
                            </p>

                            {/* Capability Badges */}
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              {device.capabilities.slice(0, 4).map((cap) => (
                                <span
                                  key={cap}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50"
                                >
                                  {cap.replace('_', ' ')}
                                </span>
                              ))}
                              {device.capabilities.length > 4 && (
                                <span className="text-[9px] text-zinc-500">
                                  +{device.capabilities.length - 4}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status & Menu */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {isConnected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Connected
                            </span>
                          ) : isSelected && (currentStatus === 'connecting' || currentStatus === 'reconnecting') ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              Connecting...
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-500">
                              Offline
                            </span>
                          )}

                          <div className="flex items-center gap-1">
                            {!isEditing && (
                              <button
                                onClick={() => startRename(device)}
                                className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                                title="Rename Device"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {devices.length > 1 && (
                              <button
                                onClick={() => onDeleteDevice(device.id)}
                                className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 rounded-lg transition-colors"
                                title="Forget Device"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Switch / Connect Button */}
                      {!isConnected && (
                        <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between">
                          <span className="text-[10px] text-zinc-500">
                            {device.lastSeen ? `Last active ${new Date(device.lastSeen).toLocaleDateString()}` : 'Ready to connect'}
                          </span>
                          <button
                            onClick={() => {
                              onSelectDevice(device);
                              onClose();
                            }}
                            className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                          >
                            <span>Connect</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!isAddingNew && (
          <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
            <button
              onClick={() => setIsAddingNew(true)}
              className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Device</span>
            </button>

            <button
              onClick={onClose}
              className="py-2 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
