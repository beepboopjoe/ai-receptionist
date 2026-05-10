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
  /** Voice name or ID (provider-specific: "Ara"/"Rex" for Grok, voice ID for EL) */
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
