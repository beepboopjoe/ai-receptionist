// ============================================================
// Voice adapter factory — resolves by provider name
// ============================================================
import type { IVoiceAdapter } from '@ai-receptionist/shared';
import { GrokVoiceAdapter } from './grok.adapter.js';
import { ElevenLabsVoiceAdapter } from './elevenlabs.adapter.js';
import { config } from '../../../config.js';

type VoiceAdapterConstructor = new (credentials: Record<string, string>) => IVoiceAdapter;

const registry: Record<string, VoiceAdapterConstructor> = {
  grok: GrokVoiceAdapter,
  elevenlabs: ElevenLabsVoiceAdapter,
};

/**
 * Create a voice adapter for a given provider.
 * Default credentials are pulled from app config; can be overridden per-tenant.
 */
export function createVoiceAdapter(
  provider: string = 'grok',
  overrideCredentials?: Record<string, string>
): IVoiceAdapter {
  const Adapter = registry[provider];
  if (!Adapter) {
    throw new Error(
      `Unknown voice provider: "${provider}". Supported: ${Object.keys(registry).join(', ')}`
    );
  }

  const defaultCredentials: Record<string, string> = {
    xai_api_key: config.XAI_API_KEY ?? '',
    elevenlabs_api_key: config.ELEVENLABS_API_KEY ?? '',
    voice_id: config.ELEVENLABS_DEFAULT_VOICE_ID ?? '',
  };

  return new Adapter({ ...defaultCredentials, ...overrideCredentials });
}

export function getSupportedVoiceProviders(): string[] {
  return Object.keys(registry);
}
