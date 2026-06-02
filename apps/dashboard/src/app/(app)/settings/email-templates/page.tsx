'use client';
// ============================================================
// /settings/email-templates — Phase 26c-1.
//
// Per-tenant CRUD for email templates that fire on call events.
// List on the left, edit pane on the right. "Send test" button
// renders the template with sample vars and emails it to a user-
// supplied address. "Restore defaults" seeds the legal vertical's
// 5 starter templates (no-op for other verticals today).
// ============================================================
import useSWR, { mutate } from 'swr';
import { useState } from 'react';
import { Mail, Plus, Trash2, Send, Sparkles, Save, Eye, RotateCcw } from 'lucide-react';
import { emailTemplatesApi, type EmailTemplate } from '@/lib/api';
import { useVertical } from '@/lib/useVertical';
import { useToast } from '@/components/ui/toast';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRowSkeleton } from '@/components/ui/skeleton';

const COMMON_EVENTS = [
  'intake.completed',
  'consult.scheduled',
  'consult.reminder.24h',
  'consult.reminder.2h',
  'court_date.reminder',
  'document.request',
  'settlement.funds_available',
  'manual.test_send',
];

export default function EmailTemplatesPage() {
  const vertical = useVertical();
  const toast = useToast();
  const { data, isLoading } = useSWR('email-templates', () => emailTemplatesApi.list());
  const templates = data?.templates ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  async function handleSeed() {
    try {
      const res = await emailTemplatesApi.seedDefaults();
      if (res.created === 0 && res.skipped === 0) {
        toast.info(`No default templates available for vertical "${vertical.id}" yet.`);
      } else if (res.created === 0) {
        toast.info(`Already up to date — ${res.skipped} templates exist.`);
      } else {
        toast.success(`Loaded ${res.created} default templates${res.skipped > 0 ? ` (${res.skipped} already existed)` : ''}.`);
      }
      await mutate('email-templates');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load defaults');
    }
  }

  async function handleCreate() {
    try {
      const created = await emailTemplatesApi.create({
        triggerEvent: 'manual.test_send',
        name: 'New template',
        subject: 'Subject — replace this',
        bodyHtml: '<p>Hi {{contact.firstName}},</p>\n<p>Your message here.</p>',
        bodyVariables: ['contact.firstName'],
      });
      await mutate('email-templates');
      setSelectedId(created.id);
      setCreating(false);
      toast.success('Template created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template? Cannot be undone.')) return;
    try {
      await emailTemplatesApi.remove(id);
      if (selectedId === id) setSelectedId(null);
      await mutate('email-templates');
      toast.success('Template deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Email Templates</h1>
          <p className="text-gray-500 mt-1">
            Per-tenant email templates that fire on call events. Mustache-style{' '}
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{'{{var}}'}</code> substitutions
            from the event payload.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {vertical.id === 'legal' && (
            <button onClick={handleSeed} className="btn-secondary text-sm">
              <Sparkles size={14} /> Restore legal defaults
            </button>
          )}
          <button onClick={handleCreate} className="btn-primary text-sm">
            <Plus size={14} /> New template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* ── List pane ── */}
        <aside className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Mail size={14} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Templates ({templates.length})
            </p>
          </div>
          {isLoading ? (
            <ListRowSkeleton rows={4} />
          ) : templates.length === 0 ? (
            <EmptyState
              label="No templates yet"
              hint={
                vertical.id === 'legal'
                  ? 'Click "Restore legal defaults" to seed 5 starter templates, or "New template" to start from scratch.'
                  : '"New template" to start from scratch.'
              }
              compact
            />
          ) : (
            <ul className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => {
                      setSelectedId(t.id);
                      setCreating(false);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-cream-50 transition-colors ${
                      selectedId === t.id ? 'bg-brand-50/60' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-sm text-gray-900 truncate flex-1">{t.name}</p>
                      {!t.enabled && (
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          OFF
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-brand-600 truncate">{t.triggerEvent}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ── Edit pane ── */}
        <section>
          {selected ? (
            <TemplateEditor
              key={selected.id}
              template={selected}
              onSaved={() => mutate('email-templates')}
              onDelete={() => handleDelete(selected.id)}
            />
          ) : (
            <div className="card p-10 text-center">
              <Mail size={28} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                {templates.length === 0
                  ? 'Create a template or restore defaults to get started.'
                  : 'Pick a template from the list to edit, preview, or send a test.'}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Editor ─────────────────────────────────────────────────────
function TemplateEditor({
  template,
  onSaved,
  onDelete,
}: {
  template: EmailTemplate;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: template.name,
    triggerEvent: template.triggerEvent,
    subject: template.subject,
    bodyHtml: template.bodyHtml,
    bodyVariables: template.bodyVariables.join('\n'),
    enabled: template.enabled,
  });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await emailTemplatesApi.update(template.id, {
        name: form.name,
        triggerEvent: form.triggerEvent,
        subject: form.subject,
        bodyHtml: form.bodyHtml,
        bodyVariables: form.bodyVariables
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        enabled: form.enabled,
      });
      onSaved();
      toast.success('Saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!testEmail || !testEmail.includes('@')) {
      toast.error('Enter a valid email address first.');
      return;
    }
    setSending(true);
    try {
      // Send with empty vars; missing substitutions render as empty per service contract.
      const res = await emailTemplatesApi.testSend(template.id, testEmail, {});
      toast.success(`Test sent to ${res.sentTo}. Check your inbox.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test send failed');
    } finally {
      setSending(false);
    }
  }

  // Render a naive preview by stripping {{vars}} as <em>{var}</em> for display.
  const previewSubject = form.subject.replace(/\{\{\s*([\w.]+)\s*\}\}/g, '⟨$1⟩');
  const previewBody = form.bodyHtml.replace(
    /\{\{\s*([\w.]+)\s*\}\}/g,
    '<mark style="background:#fef3c7;padding:0 2px;border-radius:2px">⟨$1⟩</mark>'
  );

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="font-serif text-2xl text-cream-900 w-full bg-transparent border-b border-transparent focus:border-brand-300 focus:outline-none -mb-1"
            placeholder="Template name"
          />
          <p className="text-xs text-gray-400 mt-1">Last updated {new Date(template.updatedAt).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => set('enabled', e.target.checked)}
              className="rounded"
            />
            Enabled
          </label>
          <button
            onClick={onDelete}
            className="btn-secondary text-xs py-1.5 px-2 text-red-600 hover:text-red-700"
            title="Delete template"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Trigger event */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Trigger event</label>
        <input
          list="trigger-events"
          value={form.triggerEvent}
          onChange={(e) => set('triggerEvent', e.target.value)}
          placeholder="e.g. intake.completed"
          className="input font-mono text-sm"
        />
        <datalist id="trigger-events">
          {COMMON_EVENTS.map((ev) => (
            <option key={ev} value={ev} />
          ))}
        </datalist>
        <p className="text-xs text-gray-400 mt-1">
          When this event fires, the rendered template will be sent. Wiring of event → send happens in Phase 26c-2;
          for now you can test manually via &quot;Send test&quot; below.
        </p>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
        <input
          value={form.subject}
          onChange={(e) => set('subject', e.target.value)}
          className="input"
        />
      </div>

      {/* Body HTML */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Body (HTML — use <code className="text-[10px] bg-gray-100 px-1 rounded">{'{{var}}'}</code> for substitutions)
        </label>
        <textarea
          value={form.bodyHtml}
          onChange={(e) => set('bodyHtml', e.target.value)}
          rows={10}
          className="input font-mono text-sm"
        />
      </div>

      {/* Variables */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Available variables (one per line)
        </label>
        <textarea
          value={form.bodyVariables}
          onChange={(e) => set('bodyVariables', e.target.value)}
          rows={3}
          className="input font-mono text-xs"
          placeholder="contact.firstName&#10;firm.name&#10;matter.shortName"
        />
        <p className="text-xs text-gray-400 mt-1">
          Informational only — substitution is best-effort. Missing variables render as empty.
        </p>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
        <button onClick={() => setShowPreview((v) => !v)} className="btn-secondary text-sm">
          <Eye size={14} /> {showPreview ? 'Hide preview' : 'Preview'}
        </button>
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@example.com"
            className="input text-sm max-w-xs"
          />
          <button onClick={handleTest} disabled={sending} className="btn-secondary text-sm">
            {sending ? <RotateCcw size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? 'Sending…' : 'Send test'}
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
            <Save size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Preview */}
      {showPreview && (
        <div className="rounded-xl border border-cream-300 bg-cream-50 p-5 space-y-3">
          <p className="text-xs font-bold text-cream-600 uppercase tracking-widest">Preview</p>
          <div className="bg-white border border-cream-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Subject:</p>
            <p className="font-semibold text-gray-900 mb-4">{previewSubject}</p>
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500 mb-2">Body:</p>
              <div
                className="prose prose-sm max-w-none text-gray-800"
                dangerouslySetInnerHTML={{ __html: previewBody }}
              />
            </div>
          </div>
          <p className="text-xs text-cream-500">
            Variables are highlighted in yellow. They&apos;ll be substituted from the event payload at send time.
          </p>
        </div>
      )}
    </div>
  );
}
