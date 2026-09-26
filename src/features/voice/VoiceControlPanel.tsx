/**
 * WebMouse V2 — Phase 4: Voice Control Engine Panel
 * SPEECH ➔ TEXT ➔ AI INTENT ➔ CAPABILITY VALIDATION ➔ SAFE DEVICE ACTION ➔ VOICE/TEXT FEEDBACK
 * 
 * Seamlessly hooks speech recognition into the Phase 3 AI Engine.
 * Supports Tap-to-Talk, Hold-to-Talk, Language Selector, Editable Transcripts,
 * Spoken TTS Feedback, Desktop Shortcut (Ctrl+Shift+Space), and Safe Confirmations.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  Keyboard,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
  Globe,
  RotateCcw
} from 'lucide-react';
import { Device, OutgoingMessage } from '../../types';
import { AIContext } from '../../ai/AIContext';
import { AIActionRouter, ActionRouterCallbacks } from '../../ai/AIActionRouter';
import { AIConfirmationManager, PendingConfirmation } from '../../ai/AIConfirmationManager';
import { triggerHaptic } from '../../services/websocketService';
import { voiceRecognitionService } from '../../voice/VoiceRecognitionService';
import { voiceFeedbackService } from '../../voice/VoiceFeedbackService';
import { 
  VoiceState, 
  VoiceSettings, 
  VoiceLanguage, 
  DEFAULT_VOICE_SETTINGS 
} from '../../voice/VoiceState';
import { VoiceCommand, generateVoiceCommandId } from '../../voice/VoiceCommand';
import { MicrophoneButton } from './MicrophoneButton';
import { VoiceStatus } from './VoiceStatus';
import { TranscriptView } from './TranscriptView';
import { VoiceSettingsModal } from './VoiceSettingsModal';
import { VoiceConfirmation } from './VoiceConfirmation';
import { AIIntent } from '../../ai/AIIntent';

interface VoiceControlPanelProps {
  devices: Device[];
  activeDevice: Device | null;
  onSendMessage: (msg: OutgoingMessage) => void;
  onSelectDevice?: (device: Device) => void;
  onStartProjection?: (targetDeviceName: string) => Promise<boolean>;
  onStopProjection?: () => void;
  onPauseProjection?: () => void;
  onResumeProjection?: () => void;
  onOpenShareModal?: () => void;
  onSwitchToTextChat?: (prefill?: string) => void;
  vibrationEnabled?: boolean;
}

const VOICE_LANGUAGE_OPTIONS: { id: VoiceLanguage; label: string; flag: string }[] = [
  { id: 'auto', label: 'Auto Detect', flag: '🌐' },
  { id: 'en-IN', label: 'English (India)', flag: '🇮🇳' },
  { id: 'hi-IN', label: 'Hindi (India)', flag: '🇮🇳' },
  { id: 'en-US', label: 'English (US)', flag: '🇺🇸' },
];

const VOICE_QUICK_COMMANDS = [
  'Open Chrome on laptop',
  'TV volume badhao',
  'Project my screen to TV',
  'Next slide',
  'Music pause karo',
  'Which devices are online?',
];

export const VoiceControlPanel: React.FC<VoiceControlPanelProps> = ({
  devices,
  activeDevice,
  onSendMessage,
  onSelectDevice,
  onStartProjection,
  onStopProjection,
  onPauseProjection,
  onResumeProjection,
  onOpenShareModal,
  onSwitchToTextChat,
  vibrationEnabled = true,
}) => {
  // AI Engine held in stable refs (Never duplicated from Phase 3)
  const confirmationManagerRef = useRef<AIConfirmationManager>(new AIConfirmationManager());
  const actionRouterRef = useRef<AIActionRouter>(new AIActionRouter(confirmationManagerRef.current));

  // Voice Settings from localStorage or default
  const [settings, setSettings] = useState<VoiceSettings>(() => {
    try {
      const saved = localStorage.getItem('webmouse_voice_settings');
      return saved ? { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(saved) } : DEFAULT_VOICE_SETTINGS;
    } catch {
      return DEFAULT_VOICE_SETTINGS;
    }
  });

  const [voiceState, setVoiceState] = useState<VoiceState>(() =>
    voiceRecognitionService.isSupported() ? 'IDLE' : 'UNSUPPORTED'
  );
  const [statusMessage, setStatusMessage] = useState<string>('Ready for voice commands');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [currentCommand, setCurrentCommand] = useState<VoiceCommand | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [lastExecutedText, setLastExecutedText] = useState<string>('');

  // Persist voice settings
  const handleUpdateSettings = (partial: Partial<VoiceSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem('webmouse_voice_settings', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Subscribe to confirmation manager
  useEffect(() => {
    const unsubConfirm = confirmationManagerRef.current.subscribe((pending) => {
      setPendingConfirmation(pending);
      if (pending) {
        setVoiceState('WAITING_FOR_CONFIRMATION');
        setStatusMessage(`Confirm: ${pending.intent.explanation || pending.intent.intent}`);
        if (settings.voiceResponse) {
          voiceFeedbackService.speak(
            `Please confirm: ${pending.intent.explanation || pending.intent.intent}`,
            settings.language
          );
        }
      }
    });
    return () => unsubConfirm();
  }, [settings.voiceResponse, settings.language]);

  // Execute Command via Phase 3 AI Engine Pipeline
  const executeCommand = useCallback(
    async (rawTranscript: string) => {
      if (!rawTranscript.trim()) return;

      triggerHaptic('medium', vibrationEnabled);
      setVoiceState('PROCESSING');
      setStatusMessage('Parsing intent and checking permissions...');
      setLastExecutedText(rawTranscript);

      const commandId = generateVoiceCommandId();
      const commandObj: VoiceCommand = {
        commandId,
        transcript: rawTranscript,
        speechConfidence: 0.92,
        intentConfidence: 0.95,
        language: settings.language,
        timestamp: Date.now(),
        state: 'PROCESSING',
      };
      setCurrentCommand(commandObj);

      const context: AIContext = {
        activeDeviceId: activeDevice?.id,
        activeDevice: activeDevice,
        connectedDevices: devices,
        lastTargetDevice: activeDevice?.name,
        appMode: 'controller',
        projectionActive: false,
        sessionHistory: [],
      };

      const callbacks: ActionRouterCallbacks = {
        sendMessage: onSendMessage,
        selectDevice: onSelectDevice,
        startProjection: onStartProjection,
        stopProjection: onStopProjection,
        pauseProjection: onPauseProjection,
        resumeProjection: onResumeProjection,
        openShareModal: onOpenShareModal,
      };

      try {
        setVoiceState('EXECUTING');
        const result = await actionRouterRef.current.processCommand(
          rawTranscript,
          context,
          callbacks
        );

        if (result.success) {
          setVoiceState('SUCCESS');
          setStatusMessage(result.message);
          triggerHaptic('double', vibrationEnabled);

          setCurrentCommand((prev) =>
            prev ? { ...prev, state: 'SUCCESS', result, parsedIntent: result.data?.intent } : null
          );

          // Audio feedback if enabled
          if (settings.voiceResponse) {
            await voiceFeedbackService.speak(result.message, settings.language);
          }

          // Continuous listening support
          if (settings.continuousVoice && voiceRecognitionService.isSupported()) {
            setTimeout(() => {
              startListening();
            }, 1200);
          } else {
            setTimeout(() => {
              setVoiceState('IDLE');
              setStatusMessage('Ready for next command');
            }, 4000);
          }
        } else {
          // Clarification needed or action rejected
          if (result.data?.clarificationOptions) {
            setVoiceState('WAITING_FOR_CONFIRMATION');
            setStatusMessage(result.message);
            triggerHaptic('medium', vibrationEnabled);

            if (settings.voiceResponse) {
              await voiceFeedbackService.speak(result.message, settings.language);
            }
          } else {
            setVoiceState('ERROR');
            setStatusMessage(result.message);
            triggerHaptic('error', vibrationEnabled);

            if (settings.voiceResponse) {
              await voiceFeedbackService.speak(result.message, settings.language);
            }

            setTimeout(() => {
              setVoiceState('IDLE');
              setStatusMessage('Ready for voice commands');
            }, 4500);
          }
        }
      } catch (err: any) {
        setVoiceState('ERROR');
        const errMsg = err.message || 'Execution failed';
        setStatusMessage(errMsg);
        triggerHaptic('error', vibrationEnabled);

        if (settings.voiceResponse) {
          await voiceFeedbackService.speak(`Sorry, ${errMsg}`, settings.language);
        }

        setTimeout(() => {
          setVoiceState('IDLE');
          setStatusMessage('Ready for voice commands');
        }, 4000);
      }
    },
    [
      activeDevice,
      devices,
      onSendMessage,
      onSelectDevice,
      onStartProjection,
      onStopProjection,
      onPauseProjection,
      onResumeProjection,
      onOpenShareModal,
      settings,
      vibrationEnabled,
    ]
  );

  // Setup Voice Recognition Service callbacks
  useEffect(() => {
    if (!voiceRecognitionService.isSupported()) {
      setVoiceState('UNSUPPORTED');
      setStatusMessage('Voice recognition is not supported in this browser.');
      return;
    }

    const unsubStart = voiceRecognitionService.onStart(() => {
      triggerHaptic('light', vibrationEnabled);
      setVoiceState('LISTENING');
      setStatusMessage('Speak your command...');
      setInterimTranscript('');
    });

    const unsubInterim = voiceRecognitionService.onInterimResult((interim) => {
      setVoiceState('TRANSCRIBING');
      setInterimTranscript(interim);
      setStatusMessage('Listening to your voice...');
    });

    const unsubResult = (transcript: string, confidence: number) => {
      setInterimTranscript('');
      const cmd: VoiceCommand = {
        commandId: generateVoiceCommandId(),
        transcript,
        speechConfidence: confidence,
        intentConfidence: 0.9,
        language: settings.language,
        timestamp: Date.now(),
        state: 'TRANSCRIBING',
      };
      setCurrentCommand(cmd);

      // Execute flow based on execution mode setting
      if (settings.executionMode === 'always_confirm') {
        setVoiceState('WAITING_FOR_CONFIRMATION');
        setStatusMessage(`Execute: "${transcript}"?`);
      } else {
        // Safe auto-execute or ask when needed
        executeCommand(transcript);
      }
    };

    const unsubResultClean = voiceRecognitionService.onResult(unsubResult);

    const unsubError = voiceRecognitionService.onError((errText) => {
      setVoiceState('ERROR');
      setStatusMessage(errText);
      triggerHaptic('error', vibrationEnabled);
      setTimeout(() => {
        setVoiceState('IDLE');
        setStatusMessage('Ready for voice commands');
      }, 3500);
    });

    const unsubEnd = voiceRecognitionService.onEnd(() => {
      // If stopped listening without final result
      setVoiceState((curr) => {
        if (curr === 'LISTENING' || curr === 'TRANSCRIBING') {
          return 'IDLE';
        }
        return curr;
      });
    });

    return () => {
      unsubStart();
      unsubInterim();
      unsubResultClean();
      unsubError();
      unsubEnd();
      voiceRecognitionService.stopListening();
      voiceFeedbackService.stop();
    };
  }, [settings.language, settings.executionMode, executeCommand, vibrationEnabled]);

  // Start & Stop Microphone helpers
  const startListening = async () => {
    if (!voiceRecognitionService.isSupported()) return;
    try {
      voiceFeedbackService.stop();
      await voiceRecognitionService.startListening({ language: settings.language });
    } catch (err: any) {
      setVoiceState('ERROR');
      setStatusMessage(err.message || 'Microphone activation error');
    }
  };

  const stopListening = async () => {
    await voiceRecognitionService.stopListening();
  };

  // Keyboard shortcut: Ctrl + Shift + Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        if (voiceState === 'LISTENING' || voiceState === 'TRANSCRIBING') {
          stopListening();
        } else if (voiceState === 'IDLE' || voiceState === 'SUCCESS' || voiceState === 'ERROR') {
          startListening();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [voiceState]);

  // User interaction handlers for Tap and Hold modes
  const handleTap = () => {
    if (voiceState === 'LISTENING' || voiceState === 'TRANSCRIBING') {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleHoldStart = () => {
    startListening();
  };

  const handleHoldEnd = () => {
    stopListening();
  };

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden space-y-4 bg-zinc-950 text-white select-none relative max-w-lg mx-auto w-full">
      {/* 1. Header Bar: Status & Controls */}
      <div className="p-3.5 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-xl space-y-3">
        <VoiceStatus
          state={voiceState}
          statusText={statusMessage}
          isMicrophoneActive={voiceState === 'LISTENING' || voiceState === 'TRANSCRIBING'}
        />

        {/* Target & Settings Strip */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-zinc-500 font-semibold">Target:</span>
            <span className="font-bold text-white truncate">
              {activeDevice ? activeDevice.name : 'All Connected Devices'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick Language Toggle */}
            <div className="flex items-center gap-1 bg-zinc-950/80 px-2 py-1 rounded-xl border border-zinc-800">
              <Globe className="w-3 h-3 text-indigo-400" />
              <select
                value={settings.language}
                onChange={(e) => handleUpdateSettings({ language: e.target.value as VoiceLanguage })}
                className="bg-transparent text-[11px] text-zinc-300 font-medium focus:outline-none cursor-pointer"
                title="Change Voice Recognition Language"
              >
                {VOICE_LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-zinc-900 text-white">
                    {opt.flag} {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Voice Feedback Audio Mute Toggle */}
            <button
              type="button"
              onClick={() => handleUpdateSettings({ voiceResponse: !settings.voiceResponse })}
              className={`p-1.5 rounded-xl border transition-colors ${
                settings.voiceResponse
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500'
              }`}
              title={settings.voiceResponse ? 'TTS Spoken Feedback Enabled' : 'TTS Feedback Muted'}
            >
              {settings.voiceResponse ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            {/* Settings Dialog Trigger */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              title="Voice Settings"
            >
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Unsupported Browser Warning Fallback */}
      {voiceState === 'UNSUPPORTED' && (
        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-center">
          <div className="p-3 w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <MicOff className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">Voice recognition is not supported in this browser.</h4>
            <p className="text-xs text-zinc-400">
              Web Speech API is unavailable in this environment. You can control all devices seamlessly using typed commands.
            </p>
          </div>
          {onSwitchToTextChat && (
            <button
              type="button"
              onClick={() => onSwitchToTextChat()}
              className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Keyboard className="w-4 h-4" />
              <span>Type Command Instead</span>
            </button>
          )}
        </div>
      )}

      {/* 3. Central Interactive Microphone Unit */}
      {voiceState !== 'UNSUPPORTED' && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[190px]">
          <MicrophoneButton
            state={voiceState}
            inputMode={settings.inputMode}
            onTap={handleTap}
            onHoldStart={handleHoldStart}
            onHoldEnd={handleHoldEnd}
            disabled={voiceState === 'PROCESSING' || voiceState === 'EXECUTING'}
          />
        </div>
      )}

      {/* 4. Live Speech Transcript Card & Execution Controls */}
      <TranscriptView
        currentCommand={currentCommand}
        interimTranscript={interimTranscript}
        isListening={voiceState === 'LISTENING' || voiceState === 'TRANSCRIBING'}
        onExecute={(text) => executeCommand(text)}
        onRetry={() => {
          setCurrentCommand(null);
          setInterimTranscript('');
          startListening();
        }}
        onCancel={() => {
          voiceRecognitionService.cancelListening();
          setCurrentCommand(null);
          setInterimTranscript('');
          setVoiceState('IDLE');
        }}
      />

      {/* 5. Natural Voice Suggestions */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-zinc-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400" />
            Try saying:
          </span>
          {onSwitchToTextChat && (
            <button
              type="button"
              onClick={() => onSwitchToTextChat(currentCommand?.transcript || '')}
              className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 hover:underline"
            >
              <Keyboard className="w-3 h-3" />
              <span>Switch to Type</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {VOICE_QUICK_COMMANDS.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => executeCommand(phrase)}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white shrink-0 text-[11px] font-medium transition-all active:scale-95"
            >
              "{phrase}"
            </button>
          ))}
        </div>
      </div>

      {/* 6. Voice Settings Modal */}
      <VoiceSettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* 7. Voice Confirmation Dialog for Sensitive Actions */}
      <VoiceConfirmation
        intent={pendingConfirmation?.intent || null}
        targetDeviceName={pendingConfirmation?.device.name || activeDevice?.name || 'Device'}
        onConfirm={() => {
          triggerHaptic('medium', vibrationEnabled);
          confirmationManagerRef.current.confirmCurrent();
          setPendingConfirmation(null);
        }}
        onCancel={() => {
          triggerHaptic('light', vibrationEnabled);
          confirmationManagerRef.current.cancelCurrent();
          setPendingConfirmation(null);
          setVoiceState('IDLE');
          setStatusMessage('Command cancelled');
        }}
      />
    </div>
  );
};
