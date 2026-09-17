// ============================================================
// Paste-URL go-live: scrape a public site, extract facts, write
// them into business_context (and KB when the plan allows).
// Scrape/extract failures are skippable — never block go-live.
// ============================================================
import { getSettings, getTenantInfo, updateOfficeHours, updateSettings, updateTenantProfile } from '../admin/settings.service.js';
import { planAllowsKb } from '../knowledge-base/kb-plan.js';
import { uploadDocument } from '../knowledge-base/kb.service.js';
import { scrapeWebsite } from './website-import.scrape.js';
import { refineFactsWithLlm } from './website-import.extract.js';
import {
  factsHaveContent,
  formatFactsAsContext,
  hasWebsiteImportBlock,
  heuristicExtract,
  mergeWebsiteImportBlock,
  normalizeWebsiteUrl,
  officeHoursAreEmpty,
  parseManualFacts,
  parseOfficeHoursFromText,
  type WebsiteFacts,
} from './website-import.helpers.js';

export interface WebsiteImportOk {
  ok: true;
  skipped: false;
  facts: WebsiteFacts;
  businessContext: string;
  hoursApplied: boolean;
  kbDocumentId: string | null;
  pagesUsed: number;
}

export interface WebsiteImportSkip {
  ok: false;
  skipped: true;
  canSkip: true;
  reason: 'invalid_url' | 'scrape_failed' | 'empty_site';
  message: string;
}

export type WebsiteImportResult = WebsiteImportOk | WebsiteImportSkip;

export async function importWebsiteForTenant(
  tenantId: string,
  rawUrl: unknown,
  uploadedBy: string | null = null,
): Promise<WebsiteImportResult> {
  const normalized = normalizeWebsiteUrl(rawUrl);
  if (!normalized.ok) {
    return {
      ok: false,
      skipped: true,
      canSkip: true,
      reason: 'invalid_url',
      message: normalized.message,
    };
  }

  const scraped = await scrapeWebsite(normalized.href, normalized.hostname);
  if (!scraped.ok) {
    return {
      ok: false,
      skipped: true,
      canSkip: true,
      reason: scraped.reason === 'empty' ? 'empty_site' : 'scrape_failed',
      message:
        scraped.reason === 'empty'
          ? 'We opened the site but could not read useful text. Type a few facts instead, or skip.'
          : 'We could not read that website. Type a few facts instead, or skip — you can add this later.',
    };
  }

  const heuristic = heuristicExtract(scraped.pages, normalized.href);
  const facts = await refineFactsWithLlm(scraped.pages, heuristic);
  if (!factsHaveContent(facts)) {
    return {
      ok: false,
      skipped: true,
      canSkip: true,
      reason: 'empty_site',
      message: 'We could not find services, hours, or a location on that site. Type a few facts, or skip.',
    };
  }

  return persistFacts(tenantId, facts, uploadedBy, scraped.pages.length);
}

export async function saveManualFactsForTenant(
  tenantId: string,
  body: unknown,
  uploadedBy: string | null = null,
): Promise<WebsiteImportResult> {
  const facts = parseManualFacts(body);
  if (!factsHaveContent(facts)) {
    return {
      ok: false,
      skipped: true,
      canSkip: true,
      reason: 'empty_site',
      message: 'Add a service, hours, location, or a short note — or skip and come back later.',
    };
  }
  return persistFacts(tenantId, facts, uploadedBy, 0);
}

export async function getSetupKnowledgeStatus(tenantId: string): Promise<{
  hasWebsiteImport: boolean;
  hasBusinessContext: boolean;
  inboundRoutingMode: string;
  transferNumber: string | null;
}> {
  try {
    const settings = await getSettings(tenantId);
    const ctx = String(settings.businessContext ?? '');
    return {
      hasWebsiteImport: hasWebsiteImportBlock(ctx),
      hasBusinessContext: ctx.trim().length > 20,
      inboundRoutingMode: String(settings.inboundRoutingMode ?? 'ai_always'),
      transferNumber: settings.transferNumber ?? null,
    };
  } catch {
    return {
      hasWebsiteImport: false,
      hasBusinessContext: false,
      inboundRoutingMode: 'ai_always',
      transferNumber: null,
    };
  }
}

async function persistFacts(
  tenantId: string,
  facts: WebsiteFacts,
  uploadedBy: string | null,
  pagesUsed: number,
): Promise<WebsiteImportOk> {
  let existing = '';
  let currentHours: unknown = {};
  try {
    const settings = await getSettings(tenantId);
    existing = String(settings.businessContext ?? '');
    currentHours = settings.officeHours;
  } catch {
    existing = '';
  }
  const businessContext = mergeWebsiteImportBlock(existing, facts);
  await updateSettings(tenantId, { businessContext });

  if (facts.businessName.trim()) {
    try {
      const tenant = await getTenantInfo(tenantId);
      const currentName = String(tenant.name ?? '').trim();
      if (!currentName || /^my business$/i.test(currentName) || currentName.length < 3) {
        await updateTenantProfile(tenantId, { name: facts.businessName.trim() });
      }
    } catch {
      /* name is optional */
    }
  }

  let hoursApplied = false;
  const parsedHours = facts.hours ? parseOfficeHoursFromText(facts.hours) : null;
  if (parsedHours && officeHoursAreEmpty(currentHours)) {
    try {
      await updateOfficeHours(tenantId, parsedHours);
      hoursApplied = true;
    } catch {
      hoursApplied = false;
    }
  }

  let kbDocumentId: string | null = null;
  try {
    const tenant = await getTenantInfo(tenantId);
    if (planAllowsKb(tenant.plan)) {
      const text = `Website import\n${facts.sourceUrl ? `Source: ${facts.sourceUrl}\n\n` : ''}${formatFactsAsContext(facts)}\n`;
      const doc = await uploadDocument(
        tenantId,
        {
          filename: 'website-import.txt',
          mimetype: 'text/plain',
          buffer: Buffer.from(text, 'utf8'),
        },
        uploadedBy,
      );
      kbDocumentId = doc.id;
    }
  } catch {
    kbDocumentId = null;
  }

  return {
    ok: true,
    skipped: false,
    facts,
    businessContext,
    hoursApplied,
    kbDocumentId,
    pagesUsed,
  };
}
