import React from 'react';
import { Laptop, Tv, Monitor, Tablet, ChevronDown, Check } from 'lucide-react';
import { Device, DeviceType } from '../../types';
import { getDeviceTypeLabel } from '../../utils/profiles';

interface DeviceSelectorProps {
  devices: Device[];
  selectedDevice: Device | null;
  onSelectDevice: (device: Device) => void;
  disabled?: boolean;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  devices,
  selectedDevice,
  onSelectDevice,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const renderIcon = (type: DeviceType, className = 'w-4 h-4') => {
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

  // Prioritize devices with screen_receiver capability
  const eligibleDevices = devices.length > 0 ? devices : [];

  return (
    <div className="relative w-full">
      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
        Target Receiver Screen
      </label>

      <button
        type="button"
        disabled={disabled || eligibleDevices.length === 0}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-50 text-left flex items-center justify-between transition-all"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-zinc-800 text-indigo-400 shrink-0">
            {selectedDevice ? renderIcon(selectedDevice.type) : <Tv className="w-4 h-4 text-zinc-500" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate">
              {selectedDevice ? selectedDevice.name : 'Select Target Device'}
            </h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              {selectedDevice ? `${getDeviceTypeLabel(selectedDevice.type)} • Ready for WebRTC` : 'No receiver chosen'}
            </p>
          </div>
        </div>

        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-40 bg-zinc-900 border border-zinc-800 rounded-2xl p-1.5 shadow-2xl space-y-1 animate-in fade-in duration-100">
          {eligibleDevices.map((dev) => {
            const isSelected = selectedDevice?.id === dev.id;
            const hasReceiverCap = dev.capabilities?.includes('screen_receiver');

            return (
              <button
                key={dev.id}
                type="button"
                onClick={() => {
                  onSelectDevice(dev);
                  setIsOpen(false);
                }}
                className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition-colors ${
                  isSelected ? 'bg-indigo-600/20 text-white' : 'hover:bg-zinc-800 text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-zinc-800 text-indigo-400 shrink-0">
                    {renderIcon(dev.type, 'w-3.5 h-3.5')}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate">{dev.name}</span>
                      {hasReceiverCap && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                          Receiver
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono block">
                      {dev.host ? `${dev.host}:${dev.port}` : 'Local peer'}
                    </span>
                  </div>
                </div>

                {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
