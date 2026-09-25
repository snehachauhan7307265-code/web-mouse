/**
 * WebMouse V2 — WebRTC PeerConnection Manager
 * Manages RTCPeerConnection lifecycle, SDP exchange, ICE candidate routing,
 * track attachment, and real-time WebRTC stats monitoring.
 */

import { ProjectorStats } from './projectorTypes';

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private statsInterval: any = null;

  public createPeerConnection(
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onTrack: (event: RTCTrackEvent) => void,
    onConnectionStateChange: (state: RTCPeerConnectionState) => void
  ): RTCPeerConnection {
    this.close();

    const config: RTCConfiguration = {
      iceServers: DEFAULT_ICE_SERVERS,
      bundlePolicy: 'max-bundle',
    };

    const pc = new RTCPeerConnection(config);
    this.pc = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    pc.ontrack = (event) => {
      onTrack(event);
    };

    pc.onconnectionstatechange = () => {
      onConnectionStateChange(pc.connectionState);
    };

    return pc;
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    const offer = await this.pc.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: true,
    });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  public async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  public async setRemoteDescription(sdp: string, type: 'offer' | 'answer'): Promise<void> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    const sessionDesc = new RTCSessionDescription({
      type,
      sdp,
    });
    await this.pc.setRemoteDescription(sessionDesc);
  }

  public async addIceCandidate(candidateInit: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidateInit));
    } catch (e) {
      console.warn('[WebRTCManager] Failed to add ICE candidate:', e);
    }
  }

  public addStreamTracks(stream: MediaStream): void {
    if (!this.pc) return;
    stream.getTracks().forEach((track) => {
      this.pc?.addTrack(track, stream);
    });
  }

  public startStatsMonitoring(
    onStats: (stats: ProjectorStats) => void,
    intervalMs = 1500
  ): void {
    this.stopStatsMonitoring();
    let lastBytesSent = 0;
    let lastTimestamp = Date.now();

    this.statsInterval = setInterval(async () => {
      if (!this.pc || this.pc.connectionState !== 'connected') return;

      try {
        const statsReport = await this.pc.getStats();
        let latencyMs = 0;
        let width = 0;
        let height = 0;
        let fps = 0;
        let bytesSent = 0;
        let bitrateKbps = 0;

        statsReport.forEach((report) => {
          // Candidate-pair RTT for real round-trip latency
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime !== undefined) {
              latencyMs = Math.round(report.currentRoundTripTime * 1000);
            }
          }
          // Outbound RTP video track stats (Sender)
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            if (report.framesPerSecond !== undefined) fps = report.framesPerSecond;
            if (report.frameWidth !== undefined) width = report.frameWidth;
            if (report.frameHeight !== undefined) height = report.frameHeight;
            if (report.bytesSent !== undefined) bytesSent = report.bytesSent;
          }
          // Inbound RTP video track stats (Receiver)
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            if (report.framesPerSecond !== undefined) fps = report.framesPerSecond;
            if (report.frameWidth !== undefined) width = report.frameWidth;
            if (report.frameHeight !== undefined) height = report.frameHeight;
          }
          // Track stats fallback
          if (report.type === 'track' && report.kind === 'video') {
            if (report.frameWidth) width = report.frameWidth;
            if (report.frameHeight) height = report.frameHeight;
            if (report.framesPerSecond) fps = report.framesPerSecond;
          }
        });

        const now = Date.now();
        const durationSec = (now - lastTimestamp) / 1000;
        if (durationSec > 0 && bytesSent > lastBytesSent && lastBytesSent > 0) {
          bitrateKbps = Math.round(((bytesSent - lastBytesSent) * 8) / (durationSec * 1024));
        }
        lastBytesSent = bytesSent;
        lastTimestamp = now;

        onStats({
          latencyMs,
          width,
          height,
          fps,
          bytesSent,
          bitrateKbps,
        });
      } catch (e) {
        // Ignore stats errors during renegotiation
      }
    }, intervalMs);
  }

  public stopStatsMonitoring(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  public getPeerConnection(): RTCPeerConnection | null {
    return this.pc;
  }

  public close(): void {
    this.stopStatsMonitoring();
    if (this.pc) {
      try {
        this.pc.onicecandidate = null;
        this.pc.ontrack = null;
        this.pc.onconnectionstatechange = null;
        this.pc.close();
      } catch (e) {
        // Ignore close error
      }
      this.pc = null;
    }
  }
}
