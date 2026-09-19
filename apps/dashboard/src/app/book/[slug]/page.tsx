'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ApiError, publicBookingApi, type PublicBookingPage } from '@/lib/api';
import { BRAND_NAME } from '@/lib/brand';

function todayKey(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + days));
  return dt.toISOString().slice(0, 10);
}

function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatWhen(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatClock(hhmm: string): string {
  const [hRaw, mRaw] = hhmm.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${suffix}`;
}

export default function PublicBookingPageView({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const [page, setPage] = useState<PublicBookingPage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [dateKey, setDateKey] = useState('');
  const [slots, setSlots] = useState<Array<{ startAt: string; endAt: string }>>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedStart, setSelectedStart] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    appointmentType: string;
    startsAt: string;
    businessName: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    publicBookingApi
      .getPage(slug)
      .then((data) => {
        if (cancelled) return;
        setPage(data);
        setServiceId(data.services[0]?.id ?? '');
        setDateKey(todayKey(data.timezone));
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError && err.statusCode === 404
          ? 'This booking page could not be found.'
          : 'Could not load this booking page.');
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const dateOptions = useMemo(() => {
    if (!page) return [];
    const start = todayKey(page.timezone);
    const openKeys = new Set(page.hours.filter((h) => !h.closed).map((h) => h.key));
    const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
    const out: Array<{ value: string; label: string }> = [];
    for (let i = 0; i < 21 && out.length < 14; i++) {
      const value = addDays(start, i);
      const utc = new Date(`${value}T12:00:00Z`);
      const key = weekdayKeys[utc.getUTCDay()];
      if (key && openKeys.size > 0 && !openKeys.has(key)) continue;
      out.push({
        value,
        label: utc.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }),
      });
    }
    return out;
  }, [page]);

  useEffect(() => {
    if (!page?.bookingLive || !serviceId || !dateKey) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    setSelectedStart('');
    publicBookingApi
      .getAvailability(slug, dateKey, serviceId)
      .then((data) => {
        if (!cancelled) setSlots(data.slots);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page?.bookingLive, slug, serviceId, dateKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!page || !selectedStart) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const booked = await publicBookingApi.book(slug, {
        name,
        phone,
        appointmentType: serviceId,
        startAt: selectedStart,
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      setConfirmation({
        appointmentType: booked.appointmentType,
        startsAt: booked.startsAt,
        businessName: booked.businessName,
      });
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 402) {
        setFormError('Online booking is not live yet. Please call the business.');
      } else if (err instanceof ApiError && err.statusCode === 409) {
        setFormError('That time was just taken. Pick another slot.');
        setSelectedStart('');
      } else {
        setFormError(err instanceof Error ? err.message : 'Could not complete the booking.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <Shell>
        <div className="card p-8 text-center space-y-3">
          <h1 className="font-serif text-2xl text-cream-900">Booking page unavailable</h1>
          <p className="text-sm text-cream-600">{loadError}</p>
        </div>
      </Shell>
    );
  }

  if (!page) {
    return (
      <Shell>
        <p className="text-sm text-cream-600 text-center">Loading…</p>
      </Shell>
    );
  }

  if (confirmation) {
    return (
      <Shell>
        <div className="card p-8 space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">You&apos;re booked</p>
          <h1 className="font-serif text-3xl text-cream-900">{confirmation.businessName}</h1>
          <p className="text-sm text-cream-700">
            {confirmation.appointmentType}
            <br />
            {formatWhen(confirmation.startsAt, page.timezone)}
          </p>
          <p className="text-xs text-cream-500">A confirmation may also arrive by text if the business uses messaging.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="card p-6 sm:p-8 space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Book online</p>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight mt-1">{page.businessName}</h1>
          <p className="text-sm text-cream-600 mt-2">
            Pick a service and time. This calendar is the same one used when you call or text.
          </p>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Hours</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-cream-800">
            {page.hours.map((day) => (
              <li key={day.key} className="flex justify-between gap-3">
                <span>{day.label}</span>
                <span className="text-cream-600">
                  {day.closed || !day.open || !day.close
                    ? 'Closed'
                    : `${formatClock(day.open)} – ${formatClock(day.close)}`}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {!page.bookingLive ? (
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
            <p className="text-sm font-semibold text-amber-950">Booking is not live</p>
            <p className="text-sm text-amber-900 mt-1">{page.message}</p>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Service</span>
              <select
                className="input mt-1 w-full"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                required
              >
                {page.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.durationMinutes} min
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Date</span>
              <select
                className="input mt-1 w-full"
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
                required
              >
                {dateOptions.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Time</p>
              {slotsLoading ? (
                <p className="text-sm text-gray-500">Checking times…</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-gray-500">No open times on this day. Try another date.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {slots.map((slot) => {
                    const active = selectedStart === slot.startAt;
                    return (
                      <button
                        key={slot.startAt}
                        type="button"
                        onClick={() => setSelectedStart(slot.startAt)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium ring-1 transition-colors ${
                          active
                            ? 'bg-brand-600 text-white ring-brand-600'
                            : 'bg-white text-cream-800 ring-cream-300 hover:bg-cream-50'
                        }`}
                      >
                        {formatTime(slot.startAt, page.timezone)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Your name</span>
              <input className="input mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Phone</span>
              <input
                className="input mt-1 w-full"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Email <span className="font-normal text-gray-400">(optional)</span>
              </span>
              <input
                className="input mt-1 w-full"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>

            {formError && <p className="text-sm text-red-700">{formError}</p>}

            <button
              type="submit"
              disabled={submitting || !selectedStart}
              className="btn-primary w-full justify-center"
            >
              {submitting ? 'Booking…' : 'Confirm appointment'}
            </button>
          </form>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream-50 text-cream-900">
      <div className="max-w-xl mx-auto px-4 py-10 sm:py-14 space-y-6">
        {children}
        <p className="text-center text-xs text-cream-500">
          Powered by{' '}
          <Link href="/" className="underline hover:text-cream-700">
            {BRAND_NAME}
          </Link>
        </p>
      </div>
    </div>
  );
}
