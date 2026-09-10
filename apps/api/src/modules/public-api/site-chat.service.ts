// ============================================================
// Persist marketing site-chat leads onto demo_leads.
// Email-only rows are allowed (phone_e164 nullable after 0041).
// Never throws to the request path.
// ============================================================
import { db } from '../../db/client.js';
import { demoLeads } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import type { DemoCallMeBootLog } from './public-demo.helpers.js';
import type { SiteChatLeadDraft } from './site-chat.helpers.js';

function preferExisting(next: string | null | undefined, existing: string | null | undefined): string | null {
  const n = (next ?? '').trim();
  if (n) return n;
  const e = (existing ?? '').trim();
  return e || null;
}

function clipTranscript(next: string, existing: string | null | undefined): string | null {
  const n = next.trim();
  if (n) return n.slice(0, 4000);
  const e = (existing ?? '').trim();
  return e || null;
}

export async function persistSiteChatLead(params: {
  draft: SiteChatLeadDraft;
  log?: DemoCallMeBootLog;
}): Promise<{ id: string } | null> {
  const d = params.draft;
  if (!d.email && !d.phoneE164) return null;

  try {
    let existing: {
      id: string;
      phoneE164: string | null;
      email: string | null;
      name: string | null;
      notes: string | null;
      closed: boolean;
      source: string;
      emailConsent: boolean;
      smsConsent: boolean;
      transcript: string | null;
      conversationId: string | null;
      pagePath: string | null;
    } | undefined;

    if (d.phoneE164) {
      const [byPhone] = await db
        .select({
          id: demoLeads.id,
          phoneE164: demoLeads.phoneE164,
          email: demoLeads.email,
          name: demoLeads.name,
          notes: demoLeads.notes,
          closed: demoLeads.closed,
          source: demoLeads.source,
          emailConsent: demoLeads.emailConsent,
          smsConsent: demoLeads.smsConsent,
          transcript: demoLeads.transcript,
          conversationId: demoLeads.conversationId,
          pagePath: demoLeads.pagePath,
        })
        .from(demoLeads)
        .where(eq(demoLeads.phoneE164, d.phoneE164))
        .limit(1);
      existing = byPhone;
    }

    if (!existing && d.email) {
      const [byEmail] = await db
        .select({
          id: demoLeads.id,
          phoneE164: demoLeads.phoneE164,
          email: demoLeads.email,
          name: demoLeads.name,
          notes: demoLeads.notes,
          closed: demoLeads.closed,
          source: demoLeads.source,
          emailConsent: demoLeads.emailConsent,
          smsConsent: demoLeads.smsConsent,
          transcript: demoLeads.transcript,
          conversationId: demoLeads.conversationId,
          pagePath: demoLeads.pagePath,
        })
        .from(demoLeads)
        .where(sql`lower(btrim(coalesce(${demoLeads.email}, ''))) = ${d.email}`)
        .limit(1);
      existing = byEmail;
    }

    const name = preferExisting(d.name, existing?.name);
    const email = preferExisting(d.email, existing?.email);
    const phone = preferExisting(d.phoneE164, existing?.phoneE164);
    const transcript = clipTranscript(d.transcript, existing?.transcript);
    const notesBits = [
      existing?.notes?.trim() || '',
      d.transcript ? 'site-chat' : '',
    ].filter(Boolean);
    const notes = notesBits.join(' · ').slice(0, 500) || null;
    const conversationId = d.conversationId || existing?.conversationId || null;
    const pagePath = d.pagePath || existing?.pagePath || null;
    const emailConsent = d.emailConsent || Boolean(existing?.emailConsent);
    const smsConsent = d.smsConsent || Boolean(existing?.smsConsent);
    const source = existing?.source === 'call_me' ? 'call_me' : 'site_chat';

    if (existing) {
      await db
        .update(demoLeads)
        .set({
          name,
          email,
          phoneE164: phone,
          emailConsent,
          smsConsent,
          transcript,
          conversationId,
          pagePath,
          notes,
          source,
          closed: existing.closed,
          updatedAt: new Date(),
        })
        .where(eq(demoLeads.id, existing.id));
      params.log?.info({ leadId: existing.id, source }, 'Site-chat lead updated');
      return { id: existing.id };
    }

    const [inserted] = await db
      .insert(demoLeads)
      .values({
        phoneE164: phone,
        email,
        name,
        source: 'site_chat',
        emailConsent,
        smsConsent,
        transcript,
        conversationId,
        pagePath,
        notes,
        language: 'en',
        voice: 'aurora',
        closed: false,
      })
      .returning({ id: demoLeads.id });

    if (!inserted?.id) return null;
    params.log?.info({ leadId: inserted.id, source: 'site_chat' }, 'Site-chat lead persisted');
    return { id: inserted.id };
  } catch (err) {
    params.log?.warn({ err }, 'Site-chat lead persist failed');
    return null;
  }
}

/** Merge a chat transcript onto an already-known conversation row. Never throws. */
export function attachSiteChatTranscript(params: {
  conversationId: string;
  transcript: string;
  log?: DemoCallMeBootLog;
}): void {
  const conversationId = params.conversationId.trim();
  const transcript = params.transcript.trim().slice(0, 4000);
  if (!conversationId || !transcript) return;
  void (async () => {
    try {
      const [row] = await db
        .select({ id: demoLeads.id, transcript: demoLeads.transcript })
        .from(demoLeads)
        .where(eq(demoLeads.conversationId, conversationId))
        .limit(1);
      if (!row) return;
      await db
        .update(demoLeads)
        .set({
          transcript: clipTranscript(transcript, row.transcript),
          updatedAt: new Date(),
        })
        .where(eq(demoLeads.id, row.id));
    } catch (err) {
      params.log?.warn({ err, conversationId }, 'Site-chat transcript attach failed');
    }
  })();
}
