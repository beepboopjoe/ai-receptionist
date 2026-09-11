// ============================================================
// First spoken turn on a Telnyx ↔ Grok call.
//
// xAI grok-voice-think-fast defaults reasoning.effort to "high"
// (docs.x.ai speech-to-speech). A bare `response.create` then
// thinks through the full system prompt for ~20–30s of silence
// before any TTS. Scripted greetings use force_message (TTS only,
// no model loop). Session update sets reasoning.effort=none.
// ============================================================
import { DEMO_OPENING_EN } from '../voice-agent/call-me-demo.prompt.js';

export const GROK_REASONING_NONE = { effort: 'none' as const };

/** If force_message yields no audio, fall back to response.create this long after. */
export const GROK_FORCE_MESSAGE_AUDIO_FALLBACK_MS = 3_000;

export function buildGrokForceMessage(text: string): {
  type: 'conversation.item.create';
  item: {
    type: 'force_message';
    role: 'assistant';
    interruptible: false;
    content: Array<{ type: 'output_text'; text: string }>;
  };
} {
  return {
    type: 'conversation.item.create',
    item: {
      type: 'force_message',
      role: 'assistant',
      interruptible: false,
      content: [{ type: 'output_text', text }],
    },
  };
}

export function buildGrokGreetingFallbackCreate(text: string): {
  type: 'response.create';
  response: { instructions: string };
} {
  const spoken = text.trim() || DEMO_OPENING_EN;
  return {
    type: 'response.create',
    response: {
      instructions: `Say exactly this and then stop. Do not add anything: "${spoken}"`,
    },
  };
}

export function firstTurnGreetingText(params: {
  isDemo: boolean;
  isOutbound: boolean;
  practiceName: string;
  callerFirstName?: string | null;
  leadFirstName?: string | null;
  isAfterHours?: boolean;
  adHocTask?: string;
}): string {
  if (params.isDemo) return DEMO_OPENING_EN;

  if (params.adHocTask) {
    return `Hi, this is ${params.practiceName} calling.`;
  }

  if (params.isOutbound) {
    const name = params.leadFirstName?.trim();
    return name
      ? `Hi, may I please speak with ${name}?`
      : `Hi, this is ${params.practiceName} calling.`;
  }

  const caller = params.callerFirstName?.trim();
  if (params.isAfterHours) {
    return caller
      ? `Hi ${caller}, thanks for calling ${params.practiceName}. The office is currently closed, but I can still help.`
      : `Thanks for calling ${params.practiceName}. The office is currently closed, but I can still help.`;
  }

  return caller
    ? `Hi ${caller}, thanks for calling ${params.practiceName}.`
    : `Thanks for calling ${params.practiceName}.`;
}

/** Keep the model from re-delivering the opener after force_message. */
export function alreadySpokenPromptSection(greetingText: string): string {
  return `# Opening already spoken
You already said: "${greetingText}"
Do not repeat that opener. Pause for the caller, then continue the rest of the script.`;
}

export function formatTtfaLog(params: {
  callSid: string;
  stage: string;
  ms: number;
}): string {
  return `TTFA ${params.stage || 'unknown'} callSid=${params.callSid || 'unset'} ms=${params.ms}`;
}
