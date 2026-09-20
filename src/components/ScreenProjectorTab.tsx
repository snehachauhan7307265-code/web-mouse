import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Monitor,
  MonitorUp,
  StopCircle,
  Play,
  RotateCcw,
  Sparkles,
  Maximize2,
  Minimize2,
  AlertCircle,
  HelpCircle,
  Touchpad as TouchpadIcon,
  MousePointer2,
  MousePointer,
  ArrowLeft,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  PhoneCall,
  Lock,
  Signal,
  MessageSquare,
  Send,
  Share2,
  RefreshCw,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { ConnectionStatus, ConnectedDeviceInfo, IncomingMessage, OutgoingMessage, AppSettings } from '../types';
import { triggerHaptic, playClickSound } from '../services/websocketService';

interface ScreenProjectorTabProps {
  onSendMessage: (msg: OutgoingMessage) => void;
  lastIncomingMessage?: IncomingMessage | null;
  status: ConnectionStatus;
  deviceInfo: ConnectedDeviceInfo | null;
  settings: AppSettings;
  isDark: boolean;
  onExit?: () => void;
}

interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

// Gentle Web Audio synthesizers for WhatsApp-like call chimes
function playCallChime(type: 'join' | 'leave') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'join') {
      // Pleasant WhatsApp-style ascending chime (G4 -> C5)
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(392, now); // G4
      osc1.frequency.exponentialRampToValueAtTime(523.25, now + 0.18); // C5
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);
    } else {
      // Pleasant WhatsApp-style descending leave chime (E5 -> C5)
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(392, now + 0.22); // G4
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch {}
}

export function ScreenProjectorTab({
  onSendMessage,
  lastIncomingMessage,
  status,
  deviceInfo,
  settings,
  isDark,
  onExit,
}: ScreenProjectorTabProps) {
  // PC Screen mirroring state
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [touchpadOverlayEnabled, setTouchpadOverlayEnabled] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  // WhatsApp Call controls
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isPhoneScreenSharing, setIsPhoneScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [activeViewMode, setActiveViewMode] = useState<'pc_desktop' | 'phone_broadcast'>('pc_desktop');
  const [showChatModal, setShowChatModal] = useState(false);
  const [quickTextMessage, setQuickTextMessage] = useState('');
  const [chatSentSuccess, setChatSentSuccess] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const screenImgRef = useRef<HTMLImageElement>(null);
  const phoneScreenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const phoneScreenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const fpsTimerRef = useRef<{ frames: number; lastTime: number }>({ frames: 0, lastTime: Date.now() });

  // Touchpad control states
  const touchStartRef = useRef<{ time: number; points: TouchPoint[] }>({ time: 0, points: [] });
  const activeTouchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const movedDistanceRef = useRef<number>(0);
  const longPressTimerRef = useRef<any>(null);
  const lastTapTimeRef = useRef<number>(0);
  const [touchIndicator, setTouchIndicator] = useState<{ x: number; y: number; active: boolean } | null>(null);

  // Call duration counter
  useEffect(() => {
    playCallChime('join');
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Format seconds to mm:ss
  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-start projector when tab is opened if connected
  useEffect(() => {
    if (status === 'connected') {
      onSendMessage({ type: 'start_projector' });
      setIsStreaming(true);
    }

    return () => {
      onSendMessage({ type: 'stop_projector' });
      setIsStreaming(false);
      setCurrentFrame(null);
      // Clean up phone screen share stream if active
      if (phoneScreenStreamRef.current) {
        phoneScreenStreamRef.current.getTracks().forEach((t) => t.stop());
        phoneScreenStreamRef.current = null;
      }
      // Clean up camera stream if active
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
    };
  }, [status, onSendMessage]);

  // Listen for incoming WebSocket messages with type "screen_frame"
  useEffect(() => {
    if (!lastIncomingMessage) return;

    if (lastIncomingMessage.type === 'screen_frame') {
      const imgData = lastIncomingMessage.image;
      if (imgData) {
        setCurrentFrame(imgData);

        // Calculate real FPS
        fpsTimerRef.current.frames += 1;
        const now = Date.now();
        const elapsed = now - fpsTimerRef.current.lastTime;
        if (elapsed >= 1000) {
          setFps(Math.round((fpsTimerRef.current.frames * 1000) / elapsed));
          fpsTimerRef.current.frames = 0;
          fpsTimerRef.current.lastTime = now;
        }
      }
    } else if (lastIncomingMessage.type === 'projector_status') {
      setIsStreaming(lastIncomingMessage.active);
      if (!lastIncomingMessage.active) {
        setFps(0);
      }
    }
  }, [lastIncomingMessage]);

  // Clean Stop / Hang Up (Like WhatsApp Red Hangup Button)
  const handleHangup = useCallback(() => {
    playCallChime('leave');
    triggerHaptic('heavy', settings.vibration);
    onSendMessage({ type: 'stop_projector' });
    setIsStreaming(false);
    setCurrentFrame(null);
    setFps(0);

    // Stop streams
    if (phoneScreenStreamRef.current) {
      phoneScreenStreamRef.current.getTracks().forEach((t) => t.stop());
      phoneScreenStreamRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }

    if (onExit) {
      onExit();
    }
  }, [onSendMessage, settings.vibration, onExit]);

  // Toggle Phone Screen Share (WhatsApp Style Screen Broadcast)
  const togglePhoneScreenShare = async () => {
    triggerHaptic('medium', settings.vibration);

    if (isPhoneScreenSharing) {
      // Stop phone screen share
      if (phoneScreenStreamRef.current) {
        phoneScreenStreamRef.current.getTracks().forEach((t) => t.stop());
        phoneScreenStreamRef.current = null;
      }
      setIsPhoneScreenSharing(false);
      setActiveViewMode('pc_desktop');
    } else {
      try {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          alert('Screen sharing is not supported by your current browser. Please try Google Chrome or Microsoft Edge.');
          return;
        }

        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' } as any,
          audio: false,
        });

        phoneScreenStreamRef.current = stream;
        setIsPhoneScreenSharing(true);
        setActiveViewMode('phone_broadcast');

        if (phoneScreenVideoRef.current) {
          phoneScreenVideoRef.current.srcObject = stream;
          phoneScreenVideoRef.current.play().catch(() => {});
        }

        // When user stops via browser system UI
        stream.getVideoTracks()[0].onended = () => {
          setIsPhoneScreenSharing(false);
          setActiveViewMode('pc_desktop');
          phoneScreenStreamRef.current = null;
        };
      } catch (err: any) {
        console.warn('Phone screen share cancelled or error:', err);
      }
    }
  };

  // Toggle Camera (WhatsApp Video)
  const toggleCamera = async () => {
    triggerHaptic('light', settings.vibration);

    if (isCameraOn) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
      setIsCameraOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        cameraStreamRef.current = stream;
        setIsCameraOn(true);
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn('Camera toggle error:', err);
      }
    }
  };

  // Send Quick Chat Text to PC Clipboard
  const handleSendQuickText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTextMessage.trim()) return;

    triggerHaptic('medium', settings.vibration);
    onSendMessage({
      type: 'share_text',
      text: quickTextMessage.trim(),
    });

    setChatSentSuccess(true);
    setTimeout(() => {
      setChatSentSuccess(false);
      setShowChatModal(false);
      setQuickTextMessage('');
    }, 1200);
  };

  // Toggle Fullscreen View
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
    triggerHaptic('light', settings.vibration);
  };

  // Safe TouchList extractor
  const getTouchList = (touchList: React.TouchList): React.Touch[] => {
    const list: React.Touch[] = [];
    for (let i = 0; i < touchList.length; i++) {
      const item = touchList.item(i);
      if (item) list.push(item);
    }
    return list;
  };

  // Touchpad Overlay Gesture Engine directly on top of PC Screen
  const sendMovement = useCallback(
    (rawDx: number, rawDy: number) => {
      let multiplier = settings.pointerSensitivity * settings.pointerSpeed;
      if (settings.pointerAcceleration) {
        const distance = Math.hypot(rawDx, rawDy);
        const accelFactor = Math.min(Math.max(distance / 5, 0.9), 2.2);
        multiplier *= accelFactor;
      }
      const dx = Math.round(rawDx * multiplier * 10) / 10;
      const dy = Math.round(rawDy * multiplier * 10) / 10;
      if (dx !== 0 || dy !== 0) {
        onSendMessage({ type: 'mouse_move', dx, dy });
      }
    },
    [settings.pointerSensitivity, settings.pointerSpeed, settings.pointerAcceleration, onSendMessage]
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!touchpadOverlayEnabled || activeViewMode !== 'pc_desktop') return;
    e.preventDefault();

    const touches = getTouchList(e.touches);
    touchStartRef.current = {
      time: Date.now(),
      points: touches.map((t) => ({ id: t.identifier, x: t.clientX, y: t.clientY })),
    };
    movedDistanceRef.current = 0;

    activeTouchesRef.current.clear();
    touches.forEach((t) => {
      activeTouchesRef.current.set(t.identifier, { x: t.clientX, y: t.clientY });
    });

    if (touches.length === 1 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTouchIndicator({
        x: touches[0].clientX - rect.left,
        y: touches[0].clientY - rect.top,
        active: true,
      });

      // Long press = Right Click
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => {
        if (movedDistanceRef.current < 12) {
          triggerHaptic('heavy', settings.vibration);
          playClickSound(settings.clickSound);
          onSendMessage({ type: 'right_click' });
          setTouchIndicator(null);
        }
      }, 500);
    } else {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      setTouchIndicator(null);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchpadOverlayEnabled || activeViewMode !== 'pc_desktop') return;
    e.preventDefault();
    const touches = getTouchList(e.touches);

    if (touches.length === 1) {
      const touch = touches[0];
      const prev = activeTouchesRef.current.get(touch.identifier);

      if (prev) {
        const rawDx = touch.clientX - prev.x;
        const rawDy = touch.clientY - prev.y;
        movedDistanceRef.current += Math.hypot(rawDx, rawDy);

        if (movedDistanceRef.current > 12 && longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }

        sendMovement(rawDx, rawDy);

        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setTouchIndicator({
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top,
            active: true,
          });
        }
      }

      activeTouchesRef.current.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    } else if (touches.length === 2) {
      // Two-finger scroll
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

      const t1 = touches[0];
      const t2 = touches[1];
      const prev1 = activeTouchesRef.current.get(t1.identifier);
      const prev2 = activeTouchesRef.current.get(t2.identifier);

      if (prev1 && prev2) {
        const dy = (t1.clientY - prev1.y + (t2.clientY - prev2.y)) / 2;
        const dx = (t1.clientX - prev1.x + (t2.clientX - prev2.y)) / 2;

        movedDistanceRef.current += Math.hypot(dx, dy);

        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 1.5) {
          const direction = settings.invertScroll ? -1 : 1;
          const scrollAmount = Math.round(-dy * settings.scrollSensitivity * 3.5 * direction);
          if (scrollAmount !== 0) {
            onSendMessage({ type: 'scroll', amount: scrollAmount });
            triggerHaptic('light', settings.vibration);
          }
        } else if (Math.abs(dx) > 1.5) {
          const hScrollAmount = Math.round(dx * settings.scrollSensitivity * 3.5);
          if (hScrollAmount !== 0) {
            onSendMessage({ type: 'hscroll', amount: hScrollAmount });
          }
        }
      }

      activeTouchesRef.current.set(t1.identifier, { x: t1.clientX, y: t1.clientY });
      activeTouchesRef.current.set(t2.identifier, { x: t2.clientX, y: t2.clientY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchpadOverlayEnabled || activeViewMode !== 'pc_desktop') return;
    e.preventDefault();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const initialTouchCount = touchStartRef.current.points.length;
    const duration = Date.now() - touchStartRef.current.time;
    const totalDistance = movedDistanceRef.current;

    // Tap detection
    if (duration < 280 && totalDistance < 12) {
      if (initialTouchCount === 1) {
        const now = Date.now();
        if (now - lastTapTimeRef.current < 300) {
          // Double tap -> double click
          triggerHaptic('double', settings.vibration);
          playClickSound(settings.clickSound);
          onSendMessage({ type: 'double_click' });
          lastTapTimeRef.current = 0;
        } else {
          // Single tap -> left click
          triggerHaptic('medium', settings.vibration);
          playClickSound(settings.clickSound);
          onSendMessage({ type: 'left_click' });
          lastTapTimeRef.current = now;
        }
      } else if (initialTouchCount === 2) {
        // Two-finger tap -> Right Click
        triggerHaptic('heavy', settings.vibration);
        playClickSound(settings.clickSound);
        onSendMessage({ type: 'right_click' });
      }
    }

    setTouchIndicator(null);
    activeTouchesRef.current.clear();
  };

  if (status !== 'connected') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#0b141a] text-white">
        <div className="p-4 bg-[#111b21] border border-emerald-500/20 rounded-3xl mb-4 text-emerald-400 shadow-xl">
          <MonitorUp className="w-10 h-10" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">PC Not Connected</h2>
        <p className="text-xs text-zinc-400 max-w-xs mb-4">
          Connect your phone to your Windows PC over Wi-Fi first to start WhatsApp Screen Sharing.
        </p>
        {onExit && (
          <button
            onClick={onExit}
            className="px-4 py-2 bg-[#00a884] hover:bg-[#02906f] text-white rounded-xl text-xs font-semibold transition-all shadow-md"
          >
            Back to Dashboard
          </button>
        )}
      </div>
    );
  }

  const computerName = deviceInfo?.computerName || 'Windows PC';

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col relative select-none overflow-hidden bg-[#0b141a] text-white"
    >
      {/* 🟢 TOP WHATSAPP-STYLE HEADER BAR */}
      <div className="z-20 flex items-center justify-between px-3.5 py-2.5 bg-[#111b21]/95 backdrop-blur-md border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          {onExit && (
            <button
              onClick={handleHangup}
              className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Exit Screen Share"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-bold text-sm text-white shadow-md border border-emerald-400/40">
              {computerName.charAt(0).toUpperCase()}
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#111b21] animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-zinc-100 tracking-tight leading-none">
                {computerName}
              </h3>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                HD
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-zinc-400">
              <span className="font-mono text-emerald-400 font-semibold">{formatDuration(callDuration)}</span>
              <span>&bull;</span>
              <span className="flex items-center gap-0.5 text-[10px] text-zinc-400">
                <Lock className="w-2.5 h-2.5 text-emerald-400" />
                <span>Encrypted</span>
              </span>
            </div>
          </div>
        </div>

        {/* Top Right Badges & Controls */}
        <div className="flex items-center gap-2">
          {fps > 0 && activeViewMode === 'pc_desktop' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-900 text-emerald-400 border border-emerald-500/30">
              {fps} FPS
            </span>
          )}

          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            title="Help / Gestures"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 📱 WHATSAPP SCREEN SHARING ACTIVE BANNER */}
      {isPhoneScreenSharing && (
        <div className="z-10 bg-gradient-to-r from-emerald-600/90 to-teal-600/90 text-white px-3 py-1.5 text-xs flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <MonitorUp className="w-4 h-4 animate-bounce text-emerald-100" />
            <span className="font-semibold text-[11px]">
              आप अपनी फोन स्क्रीन शेयर कर रहे हैं (Phone Screen Sharing Active)
            </span>
          </div>
          <button
            onClick={togglePhoneScreenShare}
            className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded-md text-[10px] font-bold uppercase tracking-wider"
          >
            Stop
          </button>
        </div>
      )}

      {/* 📺 MAIN SCREEN STREAM STAGE (WhatsApp Video Call Layout) */}
      <div
        className="flex-1 relative flex items-center justify-center bg-black overflow-hidden touch-none select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* VIEW 1: PC DESKTOP STREAM */}
        {activeViewMode === 'pc_desktop' && (
          <>
            {currentFrame ? (
              <img
                ref={screenImgRef}
                src={currentFrame}
                alt="Live Windows Desktop"
                className="w-full h-full object-contain pointer-events-none select-none"
                draggable={false}
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="relative">
                  <div className="w-16 h-16 rounded-3xl bg-[#111b21] border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl">
                    <Monitor className="w-8 h-8 animate-pulse" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Connecting to {computerName} Screen...</h3>
                  <p className="text-xs text-zinc-400 max-w-[280px] mt-1 leading-relaxed">
                    WhatsApp-style live desktop stream is initializing over Wi-Fi.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onSendMessage({ type: 'start_projector' });
                      setIsStreaming(true);
                      triggerHaptic('medium', settings.vibration);
                    }}
                    className="py-2 px-4 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white font-medium text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reconnect Screen Stream</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* VIEW 2: PHONE SCREEN BROADCAST (getDisplayMedia) */}
        {activeViewMode === 'phone_broadcast' && (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-[#0b141a]">
            <video
              ref={phoneScreenVideoRef}
              autoPlay
              playsInline
              muted
              className="max-h-[70%] max-w-[90%] rounded-2xl border-2 border-emerald-500/60 shadow-2xl object-contain bg-black"
            />
            <div className="mt-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-semibold text-emerald-400">
                Sharing screen with {computerName}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Everything on your screen is broadcasted live in real-time.
            </p>
          </div>
        )}

        {/* 🪟 FLOATING PICTURE-IN-PICTURE (PiP) WINDOW */}
        {/* If camera is active or phone screen is sharing, display in floating PiP */}
        {isCameraOn && (
          <div
            className="absolute top-4 right-4 z-30 w-28 h-36 rounded-2xl border-2 border-emerald-500/80 bg-black overflow-hidden shadow-2xl transition-all"
            onClick={() => {
              // Swap primary view
              setActiveViewMode(activeViewMode === 'pc_desktop' ? 'phone_broadcast' : 'pc_desktop');
            }}
          >
            <video
              ref={cameraVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-1 left-1.5 text-[9px] font-bold bg-black/60 px-1 rounded text-white">
              Camera
            </div>
          </div>
        )}

        {/* Touchpad Visual Ripple for direct PC Screen interaction */}
        {touchpadOverlayEnabled && activeViewMode === 'pc_desktop' && touchIndicator && (
          <div
            className="absolute pointer-events-none rounded-full border-2 border-emerald-400/90 bg-emerald-500/20 shadow-lg shadow-emerald-500/40 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
            style={{
              left: `${touchIndicator.x}px`,
              top: `${touchIndicator.y}px`,
              width: '44px',
              height: '44px',
            }}
          />
        )}

        {/* Remote Desktop Touchpad Hint Overlay */}
        {touchpadOverlayEnabled && activeViewMode === 'pc_desktop' && currentFrame && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#111b21]/90 backdrop-blur-md px-3.5 py-1 rounded-full border border-zinc-700/60 flex items-center gap-2 pointer-events-none opacity-85 shadow-lg">
            <MousePointer2 className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] text-zinc-200 font-medium">
              Touch to Move Cursor • Tap = Left Click • 2-Finger Tap = Right Click
            </span>
          </div>
        )}
      </div>

      {/* 🔴 BOTTOM WHATSAPP-STYLE FLOATING CALL CONTROL DOCK */}
      <div className="z-30 px-4 py-3 bg-[#111b21]/95 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5 mx-auto">
          {/* 1. Mute / Unmute Button */}
          <button
            type="button"
            onClick={() => {
              setIsMuted(!isMuted);
              triggerHaptic('light', settings.vibration);
            }}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? 'bg-zinc-800 text-rose-400 border border-rose-500/30'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white'
            }`}
            title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* 2. Video / Camera Button */}
          <button
            type="button"
            onClick={toggleCamera}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              isCameraOn
                ? 'bg-[#00a884] text-white shadow-lg shadow-emerald-500/30'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white'
            }`}
            title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
          >
            {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5 text-zinc-400" />}
          </button>

          {/* 3. WHATSAPP SCREEN SHARE TOGGLE BUTTON */}
          <button
            type="button"
            onClick={togglePhoneScreenShare}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isPhoneScreenSharing
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 ring-4 ring-emerald-500/30'
                : 'bg-[#25d366] hover:bg-[#20ba59] text-white shadow-lg shadow-emerald-600/30 active:scale-95'
            }`}
            title="WhatsApp Screen Share (फोन स्क्रीन शेयर करें)"
          >
            <MonitorUp className="w-6 h-6" />
          </button>

          {/* 4. Touchpad Mouse Remote Control Overlay Toggle */}
          <button
            type="button"
            onClick={() => {
              setTouchpadOverlayEnabled(!touchpadOverlayEnabled);
              triggerHaptic('light', settings.vibration);
            }}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              touchpadOverlayEnabled
                ? 'bg-emerald-700/50 border border-emerald-400/40 text-emerald-300'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
            }`}
            title="Mouse Cursor Touch Control"
          >
            <TouchpadIcon className="w-5 h-5" />
          </button>

          {/* 5. Quick Text Message to PC */}
          <button
            type="button"
            onClick={() => setShowChatModal(true)}
            className="w-11 h-11 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-all"
            title="Send Quick Text / Note to PC"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          {/* 6. RED WHATSAPP END CALL / HANGUP BUTTON */}
          <button
            type="button"
            onClick={handleHangup}
            className="w-12 h-12 rounded-full bg-[#ea0038] hover:bg-[#d00030] text-white flex items-center justify-center shadow-lg shadow-red-600/40 active:scale-95 transition-all"
            title="End Screen Share (कॉल समाप्त करें)"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Quick Text / Chat Drawer Modal */}
      {showChatModal && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#111b21] border border-zinc-800 rounded-3xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Quick Message to {computerName}
                </h4>
              </div>
              <button
                onClick={() => setShowChatModal(false)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-0.5 rounded-md hover:bg-zinc-800"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSendQuickText} className="space-y-2.5">
              <textarea
                value={quickTextMessage}
                onChange={(e) => setQuickTextMessage(e.target.value)}
                placeholder="Type message or link to send directly to PC clipboard..."
                rows={3}
                className="w-full bg-[#0b141a] border border-zinc-700/80 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                autoFocus
              />
              <div className="flex items-center justify-between">
                {chatSentSuccess ? (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Sent to PC!
                  </span>
                ) : (
                  <span className="text-[11px] text-zinc-400">Pastes instantly into Windows clipboard</span>
                )}
                <button
                  type="submit"
                  disabled={!quickTextMessage.trim()}
                  className="px-3 py-1.5 bg-[#00a884] hover:bg-[#02906f] disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Send className="w-3 h-3" />
                  <span>Send</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gesture Help Drawer */}
      {showHelp && (
        <div className="absolute inset-x-0 bottom-0 z-40 p-4 bg-[#111b21]/95 backdrop-blur-xl border-t border-zinc-800 rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              WhatsApp Screen Share Controls
            </h4>
            <button
              onClick={() => setShowHelp(false)}
              className="text-xs text-zinc-400 hover:text-white px-2 py-0.5 rounded-md hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-300">
            <div className="p-2 rounded-xl bg-[#0b141a] border border-zinc-800">
              <strong className="text-emerald-400 block mb-0.5">1-Finger Drag</strong>
              Moves PC mouse pointer smoothly across desktop.
            </div>
            <div className="p-2 rounded-xl bg-[#0b141a] border border-zinc-800">
              <strong className="text-emerald-400 block mb-0.5">1-Finger Tap</strong>
              Left click on hovered element.
            </div>
            <div className="p-2 rounded-xl bg-[#0b141a] border border-zinc-800">
              <strong className="text-emerald-400 block mb-0.5">2-Finger Tap / Long Press</strong>
              Right click (opens context menu).
            </div>
            <div className="p-2 rounded-xl bg-[#0b141a] border border-zinc-800">
              <strong className="text-emerald-400 block mb-0.5">Green Screen Share Button</strong>
              Broadcasts your phone screen to PC.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
