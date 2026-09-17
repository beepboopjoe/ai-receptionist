'use client';

import { useState } from 'react';
import { mutate } from 'swr';
import { Globe, Loader2, SkipForward } from 'lucide-react';
import { setupApi, type SetupWebsiteResult, type WebsiteFacts } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

function factLines(facts: WebsiteFacts): Array<{ label: string; value: string }> {
  return [
    { label: 'Business', value: facts.businessName },
    { label: 'Services', value: facts.services },
    { label: 'Hours', value: facts.hours },
    { label: 'Location', value: facts.location },
    { label: 'FAQs', value: facts.faqs },
  ].filter((row) => row.value.trim());
}

export function WebsiteImportCard({
  onImported,
  onSkip,
}: {
  onImported?: (result: Extract<SetupWebsiteResult, { ok: true }>) => void;
  onSkip?: () => void;
}) {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SetupWebsiteResult | null>(null);
  const [manual, setManual] = useState(false);
  const [facts, setFacts] = useState({ services: '', hours: '', location: '', notes: '' });
  const [savingFacts, setSavingFacts] = useState(false);

  async function importUrl(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await setupApi.importWebsite(url);
      setResult(res);
      if (res.ok) {
        await mutate('settings');
        await mutate('setup-status');
        await mutate('office-hours');
        toast.success('Saved what we found about your business');
        onImported?.(res);
      } else {
        setManual(true);
        toast.error(res.message);
      }
    } catch (err) {
      setManual(true);
      const message = err instanceof Error ? err.message : 'We could not read that website.';
      setResult({
        ok: false,
        skipped: true,
        canSkip: true,
        reason: 'scrape_failed',
        message,
      });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function saveTypedFacts(e: React.FormEvent) {
    e.preventDefault();
    setSavingFacts(true);
    try {
      const res = await setupApi.saveFacts(facts);
      setResult(res);
      if (res.ok) {
        await mutate('settings');
        await mutate('setup-status');
        await mutate('office-hours');
        toast.success('Saved. Telfin will use this on calls.');
        onImported?.(res);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save those facts');
    } finally {
      setSavingFacts(false);
    }
  }

  const imported = result && result.ok ? result : null;

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
          <Globe size={16} className="text-brand-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Paste your website</h2>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            We read the public page for services, hours, FAQs, and location — then teach Telfin.
            If that fails, type a few facts or skip.
          </p>
        </div>
      </div>

      <form onSubmit={importUrl} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://yourbusiness.com"
          className="input flex-1"
          autoComplete="url"
        />
        <button type="submit" disabled={loading || !url.trim()} className="btn-primary justify-center">
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          {loading ? 'Reading…' : 'Use this website'}
        </button>
      </form>

      {imported && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-2">
          <p className="text-sm font-semibold text-emerald-900">Here is what we saved</p>
          {factLines(imported.facts).map((row) => (
            <div key={row.label}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                {row.label}
              </p>
              <p className="text-xs text-emerald-950 whitespace-pre-wrap">{row.value}</p>
            </div>
          ))}
          {imported.hoursApplied && (
            <p className="text-xs text-emerald-800">Office hours were filled in from the site.</p>
          )}
        </div>
      )}

      {result && !result.ok && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {result.message} You can still go live.
        </p>
      )}

      {(manual || (result && !result.ok)) && (
        <form onSubmit={saveTypedFacts} className="space-y-3 border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-800">Type a few facts instead</p>
          <textarea
            value={facts.services}
            onChange={(e) => setFacts((f) => ({ ...f, services: e.target.value }))}
            placeholder="What do you offer?"
            rows={3}
            className="input"
          />
          <input
            value={facts.hours}
            onChange={(e) => setFacts((f) => ({ ...f, hours: e.target.value }))}
            placeholder="Hours, e.g. Mon–Fri 9am–5pm"
            className="input"
          />
          <input
            value={facts.location}
            onChange={(e) => setFacts((f) => ({ ...f, location: e.target.value }))}
            placeholder="City or street address"
            className="input"
          />
          <textarea
            value={facts.notes}
            onChange={(e) => setFacts((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Anything else callers should know"
            rows={2}
            className="input"
          />
          <button type="submit" disabled={savingFacts} className="btn-primary">
            {savingFacts ? 'Saving…' : 'Save these facts'}
          </button>
        </form>
      )}

      {!imported && (
        <button
          type="button"
          onClick={() => {
            setManual(true);
            onSkip?.();
          }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800"
        >
          <SkipForward size={12} />
          Skip for now — I will type this later
        </button>
      )}
    </div>
  );
}
