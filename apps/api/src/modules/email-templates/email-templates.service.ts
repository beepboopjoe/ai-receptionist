// ============================================================
// Email Templates service (Phase 26c-1).
//
// Tenant-scoped CRUD + render + seed for the email_templates table.
// Rendering does mustache-style {{variable}} substitution from a
// payload object; missing variables render as empty strings (intentional —
// templates should degrade gracefully when an event payload is partial).
//
// Phase 26c-1 (this file): CRUD + render + manual test-send + seed defaults.
// Phase 26c-2 (follow-up):  wire event-based auto-send from the workflow
//                            engine via a renderAndSendForEvent() helper.
// ============================================================
import { db } from '../../db/client.js';
import { emailTemplates, type EmailTemplate, type NewEmailTemplate } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { sendEmail } from '../notifications/adapters/email.adapter.js';
import { LEGAL_DEFAULT_TEMPLATES } from './legal-default-templates.js';

// ---- CRUD ------------------------------------------------------

export async function listTemplates(tenantId: string): Promise<EmailTemplate[]> {
  return db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.tenantId, tenantId))
    .orderBy(emailTemplates.triggerEvent);
}

export async function getTemplate(tenantId: string, id: string): Promise<EmailTemplate> {
  const [row] = await db
    .select()
    .from(emailTemplates)
    .where(and(eq(emailTemplates.tenantId, tenantId), eq(emailTemplates.id, id)))
    .limit(1);
  if (!row) throw new NotFoundError('Email template not found');
  return row;
}

export interface CreateTemplateInput {
  triggerEvent: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyVariables?: string[];
  vertical?: string | null;
  enabled?: boolean;
}

export async function createTemplate(
  tenantId: string,
  input: CreateTemplateInput
): Promise<EmailTemplate> {
  validateInput(input);
  const row: NewEmailTemplate = {
    tenantId,
    triggerEvent: input.triggerEvent.trim(),
    name: input.name.trim(),
    subject: input.subject,
    bodyHtml: input.bodyHtml,
    bodyVariables: input.bodyVariables ?? [],
    vertical: input.vertical ?? null,
    enabled: input.enabled ?? true,
  };
  const [created] = await db.insert(emailTemplates).values(row).returning();
  if (!created) throw new Error('Insert returned no row');
  return created;
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>;

export async function updateTemplate(
  tenantId: string,
  id: string,
  patch: UpdateTemplateInput
): Promise<EmailTemplate> {
  // Ensure existence + tenant ownership before update.
  await getTemplate(tenantId, id);
  const update: Partial<NewEmailTemplate> = { updatedAt: new Date() };
  if (patch.triggerEvent !== undefined) update.triggerEvent = patch.triggerEvent.trim();
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.subject !== undefined) update.subject = patch.subject;
  if (patch.bodyHtml !== undefined) update.bodyHtml = patch.bodyHtml;
  if (patch.bodyVariables !== undefined) update.bodyVariables = patch.bodyVariables;
  if (patch.vertical !== undefined) update.vertical = patch.vertical;
  if (patch.enabled !== undefined) update.enabled = patch.enabled;
  const [updated] = await db
    .update(emailTemplates)
    .set(update)
    .where(and(eq(emailTemplates.tenantId, tenantId), eq(emailTemplates.id, id)))
    .returning();
  if (!updated) throw new NotFoundError('Email template not found');
  return updated;
}

export async function deleteTemplate(tenantId: string, id: string): Promise<void> {
  const result = await db
    .delete(emailTemplates)
    .where(and(eq(emailTemplates.tenantId, tenantId), eq(emailTemplates.id, id)));
  // Drizzle's pg driver doesn't return rowCount on .delete reliably across versions;
  // we do an existence check above for safety in update, but for delete a no-op is OK.
  void result;
}

// ---- Render -----------------------------------------------------

/**
 * Mustache-style render. `{{foo.bar}}` paths are supported via dot-notation
 * traversal on the vars object. Missing values render as empty strings.
 *
 * Deliberately tiny implementation — no helpers, no conditionals, no loops.
 * If a tenant needs Handlebars-grade templating we'll graduate; this covers
 * 95% of "Hi {{contact.firstName}}, your case is {{matter.status}}" usage.
 */
export function renderTemplate(
  template: { subject: string; bodyHtml: string },
  vars: Record<string, unknown>
): { subject: string; bodyHtml: string } {
  return {
    subject: substitute(template.subject, vars),
    bodyHtml: substitute(template.bodyHtml, vars),
  };
}

function substitute(s: string, vars: Record<string, unknown>): string {
  return s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const value = path.split('.').reduce<unknown>((acc, key) => {
      if (acc == null || typeof acc !== 'object') return undefined;
      return (acc as Record<string, unknown>)[key];
    }, vars as unknown);
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

// ---- Test send --------------------------------------------------

/**
 * Render the template against a sample vars payload and email it to the
 * supplied address. Used by the dashboard's "Send test" button so the
 * tenant owner can preview an actual email in their own inbox before
 * the template fires for real.
 */
export async function testSend(
  tenantId: string,
  templateId: string,
  to: string,
  vars: Record<string, unknown> = {}
): Promise<void> {
  if (!to || !to.includes('@')) {
    throw new ValidationError('A valid recipient email is required');
  }
  const template = await getTemplate(tenantId, templateId);
  const rendered = renderTemplate(template, vars);
  // Prefix subject so the recipient knows this is a preview, not a live event.
  await sendEmail({
    to,
    subject: `[TEST] ${rendered.subject}`,
    html: rendered.bodyHtml,
  });
}

// ---- Seed defaults ----------------------------------------------

/**
 * Load the vertical's default template set for a tenant. Skips any template
 * whose (tenant, trigger_event, name) already exists so re-running is safe.
 *
 * Called manually from the dashboard's "Restore defaults" button. Future
 * auto-call on tenant onboarding for legal-vertical signups is a small follow-up.
 */
export async function seedDefaults(
  tenantId: string,
  vertical: string | null
): Promise<{ created: number; skipped: number }> {
  const set = vertical === 'legal' ? LEGAL_DEFAULT_TEMPLATES : [];
  if (set.length === 0) return { created: 0, skipped: 0 };

  const existing = await db
    .select({
      name: emailTemplates.name,
      triggerEvent: emailTemplates.triggerEvent,
    })
    .from(emailTemplates)
    .where(eq(emailTemplates.tenantId, tenantId));
  const existingKeys = new Set(existing.map((r) => `${r.triggerEvent}::${r.name}`));

  let created = 0;
  let skipped = 0;
  for (const t of set) {
    const key = `${t.triggerEvent}::${t.name}`;
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    await db.insert(emailTemplates).values({
      tenantId,
      vertical,
      triggerEvent: t.triggerEvent,
      name: t.name,
      subject: t.subject,
      bodyHtml: t.bodyHtml,
      bodyVariables: t.bodyVariables,
      enabled: true,
    });
    created += 1;
  }
  return { created, skipped };
}

// ---- Input validation -------------------------------------------

function validateInput(input: CreateTemplateInput): void {
  if (!input.triggerEvent?.trim()) {
    throw new ValidationError('triggerEvent is required');
  }
  if (!input.name?.trim()) {
    throw new ValidationError('name is required');
  }
  if (!input.subject?.trim()) {
    throw new ValidationError('subject is required');
  }
  if (!input.bodyHtml?.trim()) {
    throw new ValidationError('bodyHtml is required');
  }
}
