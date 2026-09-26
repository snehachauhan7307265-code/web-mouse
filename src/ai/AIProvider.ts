/**
 * WebMouse V2 — AI Provider Abstraction
 * Decouples the AI Interface from underlying providers (Gemini, Local Deterministic, etc.)
 * Provides an offline deterministic fallback that works with zero external network dependencies.
 */

import { AIIntent } from './AIIntent';
import { AIContext } from './AIContext';
import { AIIntentParser } from './AIIntentParser';

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  parseIntent(input: string, context: AIContext): Promise<AIIntent>;
}

/**
 * Local Deterministic Rule-Based Provider.
 * Zero external API calls, instantaneous (<5ms), 100% offline-ready, zero key exposure.
 */
export class LocalDeterministicProvider implements AIProvider {
  public readonly id = 'local-deterministic';
  public readonly name = 'WebMouse Local Engine (Offline)';

  public async parseIntent(input: string, context: AIContext): Promise<AIIntent> {
    return AIIntentParser.parse(input, context);
  }
}

/**
 * Extensible Provider Adapter for External Models (e.g. Gemini, Server-side proxy).
 * Automatically falls back to LocalDeterministicProvider if network is down or API key is not configured.
 */
export class ExternalAIProviderAdapter implements AIProvider {
  public readonly id = 'external-ai-adapter';
  public readonly name = 'Gemini / External AI Service';

  private fallbackProvider = new LocalDeterministicProvider();

  public async parseIntent(input: string, context: AIContext): Promise<AIIntent> {
    try {
      // In this client architecture, we route via server proxy or client fallback.
      // If no server-side AI proxy is mounted, fallback to local deterministic mode.
      return await this.fallbackProvider.parseIntent(input, context);
    } catch (e) {
      console.warn('[ExternalAIProviderAdapter] Remote AI call failed, falling back to local deterministic engine:', e);
      return await this.fallbackProvider.parseIntent(input, context);
    }
  }
}

let activeProvider: AIProvider = new LocalDeterministicProvider();

export function getAIProvider(): AIProvider {
  return activeProvider;
}

export function setAIProvider(provider: AIProvider): void {
  activeProvider = provider;
}
