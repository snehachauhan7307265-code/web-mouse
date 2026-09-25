/**
 * WebMouse V2 — Screen Projector Service
 * Core controller-side orchestrator for real WebRTC screen capture,
 * session management, adaptive constraints, and peer connection lifecycle.
 */

import {
  ProjectorSession,
  ProjectorState,
  ProjectorQuality,
  ProjectorFps,
  ProjectorStats,
  WebRTCSignalingMessage,
} from './projectorTypes';
import { SignalingManager } from './SignalingManager';
import { WebRTCManager } from './WebRTCManager';
import { OutgoingMessage } from '../../types';

export type SessionChangeCallback = (session: ProjectorSession) => void;
export type StatsChangeCallback = (stats: ProjectorStats) => void;

function generateSessionId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 8; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `PROJECTOR-${rand}`;
}

export class ScreenProjectorService {
  private signaling: SignalingManager;
  private webrtc: WebRTCManager;
  private currentStream: MediaStream | null = null;
  private currentSession: ProjectorSession | null = null;
  private sessionListeners: Set<SessionChangeCallback> = new Set();
  private statsListeners: Set<StatsChangeCallback> = new Set();
  private isPaused = false;
  private unsubscribeSignaling: (() => void) | null = null;

  constructor(sendFn: (msg: OutgoingMessage) => void) {
    this.signaling = new SignalingManager(sendFn);
    this.webrtc = new WebRTCManager();
    this.setupSignalingListener();
  }

  public updateSendFunction(sendFn: (msg: OutgoingMessage) => void) {
    this.signaling.setSendFunction(sendFn);
  }

  public getSignalingManager(): SignalingManager {
    return this.signaling;
  }

  public getSession(): ProjectorSession | null {
    return this.currentSession;
  }

  public getStream(): MediaStream | null {
    return this.currentStream;
  }

  public onSessionChange(callback: SessionChangeCallback): () => void {
    this.sessionListeners.add(callback);
    if (this.currentSession) {
      callback(this.currentSession);
    }
    return () => this.sessionListeners.delete(callback);
  }

  public onStatsChange(callback: StatsChangeCallback): () => void {
    this.statsListeners.add(callback);
    return () => this.statsListeners.delete(callback);
  }

  private updateSession(updates: Partial<ProjectorSession>) {
    if (!this.currentSession) return;
    this.currentSession = { ...this.currentSession, ...updates };
    this.sessionListeners.forEach((l) => {
      try {
        l(this.currentSession!);
      } catch (e) {
        console.error('[ScreenProjector] Listener error:', e);
      }
    });
  }

  private setupSignalingListener() {
    if (this.unsubscribeSignaling) this.unsubscribeSignaling();

    this.unsubscribeSignaling = this.signaling.addListener(async (msg: WebRTCSignalingMessage) => {
      if (!this.currentSession || msg.sessionId !== this.currentSession.sessionId) {
        return;
      }

      if (msg.type === 'webrtc_answer' && msg.sdp) {
        try {
          this.updateSession({ status: 'CONNECTED' });
          await this.webrtc.setRemoteDescription(msg.sdp, 'answer');
        } catch (e: any) {
          console.error('[ScreenProjector] Failed to set remote answer:', e);
          this.updateSession({ status: 'FAILED', errorMessage: `SDP answer failed: ${e?.message}` });
        }
      } else if (msg.type === 'webrtc_ice_candidate' && msg.candidate) {
        await this.webrtc.addIceCandidate(msg.candidate);
      } else if (msg.type === 'projector_stop') {
        this.stop(msg.reason || 'Receiver ended projection');
      }
    });
  }

  /**
   * Start a new screen projection session
   */
  public async start(
    sourceDevice: string,
    targetDevice: string,
    quality: ProjectorQuality = 'Auto',
    fps: ProjectorFps = 'Auto'
  ): Promise<ProjectorSession> {
    // 1. Cleanup any ongoing projection
    this.stop('Starting new session');

    const sessionId = generateSessionId();
    this.signaling.setCurrentSessionId(sessionId);

    this.currentSession = {
      sessionId,
      sourceDevice,
      targetDevice,
      startTime: Date.now(),
      status: 'WAITING_FOR_PERMISSION',
      connectionState: 'new',
      latency: 0,
      resolution: 'Negotiating',
      frameRate: 0,
      quality,
      fps,
    };
    this.updateSession({});

    // 2. Request Display Media via browser API
    let stream: MediaStream;
    try {
      stream = await this.startScreenCapture(quality, fps);
      this.currentStream = stream;
    } catch (e: any) {
      const errorMsg =
        e.name === 'NotAllowedError'
          ? 'Screen sharing permission was denied.'
          : e.name === 'NotFoundError'
          ? 'No screen stream was selected.'
          : !navigator.mediaDevices?.getDisplayMedia
          ? 'This browser does not support screen capture.'
          : `Screen capture failed: ${e.message}`;

      this.updateSession({ status: 'FAILED', errorMessage: errorMsg });
      throw new Error(errorMsg);
    }

    // 3. Setup track ended listener (browser stop button)
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        this.stop('User stopped sharing screen via browser');
      };
      const settings = videoTrack.getSettings();
      if (settings.width && settings.height) {
        this.updateSession({ resolution: `${settings.width} × ${settings.height}` });
      }
    }

    // 4. Create RTCPeerConnection & attach tracks
    this.updateSession({ status: 'NEGOTIATING' });
    this.webrtc.createPeerConnection(
      (candidate) => {
        this.signaling.sendIceCandidate(sessionId, candidate.toJSON(), sourceDevice, targetDevice);
      },
      () => {},
      (state) => {
        this.updateSession({ connectionState: state });
        if (state === 'connected') {
          this.updateSession({ status: 'STREAMING' });
        } else if (state === 'failed') {
          this.handleReconnect();
        } else if (state === 'disconnected') {
          this.updateSession({ status: 'RECONNECTING' });
        }
      }
    );

    this.webrtc.addStreamTracks(stream);

    // 5. Send projector_start announcement
    const fpsValue = fps === '60 FPS' ? 60 : fps === '30 FPS' ? 30 : undefined;
    this.signaling.sendProjectorStart(sessionId, sourceDevice, targetDevice, quality, fpsValue);

    // 6. Create WebRTC Offer
    try {
      const offer = await this.webrtc.createOffer();
      if (offer.sdp) {
        this.signaling.sendOffer(sessionId, offer.sdp, sourceDevice, targetDevice);
      }
    } catch (e: any) {
      this.updateSession({ status: 'FAILED', errorMessage: `Offer negotiation failed: ${e?.message}` });
      this.stop();
      throw e;
    }

    // 7. Start real-time WebRTC stats monitoring
    this.webrtc.startStatsMonitoring((stats) => {
      this.statsListeners.forEach((l) => {
        try {
          l(stats);
        } catch (e) {}
      });
      if (stats.width && stats.height) {
        this.updateSession({
          resolution: `${stats.width} × ${stats.height}`,
          frameRate: stats.fps || 0,
          latency: stats.latencyMs || 0,
        });
      }
    });

    return this.currentSession;
  }

  /**
   * Request display media stream with requested quality and fps constraints
   */
  public async startScreenCapture(quality: ProjectorQuality, fps: ProjectorFps): Promise<MediaStream> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('This browser does not support screen capture.');
    }

    const videoConstraints: MediaTrackConstraints = {};

    // Apply Resolution Constraints
    if (quality === '720p') {
      videoConstraints.width = { ideal: 1280, max: 1280 };
      videoConstraints.height = { ideal: 720, max: 720 };
    } else if (quality === '1080p') {
      videoConstraints.width = { ideal: 1920, max: 1920 };
      videoConstraints.height = { ideal: 1080, max: 1080 };
    } else {
      videoConstraints.width = { ideal: 1920 };
      videoConstraints.height = { ideal: 1080 };
    }

    // Apply Frame Rate Constraints
    if (fps === '30 FPS') {
      videoConstraints.frameRate = { ideal: 30, max: 30 };
    } else if (fps === '60 FPS') {
      videoConstraints.frameRate = { ideal: 60, max: 60 };
    } else {
      videoConstraints.frameRate = { ideal: 30 };
    }

    return await navigator.mediaDevices.getDisplayMedia({
      video: videoConstraints,
      audio: true,
    });
  }

  public pause(): void {
    if (!this.currentStream || this.isPaused) return;
    this.currentStream.getVideoTracks().forEach((track) => {
      track.enabled = false;
    });
    this.isPaused = true;
    this.updateSession({ status: 'PAUSED' });
    if (this.currentSession) {
      this.signaling.sendProjectorPause(this.currentSession.sessionId);
    }
  }

  public resume(): void {
    if (!this.currentStream || !this.isPaused) return;
    this.currentStream.getVideoTracks().forEach((track) => {
      track.enabled = true;
    });
    this.isPaused = false;
    this.updateSession({ status: 'STREAMING' });
    if (this.currentSession) {
      this.signaling.sendProjectorResume(this.currentSession.sessionId);
    }
  }

  public handleReconnect(): void {
    if (!this.currentSession) return;
    this.updateSession({ status: 'RECONNECTING' });
    setTimeout(async () => {
      if (this.currentSession && this.currentStream) {
        try {
          const offer = await this.webrtc.createOffer();
          if (offer.sdp) {
            this.signaling.sendOffer(
              this.currentSession.sessionId,
              offer.sdp,
              this.currentSession.sourceDevice,
              this.currentSession.targetDevice
            );
          }
        } catch (e) {
          this.updateSession({ status: 'FAILED', errorMessage: 'Reconnection renegotiation failed' });
        }
      }
    }, 2000);
  }

  public stop(reason = 'User stopped projecting'): void {
    if (this.currentSession && this.currentSession.status !== 'STOPPED') {
      this.signaling.sendProjectorStop(this.currentSession.sessionId, reason);
      this.updateSession({ status: 'STOPPED' });
    }

    // Stop and cleanup all MediaStream tracks
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      this.currentStream = null;
    }

    // Close WebRTC PeerConnection and clear monitoring
    this.webrtc.close();
    this.signaling.setCurrentSessionId(null);
    this.isPaused = false;
  }
}
