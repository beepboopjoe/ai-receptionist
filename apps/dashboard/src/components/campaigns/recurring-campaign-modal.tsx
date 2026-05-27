'use client';
// ============================================================
// RecurringCampaignModal — Phase 18.
// Lets an admin schedule a goal-based campaign to re-run daily,
// weekly, or monthly. Posts to POST /campaigns/:id/recurring.
// ============================================================
import { useState } from 'react';
import { X, Loader2, RotateCw } from 'lucide-react';
import { campaignsApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday'    },
  { value: 1, label: 'Monday'    },
  { value: 2, label: 'Tuesday'   },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday'  },
  { value: 5, label: 'Friday'    },
  { value: 6, label: 'Saturday'  },
];

const COMMON_TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
];

interface RecurringCampaignModalProps {
  open: boolean;
  campaignId: string;
  campaignName: string;
  /** When the campaign has no `goal` set, recurring isn't available — show a notice instead. */
  hasGoal: boolean;
  /** Current recurrence config when editing an existing one. */
  currentConfig?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
    time: string;
    timezone: string;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}

export function RecurringCampaignModal({
  open,
  campaignId,
  campaignName,
  hasGoal,
  currentConfig,
  onClose,
  onSaved,
}: RecurringCampaignModalProps) {
  const toast = useToast();

  // Detect the browser timezone as a sensible default.
  const browserTz =
    typeof Intl !== 'undefined' && Intl.DateTimeFormat
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'America/Los_Angeles';

  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>(
    currentConfig?.frequency ?? 'weekly'
  );
  const [dayOfWeek, setDayOfWeek] = useState<number>(currentConfig?.dayOfWeek ?? 1);
  const [dayOfMonth, setDayOfMonth] = useState<number>(currentConfig?.dayOfMonth ?? 1);
  const [time, setTime] = useState<string>(currentConfig?.time ?? '09:00');
  const [timezone, setTimezone] = useState<string>(currentConfig?.timezone ?? browserTz);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSave() {
    setSubmitting(true);
    try {
      await campaignsApi.setRecurring(campaignId, {
        frequency,
        ...(frequency === 'weekly' ? { dayOfWeek } : {}),
        ...(frequency === 'monthly' ? { dayOfMonth } : {}),
        time,
        timezone,
      });
      toast.success(`"${campaignName}" is now recurring.`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save recurring schedule');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClear() {
    if (!confirm('Stop the recurring schedule? The campaign will not auto-rerun.')) return;
    setSubmitting(true);
    try {
      await campaignsApi.clearRecurring(campaignId);
      toast.success('Recurring schedule cleared.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear recurring schedule');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <RotateCw size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {currentConfig ? 'Edit recurring schedule' : 'Make this campaign recurring'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5 truncate max-w-sm">{campaignName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {!hasGoal ? (
          <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-800">
            Recurring schedules are only available for campaigns created from a goal template — we
            need a candidate query to re-run for fresh leads each cycle. Create a new campaign from
            <em> /campaigns/new → Pick a goal template</em> to enable recurring.
          </div>
        ) : (
          <div className="space-y-4">
            {/* ── Frequency ── */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <div className="grid grid-cols-3 gap-2">
                {(['daily', 'weekly', 'monthly'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={`text-sm py-2 rounded-lg border transition-colors ${
                      frequency === f
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                        : 'bg-white border-cream-300 text-cream-700 hover:bg-cream-50'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Day picker (frequency-dependent) ── */}
            {frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day of week</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="input w-full"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {frequency === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day of month (1–28)</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
                  className="input w-full"
                />
                <p className="text-xs text-cream-400 mt-1">
                  Capped at 28 to avoid skipping in shorter months.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="input w-full"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                  {!COMMON_TIMEZONES.includes(browserTz) && (
                    <option value={browserTz}>{browserTz} (your browser)</option>
                  )}
                </select>
              </div>
            </div>

            <div className="bg-indigo-50/60 border border-indigo-100 rounded p-3 text-xs text-indigo-900">
              <strong>How it works:</strong> at the scheduled time, we re-run this campaign's goal
              query for fresh leads, skip any phone numbers already in the campaign, then dial the new
              ones during your configured dial window.
            </div>
          </div>
        )}

        <div className="flex justify-between gap-2 pt-5 mt-2 border-t border-cream-100">
          <div>
            {currentConfig && hasGoal && (
              <button
                type="button"
                onClick={handleClear}
                disabled={submitting}
                className="btn-danger text-sm"
              >
                Stop recurring
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
            {hasGoal && (
              <button
                type="button"
                onClick={handleSave}
                disabled={submitting}
                className="btn-primary text-sm flex items-center gap-1.5"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {submitting ? 'Saving…' : currentConfig ? 'Update schedule' : 'Make recurring'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
