// ============================================================
// HubSpot contact sync — BullMQ job
// Pulls all HubSpot contacts into the local contacts table,
// and pushes new local contacts (created after lastSyncedAt) back.
// Queued by POST /integrations/hubspot/sync
// ============================================================
import type { Job } from 'bullmq';
import { db } from '../../db/client.js';
import { contacts, integrations } from '../../db/schema.js';
import { eq, and, gt, isNull, or } from 'drizzle-orm';
import { decryptCredentials, encryptCredentials } from '../../lib/encryption.js';
import {
  listContacts,
  createContact as hsCreateContact,
  refreshTokens,
  type HubSpotTokens,
} from '../../modules/crm/adapters/hubspot.adapter.js';
import { normalizePhone } from '../../modules/crm/contact-normalizer.js';

export interface HubSpotSyncJobData {
  tenantId: string;
  integrationId: string;
}

/** Return a valid access token, refreshing if expired */
async function getValidToken(
  integrationId: string,
  creds: HubSpotTokens
): Promise<HubSpotTokens> {
  // Refresh 60 seconds early to avoid races
  if (Date.now() > creds.expires_at - 60_000) {
    const fresh = await refreshTokens(creds.refresh_token);
    // Persist the new tokens
    await db
      .update(integrations)
      .set({ credentials: encryptCredentials({ ...fresh, expires_at: String(fresh.expires_at) }), updatedAt: new Date() })
      .where(eq(integrations.id, integrationId));
    return fresh;
  }
  return creds;
}

export async function processHubSpotSync(job: Job<HubSpotSyncJobData>): Promise<void> {
  const { tenantId, integrationId } = job.data;

  // Load integration row
  const [row] = await db.select().from(integrations).where(eq(integrations.id, integrationId)).limit(1);
  if (!row) throw new Error(`Integration ${integrationId} not found`);

  const rawCreds = decryptCredentials(row.credentials as Record<string, string>);
  let tokens: HubSpotTokens = {
    access_token: rawCreds['access_token'] ?? '',
    refresh_token: rawCreds['refresh_token'] ?? '',
    expires_at: Number(rawCreds['expires_at'] ?? 0),
  };

  tokens = await getValidToken(integrationId, tokens);

  const lastSynced = row.lastSyncedAt;

  // ── 1. Pull HubSpot → local upsert ──────────────────────
  let after: string | undefined;
  let hsContactMap: Map<string, string> = new Map(); // hsId → local contact id (populated after)

  do {
    const page = await listContacts(tokens.access_token, after);
    for (const hs of page.results) {
      const phone = hs.properties.phone ? normalizePhone(hs.properties.phone) : null;
      if (!phone && !hs.properties.email) continue;

      const existing = phone
        ? await db.select({ id: contacts.id })
            .from(contacts)
            .where(and(eq(contacts.tenantId, tenantId), eq(contacts.phoneE164, phone)))
            .limit(1)
        : [];

      if (existing.length > 0) {
        // Update with HubSpot data
        await db
          .update(contacts)
          .set({
            externalCrmId: hs.id,
            email: hs.properties.email ?? undefined,
            updatedAt: new Date(),
          })
          .where(and(eq(contacts.id, existing[0].id), eq(contacts.tenantId, tenantId)));
        hsContactMap.set(hs.id, existing[0].id);
      } else {
        // Insert new contact from HubSpot
        const [created] = await db
          .insert(contacts)
          .values({
            tenantId,
            firstName: hs.properties.firstname ?? 'Unknown',
            lastName: hs.properties.lastname ?? '',
            email: hs.properties.email,
            phoneE164: phone ?? '',
            externalCrmId: hs.id,
            source: 'crm_sync',
            contactType: 'new',
          })
          .returning({ id: contacts.id });
        if (created) hsContactMap.set(hs.id, created.id);
      }
    }
    after = page.paging?.next?.after;
  } while (after);

  // ── 2. Push new local contacts → HubSpot ────────────────
  const whereNewSinceLastSync = and(
    eq(contacts.tenantId, tenantId),
    isNull(contacts.externalCrmId),
    lastSynced ? gt(contacts.createdAt, lastSynced) : undefined
  );

  const newLocals = await db.select().from(contacts).where(whereNewSinceLastSync).limit(200);

  for (const local of newLocals) {
    if (!local.firstName && !local.email) continue;
    try {
      const hs = await hsCreateContact(tokens.access_token, {
        firstname: local.firstName,
        lastname: local.lastName,
        email: local.email ?? undefined,
        phone: local.phoneE164,
      });
      await db
        .update(contacts)
        .set({ externalCrmId: hs.id, updatedAt: new Date() })
        .where(eq(contacts.id, local.id));
    } catch (err) {
      // Log but don't fail the whole sync
      console.error(`[hubspot-sync] Failed to push contact ${local.id}:`, err);
    }
  }

  // ── 3. Mark sync complete ────────────────────────────────
  await db
    .update(integrations)
    .set({ lastSyncedAt: new Date(), status: 'connected', errorMessage: null, updatedAt: new Date() })
    .where(eq(integrations.id, integrationId));

  console.log(`[hubspot-sync] tenant=${tenantId} pulled=${hsContactMap.size} pushed=${newLocals.length}`);
}
