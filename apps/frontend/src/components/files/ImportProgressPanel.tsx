'use client';

import { useImportStore, ImportItem } from '@/store/import-store';
import { ImportRow } from './ImportRow';

export function ImportProgressPanel({ items }: { items: ImportItem[] }) {
  const { clearFinished } = useImportStore();

  if (items.length === 0) return null;

  const hasFinished = items.some((i) => ['ready', 'failed', 'canceled'].includes(i.status));

  function handleClear() {
    const ids = new Set(items.map((i) => i.dataRoomId));
    ids.forEach((id) => clearFinished(id));
  }

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cloud Import
        </span>
        {hasFinished && (
          <button
            onClick={handleClear}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            Clear completed
          </button>
        )}
      </div>
      <div className="divide-y divide-slate-50">
        {items.map((item) => (
          <ImportRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
