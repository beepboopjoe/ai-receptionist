const GROK_VOICE_IDS = [
  'eve', 'ara', 'rex', 'sal', 'leo',
  'aurora', 'castor', 'cosmo', 'zenith',
] as const;

/** Live calls always use Grok. Coerce stale ElevenLabs rows on read/save. */
export function coerceVoiceSettings(input: {
  voiceName?: string | null;
  voiceProvider?: string | null;
}): { voiceName: string; voiceProvider: 'grok' } {
  const raw = (input.voiceName ?? 'eve').toLowerCase();
  const voiceName = (GROK_VOICE_IDS as readonly string[]).includes(raw) ? raw : 'eve';
  return { voiceName, voiceProvider: 'grok' };
}
