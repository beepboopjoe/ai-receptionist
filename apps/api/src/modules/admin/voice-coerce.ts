import { asGrokVoice } from '@ai-receptionist/shared';

/** Live calls always use Grok. Coerce stale ElevenLabs rows on read/save. */
export function coerceVoiceSettings(input: {
  voiceName?: string | null;
  voiceProvider?: string | null;
}): { voiceName: string; voiceProvider: 'grok' } {
  return { voiceName: asGrokVoice(input.voiceName), voiceProvider: 'grok' };
}
