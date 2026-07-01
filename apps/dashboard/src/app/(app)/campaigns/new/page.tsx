'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { campaignsApi } from '@/lib/api';
import { ArrowLeft, Save, Megaphone, Upload, ArrowRight, Scale, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { useVertical } from '@/lib/useVertical';
import { LEGAL_CAMPAIGN_TEMPLATES, type LegalCampaignTemplate } from '@/lib/legal-presets';

export default function NewCampaignPage() {
  const router = useRouter();
  const toast = useToast();
  const vertical = useVertical();
  const isLegal = vertical.id === 'legal';
  const [saving, setSaving] = useState(false);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);

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

  function applyLegalTemplate(t: LegalCampaignTemplate) {
    setForm((f) => ({
      ...f,
      name: t.campaignName,
      voicemailMessage: t.voicemailMessage,
      dialWindowStart: t.dialWindowStart,
      dialWindowEnd: t.dialWindowEnd,
      maxRetries: t.maxRetries,
      retryDelayMinutes: t.retryDelayMinutes,
      maxConcurrentCalls: t.maxConcurrentCalls,
      // fromNumber intentionally not touched — the user supplies their own caller ID.
    }));
    setAppliedTemplateId(t.id);
    toast.info(`Template applied: ${t.title}. Review the fields and add your caller ID.`);
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

      {/* Pick your lead source. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

      {/* ═══ LEGAL TEMPLATE GALLERY — Phase 26a ═══
          Renders only when tenant vertical === 'legal'. Six one-click
          templates pre-fill the form below with sensible legal defaults. */}
      {isLegal && (
        <LegalCampaignTemplateGallery
          templates={LEGAL_CAMPAIGN_TEMPLATES}
          appliedId={appliedTemplateId}
          onPick={applyLegalTemplate}
        />
      )}

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

// ── Legal template gallery — Phase 26a ────────────────────────
function LegalCampaignTemplateGallery({
  templates,
  appliedId,
  onPick,
}: {
  templates: readonly LegalCampaignTemplate[];
  appliedId: string | null;
  onPick: (t: LegalCampaignTemplate) => void;
}) {
  return (
    <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-violet-50/40 p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center shrink-0">
          <Scale size={18} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-indigo-500" />
            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
              Legal templates
            </p>
          </div>
          <h2 className="font-semibold text-gray-900">Start from a law-firm template</h2>
          <p className="text-sm text-gray-600 mt-1">
            Seven proactive campaigns built for law-firm workflows. Picking one pre-fills
            the form below — review, add your caller ID, then save.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((t) => {
          const isApplied = appliedId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t)}
              className={`text-left rounded-xl p-4 transition-all ${
                isApplied
                  ? 'bg-white border-2 border-indigo-400 shadow-sm'
                  : 'bg-white border border-indigo-100 hover:border-indigo-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-semibold text-sm text-gray-900">{t.title}</p>
                {isApplied && (
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                    Applied
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed mb-3">{t.description}</p>
              <p className="text-[11px] text-indigo-700 font-medium">{t.targetHint}</p>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-5">
        Picking a template only fills the form fields below. You still review, set your caller
        ID, and click <span className="font-semibold">Create Campaign</span> to actually save.
      </p>
    </section>
  );
}
