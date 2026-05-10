'use client';
// ============================================================
// Notification settings — toggle which automated SMS/email
// reminders the AI sends. Persists via PATCH /settings under
// the `notificationPreferences` field.
// ============================================================
import useSWR, { mutate } from 'swr';
import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { settingsApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useVertical } from '@/lib/useVertical';

type PrefKey =
  | 'appointmentConfirmation'
  | 'reminder24h'
  | 'reminder2h'
  | 'recallReminder'
  | 'escalationAlerts'
  | 'dailyDigest';

type Preferences = Record<PrefKey, boolean>;

const DEFAULT_PREFS: Preferences = {
  appointmentConfirmation: true,
  reminder24h: true,
  reminder2h: true,
  recallReminder: true,
  escalationAlerts: true,
  dailyDigest: false,
};

export default function NotificationsSettingsPage() {
  const { data } = useSWR('settings', () => settingsApi.get());
  const settings = (data as any)?.settings;
  const toast = useToast();
  const vertical = useVertical();

  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);

  // Hydrate from server on first load — fall back to defaults if the field
  // hasn't been initialized yet.
  useEffect(() => {
    if (settings?.notificationPreferences) {
      setPrefs({ ...DEFAULT_PREFS, ...settings.notificationPreferences });
    }
  }, [settings]);

  function toggle(key: PrefKey) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function save() {
    setSaving(true);
    try {
      await settingsApi.update({ notificationPreferences: prefs });
      await mutate('settings');
      toast.success('Notification preferences saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save preferences');
    } finally {
      setSaving(false);
    }
  }

  // Vertical-aware copy: "patient" → vertical contact noun where it makes sense.
  const cn = vertical.contactNounPlural;
  const an = vertical.appointmentNoun;
  const isHealthcare = vertical.id === 'dental';

  const TOGGLES: { key: PrefKey; label: string; detail: string; show: boolean }[] = [
    {
      key: 'appointmentConfirmation',
      label: `${an.charAt(0).toUpperCase() + an.slice(1)} confirmation SMS`,
      detail: 'Sent immediately after booking',
      show: true,
    },
    {
      key: 'reminder24h',
      label: '24-hour reminder SMS',
      detail: `Sent the day before the ${an}`,
      show: true,
    },
    {
      key: 'reminder2h',
      label: '2-hour reminder SMS',
      detail: `Sent 2 hours before the ${an}`,
      show: true,
    },
    {
      key: 'recallReminder',
      label: 'Recall reminder SMS',
      detail: 'Sent 30 days before recall due date',
      show: isHealthcare, // only relevant for dental
    },
    {
      key: 'escalationAlerts',
      label: 'Escalation alerts (email)',
      detail: 'Notify staff when AI transfers a call',
      show: true,
    },
    {
      key: 'dailyDigest',
      label: 'Daily activity digest (email)',
      detail: `Summary of yesterday's calls, ${cn}, and ${vertical.appointmentNounPlural}`,
      show: true,
    },
  ];

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Notification Settings</h1>
        <p className="text-gray-500 mt-1">Configure when and how your {cn} receive reminders.</p>
      </div>

      <div className="card p-6 space-y-5">
        <div className="space-y-4">
          {TOGGLES.filter((t) => t.show).map(({ key, label, detail }) => {
            const enabled = prefs[key];
            return (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{detail}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${label} — ${enabled ? 'enabled' : 'disabled'}`}
                  onClick={() => toggle(key)}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                    enabled ? 'bg-brand-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${
                      enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            All SMS messages include a cancel link.
          </p>
          <button onClick={save} disabled={saving} className="btn-primary">
            <Save size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
