/**
 * WebMouse V2 — Central Device Manager
 * Manages registered devices, active device, capabilities, online/offline state,
 * and seamless migration from V1 computer profiles.
 */

import { Device, DeviceType, DevicePlatform, DeviceCapability, ComputerProfile } from '../types';

const DEVICES_STORAGE_KEY = 'webmouse_universal_devices';
const ACTIVE_DEVICE_STORAGE_KEY = 'webmouse_active_device_id';
const LEGACY_PROFILES_KEY = 'webmouse_computer_profiles';

export const DEFAULT_CAPABILITIES: Record<DeviceType, DeviceCapability[]> = {
  windows: [
    'mouse',
    'keyboard',
    'media',
    'presentation',
    'file_transfer',
    'quick_share',
    'screen_sender',
    'custom_controls',
    'clipboard_sync',
  ],
  android_tv: [
    'tv_remote',
    'media',
    'screen_receiver',
    'file_transfer',
    'quick_share',
  ],
  smart_board: [
    'touch_board',
    'tv_remote',
    'presentation',
    'screen_receiver',
    'media',
    'file_transfer',
  ],
  tablet: [
    'mouse',
    'keyboard',
    'media',
    'file_transfer',
    'quick_share',
    'screen_receiver',
  ],
  android: [
    'media',
    'file_transfer',
    'quick_share',
    'screen_receiver',
  ],
  generic: [
    'media',
    'quick_share',
  ],
};

type DeviceListener = (devices: Device[], activeDevice: Device | null) => void;

class DeviceManagerClass {
  private devices: Device[] = [];
  private activeDeviceId: string | null = null;
  private listeners: Set<DeviceListener> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    this.devices = this.loadDevices();
    this.activeDeviceId = this.loadActiveDeviceId();

    // If activeDeviceId doesn't exist among devices, pick the first one
    if (this.devices.length > 0 && (!this.activeDeviceId || !this.devices.some(d => d.id === this.activeDeviceId))) {
      this.activeDeviceId = this.devices[0].id;
      this.persistActiveDeviceId();
    }
  }

  private loadDevices(): Device[] {
    try {
      const raw = localStorage.getItem(DEVICES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(this.normalizeDevice);
        }
      }
    } catch (e) {
      console.error('[DeviceManager] Error loading devices:', e);
    }

    // Auto-migration from V1 Computer Profiles
    return this.migrateFromLegacyProfiles();
  }

  private normalizeDevice(raw: any): Device {
    const type: DeviceType = raw.type || 'windows';
    const platform: DevicePlatform = raw.platform || (type === 'windows' ? 'windows' : 'android');
    const capabilities = Array.isArray(raw.capabilities) && raw.capabilities.length > 0
      ? raw.capabilities
      : DEFAULT_CAPABILITIES[type] || DEFAULT_CAPABILITIES.windows;

    return {
      id: raw.id || 'dev_' + Math.random().toString(36).substring(2, 9),
      name: raw.name || 'Device',
      type,
      platform,
      connectionState: raw.connectionState || 'disconnected',
      capabilities,
      lastSeen: raw.lastSeen || Date.now(),
      paired: raw.paired !== undefined ? Boolean(raw.paired) : true,
      host: raw.host || '',
      port: raw.port || 8765,
      token: raw.token,
      pairingCode: raw.pairingCode,
      model: raw.model,
      osVersion: raw.osVersion,
      screenWidth: raw.screenWidth,
      screenHeight: raw.screenHeight,
    };
  }

  private migrateFromLegacyProfiles(): Device[] {
    try {
      const rawProfiles = localStorage.getItem(LEGACY_PROFILES_KEY);
      if (rawProfiles) {
        const profiles: ComputerProfile[] = JSON.parse(rawProfiles);
        if (Array.isArray(profiles) && profiles.length > 0) {
          const migrated: Device[] = profiles.map((p) => ({
            id: p.id,
            name: p.name,
            type: p.type || 'windows',
            platform: p.platform || 'windows',
            connectionState: p.status === 'connected' ? 'connected' : 'disconnected',
            capabilities: p.capabilities || DEFAULT_CAPABILITIES.windows,
            lastSeen: p.lastConnected || Date.now(),
            paired: true,
            host: p.host || '',
            port: p.port || 8765,
            token: p.token,
            pairingCode: p.pairingCode,
          }));
          this.persistDevices(migrated);
          return migrated;
        }
      }

      // Check paired device in localStorage
      const savedPaired = localStorage.getItem('webmouse_paired_device');
      const savedConfig = localStorage.getItem('webmouse_config');
      if (savedPaired || savedConfig) {
        const paired = savedPaired ? JSON.parse(savedPaired) : null;
        const config = savedConfig ? JSON.parse(savedConfig) : null;
        const host = paired?.ip || config?.host || '';
        if (host) {
          const defaultDev: Device = {
            id: 'dev_default_pc',
            name: paired?.computerName || config?.lastComputerName || 'My Windows PC',
            type: 'windows',
            platform: 'windows',
            connectionState: 'disconnected',
            capabilities: DEFAULT_CAPABILITIES.windows,
            lastSeen: Date.now(),
            paired: true,
            host,
            port: paired?.port || config?.port || 8765,
            token: config?.token,
            pairingCode: config?.code,
          };
          this.persistDevices([defaultDev]);
          return [defaultDev];
        }
      }
    } catch (e) {
      console.error('[DeviceManager] Error during migration:', e);
    }

    // Default starter device (Windows PC)
    const starterDevice: Device = {
      id: 'default_windows_pc',
      name: 'My Windows PC',
      type: 'windows',
      platform: 'windows',
      connectionState: 'disconnected',
      capabilities: DEFAULT_CAPABILITIES.windows,
      lastSeen: Date.now(),
      paired: false,
      host: '',
      port: 8765,
    };
    this.persistDevices([starterDevice]);
    return [starterDevice];
  }

  private persistDevices(devs = this.devices) {
    try {
      localStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(devs));
      // Sync legacy profiles key for seamless backwards compatibility
      const legacyProfiles: ComputerProfile[] = devs.map(d => ({
        id: d.id,
        name: d.name,
        host: d.host,
        port: d.port,
        token: d.token,
        pairingCode: d.pairingCode,
        lastConnected: d.lastSeen,
        status: d.connectionState === 'connected' ? 'connected' : 'offline',
        type: d.type,
        platform: d.platform,
        capabilities: d.capabilities,
      }));
      localStorage.setItem(LEGACY_PROFILES_KEY, JSON.stringify(legacyProfiles));
    } catch (e) {
      console.error('[DeviceManager] Error persisting devices:', e);
    }
  }

  private loadActiveDeviceId(): string | null {
    try {
      return localStorage.getItem(ACTIVE_DEVICE_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private persistActiveDeviceId() {
    try {
      if (this.activeDeviceId) {
        localStorage.setItem(ACTIVE_DEVICE_STORAGE_KEY, this.activeDeviceId);
      } else {
        localStorage.removeItem(ACTIVE_DEVICE_STORAGE_KEY);
      }
    } catch (e) {
      console.error('[DeviceManager] Error persisting active device id:', e);
    }
  }

  private notify() {
    const active = this.getActiveDevice();
    for (const listener of this.listeners) {
      try {
        listener([...this.devices], active);
      } catch (err) {
        console.error('[DeviceManager] Error in listener:', err);
      }
    }
  }

  public subscribe(listener: DeviceListener): () => void {
    this.listeners.add(listener);
    listener([...this.devices], this.getActiveDevice());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getDevices(): Device[] {
    return [...this.devices];
  }

  public getDeviceById(id: string): Device | undefined {
    return this.devices.find(d => d.id === id);
  }

  public getActiveDevice(): Device | null {
    if (!this.activeDeviceId) return this.devices[0] || null;
    return this.devices.find(d => d.id === this.activeDeviceId) || this.devices[0] || null;
  }

  public setActiveDevice(id: string): Device | null {
    const dev = this.devices.find(d => d.id === id);
    if (dev) {
      this.activeDeviceId = id;
      this.persistActiveDeviceId();
      this.notify();
      return dev;
    }
    return null;
  }

  public addDevice(newDevice: Partial<Device> & { name: string; host: string }): Device {
    // Avoid duplicate device by host/port
    const existingIndex = this.devices.findIndex(
      d => (newDevice.id && d.id === newDevice.id) ||
           (d.host && newDevice.host && d.host.toLowerCase() === newDevice.host.toLowerCase() && d.port === (newDevice.port || 8765))
    );

    const type: DeviceType = newDevice.type || 'windows';
    const capabilities = newDevice.capabilities && newDevice.capabilities.length > 0
      ? newDevice.capabilities
      : DEFAULT_CAPABILITIES[type] || DEFAULT_CAPABILITIES.windows;

    let device: Device;
    if (existingIndex >= 0) {
      device = {
        ...this.devices[existingIndex],
        ...newDevice,
        capabilities,
        lastSeen: Date.now(),
      };
      this.devices[existingIndex] = device;
    } else {
      device = {
        id: newDevice.id || 'dev_' + Math.random().toString(36).substring(2, 9),
        name: newDevice.name,
        type,
        platform: newDevice.platform || (type === 'windows' ? 'windows' : 'android'),
        connectionState: newDevice.connectionState || 'disconnected',
        capabilities,
        lastSeen: Date.now(),
        paired: true,
        host: newDevice.host,
        port: newDevice.port || 8765,
        token: newDevice.token,
        pairingCode: newDevice.pairingCode,
        model: newDevice.model,
        osVersion: newDevice.osVersion,
      };
      this.devices.push(device);
    }

    this.activeDeviceId = device.id;
    this.persistActiveDeviceId();
    this.persistDevices();
    this.notify();
    return device;
  }

  public updateDevice(id: string, updates: Partial<Device>): Device | null {
    const idx = this.devices.findIndex(d => d.id === id);
    if (idx < 0) return null;

    const updated: Device = {
      ...this.devices[idx],
      ...updates,
      lastSeen: updates.connectionState === 'connected' ? Date.now() : this.devices[idx].lastSeen,
    };

    this.devices[idx] = updated;
    this.persistDevices();
    this.notify();
    return updated;
  }

  public removeDevice(id: string): boolean {
    const prevLen = this.devices.length;
    this.devices = this.devices.filter(d => d.id !== id);
    if (this.devices.length === prevLen) return false;

    if (this.activeDeviceId === id) {
      this.activeDeviceId = this.devices.length > 0 ? this.devices[0].id : null;
      this.persistActiveDeviceId();
    }

    this.persistDevices();
    this.notify();
    return true;
  }

  public hasCapability(device: Device | null, cap: DeviceCapability): boolean {
    if (!device) return false;
    return device.capabilities.includes(cap);
  }
}

export const deviceManager = new DeviceManagerClass();
