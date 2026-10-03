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
  | 'quick_control'
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
  'quick_control',
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
  youtube: {
    displayName: 'YouTube',
    url: 'https://www.youtube.com',
    aliases: ['youtube', 'yt', 'youtube.com', 'video', 'videos', 'यूट्यूब', 'यूट्युब'],
  },
  chrome: {
    displayName: 'Google Chrome',
    binary: 'chrome',
    url: 'https://www.google.com',
    aliases: ['chrome', 'google chrome', 'browser', 'web browser', 'क्रोम', 'गूगल क्रोम'],
  },
  google: {
    displayName: 'Google Search',
    url: 'https://www.google.com',
    aliases: ['google', 'google search', 'search', 'गूगल'],
  },
  edge: {
    displayName: 'Microsoft Edge',
    binary: 'msedge',
    aliases: ['edge', 'microsoft edge', 'ms edge', 'एज'],
  },
  notepad: {
    displayName: 'Notepad',
    binary: 'notepad',
    aliases: ['notepad', 'notes', 'text editor', 'नोटपैड'],
  },
  calculator: {
    displayName: 'Calculator',
    binary: 'calc',
    aliases: ['calculator', 'calc', 'hisab', 'कैलकुलेटर', 'हिसाब'],
  },
  explorer: {
    displayName: 'File Explorer',
    binary: 'explorer',
    aliases: ['explorer', 'files', 'file explorer', 'my files', 'my computer', 'this pc', 'फ़ाइलें', 'कंप्यूटर'],
  },
  taskmgr: {
    displayName: 'Task Manager',
    binary: 'taskmgr',
    aliases: ['task manager', 'taskmgr', 'processes', 'टास्क मैनेजर'],
  },
  spotify: {
    displayName: 'Spotify',
    binary: 'spotify',
    url: 'https://open.spotify.com',
    aliases: ['spotify', 'music app', 'स्पॉटिफ़ाई'],
  },
  whatsapp: {
    displayName: 'WhatsApp',
    binary: 'whatsapp',
    url: 'https://web.whatsapp.com',
    aliases: ['whatsapp', 'wa', 'web whatsapp', 'व्हाट्सएप'],
  },
  settings: {
    displayName: 'Windows Settings',
    binary: 'ms-settings:',
    aliases: ['settings', 'setting', 'control panel', 'pc settings', 'सेटिंग्स'],
  },
  paint: {
    displayName: 'Paint',
    binary: 'mspaint',
    aliases: ['paint', 'mspaint', 'drawing', 'पेंट'],
  },
  word: {
    displayName: 'Microsoft Word',
    binary: 'winword',
    aliases: ['word', 'ms word', 'winword', 'वर्ड'],
  },
  excel: {
    displayName: 'Microsoft Excel',
    binary: 'excel',
    aliases: ['excel', 'ms excel', 'एक्सेल'],
  },
  powerpoint: {
    displayName: 'Microsoft PowerPoint',
    binary: 'powerpnt',
    aliases: ['powerpoint', 'ppt', 'slides', 'पावरपॉइंट'],
  },
};
