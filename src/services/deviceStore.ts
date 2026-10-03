import { TrustedDevice } from '../types';

const STORAGE_KEY_TRUSTED_DEVICES = 'webmouse_trusted_devices';
const STORAGE_KEY_PHONE_ID = 'webmouse_phone_device_id';
const STORAGE_KEY_LAST_DEVICE_ID = 'webmouse_last_device_id';

/**
 * Returns the permanent unique client ID for this phone.
 */
export function getPhoneDeviceId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY_PHONE_ID);
    if (!id) {
      id = 'phone-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 12) + Date.now().toString(36));
      localStorage.setItem(STORAGE_KEY_PHONE_ID, id);
    }
    return id;
  } catch {
    return 'phone-local-client';
  }
}

/**
 * Retrieve all trusted devices stored locally on this phone.
 */
export function getTrustedDevices(): TrustedDevice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRUSTED_DEVICES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((d) => d && d.deviceId && d.isTrusted);
    }
    return [];
  } catch (e) {
    console.error('[DeviceStore] Failed to load trusted devices', e);
    return [];
  }
}

/**
 * Get a specific trusted device by ID.
 */
export function getTrustedDevice(deviceId: string): TrustedDevice | null {
  const devices = getTrustedDevices();
  return devices.find((d) => d.deviceId === deviceId) || null;
}

/**
 * Save or update a trusted device.
 */
export function saveTrustedDevice(device: TrustedDevice): void {
  try {
    const devices = getTrustedDevices();
    const index = devices.findIndex((d) => d.deviceId === device.deviceId);
    if (index >= 0) {
      devices[index] = { ...devices[index], ...device, isTrusted: true };
    } else {
      devices.push({ ...device, isTrusted: true });
    }
    localStorage.setItem(STORAGE_KEY_TRUSTED_DEVICES, JSON.stringify(devices));
    setLastConnectedDeviceId(device.deviceId);
  } catch (e) {
    console.error('[DeviceStore] Failed to save trusted device', e);
  }
}

/**
 * Forget/Remove a trusted device.
 */
export function removeTrustedDevice(deviceId: string): void {
  try {
    const devices = getTrustedDevices().filter((d) => d.deviceId !== deviceId);
    localStorage.setItem(STORAGE_KEY_TRUSTED_DEVICES, JSON.stringify(devices));
    if (getLastConnectedDeviceId() === deviceId) {
      localStorage.removeItem(STORAGE_KEY_LAST_DEVICE_ID);
    }
  } catch (e) {
    console.error('[DeviceStore] Failed to remove trusted device', e);
  }
}

/**
 * Rename a trusted device.
 */
export function renameTrustedDevice(deviceId: string, newName: string): void {
  try {
    const devices = getTrustedDevices();
    const target = devices.find((d) => d.deviceId === deviceId);
    if (target) {
      target.deviceName = newName.trim();
      localStorage.setItem(STORAGE_KEY_TRUSTED_DEVICES, JSON.stringify(devices));
    }
  } catch (e) {
    console.error('[DeviceStore] Failed to rename trusted device', e);
  }
}

/**
 * Get the last connected device ID.
 */
export function getLastConnectedDeviceId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_LAST_DEVICE_ID);
  } catch {
    return null;
  }
}

/**
 * Set the last connected device ID.
 */
export function setLastConnectedDeviceId(deviceId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_DEVICE_ID, deviceId);
  } catch {}
}
