import React, { useRef, useState, useEffect } from 'react';
import { MousePointer, RefreshCw, AlertCircle, WifiOff } from 'lucide-react';
import { connectionManager } from '../../services/connectionManager';
import { ConnectionState, TrustedDevice } from '../../types';

interface TouchpadSurfaceProps {
  connectionState: ConnectionState;
  activeDevice: TrustedDevice | null;
  onOpenPairModal: () => void;
  onConnectActiveDevice?: () => void;
}

export const TouchpadSurface: React.FC<TouchpadSurfaceProps> = ({
  connectionState,
  activeDevice,
  onOpenPairModal,
  onConnectActiveDevice,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const [isLeftPressed, setIsLeftPressed] = useState(false);
  const [isRightPressed, setIsRightPressed] = useState(false);

  const isConnected = connectionState === 'CONNECTED';

  // Pointer / Touch Handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isConnected) return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
      touchStartTimeRef.current = Date.now();
    } else if (e.touches.length === 2) {
      // Two finger gesture start
      const touch = e.touches[0];
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isConnected || !lastTouchRef.current) return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - lastTouchRef.current.x;
      const dy = touch.clientY - lastTouchRef.current.y;

      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };

      // Sensitivity multiplier for natural laptop trackpad feel
      const sensitivity = 1.35;
      connectionManager.sendMouseMove(dx * sensitivity, dy * sensitivity);
    } else if (e.touches.length === 2) {
      // Two finger scroll
      const touch = e.touches[0];
      const dy = touch.clientY - lastTouchRef.current.y;
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };

      // Invert for natural Windows wheel scroll
      connectionManager.sendMouseScroll(0, dy * -1.5);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isConnected) return;

    // Detect tap for click
    if (e.changedTouches.length === 1 && touchStartPosRef.current) {
      const touch = e.changedTouches[0];
      const dist = Math.hypot(
        touch.clientX - touchStartPosRef.current.x,
        touch.clientY - touchStartPosRef.current.y
      );
      const duration = Date.now() - touchStartTimeRef.current;

      // If brief tap without much movement -> left click
      if (dist < 10 && duration < 250) {
        connectionManager.sendMouseClick('left');
      }
    }

    lastTouchRef.current = null;
    touchStartPosRef.current = null;
  };

  // Mouse Buttons Handlers
  const handleLeftDown = () => {
    if (!isConnected) return;
    setIsLeftPressed(true);
    connectionManager.sendMouseDown('left');
  };

  const handleLeftUp = () => {
    if (!isConnected) return;
    setIsLeftPressed(false);
    connectionManager.sendMouseUp('left');
  };

  const handleRightDown = () => {
    if (!isConnected) return;
    setIsRightPressed(true);
    connectionManager.sendMouseDown('right');
  };

  const handleRightUp = () => {
    if (!isConnected) return;
    setIsRightPressed(false);
    connectionManager.sendMouseUp('right');
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full min-h-[380px] bg-zinc-950 rounded-3xl border border-zinc-800/80 overflow-hidden shadow-2xl relative select-none">
      {/* Trackpad Surface Area */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 w-full bg-gradient-to-b from-zinc-900/60 to-zinc-950 flex flex-col items-center justify-center relative touch-none cursor-crosshair overflow-hidden"
      >
        {/* Subtle grid pattern for trackpad texture */}
        <div className="absolute inset-0 bg-[radial-gradient(#3f3f46_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />

        {isConnected ? (
          <div className="text-center p-6 space-y-2 pointer-events-none opacity-40 select-none">
            <MousePointer className="w-8 h-8 text-indigo-400 mx-auto stroke-[1.5]" />
            <p className="text-xs font-semibold text-zinc-300">
              Slide finger to move REAL Windows cursor
            </p>
            <p className="text-[10px] text-zinc-500">
              Tap for Left Click • 2 Fingers to Scroll
            </p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-950/90 z-20 space-y-3">
            {connectionState === 'CONNECTING' ? (
              <>
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Connecting to {activeDevice?.deviceName || 'PC'}...</h4>
                  <p className="text-xs text-zinc-400">Verifying trusted credentials with Windows Helper</p>
                </div>
              </>
            ) : connectionState === 'RECONNECTING' ? (
              <>
                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-300">🟡 Reconnecting...</h4>
                  <p className="text-xs text-zinc-400">Waiting for Windows Helper to respond</p>
                </div>
              </>
            ) : connectionState === 'OFFLINE' ? (
              <>
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500">
                  <WifiOff className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-zinc-300">⚫ Offline</h4>
                  <p className="text-xs text-zinc-400">PC is not reachable on local Wi-Fi</p>
                </div>
                {activeDevice && onConnectActiveDevice && (
                  <button
                    onClick={onConnectActiveDevice}
                    className="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-md"
                  >
                    [ CONNECT ]
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">🔴 Not Connected</h4>
                  <p className="text-xs text-zinc-400">
                    {activeDevice
                      ? `Tap Connect on ${activeDevice.deviceName} or pair a new PC`
                      : 'Pair a Windows PC to control cursor'}
                  </p>
                </div>
                {activeDevice && onConnectActiveDevice ? (
                  <button
                    onClick={onConnectActiveDevice}
                    className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-xs font-bold text-white transition-all shadow-md shadow-emerald-500/20"
                  >
                    [ CONNECT TO {activeDevice.deviceName.toUpperCase()} ]
                  </button>
                ) : (
                  <button
                    onClick={onOpenPairModal}
                    className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all shadow-md shadow-indigo-600/20"
                  >
                    [ + Pair Windows PC ]
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Mouse Click Buttons (Left Click & Right Click) */}
      <div className="h-16 bg-zinc-900 border-t border-zinc-800 flex items-stretch divide-x divide-zinc-800 shrink-0">
        <button
          type="button"
          onMouseDown={handleLeftDown}
          onMouseUp={handleLeftUp}
          onTouchStart={handleLeftDown}
          onTouchEnd={handleLeftUp}
          disabled={!isConnected}
          className={`flex-1 flex flex-col items-center justify-center font-bold text-xs transition-all ${
            isLeftPressed
              ? 'bg-indigo-600 text-white shadow-inner'
              : 'text-zinc-300 hover:bg-zinc-850 active:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent'
          }`}
        >
          <span>Left Click</span>
          <span className="text-[10px] text-zinc-500 font-normal">Primary</span>
        </button>

        <button
          type="button"
          onMouseDown={handleRightDown}
          onMouseUp={handleRightUp}
          onTouchStart={handleRightDown}
          onTouchEnd={handleRightUp}
          disabled={!isConnected}
          className={`flex-1 flex flex-col items-center justify-center font-bold text-xs transition-all ${
            isRightPressed
              ? 'bg-indigo-600 text-white shadow-inner'
              : 'text-zinc-300 hover:bg-zinc-850 active:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent'
          }`}
        >
          <span>Right Click</span>
          <span className="text-[10px] text-zinc-500 font-normal">Context Menu</span>
        </button>
      </div>
    </div>
  );
};
