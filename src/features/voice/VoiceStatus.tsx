import React from 'react';
import { Mic, MicOff, Brain, HelpCircle, Zap, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { VoiceState } from '../../voice/VoiceState';

interface VoiceStatusProps {
  state: VoiceState;
  statusText?: string;
  isMicrophoneActive: boolean;
}

export const VoiceStatus: React.FC<VoiceStatusProps> = ({
  state,
  statusText,
  isMicrophoneActive,
}) => {
  const getBadge = () => {
    switch (state) {
      case 'LISTENING':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>🔴 Listening...</span>
          </div>
        );
      case 'TRANSCRIBING':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold animate-pulse">
            <Mic className="w-3.5 h-3.5 text-amber-400" />
            <span>Transcribing...</span>
          </div>
        );
      case 'PROCESSING':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold animate-pulse">
            <Brain className="w-3.5 h-3.5 animate-spin text-purple-400" />
            <span>🧠 Thinking...</span>
          </div>
        );
      case 'WAITING_FOR_CONFIRMATION':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>❓ Needs Confirmation</span>
          </div>
        );
      case 'EXECUTING':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold animate-pulse">
            <Zap className="w-3.5 h-3.5" />
            <span>⚡ Executing...</span>
          </div>
        );
      case 'SUCCESS':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>🟢 Completed</span>
          </div>
        );
      case 'ERROR':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>🔴 Error</span>
          </div>
        );
      case 'CANCELLED':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-semibold">
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancelled</span>
          </div>
        );
      case 'UNSUPPORTED':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-semibold">
            <MicOff className="w-3.5 h-3.5" />
            <span>Voice Unsupported</span>
          </div>
        );
      case 'IDLE':
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
            <Mic className="w-3.5 h-3.5 text-indigo-400" />
            <span>🟢 Voice Ready</span>
          </div>
        );
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div
          className={`p-2 rounded-xl transition-colors ${
            isMicrophoneActive
              ? 'bg-rose-500/20 text-rose-400 ring-2 ring-rose-500/30 animate-pulse'
              : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          {isMicrophoneActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">WebMouse Voice</h3>
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                isMicrophoneActive
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {isMicrophoneActive ? '🔴 Microphone Active' : '🎤 Microphone Off'}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 truncate max-w-[200px] sm:max-w-xs">
            {statusText || 'Tap or hold microphone to speak'}
          </p>
        </div>
      </div>
      {getBadge()}
    </div>
  );
};
