import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Monitor,
  MonitorUp,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  AlertCircle,
  HelpCircle,
  MousePointer2,
  ArrowLeft,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Hand
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

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const screenImgRef = useRef<HTMLImageElement>(null);
  const fpsTimerRef = useRef<{ frames: number; lastTime: number }>({ frames: 0, lastTime: Date.now() });

  // Touchpad control states
  const touchStartRef = useRef<{ time: number; points: TouchPoint[] }>({ time: 0, points: [] });
  const activeTouchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const movedDistanceRef = useRef<number>(0);
  const longPressTimerRef = useRef<any>(null);
  const lastTapTimeRef = useRef<number>(0);
  const [touchIndicator, setTouchIndicator] = useState<{ x: number; y: number; active: boolean } | null>(null);

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

  // Toggle Stream
  const toggleStreaming = () => {
    if (isStreaming) {
      onSendMessage({ type: 'stop_projector' });
      setIsStreaming(false);
      setFps(0);
    } else {
      onSendMessage({ type: 'start_projector' });
      setIsStreaming(true);
    }
    triggerHaptic('light', settings.vibration);
  };

  // Fullscreen handler
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Send pointer movement to Windows Helper
  const sendMovement = (dx: number, dy: number) => {
    const sens = settings.pointerSensitivity || 1.2;
    const speed = settings.pointerSpeed || 1.0;
    let finalDx = dx * sens * speed;
    let finalDy = dy * sens * speed;

    if (settings.pointerAcceleration) {
      const dist = Math.hypot(dx, dy);
      if (dist > 8) {
        finalDx *= 1.35;
        finalDy *= 1.35;
      }
    }

    onSendMessage({
      type: 'mouse_move',
      dx: Math.round(finalDx),
      dy: Math.round(finalDy),
    });
  };

  const getTouchList = (touches: React.TouchList): TouchPoint[] => {
    const list: TouchPoint[] = [];
    for (let i = 0; i < touches.length; i++) {
      list.push({
        id: touches[i].identifier,
        x: touches[i].clientX,
        y: touches[i].clientY,
      });
    }
    return list;
  };

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!touchpadOverlayEnabled) return;
    e.preventDefault();
    const touches = getTouchList(e.touches);
    touchStartRef.current = { time: Date.now(), points: touches };
    movedDistanceRef.current = 0;

    activeTouchesRef.current.clear();
    touches.forEach((t) => activeTouchesRef.current.set(t.id, { x: t.x, y: t.y }));

    if (touches.length === 1 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTouchIndicator({
        x: touches[0].x - rect.left,
        y: touches[0].y - rect.top,
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
    if (!touchpadOverlayEnabled) return;
    e.preventDefault();
    const touches = getTouchList(e.touches);

    if (touches.length === 1) {
      const touch = touches[0];
      const prev = activeTouchesRef.current.get(touch.id);

      if (prev) {
        const rawDx = touch.x - prev.x;
        const rawDy = touch.y - prev.y;
        movedDistanceRef.current += Math.hypot(rawDx, rawDy);

        if (movedDistanceRef.current > 12 && longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }

        sendMovement(rawDx, rawDy);

        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setTouchIndicator({
            x: touch.x - rect.left,
            y: touch.y - rect.top,
            active: true,
          });
        }
      }

      activeTouchesRef.current.set(touch.id, { x: touch.x, y: touch.y });
    } else if (touches.length === 2) {
      // Two-finger scroll
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

      const t1 = touches[0];
      const t2 = touches[1];
      const prev1 = activeTouchesRef.current.get(t1.id);
      const prev2 = activeTouchesRef.current.get(t2.id);

      if (prev1 && prev2) {
        const dy = (t1.y - prev1.y + (t2.y - prev2.y)) / 2;
        const dx = (t1.x - prev1.x + (t2.x - prev2.y)) / 2;

        movedDistanceRef.current += Math.hypot(dx, dy);

        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 1.5) {
          const direction = settings.invertScroll ? -1 : 1;
          const scrollAmount = Math.round(-dy * settings.scrollSensitivity * 3.5 * direction);
          if (scrollAmount !== 0) {
            onSendMessage({ type: 'scroll', amount: scrollAmount });
            triggerHaptic('light', settings.vibration);
          }
        }
      }

      activeTouchesRef.current.set(t1.id, { x: t1.x, y: t1.y });
      activeTouchesRef.current.set(t2.id, { x: t2.x, y: t2.y });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchpadOverlayEnabled) return;
    e.preventDefault();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const initialTouchCount = touchStartRef.current.points.length;
    const duration = Date.now() - touchStartRef.current.time;
    const totalDistance = movedDistanceRef.current;

    // Detect Tap (short duration, minimal movement)
    if (duration < 280 && totalDistance < 10) {
      if (initialTouchCount === 1) {
        const now = Date.now();
        if (now - lastTapTimeRef.current < 280) {
          // Double Click
          triggerHaptic('medium', settings.vibration);
          playClickSound(settings.clickSound);
          onSendMessage({ type: 'double_click' });
          lastTapTimeRef.current = 0;
        } else {
          // Single Left Click
          triggerHaptic('light', settings.vibration);
          playClickSound(settings.clickSound);
          onSendMessage({ type: 'left_click' });
          lastTapTimeRef.current = now;
        }
      } else if (initialTouchCount === 2) {
        // Two-finger tap = Right Click
        triggerHaptic('medium', settings.vibration);
        playClickSound(settings.clickSound);
        onSendMessage({ type: 'right_click' });
      }
    }

    setTouchIndicator(null);
    activeTouchesRef.current.clear();
  };

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex flex-col h-full overflow-hidden select-none relative ${
        isFullscreen ? 'fixed inset-0 z-50 bg-black' : isDark ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-900'
      }`}
    >
      {/* Top Bar / Header */}
      <div className="h-14 px-3 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-2">
          {onExit && (
            <button
              onClick={onExit}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
              title="Back to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
              <Monitor className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white tracking-wide">PC Projector</h2>
              <p className="text-[10px] text-zinc-400">
                {status === 'connected' ? deviceInfo?.computerName || 'Connected' : 'Disconnected'}
              </p>
            </div>
          </div>
        </div>

        {/* Live FPS & Action Buttons */}
        <div className="flex items-center gap-1.5">
          {isStreaming && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300 text-[11px] font-mono font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span>{fps} FPS</span>
            </div>
          )}

          <button
            onClick={() => setTouchpadOverlayEnabled(!touchpadOverlayEnabled)}
            className={`p-2 rounded-xl border transition-all text-xs flex items-center gap-1 ${
              touchpadOverlayEnabled
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
            }`}
            title="Touchpad Control Overlay"
          >
            <Hand className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors border border-zinc-800"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowHelp(true)}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-800"
            title="Help & Gestures"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Screen Projection Canvas */}
      <div
        className="flex-1 relative flex items-center justify-center bg-black overflow-hidden touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {currentFrame ? (
          <img
            ref={screenImgRef}
            src={currentFrame}
            alt="PC Screen"
            className="w-full h-full object-contain pointer-events-none select-none"
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-xs space-y-4">
            <div className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800 text-purple-400 shadow-2xl">
              <MonitorUp className="w-10 h-10 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {status === 'connected' ? 'Screen Stream Ready' : 'Connect to PC First'}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {status === 'connected'
                  ? 'Tap "Start Mirroring" below to view and control your laptop screen in real time.'
                  : 'Pair with your laptop via Wi-Fi to mirror and control your computer desktop.'}
              </p>
            </div>

            {status === 'connected' && (
              <button
                onClick={toggleStreaming}
                className="py-2.5 px-6 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/30 active:scale-95 transition-all"
              >
                <Play className="w-4 h-4" />
                <span>Start Mirroring</span>
              </button>
            )}
          </div>
        )}

        {/* Visual Touch Indicator */}
        {touchIndicator && (
          <div
            className="absolute pointer-events-none w-10 h-10 rounded-full border-2 border-indigo-400 bg-indigo-500/20 -translate-x-1/2 -translate-y-1/2 animate-ping"
            style={{ left: touchIndicator.x, top: touchIndicator.y }}
          />
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="h-14 px-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between gap-2 shrink-0 z-20">
        <button
          onClick={toggleStreaming}
          className={`flex-1 py-2 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all active:scale-95 ${
            isStreaming
              ? 'bg-rose-950/60 text-rose-300 border border-rose-500/30 hover:bg-rose-900/60'
              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20'
          }`}
        >
          {isStreaming ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span>Pause Stream</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>Start Stream</span>
            </>
          )}
        </button>

        {/* Quick Mouse Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              triggerHaptic('light', settings.vibration);
              playClickSound(settings.clickSound);
              onSendMessage({ type: 'left_click' });
            }}
            className="py-2 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-zinc-800 text-xs font-semibold text-zinc-200 transition-all"
          >
            Left Click
          </button>

          <button
            onClick={() => {
              triggerHaptic('medium', settings.vibration);
              playClickSound(settings.clickSound);
              onSendMessage({ type: 'right_click' });
            }}
            className="py-2 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-zinc-800 text-xs font-semibold text-zinc-200 transition-all"
          >
            Right Click
          </button>
        </div>
      </div>

      {/* Gestures Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-zinc-100 font-bold text-sm">
                <HelpCircle className="w-4 h-4 text-purple-400" />
                <span>Projector Gestures</span>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-xs text-zinc-400 hover:text-white px-2 py-1 bg-zinc-800 rounded-lg"
              >
                Done
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300">
              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80">
                <span className="font-bold text-purple-400 shrink-0">1-Finger Tap:</span>
                <span className="text-zinc-400">Left click on computer</span>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80">
                <span className="font-bold text-purple-400 shrink-0">1-Finger Drag:</span>
                <span className="text-zinc-400">Move mouse pointer smoothly</span>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80">
                <span className="font-bold text-purple-400 shrink-0">2-Finger Tap:</span>
                <span className="text-zinc-400">Right click (context menu)</span>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80">
                <span className="font-bold text-purple-400 shrink-0">2-Finger Drag:</span>
                <span className="text-zinc-400">Vertical and horizontal scrolling</span>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-zinc-950 border border-zinc-800/80">
                <span className="font-bold text-purple-400 shrink-0">Long Press:</span>
                <span className="text-zinc-400">Right click on pointer position</span>
              </div>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
