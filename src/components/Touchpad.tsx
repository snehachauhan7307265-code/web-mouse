import React, { useRef, useState, useEffect, useCallback } from 'react';
import { MousePointer, Sliders, ChevronUp, ChevronDown, CircleDashed } from 'lucide-react';
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
  const scrollStripRef = useRef<HTMLDivElement>(null);

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

  // Scroll strip tracking
  const isScrollTouchingRef = useRef(false);
  const lastScrollYRef = useRef(0);

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

  const sendScroll = useCallback((amount: number) => {
    const delta = settings.invertScroll ? -amount : amount;
    onSendMessage({
      type: 'mouse_scroll',
      amount: delta,
    });
  }, [settings.invertScroll, onSendMessage]);

  const getTouchList = (touchList: React.TouchList): React.Touch[] => {
    const list: React.Touch[] = [];
    for (let i = 0; i < touchList.length; i++) {
      const item = touchList.item(i);
      if (item) list.push(item);
    }
    return list;
  };

  // Handle Touch Start on main trackpad
  const handleTouchStart = (e: React.TouchEvent) => {
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

    if (touches.length === 1 && touchpadRef.current) {
      const rect = touchpadRef.current.getBoundingClientRect();
      setVisualRipple({
        x: touches[0].clientX - rect.left,
        y: touches[0].clientY - rect.top,
        active: true,
      });

      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => {
        if (movedDistanceRef.current < 12) {
          triggerHaptic('heavy', settings.vibration);
          playClickSound(settings.clickSound);
          onSendMessage({ type: 'right_click' });
          setVisualRipple(null);
        }
      }, 500);
    }
  };

  // Handle Touch Move
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touches = getTouchList(e.touches);

    if (touches.length === 1) {
      const t = touches[0];
      const prev = activeTouchesRef.current.get(t.identifier);

      if (prev) {
        const rawDx = t.clientX - prev.x;
        const rawDy = t.clientY - prev.y;
        const dist = Math.hypot(rawDx, rawDy);
        movedDistanceRef.current += dist;

        if (movedDistanceRef.current > 10 && longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }

        sendMovement(rawDx, rawDy);

        if (touchpadRef.current) {
          const rect = touchpadRef.current.getBoundingClientRect();
          setVisualRipple({
            x: t.clientX - rect.left,
            y: t.clientY - rect.top,
            active: true,
          });
        }
      }
      activeTouchesRef.current.set(t.identifier, { x: t.clientX, y: t.clientY });
    } else if (touches.length === 2) {
      // 2 finger scroll
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const t1 = touches[0];
      const t2 = touches[1];
      const prev1 = activeTouchesRef.current.get(t1.identifier);
      const prev2 = activeTouchesRef.current.get(t2.identifier);

      if (prev1 && prev2) {
        const prevAvgY = (prev1.y + prev2.y) / 2;
        const curAvgY = (t1.clientY + t2.clientY) / 2;
        const deltaY = curAvgY - prevAvgY;

        if (Math.abs(deltaY) > 1) {
          const scrollUnits = Math.round(deltaY * settings.scrollSensitivity * 0.8);
          if (scrollUnits !== 0) {
            sendScroll(scrollUnits);
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

    if (duration < 280 && totalDistance < 10) {
      if (initialTouchCount === 1) {
        const now = Date.now();
        if (now - lastTapTimeRef.current < 300) {
          triggerHaptic('double', settings.vibration);
          playClickSound(settings.clickSound);
          onSendMessage({ type: 'double_click' });
          lastTapTimeRef.current = 0;
        } else {
          triggerHaptic('medium', settings.vibration);
          playClickSound(settings.clickSound);
          onSendMessage({ type: 'left_click' });
          lastTapTimeRef.current = now;
        }
      } else if (initialTouchCount === 2) {
        triggerHaptic('double', settings.vibration);
        playClickSound(settings.clickSound);
        onSendMessage({ type: 'right_click' });
      }
    }

    if (e.touches.length === 0) {
      setVisualRipple(null);
      activeTouchesRef.current.clear();
    }
  };

  // Desktop Mouse Fallback
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

  const handleMouseUp = () => {
    if (isMouseDownRef.current) {
      isMouseDownRef.current = false;
      setVisualRipple(null);

      if (movedDistanceRef.current < 6) {
        playClickSound(settings.clickSound);
        onSendMessage({ type: 'left_click' });
      }
    }
  };

  // Dedicated Smooth Scroll Strip Handlers
  const handleScrollTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length > 0) {
      isScrollTouchingRef.current = true;
      lastScrollYRef.current = e.touches[0].clientY;
      triggerHaptic('light', settings.vibration);
    }
  };

  const handleScrollTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (isScrollTouchingRef.current && e.touches.length > 0) {
      const currentY = e.touches[0].clientY;
      const delta = (lastScrollYRef.current - currentY) * 1.5;
      lastScrollYRef.current = currentY;

      if (Math.abs(delta) > 1) {
        sendScroll(Math.round(delta));
      }
    }
  };

  const handleScrollTouchEnd = () => {
    isScrollTouchingRef.current = false;
  };

  // Button clicks
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
    <div className="flex-1 flex flex-col h-full bg-zinc-950 select-none overflow-hidden relative max-w-4xl mx-auto w-full">
      {/* Top Options: Quick Sensitivity & Acceleration */}
      <div className="px-4 py-2 flex items-center justify-between bg-zinc-900/60 border-b border-zinc-800/80 shrink-0 gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-400">Sensitivity:</span>
          <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
            {[0.8, 1.2, 1.6].map((speed) => (
              <button
                key={speed}
                onClick={() => onUpdateSettings({ pointerSpeed: speed })}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  Math.abs(settings.pointerSpeed - speed) < 0.2
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {speed === 0.8 ? 'Slow' : speed === 1.2 ? 'Normal' : 'Fast'}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onUpdateSettings({ pointerAcceleration: !settings.pointerAcceleration })}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
            settings.pointerAcceleration
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-zinc-800 text-zinc-400 border-zinc-700/60'
          }`}
        >
          Accel {settings.pointerAcceleration ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Main Trackpad Workspace (Touch Area + Smooth Scroll Area) */}
      <div className="flex-1 flex p-3 gap-2 min-h-0">
        {/* Main Touchpad Surface */}
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
          className="flex-1 relative rounded-2xl border transition-colors cursor-crosshair overflow-hidden flex flex-col items-center justify-center bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 shadow-inner"
        >
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Gesture hints (Section 9: compact) */}
          <div className="pointer-events-none flex flex-col items-center text-center p-4 text-zinc-600">
            <div className="p-3.5 rounded-2xl bg-zinc-800/40 text-zinc-500 mb-2">
              <MousePointer className="w-8 h-8 opacity-70" />
            </div>
            <p className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
              Trackpad
            </p>
            <p className="text-[11px] text-zinc-500/80 mt-1 max-w-[220px]">
              Tap to click · 2-finger scroll · Long press for right click
            </p>
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

        {/* Smooth Scroll Strip Area (Section 9) */}
        <div
          ref={scrollStripRef}
          onTouchStart={handleScrollTouchStart}
          onTouchMove={handleScrollTouchMove}
          onTouchEnd={handleScrollTouchEnd}
          className="w-12 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex flex-col items-center justify-between py-3 cursor-ns-resize hover:bg-zinc-850 transition-colors select-none shrink-0"
          title="Drag up or down to scroll"
        >
          <ChevronUp className="w-4 h-4 text-zinc-500" />
          <div className="flex flex-col items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
            <div className="w-1.5 h-8 rounded-full bg-indigo-500/40" />
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
          </div>
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        </div>
      </div>

      {/* Bottom Physical Click Areas (Section 9: Clearly defined left/right click areas) */}
      <div className="p-3 pt-0 bg-zinc-950 shrink-0">
        <div className="flex gap-2.5 h-14">
          <button
            id="btn-physical-left-click"
            type="button"
            onClick={handleLeftClick}
            className="flex-1 rounded-xl bg-zinc-850 hover:bg-zinc-800 active:bg-zinc-900 border border-zinc-700/80 text-zinc-200 font-semibold text-xs active:translate-y-0.5 transition-all flex items-center justify-center shadow-md select-none"
          >
            <span>Left Click</span>
          </button>

          <button
            id="btn-physical-middle-click"
            type="button"
            onClick={handleMiddleClick}
            className="w-14 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 border border-zinc-800 text-zinc-400 active:translate-y-0.5 transition-all flex items-center justify-center shadow-sm select-none"
            title="Middle Click"
          >
            <CircleDashed className="w-4 h-4" />
          </button>

          <button
            id="btn-physical-right-click"
            type="button"
            onClick={handleRightClick}
            className="flex-1 rounded-xl bg-zinc-850 hover:bg-zinc-800 active:bg-zinc-900 border border-zinc-700/80 text-zinc-200 font-semibold text-xs active:translate-y-0.5 transition-all flex items-center justify-center shadow-md select-none"
          >
            <span>Right Click</span>
          </button>
        </div>
      </div>
    </div>
  );
};
