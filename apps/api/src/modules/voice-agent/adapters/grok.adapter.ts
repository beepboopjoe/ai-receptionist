// ============================================================
// Grok Voice Adapter — xAI Realtime Voice API
// WebSocket: wss://api.x.ai/v1/realtime?model=grok-realtime-preview
// Protocol: compatible with OpenAI Realtime API spec
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
const GROK_MODEL = 'grok-realtime-preview';

// Valid Grok voice names (case-sensitive)
const GROK_VOICES = ['Ara', 'Rex', 'Sal', 'Eve', 'Leo'] as const;
type GrokVoice = typeof GROK_VOICES[number];
const DEFAULT_VOICE: GrokVoice = 'Ara';

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
   * Build the session.update message for the xAI Realtime API.
   *
   * IMPORTANT — audio format spec:
   *   xAI/OpenAI Realtime API uses flat fields `input_audio_format` /
   *   `output_audio_format` at the session level (NOT nested objects).
   *   For G.711 µ-law (PCMU / 8kHz from Telnyx): use 'g711_ulaw'.
   *
   * This is called once after the WebSocket 'open' event fires.
   */
  static buildSessionUpdate(params: CreateVoiceSessionParams & { sessionId: string }) {
    const voice = validateVoice(params.voice) ?? DEFAULT_VOICE;

    // Map our internal AudioFormat enum to xAI format strings
    const toXaiFormat = (fmt?: string): string => {
      if (fmt === 'pcmu') return 'g711_ulaw';
      if (fmt === 'pcma') return 'g711_alaw';
      return 'pcm16'; // linear PCM default
    };

    return {
      type: 'session.update',
      session: {
        instructions: params.systemPrompt,
        voice,
        // Flat format fields — required by xAI/OpenAI Realtime spec
        input_audio_format: toXaiFormat(params.audioInputFormat),
        output_audio_format: toXaiFormat(params.audioOutputFormat),
        // Enable ASR so we get caller transcription events
        input_audio_transcription: {
          model: 'whisper-1',
        },
        // Server-side VAD — handles turn detection and barge-in
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        tools: [],
        tool_choice: 'none',
      },
    };
  }

  /**
   * Process an incoming Grok event and update session transcript.
   * Called by the audio relay for each message received from Grok.
   *
   * Returns the event type and any action signals (e.g. escalate).
   */
  static processEvent(
    sessionId: string,
    event: Record<string, unknown>
  ): { type: string; escalate?: boolean } {
    const type = event['type'] as string;

    switch (type) {
      // ── Agent speech transcript (streaming delta) ──────────────────────
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
        if (buffered.trim()) {
          const transcript = sessionTranscripts.get(sessionId) ?? [];
          transcript.push({
            role: 'agent',
            text: buffered.trim(),
            timestamp: new Date().toISOString(),
          });
          sessionTranscripts.set(sessionId, transcript);
          agentTranscriptBuffer.set(sessionId, ''); // reset for next turn
        }
        break;
      }

      // ── Caller ASR (finalized) ─────────────────────────────────────────
      // This event fires when Grok has finished transcribing the caller's speech.
      case 'conversation.item.input_audio_transcription.completed': {
        const transcriptText = event['transcript'] as string | undefined;
        if (transcriptText?.trim()) {
          const transcript = sessionTranscripts.get(sessionId) ?? [];
          transcript.push({
            role: 'caller',
            text: transcriptText.trim(),
            timestamp: new Date().toISOString(),
          });
          sessionTranscripts.set(sessionId, transcript);
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

function validateVoice(voice?: string): GrokVoice | null {
  if (!voice) return null;
  const normalized = voice.charAt(0).toUpperCase() + voice.slice(1).toLowerCase();
  return GROK_VOICES.includes(normalized as GrokVoice) ? (normalized as GrokVoice) : null;
}
