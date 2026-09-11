// ============================================================
// Persist homepage call-me visitors for the Telfin platform-admin list.
// Stub on submit (phone known); enrich on hangup from transcript.
// Never throws to the dial / hangup path.
// ============================================================
import { db } from '../../db/client.js';
import { demoLeads } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { normalizePhone } from '../crm/contact-normalizer.js';
import {
  emptyDemoLeadDraft,
  extractDemoLeadFromTranscript,
  type DemoLeadDraft,
} from './demo-lead.extract.js';
import type { DemoCallMeBootLog } from './public-demo.helpers.js';

export interface UpsertDemoLeadInput {
  phoneE164: string;
  callId?: string | null;
  draft: DemoLeadDraft;
  transcript?: string | null;
  log?: DemoCallMeBootLog;
}

function preferExisting(next: string, existing: string | null | undefined): string | null {
  const n = next.trim();
  if (n) return n;
  const e = (existing ?? '').trim();
  return e || null;
}

export async function upsertDemoLead(
  input: UpsertDemoLeadInput,
): Promise<{ id: string } | null> {
  const phone = normalizePhone(input.phoneE164) ?? input.phoneE164.trim();
  if (!phone) return null;

  try {
    const [existing] = await db
      .select({
        id: demoLeads.id,
        name: demoLeads.name,
        business: demoLeads.business,
        email: demoLeads.email,
        language: demoLeads.language,
        voice: demoLeads.voice,
        closed: demoLeads.closed,
        notes: demoLeads.notes,
        transcript: demoLeads.transcript,
        callId: demoLeads.callId,
      })
      .from(demoLeads)
      .where(eq(demoLeads.phoneE164, phone))
      .limit(1);

    const name = preferExisting(input.draft.name, existing?.name);
    const business = preferExisting(input.draft.business, existing?.business);
    const email = preferExisting(input.draft.email, existing?.email);
    const language = input.draft.language.trim() || existing?.language || 'en';
    const voice = input.draft.voice.trim() || existing?.voice || 'aurora';
    const closed = input.draft.closed || Boolean(existing?.closed);
    const notes = preferExisting(input.draft.notes, existing?.notes);
    const transcript = preferExisting(input.transcript ?? '', existing?.transcript);
    const callId = input.callId ?? existing?.callId ?? null;

    if (existing) {
      await db
        .update(demoLeads)
        .set({
          name,
          business,
          email,
          language,
          voice,
          closed,
          notes,
          transcript,
          callId,
          updatedAt: new Date(),
        })
        .where(eq(demoLeads.id, existing.id));
      input.log?.info(
        { leadId: existing.id, callId, closed, language, voice },
        'Demo call-me lead updated',
      );
      return { id: existing.id };
    }

    const [inserted] = await db
      .insert(demoLeads)
      .values({
        phoneE164: phone,
        name,
        business,
        email,
        source: 'call_me',
        language,
        voice,
        closed,
        notes,
        transcript,
        callId,
      })
      .returning({ id: demoLeads.id });

    if (!inserted?.id) return null;
    input.log?.info(
      { leadId: inserted.id, callId, closed, language, voice },
      'Demo call-me lead persisted',
    );
    return { id: inserted.id };
  } catch (err) {
    input.log?.warn({ err, callId: input.callId }, 'Demo call-me lead persist failed');
    return null;
  }
}

/** Fire-and-forget stub when a visitor submits a phone. */
export function stubDemoLead(params: {
  phoneE164: string;
  language: string;
  voice: string;
  callId?: string | null;
  log?: DemoCallMeBootLog;
}): void {
  void upsertDemoLead({
    phoneE164: params.phoneE164,
    draft: emptyDemoLeadDraft({
      language: params.language,
      voice: params.voice,
    }),
    ...(params.callId != null && { callId: params.callId }),
    ...(params.log && { log: params.log }),
  }).catch((err) => {
    params.log?.warn({ err }, 'Demo call-me stub lead persist failed');
  });
}

/** Enrich from transcript after the demo call ends. Never throws. */
export async function enrichDemoLeadFromCall(params: {
  phoneE164: string;
  callId?: string | null;
  language?: string;
  voice?: string;
  transcript: Array<{ role?: string; text?: string }>;
  summary?: string | null;
  log?: DemoCallMeBootLog;
}): Promise<void> {
  const extracted = extractDemoLeadFromTranscript(params.transcript, params.summary);
  const transcriptText = params.transcript
    .map((line) => `${line.role ?? '?'}: ${(line.text ?? '').trim()}`)
    .filter((line) => !line.endsWith(':'))
    .join('\n')
    .slice(0, 8000);
  await upsertDemoLead({
    phoneE164: params.phoneE164,
    draft: emptyDemoLeadDraft({
      name: extracted.name,
      business: extracted.business,
      email: extracted.email,
      language: extracted.languageHint || params.language || 'en',
      voice: params.voice || 'aurora',
      closed: extracted.closed,
      notes: extracted.notes,
    }),
    ...(transcriptText && { transcript: transcriptText }),
    ...(params.callId != null && { callId: params.callId }),
    ...(params.log && { log: params.log }),
  });
}
