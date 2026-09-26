import React from 'react';
import { Bot, Brain, HelpCircle, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

export type AIControlStatus =
  | 'ready'
  | 'thinking'
  | 'clarification'
  | 'executing'
  | 'completed'
  | 'failed';

interface AIStatusProps {
  status: AIControlStatus;
  statusText?: string;
}

export const AIStatus: React.FC<AIStatusProps> = ({ status, statusText }) => {
  const getStatusBadge = () => {
    switch (status) {
      case 'thinking':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold animate-pulse">
            <Brain className="w-3.5 h-3.5 animate-spin" />
            <span>🧠 Thinking...</span>
          </div>
        );
      case 'clarification':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>❓ Need more information</span>
          </div>
        );
      case 'executing':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold animate-pulse">
            <Zap className="w-3.5 h-3.5" />
            <span>⚡ Executing...</span>
          </div>
        );
      case 'completed':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>🟢 Completed</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>🔴 Failed</span>
          </div>
        );
      case 'ready':
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            <span>🤖 AI Ready</span>
          </div>
        );
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">WebMouse AI Engine</h3>
          <p className="text-[11px] text-zinc-400">{statusText || 'Natural Language → Intent → Safe Device Action'}</p>
        </div>
      </div>
      {getStatusBadge()}
    </div>
  );
};
