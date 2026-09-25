/**
 * WebMouse V2 — Projector Types & State Definitions
 */

export type ProjectorState =
  | 'IDLE'
  | 'CONNECTING'
  | 'WAITING_FOR_PERMISSION'
  | 'NEGOTIATING'
  | 'CONNECTED'
  | 'STREAMING'
  | 'PAUSED'
  | 'RECONNECTING'
  | 'STOPPED'
  | 'FAILED';

export type ProjectorQuality = 'Auto' | '720p' | '1080p';
export type ProjectorFps = 'Auto' | '30 FPS' | '60 FPS';

export interface ProjectorSession {
  sessionId: string;
  sourceDevice: string;
  targetDevice: string;
  startTime: number;
  status: ProjectorState;
  connectionState: RTCPeerConnectionState;
  latency: number;
  resolution: string;
  frameRate: number;
  quality: ProjectorQuality;
  fps: ProjectorFps;
  errorMessage?: string;
}

export interface ProjectorStats {
  latencyMs: number;
  width: number;
  height: number;
  fps: number;
  bytesSent?: number;
  bitrateKbps?: number;
}

export interface WebRTCSignalingMessage {
  type: 'webrtc_offer' | 'webrtc_answer' | 'webrtc_ice_candidate' | 'projector_start' | 'projector_stop' | 'projector_pause' | 'projector_resume';
  sessionId: string;
  fromDevice?: string;
  toDevice?: string;
  sdp?: string;
  candidate?: any;
  quality?: string;
  fps?: number;
  reason?: string;
}
