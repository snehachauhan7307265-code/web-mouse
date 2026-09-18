import { ConnectionConfig, ConnectionStatus, ConnectedDeviceInfo, OutgoingMessage, LogEntry } from '../types';

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private config: ConnectionConfig;
  private deviceName: string;
  private status: ConnectionStatus = 'disconnected';
  private onStatusChange: (status: ConnectionStatus) => void;
  private onDeviceInfo: (info: ConnectedDeviceInfo | null) => void;
  private onLog: (log: LogEntry) => void;
  private onLatency: (latencyMs: number) => void;
  private onNotification?: (msg: string) => void;
  private onClipboardData?: (text: string) => void;
  private onIncomingMessage?: (msg: any) => void;
  private onAuthSuccess?: (token: string) => void;
  
  private pingInterval: any = null;
  private reconnectTimeout: any = null;
  private isIntentionalDisconnect = false;
  private lastPingSent = 0;
  private reconnectAttempts = 0;

  constructor(
    config: ConnectionConfig,
    deviceName: string,
    callbacks: {
      onStatusChange: (status: ConnectionStatus) => void;
      onDeviceInfo: (info: ConnectedDeviceInfo | null) => void;
      onLog: (log: LogEntry) => void;
      onLatency: (latencyMs: number) => void;
      onNotification?: (msg: string) => void;
      onClipboardData?: (text: string) => void;
      onIncomingMessage?: (msg: any) => void;
      onAuthSuccess?: (token: string) => void;
    }
  ) {
    this.config = config;
    this.deviceName = deviceName;
    this.onStatusChange = callbacks.onStatusChange;
    this.onDeviceInfo = callbacks.onDeviceInfo;
    this.onLog = callbacks.onLog;
    this.onLatency = callbacks.onLatency;
    this.onNotification = callbacks.onNotification;
    this.onClipboardData = callbacks.onClipboardData;
    this.onIncomingMessage = callbacks.onIncomingMessage;
    this.onAuthSuccess = callbacks.onAuthSuccess;
  }

  public updateConfig(config: ConnectionConfig, deviceName: string) {
    this.config = config;
    this.deviceName = deviceName;
  }

  public getConfig(): ConnectionConfig {
    return this.config;
  }

  private setStatus(newStatus: ConnectionStatus) {
    this.status = newStatus;
    this.onStatusChange(newStatus);
  }

  private addLog(type: LogEntry['type'], content: string) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.onLog({
      id: Math.random().toString(36).substring(2, 9),
      time,
      type,
      content,
    });
  }

  public connect(isAutoReconnect = false) {
    console.log('[WebSocketClient] connect called', { isAutoReconnect, rawHost: this.config.host });
    // If already connected or connecting, prevent duplicate socket
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      console.log('[WebSocketClient] already connecting or open');
      return;
    }

    if (!isAutoReconnect) {
      this.reconnectAttempts = 0;
    }

    this.isIntentionalDisconnect = false;
    this.clearTimers();

    const rawHost = this.config.host.trim();
    const defaultPort = this.config.port || 8765;

    if (!rawHost) {
      this.setStatus('error');
      this.addLog('err', 'Invalid Computer IP address or WebSocket URL');
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
    this.addLog('sys', `Connecting to ${wsUrl}...`);

    const isHttpsOrigin = typeof window !== 'undefined' && window.location.protocol === 'https:';
    if (isHttpsOrigin && wsUrl.startsWith('ws://')) {
      this.addLog('sys', 'Note: Loaded over HTTPS. If connecting to local ws:// fails, check browser Mixed Content settings.');
    }

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.addLog('sys', `Connected to ${wsUrl}. Sending authentication handshake...`);
        // Step 1: Send authentication handshake with token or 6-digit code
        this.send({
          type: 'auth',
          code: this.config.code?.trim() || '',
          token: this.config.qrToken || this.config.token,
          deviceName: this.deviceName || 'WebMouse Phone',
        });
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleServerMessage(data);
        } catch (e) {
          this.addLog('err', `Non-JSON payload from server: ${event.data}`);
        }
      };

      this.socket.onerror = (_err) => {
        let errHint = `Phone cannot reach Windows Helper at ${wsUrl}. Check that both devices are on the same Wi-Fi and that Windows Firewall allows WebMouse on the local network.`;
        if (isHttpsOrigin && wsUrl.startsWith('ws://')) {
          errHint += ' (If blocked by browser over HTTPS, allow Insecure Content in site settings or add to Home Screen).';
        }
        this.addLog('err', errHint);
        this.setStatus('error');
      };

      this.socket.onclose = (event) => {
        this.clearTimers();

        if (!this.isIntentionalDisconnect) {
          if (this.status !== 'auth_failed' && this.status !== 'error') {
            this.setStatus('disconnected');
          }
          if (this.status !== 'auth_failed') {
            this.onDeviceInfo(null);
            this.addLog('sys', `Disconnected from helper (close code: ${event.code})`);

            if (this.config.autoReconnect) {
              const maxAttempts = 10;
              if (this.reconnectAttempts < maxAttempts) {
                this.reconnectAttempts++;
                // Exponential backoff: 1s, 2s, 4s, 5s max
                let delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 5000);
                this.addLog('sys', `Auto-reconnecting in ${delay / 1000}s (Attempt ${this.reconnectAttempts}/${maxAttempts})...`);
                this.reconnectTimeout = setTimeout(() => {
                  this.connect(true);
                }, delay);
              } else {
                this.addLog('err', 'Max reconnect attempts reached. Please check the computer and reconnect manually.');
              }
            }
          }
        } else {
          this.setStatus('disconnected');
          this.onDeviceInfo(null);
          this.addLog('sys', 'Disconnected by user.');
        }
      };
    } catch (err: any) {
      this.setStatus('error');
      this.addLog('err', `Failed to initialize WebSocket: ${err?.message || 'Network error'}`);
    }
  }

  private handleServerMessage(data: any) {
    if (data.type === 'auth_result') {
      if (data.success) {
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.addLog('rx', `Authenticated: Connected to ${data.computerName || 'Windows PC'}`);
        this.onDeviceInfo({
          computerName: data.computerName || 'Windows PC',
          screenWidth: data.screenWidth,
          screenHeight: data.screenHeight,
          ip: this.config.host,
          port: this.config.port,
        });
        // Start latency monitoring loop
        this.startPingLoop();
      } else {
        const errorMsg = data.message || 'Incorrect 6-digit pairing code';
        this.setStatus('auth_failed');
        this.onDeviceInfo({
          computerName: 'Windows PC',
          ip: this.config.host,
          port: this.config.port,
          errorMessage: errorMsg,
        });
        this.addLog('err', `Auth failed: ${errorMsg}`);
        this.disconnect(true);
      }
    } else if (data.type === 'pong') {
      if (this.lastPingSent > 0) {
        const latency = Date.now() - this.lastPingSent;
        this.onLatency(latency);
      }
    } else if (data.type === 'error') {
      this.addLog('err', `Server error: ${data.message}`);
    } else if (data.type === 'notification') {
      this.addLog('rx', `Notification: ${data.message}`);
      if (this.onNotification) this.onNotification(data.message);
    } else if (data.type === 'clipboard_data') {
      this.addLog('rx', `Clipboard data received`);
      if (this.onClipboardData) this.onClipboardData(data.text);
    }
    
    // Dispatch to generic message listener if present
    if (this.onIncomingMessage) {
      this.onIncomingMessage(data);
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
  }

  /**
   * Send JSON command to real Windows helper
   */
  public send(msg: OutgoingMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const payload = JSON.stringify(msg);
      this.socket.send(payload);
      // Log commands to console (exclude rapid mouse_move & ping to prevent console flooding)
      if (msg.type !== 'mouse_move' && msg.type !== 'ping') {
        this.addLog('tx', payload);
      }
    } catch (e: any) {
      this.addLog('err', `Failed to send command: ${e?.message}`);
    }
  }

  /**
   * Disconnect and clean up resources
   */
  public disconnect(dueToAuthFailure = false) {
    this.isIntentionalDisconnect = !dueToAuthFailure;
    this.clearTimers();
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
        // ignore
      }
      this.socket = null;
    }
    if (!dueToAuthFailure) {
      this.setStatus('disconnected');
      this.onDeviceInfo(null);
    }
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }
}

/**
 * Utility for triggering phone vibration haptics
 */
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'double' | 'error' = 'light', enabled = true) {
  if (!enabled || typeof window === 'undefined' || !navigator.vibrate) {
    return;
  }
  try {
    switch (type) {
      case 'light':
        navigator.vibrate(12);
        break;
      case 'medium':
        navigator.vibrate(25);
        break;
      case 'heavy':
        navigator.vibrate(45);
        break;
      case 'double':
        navigator.vibrate([15, 40, 20]);
        break;
      case 'error':
        navigator.vibrate([50, 50, 50]);
        break;
    }
  } catch (e) {
    // Ignore unsupported device errors
  }
}

// Simple Web Audio API click sound
let audioCtx: AudioContext | null = null;
export function playClickSound(enabled = true) {
  if (!enabled || typeof window === 'undefined') return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.05);
  } catch (e) {
    // Ignore audio errors
  }
}
