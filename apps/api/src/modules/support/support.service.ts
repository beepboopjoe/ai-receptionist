// ============================================================
// Support ticket service.
//
// Tenants submit support messages from /support which:
//  1. Insert a row in support_tickets
//  2. Fire an email notification to ADMIN_EMAILS (Reply-To set to the
//     submitter so the founder can reply in Gmail and the customer
//     receives it directly)
//  3. Push an activity event so the dashboard's live feed reflects it
//
// Platform admins query / resolve from /platform via the same service.
// ============================================================
import { db } from '../../db/client.js';
import { supportTickets, tenants, adminUsers } from '../../db/schema.js';
import { and, eq, desc } from 'drizzle-orm';
import { sendSupportTicketEmail } from '../notifications/support-ticket-email.js';
import { pushActivity } from '../activity/activity.service.js';
import { NotFoundError } from '../../lib/errors.js';

export type SupportCategory = 'bug' | 'question' | 'billing' | 'feature_request';
export type SupportStatus = 'open' | 'resolved';

export interface CreateSupportTicketInput {
  tenantId: string;
  submittedBy: string;
  submitterEmail: string;
  submitterName: string | null;
  category: SupportCategory;
  subject: string;
  message: string;
}

export async function createSupportTicket(input: CreateSupportTicketInput) {
  const [ticket] = await db
    .insert(supportTickets)
    .values({
      tenantId: input.tenantId,
      submittedBy: input.submittedBy,
      submitterEmail: input.submitterEmail.toLowerCase().trim(),
      submitterName: input.submitterName,
      category: input.category,
      subject: input.subject.trim(),
      message: input.message.trim(),
    })
    .returning();
  if (!ticket) throw new Error('Support ticket insert returned no row');

  // Look up tenant name for the email body. Fire-and-forget — never block.
  void (async () => {
    const [tenantRow] = await db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, input.tenantId))
      .limit(1);
    sendSupportTicketEmail({
      ticketId: ticket.id,
      tenantName: tenantRow?.name ?? 'Unknown tenant',
      submitterEmail: input.submitterEmail,
      submitterName: input.submitterName,
      category: input.category,
      subject: input.subject,
      message: input.message,
    });
  })();

  // Broadcast to the tenant's live activity feed so the dashboard can
  // surface a confirmation badge / sound. Never throws.
  pushActivity(input.tenantId, 'support_ticket_received', {
    ticketId: ticket.id,
    category: input.category,
    subject: input.subject,
  });

  return ticket;
}

export async function listMyTickets(tenantId: string) {
  return db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.tenantId, tenantId))
    .orderBy(desc(supportTickets.createdAt))
    .limit(100);
}

export async function listAllTickets(filter: {
  status?: SupportStatus;
  category?: SupportCategory;
}) {
  const conditions = [];
  if (filter.status) conditions.push(eq(supportTickets.status, filter.status));
  if (filter.category) conditions.push(eq(supportTickets.category, filter.category));

  const baseQuery = db
    .select({
      id: supportTickets.id,
      tenantId: supportTickets.tenantId,
      tenantName: tenants.name,
      submittedBy: supportTickets.submittedBy,
      submitterEmail: supportTickets.submitterEmail,
      submitterName: supportTickets.submitterName,
      category: supportTickets.category,
      subject: supportTickets.subject,
      message: supportTickets.message,
      status: supportTickets.status,
      resolvedAt: supportTickets.resolvedAt,
      resolvedBy: supportTickets.resolvedBy,
      createdAt: supportTickets.createdAt,
    })
    .from(supportTickets)
    .leftJoin(tenants, eq(supportTickets.tenantId, tenants.id));

  const rows = conditions.length > 0
    ? await baseQuery.where(and(...conditions)).orderBy(desc(supportTickets.createdAt)).limit(500)
    : await baseQuery.orderBy(desc(supportTickets.createdAt)).limit(500);

  return rows.map((r) => ({ ...r, tenantName: r.tenantName ?? 'Unknown' }));
}

export async function resolveTicket(id: string, resolvedBy: string) {
  const [updated] = await db
    .update(supportTickets)
    .set({ status: 'resolved', resolvedAt: new Date(), resolvedBy })
    .where(eq(supportTickets.id, id))
    .returning();
  if (!updated) throw new NotFoundError('Support ticket', id);
  return updated;
}

export async function reopenTicket(id: string) {
  const [updated] = await db
    .update(supportTickets)
    .set({ status: 'open', resolvedAt: null, resolvedBy: null })
    .where(eq(supportTickets.id, id))
    .returning();
  if (!updated) throw new NotFoundError('Support ticket', id);
  return updated;
}

/**
 * Reuses the same email body to send to admins on demand — useful when an
 * operator wants to re-trigger the founder notification (e.g. ADMIN_EMAILS
 * was empty when the ticket was first created and got missed).
 */
export { sendSupportTicketEmail };
