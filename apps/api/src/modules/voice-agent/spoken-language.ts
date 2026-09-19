// ============================================================
// Paying-tenant spoken language (English + Spanish).
// Demo leftovers still live in call-me-language.ts.
// ============================================================
import {
  normalizeSpokenLanguage,
  type SpokenLanguage,
} from '@ai-receptionist/shared';

export { normalizeSpokenLanguage, type SpokenLanguage };
export { isSpokenLanguage, SPOKEN_LANGUAGE_VALUES } from '@ai-receptionist/shared';

export function spokenLanguagePromptBlock(mode: SpokenLanguage): string {
  if (mode === 'es') {
    return `# Spoken language (IMPORTANT)
Speak Spanish from the VERY FIRST word of the greeting. Do not start in English.
- Do not ask if Spanish is OK.
- Do not apologize for your Spanish. Do not switch to English to "explain better" unless they ask or they start speaking English.
- If they switch to English, follow them automatically.
- English and Spanish are the product languages. Do not use other languages.`;
  }
  if (mode === 'auto') {
    return `# Spoken language
This line is bilingual: English and Spanish. English is the primary greeting.
- Open in English as the safe fallback.
- As soon as you hear Spanish, switch to Spanish from the next turn — do not ask "is Spanish OK?"
- Follow them if they switch between English and Spanish. Do not announce the switch.
- If you cannot tell, stay in English.
- Do not use other languages.`;
  }
  return `# Spoken language
English is the primary language.
- Open and stay in English unless they clearly speak Spanish.
- If they speak Spanish, switch to Spanish from the next turn. Do not ask if Spanish is OK.
- If they switch back to English, follow them.
- Do not use other languages.`;
}

export function smsLanguagePromptBlock(mode: SpokenLanguage): string {
  if (mode === 'es') {
    return `# Language
Reply in Spanish. Match their Spanish if they write in Spanish. Switch to English only if they write in English.`;
  }
  if (mode === 'auto') {
    return `# Language
Reply in the language of their latest text. English and Spanish only. If you cannot tell, reply in English.`;
  }
  return `# Language
Reply in English. If they write in Spanish, reply in Spanish.`;
}

export function inboundGreetingEs(params: {
  practiceName: string;
  callerFirstName?: string | null;
  isAfterHours?: boolean;
}): string {
  const caller = params.callerFirstName?.trim();
  if (params.isAfterHours) {
    return caller
      ? `Hola ${caller}, gracias por llamar a ${params.practiceName}. La oficina está cerrada, pero igual le puedo ayudar.`
      : `Gracias por llamar a ${params.practiceName}. La oficina está cerrada, pero igual le puedo ayudar.`;
  }
  return caller
    ? `Hola ${caller}, gracias por llamar a ${params.practiceName}.`
    : `Gracias por llamar a ${params.practiceName}.`;
}

export function outboundGreetingEs(params: {
  practiceName: string;
  leadFirstName?: string | null;
  adHocTask?: string;
}): string {
  if (params.adHocTask) {
    return `Hola, le llama ${params.practiceName}.`;
  }
  const name = params.leadFirstName?.trim();
  return name
    ? `Hola, ¿puedo hablar con ${name}?`
    : `Hola, le llama ${params.practiceName}.`;
}

export function afterHoursHoldReplyEs(practiceName: string): string {
  return `Gracias por escribirle a ${practiceName}. Nuestra oficina está cerrada. Le contactaremos en horario laboral. Si es urgente, responda URGENTE.`;
}

export function smsFallbackReplyEs(params: {
  practiceName: string;
  afterHours: boolean;
  urgent: boolean;
  newContact: boolean;
}): string {
  if (params.urgent) {
    return `Gracias por escribirle a ${params.practiceName}. Estoy avisando al equipo y alguien le va a contactar.`;
  }
  if (params.afterHours) {
    return afterHoursHoldReplyEs(params.practiceName);
  }
  if (params.newContact) {
    return `Gracias por escribirle a ${params.practiceName}. ¿En qué le podemos ayudar? Responda con su nombre y lo que necesita.`;
  }
  return `Gracias por escribirle a ${params.practiceName}. Un compañero le va a contactar en breve.`;
}

export function smsHelpReplyEs(transferNumber: string | null): string {
  return transferNumber
    ? `Para ayuda, llame a ${transferNumber} o escríbanos en horario de oficina.`
    : `Para ayuda, escríbanos en horario de oficina y un compañero le contactará.`;
}

export function usesSpanishCopy(mode: SpokenLanguage): boolean {
  return mode === 'es';
}
