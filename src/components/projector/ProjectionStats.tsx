import React from 'react';
import { Activity, Radio, Cpu, RefreshCw, AlertCircle } from 'lucide-react';
import { ProjectorSession, ProjectorStats as StatsData } from '../../features/projector/projectorTypes';

interface ProjectionStatsProps {
  session: ProjectorSession | null;
  stats: StatsData | null;
}

export const ProjectionStats: React.FC<ProjectionStatsProps> = ({ session, stats }) => {
  if (!session) return null;

  const getStatusBadge = () => {
    switch (session.status) {
      case 'STREAMING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Streaming</span>
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-bold border border-amber-500/30">
            <span>Paused</span>
          </span>
        );
      case 'WAITING_FOR_PERMISSION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[11px] font-bold border border-blue-500/30">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            <span>Choose Screen</span>
          </span>
        );
      case 'NEGOTIATING':
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[11px] font-bold border border-indigo-500/30">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            <span>Negotiating WebRTC</span>
          </span>
        );
      case 'RECONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-bold border border-amber-500/30">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            <span>Reconnecting...</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[11px] font-bold border border-rose-500/30">
            <AlertCircle className="w-2.5 h-2.5" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[11px] font-medium">
            <span>Idle</span>
          </span>
        );
    }
  };

  const latency = stats?.latencyMs || session.latency || 0;
  const resolution = stats?.width && stats?.height ? `${stats.width} × ${stats.height}` : session.resolution;
  const fps = stats?.fps || session.frameRate || 0;
  const bitrate = stats?.bitrateKbps ? `${stats.bitrateKbps} kbps` : undefined;

  return (
    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-white">Live Stream Telemetry</span>
        </div>
        {getStatusBadge()}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
        <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800/80">
          <span className="text-[10px] font-sans text-zinc-500 uppercase block font-semibold">Latency</span>
          <span className={`text-xs font-bold ${latency > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {latency > 0 ? `${latency} ms` : '< 10 ms'}
          </span>
        </div>

        <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800/80">
          <span className="text-[10px] font-sans text-zinc-500 uppercase block font-semibold">Resolution</span>
          <span className="text-xs font-bold text-white truncate block">
            {resolution}
          </span>
        </div>

        <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800/80">
          <span className="text-[10px] font-sans text-zinc-500 uppercase block font-semibold">Frame Rate</span>
          <span className="text-xs font-bold text-indigo-300">
            {fps > 0 ? `${fps} FPS` : '30 FPS'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono px-1">
        <span>Session: {session.sessionId}</span>
        {bitrate && <span>Bitrate: {bitrate}</span>}
      </div>

      {session.errorMessage && (
        <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{session.errorMessage}</span>
        </div>
      )}
    </div>
  );
};
