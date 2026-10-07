import { ConnectionState, QRPairPayload, TrustedDevice } from '../types';
import { getPhoneDeviceId, saveTrustedDevice, getTrustedDevice, setLastConnectedDeviceId } from './deviceStore';

type StateListener = (state: ConnectionState, message?: string) => void;
type DeviceListener = (device: TrustedDevice | null) => void;

class ConnectionManager {
  private socket: WebSocket | null = null;
  private state: ConnectionState = 'DISCONNECTED';
  private currentDevice: TrustedDevice | null = null;
  private stateListeners: Set<StateListener> = new Set();
  private deviceListeners: Set<DeviceListener> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: any = null;
  private isIntentionalDisconnect = false;
  private pingInterval: any = null;
  private messageListeners: Set<(data: any) => void> = new Set();

  constructor() {
    // Single instance manages active connection
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public getCurrentDevice(): TrustedDevice | null {
    return this.currentDevice;
  }

  public onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  public onDeviceChange(listener: DeviceListener): () => void {
    this.deviceListeners.add(listener);
    listener(this.currentDevice);
    return () => this.deviceListeners.delete(listener);
  }

  public onMessage(listener: (data: any) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public sendMessage(msg: any): boolean {
    if (this.state !== 'CONNECTED' || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[ConnectionManager] Cannot send message, not connected:', msg);
      return false;
    }
    try {
      const payload = typeof msg === 'string' ? msg : JSON.stringify(msg);
      this.socket.send(payload);
      return true;
    } catch (e) {
      console.error('[ConnectionManager] Failed to send message:', e);
      return false;
    }
  }

  private setState(newState: ConnectionState, message?: string) {
    if (this.state !== newState) {
      console.log(`[ConnectionManager] State: ${this.state} -> ${newState}`, message || '');
      this.state = newState;
      this.stateListeners.forEach((l) => l(newState, message));
    }
  }

  private setCurrentDevice(device: TrustedDevice | null) {
    this.currentDevice = device;
    this.deviceListeners.forEach((l) => l(device));
  }

  /**
   * FIRST TIME PAIRING:
   * Connects using QR payload, exchanges pairingToken for permanent credential,
   * trusts device, saves to local store, and connects.
   */
  public async pairAndTrust(qr: QRPairPayload): Promise<boolean> {
    this.cleanUpSocket();
    this.isIntentionalDisconnect = false;
    this.reconnectAttempts = 0;
    this.setState('PAIRING', 'Pairing with Windows PC...');

    return new Promise((resolve) => {
      const phoneId = getPhoneDeviceId();
      const wsUrl = `ws://${qr.host}:${qr.port}`;
      console.log(`[ConnectionManager] Opening pairing socket to ${wsUrl}`);

      let isHandshakeComplete = false;
      const timeout = setTimeout(() => {
        if (!isHandshakeComplete) {
          console.warn('[ConnectionManager] Pairing timeout');
          this.setState('ERROR', 'Pairing timed out. Verify PC is running WebMouse Helper.');
          this.cleanUpSocket();
          resolve(false);
        }
      }, 10000);

      try {
        const ws = new WebSocket(wsUrl);
        this.socket = ws;

        ws.onopen = () => {
          console.log('[ConnectionManager] Socket open, sending pair_request');
          const pairReq = {
            type: 'pair_request',
            deviceId: phoneId,
            deviceName: 'WebMouse Phone',
            pairingToken: qr.pairingToken,
          };
          ws.send(JSON.stringify(pairReq));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[ConnectionManager] RX message:', data);

            this.messageListeners.forEach((l) => {
              try { l(data); } catch {}
            });

            if (data.type === 'pair_response') {
              if (data.success && data.credential) {
                isHandshakeComplete = true;
                clearTimeout(timeout);

                // Create and save trusted device
                const trusted: TrustedDevice = {
                  deviceId: data.deviceId || qr.deviceId,
                  deviceName: data.deviceName || qr.deviceName || 'My Laptop',
                  host: qr.host,
                  port: qr.port,
                  credential: data.credential,
                  pairedAt: Date.now(),
                  lastConnectedAt: Date.now(),
                  isTrusted: true,
                };

                saveTrustedDevice(trusted);
                this.setCurrentDevice(trusted);
                this.setupHeartbeat();

                // Server will follow with connection_ready or is already ready
                this.setState('CONNECTED', '🟢 Connected');
                resolve(true);
              } else {
                clearTimeout(timeout);
                this.setState('ERROR', data.message || 'Pairing rejected by Windows PC');
                this.cleanUpSocket();
                resolve(false);
              }
            } else if (data.type === 'connection_ready') {
              this.setState('CONNECTED', '🟢 Connected');
            }
          } catch (e) {
            console.error('[ConnectionManager] Error parsing message', e);
          }
        };

        ws.onerror = (e) => {
          console.error('[ConnectionManager] WebSocket error during pairing', e);
          clearTimeout(timeout);
          this.setState('ERROR', 'Could not reach Windows PC on local network');
          this.cleanUpSocket();
          resolve(false);
        };

        ws.onclose = () => {
          console.log('[ConnectionManager] WebSocket closed during pairing');
          clearTimeout(timeout);
          if (!isHandshakeComplete && this.state === 'PAIRING') {
            this.setState('ERROR', 'Connection closed by Windows PC');
            resolve(false);
          }
        };
      } catch (e: any) {
        clearTimeout(timeout);
        this.setState('ERROR', e?.message || 'Failed to initialize connection');
        resolve(false);
      }
    });
  }

  /**
   * RETURNING USER:
   * Connects to an already-trusted PC using stored credential.
   * No QR code required.
   */
  public connectTrusted(device: TrustedDevice): void {
    this.cleanUpSocket();
    this.isIntentionalDisconnect = false;
    this.setCurrentDevice(device);
    setLastConnectedDeviceId(device.deviceId);

    this.setState('CONNECTING', 'Connecting to ' + device.deviceName + '...');
    const phoneId = getPhoneDeviceId();
    const wsUrl = `ws://${device.host}:${device.port}`;

    let isHandshakeComplete = false;
    const timeout = setTimeout(() => {
      if (!isHandshakeComplete && this.state === 'CONNECTING') {
        console.warn('[ConnectionManager] Connect timeout');
        this.handleDisconnectOrError('Connection timed out');
      }
    }, 8000);

    try {
      const ws = new WebSocket(wsUrl);
      this.socket = ws;

      ws.onopen = () => {
        console.log('[ConnectionManager] Socket open, sending connect auth');
        const connectReq = {
          type: 'connect',
          deviceId: phoneId,
          credential: device.credential,
        };
        ws.send(JSON.stringify(connectReq));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[ConnectionManager] RX auth message:', data);

          this.messageListeners.forEach((l) => {
            try { l(data); } catch {}
          });

          if (data.type === 'connect_response') {
            if (data.success) {
              isHandshakeComplete = true;
              clearTimeout(timeout);
              this.reconnectAttempts = 0;

              // Update lastConnectedAt
              const updated = { ...device, lastConnectedAt: Date.now() };
              saveTrustedDevice(updated);
              this.setCurrentDevice(updated);
              this.setupHeartbeat();

              this.setState('CONNECTED', '🟢 Connected');
            } else {
              clearTimeout(timeout);
              this.setState('ERROR', data.message || 'Authentication rejected by PC');
              this.cleanUpSocket();
            }
          } else if (data.type === 'connection_ready') {
            this.setState('CONNECTED', '🟢 Connected');
          }
        } catch (e) {
          console.error('[ConnectionManager] Error parsing auth response', e);
        }
      };

      ws.onerror = (e) => {
        console.error('[ConnectionManager] WebSocket error', e);
        clearTimeout(timeout);
        this.handleDisconnectOrError('Could not reach Windows PC');
      };

      ws.onclose = () => {
        console.log('[ConnectionManager] WebSocket closed');
        clearTimeout(timeout);
        if (!this.isIntentionalDisconnect) {
          this.handleDisconnectOrError('Connection lost');
        } else {
          this.setState('DISCONNECTED', '🔴 Not Connected');
        }
      };
    } catch (e: any) {
      clearTimeout(timeout);
      this.handleDisconnectOrError(e?.message || 'Connection failed');
    }
  }

  /**
   * Handle unexpected disconnect: triggers automatic reconnect with backoff,
   * or transitions to OFFLINE after max attempts.
   */
  private handleDisconnectOrError(reason: string) {
    this.cleanUpSocket();

    if (this.currentDevice && !this.isIntentionalDisconnect) {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts - 1), 5000);
        this.setState('RECONNECTING', `🟡 Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          if (this.currentDevice && !this.isIntentionalDisconnect) {
            console.log(`[ConnectionManager] Auto-reconnecting attempt ${this.reconnectAttempts}...`);
            this.connectTrusted(this.currentDevice);
          }
        }, delay);
      } else {
        this.setState('OFFLINE', '⚫ Offline');
      }
    } else {
      this.setState('DISCONNECTED', '🔴 Not Connected');
    }
  }

  /**
   * Disconnect intentionally.
   */
  public disconnect(): void {
    this.isIntentionalDisconnect = true;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanUpSocket();
    this.setState('DISCONNECTED', '🔴 Not Connected');
  }

  private cleanUpSocket() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.socket) {
      try {
        this.socket.onopen = null;
        this.socket.onmessage = null;
        this.socket.onerror = null;
        this.socket.onclose = null;
        this.socket.close();
      } catch {}
      this.socket = null;
    }
  }

  private setupHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify({ type: 'ping' }));
        } catch {}
      }
    }, 15000);
  }

  /**
   * REAL MOUSE MOVEMENTS:
   * Only sends if state is strictly CONNECTED.
   */
  public sendMouseMove(dx: number, dy: number): void {
    if (this.state !== 'CONNECTED' || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    // Throttle extreme values / sanitize
    const cleanDx = Math.round(dx);
    const cleanDy = Math.round(dy);
    if (cleanDx === 0 && cleanDy === 0) return;

    this.socket.send(
      JSON.stringify({
        type: 'mouse_move',
        dx: cleanDx,
        dy: cleanDy,
      })
    );
  }

  public sendMouseClick(button: 'left' | 'right' | 'middle'): void {
    if (this.state !== 'CONNECTED' || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(
      JSON.stringify({
        type: 'mouse_click',
        button,
      })
    );
  }

  public sendMouseDown(button: 'left' | 'right'): void {
    if (this.state !== 'CONNECTED' || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(
      JSON.stringify({
        type: 'mouse_down',
        button,
      })
    );
  }

  public sendMouseUp(button: 'left' | 'right'): void {
    if (this.state !== 'CONNECTED' || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(
      JSON.stringify({
        type: 'mouse_up',
        button,
      })
    );
  }

  public sendMouseScroll(dx: number, dy: number): void {
    if (this.state !== 'CONNECTED' || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(
      JSON.stringify({
        type: 'mouse_scroll',
        dx: Math.round(dx),
        dy: Math.round(dy),
      })
    );
  }
}

export const connectionManager = new ConnectionManager();
