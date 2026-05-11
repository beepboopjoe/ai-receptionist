// ============================================================
// Dev seed — creates one tenant per vertical with realistic
// mock data so a fresh local DB is immediately useful.
//
// Run via:
//   pnpm --filter @ai-receptionist/api seed
//
// Idempotent: re-running upserts by slug, so it's safe to call
// repeatedly.
// ============================================================
import bcrypt from 'bcryptjs';
import { db } from './client.js';
import {
  tenants,
  tenantSettings,
  adminUsers,
  contacts,
  appointments,
  calls,
  escalations,
} from './schema.js';
import { eq } from 'drizzle-orm';
import { VERTICAL_VALUES, type Vertical } from '@ai-receptionist/shared';
import { getOverlay } from '../mocks/vertical-overlays.js';
import { closeDb } from './client.js';

interface SeedTenant {
  vertical: Vertical;
  name: string;
  slug: string;
}

const SEED_TENANTS: SeedTenant[] = [
  { vertical: 'dental',        name: 'Riverside Dental Group',   slug: 'riverside-dental' },
  { vertical: 'insurance',     name: 'Apex Insurance Group',     slug: 'apex-insurance' },
  { vertical: 'legal',         name: 'Smith & Associates Law',   slug: 'smith-associates' },
  { vertical: 'real_estate',   name: 'Horizon Realty Group',     slug: 'horizon-realty' },
  { vertical: 'home_services', name: 'ProFix Home Services',     slug: 'profix-services' },
  { vertical: 'generic',       name: 'Demo Business',            slug: 'demo-business' },
];

const FIRST_NAMES = ['Sarah', 'Michael', 'Emma', 'David', 'Olivia', 'James', 'Sophia', 'Daniel'];
const LAST_NAMES  = ['Johnson', 'Williams', 'Brown', 'Garcia', 'Miller', 'Davis', 'Lopez', 'Wilson'];

function phoneFor(seed: number): string {
  const base = 6265551000 + seed * 7;
  return `+1${base}`;
}

async function upsertTenant(t: SeedTenant): Promise<string> {
  const [existing] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, t.slug)).limit(1);
  if (existing) {
    await db.update(tenants).set({ vertical: t.vertical, name: t.name }).where(eq(tenants.id, existing.id));
    return existing.id;
  }
  const [created] = await db
    .insert(tenants)
    .values({
      name: t.name,
      slug: t.slug,
      plan: 'growth',
      vertical: t.vertical,
      timezone: 'America/New_York',
      isActive: true,
      onboardingStep: 5,
    })
    .returning({ id: tenants.id });
  return created.id;
}

async function ensureOwner(tenantId: string, slug: string): Promise<void> {
  const email = `owner@${slug}.example.com`;
  const [existing] = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  if (existing) return;
  const passwordHash = await bcrypt.hash('demo1234', 10);
  await db.insert(adminUsers).values({
    tenantId, email, passwordHash, role: 'owner', firstName: 'Demo', lastName: 'Owner',
  });
}

async function ensureSettings(tenantId: string, vertical: Vertical): Promise<void> {
  const overlay = getOverlay(vertical);
  const [existing] = await db.select({ id: tenantSettings.id }).from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
  const apptTypes = overlay.apptTypes.map((name, i) => ({
    id: name.toLowerCase().replace(/\W+/g, '_'),
    name,
    duration_min: 30 + (i % 3) * 15,
    buffer_min: 10,
  }));
  const officeHours = {
    monday:    { open: true,  start: '09:00', end: '17:00' },
    tuesday:   { open: true,  start: '09:00', end: '17:00' },
    wednesday: { open: true,  start: '09:00', end: '17:00' },
    thursday:  { open: true,  start: '09:00', end: '17:00' },
    friday:    { open: true,  start: '09:00', end: '17:00' },
    saturday:  { open: false, start: '09:00', end: '13:00' },
    sunday:    { open: false, start: '09:00', end: '13:00' },
  };
  if (existing) {
    await db.update(tenantSettings)
      .set({ appointmentTypes: apptTypes as any, officeHours: officeHours as any })
      .where(eq(tenantSettings.tenantId, tenantId));
  } else {
    await db.insert(tenantSettings).values({
      tenantId, appointmentTypes: apptTypes as any, officeHours: officeHours as any,
    });
  }
}

async function seedContacts(tenantId: string, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const last = LAST_NAMES[i % LAST_NAMES.length]!;
    const phone = phoneFor(i);
    const [created] = await db.insert(contacts)
      .values({
        tenantId,
        firstName: first,
        lastName: last,
        phoneE164: phone,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
        contactType: i % 5 === 0 ? 'new' : 'existing',
      })
      .onConflictDoNothing()
      .returning({ id: contacts.id });
    if (created) ids.push(created.id);
  }
  return ids;
}

async function seedActivity(tenantId: string, vertical: Vertical, contactIds: string[]): Promise<void> {
  if (contactIds.length === 0) return;
  const overlay = getOverlay(vertical);
  const now = Date.now();

  // 5 recent calls
  for (let i = 0; i < 5; i++) {
    const contactId = contactIds[i % contactIds.length]!;
    const startedAt = new Date(now - i * 3_600_000);
    await db.insert(calls).values({
      tenantId,
      contactId,
      rcCallId: `seed_call_${tenantId}_${i}`,
      direction: 'inbound',
      fromNumber: phoneFor(i),
      toNumber: '+16265170214',
      status: 'completed',
      startedAt,
      endedAt: new Date(startedAt.getTime() + 90_000),
      durationSeconds: 90 + i * 30,
      summary: overlay.callReasons[i % overlay.callReasons.length]!,
      outcome: i % 3 === 0 ? 'booked' : 'completed',
    }).onConflictDoNothing();
  }

  // 3 upcoming appointments
  for (let i = 0; i < 3; i++) {
    const contactId = contactIds[i % contactIds.length]!;
    const startsAt = new Date(now + (i + 1) * 86_400_000);
    await db.insert(appointments).values({
      tenantId,
      contactId,
      calendarProvider: 'google',
      appointmentType: overlay.apptTypes[i % overlay.apptTypes.length]!,
      providerName: overlay.providerNames[i % overlay.providerNames.length]!,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3_600_000),
      durationMinutes: 60,
      status: 'confirmed',
    });
  }

  // 1 open escalation
  await db.insert(escalations).values({
    tenantId,
    contactId: contactIds[0]!,
    reason: overlay.escalationReasons[0]!,
    priority: 'normal',
    status: 'open',
  });
}

async function main(): Promise<void> {
  console.log(`🌱 Seeding ${SEED_TENANTS.length} tenants (one per vertical)…`);

  for (const t of SEED_TENANTS) {
    const tenantId = await upsertTenant(t);
    await ensureOwner(tenantId, t.slug);
    await ensureSettings(tenantId, t.vertical);
    const contactIds = await seedContacts(tenantId, 8);
    await seedActivity(tenantId, t.vertical, contactIds);
    console.log(`  ✓ ${t.vertical.padEnd(14)} → ${t.name}  (login: owner@${t.slug}.example.com / demo1234)`);
  }

  console.log('\n✅ Seed complete. Verticals included:', VERTICAL_VALUES.join(', '));
  await closeDb();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
