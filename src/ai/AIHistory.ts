/**
 * WebMouse V2 — AI Audit History & Session Memory
 * Lightweight in-memory audit log for actions initiated via the AI engine.
 * Never stores arbitrary filesystem or private payload content.
 */

import { AIHistoryEntry } from './AIContext';

const MAX_HISTORY = 60;

class AIHistoryManager {
  private entries: AIHistoryEntry[] = [];
  private listeners: Set<(entries: AIHistoryEntry[]) => void> = new Set();

  public subscribe(callback: (entries: AIHistoryEntry[]) => void): () => void {
    this.listeners.add(callback);
    callback([...this.entries]);
    return () => this.listeners.delete(callback);
  }

  public addEntry(entry: Omit<AIHistoryEntry, 'id' | 'timestamp'>): AIHistoryEntry {
    const fullEntry: AIHistoryEntry = {
      ...entry,
      id: `HIST-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: Date.now(),
    };
    this.entries = [fullEntry, ...this.entries.slice(0, MAX_HISTORY - 1)];
    this.notify();
    return fullEntry;
  }

  public getEntries(): AIHistoryEntry[] {
    return [...this.entries];
  }

  public clearHistory(): void {
    this.entries = [];
    this.notify();
  }

  private notify() {
    const copy = [...this.entries];
    this.listeners.forEach((l) => {
      try {
        l(copy);
      } catch (e) {}
    });
  }
}

export const aiHistory = new AIHistoryManager();
