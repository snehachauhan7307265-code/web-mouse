/**
 * WebMouse V2 — AI Response Manager
 * Generates natural, concise, and truthful feedback for user commands.
 * Never pretends an action succeeded unless the device acknowledged it.
 */

import { AIIntent } from './AIIntent';

export class AIResponseManager {
  public static generateSuccessResponse(intent: AIIntent, targetDeviceName?: string): string {
    const dev = targetDeviceName ? ` on ${targetDeviceName}` : '';

    switch (intent.intent) {
      case 'open_application': {
        const appName = intent.parameters?.appConfig?.displayName || intent.parameters?.application || 'App';
        return `Opening ${appName}${dev}.`;
      }
      case 'close_application': {
        const appName = intent.parameters?.application || 'Application';
        return `Closed ${appName}${dev}.`;
      }
      case 'media_play':
        return `Playing music${dev}.`;
      case 'media_pause':
        return `Music paused${dev}.`;
      case 'media_next':
        return `Skipped to next track${dev}.`;
      case 'media_previous':
        return `Returning to previous track${dev}.`;
      case 'volume_control': {
        const action = intent.parameters?.action;
        if (action === 'mute') return `Volume muted${dev}.`;
        if (action === 'unmute') return `Volume unmuted${dev}.`;
        if (action === 'decrease') return `Volume decreased${dev}.`;
        return `Volume increased${dev}.`;
      }
      case 'presentation_next':
        return `Advanced to next slide${dev}.`;
      case 'presentation_previous':
        return `Returned to previous slide${dev}.`;
      case 'presentation_start':
        return `Presentation started${dev}.`;
      case 'presentation_end':
        return `Presentation closed${dev}.`;
      case 'start_projection':
        return `Projection started${dev}.`;
      case 'stop_projection':
        return `Projection stopped.`;
      case 'pause_projection':
        return `Projection stream paused.`;
      case 'resume_projection':
        return `Projection stream resumed.`;
      case 'mouse_move':
        return `Mouse moved${dev}.`;
      case 'mouse_click': {
        const btn = intent.parameters?.button || 'click';
        return `Performed ${btn} click${dev}.`;
      }
      case 'keyboard_input': {
        if (intent.parameters?.text) return `Typed text${dev}.`;
        if (intent.parameters?.key) return `Pressed '${intent.parameters.key}'${dev}.`;
        if (intent.parameters?.keys) return `Pressed shortcut '${intent.parameters.keys.join('+')}'${dev}.`;
        return `Key event sent${dev}.`;
      }
      case 'send_file':
        return `File transfer initiated with ${targetDeviceName || 'receiver'}.`;
      case 'open_url':
      case 'quick_share':
        return `Link opened${dev}.`;
      case 'device_select':
        return `Switched active target to ${targetDeviceName}.`;
      case 'device_status':
        return `Device status retrieved.`;
      case 'cancel':
        return `Cancelled.`;
      default:
        return `Action completed${dev}.`;
    }
  }

  public static generateErrorResponse(error: string, targetDeviceName?: string): string {
    if (targetDeviceName && error.includes('capability')) {
      return `${targetDeviceName} does not support this capability.`;
    }
    if (targetDeviceName && error.includes('offline')) {
      return `I couldn't reach ${targetDeviceName}. The device is currently offline.`;
    }
    return error || 'Action could not be executed.';
  }
}
