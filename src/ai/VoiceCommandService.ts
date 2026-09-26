/**
 * WebMouse V2 — Voice Command Service
 * Prepares the audio/speech architecture for Phase 4 Voice Control.
 * Connects microphone transcript events to the AI Intent & Action pipeline.
 */

export type TranscriptCallback = (transcript: string, isFinal: boolean) => void;
export type VoiceErrorCallback = (error: string) => void;

export class VoiceCommandService {
  private recognition: any = null;
  private isListening = false;
  private transcriptListeners: Set<TranscriptCallback> = new Set();
  private errorListeners: Set<VoiceErrorCallback> = new Set();

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = true;
        recog.lang = 'en-US';

        recog.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          const transcript = finalTranscript || interimTranscript;
          const isFinal = Boolean(finalTranscript);

          this.transcriptListeners.forEach((l) => {
            try {
              l(transcript, isFinal);
            } catch (e) {}
          });
        };

        recog.onerror = (event: any) => {
          this.isListening = false;
          const err = event.error || 'Speech recognition error';
          this.errorListeners.forEach((l) => {
            try {
              l(err);
            } catch (e) {}
          });
        };

        recog.onend = () => {
          this.isListening = false;
        };

        this.recognition = recog;
      } catch (e) {
        this.recognition = null;
      }
    }
  }

  public isAvailable(): boolean {
    return Boolean(this.recognition);
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public startListening(): boolean {
    if (!this.recognition) {
      this.errorListeners.forEach((l) => l('Speech recognition is not supported in this browser.'));
      return false;
    }

    try {
      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (e: any) {
      this.isListening = false;
      this.errorListeners.forEach((l) => l(`Could not start voice recognition: ${e.message}`));
      return false;
    }
  }

  public stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.isListening = false;
    }
  }

  public onTranscript(callback: TranscriptCallback): () => void {
    this.transcriptListeners.add(callback);
    return () => this.transcriptListeners.delete(callback);
  }

  public onError(callback: VoiceErrorCallback): () => void {
    this.errorListeners.add(callback);
    return () => this.errorListeners.delete(callback);
  }
}

export const voiceCommandService = new VoiceCommandService();
