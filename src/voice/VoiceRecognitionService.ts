/**
 * WebMouse V2 — Speech Recognition Service Abstraction
 * Wraps browser SpeechRecognition / webkitSpeechRecognition.
 * Dispatches interim and final transcripts with fresh instance lifecycle.
 */

import { VoiceState, VoiceLanguage } from './VoiceState';

export type VoiceResultCallback = (transcript: string, confidence: number) => void;
export type VoiceInterimCallback = (interimTranscript: string) => void;
export type VoiceErrorCallback = (error: string) => void;
export type VoiceVoidCallback = () => void;
export type VoiceStateCallback = (state: VoiceState) => void;

export class VoiceRecognitionService {
  private activeRecog: any = null;
  private isListening = false;
  private currentState: VoiceState = 'IDLE';

  private startListeners: Set<VoiceVoidCallback> = new Set();
  private resultListeners: Set<VoiceResultCallback> = new Set();
  private interimListeners: Set<VoiceInterimCallback> = new Set();
  private errorListeners: Set<VoiceErrorCallback> = new Set();
  private endListeners: Set<VoiceVoidCallback> = new Set();
  private stateListeners: Set<VoiceStateCallback> = new Set();

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
    if (!this.isSupported()) {
      this.setState('UNSUPPORTED');
      throw new Error('Voice recognition is not supported in this browser. Please use the quick action buttons or type commands.');
    }

    // Stop any existing instance
    this.cancelListening();

    // 1. Gently attempt mediaDevices permission check if available, but do not block SpeechRecognition
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (micErr: any) {
        // Many web environments / iframes restrict getUserMedia while allowing SpeechRecognition
        console.warn('[VoiceRecognitionService] getUserMedia note:', micErr?.message || micErr);
      }
    }

    // 2. Always instantiate a FRESH SpeechRecognition instance per session
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    try {
      const recog = new SpeechRecognition();
      this.activeRecog = recog;

      recog.continuous = Boolean(options?.continuous);
      recog.interimResults = true;
      recog.maxAlternatives = 1;

      const lang = options?.language || 'en-IN';
      recog.lang = lang === 'hi-IN' ? 'hi-IN' : 'en-IN';

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
          errorMessage = 'Microphone permission was denied. Please allow microphone in browser settings.';
        } else if (event.error === 'no-speech') {
          errorMessage = "No speech detected. Please speak clearly into your phone.";
        } else if (event.error === 'network') {
          errorMessage = 'Network error during voice recognition. Try again or use one-tap buttons.';
        } else if (event.error === 'aborted') {
          // Intentionally stopped
          return;
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

      recog.start();
    } catch (e: any) {
      this.isListening = false;
      this.setState('ERROR');
      const msg = `Could not activate microphone: ${e?.message || e}`;
      this.errorListeners.forEach((cb) => {
        try { cb(msg); } catch (err) {}
      });
      throw new Error(msg);
    }
  }

  public async stopListening(): Promise<void> {
    if (this.activeRecog && this.isListening) {
      try {
        this.activeRecog.stop();
      } catch (e) {}
      this.isListening = false;
    }
  }

  public cancelListening(): void {
    if (this.activeRecog) {
      try {
        this.activeRecog.abort();
      } catch (e) {}
      this.activeRecog = null;
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
