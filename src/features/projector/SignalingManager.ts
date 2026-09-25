/**
 * WebMouse V2 — Projector Signaling Manager
 * Routes WebRTC offer/answer/ICE candidates through the authenticated
 * WebSocket/Peer link with session identification.
 */

import { OutgoingMessage, IncomingMessage } from '../../types';
import { WebRTCSignalingMessage } from './projectorTypes';

export type SignalingCallback = (message: WebRTCSignalingMessage) => void;

export class SignalingManager {
  private sendFn: (msg: OutgoingMessage) => void;
  private listeners: Set<SignalingCallback> = new Set();
  private currentSessionId: string | null = null;

  constructor(sendFn: (msg: OutgoingMessage) => void) {
    this.sendFn = sendFn;
  }

  public setSendFunction(fn: (msg: OutgoingMessage) => void) {
    this.sendFn = fn;
  }

  public setCurrentSessionId(sessionId: string | null) {
    this.currentSessionId = sessionId;
  }

  public addListener(callback: SignalingCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public sendOffer(sessionId: string, sdp: string, fromDevice: string, toDevice: string) {
    this.sendFn({
      type: 'webrtc_offer',
      sessionId,
      sdp,
      fromDevice,
      toDevice,
    });
  }

  public sendAnswer(sessionId: string, sdp: string, fromDevice: string, toDevice: string) {
    this.sendFn({
      type: 'webrtc_answer',
      sessionId,
      sdp,
      fromDevice,
      toDevice,
    });
  }

  public sendIceCandidate(sessionId: string, candidate: any, fromDevice?: string, toDevice?: string) {
    this.sendFn({
      type: 'webrtc_ice_candidate',
      sessionId,
      candidate,
      fromDevice,
      toDevice,
    });
  }

  public sendProjectorStart(sessionId: string, sourceDevice: string, targetDevice: string, quality?: string, fps?: number) {
    this.sendFn({
      type: 'projector_start',
      sessionId,
      sourceDevice,
      targetDevice,
      quality,
      fps,
    });
  }

  public sendProjectorStop(sessionId: string, reason?: string) {
    this.sendFn({
      type: 'projector_stop',
      sessionId,
      reason,
    });
  }

  public sendProjectorPause(sessionId: string) {
    this.sendFn({
      type: 'projector_pause',
      sessionId,
    });
  }

  public sendProjectorResume(sessionId: string) {
    this.sendFn({
      type: 'projector_resume',
      sessionId,
    });
  }

  /**
   * Dispatches incoming WebSocket / Channel messages to active listeners
   */
  public handleIncomingMessage(msg: IncomingMessage) {
    if (!msg || typeof msg !== 'object') return;

    if (
      msg.type === 'webrtc_offer' ||
      msg.type === 'webrtc_answer' ||
      msg.type === 'webrtc_ice_candidate' ||
      msg.type === 'projector_start' ||
      msg.type === 'projector_stop' ||
      msg.type === 'projector_pause' ||
      msg.type === 'projector_resume'
    ) {
      const sigMsg = msg as WebRTCSignalingMessage;
      // If we have an active session, verify or accept matching sessionId
      if (this.currentSessionId && sigMsg.sessionId && sigMsg.sessionId !== this.currentSessionId) {
        // Ignore messages for other/stale sessions
        return;
      }
      this.listeners.forEach((listener) => {
        try {
          listener(sigMsg);
        } catch (e) {
          console.error('[SignalingManager] Listener error:', e);
        }
      });
    }
  }
}
