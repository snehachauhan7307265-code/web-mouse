import React, { useState, useRef } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1,
  MonitorPlay, MonitorX, ChevronLeft, ChevronRight, Square,
  Tv, Radio, Navigation, Disc, Sliders, Sparkles, MousePointer, ShieldCheck
} from 'lucide-react';
import { OutgoingMessage, AppSettings } from '../types';
import { triggerHaptic } from '../services/websocketService';

interface MediaTabProps {
  onSendMessage: (msg: OutgoingMessage) => void;
  settings: AppSettings;
}

export const MediaTab: React.FC<MediaTabProps> = ({ onSendMessage, settings }) => {
  const [activeSubTab, setActiveSubTab] = useState<'media' | 'presentation'>('media');
  const [laserActive, setLaserActive] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const sendMedia = (action: 'playpause' | 'nexttrack' | 'prevtrack' | 'volumeup' | 'volumedown' | 'volumemute') => {
    triggerHaptic('light', settings.vibration);
    onSendMessage({ type: 'media_control', action });
  };

  const sendPres = (action: 'start' | 'stop' | 'next' | 'prev' | 'black') => {
    triggerHaptic('medium', settings.vibration);
    onSendMessage({ type: 'presentation_control', action });
  };

  const sendShortcut = (keys: string[]) => {
    triggerHaptic('medium', settings.vibration);
    onSendMessage({ type: 'shortcut', keys });
  };

  // Laser Pointer touch pad handler
  const handlePointerTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handlePointerTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      const curX = e.touches[0].clientX;
      const curY = e.touches[0].clientY;
      const dx = (curX - touchStartRef.current.x) * 1.5;
      const dy = (curY - touchStartRef.current.y) * 1.5;
      touchStartRef.current = { x: curX, y: curY };

      if (Math.hypot(dx, dy) > 0.5) {
        onSendMessage({
          type: 'mouse_move',
          dx: Math.round(dx * 10) / 10,
          dy: Math.round(dy * 10) / 10,
        });
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 text-white overflow-y-auto select-none p-4 space-y-4 pb-8">
      {/* Sub-Tab Selector: Media Player vs Presentation Mode */}
      <div className="flex items-center gap-1.5 p-1 bg-zinc-900/90 rounded-2xl border border-zinc-800 shrink-0">
        <button
          onClick={() => setActiveSubTab('media')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'media'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Disc className="w-4 h-4" />
          <span>Media Player</span>
        </button>
        <button
          onClick={() => setActiveSubTab('presentation')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'presentation'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Tv className="w-4 h-4" />
          <span>Presentation Remote</span>
        </button>
      </div>

      {/* 1. MEDIA CONTROLLER TAB */}
      {activeSubTab === 'media' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Main Playback Console */}
          <div className="bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-6 flex flex-col items-center justify-center shadow-xl space-y-6">
            <div className="w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner text-indigo-400">
              <Radio className="w-9 h-9 animate-pulse" />
            </div>

            <div className="text-center">
              <h3 className="font-bold text-base text-white tracking-tight">Windows Media Control</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Spotify, YouTube, VLC, Netflix & Windows Media</p>
            </div>

            {/* Playback Transport Buttons */}
            <div className="flex items-center justify-center gap-6 w-full max-w-xs">
              <button
                id="btn-media-prev"
                onClick={() => sendMedia('prevtrack')}
                className="p-4 bg-zinc-800/80 hover:bg-zinc-700 active:bg-zinc-900 rounded-2xl transition-all shadow-md active:scale-95 text-zinc-300"
                title="Previous Track"
              >
                <SkipBack className="w-7 h-7" />
              </button>

              <button
                id="btn-media-playpause"
                onClick={() => sendMedia('playpause')}
                className="p-6 bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-95 text-white rounded-full transition-all shadow-lg shadow-indigo-600/30"
                title="Play / Pause"
              >
                <div className="flex items-center gap-1">
                  <Play className="w-8 h-8 fill-white" />
                  <Pause className="w-8 h-8 fill-white" />
                </div>
              </button>

              <button
                id="btn-media-next"
                onClick={() => sendMedia('nexttrack')}
                className="p-4 bg-zinc-800/80 hover:bg-zinc-700 active:bg-zinc-900 rounded-2xl transition-all shadow-md active:scale-95 text-zinc-300"
                title="Next Track"
              >
                <SkipForward className="w-7 h-7" />
              </button>
            </div>

            {/* Volume Control Bar */}
            <div className="w-full pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-3">
              <button
                id="btn-media-mute"
                onClick={() => sendMedia('volumemute')}
                className="p-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-300 rounded-xl transition-colors shrink-0"
                title="Mute / Unmute"
              >
                <VolumeX className="w-5 h-5" />
              </button>

              <button
                id="btn-media-voldown"
                onClick={() => sendMedia('volumedown')}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1 font-semibold text-xs shadow-sm"
              >
                <Volume1 className="w-4 h-4" />
                <span>Vol -</span>
              </button>

              <button
                id="btn-media-volup"
                onClick={() => sendMedia('volumeup')}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1 font-semibold text-xs shadow-sm"
              >
                <Volume2 className="w-4 h-4" />
                <span>Vol +</span>
              </button>
            </div>
          </div>

          {/* Quick Volume Steppers / Presets */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-2.5">
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">
              Quick Volume Pulses
            </span>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '-10%', count: 5, action: 'volumedown' },
                { label: '-5%', count: 2, action: 'volumedown' },
                { label: '+5%', count: 2, action: 'volumeup' },
                { label: '+10%', count: 5, action: 'volumeup' },
              ].map((step, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    for (let i = 0; i < step.count; i++) {
                      onSendMessage({ type: 'media_control', action: step.action as any });
                    }
                    triggerHaptic('light', settings.vibration);
                  }}
                  className="py-2 px-2 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-950 text-zinc-200 rounded-xl text-xs font-semibold text-center transition-all active:scale-95"
                >
                  {step.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. PRESENTATION MODE TAB */}
      {activeSubTab === 'presentation' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Main Slide Navigation Remote */}
          <div className="grid grid-cols-2 gap-3">
            <button
              id="btn-pres-prev"
              onClick={() => sendPres('prev')}
              className="p-6 bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 hover:border-indigo-500/40 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg group"
            >
              <div className="p-3 bg-zinc-800 group-hover:bg-indigo-500/20 text-zinc-300 group-hover:text-indigo-400 rounded-2xl transition-colors">
                <ChevronLeft className="w-8 h-8" />
              </div>
              <div className="text-center">
                <span className="font-bold text-sm text-zinc-100 block">Previous Slide</span>
                <span className="text-[10px] text-zinc-500 font-mono">Left / PgUp</span>
              </div>
            </button>

            <button
              id="btn-pres-next"
              onClick={() => sendPres('next')}
              className="p-6 bg-gradient-to-b from-indigo-950/40 to-zinc-950 border border-indigo-500/40 hover:border-indigo-400 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg group"
            >
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform">
                <ChevronRight className="w-8 h-8" />
              </div>
              <div className="text-center">
                <span className="font-bold text-sm text-white block">Next Slide</span>
                <span className="text-[10px] text-indigo-300/80 font-mono">Right / Space</span>
              </div>
            </button>
          </div>

          {/* Presentation Command Bar */}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              id="btn-pres-start"
              onClick={() => sendPres('start')}
              className="p-3.5 bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <MonitorPlay className="w-5 h-5 text-emerald-400" />
              <span className="font-semibold text-xs text-zinc-200">Start (F5)</span>
            </button>

            <button
              id="btn-pres-curslide"
              onClick={() => sendShortcut(['shift', 'f5'])}
              className="p-3.5 bg-zinc-900 border border-zinc-800 hover:border-indigo-500/40 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <span className="font-semibold text-xs text-zinc-200">Current Slide</span>
            </button>

            <button
              id="btn-pres-exit"
              onClick={() => sendPres('stop')}
              className="p-3.5 bg-zinc-900 border border-zinc-800 hover:border-rose-500/40 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <MonitorX className="w-5 h-5 text-rose-400" />
              <span className="font-semibold text-xs text-zinc-200">Exit (Esc)</span>
            </button>
          </div>

          {/* Screen Blanking Toggle */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              id="btn-pres-black"
              onClick={() => sendPres('black')}
              className="py-3 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-zinc-300 active:scale-95 transition-all"
            >
              <Square className="w-4 h-4 fill-zinc-400 text-zinc-400" />
              <span>Black Screen (B)</span>
            </button>

            <button
              id="btn-pres-white"
              onClick={() => {
                triggerHaptic('light', settings.vibration);
                onSendMessage({ type: 'key', key: 'w' });
              }}
              className="py-3 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-zinc-300 active:scale-95 transition-all"
            >
              <Square className="w-4 h-4 fill-white text-white" />
              <span>White Screen (W)</span>
            </button>
          </div>

          {/* Safe Laser Pointer / Presentation Pointer Pad */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MousePointer className="w-4 h-4 text-rose-400" />
                <h4 className="font-bold text-xs text-white">Presentation Pointer Pad</h4>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">Real Cursor Guidance</span>
            </div>

            <div
              onTouchStart={handlePointerTouchStart}
              onTouchMove={handlePointerTouchMove}
              className="h-28 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col items-center justify-center text-center p-3 cursor-crosshair active:border-rose-500/40 relative overflow-hidden"
            >
              <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping absolute pointer-events-none opacity-40" />
              <p className="text-xs font-medium text-zinc-400 pointer-events-none">
                Slide finger to guide cursor / laser
              </p>
              <p className="text-[10px] text-zinc-500 mt-1 pointer-events-none">
                Works directly on PowerPoint & Google Slides
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
