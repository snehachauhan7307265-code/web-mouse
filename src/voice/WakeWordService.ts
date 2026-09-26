/**
 * WebMouse V2 — Wake Word Service (Foundation Architecture)
 * Prepares the architecture for keyword spotting ("Hey WebMouse").
 * Default: OFF. Never records audio permanently or without explicit user activation.
 */

export type WakeWordCallback = () => void;

export class WakeWordService {
  private enabled = false;
  private running = false;
  private listeners: Set<WakeWordCallback> = new Set();

  /**
   * Foundation check: Always-on audio keyword spotting requires custom on-device WASM/TensorFlow
   * models (e.g. Porcupine or open-source Picovoice) to operate without cloud battery drain.
   */
  public isSupported(): boolean {
    return typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.running) {
      this.stop();
    }
  }

  public isRunning(): boolean {
    return this.running;
  }

  public async start(): Promise<void> {
    if (!this.enabled) {
      throw new Error('Wake word detection is currently disabled in Voice Settings.');
    }
    if (!this.isSupported()) {
      throw new Error('Continuous wake word detection is not supported in this browser environment.');
    }

    // Wake word foundation architecture: in production, an audio worklet node evaluates keyword MFCCs.
    this.running = true;
  }

  public stop(): void {
    this.running = false;
  }

  public onWakeWordDetected(callback: WakeWordCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * For testing or manual simulation of wake word trigger
   */
  public simulateWakeWordTrigger(): void {
    if (this.enabled) {
      this.listeners.forEach((cb) => {
        try { cb(); } catch (e) {}
      });
    }
  }
}

export const wakeWordService = new WakeWordService();
