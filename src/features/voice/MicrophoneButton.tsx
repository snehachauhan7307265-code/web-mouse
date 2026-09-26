import React from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { VoiceInputMode, VoiceState } from '../../voice/VoiceState';

interface MicrophoneButtonProps {
  state: VoiceState;
  inputMode: VoiceInputMode;
  disabled?: boolean;
  onTap: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
}

export const MicrophoneButton: React.FC<MicrophoneButtonProps> = ({
  state,
  inputMode,
  disabled = false,
  onTap,
  onHoldStart,
  onHoldEnd,
}) => {
  const isListening = state === 'LISTENING' || state === 'TRANSCRIBING';
  const isProcessing = state === 'PROCESSING' || state === 'EXECUTING';

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || isProcessing) return;
    if (inputMode === 'hold') {
      onHoldStart();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (disabled || isProcessing) return;
    if (inputMode === 'hold') {
      onHoldEnd();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (disabled || isProcessing) return;
    if (inputMode === 'tap') {
      onTap();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || isProcessing) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onTap();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-6 select-none relative">
      {/* Outer Pulse Waves Animation when Active */}
      {isListening && (
        <>
          <div className="absolute w-36 h-36 rounded-full bg-rose-500/20 animate-ping pointer-events-none" />
          <div className="absolute w-44 h-44 rounded-full bg-indigo-500/10 animate-pulse pointer-events-none" />
        </>
      )}

      {/* Main Touch Target Button */}
      <button
        type="button"
        disabled={disabled || isProcessing}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        aria-label={
          isListening
            ? 'Stop listening'
            : inputMode === 'hold'
            ? 'Press and hold to speak'
            : 'Tap to speak'
        }
        className={`relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center transition-all duration-200 active:scale-95 shadow-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/40 disabled:opacity-40 disabled:cursor-not-allowed ${
          isListening
            ? 'bg-gradient-to-tr from-rose-600 to-red-500 text-white shadow-rose-600/40 ring-4 ring-rose-500/30'
            : 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-indigo-600/30 hover:scale-105'
        }`}
      >
        {isProcessing ? (
          <Loader2 className="w-10 h-10 animate-spin text-white" />
        ) : isListening ? (
          <Square className="w-8 h-8 fill-current text-white animate-pulse" />
        ) : (
          <Mic className="w-10 h-10 text-white drop-shadow" />
        )}

        <span className="text-[11px] font-bold mt-1 tracking-tight">
          {isProcessing
            ? 'Thinking'
            : isListening
            ? 'Stop'
            : inputMode === 'hold'
            ? 'Hold to Talk'
            : 'Tap to Talk'}
        </span>
      </button>

      {/* Hint Text */}
      <div className="mt-4 text-center">
        <p className="text-xs font-semibold text-zinc-300">
          {isListening
            ? 'Listening... speak clearly into microphone'
            : inputMode === 'hold'
            ? 'Press and hold while speaking'
            : 'Tap button and say a command'}
        </p>
        <p className="text-[10px] text-zinc-500 mt-0.5">
          Desktop: <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[9px]">Ctrl+Shift+Space</kbd>
        </p>
      </div>
    </div>
  );
};
