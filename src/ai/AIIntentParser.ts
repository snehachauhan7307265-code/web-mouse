/**
 * WebMouse V2 — AI Intent Parser
 * Converts natural language into structured, strongly-typed AIIntent objects.
 * Never generates arbitrary code or unrestricted shell commands.
 */

import { AIIntent, AIIntentType, ALLOWLISTED_APPLICATIONS_REGISTRY } from './AIIntent';
import { AIContext } from './AIContext';
import { Device } from '../types';

export class AIIntentParser {
  /**
   * Main entry point to parse user natural language input within active session context.
   */
  public static parse(input: string, context: AIContext): AIIntent {
    const raw = input.trim();
    const text = raw.toLowerCase();

    // 0. Safety Check for Malicious / Unrestricted Execution Attempts
    if (this.isMaliciousOrUnrestricted(text)) {
      return {
        intent: 'unknown',
        confidence: 0.99,
        requiresConfirmation: false,
        rawQuery: raw,
        explanation: "I can't execute unrestricted system commands. Only safe, allowlisted device actions are supported.",
      };
    }

    // 0b. Interrupt / Cancel commands
    if (
      text === 'cancel' ||
      text === 'stop' ||
      text === 'never mind' ||
      text === 'cancel that' ||
      /^(cancel|stop|ruk jao|band karo|cancel karo|cancel that|rok do)\b/i.test(text)
    ) {
      return {
        intent: 'cancel',
        confidence: 0.99,
        requiresConfirmation: false,
        rawQuery: raw,
        explanation: 'Cancel pending command or operation',
      };
    }

    // 1. Resolve Target Device mentions in input or fallback to context
    const targetResolution = this.extractTargetDevice(text, context);

    // 2. Pattern Matching Rules for Supported Intents

    // A. Device Status & Querying (English & Hindi/Hinglish)
    if (
      /(which|what)\s+devices?\s+(are\s+)?(online|connected|available)/i.test(text) ||
      /(kaun|kon|koun)(\s+kaun)?\s+se\s+devices?.*?(connected|online|hain|chal)/i.test(text) ||
      /devices?\s+(status|connected|online)\s*(hain)?/i.test(text) ||
      /is\s+(.+?)\s+(online|connected|available)/i.test(text) ||
      text === 'device status' ||
      text === 'status'
    ) {
      return {
        intent: 'device_status',
        targetDevice: targetResolution.deviceName,
        confidence: 0.95,
        requiresConfirmation: false,
        rawQuery: raw,
        explanation: 'Query online devices and connection status',
      };
    }

    // B. Device Selection / Switch
    if (
      /^(connect\s+to|switch\s+to|select)\s+(.+)/i.test(text)
    ) {
      const match = text.match(/^(connect\s+to|switch\s+to|select)\s+(.+)/i);
      const devQuery = match ? match[2].trim() : '';
      return {
        intent: 'device_select',
        targetDevice: devQuery,
        confidence: 0.92,
        requiresConfirmation: false,
        rawQuery: raw,
      };
    }

    // C. Screen Projector (Phase 2 Integration - English & Hindi/Hinglish)
    if (
      /(project|cast|mirror|stream)\s+(my\s+)?(screen|display)/i.test(text) ||
      /(show|stream)\s+(my\s+)?(laptop|phone|tablet)?\s*screen\s+(on|par)\s+(the\s+)?(.+)/i.test(text) ||
      /screen\s+(project|cast|mirror)\s*(karo|karna)?/i.test(text) ||
      /(start|begin)\s+projection/i.test(text)
    ) {
      // Check for receiver target ambiguity
      let target = targetResolution.deviceName;
      const receivers = context.connectedDevices.filter(
        (d) => d.capabilities?.includes('screen_receiver') || d.type === 'smart_board' || d.type === 'android_tv'
      );

      if (!target && receivers.length > 1) {
        return {
          intent: 'start_projection',
          confidence: 0.85,
          requiresConfirmation: true,
          rawQuery: raw,
          missingInformation: 'targetDevice',
          explanation: 'Where should I project your screen?',
          clarificationOptions: receivers.map((d) => d.name),
        };
      }

      if (!target && receivers.length === 1) {
        target = receivers[0].name;
      }

      return {
        intent: 'start_projection',
        targetDevice: target || targetResolution.deviceName,
        parameters: { sourceDevice: 'current_device' },
        confidence: 0.95,
        requiresConfirmation: true,
        rawQuery: raw,
        explanation: `Project screen to ${target || 'target receiver'}`,
      };
    }

    if (/(stop|end|disconnect)\s+(projecting|projection|screen\s+share)|projection\s+(band|stop)\s+karo/i.test(text)) {
      return {
        intent: 'stop_projection',
        confidence: 0.95,
        requiresConfirmation: false,
        rawQuery: raw,
      };
    }

    if (/(pause)\s+(projection|projecting|screen)|projection\s+pause\s+karo/i.test(text)) {
      return {
        intent: 'pause_projection',
        confidence: 0.95,
        requiresConfirmation: false,
        rawQuery: raw,
      };
    }

    if (/(resume)\s+(projection|projecting|screen)|projection\s+resume\s+karo/i.test(text)) {
      return {
        intent: 'resume_projection',
        confidence: 0.95,
        requiresConfirmation: false,
        rawQuery: raw,
      };
    }

    // D. Open Applications (Allowlisted only - English & Hindi/Hinglish)
    const isAppLaunchCommand =
      /(open|launch|start|run)\s+(.+)/i.test(text) ||
      /(.+?)\s+(kholo|open\s+karo|chalao|start\s+karo)/i.test(text);

    if (isAppLaunchCommand) {
      let candidateApp = '';
      if (/(open|launch|start|run)\s+(.+)/i.test(text)) {
        const match = text.match(/(open|launch|start|run)\s+(.+)/i);
        candidateApp = match ? match[2].trim() : '';
      } else {
        const match = text.match(/(.+?)\s+(kholo|open\s+karo|chalao|start\s+karo)/i);
        candidateApp = match ? match[1].trim() : '';
      }

      // Strip prepositions: "on my laptop", "laptop par", "par", etc.
      let appName = candidateApp
        .replace(/\s+on\s+(my\s+)?(.+)$/i, '')
        .replace(/^(my\s+)?(laptop|pc|computer|tv|board)\s+par\s+/i, '')
        .replace(/\s+par$/i, '')
        .trim();

      // Check presentation mode launch
      if (appName === 'presentation' || appName === 'presentation mode' || appName === 'slides') {
        return {
          intent: 'presentation_start',
          targetDevice: targetResolution.deviceName,
          confidence: 0.95,
          requiresConfirmation: false,
          rawQuery: raw,
        };
      }

      // Check against allowlisted registry
      for (const [key, config] of Object.entries(ALLOWLISTED_APPLICATIONS_REGISTRY)) {
        if (
          key === appName ||
          config.aliases.some((alias) => appName.includes(alias)) ||
          appName.includes(key) ||
          text.includes(key)
        ) {
          // If multiple PC devices exist and none was specified
          const pcDevices = context.connectedDevices.filter((d) => d.type === 'windows' || d.platform === 'windows');
          if (!targetResolution.deviceName && pcDevices.length > 1) {
            return {
              intent: 'open_application',
              parameters: { application: key },
              confidence: 0.85,
              requiresConfirmation: false,
              rawQuery: raw,
              missingInformation: 'targetDevice',
              explanation: `I found ${pcDevices.length} PCs. Which device?`,
              clarificationOptions: pcDevices.map((d) => d.name),
            };
          }

          return {
            intent: 'open_application',
            targetDevice: targetResolution.deviceName,
            parameters: { application: key },
            confidence: 0.95,
            requiresConfirmation: false,
            rawQuery: raw,
            explanation: `Open ${config.displayName}`,
          };
        }
      }
    }

    // E. Media Playback Controls (English & Hindi/Hinglish)
    if (
      /(play\s+music|resume\s+music|play\s+video|start\s+playback|^\s*play\s*$|music\s+chalao|gaana\s+bajao|gaana\s+chalao)/i.test(text)
    ) {
      return {
        intent: 'media_play',
        targetDevice: targetResolution.deviceName,
        confidence: 0.96,
        requiresConfirmation: false,
        rawQuery: raw,
      };
    }

    if (
      /(pause\s+(the\s+)?(video|music|song|playback)|^\s*pause\s*$|stop\s+music|music\s+pause(\s+karo)?|gaana\s+(roko|band\s+karo|pause\s+karo)|video\s+(roko|pause\s+karo))/i.test(text)
    ) {
      return {
        intent: 'media_pause',
        targetDevice: targetResolution.deviceName,
        confidence: 0.96,
        requiresConfirmation: false,
        rawQuery: raw,
      };
    }

    if (
      /(next\s+(song|track|video)|skip\s+(song|track)|skip\s+forward|^\s*next\s*$|agla\s+gaana|agla\s+track|aage\s+karo)/i.test(text)
    ) {
      return {
        intent: 'media_next',
        targetDevice: targetResolution.deviceName,
        confidence: 0.95,
        requiresConfirmation: false,
        rawQuery: raw,
      };
    }

    if (
      /(previous\s+(song|track|video)|prev\s+(song|track)|^\s*previous\s*$|^\s*prev\s*$|pichla\s+gaana|pichla\s+track|peeche\s+karo)/i.test(text)
    ) {
      return {
        intent: 'media_previous',
        targetDevice: targetResolution.deviceName,
        confidence: 0.95,
        requiresConfirmation: false,
        rawQuery: raw,
      };
    }

    // F. Volume Controls (English & Hindi/Hinglish)
    if (
      /(turn|increase|raise|boost|turn\s+up)\s+(the\s+)?(volume|sound|audio)|(volume\s+up|louder)|(volume|awaz|awaaz)\s+(badhao|tez\s+karo|badao)/i.test(text)
    ) {
      return {
        intent: 'volume_control',
        targetDevice: targetResolution.deviceName,
        parameters: { action: 'increase', amount: 10 },
        confidence: 0.96,
        requiresConfirmation: false,
        rawQuery: raw,
        explanation: 'Increase audio volume',
      };
    }

    if (
      /(turn|decrease|lower|turn\s+down)\s+(the\s+)?(volume|sound|audio)|(volume\s+down|quieter)|(volume|awaz|awaaz)\s+(kam\s+karo|dheere\s+karo|ghatao)/i.test(text)
    ) {
      return {
        intent: 'volume_control',
        targetDevice: targetResolution.deviceName,
        parameters: { action: 'decrease', amount: 10 },
        confidence: 0.96,
        requiresConfirmation: false,
        rawQuery: raw,
        explanation: 'Decrease audio volume',
      };
    }

    if (/(mute|silence|unmute|awaaz\s+band\s+karo|mute\s+karo)/i.test(text)) {
      return {
        intent: 'volume_control',
        targetDevice: targetResolution.deviceName,
        parameters: { action: text.includes('unmute') ? 'unmute' : 'mute' },
        confidence: 0.96,
        requiresConfirmation: false,
        rawQuery: raw,
        explanation: text.includes('unmute') ? 'Unmute volume' : 'Mute volume',
      };
    }

    // G. Presentation Slide Navigation (English & Hindi/Hinglish)
    if (/(next\s+slide|forward\s+slide|advance\s+slide|agli\s+slide|agla\s+slide|agli\s+slide\s+par\s+jao)/i.test(text)) {
      return {
        intent: 'presentation_next',
        targetDevice: targetResolution.deviceName,
        confidence: 0.96,
        requiresConfirmation: false,
        rawQuery: raw,
        explanation: 'Next slide',
      };
    }

    if (/(previous\s+slide|back\s+slide|prev\s+slide|pichli\s+slide|pichla\s+slide|peeche\s+wali\s+slide)/i.test(text)) {
      return {
        intent: 'presentation_previous',
        targetDevice: targetResolution.deviceName,
        confidence: 0.96,
        requiresConfirmation: false,
        rawQuery: raw,
        explanation: 'Previous slide',
      };
    }

    if (/(start|begin|open)\s+(the\s+)?presentation|presentation\s+(shuru\s+karo|chalao)/i.test(text)) {
      return {
        intent: 'presentation_start',
        targetDevice: targetResolution.deviceName,
        confidence: 0.95,
        requiresConfirmation: false,
        rawQuery: raw,
      };
    }

    if (/(end|stop|exit|close)\s+(the\s+)?presentation|presentation\s+(band\s+karo|roko)/i.test(text)) {
      return {
        intent: 'presentation_end',
        targetDevice: targetResolution.deviceName,
        confidence: 0.95,
        requiresConfirmation: false,
        rawQuery: raw,
      };
    }

    // Go to slide X (Honest check: direct slide index requires specific helper capability)
    if (/go\s+to\s+slide\s+(\d+)/i.test(text)) {
      const match = text.match(/go\s+to\s+slide\s+(\d+)/i);
      const slideNum = match ? parseInt(match[1], 10) : 1;
      return {
        intent: 'presentation_next',
        targetDevice: targetResolution.deviceName,
        parameters: { directSlide: slideNum },
        confidence: 0.88,
        requiresConfirmation: false,
        rawQuery: raw,
        explanation: 'Direct slide number navigation is not currently supported by PowerPoint helper.',
      };
    }

    // H. Mouse Control
    if (/move\s+(the\s+)?mouse/i.test(text) || /^mouse\s+/i.test(text)) {
      let dx = 0;
      let dy = 0;
      if (text.includes('right')) dx = 300;
      else if (text.includes('left')) dx = -300;
      else if (text.includes('up')) dy = -300;
      else if (text.includes('down')) dy = 300;

      return {
        intent: 'mouse_move',
        targetDevice: targetResolution.deviceName,
        parameters: { dx, dy },
        confidence: 0.94,
        requiresConfirmation: false,
        rawQuery: raw,
      };
    }

    if (/^(double\s+click|right\s+click|left\s+click|click)$/i.test(text) || text.includes('click')) {
      const button = text.includes('right') ? 'right' : text.includes('double') ? 'double' : 'left';
      return {
        intent: 'mouse_click',
        targetDevice: targetResolution.deviceName,
        parameters: { button },
        confidence: 0.95,
        requiresConfirmation: false,
        rawQuery: raw,
      };
    }

    if (/scroll\s+(up|down)/i.test(text)) {
      const amount = text.includes('up') ? 300 : -300;
      return {
        intent: 'mouse_move',
        targetDevice: targetResolution.deviceName,
        parameters: { scroll: amount },
        confidence: 0.93,
        requiresConfirmation: false,
        rawQuery: raw,
      };
    }

    // I. Keyboard Input
    if (/^type\s+(.+)/i.test(text)) {
      const match = raw.match(/^type\s+(.+)/i);
      const textToType = match ? match[1] : '';
      return {
        intent: 'keyboard_input',
        targetDevice: targetResolution.deviceName,
        parameters: { text: textToType },
        confidence: 0.95,
        requiresConfirmation: false,
        rawQuery: raw,
      };
    }

    if (/press\s+(.+)/i.test(text)) {
      const match = text.match(/press\s+(.+)/i);
      let keyVal = match ? match[1].trim() : '';

      if (keyVal.includes('ctrl') || keyVal.includes('alt') || keyVal.includes('+')) {
        const keys = keyVal.split(/[\s+]+/).map((k) => k.trim());
        return {
          intent: 'keyboard_input',
          targetDevice: targetResolution.deviceName,
          parameters: { keys },
          confidence: 0.94,
          requiresConfirmation: false,
          rawQuery: raw,
        };
      }

      return {
        intent: 'keyboard_input',
        targetDevice: targetResolution.deviceName,
        parameters: { key: keyVal },
        confidence: 0.94,
        requiresConfirmation: false,
        rawQuery: raw,
      };
    }

    // J. File Transfer & Quick Share (English & Hindi/Hinglish)
    if (
      /(send|transfer|share)\s+(this\s+)?(file|presentation|photo|document|link)|file\s+(.+?\s+)?(par\s+)?bhejo|presentation\s+(.+?\s+)?(par\s+)?bhejo/i.test(text)
    ) {
      return {
        intent: 'send_file',
        targetDevice: targetResolution.deviceName,
        parameters: {
          filename: 'presentation.pdf',
        },
        confidence: 0.91,
        requiresConfirmation: true,
        rawQuery: raw,
        explanation: `Send file to ${targetResolution.deviceName || 'target device'}`,
      };
    }

    // Unknown or Low Confidence
    return {
      intent: 'unknown',
      confidence: 0.35,
      requiresConfirmation: false,
      rawQuery: raw,
      explanation: "I'm not sure what action you want me to perform. Try asking 'Play music', 'Increase volume', 'Next slide', or 'Open Chrome'.",
    };
  }

  /**
   * Multi-step Command Planner (e.g. "Open Chrome and go to YouTube")
   */
  public static parsePlan(input: string, context: AIContext) {
    const raw = input.trim();
    const parts = raw.split(/\s+(?:and|aur|then|phir)\s+/i);
    if (parts.length <= 1) return null;

    const steps = [];
    let requiresConfirmation = false;

    for (const part of parts) {
      const intent = this.parse(part.trim(), context);
      if (intent.intent !== 'unknown') {
        steps.push(intent);
        if (intent.requiresConfirmation) {
          requiresConfirmation = true;
        }
      }
    }

    if (steps.length <= 1) return null;

    return {
      type: 'multi_step' as const,
      steps,
      requiresConfirmation,
      explanation: `Multi-step plan with ${steps.length} actions`,
    };
  }

  /**
   * Resolves target device name based on query text, aliases, and active context.
   */
  private static extractTargetDevice(text: string, context: AIContext): { deviceName?: string; device?: Device } {
    const devices = context.connectedDevices || [];

    // Check device aliases
    for (const dev of devices) {
      const name = dev.name.toLowerCase();
      if (text.includes(name)) {
        return { deviceName: dev.name, device: dev };
      }
    }

    // Generic aliases mapping
    if (text.includes('laptop') || text.includes('my pc') || text.includes('computer')) {
      const pc = devices.find((d) => d.type === 'windows' || d.platform === 'windows');
      if (pc) return { deviceName: pc.name, device: pc };
    }

    if (text.includes('tv') || text.includes('television')) {
      const tv = devices.find((d) => d.type === 'android_tv');
      if (tv) return { deviceName: tv.name, device: tv };
    }

    if (text.includes('board') || text.includes('smart board')) {
      const board = devices.find((d) => d.type === 'smart_board');
      if (board) return { deviceName: board.name, device: board };
    }

    // Fallback to active context device
    if (context.activeDevice) {
      return { deviceName: context.activeDevice.name, device: context.activeDevice };
    }

    if (context.lastTargetDevice) {
      return { deviceName: context.lastTargetDevice };
    }

    return {};
  }

  private static isMaliciousOrUnrestricted(text: string): boolean {
    const dangerousKeywords = [
      'powershell',
      'cmd.exe',
      'shell script',
      'delete all my files',
      'delete files',
      'format c:',
      'rm -rf',
      'disable security',
      'disable firewall',
      'disable windows security',
      'run any command',
      'arbitrary command',
      'unrestricted command',
      'downloadstring',
    ];
    return dangerousKeywords.some((k) => text.includes(k));
  }
}
