'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { campaignsApi } from '@/lib/api';
import { ArrowLeft, Save, Crosshair, Megaphone, Upload, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';

export default function NewCampaignPage() {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    fromNumber: '',
    dialWindowStart: '09:00',
    dialWindowEnd: '17:00',
    maxRetries: 3,
    retryDelayMinutes: 60,
    maxConcurrentCalls: 3,
    voicemailMessage: '',
  });

  function set(key: string, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.fromNumber.trim()) {
      toast.error('Campaign name and caller ID are required.');
      return;
    }
    setSaving(true);
    try {
      const { voicemailMessage, ...rest } = form;
      const campaign = await campaignsApi.create({
        ...rest,
        ...(voicemailMessage && { voicemailMessage }),
      }) as any;
      toast.success('Campaign created');
      router.push(`/campaigns/${campaign.id}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create campaign');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/campaigns" className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">New Campaign</h1>
      </div>

      {/* Pick your lead source — Phase 12.7 added the third option. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link
          href="/leads/discover"
          className="rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-amber-50/40 p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-2">
            <Crosshair size={14} className="text-brand-600" />
            <p className="text-[11px] font-bold text-brand-700 uppercase tracking-wider">
              Find new leads
            </p>
          </div>
          <p className="font-semibold text-sm text-cream-900">Discover leads on Google Maps</p>
          <p className="text-xs text-cream-700 mt-1 leading-relaxed">
            Describe who you want to call. We scrape + import. Pay per lead.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
            Open discovery <ArrowRight size={12} />
          </span>
        </Link>

        <Link
          href="/campaigns"
          className="rounded-xl border border-cream-200 bg-white p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-2">
            <Megaphone size={14} className="text-cream-600" />
            <p className="text-[11px] font-bold text-cream-700 uppercase tracking-wider">
              Pre-built goals
            </p>
          </div>
          <p className="font-semibold text-sm text-cream-900">Pick a goal template</p>
          <p className="text-xs text-cream-700 mt-1 leading-relaxed">
            Recall, no-show recovery, stale leads — auto-built against your existing contacts.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cream-700">
            See goals <ArrowRight size={12} />
          </span>
        </Link>

        <div className="rounded-xl border border-cream-200 bg-cream-50 p-4 ring-2 ring-cream-300">
          <div className="flex items-center gap-2 mb-2">
            <Upload size={14} className="text-cream-600" />
            <p className="text-[11px] font-bold text-cream-700 uppercase tracking-wider">
              Manual upload
            </p>
          </div>
          <p className="font-semibold text-sm text-cream-900">Build from scratch</p>
          <p className="text-xs text-cream-700 mt-1 leading-relaxed">
            Configure dial settings now, upload a CSV in the next step.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cream-800">
            ✓ You&apos;re here
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        {/* Basic info */}
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Campaign Details</h2>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Campaign Name *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. New Client Outreach — April 2025"
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Caller ID *</label>
            <input
              value={form.fromNumber}
              onChange={(e) => set('fromNumber', e.target.value)}
              placeholder="+15551234567"
              className="input font-mono"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Must be a number provisioned for your account</p>
          </div>
        </div>

        {/* Dial window */}
        <div className="space-y-4 border-t border-gray-100 pt-6">
          <h2 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Dial Window</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Start Time</label>
              <input
                type="time"
                value={form.dialWindowStart}
                onChange={(e) => set('dialWindowStart', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">End Time</label>
              <input
                type="time"
                value={form.dialWindowEnd}
                onChange={(e) => set('dialWindowEnd', e.target.value)}
                className="input"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400">Calls will only be placed during this window (practice local time)</p>
        </div>

        {/* Retry settings */}
        <div className="space-y-4 border-t border-gray-100 pt-6">
          <h2 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Retry Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max Retries</label>
              <input
                type="number"
                min={0}
                max={10}
                value={form.maxRetries}
                onChange={(e) => set('maxRetries', parseInt(e.target.value))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Retry Delay (min)</label>
              <input
                type="number"
                min={15}
                max={1440}
                value={form.retryDelayMinutes}
                onChange={(e) => set('retryDelayMinutes', parseInt(e.target.value))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Concurrent Calls</label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.maxConcurrentCalls}
                onChange={(e) => set('maxConcurrentCalls', parseInt(e.target.value))}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Voicemail */}
        <div className="space-y-4 border-t border-gray-100 pt-6">
          <h2 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Voicemail Message</h2>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Message (optional — leave blank to skip voicemail)
            </label>
            <textarea
              value={form.voicemailMessage}
              onChange={(e) => set('voicemailMessage', e.target.value)}
              placeholder="Hi, this is Aria from Bright Smile Dental. We're welcoming new patients and would love to help with your dental care. Please call us back at 555-1234. Thank you!"
              className="input"
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3 border-t border-gray-100 pt-6">
          <button type="submit" disabled={saving} className="btn-primary">
            <Save size={16} /> {saving ? 'Creating…' : 'Create Campaign'}
          </button>
          <Link href="/campaigns" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
