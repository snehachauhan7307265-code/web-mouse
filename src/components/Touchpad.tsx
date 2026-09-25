import React, { useRef, useState, useEffect, useCallback } from 'react';
import { MousePointer, Sliders, Vibrate, VibrateOff, Settings, CircleDashed } from 'lucide-react';
import { AppSettings, OutgoingMessage } from '../types';
import { triggerHaptic, playClickSound } from '../services/websocketService';

interface TouchpadProps {
  onSendMessage: (msg: OutgoingMessage) => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  isConnected: boolean;
}

interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

export const Touchpad: React.FC<TouchpadProps> = ({
  onSendMessage,
  settings,
  onUpdateSettings,
  isConnected,
}) => {
  const touchpadRef = useRef<HTMLDivElement>(null);

  // Gesture state
  const touchStartRef = useRef<{
    time: number;
    points: TouchPoint[];
  }>({ time: 0, points: [] });

  const activeTouchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const movedDistanceRef = useRef<number>(0);
  const longPressTimerRef = useRef<any>(null);
  const lastTapTimeRef = useRef<number>(0);

  // Visual touch indicator
  const [visualRipple, setVisualRipple] = useState<{ x: number; y: number; active: boolean } | null>(null);

  // Mouse fallback for desktop testing
  const isMouseDownRef = useRef(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Send movement with acceleration math
  const sendMovement = useCallback((rawDx: number, rawDy: number) => {
    let multiplier = settings.pointerSensitivity * settings.pointerSpeed;
    
    // Apply smooth acceleration curve
    if (settings.pointerAcceleration) {
      const distance = Math.hypot(rawDx, rawDy);
      const accelFactor = Math.min(Math.max(distance / 5, 0.9), 2.2);
      multiplier *= accelFactor;
    }

    const dx = Math.round(rawDx * multiplier * 10) / 10;
    const dy = Math.round(rawDy * multiplier * 10) / 10;

    if (dx !== 0 || dy !== 0) {
      onSendMessage({
        type: 'mouse_move',
        dx,
        dy,
      });
    }
  }, [settings.pointerSensitivity, settings.pointerSpeed, settings.pointerAcceleration, onSendMessage]);

  // Helper to safely convert React.TouchList to typed React.Touch array
  const getTouchList = (touchList: React.TouchList): React.Touch[] => {
    const list: React.Touch[] = [];
    for (let i = 0; i < touchList.length; i++) {
      const item = touchList.item(i);
      if (item) list.push(item);
    }
    return list;
  };

  // Handle Touch Start
  const handleTouchStart = (e: React.TouchEvent) => {
    // Prevent default browser gestures
    e.preventDefault();

    const touches = getTouchList(e.touches);
    touchStartRef.current = {
      time: Date.now(),
      points: touches.map((t) => ({ id: t.identifier, x: t.clientX, y: t.clientY })),
    };
    movedDistanceRef.current = 0;

    // Update active touches
    activeTouchesRef.current.clear();
    touches.forEach((t) => {
      activeTouchesRef.current.set(t.identifier, { x: t.clientX, y: t.clientY });
    });

    // Ripple visual on first finger
    if (touches.length === 1 && touchpadRef.current) {
      const rect = touchpadRef.current.getBoundingClientRect();
      setVisualRipple({
        x: touches[0].clientX - rect.left,
        y: touches[0].clientY - rect.top,
        active: true,
      });

      // Long press = right click
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => {
        if (movedDistanceRef.current < 12) {
          triggerHaptic('heavy', settings.vibration);
          playClickSound(settings.clickSound);
          onSendMessage({ type: 'right_click' });
          setVisualRipple(null);
        }
      }, 500);
    } else {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      setVisualRipple(null);
    }
  };

  // Handle Touch Move
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touches = getTouchList(e.touches);

    // Cancel long press timer if moved
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

        // Update visual position
        if (touchpadRef.current) {
          const rect = touchpadRef.current.getBoundingClientRect();
          setVisualRipple({
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top,
            active: true,
          });
        }
      }

      activeTouchesRef.current.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    } else if (touches.length === 2) {
      // 2-finger swipe/drag: Scrolling (vertical or horizontal)
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

      const t1 = touches[0];
      const t2 = touches[1];
      const prev1 = activeTouchesRef.current.get(t1.identifier);
      const prev2 = activeTouchesRef.current.get(t2.identifier);

      if (prev1 && prev2) {
        const dy1 = t1.clientY - prev1.y;
        const dy2 = t2.clientY - prev2.y;
        const dx1 = t1.clientX - prev1.x;
        const dx2 = t2.clientX - prev2.x;

        const avgDy = (dy1 + dy2) / 2;
        const avgDx = (dx1 + dx2) / 2;

        movedDistanceRef.current += Math.hypot(avgDx, avgDy);

        // Vertical scroll dominant
        if (Math.abs(avgDy) > Math.abs(avgDx) && Math.abs(avgDy) > 1.5) {
          const direction = settings.invertScroll ? -1 : 1;
          const scrollAmount = Math.round(-avgDy * settings.scrollSensitivity * 3.5 * direction);
          if (scrollAmount !== 0) {
            onSendMessage({ type: 'scroll', amount: scrollAmount });
            triggerHaptic('light', settings.vibration);
          }
        } else if (Math.abs(avgDx) > 1.5) {
          // Horizontal scroll
          const hScrollAmount = Math.round(avgDx * settings.scrollSensitivity * 3.5);
          if (hScrollAmount !== 0) {
            onSendMessage({ type: 'hscroll', amount: hScrollAmount });
          }
        }
      }

      activeTouchesRef.current.set(t1.identifier, { x: t1.clientX, y: t1.clientY });
      activeTouchesRef.current.set(t2.identifier, { x: t2.clientX, y: t2.clientY });
    }
  };

  // Handle Touch End
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const initialTouchCount = touchStartRef.current.points.length;
    const duration = Date.now() - touchStartRef.current.time;
    const totalDistance = movedDistanceRef.current;

    // Tap detection
    if (duration < 280 && totalDistance < 10) {
      if (initialTouchCount === 1) {
        const now = Date.now();
        if (now - lastTapTimeRef.current < 300) {
          // Double tap -> double click
          triggerHaptic('double', settings.vibration);
          playClickSound(settings.clickSound);
          onSendMessage({ type: 'double_click' });
          lastTapTimeRef.current = 0; // Reset
        } else {
          // Single tap -> Left click
          triggerHaptic('medium', settings.vibration);
          playClickSound(settings.clickSound);
          onSendMessage({ type: 'left_click' });
          lastTapTimeRef.current = now;
        }
      } else if (initialTouchCount === 2) {
        // Two finger tap -> Right click
        triggerHaptic('double', settings.vibration);
        playClickSound(settings.clickSound);
        onSendMessage({ type: 'right_click' });
      } else if (initialTouchCount === 3) {
        // Three finger tap -> Middle click
        triggerHaptic('heavy', settings.vibration);
        playClickSound(settings.clickSound);
        onSendMessage({ type: 'middle_click' });
      }
    }

    if (e.touches.length === 0) {
      setVisualRipple(null);
      activeTouchesRef.current.clear();
    }
  };

  // Desktop Mouse Fallback Handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      isMouseDownRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      movedDistanceRef.current = 0;

      if (touchpadRef.current) {
        const rect = touchpadRef.current.getBoundingClientRect();
        setVisualRipple({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          active: true,
        });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMouseDownRef.current) {
      const rawDx = e.clientX - lastMousePosRef.current.x;
      const rawDy = e.clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      movedDistanceRef.current += Math.hypot(rawDx, rawDy);

      sendMovement(rawDx, rawDy);

      if (touchpadRef.current) {
        const rect = touchpadRef.current.getBoundingClientRect();
        setVisualRipple({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          active: true,
        });
      }
    }
  };

  const handleMouseUp = (_e: React.MouseEvent) => {
    if (isMouseDownRef.current) {
      isMouseDownRef.current = false;
      setVisualRipple(null);

      if (movedDistanceRef.current < 6) {
        playClickSound(settings.clickSound);
        onSendMessage({ type: 'left_click' });
      }
    }
  };

  // Direct Button Handlers
  const handleLeftClick = () => {
    triggerHaptic('medium', settings.vibration);
    playClickSound(settings.clickSound);
    onSendMessage({ type: 'left_click' });
  };
  
  const handleMiddleClick = () => {
    triggerHaptic('heavy', settings.vibration);
    playClickSound(settings.clickSound);
    onSendMessage({ type: 'middle_click' });
  };

  const handleRightClick = () => {
    triggerHaptic('double', settings.vibration);
    playClickSound(settings.clickSound);
    onSendMessage({ type: 'right_click' });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 select-none overflow-hidden relative">
      {/* Top Touchpad Options Bar (Cursor Speed & Acceleration) */}
      <div className="px-4 py-2 flex items-center justify-between bg-zinc-900/60 border-b border-zinc-800/80 shrink-0 gap-2 overflow-x-auto">
        {/* Cursor Speed */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mr-1">Speed</span>
          <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-xl border border-zinc-800">
            <button
              onClick={() => onUpdateSettings({ pointerSpeed: 0.8 })}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors ${
                settings.pointerSpeed <= 0.8 ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Low
            </button>
            <button
              onClick={() => onUpdateSettings({ pointerSpeed: 1.0 })}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors ${
                settings.pointerSpeed > 0.8 && settings.pointerSpeed < 1.3 ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Med
            </button>
            <button
              onClick={() => onUpdateSettings({ pointerSpeed: 1.5 })}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors ${
                settings.pointerSpeed >= 1.3 ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              High
            </button>
          </div>
        </div>

        {/* Acceleration Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onUpdateSettings({ pointerAcceleration: !settings.pointerAcceleration })}
            className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold transition-all border ${
              settings.pointerAcceleration
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/60'
            }`}
          >
            Accel: {settings.pointerAcceleration ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Main Touchpad Area */}
      <div
        id="touchpad-surface"
        ref={touchpadRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="touchpad-area flex-1 relative mx-4 mb-4 rounded-[2rem] border transition-colors cursor-crosshair overflow-hidden flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900/90 via-zinc-900/60 to-zinc-950 border-zinc-800 shadow-inner"
      >
        {/* Subtle grid pattern background for tactile aesthetic */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Center watermark & gesture hint */}
        <div className="pointer-events-none flex flex-col items-center justify-center text-center p-4 text-zinc-600">
          <div className="p-4 rounded-3xl bg-zinc-800/30 text-zinc-500 shadow-inner">
            <MousePointer className="w-10 h-10 opacity-70" />
          </div>
          <p className="text-xs font-semibold tracking-widest mt-4 text-zinc-500 uppercase">
            Touchpad
          </p>
          <div className="mt-3 text-[10px] text-zinc-500/80 flex flex-wrap justify-center gap-x-4 gap-y-1.5 max-w-[200px] leading-relaxed">
            <span>Tap: Click</span>
            <span>2-Tap: Double</span>
            <span>2-Fingers: Scroll / Right Click</span>
            <span>Hold: Right Click</span>
          </div>
        </div>

        {/* Visual Ripple Tracker */}
        {visualRipple && visualRipple.active && (
          <div
            className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-75 flex items-center justify-center w-12 h-12 border-2 border-indigo-400/80 bg-indigo-500/20 shadow-lg shadow-indigo-500/30"
            style={{
              left: `${visualRipple.x}px`,
              top: `${visualRipple.y}px`,
            }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-300" />
          </div>
        )}
      </div>

      {/* Bottom Physical Buttons Bar */}
      <div className="p-4 pt-0 bg-zinc-950 shrink-0">
        <div className="flex gap-3 h-16">
          {/* Left Click (Large Primary) */}
          <button
            id="btn-physical-left-click"
            type="button"
            onClick={handleLeftClick}
            className="flex-1 rounded-2xl bg-gradient-to-b from-zinc-800 to-zinc-900 active:from-zinc-900 active:to-zinc-950 border-t border-zinc-700/80 border-b-2 border-b-black text-zinc-200 font-semibold text-sm active:translate-y-0.5 active:shadow-inner transition-all flex flex-col items-center justify-center shadow-lg select-none"
          >
            <span>Left Click</span>
          </button>

          {/* Middle Click */}
          <button
            id="btn-physical-middle-click"
            type="button"
            onClick={handleMiddleClick}
            className="w-16 rounded-2xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 border-t border-zinc-800/80 border-b-2 border-b-black text-zinc-400 active:translate-y-0.5 transition-all flex flex-col items-center justify-center shadow-md select-none"
            title="Middle Click"
          >
            <CircleDashed className="w-5 h-5" />
          </button>

          {/* Right Click */}
          <button
            id="btn-physical-right-click"
            type="button"
            onClick={handleRightClick}
            className="flex-1 rounded-2xl bg-gradient-to-b from-zinc-800 to-zinc-900 active:from-zinc-900 active:to-zinc-950 border-t border-zinc-700/80 border-b-2 border-b-black text-zinc-200 font-semibold text-sm active:translate-y-0.5 active:shadow-inner transition-all flex flex-col items-center justify-center shadow-lg select-none"
          >
            <span>Right Click</span>
          </button>
        </div>
      </div>
    </div>
  );
};
