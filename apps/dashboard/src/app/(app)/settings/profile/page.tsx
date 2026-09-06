'use client';
import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Save } from 'lucide-react';
import { settingsApi, tenantsApi } from '@/lib/api';
import { VERTICALS } from '@/lib/verticals';
import { useToast } from '@/components/ui/toast';
import { useTenant } from '@/lib/TenantProvider';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'UTC',
];

export default function BusinessProfilePage() {
  const toast = useToast();
  const { refresh } = useTenant();
  const { data, isLoading } = useSWR('settings', () => settingsApi.get());
  const tenant = (data as { tenant?: { name?: string; timezone?: string; vertical?: string } } | undefined)?.tenant;

  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [vertical, setVertical] = useState('generic');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setName(tenant.name ?? '');
    setTimezone(tenant.timezone ?? 'America/New_York');
    setVertical(tenant.vertical ?? 'generic');
  }, [tenant]);

  async function save() {
    if (!name.trim()) {
      toast.error('Business name is required.');
      return;
    }
    setSaving(true);
    try {
      await tenantsApi.update({ name: name.trim(), timezone, vertical });
      await Promise.all([mutate('settings'), mutate('tenant'), refresh()]);
      toast.success('Business profile saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Business profile</h1>
        <p className="text-gray-500 mt-1">Name, timezone, and industry for your front desk</p>
      </div>

      <div className="card p-6 space-y-5">
        {isLoading && !tenant ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 120))}
                className="input"
                placeholder="Acme Law"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="input"
              >
                {!TIMEZONES.includes(timezone) && timezone && (
                  <option value={timezone}>{timezone}</option>
                )}
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Used for office hours and appointment times.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <select
                value={vertical}
                onChange={(e) => setVertical(e.target.value)}
                className="input"
              >
                {VERTICALS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.emoji} {v.label}
                  </option>
                ))}
              </select>
            </div>

            <button onClick={save} disabled={saving} className="btn-primary">
              <Save size={16} />
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
