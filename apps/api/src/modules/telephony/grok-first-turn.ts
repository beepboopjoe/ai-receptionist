// ============================================================
// First spoken turn on a Telnyx ↔ Grok call.
//
// xAI grok-voice-think-fast defaults reasoning.effort to "high"
// (docs.x.ai speech-to-speech). A bare `response.create` then
// thinks through the full system prompt for ~20–30s of silence
// before any TTS. Scripted greetings use force_message (TTS only,
// no model loop). Session update sets reasoning.effort=none.
// ============================================================
import {
  buildDemoOpeningEn,
  buildDemoOpeningEs,
  DEMO_OPENING_EN,
} from '../voice-agent/call-me-demo.prompt.js';
import {
  inboundGreetingEs,
  normalizeSpokenLanguage,
  outboundGreetingEs,
  type SpokenLanguage,
} from '../voice-agent/spoken-language.js';

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
  /** Homepage demo spoken name. Empty / placeholder → Telfin. */
  agentName?: string | null;
  /** Leftover / widget call-me language. `es` uses the Spanish AI-reveal open. */
  language?: string | null;
  /** Owner setting for paying-tenant calls. `es` greets in Spanish. */
  spokenLanguage?: SpokenLanguage | string | null;
}): string {
  if (params.isDemo) {
    const demoLang = String(params.language ?? '').trim().toLowerCase();
    if (demoLang === 'es' || demoLang === 'spanish' || demoLang === 'español') {
      return buildDemoOpeningEs(params.agentName);
    }
    return buildDemoOpeningEn(params.agentName);
  }

  const spoken = normalizeSpokenLanguage(params.spokenLanguage);
  if (spoken === 'es') {
    if (params.adHocTask || params.isOutbound) {
      return outboundGreetingEs({
        practiceName: params.practiceName,
        ...(params.leadFirstName ? { leadFirstName: params.leadFirstName } : {}),
        ...(params.adHocTask ? { adHocTask: params.adHocTask } : {}),
      });
    }
    return inboundGreetingEs({
      practiceName: params.practiceName,
      ...(params.callerFirstName ? { callerFirstName: params.callerFirstName } : {}),
      ...(params.isAfterHours ? { isAfterHours: true } : {}),
    });
  }

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
