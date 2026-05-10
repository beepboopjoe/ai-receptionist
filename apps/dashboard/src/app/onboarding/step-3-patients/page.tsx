'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onboardingApi, contactsApi } from '@/lib/api';
import { Upload, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { useVertical } from '@/lib/useVertical';

export default function Step3ContactsPage() {
  const router = useRouter();
  const vertical = useVertical();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null);
  const [error, setError] = useState('');

  async function handleFileUpload(file: File) {
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await contactsApi.importCsv(formData);
      setResult(res);
      await onboardingApi.completeStep(3);
    } catch (err: any) {
      setError(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSkip() {
    await onboardingApi.completeStep(3);
    router.push('/onboarding/step-4-rules');
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Step 3 — Import Your Contacts</h2>
        <p className="text-sm text-gray-500">
          Upload a CSV export from your CRM or {vertical.businessNoun} management system. The AI uses this to
          identify {vertical.contactNounPlural} and greet them by name.
        </p>
      </div>

      {result ? (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle size={24} className="text-green-600" />
            <p className="font-semibold text-gray-900">Import complete!</p>
          </div>
          <p className="text-sm text-gray-700">
            {result.imported} {vertical.contactNounPlural} imported · {result.errors} errors
          </p>
          <button
            onClick={() => router.push('/onboarding/step-4-rules')}
            className="btn-primary mt-4"
          >
            Continue <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div className="card p-6">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileUpload(file);
            }}
          />
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
          >
            <Upload size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-gray-700">Click to upload a CSV file</p>
            <p className="text-sm text-gray-400 mt-1">
              Columns: first_name, last_name, phone, email, date_of_birth (optional)
            </p>
          </div>
          {uploading && <p className="text-sm text-gray-500 text-center mt-3">Importing…</p>}
          {error && <p className="text-sm text-red-500 text-center mt-3">{error}</p>}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </button>
        {!result && (
          <button onClick={handleSkip} className="text-sm text-gray-400 hover:text-gray-600">
            Skip for now →
          </button>
        )}
      </div>
    </div>
  );
}
