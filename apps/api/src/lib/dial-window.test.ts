import { describe, it, expect } from 'vitest';
import { checkDialWindow } from './dial-window.js';

const TZ = 'America/New_York';

// Helper: create a Date for "today at HH:MM" in ET
function etAt(hour: number, minute = 0): Date {
  const d = new Date();
  // Use a fixed date to avoid flakiness
  d.setFullYear(2025, 3, 21); // 2025-04-21 (Monday)
  const isoDate = `2025-04-21T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  // Parse as ET by offsetting — ET is UTC-4 in April (EDT)
  return new Date(isoDate + '-04:00');
}

describe('checkDialWindow', () => {
  it('allows dialling during the window', () => {
    const result = checkDialWindow({
      now: etAt(10, 30), // 10:30 AM ET
      timezone: TZ,
      windowStart: '09:00',
      windowEnd: '17:00',
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks dialling before the window opens', () => {
    const result = checkDialWindow({
      now: etAt(7, 45), // 7:45 AM ET
      timezone: TZ,
      windowStart: '09:00',
      windowEnd: '17:00',
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe('before_window');
      // Should be ~75 minutes until open
      expect(result.msUntilOpen).toBeGreaterThan(0);
      expect(result.msUntilOpen).toBeLessThan(2 * 60 * 60 * 1000); // < 2h
    }
  });

  it('blocks dialling after the window closes', () => {
    const result = checkDialWindow({
      now: etAt(17, 30), // 5:30 PM ET
      timezone: TZ,
      windowStart: '09:00',
      windowEnd: '17:00',
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe('after_window');
      // Next open is tomorrow morning — > 10h away
      expect(result.msUntilOpen).toBeGreaterThan(10 * 60 * 60 * 1000);
    }
  });

  it('blocks dialling exactly at close time', () => {
    const result = checkDialWindow({
      now: etAt(17, 0), // exactly 5:00 PM ET
      timezone: TZ,
      windowStart: '09:00',
      windowEnd: '17:00',
    });
    expect(result.allowed).toBe(false);
  });

  it('handles a narrow window correctly', () => {
    const insideResult = checkDialWindow({
      now: etAt(12, 0),
      timezone: TZ,
      windowStart: '11:00',
      windowEnd: '13:00',
    });
    expect(insideResult.allowed).toBe(true);

    const outsideResult = checkDialWindow({
      now: etAt(10, 59),
      timezone: TZ,
      windowStart: '11:00',
      windowEnd: '13:00',
    });
    expect(outsideResult.allowed).toBe(false);
  });
});
