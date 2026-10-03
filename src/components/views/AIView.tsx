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
  Volume2, 
  VolumeX, 
  Volume1, 
  Monitor, 
  Lock, 
  Camera, 
  Play, 
  Square, 
  Laptop, 
  ExternalLink,
  Search,
  Globe,
  Radio,
  FileText,
  Calculator,
  Plus
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
  isConnected: boolean;
  activeDevice: Device | null;
  devices?: Device[];
  onSendMessage: (msg: OutgoingMessage | any) => void;
  onNavigateToControl?: (mode?: any) => void;
  onOpenConnectionModal?: () => void;
  vibrationEnabled?: boolean;
  autoStartVoice?: boolean;
}

export const AIView: React.FC<AIViewProps> = ({
  isConnected,
  activeDevice,
  devices = [],
  onSendMessage,
  onOpenConnectionModal,
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
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('info');
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [historyEntries, setHistoryEntries] = useState<AIHistoryEntry[]>(() => aiHistory.getEntries());
  const [languageMode, setLanguageMode] = useState<'hi-IN' | 'en-IN'>('en-IN');
  const [lastExecutedCmd, setLastExecutedCmd] = useState<string | null>(null);

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

  // Set up Speech Recognition listeners
  useEffect(() => {
    const unsubStart = voiceRecognitionService.onStart(() => {
      setIsListening(true);
      setTranscript('');
      setStatusType('info');
      setStatusMessage('Listening... Speak your command (e.g. "youtube chalao", "chrome kholo")');
    });

    const unsubInterim = voiceRecognitionService.onInterimResult((interim) => {
      setTranscript(interim);
    });

    // CRITICAL: AUTO-EXECUTE IMMEDIATELY ON SPEECH END ("turant chalu kar de")
    const unsubResult = voiceRecognitionService.onResult((finalText) => {
      const cleanText = finalText.trim();
      setTranscript(cleanText);
      setInputCommand(cleanText);
      setIsListening(false);

      if (cleanText) {
        // Immediate automatic execution as requested by the user
        handleExecute(cleanText);
      }
    });

    const unsubError = voiceRecognitionService.onError((err) => {
      setIsListening(false);
      setStatusType('error');
      setStatusMessage(`Microphone: ${err}`);
      setTimeout(() => setStatusMessage(null), 4000);
    });

    const unsubEnd = voiceRecognitionService.onEnd(() => {
      setIsListening(false);
    });

    if (autoStartVoice && voiceRecognitionService.isSupported()) {
      handleToggleVoice();
    }

    return () => {
      unsubStart();
      unsubInterim();
      unsubResult();
      unsubError();
      unsubEnd();
      voiceRecognitionService.cancelListening();
    };
  }, [languageMode]);

  const handleToggleVoice = async () => {
    triggerHaptic('medium', vibrationEnabled);
    if (isListening) {
      await voiceRecognitionService.stopListening();
      setIsListening(false);
    } else {
      if (!voiceRecognitionService.isSupported()) {
        setStatusType('error');
        setStatusMessage('Voice recognition is not supported in this browser. Please type commands below.');
        return;
      }
      try {
        await voiceRecognitionService.startListening({ language: languageMode });
      } catch (e: any) {
        setStatusType('error');
        setStatusMessage(`Could not access microphone: ${e?.message || e}`);
      }
    }
  };

  const handleExecute = async (cmdText?: string) => {
    const textToRun = (cmdText || inputCommand || transcript).trim();
    if (!textToRun || isProcessing) return;

    triggerHaptic('medium', vibrationEnabled);
    setIsProcessing(true);
    setLastExecutedCmd(textToRun);
    setStatusType('info');
    setStatusMessage(`Running command: "${textToRun}"...`);

    const effectiveDevices = devices.length > 0 ? devices : (activeDevice ? [activeDevice] : []);

    const callbacks: ActionRouterCallbacks = {
      sendMessage: onSendMessage,
    };

    const context: AIContext = {
      activeDeviceId: activeDevice?.id,
      activeDevice: activeDevice || effectiveDevices[0] || null,
      connectedDevices: effectiveDevices,
      lastTargetDevice: activeDevice?.name || effectiveDevices[0]?.name,
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
      setTranscript('');
      setInputCommand('');

      if (result.success) {
        setStatusType('success');
        setStatusMessage(result.message || `Executed "${textToRun}" on laptop`);
        voiceFeedbackService.speak(result.message);
      } else {
        setStatusType('error');
        setStatusMessage(result.message || 'Could not execute command');
      }
    } catch (err: any) {
      setIsProcessing(false);
      setStatusType('error');
      setStatusMessage(`Error executing command: ${err?.message || err}`);
    }
  };

  const quickVoiceActions = [
    {
      category: 'Web & Media',
      items: [
        { label: 'YouTube Chalao', query: 'youtube chalao', icon: <Play className="w-3.5 h-3.5 text-rose-400" /> },
        { label: 'Chrome Kholo', query: 'chrome kholo', icon: <Globe className="w-3.5 h-3.5 text-blue-400" /> },
        { label: 'Google Search', query: 'google search karo', icon: <Search className="w-3.5 h-3.5 text-emerald-400" /> },
        { label: 'Gaana Chalao', query: 'gaana chalao', icon: <Radio className="w-3.5 h-3.5 text-amber-400" /> },
      ]
    },
    {
      category: 'Apps & Utilities',
      items: [
        { label: 'Notepad Kholo', query: 'notepad kholo', icon: <FileText className="w-3.5 h-3.5 text-indigo-400" /> },
        { label: 'Calculator Kholo', query: 'calculator kholo', icon: <Calculator className="w-3.5 h-3.5 text-purple-400" /> },
        { label: 'File Explorer', query: 'explorer kholo', icon: <Monitor className="w-3.5 h-3.5 text-cyan-400" /> },
      ]
    },
    {
      category: 'Windows Controls',
      items: [
        { label: 'Volume Badhao', query: 'volume badhao', icon: <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> },
        { label: 'Volume Kam', query: 'volume kam karo', icon: <Volume1 className="w-3.5 h-3.5 text-yellow-400" /> },
        { label: 'Mute Audio', query: 'mute karo', icon: <VolumeX className="w-3.5 h-3.5 text-zinc-400" /> },
        { label: 'Desktop Dikhao', query: 'desktop dikhao', icon: <Monitor className="w-3.5 h-3.5 text-blue-400" /> },
        { label: 'Laptop Lock Karo', query: 'laptop lock karo', icon: <Lock className="w-3.5 h-3.5 text-rose-400" /> },
        { label: 'Screenshot Lo', query: 'screenshot lo', icon: <Camera className="w-3.5 h-3.5 text-pink-400" /> },
      ]
    }
  ];

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 overflow-y-auto pb-16 select-none animate-in fade-in duration-200">
      
      {/* Top Device Connection Banner */}
      <div className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
        isConnected 
          ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
          : 'bg-zinc-900/80 border-zinc-800 text-zinc-400'
      }`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-3 h-3 rounded-full shrink-0 ${
            isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'
          }`} />
          <div className="min-w-0">
            <span className="text-xs font-bold text-white truncate block">
              {isConnected 
                ? `Connected to ${activeDevice?.name || 'Windows Laptop'}` 
                : 'No Laptop Connected'}
            </span>
            <span className="text-[11px] text-zinc-400 truncate block">
              {isConnected 
                ? 'Voice commands will execute instantly on this PC' 
                : 'Connect your PC to execute voice commands'}
            </span>
          </div>
        </div>

        {!isConnected && onOpenConnectionModal && (
          <button
            onClick={onOpenConnectionModal}
            className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shrink-0 flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect PC</span>
          </button>
        )}
      </div>

      {/* Header & Language Mode Selector */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Voice & AI Commander
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Bolo aur laptop par turant execute hoga (YouTube, Chrome, Volume, Apps, System).
          </p>
        </div>

        {/* Language selector toggle */}
        <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
          <button
            onClick={() => setLanguageMode('en-IN')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              languageMode === 'en-IN' ? 'bg-rose-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Hinglish / EN
          </button>
          <button
            onClick={() => setLanguageMode('hi-IN')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              languageMode === 'hi-IN' ? 'bg-rose-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            हिन्दी (Hindi)
          </button>
        </div>
      </div>

      {/* HERO VOICE COMMAND ACTIVATOR ("Bolo aur Laptop Par Chalu") */}
      <div className="rounded-3xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800/90 p-6 sm:p-8 shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden">
        {/* Glow behind mic */}
        <div className={`absolute w-48 h-48 rounded-full blur-3xl pointer-events-none transition-all duration-300 ${
          isListening ? 'bg-rose-600/30' : isProcessing ? 'bg-indigo-600/20' : 'bg-rose-900/10'
        }`} />

        {/* Large Glowing Microphone Button */}
        <button
          type="button"
          onClick={handleToggleVoice}
          className={`relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 active:scale-95 shadow-xl ${
            isListening
              ? 'bg-rose-600 text-white ring-8 ring-rose-500/30 shadow-rose-600/50 scale-105 animate-pulse'
              : 'bg-zinc-850 hover:bg-zinc-800 text-rose-400 border border-zinc-700 hover:border-rose-500/50 hover:shadow-rose-500/20'
          }`}
          title={isListening ? 'Listening... Tap to stop' : 'Tap and speak command'}
        >
          {isListening ? (
            <Mic className="w-10 h-10 sm:w-12 sm:h-12 animate-bounce" />
          ) : (
            <Mic className="w-10 h-10 sm:w-12 sm:h-12" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-wider mt-1">
            {isListening ? 'Listening' : 'Tap to Speak'}
          </span>
        </button>

        {/* Real-time sound wave bars when listening */}
        {isListening && (
          <div className="flex items-center gap-1.5 mt-4 z-10">
            <span className="w-1 h-5 bg-rose-500 rounded-full animate-pulse" />
            <span className="w-1 h-8 bg-rose-400 rounded-full animate-pulse delay-75" />
            <span className="w-1 h-10 bg-rose-500 rounded-full animate-pulse delay-150" />
            <span className="w-1 h-6 bg-rose-400 rounded-full animate-pulse delay-100" />
            <span className="w-1 h-4 bg-rose-500 rounded-full animate-pulse delay-200" />
          </div>
        )}

        {/* Live Transcript or Instructions */}
        <div className="mt-4 max-w-md z-10 space-y-1">
          {isListening ? (
            <div className="animate-in fade-in duration-150">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block">
                🔴 Listening Now
              </span>
              <p className="text-sm sm:text-base font-semibold text-white mt-1">
                {transcript || 'Kuchh bhi bolo: "youtube chalao", "chrome kholo", "volume badhao"...'}
              </p>
              <p className="text-[11px] text-zinc-400">
                Bolte hi turant laptop par execute ho jayega!
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-zinc-200">
                Tap mic and speak or choose an action below
              </p>
              <p className="text-xs text-zinc-500">
                "YouTube chalao" • "Chrome kholo" • "Volume badhao" • "Notepad" • "Lock karo"
              </p>
            </div>
          )}
        </div>

        {/* Execution status message banner */}
        {statusMessage && !isListening && (
          <div className={`mt-4 px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 max-w-lg z-10 animate-in fade-in duration-200 ${
            statusType === 'success' 
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : statusType === 'error'
              ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              : 'bg-zinc-900 border-zinc-800 text-zinc-300'
          }`}>
            {statusType === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : statusType === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-rose-400 shrink-0 animate-spin" />
            )}
            <span className="truncate">{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Manual Typed Command Bar (Enter to execute) */}
      <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3 sm:p-4 shadow-xl">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleExecute();
              }
            }}
            placeholder="Type anything to run on laptop... (e.g. 'youtube chalao', 'chrome', 'volume up')"
            className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/80 shadow-inner"
          />

          <button
            type="button"
            onClick={() => handleExecute()}
            disabled={!inputCommand.trim() || isProcessing}
            className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs transition-all active:scale-95 shadow-md shadow-rose-600/20 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chalao</span>
          </button>
        </div>
      </div>

      {/* ONE-TAP VOICE COMMAND CHIPS ("Instant Action Buttons") */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            <span>Instant Voice Command Buttons</span>
          </h3>
          <span className="text-[11px] text-zinc-500">Tap to run instantly on laptop</span>
        </div>

        <div className="space-y-3">
          {quickVoiceActions.map((group) => (
            <div key={group.category} className="space-y-1.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block px-1">
                {group.category}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setInputCommand(item.query);
                      handleExecute(item.query);
                    }}
                    className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 hover:text-white transition-all active:scale-95 flex items-center gap-2 shadow-sm"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Command History */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-zinc-500" />
            <span>Recent Voice & AI Commands</span>
          </h3>
          {historyEntries.length > 0 && (
            <button
              onClick={() => aiHistory.clearHistory()}
              className="text-[11px] text-zinc-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {historyEntries.length === 0 ? (
          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 text-center space-y-1">
            <Bot className="w-6 h-6 text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-400 font-medium">No recent commands</p>
            <p className="text-[11px] text-zinc-600">Commands like "youtube chalao" will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...historyEntries].reverse().slice(0, 6).map((entry) => (
              <div
                key={entry.id}
                className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-3 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white truncate max-w-sm">
                      "{entry.userQuery}"
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      · {entry.targetDevice || 'Laptop'}
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
                      <span>Done</span>
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

      {/* Confirmation Dialog */}
      <AIConfirmationDialog
        pending={pendingConfirmation}
        onConfirm={() => confirmationManagerRef.current.resolvePending(true)}
        onCancel={() => confirmationManagerRef.current.resolvePending(false)}
      />
    </div>
  );
};
