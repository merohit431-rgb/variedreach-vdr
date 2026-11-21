'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, FolderTree } from 'lucide-react';
import { useCreateDataRoom, useDataRoomTemplate, type DataRoomTemplateFolderNode } from '@/hooks/use-data-rooms';
import { DATA_ROOM_TYPES, DATA_ROOM_TYPE_LABELS, type DataRoomType } from '@variedreach-vdr/shared';
import { extractErrorMessage } from '@/lib/error-message';

function TemplateFolderTree({ nodes, depth = 0 }: { nodes: DataRoomTemplateFolderNode[]; depth?: number }) {
  return (
    <ul className={depth === 0 ? 'space-y-0.5' : 'ml-4 space-y-0.5 border-l border-app-border pl-2'}>
      {nodes.map((node) => (
        <li key={node.name}>
          <span className="text-xs text-app-t2">{node.name}</span>
          {node.children.length > 0 && <TemplateFolderTree nodes={node.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

export function CreateDataRoomForm() {
  const router = useRouter();
  const createDataRoom = useCreateDataRoom();
  const [name, setName] = useState('');
  const [type, setType] = useState<DataRoomType>('CIRP');
  const [caseNumber, setCaseNumber] = useState('');
  const [applyTemplate, setApplyTemplate] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: template, isLoading: isTemplateLoading } = useDataRoomTemplate(type);

  // Re-default to "apply template" whenever the type changes, rather than
  // carrying a choice made for a different template's folder structure.
  useEffect(() => {
    setApplyTemplate(true);
    setShowPreview(false);
  }, [type]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      const dataRoom = await createDataRoom.mutateAsync({
        name,
        type,
        applyTemplate: template ? applyTemplate : false,
        caseNumber: caseNumber || undefined,
      });
      router.push(`/data-rooms/${dataRoom.id}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-app-t2">
          Name
        </label>
        <input
          id="name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. ABC Steel Ltd — CIRP 2026"
          className="mt-1 w-full rounded-md border border-app-border2 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-app-t2">
          Type
        </label>
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value as DataRoomType)}
          className="mt-1 w-full rounded-md border border-app-border2 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {DATA_ROOM_TYPES.map((value) => (
            <option key={value} value={value}>
              {DATA_ROOM_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      {isTemplateLoading ? (
        <p className="text-xs text-app-t3">Checking for a folder template…</p>
      ) : (
        template && (
          <div className="rounded-md border border-app-border2 p-3">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={applyTemplate}
                onChange={(e) => setApplyTemplate(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm text-app-t2">
                Apply standard folder template
                <span className="block text-xs text-app-t3">
                  Creates {template.folderCount} folder{template.folderCount === 1 ? '' : 's'} from the{' '}
                  {template.name} template.
                </span>
              </span>
            </label>

            {applyTemplate && (
              <button
                type="button"
                onClick={() => setShowPreview((prev) => !prev)}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-app-primary"
              >
                {showPreview ? (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <FolderTree className="h-3.5 w-3.5" aria-hidden="true" />
                {showPreview ? 'Hide' : 'Preview'} folder structure
              </button>
            )}

            {applyTemplate && showPreview && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-md bg-app-s2 p-2">
                <TemplateFolderTree nodes={template.folders} />
              </div>
            )}
          </div>
        )
      )}

      <div>
        <label htmlFor="caseNumber" className="block text-sm font-medium text-app-t2">
          Case number <span className="text-app-t3">(optional)</span>
        </label>
        <input
          id="caseNumber"
          value={caseNumber}
          onChange={(e) => setCaseNumber(e.target.value)}
          className="mt-1 w-full rounded-md border border-app-border2 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <button
        type="submit"
        disabled={createDataRoom.isPending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {createDataRoom.isPending ? 'Creating...' : 'Create Data Room'}
      </button>
    </form>
  );
}
