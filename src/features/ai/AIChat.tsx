import React, { useRef, useEffect } from 'react';
import { Bot, User, CheckCircle2, AlertCircle, HelpCircle, Laptop, Tv, Monitor, Trash2, Cpu } from 'lucide-react';
import { AIChatMessage } from '../../ai/AIContext';
import { Device } from '../../types';

interface AIChatProps {
  messages: AIChatMessage[];
  onSelectClarification: (option: string) => void;
  onClearSession: () => void;
}

export const AIChat: React.FC<AIChatProps> = ({
  messages,
  onSelectClarification,
  onClearSession,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'completed':
        return (
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
            <CheckCircle2 className="w-3 h-3" />
            <span>Executed</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-1 text-[10px] text-rose-400 font-bold">
            <AlertCircle className="w-3 h-3" />
            <span>Failed</span>
          </div>
        );
      case 'clarification':
        return (
          <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold">
            <HelpCircle className="w-3 h-3" />
            <span>Needs selection</span>
          </div>
        );
      default:
        return null;
    }
  };

  const renderDeviceCard = (dev: Device) => {
    const isOnline = dev.connectionState === 'connected';
    return (
      <div
        key={dev.id}
        className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between text-xs"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-zinc-900 text-indigo-400 shrink-0">
            {dev.type === 'android_tv' ? (
              <Tv className="w-3.5 h-3.5" />
            ) : dev.type === 'smart_board' ? (
              <Monitor className="w-3.5 h-3.5" />
            ) : (
              <Laptop className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white truncate">{dev.name}</div>
            <div className="text-[10px] text-zinc-500 font-mono">
              {dev.capabilities?.slice(0, 3).join(', ')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}
          />
          <span className={`text-[10px] font-bold ${isOnline ? 'text-emerald-400' : 'text-zinc-500'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950/60 rounded-3xl border border-zinc-800/80 overflow-hidden shadow-inner">
      {/* Chat Sub-header with Clear Button */}
      <div className="p-3 border-b border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400 bg-zinc-900/40">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Session Conversation
        </span>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClearSession}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear Session</span>
          </button>
        )}
      </div>

      {/* Messages Scroll View */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2">
            <div className="p-3 bg-zinc-900 rounded-2xl text-zinc-400">
              <Bot className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-bold text-zinc-300">How can I help?</h4>
            <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
              Ask to control your laptop, TV, or Smart Board with plain language. Try typing or speaking a command below.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === 'user';

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5 animate-in fade-in duration-100`}
              >
                {/* Sender badge */}
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold px-1">
                  {isUser ? (
                    <>
                      <span>You</span>
                      <User className="w-3 h-3 text-indigo-400" />
                    </>
                  ) : (
                    <>
                      <Bot className="w-3 h-3 text-emerald-400" />
                      <span>WebMouse AI</span>
                    </>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                    isUser
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-200 shadow-md'
                  }`}
                >
                  <p className="whitespace-pre-line">{m.text}</p>

                  {/* Device List Structured Card Display */}
                  {m.data?.devices && Array.isArray(m.data.devices) && m.data.devices.length > 0 && (
                    <div className="mt-2.5 space-y-1.5 pt-2 border-t border-zinc-800">
                      {m.data.devices.map((d: Device) => renderDeviceCard(d))}
                    </div>
                  )}

                  {/* Clarification Options */}
                  {m.clarificationOptions && m.clarificationOptions.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-zinc-800 space-y-1.5">
                      <span className="text-[10px] text-zinc-400 block font-semibold">Select an option:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {m.clarificationOptions.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => onSelectClarification(opt)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/40 hover:border-indigo-500 text-indigo-200 hover:text-white text-xs font-semibold transition-all active:scale-95"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Execution Status Badge */}
                {!isUser && m.status && (
                  <div className="px-1">{renderStatusBadge(m.status)}</div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
