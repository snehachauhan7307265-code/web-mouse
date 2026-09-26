/**
 * WebMouse V2 — Speech Recognition Service Abstraction
 * Wraps browser SpeechRecognition / webkitSpeechRecognition.
 * Dispatches interim and final transcripts with duplicate event protection.
 */

import { VoiceState, VoiceLanguage } from './VoiceState';

export type VoiceResultCallback = (transcript: string, confidence: number) => void;
export type VoiceInterimCallback = (interimTranscript: string) => void;
export type VoiceErrorCallback = (error: string) => void;
export type VoiceVoidCallback = () => void;
export type VoiceStateCallback = (state: VoiceState) => void;

export class VoiceRecognitionService {
  private recognition: any = null;
  private isListening = false;
  private currentState: VoiceState = 'IDLE';

  private startListeners: Set<VoiceVoidCallback> = new Set();
  private resultListeners: Set<VoiceResultCallback> = new Set();
  private interimListeners: Set<VoiceInterimCallback> = new Set();
  private errorListeners: Set<VoiceErrorCallback> = new Set();
  private endListeners: Set<VoiceVoidCallback> = new Set();
  private stateListeners: Set<VoiceStateCallback> = new Set();

  constructor() {
    this.initRecognition();
  }

  private initRecognition(): void {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = true;
        recog.maxAlternatives = 1;
        recog.lang = 'en-IN'; // Default to Indian English / Hinglish natural phonetics

        recog.onstart = () => {
          this.isListening = true;
          this.setState('LISTENING');
          this.startListeners.forEach((cb) => {
            try { cb(); } catch (e) {}
          });
        };

        recog.onresult = (event: any) => {
          let interim = '';
          let final = '';
          let finalConfidence = 0.9;

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const item = event.results[i];
            const transcript = item[0]?.transcript || '';
            const confidence = item[0]?.confidence || 0.85;

            if (item.isFinal) {
              final += transcript;
              finalConfidence = confidence;
            } else {
              interim += transcript;
            }
          }

          if (interim) {
            this.setState('TRANSCRIBING');
            this.interimListeners.forEach((cb) => {
              try { cb(interim.trim()); } catch (e) {}
            });
          }

          if (final.trim()) {
            this.resultListeners.forEach((cb) => {
              try { cb(final.trim(), Math.min(1, Math.max(0.1, finalConfidence))); } catch (e) {}
            });
          }
        };

        recog.onerror = (event: any) => {
          this.isListening = false;
          let errorMessage = 'Speech recognition error';
          if (event.error === 'not-allowed') {
            errorMessage = 'Microphone permission was denied. Please allow microphone access in your browser settings.';
          } else if (event.error === 'no-speech') {
            errorMessage = "I couldn't hear any command. Please try speaking again.";
          } else if (event.error === 'network') {
            errorMessage = 'Speech service network error. Check your connection or use typed command.';
          } else if (event.error) {
            errorMessage = `Voice error: ${event.error}`;
          }

          this.setState('ERROR');
          this.errorListeners.forEach((cb) => {
            try { cb(errorMessage); } catch (e) {}
          });
        };

        recog.onend = () => {
          this.isListening = false;
          if (this.currentState === 'LISTENING' || this.currentState === 'TRANSCRIBING') {
            this.setState('IDLE');
          }
          this.endListeners.forEach((cb) => {
            try { cb(); } catch (e) {}
          });
        };

        this.recognition = recog;
      } catch (e) {
        this.recognition = null;
        this.setState('UNSUPPORTED');
      }
    } else {
      this.setState('UNSUPPORTED');
    }
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    );
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public getState(): VoiceState {
    return this.currentState;
  }

  private setState(state: VoiceState): void {
    this.currentState = state;
    this.stateListeners.forEach((cb) => {
      try { cb(state); } catch (e) {}
    });
  }

  public async startListening(options?: { language?: VoiceLanguage; continuous?: boolean }): Promise<void> {
    if (!this.recognition) {
      this.setState('UNSUPPORTED');
      throw new Error('Voice recognition is not supported in this browser. Please use typed commands.');
    }

    if (this.isListening) {
      return;
    }

    try {
      const lang = options?.language || 'auto';
      if (lang === 'hi-IN') {
        this.recognition.lang = 'hi-IN';
      } else if (lang === 'en-US') {
        this.recognition.lang = 'en-US';
      } else {
        // Auto / en-IN handles English, Hinglish, and Hindi accents well
        this.recognition.lang = 'en-IN';
      }

      this.recognition.continuous = Boolean(options?.continuous);
      this.recognition.start();
    } catch (e: any) {
      this.isListening = false;
      this.setState('ERROR');
      throw new Error(`Could not activate microphone: ${e.message}`);
    }
  }

  public async stopListening(): Promise<void> {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.isListening = false;
    }
  }

  public cancelListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.abort();
      } catch (e) {}
      this.isListening = false;
      this.setState('CANCELLED');
    }
  }

  public onStart(callback: VoiceVoidCallback): () => void {
    this.startListeners.add(callback);
    return () => this.startListeners.delete(callback);
  }

  public onResult(callback: VoiceResultCallback): () => void {
    this.resultListeners.add(callback);
    return () => this.resultListeners.delete(callback);
  }

  public onInterimResult(callback: VoiceInterimCallback): () => void {
    this.interimListeners.add(callback);
    return () => this.interimListeners.delete(callback);
  }

  public onError(callback: VoiceErrorCallback): () => void {
    this.errorListeners.add(callback);
    return () => this.errorListeners.delete(callback);
  }

  public onEnd(callback: VoiceVoidCallback): () => void {
    this.endListeners.add(callback);
    return () => this.endListeners.delete(callback);
  }

  public onStateChange(callback: VoiceStateCallback): () => void {
    this.stateListeners.add(callback);
    callback(this.currentState);
    return () => this.stateListeners.delete(callback);
  }
}

export const voiceRecognitionService = new VoiceRecognitionService();
