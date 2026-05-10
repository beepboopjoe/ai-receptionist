// ============================================================
// ElevenLabs Conversational AI client
// ============================================================
import { config } from '../../config.js';
import { IntegrationError } from '../../lib/errors.js';

const EL_BASE = 'https://api.elevenlabs.io/v1';

export interface ElevenLabsAgent {
  agent_id: string;
  name: string;
}

export interface ConversationSession {
  conversation_id: string;
  agent_id: string;
  signed_url?: string; // WebSocket URL for audio streaming
}

// ---- Agent management ----

export async function createOrUpdateAgent(params: {
  agentId?: string;
  name: string;
  systemPrompt: string;
  voiceId?: string;
}): Promise<ElevenLabsAgent> {
  const body = {
    name: params.name,
    conversation_config: {
      agent: {
        prompt: { prompt: params.systemPrompt },
        first_message: 'Thank you for calling. How can I help you today?',
        language: 'en',
      },
      tts: {
        voice_id: params.voiceId ?? config.ELEVENLABS_DEFAULT_VOICE_ID,
        model_id: 'eleven_turbo_v2',
        optimize_streaming_latency: 3,
      },
      asr: {
        quality: 'high',
        provider: 'elevenlabs',
        keywords: ['appointment', 'schedule', 'cancel', 'reschedule', 'emergency', 'pain'],
      },
    },
  };

  const method = params.agentId ? 'PATCH' : 'POST';
  const url = params.agentId
    ? `${EL_BASE}/convai/agents/${params.agentId}`
    : `${EL_BASE}/convai/agents/create`;

  const res = await fetch(url, {
    method,
    headers: {
      'xi-api-key': config.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new IntegrationError('elevenlabs', `Agent create/update failed: ${err}`);
  }

  return res.json() as Promise<ElevenLabsAgent>;
}

/**
 * Create a signed WebSocket URL for a new conversation session.
 * The WebSocket carries the real-time audio between RingCentral and ElevenLabs.
 */
export async function createConversationSession(params: {
  agentId: string;
  systemPromptOverride?: string;
  callMetadata?: Record<string, string>;
}): Promise<ConversationSession> {
  const body: Record<string, unknown> = {
    agent_id: params.agentId,
  };

  if (params.systemPromptOverride) {
    body['overrides'] = {
      agent: { prompt: { prompt: params.systemPromptOverride } },
    };
  }

  if (params.callMetadata) {
    body['custom_llm_extra_body'] = params.callMetadata;
  }

  const res = await fetch(`${EL_BASE}/convai/conversation/get_signed_url`, {
    method: 'POST',
    headers: {
      'xi-api-key': config.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new IntegrationError('elevenlabs', `Session creation failed: ${err}`);
  }

  return res.json() as Promise<ConversationSession>;
}

/**
 * Fetch the conversation transcript after a session ends.
 */
export async function getConversationTranscript(
  conversationId: string
): Promise<Array<{ role: string; message: string; time_in_call_secs: number }>> {
  const res = await fetch(`${EL_BASE}/convai/conversations/${conversationId}`, {
    headers: { 'xi-api-key': config.ELEVENLABS_API_KEY },
  });

  if (!res.ok) return [];

  const data = await res.json() as { transcript?: Array<{ role: string; message: string; time_in_call_secs: number }> };
  return data.transcript ?? [];
}

/**
 * Generate a call summary using ElevenLabs conversation data.
 * Falls back to a simple template if the API doesn't return a summary.
 */
export async function getConversationSummary(conversationId: string): Promise<string> {
  const transcript = await getConversationTranscript(conversationId);
  if (!transcript.length) return 'No transcript available.';

  // Build a simple summary from the transcript
  const turns = transcript.length;
  const agentMessages = transcript.filter((t) => t.role === 'agent').length;
  const callerMessages = transcript.filter((t) => t.role === 'user').length;

  return `Call lasted ${turns} turns (${agentMessages} agent, ${callerMessages} caller messages). ` +
    `Last message: "${transcript[transcript.length - 1]?.message ?? ''}"`;
}
