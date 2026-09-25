import React from 'react';
import { Play, Pause, Square, Sliders, RefreshCw, Cast } from 'lucide-react';
import { ProjectorState, ProjectorQuality, ProjectorFps } from '../../features/projector/projectorTypes';

interface ProjectionControlsProps {
  status: ProjectorState;
  quality: ProjectorQuality;
  fps: ProjectorFps;
  onChangeQuality: (quality: ProjectorQuality) => void;
  onChangeFps: (fps: ProjectorFps) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  isTargetSelected: boolean;
}

export const ProjectionControls: React.FC<ProjectionControlsProps> = ({
  status,
  quality,
  fps,
  onChangeQuality,
  onChangeFps,
  onStart,
  onPause,
  onResume,
  onStop,
  isTargetSelected,
}) => {
  const isStreaming = status === 'STREAMING';
  const isPaused = status === 'PAUSED';
  const isConnecting = status === 'CONNECTING' || status === 'WAITING_FOR_PERMISSION' || status === 'NEGOTIATING' || status === 'RECONNECTING';
  const isActive = isStreaming || isPaused || isConnecting;

  return (
    <div className="space-y-4 w-full">
      {/* Settings Rows: Quality & FPS */}
      <div className="grid grid-cols-2 gap-3">
        {/* Quality Presets */}
        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-1.5">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Resolution Quality
          </span>
          <div className="grid grid-cols-3 gap-1">
            {(['Auto', '720p', '1080p'] as ProjectorQuality[]).map((q) => (
              <button
                key={q}
                type="button"
                disabled={isActive}
                onClick={() => onChangeQuality(q)}
                className={`py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  quality === q
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                } disabled:opacity-50`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* FPS Presets */}
        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-1.5">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Frame Rate
          </span>
          <div className="grid grid-cols-3 gap-1">
            {(['Auto', '30 FPS', '60 FPS'] as ProjectorFps[]).map((f) => (
              <button
                key={f}
                type="button"
                disabled={isActive}
                onClick={() => onChangeFps(f)}
                className={`py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  fps === f
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                } disabled:opacity-50`}
              >
                {f.replace(' FPS', '')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Action Buttons */}
      <div className="flex items-center gap-2">
        {!isActive ? (
          <button
            type="button"
            disabled={!isTargetSelected}
            onClick={onStart}
            className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Cast className="w-4 h-4" />
            <span>Start Projecting</span>
          </button>
        ) : (
          <>
            {isPaused ? (
              <button
                type="button"
                onClick={onResume}
                className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
              >
                <Play className="w-4 h-4" />
                <span>Resume</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isConnecting}
                onClick={onPause}
                className="flex-1 py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition-all"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
            )}

            <button
              type="button"
              onClick={onStop}
              className="py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all"
            >
              <Square className="w-4 h-4" />
              <span>Stop</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
