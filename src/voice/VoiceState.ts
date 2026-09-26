/**
 * WebMouse V2 — Voice State & Configuration Models
 */

export type VoiceState =
  | 'IDLE'
  | 'LISTENING'
  | 'TRANSCRIBING'
  | 'PROCESSING'
  | 'WAITING_FOR_CONFIRMATION'
  | 'EXECUTING'
  | 'SUCCESS'
  | 'ERROR'
  | 'UNSUPPORTED'
  | 'CANCELLED';

export type VoiceInputMode = 'tap' | 'hold';

export type VoiceExecutionMode = 'always_confirm' | 'ask_needed' | 'auto_execute';

export type VoiceLanguage = 'auto' | 'en-US' | 'en-IN' | 'hi-IN';

export type SpeechSensitivity = 'low' | 'medium' | 'high';

export interface VoiceSettings {
  inputMode: VoiceInputMode;
  executionMode: VoiceExecutionMode;
  language: VoiceLanguage;
  voiceResponse: boolean; // Text-to-Speech feedback (default: true)
  continuousVoice: boolean; // Continuous conversation mode (default: false)
  wakeWordEnabled: boolean; // "Hey WebMouse" wake word foundation (default: false)
  sensitivity: SpeechSensitivity;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  inputMode: 'tap',
  executionMode: 'ask_needed',
  language: 'auto',
  voiceResponse: true,
  continuousVoice: false,
  wakeWordEnabled: false,
  sensitivity: 'medium',
};
