/**
 * WebMouse V2 — Voice Command & Multi-step Plan Models
 */

import { AIIntent, AIPlan, AIExecutionResult } from '../ai/AIIntent';
import { VoiceState } from './VoiceState';

export interface VoiceCommand {
  commandId: string;
  transcript: string;
  interimTranscript?: string;
  speechConfidence: number;
  intentConfidence: number;
  language: string;
  timestamp: number;
  state: VoiceState;
  parsedIntent?: AIIntent;
  plan?: AIPlan;
  result?: AIExecutionResult;
  error?: string;
}

export function generateVoiceCommandId(): string {
  const ts = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `VOICE-${ts}-${rand}`;
}
