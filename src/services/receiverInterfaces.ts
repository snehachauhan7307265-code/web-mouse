/**
 * WebMouse V2 — Receiver Architecture & Interfaces
 * Provides formal contracts and protocol definitions for target receivers
 * including Windows PC, Android TV, Smart Board, and Web Screen.
 */

import { DeviceType, DevicePlatform, DeviceCapability } from '../types';

export type TVRemoteCommandAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'select'
  | 'back'
  | 'home'
  | 'menu'
  | 'power'
  | 'vol_up'
  | 'vol_down'
  | 'mute';

/**
 * Standard Android KeyEvent mappings for Android TV Receivers
 */
export const ANDROID_KEYCODES = {
  up: 19, // KEYCODE_DPAD_UP
  down: 20, // KEYCODE_DPAD_DOWN
  left: 21, // KEYCODE_DPAD_LEFT
  right: 22, // KEYCODE_DPAD_RIGHT
  select: 23, // KEYCODE_DPAD_CENTER / KEYCODE_ENTER
  back: 4, // KEYCODE_BACK
  home: 3, // KEYCODE_HOME
  menu: 82, // KEYCODE_MENU
  power: 26, // KEYCODE_POWER
  vol_up: 24, // KEYCODE_VOLUME_UP
  vol_down: 25, // KEYCODE_VOLUME_DOWN
  mute: 164, // KEYCODE_VOLUME_MUTE
} as const;

/**
 * Windows fallback mappings when a user controls a PC with TV Remote D-Pad
 */
export const WINDOWS_REMOTE_HOTKEYS: Record<TVRemoteCommandAction, string[] | string> = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  select: 'enter',
  back: 'escape',
  home: 'win',
  menu: 'apps', // Context menu
  power: ['alt', 'f4'],
  vol_up: 'volumeup',
  vol_down: 'volumedown',
  mute: 'volumemute',
};

/**
 * Android TV Receiver Specification
 */
export interface AndroidTVReceiverSpecification {
  deviceType: 'android_tv';
  platform: 'android';
  capabilities: DeviceCapability[];
  supportedProtocols: ['ws', 'wss'];
  features: {
    dpadNavigation: boolean;
    voiceSearchInput: boolean;
    appSwitching: boolean;
    mediaControls: boolean;
    screenMirrorReceiver: boolean;
    fileReceiver: boolean;
  };
}

/**
 * Smart Board Receiver Specification
 */
export interface SmartBoardReceiverSpecification {
  deviceType: 'smart_board';
  platform: 'android' | 'linux' | 'windows';
  capabilities: DeviceCapability[];
  features: {
    whiteboardDrawing: boolean;
    presentationControl: boolean;
    screenMirrorReceiver: boolean;
    laserPointerSimulation: boolean;
    fileDropZone: boolean;
  };
}
