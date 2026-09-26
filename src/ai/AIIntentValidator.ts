/**
 * WebMouse V2 — AI Intent Validator
 * Enforces strict allowlisting, boundaries, parameter validation, and security sanitization.
 * The AI is never trusted. Only verified, allowlisted intents can pass.
 */

import {
  AIIntent,
  SAFE_INTENT_ALLOWLIST,
  ALLOWLISTED_APPLICATIONS_REGISTRY,
} from './AIIntent';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedIntent?: AIIntent;
}

const FORBIDDEN_PATTERNS = [
  /powershell/i,
  /cmd\.exe/i,
  /bash/i,
  /sh\s+-c/i,
  /rm\s+-rf/i,
  /del\s+\/s/i,
  /format\s+[a-z]:/i,
  /reg\s+delete/i,
  /shutdown/i,
  /disable\s+(security|firewall|defender)/i,
  /downloadstring/i,
  /invoke-expression/i,
  /exec\(/i,
  /eval\(/i,
];

export class AIIntentValidator {
  /**
   * Validates and sanitizes an AIIntent before any capability check or device routing.
   */
  public static validate(intent: AIIntent): ValidationResult {
    // 1. Check for malicious shell / system injection keywords in query or parameters
    const rawCheck = (intent.rawQuery || '') + JSON.stringify(intent.parameters || {});
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(rawCheck)) {
        return {
          isValid: false,
          error: "I can't execute unrestricted system commands. Only safe, allowlisted device actions are supported.",
        };
      }
    }

    // 2. Check if intent is recognized and in the safe allowlist
    if (intent.intent === 'unknown') {
      return {
        isValid: false,
        error: intent.explanation || "I'm not sure what action you want me to perform.",
      };
    }

    if (!SAFE_INTENT_ALLOWLIST.has(intent.intent)) {
      return {
        isValid: false,
        error: `Action '${intent.intent}' is not in the safe allowlist and cannot be executed.`,
      };
    }

    const sanitized = { ...intent, parameters: { ...intent.parameters } };

    // 3. Specific Intent Validations & Parameter Clamping
    switch (sanitized.intent) {
      case 'open_application': {
        const appKey = String(sanitized.parameters?.application || '').toLowerCase().trim();
        if (!appKey) {
          return {
            isValid: false,
            error: 'No application specified to launch.',
          };
        }
        // Match against allowlisted applications
        let matchedKey: string | null = null;
        for (const [key, config] of Object.entries(ALLOWLISTED_APPLICATIONS_REGISTRY)) {
          if (key === appKey || config.aliases.some((a) => a.toLowerCase() === appKey)) {
            matchedKey = key;
            break;
          }
        }
        if (!matchedKey) {
          return {
            isValid: false,
            error: `Application '${appKey}' is not in the approved safe registry. Allowed apps: Chrome, Edge, Notepad, Calculator, Explorer, YouTube.`,
          };
        }
        sanitized.parameters.application = matchedKey;
        sanitized.parameters.appConfig = ALLOWLISTED_APPLICATIONS_REGISTRY[matchedKey];
        break;
      }

      case 'mouse_move': {
        let dx = Number(sanitized.parameters?.dx) || 0;
        let dy = Number(sanitized.parameters?.dy) || 0;
        // Clamp to safe screen delta boundaries (-1200 to +1200 px)
        dx = Math.max(-1200, Math.min(1200, dx));
        dy = Math.max(-1200, Math.min(1200, dy));
        sanitized.parameters.dx = dx;
        sanitized.parameters.dy = dy;
        break;
      }

      case 'volume_control': {
        const action = sanitized.parameters?.action;
        if (!['increase', 'decrease', 'mute', 'unmute', 'set'].includes(action)) {
          sanitized.parameters.action = 'increase';
        }
        if (sanitized.parameters.amount !== undefined) {
          let amt = Number(sanitized.parameters.amount);
          amt = Math.max(0, Math.min(100, isNaN(amt) ? 10 : amt));
          sanitized.parameters.amount = amt;
        }
        break;
      }

      case 'open_url':
      case 'quick_share': {
        const url = sanitized.parameters?.url;
        if (url && typeof url === 'string') {
          if (!/^https?:\/\//i.test(url) && !url.startsWith('www.')) {
            return {
              isValid: false,
              error: 'Invalid or unsafe URL format. URLs must start with http:// or https://',
            };
          }
        }
        break;
      }

      case 'keyboard_input': {
        const text = sanitized.parameters?.text;
        const key = sanitized.parameters?.key;
        const keys = sanitized.parameters?.keys;
        if (!text && !key && (!keys || !keys.length)) {
          return {
            isValid: false,
            error: 'No valid key or text provided for keyboard input.',
          };
        }
        break;
      }
    }

    return {
      isValid: true,
      sanitizedIntent: sanitized,
    };
  }
}
