// ============================================================
// Knowledge Base plan gate — growth rejected, business allowed.
// Pure helpers + source scan. No DB / OpenAI / queue.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ForbiddenError } from '../../lib/errors.js';
import {
  planAllowsKb,
  assertKbAllowed,
  getQuotaForPlan,
  KB_PLAN_REQUIRED_MESSAGE,
  KB_BUSINESS_DEFAULT_QUOTA,
} from './kb-plan.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('planAllowsKb', () => {
  it('rejects trial, growth, scale, starter, and unknown plans', () => {
    expect(planAllowsKb('trial')).toBe(false);
    expect(planAllowsKb('growth')).toBe(false);
    expect(planAllowsKb('scale')).toBe(false);
    expect(planAllowsKb('starter')).toBe(false);
    expect(planAllowsKb('payg')).toBe(false);
    expect(planAllowsKb('')).toBe(false);
  });

  it('allows business and enterprise', () => {
    expect(planAllowsKb('business')).toBe(true);
    expect(planAllowsKb('enterprise')).toBe(true);
  });
});

describe('assertKbAllowed', () => {
  it('rejects growth with a 403 Business-plan message', () => {
    expect(() => assertKbAllowed('growth')).toThrow(ForbiddenError);
    try {
      assertKbAllowed('growth');
      expect.fail('expected ForbiddenError');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      const forbidden = err as ForbiddenError;
      expect(forbidden.statusCode).toBe(403);
      expect(forbidden.message).toBe(KB_PLAN_REQUIRED_MESSAGE);
    }
  });

  it('allows business (and enterprise) without throwing', () => {
    expect(() => assertKbAllowed('business')).not.toThrow();
    expect(() => assertKbAllowed('enterprise')).not.toThrow();
  });
});

describe('getQuotaForPlan', () => {
  it('is zero docs/bytes for lower plans', () => {
    for (const plan of ['trial', 'growth', 'scale', 'starter', 'unknown']) {
      expect(getQuotaForPlan(plan)).toEqual({ docs: 0, bytes: 0 });
    }
  });

  it('keeps Scale-tier-ish quotas for business and enterprise', () => {
    expect(getQuotaForPlan('business').docs).toBe(KB_BUSINESS_DEFAULT_QUOTA.docs);
    expect(getQuotaForPlan('business').bytes).toBe(KB_BUSINESS_DEFAULT_QUOTA.bytes);
    expect(getQuotaForPlan('enterprise')).toEqual(getQuotaForPlan('business'));
    expect(getQuotaForPlan('business').docs).toBeGreaterThan(0);
    expect(getQuotaForPlan('business').bytes).toBeGreaterThan(0);
  });
});

describe('kb mutate paths enforce the plan gate', () => {
  it('uploadDocument and reprocessDocument call assertKbAllowed', () => {
    const src = readFileSync(join(here, 'kb.service.ts'), 'utf8');
    expect(src).toMatch(/assertKbAllowed\(plan\)/);
    expect(src).toContain('export async function uploadDocument');
    expect(src).toContain('export async function reprocessDocument');
    const uploadIdx = src.indexOf('export async function uploadDocument');
    const reprocessIdx = src.indexOf('export async function reprocessDocument');
    expect(src.slice(uploadIdx, uploadIdx + 800)).toContain('assertKbAllowed(plan)');
    expect(src.slice(reprocessIdx, reprocessIdx + 600)).toContain('assertKbAllowed(plan)');
  });

  it('router upload/reprocess check available before mutating', () => {
    const src = readFileSync(join(here, 'kb.router.ts'), 'utf8');
    expect(src).toContain('assertKbAllowed');
    expect(src).toMatch(/assertKbAllowed\(usage\.plan\)/);
  });

  it('does not gate retrieveRelevantChunks (empty KB must not break calls)', () => {
    const src = readFileSync(join(here, 'kb.service.ts'), 'utf8');
    const idx = src.indexOf('export async function retrieveRelevantChunks');
    expect(idx).toBeGreaterThan(-1);
    expect(src.slice(idx, idx + 900)).not.toContain('assertKbAllowed');
  });

  it('config defaults lower-plan KB limits to 0', () => {
    const src = readFileSync(join(here, '../../config.ts'), 'utf8');
    expect(src).toContain('KB_DOC_LIMIT_STARTER: z.coerce.number().int().min(0).default(0)');
    expect(src).toContain('KB_DOC_LIMIT_GROWTH:  z.coerce.number().int().min(0).default(0)');
    expect(src).toContain('KB_DOC_LIMIT_TRIAL: z.coerce.number().int().min(0).default(0)');
    expect(src).toContain('KB_BYTES_LIMIT_STARTER: z.coerce.number().int().min(0).default(0)');
    expect(src).toContain('KB_BYTES_LIMIT_GROWTH:  z.coerce.number().int().min(0).default(0)');
    expect(src).toContain('KB_BYTES_LIMIT_TRIAL: z.coerce.number().int().min(0).default(0)');
    expect(src).toContain('KB_DOC_LIMIT_SCALE:   z.coerce.number().int().min(0).default(500)');
  });
});
