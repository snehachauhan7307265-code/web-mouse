import React, { useState, useEffect, useRef } from 'react';
import { 
  Cast, 
  Smartphone, 
  Tv, 
  FlaskConical, 
  ShieldCheck, 
  AlertCircle, 
  Info,
  Maximize2,
  Video
} from 'lucide-react';
import { Device, OutgoingMessage, IncomingMessage } from '../../types';
import { ScreenProjectorService } from '../../features/projector/ScreenProjector';
import { 
  ProjectorSession, 
  ProjectorStats as StatsData, 
  ProjectorQuality, 
  ProjectorFps 
} from '../../features/projector/projectorTypes';
import { DeviceSelector } from './DeviceSelector';
import { ProjectionControls } from './ProjectionControls';
import { ProjectionStats } from './ProjectionStats';
import { ScreenShareConfirmModal } from './ScreenShareConfirmModal';
import { triggerHaptic } from '../../services/websocketService';

interface ProjectorPanelProps {
  devices: Device[];
  activeDevice: Device | null;
  onSendMessage: (msg: OutgoingMessage) => void;
  lastIncomingMessage?: IncomingMessage | null;
  vibrationEnabled?: boolean;
}

export const ProjectorPanel: React.FC<ProjectorPanelProps> = ({
  devices,
  activeDevice,
  onSendMessage,
  lastIncomingMessage,
  vibrationEnabled = true,
}) => {
  // Service instance held in ref
  const projectorRef = useRef<ScreenProjectorService | null>(null);

  // Target device
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(() => {
    return activeDevice || (devices.length > 0 ? devices[0] : null);
  });

  // Settings
  const [quality, setQuality] = useState<ProjectorQuality>('Auto');
  const [fps, setFps] = useState<ProjectorFps>('Auto');

  // Session & Stats state
  const [session, setSession] = useState<ProjectorSession | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);

  // Safety Confirmation Modal
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Local Preview Video
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // WebRTC Test Mode active state
  const [isTestMode, setIsTestMode] = useState(false);

  // Initialize ScreenProjectorService
  useEffect(() => {
    projectorRef.current = new ScreenProjectorService(onSendMessage);

    const unsubSession = projectorRef.current.onSessionChange((newSession) => {
      setSession({ ...newSession });
      // Attach local stream to preview video element if streaming
      const stream = projectorRef.current?.getStream();
      if (videoPreviewRef.current && stream) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }
    });

    const unsubStats = projectorRef.current.onStatsChange((newStats) => {
      setStats({ ...newStats });
    });

    return () => {
      unsubSession();
      unsubStats();
      projectorRef.current?.stop('Component unmounted');
    };
  }, []);

  // Update send function when prop changes
  useEffect(() => {
    projectorRef.current?.updateSendFunction(onSendMessage);
  }, [onSendMessage]);

  // Forward incoming WebSocket messages to projector signaling manager
  useEffect(() => {
    if (lastIncomingMessage && projectorRef.current) {
      projectorRef.current.getSignalingManager().handleIncomingMessage(lastIncomingMessage);
    }
  }, [lastIncomingMessage]);

  // Update selected device if activeDevice changes and none is selected
  useEffect(() => {
    if (!selectedDevice && activeDevice) {
      setSelectedDevice(activeDevice);
    }
  }, [activeDevice]);

  const handleStartClicked = () => {
    if (!selectedDevice) return;
    triggerHaptic('medium', vibrationEnabled);
    setIsConfirmOpen(true);
  };

  const handleConfirmedStart = async () => {
    setIsConfirmOpen(false);
    if (!projectorRef.current || !selectedDevice) return;

    try {
      await projectorRef.current.start(
        'Phone Controller',
        selectedDevice.name,
        quality,
        fps
      );
      triggerHaptic('double', vibrationEnabled);
    } catch (e: any) {
      triggerHaptic('error', vibrationEnabled);
    }
  };

  const handlePause = () => {
    triggerHaptic('light', vibrationEnabled);
    projectorRef.current?.pause();
  };

  const handleResume = () => {
    triggerHaptic('light', vibrationEnabled);
    projectorRef.current?.resume();
  };

  const handleStop = () => {
    triggerHaptic('medium', vibrationEnabled);
    projectorRef.current?.stop('User stopped projection');
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  };

  const currentStatus = session?.status || 'IDLE';
  const isStreaming = currentStatus === 'STREAMING' || currentStatus === 'PAUSED';

  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4 pb-12 bg-zinc-950 text-white select-none">
      {/* Header Card */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-zinc-900/80 to-zinc-950 border border-indigo-500/30 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400">
              <Cast className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Screen Projector</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  WebRTC P2P
                </span>
              </div>
              <p className="text-xs text-zinc-400">Stream screen in real-time with ultra-low latency</p>
            </div>
          </div>

          {/* WebRTC Test Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsTestMode(!isTestMode)}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all flex items-center gap-1.5 ${
              isTestMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
            }`}
            title="Toggle WebRTC Test Mode for browser-to-browser validation"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>{isTestMode ? 'Test Mode: ON' : '🧪 Test Mode'}</span>
          </button>
        </div>

        {/* Source & Target Display */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/80 text-xs">
          <div className="flex items-center gap-2 p-2 bg-zinc-950/60 rounded-xl border border-zinc-800/60">
            <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-zinc-500 font-semibold block">SOURCE</span>
              <span className="font-bold text-white truncate block">This Device</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 bg-zinc-950/60 rounded-xl border border-zinc-800/60">
            <Tv className="w-4 h-4 text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-zinc-500 font-semibold block">TARGET</span>
              <span className="font-bold text-white truncate block">
                {selectedDevice ? selectedDevice.name : 'None Selected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Target Device Selector */}
      <DeviceSelector
        devices={devices}
        selectedDevice={selectedDevice}
        onSelectDevice={setSelectedDevice}
        disabled={isStreaming}
      />

      {/* Main Projection Controls (Quality, FPS, Start/Pause/Stop) */}
      <ProjectionControls
        status={currentStatus}
        quality={quality}
        fps={fps}
        onChangeQuality={setQuality}
        onChangeFps={setFps}
        onStart={handleStartClicked}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        isTargetSelected={Boolean(selectedDevice)}
      />

      {/* Live Stream Telemetry Stats */}
      {session && session.status !== 'IDLE' && (
        <ProjectionStats session={session} stats={stats} />
      )}

      {/* Live Video Preview Surface */}
      {isStreaming && (
        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-2 font-bold text-zinc-300">
              <Video className="w-4 h-4 text-indigo-400" />
              <span>Local Monitor Preview</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Transmitting</span>
          </div>

          <div className="relative aspect-video rounded-xl bg-zinc-950 overflow-hidden border border-zinc-800">
            <video
              ref={videoPreviewRef}
              muted
              playsInline
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Platform Architecture & Native Android Notice */}
      <div className="p-3.5 bg-zinc-900/60 rounded-2xl border border-zinc-800/80 text-xs text-zinc-400 space-y-2">
        <div className="flex items-center gap-2 text-indigo-300 font-semibold">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>Platform Capabilities & Android TV Integration</span>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-400">
          <strong>Supported Now:</strong> Real-time browser screen capture (Entire Screen, App Window, or Chrome Tab) streaming directly to PC, Smart Board, or Android TV WebMouse Receiver over WebRTC.
        </p>
        <p className="text-[11px] leading-relaxed text-zinc-500">
          <strong>Requires Native Android Receiver:</strong> Capturing and mirroring the Android TV's system-level OS interface requires installing the native Android TV Receiver module with <code className="text-zinc-400">MediaProjection</code> permissions.
        </p>
      </div>

      {/* Safety Confirmation Modal */}
      <ScreenShareConfirmModal
        isOpen={isConfirmOpen}
        targetDevice={selectedDevice}
        onConfirm={handleConfirmedStart}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
};
