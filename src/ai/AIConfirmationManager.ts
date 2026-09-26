/**
 * WebMouse V2 — AI Confirmation Manager
 * Intercepts potentially sensitive, intrusive, or content-exposing actions
 * (e.g. screen projection, file transfer, system lock) and requests explicit user confirmation.
 */

import { AIIntent } from './AIIntent';

export interface PendingConfirmation {
  id: string;
  intent: AIIntent;
  targetDeviceName: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (confirmed: boolean) => void;
}

export class AIConfirmationManager {
  private pending: PendingConfirmation | null = null;
  private listeners: Set<(pending: PendingConfirmation | null) => void> = new Set();

  public subscribe(callback: (pending: PendingConfirmation | null) => void): () => void {
    this.listeners.add(callback);
    callback(this.pending);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l(this.pending);
      } catch (e) {}
    });
  }

  /**
   * Evaluates whether an intent strictly requires user confirmation before execution.
   */
  public static requiresConfirmation(intent: AIIntent): boolean {
    if (intent.requiresConfirmation) return true;

    // Screen projection exposes display
    if (intent.intent === 'start_projection') return true;

    // File transfer pushes assets
    if (intent.intent === 'send_file') return true;

    // Disruptive actions
    if (intent.intent === 'close_application') return true;
    if (intent.parameters?.action === 'lock') return true;

    return false;
  }

  /**
   * Prompts the user for confirmation via modal dialog. Returns a Promise<boolean>.
   */
  public requestConfirmation(intent: AIIntent, targetDeviceName: string): Promise<boolean> {
    return new Promise((resolve) => {
      let title = 'Confirm Action';
      let description = `Are you sure you want to execute ${intent.intent}?`;
      let confirmLabel = 'Confirm';
      let cancelLabel = 'Cancel';

      if (intent.intent === 'start_projection') {
        title = 'Confirm Screen Projection';
        description = `Project your screen to ${targetDeviceName}? You will be prompted to select which screen, window, or tab to share.`;
        confirmLabel = 'Start Projecting';
      } else if (intent.intent === 'send_file') {
        const filename = intent.parameters?.filename || 'selected file';
        title = 'Confirm File Transfer';
        description = `Send "${filename}" to ${targetDeviceName}?`;
        confirmLabel = 'Send File';
      } else if (intent.intent === 'close_application') {
        const app = intent.parameters?.application || 'application';
        title = 'Close Application';
        description = `Close ${app} on ${targetDeviceName}? Any unsaved work might be affected.`;
        confirmLabel = 'Close App';
      }

      this.pending = {
        id: `CONFIRM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        intent,
        targetDeviceName,
        title,
        description,
        confirmLabel,
        cancelLabel,
        resolve: (confirmed: boolean) => {
          this.pending = null;
          this.notify();
          resolve(confirmed);
        },
      };

      this.notify();
    });
  }

  public confirmCurrent() {
    if (this.pending) {
      this.pending.resolve(true);
    }
  }

  public cancelCurrent() {
    if (this.pending) {
      this.pending.resolve(false);
    }
  }

  public getPending(): PendingConfirmation | null {
    return this.pending;
  }
}
