import React from 'react';
import { RefreshCw, AlertCircle, WifiOff } from 'lucide-react';
import { ConnectionStatus as ConnectionStatusType } from '../types';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  latencyMs?: number;
  className?: string;
  showLatency?: boolean;
  size?: 'sm' | 'md';
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  latencyMs,
  className = '',
  showLatency = true,
  size = 'sm',
}) => {
  const padSize = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs';

  switch (status) {
    case 'connected':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-colors ${padSize} bg-emerald-950/70 border border-emerald-500/30 text-emerald-400 ${className}`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Connected</span>
          {showLatency && latencyMs !== undefined && (
            <span className="text-emerald-400/80 font-mono text-[11px] border-l border-emerald-500/30 pl-1.5 ml-0.5">
              {latencyMs} ms
            </span>
          )}
        </span>
      );

    case 'connecting':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-colors ${padSize} bg-blue-950/70 border border-blue-500/30 text-blue-400 ${className}`}
        >
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Connecting...</span>
        </span>
      );

    case 'reconnecting':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-colors ${padSize} bg-amber-950/70 border border-amber-500/30 text-amber-400 ${className}`}
        >
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Reconnecting...</span>
        </span>
      );

    case 'auth_failed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-colors ${padSize} bg-rose-950/70 border border-rose-500/30 text-rose-400 ${className}`}
        >
          <AlertCircle className="w-3 h-3" />
          <span>Wrong Code</span>
        </span>
      );

    case 'error':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-colors ${padSize} bg-rose-950/70 border border-rose-500/30 text-rose-400 ${className}`}
        >
          <WifiOff className="w-3 h-3" />
          <span>Offline</span>
        </span>
      );

    case 'disconnected':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-colors ${padSize} bg-zinc-900 border border-zinc-800 text-zinc-400 ${className}`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500/80" />
          <span>Disconnected</span>
        </span>
      );
  }
};
