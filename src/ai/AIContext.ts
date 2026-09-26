/**
 * WebMouse V2 — AI Context & Session State
 */

import { Device } from '../types';

export interface AIHistoryEntry {
  id: string;
  timestamp: number;
  userQuery: string;
  intent: string;
  targetDevice?: string;
  result: 'success' | 'failed' | 'rejected' | 'clarification';
  message: string;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  intent?: string;
  status?: 'thinking' | 'clarification' | 'executing' | 'completed' | 'failed';
  clarificationOptions?: string[];
  data?: any;
}

export interface AIContext {
  activeDeviceId?: string;
  activeDevice?: Device | null;
  connectedDevices: Device[];
  lastTargetDevice?: string;
  appMode: 'controller' | 'receiver';
  projectionActive: boolean;
  sessionHistory?: AIChatMessage[];
}
