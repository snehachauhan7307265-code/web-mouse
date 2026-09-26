/**
 * WebMouse V2 — AI Action Router
 * Orchestrates the full pipeline:
 * User Input ➔ Intent Parsing ➔ Intent Validation ➔ Capability Verification ➔
 * Permission & Confirmation ➔ Existing Device Services Execution ➔ Audit Logging ➔ Result
 *
 * CRITICAL SECURITY PRINCIPLE:
 * The AI is never trusted. Only allowlisted, capability-validated intents
 * are routed to authenticated device services.
 */

import { AIIntent, AIExecutionResult, AIIntentType } from './AIIntent';
import { AIContext } from './AIContext';
import { AIIntentValidator } from './AIIntentValidator';
import { AIConfirmationManager } from './AIConfirmationManager';
import { AIResponseManager } from './AIResponseManager';
import { getAIProvider } from './AIProvider';
import { aiHistory } from './AIHistory';
import { Device, DeviceCapability, OutgoingMessage } from '../types';

export interface ActionRouterCallbacks {
  sendMessage: (msg: OutgoingMessage) => void;
  selectDevice?: (device: Device) => void;
  startProjection?: (targetDeviceName: string) => Promise<boolean>;
  stopProjection?: () => void;
  pauseProjection?: () => void;
  resumeProjection?: () => void;
  openShareModal?: () => void;
}

export class AIActionRouter {
  private confirmationManager: AIConfirmationManager;

  constructor(confirmationManager: AIConfirmationManager) {
    this.confirmationManager = confirmationManager;
  }

  /**
   * Main entry pipeline: parse natural language, validate, verify capabilities, confirm, and execute.
   */
  public async processCommand(
    input: string,
    context: AIContext,
    callbacks: ActionRouterCallbacks
  ): Promise<AIExecutionResult> {
    const startTime = Date.now();
    const provider = getAIProvider();

    // 1. Parse natural language into structured intent
    const parsedIntent = await provider.parseIntent(input, context);

    // 2. Validate intent against security allowlist and boundaries
    const validation = AIIntentValidator.validate(parsedIntent);
    if (!validation.isValid || !validation.sanitizedIntent) {
      const errorMsg = validation.error || "I'm not sure what action you want me to perform.";
      aiHistory.addEntry({
        userQuery: input,
        intent: parsedIntent.intent,
        result: 'rejected',
        message: errorMsg,
      });
      return {
        success: false,
        intent: parsedIntent.intent,
        message: errorMsg,
        timestamp: startTime,
        error: errorMsg,
      };
    }

    const intent = validation.sanitizedIntent;

    // Handle Clarification Requests (e.g. which PC? Where to project?)
    if (intent.missingInformation && intent.clarificationOptions?.length) {
      aiHistory.addEntry({
        userQuery: input,
        intent: intent.intent,
        result: 'clarification',
        message: intent.explanation || 'Clarification needed',
      });
      return {
        success: false,
        intent: intent.intent,
        message: intent.explanation || 'Please select an option:',
        timestamp: startTime,
        data: { clarificationOptions: intent.clarificationOptions },
      };
    }

    // 3. Resolve Target Device
    const resolved = this.resolveDevice(intent, context);
    const targetDevice = resolved.device;
    const targetDeviceName = resolved.name;

    // 4. Special Intents not requiring an online target device
    if (intent.intent === 'cancel') {
      this.confirmationManager.cancelCurrent();
      const cancelMsg = 'Command cancelled.';
      aiHistory.addEntry({
        userQuery: input,
        intent: 'cancel',
        result: 'success',
        message: cancelMsg,
      });
      return {
        success: true,
        intent: 'cancel',
        message: cancelMsg,
        timestamp: startTime,
      };
    }

    if (intent.intent === 'device_status') {
      return this.handleDeviceStatusQuery(context, startTime, input);
    }

    if (intent.intent === 'device_select' && targetDevice) {
      callbacks.selectDevice?.(targetDevice);
      const msg = `Switched active device to ${targetDevice.name}.`;
      aiHistory.addEntry({
        userQuery: input,
        intent: intent.intent,
        targetDevice: targetDevice.name,
        result: 'success',
        message: msg,
      });
      return {
        success: true,
        intent: intent.intent,
        deviceId: targetDevice.id,
        deviceName: targetDevice.name,
        message: msg,
        timestamp: startTime,
      };
    }

    // 5. Verify Target Device Availability & Connection Status
    if (!targetDevice) {
      const err = targetDeviceName
        ? `I couldn't find a device matching "${targetDeviceName}". Please ensure it is paired and connected.`
        : 'No target device is currently connected. Please connect to a device first.';
      aiHistory.addEntry({
        userQuery: input,
        intent: intent.intent,
        result: 'failed',
        message: err,
      });
      return {
        success: false,
        intent: intent.intent,
        message: err,
        timestamp: startTime,
        error: err,
      };
    }

    // 6. Capability Verification Check
    const capabilityCheck = this.checkCapabilities(intent, targetDevice);
    if (!capabilityCheck.supported) {
      const errMsg = `${targetDevice.name} does not support this action. Missing capability: ${capabilityCheck.requiredCapability}.`;
      aiHistory.addEntry({
        userQuery: input,
        intent: intent.intent,
        targetDevice: targetDevice.name,
        result: 'failed',
        message: errMsg,
      });
      return {
        success: false,
        intent: intent.intent,
        deviceId: targetDevice.id,
        deviceName: targetDevice.name,
        message: errMsg,
        timestamp: startTime,
        error: errMsg,
      };
    }

    // 7. Permission & Confirmation Check
    if (AIConfirmationManager.requiresConfirmation(intent)) {
      const confirmed = await this.confirmationManager.requestConfirmation(intent, targetDevice.name);
      if (!confirmed) {
        const cancelMsg = `Action cancelled by user: ${intent.intent} on ${targetDevice.name}`;
        aiHistory.addEntry({
          userQuery: input,
          intent: intent.intent,
          targetDevice: targetDevice.name,
          result: 'rejected',
          message: cancelMsg,
        });
        return {
          success: false,
          intent: intent.intent,
          deviceId: targetDevice.id,
          deviceName: targetDevice.name,
          message: 'Action cancelled.',
          timestamp: startTime,
          error: 'User cancelled confirmation.',
        };
      }
    }

    // 8. Execute Action using EXISTING Services
    try {
      const execResult = await this.executeIntent(intent, targetDevice, callbacks);
      const responseMessage = AIResponseManager.generateSuccessResponse(intent, targetDevice.name);

      aiHistory.addEntry({
        userQuery: input,
        intent: intent.intent,
        targetDevice: targetDevice.name,
        result: 'success',
        message: responseMessage,
      });

      return {
        success: true,
        intent: intent.intent,
        deviceId: targetDevice.id,
        deviceName: targetDevice.name,
        message: responseMessage,
        timestamp: startTime,
        data: execResult,
      };
    } catch (e: any) {
      const err = AIResponseManager.generateErrorResponse(e.message || 'Execution error', targetDevice.name);
      aiHistory.addEntry({
        userQuery: input,
        intent: intent.intent,
        targetDevice: targetDevice.name,
        result: 'failed',
        message: err,
      });
      return {
        success: false,
        intent: intent.intent,
        deviceId: targetDevice.id,
        deviceName: targetDevice.name,
        message: err,
        timestamp: startTime,
        error: e.message,
      };
    }
  }

  /**
   * Resolves the target device instance based on intent parameters and current context.
   */
  public resolveDevice(intent: AIIntent, context: AIContext): { device?: Device; name: string } {
    const rawTarget = intent.targetDevice?.trim().toLowerCase();
    const devices = context.connectedDevices || [];

    if (rawTarget) {
      // 1. Direct name match
      const direct = devices.find((d) => d.name.toLowerCase() === rawTarget);
      if (direct) return { device: direct, name: direct.name };

      // 2. Partial name match
      const partial = devices.find((d) => d.name.toLowerCase().includes(rawTarget));
      if (partial) return { device: partial, name: partial.name };

      // 3. Category match
      if (rawTarget.includes('laptop') || rawTarget.includes('pc') || rawTarget.includes('computer')) {
        const pc = devices.find((d) => d.type === 'windows' || d.platform === 'windows');
        if (pc) return { device: pc, name: pc.name };
      }
      if (rawTarget.includes('tv') || rawTarget.includes('television')) {
        const tv = devices.find((d) => d.type === 'android_tv');
        if (tv) return { device: tv, name: tv.name };
      }
      if (rawTarget.includes('board') || rawTarget.includes('smart board')) {
        const board = devices.find((d) => d.type === 'smart_board');
        if (board) return { device: board, name: board.name };
      }
      return { name: intent.targetDevice! };
    }

    // Fallback to active context device
    if (context.activeDevice) {
      return { device: context.activeDevice, name: context.activeDevice.name };
    }

    if (devices.length === 1) {
      return { device: devices[0], name: devices[0].name };
    }

    return { name: '' };
  }

  /**
   * Capability Verification: inspects device.capabilities array against intent requirements.
   */
  public checkCapabilities(
    intent: AIIntent,
    device: Device
  ): { supported: boolean; requiredCapability: DeviceCapability } {
    const caps = device.capabilities || [];

    switch (intent.intent) {
      case 'mouse_move':
      case 'mouse_click':
        return {
          supported: caps.includes('mouse') || device.type === 'windows',
          requiredCapability: 'mouse',
        };

      case 'keyboard_input':
        return {
          supported: caps.includes('keyboard') || device.type === 'windows',
          requiredCapability: 'keyboard',
        };

      case 'media_play':
      case 'media_pause':
      case 'media_next':
      case 'media_previous':
        return {
          supported: caps.includes('media') || caps.includes('tv_remote') || device.type === 'android_tv',
          requiredCapability: 'media',
        };

      case 'volume_control':
        return {
          supported:
            caps.includes('media') ||
            caps.includes('tv_remote') ||
            device.type === 'android_tv' ||
            device.type === 'windows',
          requiredCapability: 'media',
        };

      case 'presentation_next':
      case 'presentation_previous':
      case 'presentation_start':
      case 'presentation_end':
        return {
          supported:
            caps.includes('presentation') ||
            caps.includes('presentation_receiver') ||
            device.type === 'smart_board' ||
            device.type === 'windows',
          requiredCapability: 'presentation',
        };

      case 'start_projection':
        return {
          supported:
            caps.includes('screen_receiver') ||
            caps.includes('presentation_receiver') ||
            device.type === 'smart_board' ||
            device.type === 'android_tv',
          requiredCapability: 'screen_receiver',
        };

      case 'send_file':
        return {
          supported:
            caps.includes('file_transfer') ||
            caps.includes('file_receiver') ||
            caps.includes('quick_share'),
          requiredCapability: 'file_transfer',
        };

      case 'open_application':
      case 'close_application':
      case 'open_url':
      case 'quick_share':
        return {
          supported: device.type === 'windows' || device.type === 'android_tv' || caps.includes('quick_share'),
          requiredCapability: 'quick_share',
        };

      default:
        return { supported: true, requiredCapability: 'mouse' };
    }
  }

  /**
   * Dispatches the validated intent to existing WebMouse services.
   */
  private async executeIntent(
    intent: AIIntent,
    device: Device,
    callbacks: ActionRouterCallbacks
  ): Promise<any> {
    const { sendMessage } = callbacks;

    switch (intent.intent) {
      // 1. Mouse Operations
      case 'mouse_move': {
        const dx = intent.parameters?.dx || 0;
        const dy = intent.parameters?.dy || 0;
        const scroll = intent.parameters?.scroll;
        if (scroll !== undefined) {
          sendMessage({ type: 'scroll', amount: scroll });
        } else {
          sendMessage({ type: 'mouse_move', dx, dy });
        }
        return { dx, dy, scroll };
      }

      case 'mouse_click': {
        const button = intent.parameters?.button || 'left';
        if (button === 'right') sendMessage({ type: 'right_click' });
        else if (button === 'double') sendMessage({ type: 'double_click' });
        else sendMessage({ type: 'left_click' });
        return { button };
      }

      // 2. Keyboard Operations
      case 'keyboard_input': {
        if (intent.parameters?.text) {
          sendMessage({ type: 'type_text', text: intent.parameters.text });
        } else if (intent.parameters?.key) {
          sendMessage({ type: 'key', key: intent.parameters.key });
        } else if (intent.parameters?.keys) {
          sendMessage({ type: 'shortcut', keys: intent.parameters.keys });
        }
        return intent.parameters;
      }

      // 3. Media Controls
      case 'media_play':
        sendMessage({ type: 'media_control', action: 'playpause' });
        return { action: 'play' };

      case 'media_pause':
        sendMessage({ type: 'media_control', action: 'playpause' });
        return { action: 'pause' };

      case 'media_next':
        sendMessage({ type: 'media_control', action: 'nexttrack' });
        return { action: 'next' };

      case 'media_previous':
        sendMessage({ type: 'media_control', action: 'prevtrack' });
        return { action: 'prev' };

      // 4. Volume Controls
      case 'volume_control': {
        const action = intent.parameters?.action || 'increase';
        if (action === 'mute') sendMessage({ type: 'media_control', action: 'volumemute' });
        else if (action === 'unmute') sendMessage({ type: 'media_control', action: 'volumemute' });
        else if (action === 'decrease') sendMessage({ type: 'media_control', action: 'volumedown' });
        else sendMessage({ type: 'media_control', action: 'volumeup' });
        return { action };
      }

      // 5. Presentation Controls
      case 'presentation_next':
        sendMessage({ type: 'presentation_control', action: 'next' });
        return { action: 'next' };

      case 'presentation_previous':
        sendMessage({ type: 'presentation_control', action: 'prev' });
        return { action: 'prev' };

      case 'presentation_start':
        sendMessage({ type: 'presentation_control', action: 'start' });
        return { action: 'start' };

      case 'presentation_end':
        sendMessage({ type: 'presentation_control', action: 'stop' });
        return { action: 'stop' };

      // 6. Screen Projector (Phase 2 Integration)
      case 'start_projection': {
        if (callbacks.startProjection) {
          await callbacks.startProjection(device.name);
        }
        return { status: 'streaming' };
      }

      case 'stop_projection': {
        callbacks.stopProjection?.();
        return { status: 'stopped' };
      }

      case 'pause_projection': {
        callbacks.pauseProjection?.();
        return { status: 'paused' };
      }

      case 'resume_projection': {
        callbacks.resumeProjection?.();
        return { status: 'resumed' };
      }

      // 7. Application Launching (Allowlisted Registry Only)
      case 'open_application': {
        const appConfig = intent.parameters?.appConfig;
        if (appConfig?.url) {
          sendMessage({ type: 'share_link', url: appConfig.url });
        } else {
          // Send specific shortcut or link depending on app
          const app = intent.parameters?.application;
          if (app === 'taskmgr') {
            sendMessage({ type: 'quick_control', action: 'taskmgr' });
          } else if (app === 'explorer') {
            sendMessage({ type: 'quick_control', action: 'explorer' });
          } else if (appConfig?.binary) {
            sendMessage({ type: 'share_link', url: `https://www.google.com` });
          }
        }
        return { app: intent.parameters?.application };
      }

      // 8. File Transfer
      case 'send_file': {
        callbacks.openShareModal?.();
        return { modal: 'share_opened' };
      }

      default:
        return {};
    }
  }

  /**
   * Structured Device Status Report.
   */
  private handleDeviceStatusQuery(
    context: AIContext,
    startTime: number,
    input: string
  ): AIExecutionResult {
    const devices = context.connectedDevices || [];
    if (!devices.length) {
      const msg = 'No paired or connected devices found.';
      aiHistory.addEntry({
        userQuery: input,
        intent: 'device_status',
        result: 'success',
        message: msg,
      });
      return {
        success: true,
        intent: 'device_status',
        message: msg,
        timestamp: startTime,
        data: { devices: [] },
      };
    }

    const deviceLines = devices.map((d) => {
      const icon = d.connectionState === 'connected' ? '🟢' : '🔴';
      const state = d.connectionState === 'connected' ? 'Connected' : 'Offline';
      return `${icon} ${d.name} (${d.type.toUpperCase()}) — ${state}`;
    });

    const summary = `Found ${devices.length} device(s):\n${deviceLines.join('\n')}`;

    aiHistory.addEntry({
      userQuery: input,
      intent: 'device_status',
      result: 'success',
      message: summary,
    });

    return {
      success: true,
      intent: 'device_status',
      message: summary,
      timestamp: startTime,
      data: { devices },
    };
  }
}
