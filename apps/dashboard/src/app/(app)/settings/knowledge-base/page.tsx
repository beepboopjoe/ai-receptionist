'use client';
// ============================================================
// /settings/knowledge-base — Phase 12.8 / 14.
// Upload PDFs/DOCX/TXT/MD that the AI grounds calls in.
// ============================================================
import { useRef, useState } from 'react';
import useSWR, { mutate } from 'swr';
import {
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { kbApi, type KbDocument, type KbUsage } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { SectionAgent } from '@/components/dashboard/section-agent';

const ACCEPT = '.pdf,.docx,.txt,.md';
const ACCEPT_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
]);

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function KnowledgeBasePage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: list, isLoading } = useSWR<{ documents: KbDocument[] }>(
    'kb.list',
    () => kbApi.list(),
    {
      // Poll while any doc is still processing.
      refreshInterval: (latest) => {
        const docs = latest?.documents ?? [];
        return docs.some((d) => d.status === 'pending' || d.status === 'processing') ? 3000 : 0;
      },
    }
  );
  const { data: usage } = useSWR<KbUsage>('kb.usage', () => kbApi.usage());

  const docs = list?.documents ?? [];
  const quotaPercent = usage ? Math.min(100, Math.round((usage.totalBytes / Math.max(1, usage.limits.bytes)) * 100)) : 0;
  const docPercent = usage ? Math.min(100, Math.round((usage.docCount / Math.max(1, usage.limits.docs)) * 100)) : 0;
  const atDocCap = usage ? usage.docCount >= usage.limits.docs : false;

  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const valid = fileArray.filter((f) => ACCEPT_MIME.has(f.type) || /\.(pdf|docx|txt|md)$/i.test(f.name));
    if (valid.length === 0) {
      toast.error('Unsupported file type. Use PDF, DOCX, TXT, or MD.');
      return;
    }
    setUploading(true);
    try {
      for (const file of valid) {
        await kbApi.upload(file);
      }
      toast.success(`Uploaded ${valid.length} document${valid.length === 1 ? '' : 's'}. Processing in background…`);
      await Promise.all([mutate('kb.list'), mutate('kb.usage')]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(doc: KbDocument) {
    if (!confirm(`Delete "${doc.filename}"? All ${doc.chunkCount} chunks will be removed from AI retrieval immediately.`)) return;
    try {
      await kbApi.delete(doc.id);
      toast.success('Document deleted');
      await Promise.all([mutate('kb.list'), mutate('kb.usage')]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function handleReprocess(doc: KbDocument) {
    try {
      await kbApi.reprocess(doc.id);
      toast.success('Reprocessing queued');
      await mutate('kb.list');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reprocess failed');
    }
  }

  return (
    <div className="space-y-6">
      <SectionAgent section="knowledge-base" />

      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Knowledge Base</h1>
        <p className="text-gray-500 mt-1">
          Upload your docs — fee schedules, intake forms, FAQs — and the AI grounds every call in them.
        </p>
      </div>

      {/* ── Usage bar ── */}
      {usage && (
        <div className="card p-5 space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-gray-700">Documents</span>
              <span className="text-gray-500">
                {usage.docCount} / {usage.limits.docs}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  docPercent >= 90 ? 'bg-red-500' : docPercent >= 70 ? 'bg-amber-500' : 'bg-brand-600'
                }`}
                style={{ width: `${docPercent}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-gray-700">Storage</span>
              <span className="text-gray-500">
                {formatBytes(usage.totalBytes)} / {formatBytes(usage.limits.bytes)}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  quotaPercent >= 90 ? 'bg-red-500' : quotaPercent >= 70 ? 'bg-amber-500' : 'bg-brand-600'
                }`}
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
          </div>
          {atDocCap && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
              You've hit your plan's document limit. Delete an existing doc or upgrade to add more.
            </p>
          )}
        </div>
      )}

      {/* ── Upload zone ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
        }}
        className={`card border-2 border-dashed p-10 text-center transition-colors ${
          dragOver ? 'border-brand-500 bg-brand-50' : 'border-cream-300 hover:border-brand-400'
        } ${atDocCap || uploading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <Upload size={32} className="mx-auto text-cream-400 mb-3" />
        <p className="font-medium text-gray-700 mb-1">
          {uploading ? 'Uploading…' : 'Drop files here or click to choose'}
        </p>
        <p className="text-xs text-gray-500 mb-4">PDF · DOCX · TXT · MD · 10 MB max per file</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || atDocCap}
          className="btn-primary text-sm"
        >
          {uploading ? <Loader2 size={14} className="animate-spin inline mr-1.5" /> : null}
          Choose files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
          }}
        />
      </div>

      {/* ── Document list ── */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Your documents</h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : docs.length === 0 ? (
          <div className="card p-10 text-center">
            <FileText size={28} className="mx-auto text-cream-400 mb-3" />
            <p className="text-gray-500 text-sm">
              No documents yet. Upload a PDF or DOCX to give your AI receptionist context about your business.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div key={doc.id} className="card p-4 flex items-center gap-4">
                <FileText size={20} className="text-cream-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{doc.filename}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatBytes(doc.sizeBytes)} · {doc.chunkCount > 0 ? `${doc.chunkCount} chunks` : 'not yet processed'} · {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                  {doc.errorMessage && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1 mt-1">
                      ⚠️ {doc.errorMessage}
                    </p>
                  )}
                </div>
                <StatusBadge status={doc.status} />
                <div className="flex items-center gap-1.5 shrink-0">
                  {(doc.status === 'failed' || doc.status === 'ready') && (
                    <button
                      onClick={() => handleReprocess(doc)}
                      className="btn-secondary text-xs flex items-center gap-1"
                      title="Re-parse + re-embed this document"
                    >
                      <RefreshCw size={12} /> Reprocess
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(doc)}
                    className="btn-danger text-xs flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: KbDocument['status'] }) {
  switch (status) {
    case 'ready':
      return (
        <span className="badge badge-green flex items-center gap-1 shrink-0">
          <CheckCircle size={11} /> Ready
        </span>
      );
    case 'processing':
      return (
        <span className="badge badge-blue flex items-center gap-1 shrink-0">
          <Loader2 size={11} className="animate-spin" /> Processing
        </span>
      );
    case 'pending':
      return (
        <span className="badge badge-gray flex items-center gap-1 shrink-0">
          <Clock size={11} /> Queued
        </span>
      );
    case 'failed':
      return (
        <span className="badge badge-red flex items-center gap-1 shrink-0">
          <AlertTriangle size={11} /> Failed
        </span>
      );
  }
}
