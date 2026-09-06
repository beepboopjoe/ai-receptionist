import { describe, it, expect } from 'vitest';
import { coerceVoiceSettings } from './voice-coerce.js';

describe('coerceVoiceSettings', () => {
  it('keeps a known Grok voice and forces provider grok', () => {
    expect(coerceVoiceSettings({ voiceName: 'Leo', voiceProvider: 'elevenlabs' })).toEqual({
      voiceName: 'leo',
      voiceProvider: 'grok',
    });
  });

  it('falls back to eve for unknown or ElevenLabs voice IDs', () => {
    expect(coerceVoiceSettings({ voiceName: '21m00Tcm4TlvDq8ikWAM', voiceProvider: 'elevenlabs' })).toEqual({
      voiceName: 'eve',
      voiceProvider: 'grok',
    });
  });

  it('defaults missing values to eve / grok', () => {
    expect(coerceVoiceSettings({})).toEqual({ voiceName: 'eve', voiceProvider: 'grok' });
  });
});
