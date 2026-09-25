/**
 * WebMouse V2 — Discovery Foundation
 * Provides QR Code parsing, direct connection URI handling,
 * and local subnet discovery architecture.
 */

import { Device, DeviceType, DeviceCapability } from '../types';
import { DEFAULT_CAPABILITIES } from './deviceManager';

export interface DiscoveredDevice {
  name: string;
  type: DeviceType;
  host: string;
  port: number;
  pairingCode?: string;
  token?: string;
  capabilities: DeviceCapability[];
}

/**
 * Parses raw QR Code scan data or connection string into structured device info
 */
export function parseConnectionData(raw: string): DiscoveredDevice | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // 1. Try parsing JSON format
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const data = JSON.parse(trimmed);
      const host = data.ip || data.host || data.server_ip || (data.receiverId ? 'receiver_local' : '');
      const port = Number(data.port) || 8765;
      const type: DeviceType = data.type || (data.deviceType as DeviceType) || 'windows';
      const name = data.name || data.computerName || data.device_name || (type === 'android_tv' ? 'Living Room TV' : type === 'smart_board' ? 'Classroom Board' : 'Windows PC');

      if (host) {
        return {
          name,
          type,
          host,
          port,
          pairingCode: data.code || data.pin || data.pairingCode || '',
          token: data.token || data.qrToken || '',
          capabilities: Array.isArray(data.capabilities) ? data.capabilities : DEFAULT_CAPABILITIES[type] || DEFAULT_CAPABILITIES.windows,
        };
      }
    } catch {
      // Fall through to other formats
    }
  }

  // 2. Try URI format: webmouse://host:port?code=...&type=...
  if (trimmed.startsWith('webmouse://')) {
    try {
      const parsedUrl = new URL(trimmed.replace('webmouse://', 'http://'));
      const host = parsedUrl.hostname;
      const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 8765;
      const code = parsedUrl.searchParams.get('code') || '';
      const token = parsedUrl.searchParams.get('token') || '';
      const type = (parsedUrl.searchParams.get('type') as DeviceType) || 'windows';
      const name = parsedUrl.searchParams.get('name') || (type === 'android_tv' ? 'Android TV' : 'Windows PC');

      return {
        name,
        type,
        host,
        port,
        pairingCode: code,
        token,
        capabilities: DEFAULT_CAPABILITIES[type] || DEFAULT_CAPABILITIES.windows,
      };
    } catch {
      // Fall through
    }
  }

  // 3. Delimited format: host:port:code or host:port
  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    const host = parts[0].trim();
    const port = parseInt(parts[1], 10) || 8765;
    const code = parts[2] ? parts[2].trim() : '';

    return {
      name: 'Windows PC',
      type: 'windows',
      host,
      port,
      pairingCode: code,
      capabilities: DEFAULT_CAPABILITIES.windows,
    };
  }

  return null;
}

/**
 * Local Subnet Discovery Foundation
 * Prepares the architectural interface for probing local devices on the LAN.
 */
export class LocalDiscoveryService {
  private isScanning = false;

  public async probeDevice(host: string, port = 8765, timeoutMs = 1500): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false;
      const wsUrl = `ws://${host}:${port}`;
      try {
        const testWs = new WebSocket(wsUrl);
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            try { testWs.close(); } catch {}
            resolve(false);
          }
        }, timeoutMs);

        testWs.onopen = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            try { testWs.close(); } catch {}
            resolve(true);
          }
        };

        testWs.onerror = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            resolve(false);
          }
        };
      } catch {
        resolve(false);
      }
    });
  }

  public getIsScanning() {
    return this.isScanning;
  }
}

export const localDiscovery = new LocalDiscoveryService();
