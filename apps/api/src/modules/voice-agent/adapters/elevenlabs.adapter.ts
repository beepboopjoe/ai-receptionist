// ============================================================
// ElevenLabs Voice Adapter — wraps existing elevenlabs-client.ts
// Kept as a fallback / alternative voice provider.
// ============================================================
import type {
  IVoiceAdapter,
  VoiceSession,
  CreateVoiceSessionParams,
} from '@ai-receptionist/shared';
import type { TranscriptEntry } from '@ai-receptionist/shared';
import {
  createConversationSession,
  createOrUpdateAgent,
  getConversationTranscript,
  getConversationSummary,
} from '../elevenlabs-client.js';
import { IntegrationError } from '../../../lib/errors.js';

export class ElevenLabsVoiceAdapter implements IVoiceAdapter {
  readonly provider = 'elevenlabs' as const;

  constructor(private credentials: Record<string, string>) {
    // Validate credentials at construction
    if (!this.credentials['elevenlabs_api_key'] && !this.credentials['ELEVENLABS_API_KEY']) {
      throw new IntegrationError('elevenlabs', 'ELEVENLABS_API_KEY is required');
    }
  }

  async createSession(params: CreateVoiceSessionParams): Promise<VoiceSession> {
    // ElevenLabs requires a persistent agent. Get or create one per tenant.
    // agentId is stored in tenant_settings.voice_agent_id
    const agentId = this.credentials['agent_id'];

    let resolvedAgentId = agentId;
    if (!resolvedAgentId) {
      // Create a new agent — this is idempotent at the EL level
      const agent = await createOrUpdateAgent({
        name: 'AI Receptionist',
        systemPrompt: params.systemPrompt,
        voiceId: this.credentials['voice_id'],
      });
      resolvedAgentId = agent.agent_id;
    }

    const session = await createConversationSession({
      agentId: resolvedAgentId,
      systemPromptOverride: params.systemPrompt,
      callMetadata: params.callMetadata,
    });

    return {
      sessionId: session.conversation_id,
      provider: 'elevenlabs',
      webSocketUrl: session.signed_url ?? '',
      headers: {},
    };
  }

  async getTranscript(sessionId: string): Promise<TranscriptEntry[]> {
    const raw = await getConversationTranscript(sessionId);
    return raw.map((entry) => ({
      role: entry.role === 'agent' ? 'agent' : 'caller',
      text: entry.message,
      timestamp: new Date(entry.time_in_call_secs * 1000).toISOString(),
    }));
  }

  async getSummary(sessionId: string): Promise<string> {
    return getConversationSummary(sessionId);
  }

  async endSession(_sessionId: string): Promise<void> {
    // ElevenLabs sessions end automatically when the WebSocket is closed.
    // No explicit termination API needed.
  }
}
