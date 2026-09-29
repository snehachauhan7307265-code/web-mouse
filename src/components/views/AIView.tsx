import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Mic, 
  MicOff, 
  Send, 
  Sparkles, 
  History, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  RefreshCw,
  Play,
  X
} from 'lucide-react';
import { Device, OutgoingMessage } from '../../types';
import { AIConfirmationManager, PendingConfirmation } from '../../ai/AIConfirmationManager';
import { AIActionRouter, ActionRouterCallbacks } from '../../ai/AIActionRouter';
import { aiHistory } from '../../ai/AIHistory';
import { AIHistoryEntry, AIContext } from '../../ai/AIContext';
import { voiceRecognitionService } from '../../voice/VoiceRecognitionService';
import { voiceFeedbackService } from '../../voice/VoiceFeedbackService';
import { triggerHaptic } from '../../services/websocketService';
import { AIConfirmationDialog } from '../../features/ai/AIConfirmationDialog';

interface AIViewProps {
  devices: Device[];
  activeDevice: Device | null;
  onSendMessage: (msg: OutgoingMessage) => void;
  onSelectDevice?: (dev: Device) => void;
  onStartProjection?: (targetDeviceName: string) => Promise<boolean>;
  onStopProjection?: () => void;
  onPauseProjection?: () => void;
  onResumeProjection?: () => void;
  onOpenShareModal?: () => void;
  vibrationEnabled?: boolean;
  autoStartVoice?: boolean;
}

export const AIView: React.FC<AIViewProps> = ({
  devices,
  activeDevice,
  onSendMessage,
  onSelectDevice,
  onStartProjection,
  onStopProjection,
  onPauseProjection,
  onResumeProjection,
  onOpenShareModal,
  vibrationEnabled = true,
  autoStartVoice = false,
}) => {
  const confirmationManagerRef = useRef<AIConfirmationManager>(new AIConfirmationManager());
  const actionRouterRef = useRef<AIActionRouter>(new AIActionRouter(confirmationManagerRef.current));

  const [inputCommand, setInputCommand] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [historyEntries, setHistoryEntries] = useState<AIHistoryEntry[]>(() => aiHistory.getEntries());

  const examples = [
    'Open Chrome on my laptop',
    'Play music on TV',
    'Project my screen to Smart Board',
    'Next slide',
    'Laptop par Chrome kholo',
    'Mute volume',
  ];

  // Subscribe to confirmation requests & history
  useEffect(() => {
    const unsubConfirm = confirmationManagerRef.current.subscribe((pending) => {
      setPendingConfirmation(pending);
    });

    const unsubHistory = aiHistory.subscribe((entries) => {
      setHistoryEntries(entries);
    });

    return () => {
      unsubConfirm();
      unsubHistory();
    };
  }, []);

  // Voice recognition listeners
  useEffect(() => {
    voiceRecognitionService.onStart(() => {
      setIsListening(true);
      setTranscript('');
      setStatusMessage('Listening to your voice command...');
    });

    voiceRecognitionService.onInterimResult((interim) => {
      setTranscript(interim);
    });

    voiceRecognitionService.onResult((finalText) => {
      setTranscript(finalText);
      setInputCommand(finalText);
      setIsListening(false);
    });

    voiceRecognitionService.onError((err) => {
      setIsListening(false);
      setStatusMessage(`Microphone: ${err}`);
      setTimeout(() => setStatusMessage(null), 3000);
    });

    voiceRecognitionService.onEnd(() => {
      setIsListening(false);
    });

    if (autoStartVoice && voiceRecognitionService.isSupported()) {
      handleToggleVoice();
    }

    return () => {
      voiceRecognitionService.cancelListening();
    };
  }, [autoStartVoice]);

  const handleToggleVoice = async () => {
    triggerHaptic('medium', vibrationEnabled);
    if (isListening) {
      await voiceRecognitionService.stopListening();
    } else {
      if (!voiceRecognitionService.isSupported()) {
        setStatusMessage('Voice recognition is not supported in this browser.');
        return;
      }
      try {
        await voiceRecognitionService.startListening();
      } catch (e: any) {
        setStatusMessage(`Could not access microphone: ${e?.message || e}`);
      }
    }
  };

  const handleExecute = async (cmdText?: string) => {
    const textToRun = (cmdText || inputCommand || transcript).trim();
    if (!textToRun || isProcessing) return;

    triggerHaptic('medium', vibrationEnabled);
    setIsProcessing(true);
    setStatusMessage(`Processing: "${textToRun}"...`);

    const callbacks: ActionRouterCallbacks = {
      sendMessage: onSendMessage,
      selectDevice: onSelectDevice,
      startProjection: onStartProjection,
      stopProjection: onStopProjection,
      pauseProjection: onPauseProjection,
      resumeProjection: onResumeProjection,
      openShareModal: onOpenShareModal,
    };

    const context: AIContext = {
      activeDeviceId: activeDevice?.id,
      activeDevice: activeDevice,
      connectedDevices: devices,
      lastTargetDevice: activeDevice?.name,
      appMode: 'controller',
      projectionActive: false,
      sessionHistory: [],
    };

    try {
      const result = await actionRouterRef.current.processCommand(
        textToRun,
        context,
        callbacks
      );

      setIsProcessing(false);
      setStatusMessage(result.message);
      setTranscript('');
      setInputCommand('');

      if (result.success) {
        voiceFeedbackService.speak(result.message);
      }
    } catch (err: any) {
      setIsProcessing(false);
      setStatusMessage(`Error executing command: ${err?.message || err}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 overflow-y-auto pb-12 select-none animate-in fade-in duration-200">
      {/* Header (Section 8) */}
      <div>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            WebMouse AI
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Control your devices using natural language in English, Hindi, or Hinglish.
        </p>
      </div>

      {/* Large Command Box with Integrated 🎤 Voice (Section 8 & 9) */}
      <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-4 sm:p-5 shadow-xl space-y-3">
        <div className="relative">
          <textarea
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleExecute();
              }
            }}
            placeholder="Ask WebMouse anything... (e.g. 'Open Chrome on my laptop' or 'Laptop par Chrome kholo')"
            rows={2}
            className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl p-3.5 pr-24 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/80 resize-none shadow-inner"
          />

          <div className="absolute right-2.5 bottom-3 flex items-center gap-1.5">
            {/* Integrated Mic Button */}
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`p-2 rounded-xl transition-all active:scale-95 ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/30'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white'
              }`}
              title={isListening ? 'Stop listening' : 'Start voice command'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Execute Button */}
            <button
              type="button"
              onClick={() => handleExecute()}
              disabled={(!inputCommand.trim() && !transcript.trim()) || isProcessing}
              className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white transition-all active:scale-95 shadow-md shadow-rose-600/20"
              title="Run command"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Live Listening & Transcript State (Section 9) */}
        {isListening && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-rose-300 block">🔴 Listening...</span>
                <p className="text-xs text-white truncate font-medium">
                  {transcript || 'Speak your command now...'}
                </p>
              </div>
            </div>

            <button
              onClick={() => voiceRecognitionService.stopListening()}
              className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold shrink-0"
            >
              Done
            </button>
          </div>
        )}

        {/* Status Response Message */}
        {statusMessage && !isListening && (
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Suggestion Examples (Section 8) */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block px-1">
          Try saying or typing:
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {examples.map((example) => (
            <button
              key={example}
              onClick={() => {
                setInputCommand(example);
                handleExecute(example);
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 text-xs text-zinc-300 hover:text-white transition-all active:scale-95"
            >
              "{example}"
            </button>
          ))}
        </div>
      </div>

      {/* Recent AI Commands (Section 8) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-zinc-500" />
            <span>Recent AI Commands</span>
          </h3>
          {historyEntries.length > 0 && (
            <button
              onClick={() => aiHistory.clearHistory()}
              className="text-[11px] text-zinc-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {historyEntries.length === 0 ? (
          <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 text-center space-y-1">
            <Bot className="w-6 h-6 text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-400 font-medium">No recent AI commands</p>
            <p className="text-[11px] text-zinc-600">Commands and voice actions will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...historyEntries].reverse().slice(0, 6).map((entry) => (
              <div
                key={entry.id}
                className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-3 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white truncate max-w-sm">
                      "{entry.userQuery}"
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      · {entry.targetDevice || 'Default PC'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                    {entry.message}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-1 text-[11px] font-medium">
                  {entry.result === 'success' ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Executed</span>
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{entry.result}</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog (Section 9) */}
      <AIConfirmationDialog
        pending={pendingConfirmation}
        onConfirm={() => confirmationManagerRef.current.resolvePending(true)}
        onCancel={() => confirmationManagerRef.current.resolvePending(false)}
      />
    </div>
  );
};
