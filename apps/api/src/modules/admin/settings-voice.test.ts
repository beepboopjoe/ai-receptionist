import { describe, it, expect } from 'vitest';
import { coerceVoiceSettings } from './voice-coerce.js';

describe('coerceVoiceSettings', () => {
  it('keeps a known Grok voice (including legacy) and forces provider grok', () => {
    expect(coerceVoiceSettings({ voiceName: 'Leo', voiceProvider: 'elevenlabs' })).toEqual({
      voiceName: 'leo',
      voiceProvider: 'grok',
    });
    expect(coerceVoiceSettings({ voiceName: 'aurora' })).toEqual({
      voiceName: 'aurora',
      voiceProvider: 'grok',
    });
  });

  it('falls back to aurora for unknown or ElevenLabs voice IDs', () => {
    expect(coerceVoiceSettings({ voiceName: '21m00Tcm4TlvDq8ikWAM', voiceProvider: 'elevenlabs' })).toEqual({
      voiceName: 'aurora',
      voiceProvider: 'grok',
    });
  });

  it('defaults missing values to aurora / grok', () => {
    expect(coerceVoiceSettings({})).toEqual({ voiceName: 'aurora', voiceProvider: 'grok' });
  });
});
