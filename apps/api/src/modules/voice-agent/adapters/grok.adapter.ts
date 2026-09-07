// ============================================================
// Grok Voice Adapter — xAI Realtime Voice API
// WebSocket: wss://api.x.ai/v1/realtime?model=grok-voice-think-fast-1.0
// Protocol: compatible with OpenAI Realtime API spec
//
// Model history:
//   - grok-voice-fast-1.0      : deprecated, scheduled for removal
//   - grok-realtime-preview    : older preview, replaced by think-fast
//   - grok-voice-think-fast-1.0: CURRENT — flagship voice model with
//     better turn-taking and a more natural cadence than the preview.
// ============================================================
import { WebSocket } from 'ws';
import type {
  IVoiceAdapter,
  VoiceSession,
  CreateVoiceSessionParams,
} from '@ai-receptionist/shared';
import type { TranscriptEntry } from '@ai-receptionist/shared';
import { IntegrationError } from '../../../lib/errors.js';

// xAI Realtime endpoint — model must be passed as a query param
const GROK_REALTIME_BASE = 'wss://api.x.ai/v1/realtime';
const GROK_MODEL = 'grok-voice-think-fast-1.0';

// Valid Grok voice names (lowercase per current xAI Voice Agent docs)
//   eve — Default voice, engaging and enthusiastic
//   ara — Balanced and conversational
//   rex — Professional and articulate, ideal for business applications
//   sal — Versatile voice suitable for various contexts
//   leo — Decisive and commanding, suitable for instructional content
const GROK_VOICES = ['eve', 'ara', 'rex', 'sal', 'leo'] as const;
type GrokVoice = typeof GROK_VOICES[number];
const DEFAULT_VOICE: GrokVoice = 'eve';

// ---- Per-session in-memory stores ----
// Keyed by sessionId. In V2 migrate to Redis for multi-instance safety.
const sessionTranscripts = new Map<string, TranscriptEntry[]>();
const sessionSummaries = new Map<string, string>();
// Partial buffer for streaming agent transcript deltas
const agentTranscriptBuffer = new Map<string, string>();

export class GrokVoiceAdapter implements IVoiceAdapter {
  readonly provider = 'grok' as const;

  constructor(private credentials: Record<string, string>) {}

  private get apiKey(): string {
    const key = this.credentials['xai_api_key'] ?? this.credentials['XAI_API_KEY'];
    if (!key) throw new IntegrationError('grok_voice', 'XAI_API_KEY is required');
    return key;
  }

  /**
   * Create a Grok Voice session.
   *
   * Returns the WebSocket URL (with model query param) + Authorization header
   * so the audio relay in media-stream.handler.ts can open the connection.
   *
   * The session.update message must be sent immediately after WS open —
   * use GrokVoiceAdapter.buildSessionUpdate() for the correct payload shape.
   */
  async createSession(params: CreateVoiceSessionParams): Promise<VoiceSession> {
    const sessionId = `grok_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Initialize transcript store for this session
    sessionTranscripts.set(sessionId, []);
    agentTranscriptBuffer.set(sessionId, '');

    return {
      sessionId,
      provider: 'grok',
      // Model MUST be in the query string — xAI requires it
      webSocketUrl: `${GROK_REALTIME_BASE}?model=${GROK_MODEL}`,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    };
  }

  /**
   * Build the session.update message for the xAI Speech-to-Speech API.
   *
   * Current xAI docs (2026) use nested `audio.input/output.format`:
   *   { type: "audio/pcmu" }  — G.711 µ-law, 8 kHz (Telnyx PCMU)
   *   { type: "audio/pcm", rate } — linear PCM
   * Default if omitted is audio/pcm @ 24 kHz, which Telnyx cannot play
   * (it expects raw PCMU). Legacy flat `input_audio_format: g711_ulaw`
   * is kept as an alias for older servers.
   *
   * Do NOT send OpenAI-only `input_audio_transcription.model: whisper-1` —
   * xAI rejects unknown transcription models and then keeps the PCM default.
   *
   * Send this on WS open; wait for `session.updated` before response.create
   * so the greeting is encoded as PCMU, not the pre-update default.
   */
  static buildSessionUpdate(params: CreateVoiceSessionParams & { sessionId: string }) {
    const voice = validateVoice(params.voice) ?? DEFAULT_VOICE;
    const inputCodec = toXaiCodec(params.audioInputFormat);
    const outputCodec = toXaiCodec(params.audioOutputFormat);

    return {
      type: 'session.update',
      session: {
        instructions: params.systemPrompt,
        voice,
        audio: {
          input: {
            format: inputCodec,
            transport: 'json' as const,
          },
          output: {
            format: outputCodec,
            transport: 'json' as const,
          },
        },
        // Legacy OpenAI-compat aliases (ignored on current xAI, read by older)
        input_audio_format: toLegacyXaiFormat(params.audioInputFormat),
        output_audio_format: toLegacyXaiFormat(params.audioOutputFormat),
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      },
    };
  }

  /**
   * Kick the first agent turn so the callee hears a greeting without
   * speaking first. Send after session.update (same order as the working
   * Telnyx↔Grok devmode bridge).
   */
  static buildGreetingCreate() {
    return { type: 'response.create' as const };
  }

  /**
   * Process an incoming Grok event and update session transcript.
   * Called by the audio relay for each message received from Grok.
   *
   * Returns the event type and — when a transcript entry was just
   * finalized — the text that was added. The caller uses these to
   * fan out mid-call transcript events to the live-monitor stream.
   */
  static processEvent(
    sessionId: string,
    event: Record<string, unknown>
  ): { type: string; escalate?: boolean; flushedAgentText?: string; callerText?: string } {
    const type = event['type'] as string;

    switch (type) {
      // ── Agent speech transcript (streaming delta) ──────────────────────
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta': {
        const delta = event['delta'] as string | undefined;
        if (delta) {
          const current = agentTranscriptBuffer.get(sessionId) ?? '';
          agentTranscriptBuffer.set(sessionId, current + delta);
        }
        break;
      }

      // ── Agent turn complete — flush buffer to transcript ───────────────
      case 'response.done': {
        const buffered = agentTranscriptBuffer.get(sessionId) ?? '';
        const flushed = buffered.trim();
        if (flushed) {
          const transcript = sessionTranscripts.get(sessionId) ?? [];
          transcript.push({
            role: 'agent',
            text: flushed,
            timestamp: new Date().toISOString(),
          });
          sessionTranscripts.set(sessionId, transcript);
          agentTranscriptBuffer.set(sessionId, ''); // reset for next turn
          return { type, flushedAgentText: flushed };
        }
        break;
      }

      // ── Caller ASR (finalized) ─────────────────────────────────────────
      // This event fires when Grok has finished transcribing the caller's speech.
      case 'conversation.item.input_audio_transcription.completed': {
        const transcriptText = event['transcript'] as string | undefined;
        const trimmed = transcriptText?.trim();
        if (trimmed) {
          const transcript = sessionTranscripts.get(sessionId) ?? [];
          transcript.push({
            role: 'caller',
            text: trimmed,
            timestamp: new Date().toISOString(),
          });
          sessionTranscripts.set(sessionId, transcript);
          return { type, callerText: trimmed };
        }
        break;
      }

      // ── Session confirmed ─────────────────────────────────────────────
      case 'session.created':
      case 'session.updated':
        // Nothing to do — confirmation events
        break;

      // ── Input activity signals (useful for logging/metrics) ───────────
      case 'input_audio_buffer.speech_started':
      case 'input_audio_buffer.speech_stopped':
        break;

      case 'error': {
        const error = event['error'] as Record<string, unknown> | undefined;
        console.error('[grok] Session error:', error?.['message'] ?? event);
        break;
      }
    }

    return { type };
  }

  async getTranscript(sessionId: string): Promise<TranscriptEntry[]> {
    return sessionTranscripts.get(sessionId) ?? [];
  }

  /**
   * Generate a brief summary from the accumulated transcript.
   * V1: template-based (fast, no extra API call).
   * V2: POST to xAI chat completions for AI-generated summary.
   */
  async getSummary(sessionId: string): Promise<string> {
    const cached = sessionSummaries.get(sessionId);
    if (cached) return cached;

    const transcript = await this.getTranscript(sessionId);
    if (!transcript.length) return 'No transcript available.';

    const agentTurns = transcript.filter((t) => t.role === 'agent');
    const callerTurns = transcript.filter((t) => t.role === 'caller');
    const lastCaller = callerTurns.at(-1);
    const lastAgent = agentTurns.at(-1);

    const summary = [
      `${transcript.length}-turn call (${agentTurns.length} AI, ${callerTurns.length} caller).`,
      lastCaller ? `Last caller: "${lastCaller.text.slice(0, 100)}"` : '',
      lastAgent  ? `Last agent: "${lastAgent.text.slice(0, 100)}"` : '',
    ].filter(Boolean).join(' ');

    sessionSummaries.set(sessionId, summary);
    return summary;
  }

  async endSession(sessionId: string): Promise<void> {
    // Sessions auto-close when the WebSocket is disconnected.
    // Clean up local state.
    sessionTranscripts.delete(sessionId);
    sessionSummaries.delete(sessionId);
    agentTranscriptBuffer.delete(sessionId);
  }
}

// ---- Helpers ----

export type XaiAudioFormat =
  | { type: 'audio/pcmu' }
  | { type: 'audio/pcma' }
  | { type: 'audio/pcm'; rate: number };

/** Current xAI Speech-to-Speech codec object. */
export function toXaiCodec(fmt?: string): XaiAudioFormat {
  if (fmt === 'pcmu') return { type: 'audio/pcmu' };
  if (fmt === 'pcma') return { type: 'audio/pcma' };
  return { type: 'audio/pcm', rate: 24000 };
}

/** Pre-2026 flat field still accepted by some Grok realtime servers. */
export function toLegacyXaiFormat(fmt?: string): 'g711_ulaw' | 'g711_alaw' | 'pcm16' {
  if (fmt === 'pcmu') return 'g711_ulaw';
  if (fmt === 'pcma') return 'g711_alaw';
  return 'pcm16';
}

function validateVoice(voice?: string): GrokVoice | null {
  if (!voice) return null;
  // xAI Voice Agent expects lowercase ('eve', 'ara', 'rex', 'sal', 'leo').
  // Old tenant settings may store capitalized values ('Ara', 'Eve') — coerce.
  const normalized = voice.toLowerCase();
  return GROK_VOICES.includes(normalized as GrokVoice) ? (normalized as GrokVoice) : null;
}
