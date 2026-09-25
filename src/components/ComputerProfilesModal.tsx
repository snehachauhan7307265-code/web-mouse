import React from 'react';
import { Device, DeviceType, ComputerProfile, ConnectionStatus } from '../types';
import { DeviceManagerModal } from './DeviceManagerModal';
import { DEFAULT_CAPABILITIES } from '../services/deviceManager';

interface ComputerProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: ComputerProfile[];
  activeProfileId?: string;
  currentStatus: ConnectionStatus;
  onSelectProfile: (profile: ComputerProfile) => void;
  onRenameProfile: (id: string, newName: string) => void;
  onDeleteProfile: (id: string) => void;
  onAddNewComputer: (method: 'scanner' | 'manual_pin', deviceType?: DeviceType) => void;
}

export const ComputerProfilesModal: React.FC<ComputerProfilesModalProps> = ({
  isOpen,
  onClose,
  profiles,
  activeProfileId,
  currentStatus,
  onSelectProfile,
  onRenameProfile,
  onDeleteProfile,
  onAddNewComputer,
}) => {
  // Convert ComputerProfile[] to Device[] for the unified DeviceManagerModal
  const devices: Device[] = profiles.map((p) => {
    const type: DeviceType = p.type || 'windows';
    return {
      id: p.id,
      name: p.name,
      type,
      platform: p.platform || (type === 'windows' ? 'windows' : 'android'),
      connectionState: p.status === 'connected' ? 'connected' : 'disconnected',
      capabilities: p.capabilities || DEFAULT_CAPABILITIES[type] || DEFAULT_CAPABILITIES.windows,
      lastSeen: p.lastConnected || Date.now(),
      paired: true,
      host: p.host,
      port: p.port || 8765,
      token: p.token,
      pairingCode: p.pairingCode,
    };
  });

  return (
    <DeviceManagerModal
      isOpen={isOpen}
      onClose={onClose}
      devices={devices}
      activeDeviceId={activeProfileId}
      currentStatus={currentStatus}
      onSelectDevice={(device) => {
        const found = profiles.find((p) => p.id === device.id);
        if (found) {
          onSelectProfile(found);
        } else {
          onSelectProfile({
            id: device.id,
            name: device.name,
            host: device.host,
            port: device.port,
            token: device.token,
            pairingCode: device.pairingCode,
            status: device.connectionState === 'connected' ? 'connected' : 'offline',
            type: device.type,
            platform: device.platform,
            capabilities: device.capabilities,
          });
        }
      }}
      onRenameDevice={onRenameProfile}
      onDeleteDevice={onDeleteProfile}
      onAddNewDevice={(deviceType, method) => onAddNewComputer(method, deviceType)}
    />
  );
};
