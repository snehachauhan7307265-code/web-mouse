/**
 * WebMouse V2 — Phase 3: AI Control Panel
 * Transforms WebMouse into an AI-powered universal device controller.
 * Natural Language ➔ Intent ➔ Capability Validation ➔ Safe Device Action.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  History, 
  Trash2, 
  X, 
  ShieldCheck, 
  Smartphone, 
  Tv, 
  Monitor, 
  Laptop,
  CheckCircle2,
  AlertCircle,
  Mic,
  MessageSquare
} from 'lucide-react';
import { Device, OutgoingMessage } from '../../types';
import { AIContext, AIChatMessage, AIHistoryEntry } from '../../ai/AIContext';
import { AIActionRouter, ActionRouterCallbacks } from '../../ai/AIActionRouter';
import { AIConfirmationManager, PendingConfirmation } from '../../ai/AIConfirmationManager';
import { aiHistory } from '../../ai/AIHistory';
import { AIStatus, AIControlStatus } from './AIStatus';
import { AIChat } from './AIChat';
import { AICommandInput } from './AICommandInput';
import { AIConfirmationDialog } from './AIConfirmationDialog';
import { VoiceControlPanel } from '../voice/VoiceControlPanel';
import { triggerHaptic } from '../../services/websocketService';

interface AIControlPanelProps {
  devices: Device[];
  activeDevice: Device | null;
  onSendMessage: (msg: OutgoingMessage) => void;
  onSelectDevice?: (device: Device) => void;
  onStartProjection?: (targetDeviceName: string) => Promise<boolean>;
  onStopProjection?: () => void;
  onPauseProjection?: () => void;
  onResumeProjection?: () => void;
  onOpenShareModal?: () => void;
  vibrationEnabled?: boolean;
}

export const AIControlPanel: React.FC<AIControlPanelProps> = ({
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
}) => {
  // Engine Services held in refs
  const confirmationManagerRef = useRef<AIConfirmationManager>(new AIConfirmationManager());
  const actionRouterRef = useRef<AIActionRouter>(new AIActionRouter(confirmationManagerRef.current));

  // UI States
  const [aiViewMode, setAiViewMode] = useState<'voice' | 'chat'>('voice');
  const [prefillCommand, setPrefillCommand] = useState<string>('');
  const [status, setStatus] = useState<AIControlStatus>('ready');
  const [statusMessage, setStatusMessage] = useState<string>('Ready for voice or typed commands');
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hello! I can control your laptop, TV, and Smart Board. Type or speak what you would like to do.',
      timestamp: Date.now(),
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  // Audit History Drawer Modal
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<AIHistoryEntry[]>(() => aiHistory.getEntries());

  // Subscribe to confirmation requests and history updates
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

  const handleExecuteCommand = async (commandText: string) => {
    if (!commandText.trim() || isProcessing) return;

    triggerHaptic('light', vibrationEnabled);
    setIsProcessing(true);
    setStatus('thinking');
    setStatusMessage('Parsing intent and verifying capabilities...');

    // 1. Add User Message to Chat
    const userMsg: AIChatMessage = {
      id: `USR-${Date.now()}`,
      role: 'user',
      text: commandText,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // 2. Prepare Context
    const context: AIContext = {
      activeDeviceId: activeDevice?.id,
      activeDevice: activeDevice,
      connectedDevices: devices,
      lastTargetDevice: activeDevice?.name,
      appMode: 'controller',
      projectionActive: false,
      sessionHistory: [...messages, userMsg],
    };

    // 3. Prepare Existing Service Callbacks
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
      // 4. Process command through the safe Action Router pipeline
      setStatus('executing');
      const result = await actionRouterRef.current.processCommand(commandText, context, callbacks);

      if (result.success) {
        setStatus('completed');
        setStatusMessage(`Executed: ${result.intent}`);
        triggerHaptic('double', vibrationEnabled);

        const aiMsg: AIChatMessage = {
          id: `AI-${Date.now()}`,
          role: 'assistant',
          text: result.message,
          timestamp: Date.now(),
          intent: result.intent,
          status: 'completed',
          data: result.data,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        // Clarification or Rejection/Failure
        if (result.data?.clarificationOptions) {
          setStatus('clarification');
          setStatusMessage('Waiting for your selection');
          triggerHaptic('medium', vibrationEnabled);

          const aiMsg: AIChatMessage = {
            id: `AI-${Date.now()}`,
            role: 'assistant',
            text: result.message,
            timestamp: Date.now(),
            intent: result.intent,
            status: 'clarification',
            clarificationOptions: result.data.clarificationOptions,
          };
          setMessages((prev) => [...prev, aiMsg]);
        } else {
          setStatus('failed');
          setStatusMessage(result.message);
          triggerHaptic('error', vibrationEnabled);

          const aiMsg: AIChatMessage = {
            id: `AI-${Date.now()}`,
            role: 'assistant',
            text: result.message,
            timestamp: Date.now(),
            intent: result.intent,
            status: 'failed',
          };
          setMessages((prev) => [...prev, aiMsg]);
        }
      }
    } catch (e: any) {
      setStatus('failed');
      setStatusMessage(e.message || 'Execution error');
      triggerHaptic('error', vibrationEnabled);

      const aiMsg: AIChatMessage = {
        id: `AI-${Date.now()}`,
        role: 'assistant',
        text: `Execution failed: ${e.message}`,
        timestamp: Date.now(),
        status: 'failed',
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setStatus((curr) => (curr === 'thinking' || curr === 'executing' ? 'ready' : curr));
      }, 3500);
    }
  };

  const handleSelectClarification = (option: string) => {
    handleExecuteCommand(option);
  };

  const handleClearSession = () => {
    triggerHaptic('light', vibrationEnabled);
    setMessages([
      {
        id: 'reset',
        role: 'assistant',
        text: 'Session cleared. How can I assist you?',
        timestamp: Date.now(),
      },
    ]);
    setStatus('ready');
    setStatusMessage('Ready for commands');
  };

  const handleClearHistory = () => {
    triggerHaptic('medium', vibrationEnabled);
    aiHistory.clearHistory();
  };

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden space-y-3 bg-zinc-950 text-white select-none relative">
      {/* Sub-Mode Switcher: Voice Control vs Text Assistant */}
      <div className="flex items-center p-1 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm shrink-0">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light', vibrationEnabled);
            setAiViewMode('voice');
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            aiViewMode === 'voice'
              ? 'bg-gradient-to-r from-rose-600 to-indigo-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>🎤 Voice Control</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light', vibrationEnabled);
            setAiViewMode('chat');
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            aiViewMode === 'chat'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>💬 Text Assistant</span>
        </button>
      </div>

      {/* Mode 1: Voice Control Engine */}
      {aiViewMode === 'voice' ? (
        <VoiceControlPanel
          devices={devices}
          activeDevice={activeDevice}
          onSendMessage={onSendMessage}
          onSelectDevice={onSelectDevice}
          onStartProjection={onStartProjection}
          onStopProjection={onStopProjection}
          onPauseProjection={onPauseProjection}
          onResumeProjection={onResumeProjection}
          onOpenShareModal={onOpenShareModal}
          onSwitchToTextChat={(prefill) => {
            if (prefill) setPrefillCommand(prefill);
            setAiViewMode('chat');
          }}
          vibrationEnabled={vibrationEnabled}
        />
      ) : (
        /* Mode 2: Text Chat Assistant */
        <>
          {/* Top Header & Status Bar */}
          <div className="p-3.5 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-xl space-y-2">
            <AIStatus status={status} statusText={statusMessage} />

            {/* Quick Context Bar */}
            <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 text-[11px] text-zinc-400">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-zinc-500 font-semibold">Active Target:</span>
                <span className="font-bold text-white truncate">
                  {activeDevice ? activeDevice.name : 'None selected'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition-colors"
              >
                <History className="w-3.5 h-3.5 text-indigo-400" />
                <span>Audit Log ({historyEntries.length})</span>
              </button>
            </div>
          </div>

          {/* Main Conversation Stream */}
          <AIChat
            messages={messages}
            onSelectClarification={handleSelectClarification}
            onClearSession={handleClearSession}
          />

          {/* Command Input Area */}
          <AICommandInput
            onExecute={handleExecuteCommand}
            isProcessing={isProcessing}
            disabled={isProcessing}
            initialValue={prefillCommand}
            onSwitchToVoice={() => setAiViewMode('voice')}
          />
        </>
      )}

      {/* Confirmation Dialog for Sensitive Actions */}
      <AIConfirmationDialog
        pending={pendingConfirmation}
        onConfirm={() => {
          triggerHaptic('medium', vibrationEnabled);
          confirmationManagerRef.current.confirmCurrent();
        }}
        onCancel={() => {
          triggerHaptic('light', vibrationEnabled);
          confirmationManagerRef.current.cancelCurrent();
        }}
      />

      {/* Audit History Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">AI Action Audit Log</h3>
                  <p className="text-[10px] text-zinc-400">Session-only verifiable execution history</p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1.5 text-zinc-500 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px]">
              {historyEntries.length === 0 ? (
                <div className="text-center py-12 text-xs text-zinc-500">
                  No actions logged yet in this session.
                </div>
              ) : (
                historyEntries.map((e) => (
                  <div
                    key={e.id}
                    className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
                      <span
                        className={`font-bold ${
                          e.result === 'success'
                            ? 'text-emerald-400'
                            : e.result === 'clarification'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {e.result.toUpperCase()}
                      </span>
                    </div>
                    <div className="font-semibold text-white">"{e.userQuery}"</div>
                    <div className="text-[11px] text-zinc-400">{e.message}</div>
                    <div className="text-[10px] text-zinc-500 font-mono pt-0.5">
                      Intent: {e.intent} {e.targetDevice ? `• Target: ${e.targetDevice}` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-xs">
              <button
                onClick={handleClearHistory}
                disabled={historyEntries.length === 0}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
