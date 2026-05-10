// ============================================================
// Smoke tests for the Vertical helpers in @ai-receptionist/shared.
// These guard against drift between the canonical list and the
// places that consume it (vertical-prompts, vertical-overlays,
// settings.service, admin/router, DB CHECK constraint).
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  VERTICAL_VALUES,
  isVertical,
  asVertical,
  type Vertical,
} from '@ai-receptionist/shared';
import { getOverlay } from '../mocks/vertical-overlays.js';

describe('VERTICAL_VALUES', () => {
  it('contains exactly the six supported verticals in canonical order', () => {
    expect(VERTICAL_VALUES).toEqual([
      'dental',
      'insurance',
      'legal',
      'real_estate',
      'home_services',
      'generic',
    ]);
  });
});

describe('isVertical', () => {
  it.each(VERTICAL_VALUES)('accepts %s', (v) => {
    expect(isVertical(v)).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(isVertical('dental_practice')).toBe(false);
    expect(isVertical('')).toBe(false);
    expect(isVertical(null)).toBe(false);
    expect(isVertical(undefined)).toBe(false);
    expect(isVertical(42)).toBe(false);
    expect(isVertical({})).toBe(false);
  });
});

describe('asVertical', () => {
  it('returns the value when valid', () => {
    expect(asVertical('legal')).toBe('legal');
  });
  it('falls back to generic for unknown values', () => {
    expect(asVertical('foo')).toBe('generic');
  });
  it('honors a custom fallback', () => {
    expect(asVertical(null, 'dental')).toBe('dental');
  });
});

describe('getOverlay', () => {
  it.each(VERTICAL_VALUES)('returns a complete overlay for %s', (v: Vertical) => {
    const overlay = getOverlay(v);
    expect(overlay).toBeDefined();
    // Every vertical must define at least one entry per array so consumers
    // can index into them safely without bounds checks.
    expect(overlay.apptTypes.length).toBeGreaterThan(0);
    expect(overlay.callReasons.length).toBeGreaterThan(0);
    expect(overlay.providerNames.length).toBeGreaterThan(0);
    expect(overlay.escalationReasons.length).toBeGreaterThan(0);
    expect(overlay.campaignNames.length).toBeGreaterThan(0);
    expect(overlay.notificationBodies.reminder).toBeTruthy();
    expect(overlay.notificationBodies.confirmation).toBeTruthy();
  });

  it('falls back to generic for unknown vertical', () => {
    const fallback = getOverlay('not-a-real-vertical');
    const generic = getOverlay('generic');
    expect(fallback).toEqual(generic);
  });
});
