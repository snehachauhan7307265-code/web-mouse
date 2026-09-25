/**
 * WebMouse V2 — Universal Connection Manager
 * Manages WebSocket lifecycle, auto-reconnect with exponential backoff,
 * heartbeat & real ping/pong latency measurement, network recovery,
 * and capability negotiation for any target device (Windows PC, Android TV, Smart Board, Tablet).
 */

import { Device, ConnectionStatus, ConnectedDeviceInfo, OutgoingMessage, LogEntry, IncomingMessage } from '../types';
import { deviceManager } from './deviceManager';

export interface ConnectionManagerCallbacks {
  onStatusChange: (status: ConnectionStatus) => void;
  onDeviceInfo: (info: ConnectedDeviceInfo | null) => void;
  onLog: (log: LogEntry) => void;
  onLatency: (latencyMs: number) => void;
  onNotification?: (msg: string) => void;
  onClipboardData?: (text: string) => void;
  onIncomingMessage?: (msg: any) => void;
  onAuthSuccess?: (token: string, device: Device) => void;
}

export class ConnectionManager {
  private socket: WebSocket | null = null;
  private currentDevice: Device | null = null;
  private deviceName: string;
  private status: ConnectionStatus = 'disconnected';
  private callbacks: ConnectionManagerCallbacks;

  private pingInterval: any = null;
  private reconnectTimeout: any = null;
  private connectionTimeoutTimer: any = null;
  private isIntentionalDisconnect = false;
  private lastPingSent = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private networkListenerAdded = false;

  constructor(deviceName: string, callbacks: ConnectionManagerCallbacks) {
    this.deviceName = deviceName;
    this.callbacks = callbacks;
    this.setupNetworkListeners();
  }

  private setupNetworkListeners() {
    if (typeof window !== 'undefined' && !this.networkListenerAdded) {
      this.networkListenerAdded = true;
      window.addEventListener('online', () => {
        this.addLog('sys', 'Wi-Fi/Network connection restored.');
        if (this.currentDevice && !this.isIntentionalDisconnect && (this.status === 'disconnected' || this.status === 'reconnecting')) {
          this.addLog('sys', 'Attempting automatic reconnect after network recovery...');
          this.reconnectAttempts = 0;
          this.connect(this.currentDevice, true);
        }
      });

      window.addEventListener('offline', () => {
        this.addLog('err', 'Network connection lost. Device is offline.');
        if (this.status === 'connected') {
          this.setStatus('reconnecting');
        }
      });
    }
  }

  public setDeviceName(name: string) {
    this.deviceName = name;
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getCurrentDevice(): Device | null {
    return this.currentDevice;
  }

  private setStatus(newStatus: ConnectionStatus) {
    this.status = newStatus;
    this.callbacks.onStatusChange(newStatus);
    if (this.currentDevice) {
      deviceManager.updateDevice(this.currentDevice.id, { connectionState: newStatus });
    }
  }

  private addLog(type: LogEntry['type'], content: string) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.callbacks.onLog({
      id: Math.random().toString(36).substring(2, 9),
      time,
      type,
      content,
    });
  }

  public connect(device: Device, isAutoReconnect = false) {
    this.currentDevice = device;

    // Prevent duplicate WebSocket connections
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      console.log('[ConnectionManager] Existing connection active. Closing prior socket before connecting.');
      try {
        this.socket.close();
      } catch (e) {}
      this.socket = null;
    }

    if (!isAutoReconnect) {
      this.reconnectAttempts = 0;
    }

    this.isIntentionalDisconnect = false;
    this.clearTimers();

    const rawHost = (device.host || '').trim();
    const defaultPort = device.port || 8765;

    if (!rawHost) {
      this.setStatus('error');
      this.addLog('err', `No IP address configured for ${device.name}`);
      return;
    }

    let wsUrl = '';
    if (rawHost.startsWith('ws://') || rawHost.startsWith('wss://')) {
      wsUrl = rawHost;
    } else if (rawHost.startsWith('http://')) {
      wsUrl = `ws://${rawHost.slice(7)}`;
    } else if (rawHost.startsWith('https://')) {
      wsUrl = `wss://${rawHost.slice(8)}`;
    } else {
      const clean = rawHost.replace(/\/+$/, '');
      const hasPort = clean.includes(':') && !clean.includes('::');
      wsUrl = hasPort ? `ws://${clean}` : `ws://${clean}:${defaultPort}`;
    }

    this.setStatus(isAutoReconnect ? 'reconnecting' : 'connecting');
    this.addLog('sys', `Connecting to ${device.name} at ${wsUrl}...`);

    // 10s Connection timeout guard
    this.connectionTimeoutTimer = setTimeout(() => {
      if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
        this.addLog('err', `Connection to ${device.name} timed out after 10s.`);
        try {
          this.socket.close();
        } catch (e) {}
      }
    }, 10000);

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        if (this.connectionTimeoutTimer) {
          clearTimeout(this.connectionTimeoutTimer);
          this.connectionTimeoutTimer = null;
        }

        this.addLog('sys', `Socket connected to ${device.name}. Sending authentication handshake...`);
        const codeToSend = (device.pairingCode?.trim() || device.token || '').trim();
        const tokenToSend = device.token || codeToSend;

        this.send({
          type: 'auth',
          code: codeToSend,
          token: tokenToSend,
          deviceName: this.deviceName || 'WebMouse Phone',
        });
      };

      this.socket.onmessage = (event) => {
        try {
          const data: IncomingMessage = JSON.parse(event.data);
          this.handleServerMessage(data);
        } catch (e) {
          this.addLog('err', `Non-JSON payload from device: ${event.data}`);
        }
      };

      this.socket.onerror = () => {
        const errReason = `Cannot reach ${device.name} at ${wsUrl}. Verify Wi-Fi network and firewall settings.`;
        this.addLog('err', errReason);
        this.setStatus('error');
      };

      this.socket.onclose = (event) => {
        this.clearTimers();

        if (!this.isIntentionalDisconnect) {
          if (this.status !== 'auth_failed' && this.status !== 'error') {
            this.setStatus('disconnected');
          }
          if (this.status !== 'auth_failed') {
            this.callbacks.onDeviceInfo(null);
            this.addLog('sys', `Disconnected from ${device.name} (close code: ${event.code})`);

            // Automatic reconnection with exponential backoff
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts++;
              const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 6000);
              this.addLog('sys', `Auto-reconnecting to ${device.name} in ${delay / 1000}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
              this.reconnectTimeout = setTimeout(() => {
                if (this.currentDevice) {
                  this.connect(this.currentDevice, true);
                }
              }, delay);
            } else {
              this.addLog('err', `Max reconnect attempts reached for ${device.name}.`);
            }
          }
        } else {
          this.setStatus('disconnected');
          this.callbacks.onDeviceInfo(null);
          this.addLog('sys', `Disconnected from ${device.name} by user.`);
        }
      };
    } catch (err: any) {
      this.setStatus('error');
      this.addLog('err', `WebSocket initialization failed: ${err?.message || 'Network error'}`);
    }
  }

  private handleServerMessage(data: IncomingMessage) {
    if (data.type === 'auth_result') {
      if (data.success) {
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.addLog('rx', `Authenticated: Connected to ${data.computerName || this.currentDevice?.name || 'Device'}`);

        if (this.currentDevice) {
          const updates: Partial<Device> = {
            connectionState: 'connected',
            lastSeen: Date.now(),
          };
          if (data.computerName) updates.name = data.computerName;
          if (data.token) updates.token = data.token;
          if (data.deviceType) updates.type = data.deviceType;
          if (data.platform) updates.platform = data.platform;
          if (data.capabilities && data.capabilities.length > 0) {
            updates.capabilities = data.capabilities;
          }
          if (data.screenWidth) updates.screenWidth = data.screenWidth;
          if (data.screenHeight) updates.screenHeight = data.screenHeight;
          if (data.model) updates.model = data.model;
          if (data.osVersion) updates.osVersion = data.osVersion;

          const updated = deviceManager.updateDevice(this.currentDevice.id, updates);
          if (updated) {
            this.currentDevice = updated;
          }
        }

        const info: ConnectedDeviceInfo = {
          computerName: data.computerName || this.currentDevice?.name || 'Device',
          deviceType: data.deviceType || this.currentDevice?.type || 'windows',
          platform: data.platform || this.currentDevice?.platform || 'windows',
          capabilities: data.capabilities || this.currentDevice?.capabilities,
          screenWidth: data.screenWidth,
          screenHeight: data.screenHeight,
          ip: this.currentDevice?.host || '',
          port: this.currentDevice?.port || 8765,
        };

        this.callbacks.onDeviceInfo(info);
        if (data.token && this.callbacks.onAuthSuccess && this.currentDevice) {
          this.callbacks.onAuthSuccess(data.token, this.currentDevice);
        }

        this.startPingLoop();
      } else {
        const errorMsg = data.message || 'Incorrect PIN or pairing expired';
        this.setStatus('auth_failed');
        this.callbacks.onDeviceInfo({
          computerName: this.currentDevice?.name || 'Device',
          deviceType: this.currentDevice?.type,
          ip: this.currentDevice?.host || '',
          port: this.currentDevice?.port || 8765,
          errorMessage: errorMsg,
        });
        this.addLog('err', `Auth failed: ${errorMsg}`);
        this.disconnect(true);
      }
    } else if (data.type === 'pong') {
      if (this.lastPingSent > 0) {
        const latency = Date.now() - this.lastPingSent;
        this.callbacks.onLatency(latency);
      }
    } else if (data.type === 'device_info') {
      if (this.currentDevice) {
        const updated = deviceManager.updateDevice(this.currentDevice.id, {
          name: data.name || this.currentDevice.name,
          type: data.deviceType,
          platform: data.platform,
          capabilities: data.capabilities,
          model: data.model,
          osVersion: data.osVersion,
          screenWidth: data.screenWidth,
          screenHeight: data.screenHeight,
        });
        if (updated) this.currentDevice = updated;
      }
    } else if (data.type === 'capabilities') {
      if (this.currentDevice && Array.isArray(data.capabilities)) {
        const updated = deviceManager.updateDevice(this.currentDevice.id, {
          capabilities: data.capabilities,
        });
        if (updated) this.currentDevice = updated;
      }
    } else if (data.type === 'error') {
      this.addLog('err', `Device error: ${data.message}`);
    } else if (data.type === 'notification') {
      this.addLog('rx', `Notification: ${data.message}`);
      if (this.callbacks.onNotification) this.callbacks.onNotification(data.message);
    } else if (data.type === 'clipboard_data') {
      this.addLog('rx', `Clipboard received`);
      if (this.callbacks.onClipboardData) this.callbacks.onClipboardData(data.text);
    }

    if (this.callbacks.onIncomingMessage) {
      this.callbacks.onIncomingMessage(data);
    }
  }

  private startPingLoop() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.lastPingSent = Date.now();
        this.send({ type: 'ping', timestamp: this.lastPingSent });
      }
    }, 4000);
  }

  private clearTimers() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }
  }

  public send(msg: OutgoingMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      const payload = JSON.stringify(msg);
      this.socket.send(payload);
      if (msg.type !== 'mouse_move' && msg.type !== 'ping') {
        this.addLog('tx', payload);
      }
    } catch (e: any) {
      this.addLog('err', `Failed to send command: ${e?.message}`);
    }
  }

  public disconnect(dueToAuthFailure = false) {
    this.isIntentionalDisconnect = !dueToAuthFailure;
    this.clearTimers();
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {}
      this.socket = null;
    }
    if (!dueToAuthFailure) {
      this.setStatus('disconnected');
      this.callbacks.onDeviceInfo(null);
    }
  }
}
