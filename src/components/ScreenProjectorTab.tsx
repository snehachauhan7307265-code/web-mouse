import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MonitorUp, StopCircle, Video, AlertCircle } from 'lucide-react';
import { ConnectionStatus, ConnectedDeviceInfo, IncomingMessage, OutgoingMessage } from '../types';

interface ScreenProjectorTabProps {
  onSendMessage: (msg: OutgoingMessage) => void;
  webrtcMessages: IncomingMessage[];
  status: ConnectionStatus;
  deviceInfo: ConnectedDeviceInfo | null;
  isDark: boolean;
}

export function ScreenProjectorTab({
  onSendMessage,
  webrtcMessages,
  status,
  deviceInfo,
  isDark,
}: ScreenProjectorTabProps) {
  const [projectorState, setProjectorState] = useState<'ready' | 'projecting' | 'viewing'>('ready');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const processedIndexRef = useRef(0);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);

  // Stop everything
  const stopProjection = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    iceCandidateQueueRef.current = [];
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setProjectorState('ready');
  }, []);

  // Handle incoming signaling queue
  useEffect(() => {
    const processQueue = async () => {
      while (processedIndexRef.current < webrtcMessages.length) {
        const msg = webrtcMessages[processedIndexRef.current];
        processedIndexRef.current++;

        if (msg.type !== 'webrtc_signaling') continue;
        const { signalType, payload } = msg;

        try {
          if (signalType === 'stop') {
            stopProjection();
            setErrorMsg('Projection stopped by remote device.');
            continue;
          }

          if (signalType === 'offer') {
            // We are the VIEWER
            setProjectorState('viewing');
            
            if (!pcRef.current) {
              pcRef.current = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
              });

              pcRef.current.ontrack = (event) => {
                if (remoteVideoRef.current && event.streams && event.streams[0]) {
                  remoteVideoRef.current.srcObject = event.streams[0];
                }
              };

              pcRef.current.onicecandidate = (event) => {
                if (event.candidate) {
                  onSendMessage({
                    type: 'webrtc_signaling',
                    signalType: 'ice_candidate',
                    payload: event.candidate,
                  });
                }
              };
            }

            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload));
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);

            // Process any queued ICE candidates that arrived before the offer was fully processed
            while (iceCandidateQueueRef.current.length > 0) {
              const candidate = iceCandidateQueueRef.current.shift();
              if (candidate) {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
              }
            }

            onSendMessage({
              type: 'webrtc_signaling',
              signalType: 'answer',
              payload: answer,
            });
          }

          if (signalType === 'answer' && pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload));
            
            // Process queued candidates
            while (iceCandidateQueueRef.current.length > 0) {
              const candidate = iceCandidateQueueRef.current.shift();
              if (candidate) {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
              }
            }
          }

          if (signalType === 'ice_candidate' && pcRef.current) {
            if (pcRef.current.remoteDescription) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(payload));
            } else {
              iceCandidateQueueRef.current.push(payload);
            }
          }
        } catch (err: any) {
          console.error('WebRTC Signaling Error:', err);
        }
      }
    };
    
    processQueue();
  }, [webrtcMessages, stopProjection, onSendMessage]);

  // Start Projection
  const handleStartProjection = async () => {
    setErrorMsg(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setErrorMsg('Screen sharing is not supported by this browser/device.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      localStreamRef.current = stream;

      stream.getVideoTracks()[0].onended = () => {
        // User stopped sharing via browser UI
        onSendMessage({ type: 'webrtc_signaling', signalType: 'stop' });
        stopProjection();
      };

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setProjectorState('projecting');

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          onSendMessage({
            type: 'webrtc_signaling',
            signalType: 'ice_candidate',
            payload: event.candidate,
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      onSendMessage({
        type: 'webrtc_signaling',
        signalType: 'offer',
        payload: offer,
      });

    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start screen sharing.');
    }
  };

  const handleStopProjection = () => {
    onSendMessage({ type: 'webrtc_signaling', signalType: 'stop' });
    stopProjection();
  };

  if (status !== 'connected') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-zinc-600 mb-4" />
        <h2 className="text-xl font-bold text-zinc-300 mb-2">Not Connected</h2>
        <p className="text-zinc-500 text-sm">Please connect to a Windows PC first.</p>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col p-6 overflow-y-auto ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl">
          <MonitorUp className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Screen Projector</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Project to {deviceInfo?.computerName || 'Laptop'}</p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      {projectorState === 'ready' && (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-3xl p-6 text-center">
          <Video className="w-12 h-12 text-zinc-700 mb-4" />
          <h3 className="text-lg font-semibold text-zinc-200 mb-2">Ready to Project</h3>
          <p className="text-sm text-zinc-500 mb-6 max-w-[250px]">
            Share your screen securely with the connected computer.
          </p>
          <button
            onClick={handleStartProjection}
            className="w-full max-w-[200px] py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2"
          >
            <MonitorUp className="w-5 h-5" />
            Start Projection
          </button>
        </div>
      )}

      {projectorState === 'projecting' && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full aspect-[9/16] max-h-[50vh] bg-black rounded-3xl overflow-hidden mb-6 border border-zinc-800 shadow-2xl relative">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-xs font-semibold text-white">Projecting Live</span>
            </div>
          </div>
          <button
            onClick={handleStopProjection}
            className="w-full py-4 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-rose-400 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <StopCircle className="w-5 h-5" />
            Stop Projection
          </button>
        </div>
      )}

      {projectorState === 'viewing' && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full aspect-[9/16] max-h-[60vh] bg-black rounded-3xl overflow-hidden mb-6 border border-zinc-800 shadow-2xl relative">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-white">Viewing Remote Screen</span>
            </div>
          </div>
          <button
            onClick={handleStopProjection}
            className="w-full py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-2xl font-bold transition-all active:scale-95"
          >
            Close Viewer
          </button>
        </div>
      )}
    </div>
  );
}
