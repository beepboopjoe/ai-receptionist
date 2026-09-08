// ============================================================
// Voice AI Adapter Interface — provider-agnostic contract
// Implemented by: GrokVoiceAdapter, ElevenLabsVoiceAdapter
// ============================================================
import type { TranscriptEntry } from './call.types.js';

export type VoiceProvider = 'grok' | 'elevenlabs';
export type AudioFormat = 'pcmu' | 'pcm' | 'pcma'; // mulaw | linear16 | alaw

export interface VoiceSession {
  /** Unique session ID from the provider */
  sessionId: string;
  /** Provider name for logging/switching */
  provider: VoiceProvider;
  /**
   * For ElevenLabs: the signed WebSocket URL to connect to.
   * For Grok: the raw wss://api.x.ai/v1/realtime URL (auth via headers).
   */
  webSocketUrl: string;
  /** Additional connection headers (Grok requires Authorization header) */
  headers?: Record<string, string>;
}

export interface CreateVoiceSessionParams {
  /** System prompt assembled by prompt-builder.ts */
  systemPrompt: string;
  /** Voice name or ID (Grok: public aurora/castor/cosmo/zenith, or legacy eve/ara/rex/sal/leo; EL voice ID) */
  voice?: string;
  /**
   * Audio input format from the telephony provider.
   * Use 'pcmu' (G.711 mulaw) for Twilio/RingCentral telephony — 8kHz.
   * Use 'pcm' for WebRTC / higher quality paths.
   */
  audioInputFormat?: AudioFormat;
  /** Audio output format — should match what the telephony provider expects */
  audioOutputFormat?: AudioFormat;
  /** Per-call metadata passed to the provider for logging/context */
  callMetadata?: Record<string, string>;
}

export interface IVoiceAdapter {
  readonly provider: VoiceProvider;

  /**
   * Create a new real-time voice session.
   * Returns connection details for the WebSocket audio bridge.
   */
  createSession(params: CreateVoiceSessionParams): Promise<VoiceSession>;

  /**
   * Fetch the call transcript after the session ends.
   * Returns an empty array if transcript is unavailable.
   */
  getTranscript(sessionId: string): Promise<TranscriptEntry[]>;

  /**
   * Generate an AI summary of the call from the transcript.
   */
  getSummary(sessionId: string): Promise<string>;

  /**
   * Forcefully end an active session (used on escalation/hangup).
   */
  endSession(sessionId: string): Promise<void>;
}

// Voice adapter factory type
export type VoiceAdapterConstructor = new (
  credentials: Record<string, string>
) => IVoiceAdapter;

// ============================================================
// Grok voice catalog — single source of truth
//
// Public / offered now: aurora, castor, cosmo, zenith.
// Legacy IDs stay valid in session config and tenant_settings so
// existing rows keep working. Do not surface LEGACY_GROK_VOICES
// in user-facing pickers.
// ============================================================

/** Voices shown in marketing, settings, and sample players. */
export const PUBLIC_GROK_VOICES = ['aurora', 'castor', 'cosmo', 'zenith'] as const;

/** Prior Grok IDs — hidden from UI, still accepted on live calls. */
export const LEGACY_GROK_VOICES = ['eve', 'ara', 'rex', 'sal', 'leo'] as const;

/** Public + legacy. Use this for session validation and DB coercion. */
export const ALL_GROK_VOICES = [...PUBLIC_GROK_VOICES, ...LEGACY_GROK_VOICES] as const;

export type PublicGrokVoice = (typeof PUBLIC_GROK_VOICES)[number];
export type LegacyGrokVoice = (typeof LEGACY_GROK_VOICES)[number];
export type GrokVoice = (typeof ALL_GROK_VOICES)[number];

export const DEFAULT_PUBLIC_GROK_VOICE: PublicGrokVoice = 'aurora';

export const PUBLIC_GROK_VOICE_META: Record<
  PublicGrokVoice,
  { label: string; description: string }
> = {
  aurora: { label: 'Aurora', description: 'Warm & luminous' },
  castor: { label: 'Castor', description: 'Clear & confident' },
  cosmo: { label: 'Cosmo', description: 'Bright & energetic' },
  zenith: { label: 'Zenith', description: 'Calm & composed' },
};

export const LEGACY_GROK_VOICE_META: Record<
  LegacyGrokVoice,
  { label: string; description: string }
> = {
  eve: { label: 'Eve', description: 'Engaging & enthusiastic' },
  ara: { label: 'Ara', description: 'Balanced & conversational' },
  rex: { label: 'Rex', description: 'Professional & articulate' },
  sal: { label: 'Sal', description: 'Versatile & neutral' },
  leo: { label: 'Leo', description: 'Decisive & commanding' },
};

export function isPublicGrokVoice(value: unknown): value is PublicGrokVoice {
  return typeof value === 'string' && (PUBLIC_GROK_VOICES as readonly string[]).includes(value);
}

export function isLegacyGrokVoice(value: unknown): value is LegacyGrokVoice {
  return typeof value === 'string' && (LEGACY_GROK_VOICES as readonly string[]).includes(value);
}

export function isGrokVoice(value: unknown): value is GrokVoice {
  return typeof value === 'string' && (ALL_GROK_VOICES as readonly string[]).includes(value);
}

/** Lowercase + allowlist. Unknown / ElevenLabs IDs fall back to Aurora. Legacy IDs are kept. */
export function asGrokVoice(
  value: unknown,
  fallback: GrokVoice = DEFAULT_PUBLIC_GROK_VOICE,
): GrokVoice {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const normalized = value.trim().toLowerCase();
  return isGrokVoice(normalized) ? normalized : fallback;
}

export function grokVoiceLabel(id: string): string {
  const normalized = id.trim().toLowerCase();
  if (isPublicGrokVoice(normalized)) return PUBLIC_GROK_VOICE_META[normalized].label;
  if (isLegacyGrokVoice(normalized)) return LEGACY_GROK_VOICE_META[normalized].label;
  return id;
}

/** Server-side call-me picker. Inject `random` in tests. */
export function pickRandomPublicGrokVoice(
  random: () => number = Math.random,
): PublicGrokVoice {
  const n = PUBLIC_GROK_VOICES.length;
  const r = random();
  const idx = Math.min(n - 1, Math.max(0, Math.floor(r * n)));
  return PUBLIC_GROK_VOICES[idx]!;
}

/**
 * Demo calls use the per-dial voice from client_state when present.
 * Paying tenants always use their saved voice (including legacy IDs).
 */
export function resolveSessionGrokVoice(params: {
  isDemo: boolean;
  demoVoice?: string | null;
  tenantVoice?: string | null;
}): GrokVoice {
  if (params.isDemo && params.demoVoice) {
    return asGrokVoice(params.demoVoice);
  }
  return asGrokVoice(params.tenantVoice);
}
