/**
 * WebMouse V2 — Receiver Service
 * Core engine for Android TV and Android Smart Board receivers.
 * Handles pairing PIN/QR generation, authentication, remote navigation,
 * media control, presentation slides, file receiving, and Quick Share.
 */

import { DeviceType, DeviceCapability, ReceivedFile, QuickShareItem, PresentationState } from '../types';

export interface ReceiverConfig {
  id: string;
  name: string;
  type: DeviceType;
  pairingCode: string;
  token: string;
  port: number;
  capabilities: DeviceCapability[];
}

export interface ConnectedController {
  id: string;
  name: string;
  connectedAt: number;
  token: string;
}

export type ReceiverStatus = 'waiting' | 'connected' | 'disconnected';

export interface ReceiverEventMap {
  statusChange: (status: ReceiverStatus, controller: ConnectedController | null) => void;
  navigation: (direction: 'up' | 'down' | 'left' | 'right') => void;
  select: () => void;
  back: () => void;
  home: () => void;
  volumeChange: (volume: number, isMuted: boolean) => void;
  mediaAction: (action: string) => void;
  presentationChange: (state: PresentationState) => void;
  fileReceived: (file: ReceivedFile) => void;
  quickShareReceived: (item: QuickShareItem) => void;
  screenSignaling: (payload: any) => void;
  projectorStart: (data: { sessionId: string; sourceDevice: string; quality?: string; fps?: number }) => void;
  webrtcOffer: (data: { sessionId: string; sdp: string; fromDevice?: string }) => void;
  webrtcIceCandidate: (data: { sessionId: string; candidate: any }) => void;
  projectorStop: (data: { sessionId: string; reason?: string }) => void;
  projectorPause: (data: { sessionId: string }) => void;
  projectorResume: (data: { sessionId: string }) => void;
}

const DEFAULT_TV_CAPABILITIES: DeviceCapability[] = [
  'tv_remote',
  'media',
  'presentation',
  'file_transfer',
  'screen_receiver',
  'quick_share',
];

const DEFAULT_BOARD_CAPABILITIES: DeviceCapability[] = [
  'touch_board',
  'tv_remote',
  'presentation',
  'file_transfer',
  'screen_receiver',
  'quick_share',
  'media',
];

const RECEIVER_STORAGE_KEY = 'webmouse_receiver_config';
const RECEIVED_FILES_STORAGE_KEY = 'webmouse_received_files';

class ReceiverService {
  private config: ReceiverConfig;
  private status: ReceiverStatus = 'waiting';
  private connectedController: ConnectedController | null = null;
  private channel: BroadcastChannel | null = null;
  private eventListeners: Map<keyof ReceiverEventMap, Set<any>> = new Map();

  // Receiver active state
  private volume: number = 65;
  private isMuted: boolean = false;
  private presentationState: PresentationState = {
    currentSlide: 1,
    totalSlides: 12,
    isBlackScreen: false,
    isActive: false,
  };
  private receivedFiles: ReceivedFile[] = [];
  private quickShareItems: QuickShareItem[] = [];

  // File chunk assembly buffer
  private fileBuffers: Map<string, { filename: string; size: number; total_chunks: number; chunks: string[]; sender: string }> = new Map();

  constructor() {
    this.config = this.loadConfig();
    this.receivedFiles = this.loadReceivedFiles();
    this.setupBroadcastChannel();
  }

  private loadConfig(): ReceiverConfig {
    try {
      const saved = localStorage.getItem(RECEIVER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.id && parsed.pairingCode) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('[ReceiverService] Error loading config:', e);
    }

    // Generate fresh receiver credentials
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const token = 'recv_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const id = 'receiver_' + Math.random().toString(36).substring(2, 9);

    const initial: ReceiverConfig = {
      id,
      name: 'Living Room TV',
      type: 'android_tv',
      pairingCode: pin,
      token,
      port: 8765,
      capabilities: DEFAULT_TV_CAPABILITIES,
    };

    this.persistConfig(initial);
    return initial;
  }

  private persistConfig(config = this.config) {
    try {
      localStorage.setItem(RECEIVER_STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('[ReceiverService] Error persisting config:', e);
    }
  }

  private loadReceivedFiles(): ReceivedFile[] {
    try {
      const saved = localStorage.getItem(RECEIVED_FILES_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('[ReceiverService] Error loading received files:', e);
    }
    return [];
  }

  private persistReceivedFiles() {
    try {
      localStorage.setItem(RECEIVED_FILES_STORAGE_KEY, JSON.stringify(this.receivedFiles));
    } catch (e) {
      console.error('[ReceiverService] Error saving received files:', e);
    }
  }

  private setupBroadcastChannel() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.channel = new BroadcastChannel('webmouse_universal_channel');
        this.channel.onmessage = (event) => {
          this.handleChannelMessage(event.data);
        };
      }
    } catch (e) {
      console.warn('[ReceiverService] BroadcastChannel not supported:', e);
    }
  }

  public getQRData(): string {
    const payload = {
      protocol: 'webmouse_v2',
      receiverId: this.config.id,
      name: this.config.name,
      type: this.config.type,
      pin: this.config.pairingCode,
      token: this.config.token,
      port: this.config.port,
      capabilities: this.config.capabilities,
      ip: typeof window !== 'undefined' ? window.location.hostname || '127.0.0.1' : '127.0.0.1',
    };
    return JSON.stringify(payload);
  }

  public getConfig(): ReceiverConfig {
    return { ...this.config };
  }

  public getStatus(): ReceiverStatus {
    return this.status;
  }

  public getConnectedController(): ConnectedController | null {
    return this.connectedController;
  }

  public getVolume(): { volume: number; isMuted: boolean } {
    return { volume: this.volume, isMuted: this.isMuted };
  }

  public getPresentationState(): PresentationState {
    return { ...this.presentationState };
  }

  public getReceivedFiles(): ReceivedFile[] {
    return [...this.receivedFiles];
  }

  public getQuickShareItems(): QuickShareItem[] {
    return [...this.quickShareItems];
  }

  public updateConfig(updates: Partial<ReceiverConfig>) {
    this.config = { ...this.config, ...updates };
    if (updates.type) {
      this.config.capabilities = updates.type === 'smart_board' ? DEFAULT_BOARD_CAPABILITIES : DEFAULT_TV_CAPABILITIES;
    }
    this.persistConfig();
    this.broadcastToControllers({
      type: 'device_info',
      name: this.config.name,
      deviceType: this.config.type,
      platform: 'android',
      capabilities: this.config.capabilities,
    });
  }

  public regenerateCredentials() {
    this.config.pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    this.config.token = 'recv_' + Math.random().toString(36).substring(2, 15);
    this.persistConfig();
    this.disconnectController();
  }

  public disconnectController() {
    if (this.connectedController) {
      this.broadcastToControllers({
        type: 'notification',
        message: 'Receiver disconnected controller session.',
      });
      this.connectedController = null;
      this.status = 'waiting';
      this.emit('statusChange', 'waiting', null);
    }
  }

  public deleteReceivedFile(id: string) {
    this.receivedFiles = this.receivedFiles.filter((f) => f.id !== id);
    this.persistReceivedFiles();
  }

  public dismissQuickShare(id: string) {
    this.quickShareItems = this.quickShareItems.filter((i) => i.id !== id);
  }

  public addEventListener<K extends keyof ReceiverEventMap>(event: K, listener: ReceiverEventMap[K]) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
    return () => {
      this.eventListeners.get(event)?.delete(listener);
    };
  }

  private emit<K extends keyof ReceiverEventMap>(event: K, ...args: Parameters<ReceiverEventMap[K]>) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          (listener as any)(...args);
        } catch (e) {
          console.error(`[ReceiverService] Error in listener for ${event}:`, e);
        }
      }
    }
  }

  public sendWebRTCAnswer(sessionId: string, sdp: string, toDevice?: string) {
    this.broadcastToControllers({
      type: 'webrtc_answer',
      sessionId,
      sdp,
      fromDevice: this.config.name,
      toDevice,
    });
  }

  public sendWebRTCIceCandidate(sessionId: string, candidate: any, toDevice?: string) {
    this.broadcastToControllers({
      type: 'webrtc_ice_candidate',
      sessionId,
      candidate,
      fromDevice: this.config.name,
      toDevice,
    });
  }

  public sendProjectorStop(sessionId: string, reason?: string) {
    this.broadcastToControllers({
      type: 'projector_stop',
      sessionId,
      reason,
    });
  }

  public broadcastToControllers(msg: any) {
    if (this.channel) {
      try {
        this.channel.postMessage({
          source: 'receiver',
          receiverId: this.config.id,
          payload: msg,
        });
      } catch (e) {
        console.error('[ReceiverService] Channel send error:', e);
      }
    }
  }

  /**
   * Process incoming messages from Phone Controller
   */
  public handleChannelMessage(data: any) {
    if (!data || data.source !== 'controller') return;
    const msg = data.payload;
    if (!msg || typeof msg !== 'object') return;

    // 1. Authentication Handshake
    if (msg.type === 'auth') {
      const code = (msg.code || '').trim();
      const token = (msg.token || '').trim();
      const deviceName = msg.deviceName || 'Phone Controller';

      const isValidCode = code && code === this.config.pairingCode;
      const isValidToken = token && token === this.config.token;

      if (isValidCode || isValidToken) {
        this.connectedController = {
          id: data.controllerId || 'ctrl_' + Date.now(),
          name: deviceName,
          connectedAt: Date.now(),
          token: this.config.token,
        };
        this.status = 'connected';

        this.broadcastToControllers({
          type: 'auth_result',
          success: true,
          message: 'Connected to ' + this.config.name,
          token: this.config.token,
          computerName: this.config.name,
          deviceType: this.config.type,
          platform: 'android',
          capabilities: this.config.capabilities,
        });

        this.emit('statusChange', 'connected', this.connectedController);
      } else {
        this.broadcastToControllers({
          type: 'auth_result',
          success: false,
          message: 'Invalid 6-digit PIN code.',
        });
      }
      return;
    }

    // Guard: reject unauthenticated commands
    if (this.status !== 'connected') {
      this.broadcastToControllers({
        type: 'error',
        message: 'Unauthorized. Authenticate with pairing code first.',
      });
      return;
    }

    // 2. Ping / Pong latency measurement
    if (msg.type === 'ping') {
      this.broadcastToControllers({
        type: 'pong',
        timestamp: msg.timestamp,
      });
      return;
    }

    // 3. Navigation (D-Pad)
    if (msg.type === 'receiver_navigation' || (msg.type === 'tv_remote' && ['up', 'down', 'left', 'right'].includes(msg.action))) {
      const direction = msg.direction || msg.action;
      this.emit('navigation', direction);
      return;
    }

    // 4. Select / OK
    if (msg.type === 'receiver_select' || (msg.type === 'tv_remote' && msg.action === 'select')) {
      this.emit('select');
      return;
    }

    // 5. Back
    if (msg.type === 'receiver_back' || (msg.type === 'tv_remote' && msg.action === 'back')) {
      this.emit('back');
      return;
    }

    // 6. Home
    if (msg.type === 'receiver_home' || (msg.type === 'tv_remote' && msg.action === 'home')) {
      this.emit('home');
      return;
    }

    // 7. Volume
    if (msg.type === 'receiver_volume' || (msg.type === 'tv_remote' && ['vol_up', 'vol_down', 'mute'].includes(msg.action))) {
      const act = msg.action;
      if (act === 'increase' || act === 'vol_up') {
        this.volume = Math.min(100, this.volume + 5);
        this.isMuted = false;
      } else if (act === 'decrease' || act === 'vol_down') {
        this.volume = Math.max(0, this.volume - 5);
        this.isMuted = false;
      } else if (act === 'mute') {
        this.isMuted = !this.isMuted;
      }
      this.emit('volumeChange', this.volume, this.isMuted);
      return;
    }

    // 8. Media
    if (msg.type === 'receiver_media' || msg.type === 'media_control') {
      const act = msg.action;
      this.emit('mediaAction', act);
      return;
    }

    // 9. Presentation Control
    if (msg.type === 'presentation_control') {
      const act = msg.action;
      if (act === 'next') {
        this.presentationState.currentSlide = Math.min(this.presentationState.totalSlides, this.presentationState.currentSlide + 1);
        this.presentationState.isBlackScreen = false;
      } else if (act === 'prev') {
        this.presentationState.currentSlide = Math.max(1, this.presentationState.currentSlide - 1);
        this.presentationState.isBlackScreen = false;
      } else if (act === 'start') {
        this.presentationState.currentSlide = 1;
        this.presentationState.isActive = true;
        this.presentationState.isBlackScreen = false;
      } else if (act === 'stop') {
        this.presentationState.isActive = false;
      } else if (act === 'black') {
        this.presentationState.isBlackScreen = !this.presentationState.isBlackScreen;
      }
      this.emit('presentationChange', { ...this.presentationState });
      return;
    }

    // 10. Quick Share: Text or URL
    if (msg.type === 'share_text' || msg.type === 'share_link') {
      const content = msg.text || msg.url || '';
      if (content) {
        const item: QuickShareItem = {
          id: 'qs_' + Date.now(),
          type: msg.type === 'share_link' || content.startsWith('http') ? 'url' : 'text',
          content,
          senderName: this.connectedController?.name || 'Phone',
          receivedAt: Date.now(),
        };
        this.quickShareItems.unshift(item);
        this.emit('quickShareReceived', item);
      }
      return;
    }

    // 11. File Transfer (Secure Chunk Assembly)
    if (msg.type === 'file_transfer_start') {
      // Validate filename for security against path traversal
      const safeFilename = (msg.filename || 'file').replace(/[\\/:*?"<>|]/g, '_').trim();
      const transferId = msg.transfer_id;
      this.fileBuffers.set(transferId, {
        filename: safeFilename,
        size: msg.size || 0,
        total_chunks: msg.total_chunks || 1,
        chunks: [],
        sender: this.connectedController?.name || 'Phone',
      });
      this.broadcastToControllers({
        type: 'file_transfer_accepted',
        transfer_id: transferId,
      });
      return;
    }

    if (msg.type === 'file_chunk') {
      const buf = this.fileBuffers.get(msg.transfer_id);
      if (buf) {
        buf.chunks[msg.chunk_index] = msg.chunk;
        this.broadcastToControllers({
          type: 'file_chunk_ack',
          transfer_id: msg.transfer_id,
          chunk_index: msg.chunk_index,
        });
      }
      return;
    }

    if (msg.type === 'file_transfer_end') {
      const buf = this.fileBuffers.get(msg.transfer_id);
      if (buf) {
        const fullBase64 = buf.chunks.join('');
        const extension = buf.filename.split('.').pop()?.toLowerCase() || '';
        let mime = 'application/octet-stream';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) mime = 'image/' + extension;
        else if (['mp4', 'webm', 'mov'].includes(extension)) mime = 'video/' + extension;
        else if (extension === 'pdf') mime = 'application/pdf';

        const dataUrl = fullBase64.startsWith('data:') ? fullBase64 : `data:${mime};base64,${fullBase64}`;
        const newFile: ReceivedFile = {
          id: 'file_' + Date.now(),
          name: buf.filename,
          size: buf.size,
          type: mime,
          dataUrl,
          receivedAt: Date.now(),
          senderName: buf.sender,
        };
        this.receivedFiles.unshift(newFile);
        this.persistReceivedFiles();
        this.fileBuffers.delete(msg.transfer_id);
        this.emit('fileReceived', newFile);

        this.broadcastToControllers({
          type: 'file_transfer_success',
          transfer_id: msg.transfer_id,
        });
      }
      return;
    }

    // 12. WebRTC Signaling for Screen Projector
    if (msg.type === 'projector_start') {
      this.emit('projectorStart', {
        sessionId: msg.sessionId,
        sourceDevice: msg.sourceDevice || this.connectedController?.name || 'Controller',
        quality: msg.quality,
        fps: msg.fps,
      });
      return;
    }

    if (msg.type === 'webrtc_offer') {
      this.emit('webrtcOffer', {
        sessionId: msg.sessionId,
        sdp: msg.sdp,
        fromDevice: msg.fromDevice,
      });
      return;
    }

    if (msg.type === 'webrtc_ice_candidate') {
      this.emit('webrtcIceCandidate', {
        sessionId: msg.sessionId,
        candidate: msg.candidate,
      });
      return;
    }

    if (msg.type === 'projector_stop') {
      this.emit('projectorStop', {
        sessionId: msg.sessionId,
        reason: msg.reason,
      });
      return;
    }

    if (msg.type === 'projector_pause') {
      this.emit('projectorPause', { sessionId: msg.sessionId });
      return;
    }

    if (msg.type === 'projector_resume') {
      this.emit('projectorResume', { sessionId: msg.sessionId });
      return;
    }

    if (msg.type === 'webrtc_signaling') {
      this.emit('screenSignaling', msg.payload);
      return;
    }
  }
}

export const receiverService = new ReceiverService();
