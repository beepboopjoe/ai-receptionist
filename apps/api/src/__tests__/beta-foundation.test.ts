// ============================================================
// Beta foundation: auto-numbers, recordings, live join.
// Pure helpers + source scans — no Telnyx / DB.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isProvisionedE164,
  normalizeUsDid,
  PENDING_PHONE_E164,
} from '../modules/phone-numbers/inbound-did.js';
import { extractTelnyxRecordingMp3Url } from '../modules/telephony/recording.js';
import { getPlan, PLANS } from '@ai-receptionist/shared';
import {
  capConcurrentOutbound,
  planIncludesInboundDid,
  targetPoolSizeForPlan,
} from '../modules/outbound-pool/pool-size.js';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

describe('normalizeUsDid', () => {
  it('passes through E.164 and fills +1 for NANP', () => {
    expect(normalizeUsDid('+14155551234')).toBe('+14155551234');
    expect(normalizeUsDid('4155551234')).toBe('+14155551234');
    expect(normalizeUsDid('14155551234')).toBe('+14155551234');
    expect(normalizeUsDid('(415) 555-1234')).toBe('+14155551234');
  });

  it('treats pending placeholders as not provisioned', () => {
    expect(isProvisionedE164(PENDING_PHONE_E164)).toBe(false);
    expect(isProvisionedE164('+15551234567')).toBe(true);
    expect(isProvisionedE164('')).toBe(false);
  });
});

describe('plan catalog sells minutes + numbers, not concurrent seats', () => {
  it('keeps trial at 1 inbound / 0 outbound and enterprise unlimited', () => {
    expect(getPlan('trial')!.concurrentInbound).toBe(1);
    expect(getPlan('trial')!.concurrentOutbound).toBe(0);
    expect(getPlan('enterprise')!.concurrentInbound).toBe(-1);
    expect(getPlan('enterprise')!.concurrentOutbound).toBe(-1);
  });

  it('uses a high inbound safety ceiling on paid plans (not marketed seats)', () => {
    expect(getPlan('growth')!.concurrentInbound).toBeGreaterThanOrEqual(25);
    expect(getPlan('scale')!.concurrentInbound).toBeGreaterThanOrEqual(50);
    expect(getPlan('business')!.concurrentInbound).toBeGreaterThanOrEqual(50);
  });

  it('does not market concurrent seats on feature bullets', () => {
    for (const plan of PLANS) {
      for (const feature of plan.features) {
        expect(feature.toLowerCase()).not.toMatch(/at the same time|simultaneous calls|concurrent/);
      }
    }
  });

  it('does not change list prices, minute packs, or included numbers', () => {
    expect(getPlan('growth')!.monthlyPrice).toBe(199);
    expect(getPlan('scale')!.monthlyPrice).toBe(399);
    expect(getPlan('business')!.monthlyPrice).toBe(599);
    expect(getPlan('growth')!.monthlyMinutes).toBe(380);
    expect(getPlan('scale')!.monthlyMinutes).toBe(780);
    expect(getPlan('business')!.monthlyMinutes).toBe(1100);
    expect(getPlan('growth')!.includedPhoneNumbers).toBe(2);
    expect(getPlan('scale')!.includedPhoneNumbers).toBe(5);
    expect(getPlan('business')!.includedPhoneNumbers).toBe(10);
  });
});

describe('plan-aware pool sizing', () => {
  it('starts outbound pools from concurrentOutbound, capped at 15', () => {
    expect(targetPoolSizeForPlan('trial')).toBe(0);
    expect(targetPoolSizeForPlan('growth')).toBe(3);
    expect(targetPoolSizeForPlan('scale')).toBe(8);
    expect(targetPoolSizeForPlan('business')).toBe(15);
    expect(targetPoolSizeForPlan('enterprise')).toBe(15);
  });

  it('caps campaign concurrency to the plan', () => {
    expect(capConcurrentOutbound(10, 'growth')).toBe(3);
    expect(capConcurrentOutbound(3, 'scale')).toBe(3);
    expect(capConcurrentOutbound(20, 'business')).toBe(20);
    expect(capConcurrentOutbound(undefined, 'growth')).toBe(3);
  });

  it('only paid plans include a dedicated inbound DID', () => {
    expect(planIncludesInboundDid('trial')).toBe(false);
    expect(planIncludesInboundDid('growth')).toBe(true);
    expect(planIncludesInboundDid('scale')).toBe(true);
  });
});

describe('extractTelnyxRecordingMp3Url', () => {
  it('reads recording_urls.mp3, public_recording_urls, and download_urls', () => {
    expect(
      extractTelnyxRecordingMp3Url({ recording_urls: { mp3: 'https://s3.example/a.mp3' } })
    ).toBe('https://s3.example/a.mp3');
    expect(
      extractTelnyxRecordingMp3Url({ public_recording_urls: { mp3: 'https://cdn.example/b.mp3' } })
    ).toBe('https://cdn.example/b.mp3');
    expect(
      extractTelnyxRecordingMp3Url({ download_urls: { mp3: 'https://api.telnyx.com/v2/recordings/x' } })
    ).toBe('https://api.telnyx.com/v2/recordings/x');
    expect(extractTelnyxRecordingMp3Url({ recording_url: 'https://files.example/c.mp3' })).toBe(
      'https://files.example/c.mp3'
    );
    expect(extractTelnyxRecordingMp3Url({})).toBeNull();
    expect(extractTelnyxRecordingMp3Url(null)).toBeNull();
  });
});

describe('beta foundation wiring (source)', () => {
  it('orders Telnyx numbers onto TELNYX_APP_ID', () => {
    const src = readFileSync(join(srcRoot, 'modules/phone-numbers/telnyx.client.ts'), 'utf8');
    expect(src).toContain('connection_id');
    expect(src).toContain('assignNumberToConnection');
  });

  it('auto-provisions inbound DIDs on activate and paid subscribe', () => {
    const activate = readFileSync(join(srcRoot, 'modules/admin/router.ts'), 'utf8');
    expect(activate).toContain('ensureInboundDid');
    expect(activate).toContain('/onboarding/activate');
    const phones = readFileSync(join(srcRoot, 'modules/phone-numbers/phone.router.ts'), 'utf8');
    expect(phones).toContain('/phone-numbers/:id/retry');
    expect(phones).toContain('/phone-numbers/auto-provision');
    const billing = readFileSync(join(srcRoot, 'modules/billing/billing.service.ts'), 'utf8');
    expect(billing).toContain('ensureInboundDid');
    expect(billing).toContain('ensureOutboundPool');
  });

  it('routes inbound voice by DID instead of the first tenant row', () => {
    const src = readFileSync(join(srcRoot, 'modules/telephony/telnyx-webhook.handler.ts'), 'utf8');
    expect(src).toContain('lookupTenantByDid');
    expect(src).not.toContain('.from(tenants).limit(1)');
    expect(src).toContain('startCallRecording');
    expect(src).toContain('call.recording.saved');
    expect(src).toContain('supervisor_join');
  });

  it('exposes join, takeover, and recording proxy routes', () => {
    const src = readFileSync(join(srcRoot, 'modules/admin/router.ts'), 'utf8');
    expect(src).toContain('/calls/:id/join');
    expect(src).toContain('/calls/:id/takeover');
    expect(src).toContain('/calls/:id/recording');
    expect(src).toContain('initiateLiveJoin');
  });

  it('does not enable DEMO_SKIP_COOLDOWN or auto-redial Joey', () => {
    const demo = readFileSync(join(srcRoot, 'modules/public-api/public-demo.helpers.ts'), 'utf8');
    expect(demo).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
  });
});
