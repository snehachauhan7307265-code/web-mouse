/**
 * WebMouse V2 — Voice Feedback Service (Text-to-Speech)
 * Speaks execution feedback aloud using the Web Speech Synthesis API.
 * Respects user preferences and language configurations.
 */

export class VoiceFeedbackService {
  private isSpeaking = false;

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
  }

  public async speak(text: string, lang?: string): Promise<void> {
    if (!this.isSupported() || !text.trim()) {
      return;
    }

    return new Promise((resolve) => {
      try {
        // Cancel any active speech to avoid queuing delays
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05; // Slightly faster, natural assistant cadence
        utterance.pitch = 1.0;

        // Determine language code
        const isHindiPhrasing = /(par|kholo|chalao|badhao|kam|bhejo|shuru|band|hain|gaya)/i.test(text);
        if (lang === 'hi-IN' || (isHindiPhrasing && lang !== 'en-US')) {
          utterance.lang = 'hi-IN';
        } else {
          utterance.lang = lang || 'en-IN';
        }

        // Try to pick a natural voice if available
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          const matchedVoice = voices.find(
            (v) => v.lang.startsWith(utterance.lang.slice(0, 2)) || v.lang === utterance.lang
          );
          if (matchedVoice) {
            utterance.voice = matchedVoice;
          }
        }

        utterance.onstart = () => {
          this.isSpeaking = true;
        };

        utterance.onend = () => {
          this.isSpeaking = false;
          resolve();
        };

        utterance.onerror = () => {
          this.isSpeaking = false;
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        this.isSpeaking = false;
        resolve();
      }
    });
  }

  public stop(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      this.isSpeaking = false;
    }
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

export const voiceFeedbackService = new VoiceFeedbackService();
