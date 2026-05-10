'use client';
import useSWR, { mutate } from 'swr';
import { settingsApi } from '@/lib/api';
import { useState } from 'react';
import { Save } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useVertical } from '@/lib/useVertical';

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

type DayHours = { open: string; close: string };
type OfficeHours = Record<string, DayHours | undefined>;

export default function OfficeHoursPage() {
  const { data } = useSWR('office-hours', () => settingsApi.getOfficeHours());
  const [hours, setHours] = useState<OfficeHours>(data as OfficeHours ?? {});
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const vertical = useVertical();

  function toggleDay(key: string) {
    setHours((prev) => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: { open: '08:00', close: '17:00' } };
    });
  }

  function updateTime(key: string, field: 'open' | 'close', value: string) {
    setHours((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { open: '08:00', close: '17:00' }), [field]: value },
    }));
  }

  async function save() {
    setSaving(true);
    try {
      await settingsApi.updateOfficeHours(hours);
      await mutate('office-hours');
      toast.success('Office hours saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save office hours');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Office Hours</h1>
        <p className="text-gray-500 mt-1">Set when your {vertical.businessNoun} accepts calls</p>
      </div>

      <div className="card divide-y divide-gray-50">
        {DAYS.map(({ key, label }) => {
          const isOpen = !!hours[key];
          const day = hours[key];
          return (
            <div key={key} className="px-6 py-4 flex items-center gap-4">
              <button
                onClick={() => toggleDay(key)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                  isOpen ? 'bg-brand-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${
                    isOpen ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <span className="w-28 text-sm font-medium text-gray-700">{label}</span>
              {isOpen && day ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={day.open}
                    onChange={(e) => updateTime(key, 'open', e.target.value)}
                    className="input w-32 text-sm"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="time"
                    value={day.close}
                    onChange={(e) => updateTime(key, 'close', e.target.value)}
                    className="input w-32 text-sm"
                  />
                </div>
              ) : (
                <span className="text-sm text-gray-400">Closed</span>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={save} disabled={saving} className="btn-primary">
        <Save size={16} />
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}
