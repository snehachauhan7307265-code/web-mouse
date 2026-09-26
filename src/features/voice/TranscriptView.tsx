import React, { useState, useEffect } from 'react';
import { Send, Edit3, Sparkles, Check, RotateCcw, AlertTriangle } from 'lucide-react';
import { VoiceCommand } from '../../voice/VoiceCommand';

interface TranscriptViewProps {
  currentCommand: VoiceCommand | null;
  interimTranscript: string;
  isListening: boolean;
  onExecute: (text: string) => void;
  onRetry: () => void;
  onCancel: () => void;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  currentCommand,
  interimTranscript,
  isListening,
  onExecute,
  onRetry,
  onCancel,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const activeText = currentCommand?.transcript || '';

  useEffect(() => {
    setEditText(activeText);
    setIsEditing(false);
  }, [activeText]);

  const handleExecuteEdited = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editText.trim()) {
      onExecute(editText.trim());
      setIsEditing(false);
    }
  };

  const isLowSpeechConfidence =
    currentCommand && currentCommand.speechConfidence > 0 && currentCommand.speechConfidence < 0.65;

  return (
    <div className="w-full bg-zinc-950/70 rounded-3xl border border-zinc-800 p-4 space-y-3 shadow-inner">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Speech Transcript</span>
        </span>

        {currentCommand && !isListening && (
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-zinc-500">
              Speech: <strong className="text-zinc-300">{Math.round(currentCommand.speechConfidence * 100)}%</strong>
            </span>
            {currentCommand.intentConfidence > 0 && (
              <span className="text-zinc-500">
                Intent: <strong className="text-indigo-400">{Math.round(currentCommand.intentConfidence * 100)}%</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Interim Listening Stream */}
      {isListening && (
        <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-indigo-500/30 text-xs">
          <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
            <span>Listening to speech stream...</span>
          </div>
          <p className="text-zinc-200 italic font-medium min-h-[1.5rem]">
            {interimTranscript || 'Waiting for voice audio...'}
          </p>
        </div>
      )}

      {/* Final Transcript Display & Actions */}
      {!isListening && activeText && (
        <div className="space-y-3">
          {/* Low Confidence Warning Dialog */}
          {isLowSpeechConfidence && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">Speech clarity was low</span>
                <p className="text-[11px] text-zinc-400">
                  Did you say: <strong className="text-white">"{activeText}"</strong>?
                </p>
              </div>
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleExecuteEdited} className="space-y-2">
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                autoFocus
                className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 border border-indigo-500 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Execute Edited</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="py-2 px-3 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2.5">
              <div className="text-[10px] text-zinc-500 font-mono">You said:</div>
              <div className="text-sm font-bold text-white tracking-tight">
                "{activeText}"
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => onExecute(activeText)}
                  className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Execute Command</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={onRetry}
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                  title="Try speaking again"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State when Idle and No Transcript */}
      {!isListening && !activeText && (
        <div className="text-center py-4 text-xs text-zinc-500">
          No voice input yet. Tap or hold the microphone button to speak.
        </div>
      )}
    </div>
  );
};
