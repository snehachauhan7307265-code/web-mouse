import React from 'react';
import { X, Sliders, Volume2, Mic, RotateCcw, ShieldCheck, Sparkles, Radio } from 'lucide-react';
import { VoiceSettings, DEFAULT_VOICE_SETTINGS } from '../../voice/VoiceState';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  settings: VoiceSettings;
  onUpdateSettings: (newSettings: Partial<VoiceSettings>) => void;
  onClose: () => void;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleReset = () => {
    onUpdateSettings(DEFAULT_VOICE_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Voice Control Settings</h3>
              <p className="text-[10px] text-zinc-400">Configure speech recognition & audio feedback</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {/* 1. Voice Input Mode */}
          <div className="space-y-1.5 p-3 rounded-2xl bg-zinc-900 border border-zinc-800/80">
            <div className="font-bold text-white flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-indigo-400" />
              <span>Voice Input Mode</span>
            </div>
            <p className="text-[11px] text-zinc-400">Choose how the microphone activates</p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onUpdateSettings({ inputMode: 'tap' })}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  settings.inputMode === 'tap'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                Tap to Talk
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ inputMode: 'hold' })}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  settings.inputMode === 'hold'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                Hold to Talk
              </button>
            </div>
          </div>

          {/* 2. Voice Language */}
          <div className="space-y-1.5 p-3 rounded-2xl bg-zinc-900 border border-zinc-800/80">
            <div className="font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Voice Language</span>
            </div>
            <p className="text-[11px] text-zinc-400">Natural speech language model</p>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {[
                { id: 'auto', label: 'Auto Detect (Hinglish/EN)' },
                { id: 'en-IN', label: 'English (India)' },
                { id: 'en-US', label: 'English (US)' },
                { id: 'hi-IN', label: 'Hindi (India)' },
              ].map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => onUpdateSettings({ language: lang.id as any })}
                  className={`py-2 px-2.5 rounded-xl border text-[11px] font-medium transition-all text-left truncate ${
                    settings.language === lang.id
                      ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Voice Execution Mode */}
          <div className="space-y-1.5 p-3 rounded-2xl bg-zinc-900 border border-zinc-800/80">
            <div className="font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Execution Mode</span>
            </div>
            <p className="text-[11px] text-zinc-400">Control when confirmation prompts appear</p>
            <div className="space-y-1.5 pt-1">
              {[
                { id: 'ask_needed', label: 'Ask When Needed (Default)', desc: 'Confirms sensitive actions like screen projection' },
                { id: 'auto_execute', label: 'Safe Auto Execute', desc: 'Runs harmless commands immediately' },
                { id: 'always_confirm', label: 'Always Confirm', desc: 'Prompts confirmation for every voice command' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onUpdateSettings({ executionMode: mode.id as any })}
                  className={`w-full py-2 px-3 rounded-xl border text-left transition-all ${
                    settings.executionMode === mode.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  <div className="font-bold text-xs text-white">{mode.label}</div>
                  <div className="text-[10px] text-zinc-400">{mode.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Text-to-Speech Response */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900 border border-zinc-800/80">
            <div className="space-y-0.5">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Voice Response (TTS)</span>
              </div>
              <p className="text-[10px] text-zinc-400">Speak execution feedback aloud</p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ voiceResponse: !settings.voiceResponse })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.voiceResponse ? 'bg-indigo-600' : 'bg-zinc-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  settings.voiceResponse ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* 5. Continuous Voice Mode */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900 border border-zinc-800/80">
            <div className="space-y-0.5">
              <div className="font-bold text-white">Continuous Voice Mode</div>
              <p className="text-[10px] text-zinc-400">Keep microphone open across multi-turn queries</p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ continuousVoice: !settings.continuousVoice })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.continuousVoice ? 'bg-indigo-600' : 'bg-zinc-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  settings.continuousVoice ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* 6. Wake Word (Foundation Architecture) */}
          <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800/80 space-y-1">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-bold text-white">Wake Word ("Hey WebMouse")</div>
                <p className="text-[10px] text-zinc-400">Keyword spotter foundation (Default: OFF)</p>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ wakeWordEnabled: !settings.wakeWordEnabled })}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  settings.wakeWordEnabled ? 'bg-indigo-600' : 'bg-zinc-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    settings.wakeWordEnabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
            {settings.wakeWordEnabled && (
              <p className="text-[10px] text-amber-400/90 pt-1">
                Notice: Always-on listening requires foreground browser focus and microphone permission.
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800 text-xs">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Settings</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
