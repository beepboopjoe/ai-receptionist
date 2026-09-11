'use client';
import { VERTICALS } from '@/lib/verticals';

export function VerticalSwitchConfirm({
  fromId,
  toId,
  migrateTypes,
  onMigrateTypesChange,
  openCurate,
  onOpenCurateChange,
  onCancel,
  onConfirm,
  saving,
}: {
  fromId: string;
  toId: string;
  migrateTypes: boolean;
  onMigrateTypesChange: (v: boolean) => void;
  openCurate: boolean;
  onOpenCurateChange: (v: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
}) {
  const from = VERTICALS.find((v) => v.id === fromId);
  const to = VERTICALS.find((v) => v.id === toId);
  const leavingLegal = fromId === 'legal' && toId !== 'legal';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="card max-w-md w-full p-6 space-y-4 shadow-xl">
        <h2 className="font-serif text-xl text-cream-900">Switch industry?</h2>
        <p className="text-sm text-gray-600">
          Change from {from?.emoji} {from?.label ?? fromId} to {to?.emoji} {to?.label ?? toId}.
          Prompt vocabulary updates on the next call. Phone numbers, calendar, and CRM
          connections stay put.
        </p>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={migrateTypes}
            onChange={(e) => onMigrateTypesChange(e.target.checked)}
          />
          <span>
            Replace appointment types with {to?.label ?? toId} defaults (Cleaning → consults,
            etc.). Custom types will be overwritten.
          </span>
        </label>
        {leavingLegal && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            The legal practice-area block will be removed from business context so the AI
            stops using law-firm intake language.
          </p>
        )}
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={openCurate}
            onChange={(e) => onOpenCurateChange(e.target.checked)}
          />
          <span>Open Curate My Agent after save so you can rewrite industry context.</span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm} disabled={saving}>
            {saving ? 'Switching…' : 'Switch industry'}
          </button>
        </div>
      </div>
    </div>
  );
}
