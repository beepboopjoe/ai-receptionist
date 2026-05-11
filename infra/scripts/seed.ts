// ============================================================
// Database Seed Script
// Creates 1 demo tenant with settings, contacts, calls, and admin user
// Usage: pnpm db:seed (from repo root via turbo)
// ============================================================
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import * as schema from '../../apps/api/src/db/schema.js';
import { eq } from 'drizzle-orm';

const DEMO_TENANT_SLUG = 'bright-smile-dental';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const db = drizzle(pool, { schema });

async function seed() {
  console.log('🌱 Seeding database...\n');

  // ---- Tenant ----
  const [existingTenant] = await db
    .select({ id: schema.tenants.id })
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, DEMO_TENANT_SLUG))
    .limit(1);

  let tenantId: string;

  if (existingTenant) {
    tenantId = existingTenant.id;
    console.log(`  ✅ Tenant already exists: ${tenantId}`);
  } else {
    const [tenant] = await db
      .insert(schema.tenants)
      .values({
        name: 'Bright Smile Dental',
        slug: DEMO_TENANT_SLUG,
        plan: 'growth',
        timezone: 'America/New_York',
        isActive: true,
        onboardingStep: 5,
      })
      .returning({ id: schema.tenants.id });

    tenantId = tenant!.id;
    console.log(`  ✅ Created tenant: ${tenantId}`);
  }

  // ---- Tenant Settings ----
  await db
    .insert(schema.tenantSettings)
    .values({
      tenantId,
      officeHours: {
        mon: { open: '08:00', close: '17:00' },
        tue: { open: '08:00', close: '17:00' },
        wed: { open: '08:00', close: '17:00' },
        thu: { open: '08:00', close: '17:00' },
        fri: { open: '08:00', close: '16:00' },
      },
      afterHoursMode: 'voicemail',
      transferNumber: '+15550001234',
      voiceName: 'Ara',
      voiceProvider: 'grok',
      telephonyProvider: 'twilio',
      appointmentTypes: [
        { id: 'cleaning', name: 'Cleaning / Hygiene', durationMin: 60, bufferMin: 10 },
        { id: 'checkup', name: 'Checkup / Exam', durationMin: 30, bufferMin: 10 },
        { id: 'filling', name: 'Filling', durationMin: 60, bufferMin: 15 },
        { id: 'extraction', name: 'Extraction', durationMin: 90, bufferMin: 20 },
        { id: 'root_canal', name: 'Root Canal', durationMin: 120, bufferMin: 20 },
        { id: 'crown', name: 'Crown / Bridge', durationMin: 90, bufferMin: 20 },
        { id: 'consult', name: 'New Patient Consultation', durationMin: 45, bufferMin: 10 },
      ],
      recallIntervalMonths: 6,
    })
    .onConflictDoNothing();
  console.log('  ✅ Tenant settings seeded');

  // ---- Admin User ----
  const passwordHash = await bcrypt.hash('Password123!', 12);
  await db
    .insert(schema.adminUsers)
    .values({
      tenantId,
      email: 'admin@brightsmile.demo',
      passwordHash,
      role: 'owner',
      firstName: 'Demo',
      lastName: 'Admin',
    })
    .onConflictDoNothing();
  console.log('  ✅ Admin user: admin@brightsmile.demo / Password123!');

  // ---- Contacts ----
  const contactsData = [
    {
      firstName: 'Sarah',
      lastName: 'Johnson',
      phoneE164: '+15551110001',
      email: 'sarah.j@example.com',
      dateOfBirth: '1985-03-15',
      contactType: 'existing' as const,
      insuranceProvider: 'Blue Cross',
      recallDueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      source: 'csv_import' as const,
    },
    {
      firstName: 'Michael',
      lastName: 'Chen',
      phoneE164: '+15551110002',
      email: 'mchen@example.com',
      dateOfBirth: '1972-08-22',
      contactType: 'existing' as const,
      insuranceProvider: 'Aetna',
      source: 'csv_import' as const,
    },
    {
      firstName: 'Emily',
      lastName: 'Rodriguez',
      phoneE164: '+15551110003',
      email: 'emily.r@example.com',
      dateOfBirth: '1995-01-08',
      contactType: 'new' as const,
      source: 'call' as const,
    },
  ];

  const insertedContacts: { id: string }[] = [];
  for (const contact of contactsData) {
    const [inserted] = await db
      .insert(schema.contacts)
      .values({ tenantId, ...contact })
      .onConflictDoNothing()
      .returning({ id: schema.contacts.id });
    if (inserted) insertedContacts.push(inserted);
  }
  console.log(`  ✅ ${contactsData.length} contacts seeded`);

  // ---- Sample Calls ----
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  await db
    .insert(schema.calls)
    .values([
      {
        tenantId,
        contactId: insertedContacts[0]?.id,
        rcCallId: 'DEMO_CALL_001',
        direction: 'inbound',
        fromNumber: '+15551110001',
        toNumber: '+15550009999',
        status: 'completed',
        outcome: 'booked',
        workflowTriggered: 'existing_patient',
        startedAt: twoDaysAgo,
        endedAt: new Date(twoDaysAgo.getTime() + 3 * 60 * 1000),
        durationSeconds: 180,
        summary: 'Existing patient Sarah Johnson called to book a cleaning. Appointment booked for next Tuesday at 10am.',
        transcript: [
          { role: 'agent', text: 'Thank you for calling Bright Smile Dental! Is this Sarah?', timestamp: twoDaysAgo.toISOString() },
          { role: 'caller', text: 'Yes, hi, I need to book a cleaning.', timestamp: new Date(twoDaysAgo.getTime() + 5000).toISOString() },
          { role: 'agent', text: "Of course! I have some availability next Tuesday at 10am. Does that work?", timestamp: new Date(twoDaysAgo.getTime() + 10000).toISOString() },
          { role: 'caller', text: 'Yes, perfect!', timestamp: new Date(twoDaysAgo.getTime() + 15000).toISOString() },
        ] as unknown as any,
      },
      {
        tenantId,
        rcCallId: 'DEMO_CALL_002',
        direction: 'inbound',
        fromNumber: '+15551119999',
        toNumber: '+15550009999',
        status: 'missed',
        outcome: 'voicemail',
        startedAt: yesterday,
        endedAt: new Date(yesterday.getTime() + 30 * 1000),
        durationSeconds: 30,
        summary: 'Missed call from unknown number.',
      },
    ])
    .onConflictDoNothing();
  console.log('  ✅ Sample calls seeded');

  console.log('\n🎉 Seed complete!');
  console.log('  Dashboard: http://localhost:3000');
  console.log('  API:       http://localhost:3001');
  console.log('  PgAdmin:   http://localhost:5050 (admin@local.dev / admin)');
  console.log('  Login:     admin@brightsmile.demo / Password123!\n');

  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
