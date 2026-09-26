/**
 * WebMouse V2 — AI Intent Models & Safe Allowlist Definitions
 */

export type AIIntentType =
  | 'mouse_move'
  | 'mouse_click'
  | 'keyboard_input'
  | 'open_application'
  | 'close_application'
  | 'media_play'
  | 'media_pause'
  | 'media_next'
  | 'media_previous'
  | 'volume_control'
  | 'presentation_next'
  | 'presentation_previous'
  | 'presentation_start'
  | 'presentation_end'
  | 'start_projection'
  | 'stop_projection'
  | 'pause_projection'
  | 'resume_projection'
  | 'send_file'
  | 'quick_share'
  | 'open_url'
  | 'device_select'
  | 'device_status'
  | 'cancel'
  | 'unknown';

export interface AIIntent {
  intent: AIIntentType;
  targetDevice?: string;
  parameters?: Record<string, any>;
  confidence: number;
  requiresConfirmation: boolean;
  explanation?: string;
  rawQuery?: string;
  missingInformation?: string;
  clarificationOptions?: string[];
}

export interface AIPlan {
  type: 'multi_step';
  steps: AIIntent[];
  requiresConfirmation: boolean;
  explanation?: string;
}

export interface AIExecutionResult {
  success: boolean;
  intent: AIIntentType;
  deviceId?: string;
  deviceName?: string;
  message: string;
  timestamp: number;
  error?: string | null;
  data?: any;
}

/**
 * Strict allowlist of safe device actions that the AI is permitted to route.
 * Anything outside this allowlist is strictly rejected.
 */
export const SAFE_INTENT_ALLOWLIST: ReadonlySet<AIIntentType> = new Set([
  'mouse_move',
  'mouse_click',
  'keyboard_input',
  'open_application',
  'close_application',
  'media_play',
  'media_pause',
  'media_next',
  'media_previous',
  'volume_control',
  'presentation_next',
  'presentation_previous',
  'presentation_start',
  'presentation_end',
  'start_projection',
  'stop_projection',
  'pause_projection',
  'resume_projection',
  'send_file',
  'quick_share',
  'open_url',
  'device_select',
  'device_status',
  'cancel',
]);

/**
 * Registry of safe allowlisted applications that can be launched on Windows/receivers.
 * Arbitrary executable or shell commands are forbidden.
 */
export interface AllowedAppConfig {
  displayName: string;
  binary?: string;
  url?: string;
  aliases: string[];
}

export const ALLOWLISTED_APPLICATIONS_REGISTRY: Record<string, AllowedAppConfig> = {
  chrome: {
    displayName: 'Google Chrome',
    binary: 'chrome',
    url: 'https://www.google.com',
    aliases: ['chrome', 'google chrome', 'browser', 'web browser'],
  },
  edge: {
    displayName: 'Microsoft Edge',
    binary: 'msedge',
    aliases: ['edge', 'microsoft edge', 'ms edge'],
  },
  notepad: {
    displayName: 'Notepad',
    binary: 'notepad',
    aliases: ['notepad', 'notes', 'text editor'],
  },
  calculator: {
    displayName: 'Calculator',
    binary: 'calc',
    aliases: ['calculator', 'calc'],
  },
  explorer: {
    displayName: 'File Explorer',
    binary: 'explorer',
    aliases: ['explorer', 'files', 'file explorer', 'my files'],
  },
  taskmgr: {
    displayName: 'Task Manager',
    binary: 'taskmgr',
    aliases: ['task manager', 'taskmgr', 'processes'],
  },
  youtube: {
    displayName: 'YouTube',
    url: 'https://www.youtube.com',
    aliases: ['youtube', 'yt', 'youtube.com'],
  },
};
