// ============================================================
// Office-hours helpers — always-open + demo skip + dual key shapes.
// ============================================================
import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import {
  hasAlwaysOpenStreamHours,
  isAfterHoursCall,
  isAlwaysOpenWindow,
  isOutsideHours,
  lookupTodayHours,
} from '../modules/telephony/office-hours.js';
import { DEMO_OFFICE_HOURS } from '../modules/public-api/ensure-demo-tenant.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'America/New_York';

describe('isAlwaysOpenWindow', () => {
  it('treats 00:00–23:59 and 00:00–24:00 as always open', () => {
    expect(isAlwaysOpenWindow('00:00', '23:59')).toBe(true);
    expect(isAlwaysOpenWindow('00:00', '24:00')).toBe(true);
    expect(isAlwaysOpenWindow('08:00', '17:00')).toBe(false);
    expect(isAlwaysOpenWindow('00:00', '17:00')).toBe(false);
  });
});

describe('isOutsideHours', () => {
  it('is never outside a 24/7 window, including 11:59 PM', () => {
    const late = dayjs.tz('2026-09-08 23:59', TZ);
    expect(isOutsideHours(late, '00:00', '23:59')).toBe(false);
    expect(isOutsideHours(late, '00:00', '24:00')).toBe(false);
  });

  it('flags evenings against a 9–5 window', () => {
    const evening = dayjs.tz('2026-09-08 19:30', TZ);
    expect(isOutsideHours(evening, '09:00', '17:00')).toBe(true);
    const morning = dayjs.tz('2026-09-08 10:00', TZ);
    expect(isOutsideHours(morning, '09:00', '17:00')).toBe(false);
  });
});

describe('lookupTodayHours', () => {
  it('reads media-stream mon/open/close keys', () => {
    expect(lookupTodayHours({ mon: { open: '08:00', close: '17:00' } }, 'mon')).toEqual({
      open: '08:00',
      close: '17:00',
    });
  });

  it('falls back to dashboard monday/{start,end} keys', () => {
    expect(
      lookupTodayHours({ monday: { open: true, start: '09:00', end: '17:00' } } as never, 'mon'),
    ).toEqual({ open: '09:00', close: '17:00' });
  });

  it('treats dashboard open:false as closed', () => {
    expect(
      lookupTodayHours({ saturday: { open: false, start: '09:00', end: '13:00' } } as never, 'sat'),
    ).toBeNull();
  });
});

describe('isAfterHoursCall', () => {
  it('never fires for demo, even with empty hours on a Sunday night', () => {
    const sundayNight = dayjs.tz('2026-09-06 22:15', TZ);
    expect(
      isAfterHoursCall({
        now: sundayNight,
        officeHours: {},
        dayKey: 'sun',
        isDemo: true,
      }),
    ).toBe(false);
  });

  it('treats a configured holiday as after hours even during weekday hours', () => {
    const christmas = dayjs.tz('2026-12-25 10:00', TZ);
    expect(
      isAfterHoursCall({
        now: christmas,
        officeHours: {
          fri: { open: '09:00', close: '17:00' },
          holidays: ['2026-12-25'],
        },
        dayKey: 'fri',
      }),
    ).toBe(true);
  });

  it('fires for a paying tenant with weekday-only 9–5 hours on Sunday', () => {
    const sundayNight = dayjs.tz('2026-09-06 22:15', TZ);
    expect(
      isAfterHoursCall({
        now: sundayNight,
        officeHours: {
          mon: { open: '09:00', close: '17:00' },
          fri: { open: '09:00', close: '17:00' },
        },
        dayKey: 'sun',
      }),
    ).toBe(true);
  });

  it('stays open for DEMO_OFFICE_HOURS any day', () => {
    const sundayNight = dayjs.tz('2026-09-06 22:15', TZ);
    expect(
      isAfterHoursCall({
        now: sundayNight,
        officeHours: DEMO_OFFICE_HOURS,
        dayKey: 'sun',
      }),
    ).toBe(false);
  });
});

describe('hasAlwaysOpenStreamHours', () => {
  it('accepts DEMO_OFFICE_HOURS and rejects weekday-only 9–5', () => {
    expect(hasAlwaysOpenStreamHours(DEMO_OFFICE_HOURS)).toBe(true);
    expect(
      hasAlwaysOpenStreamHours({
        mon: { open: '08:00', close: '17:00' },
        tue: { open: '08:00', close: '17:00' },
        wed: { open: '08:00', close: '17:00' },
        thu: { open: '08:00', close: '17:00' },
        fri: { open: '08:00', close: '16:00' },
      }),
    ).toBe(false);
  });
});
