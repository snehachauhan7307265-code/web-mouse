import React, { useState, useEffect } from 'react';
import { Send, Mic, MicOff, Sparkles, Loader2 } from 'lucide-react';
import { voiceCommandService } from '../../ai/VoiceCommandService';

interface AICommandInputProps {
  onExecute: (command: string) => void;
  isProcessing: boolean;
  disabled?: boolean;
  initialValue?: string;
  onSwitchToVoice?: () => void;
}

const QUICK_EXAMPLES = [
  'Open Chrome',
  'Play music',
  'Pause video',
  'Increase volume',
  'Project my screen',
  'Next slide',
  'Which devices are online?',
];

export const AICommandInput: React.FC<AICommandInputProps> = ({
  onExecute,
  isProcessing,
  disabled = false,
  initialValue = '',
  onSwitchToVoice,
}) => {
  const [input, setInput] = useState(initialValue);
  const [isListening, setIsListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);

  useEffect(() => {
    if (initialValue) {
      setInput(initialValue);
    }
  }, [initialValue]);

  useEffect(() => {
    setVoiceAvailable(voiceCommandService.isAvailable());

    const unsubTranscript = voiceCommandService.onTranscript((transcript, isFinal) => {
      setInput(transcript);
      if (isFinal) {
        setIsListening(false);
        if (transcript.trim()) {
          onExecute(transcript.trim());
        }
      }
    });

    const unsubError = voiceCommandService.onError(() => {
      setIsListening(false);
    });

    return () => {
      unsubTranscript();
      unsubError();
      voiceCommandService.stopListening();
    };
  }, [onExecute]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isProcessing || disabled || !input.trim()) return;
    const cmd = input.trim();
    setInput('');
    onExecute(cmd);
  };

  const handleToggleVoice = () => {
    if (onSwitchToVoice) {
      onSwitchToVoice();
      return;
    }

    if (isListening) {
      voiceCommandService.stopListening();
      setIsListening(false);
    } else {
      const started = voiceCommandService.startListening();
      if (started) {
        setIsListening(true);
      }
    }
  };

  return (
    <div className="space-y-3 w-full">
      {/* Quick Example Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          Try:
        </span>
        {QUICK_EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={isProcessing || disabled}
            onClick={() => {
              setInput(ex);
              onExecute(ex);
            }}
            className="px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white shrink-0 text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Main Input Bar */}
      <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isProcessing || disabled}
            placeholder={isListening ? 'Listening to your voice...' : 'Type a command, e.g. "Open Chrome on laptop"'}
            className={`w-full py-3.5 pl-4 pr-12 rounded-2xl bg-zinc-900 border text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 transition-all disabled:opacity-50 ${
              isListening
                ? 'border-indigo-500 ring-2 ring-indigo-500/20 animate-pulse'
                : 'border-zinc-800 focus:border-indigo-500/80 focus:ring-indigo-500/20'
            }`}
          />

          {/* Voice Microphone Button */}
          <button
            type="button"
            disabled={isProcessing || disabled}
            onClick={handleToggleVoice}
            title={voiceAvailable ? (isListening ? 'Stop listening' : 'Speak command (Voice Ready)') : 'Voice recognition not supported in this browser'}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
            } disabled:opacity-40`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>

        {/* Execute Button */}
        <button
          type="submit"
          disabled={isProcessing || disabled || !input.trim()}
          className="py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all shrink-0"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Thinking</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Execute</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
