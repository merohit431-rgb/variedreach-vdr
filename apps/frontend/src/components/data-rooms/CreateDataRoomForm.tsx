'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateDataRoom } from '@/hooks/use-data-rooms';
import { DATA_ROOM_TYPES, DATA_ROOM_TYPE_LABELS, type DataRoomType } from '@variedreach-vdr/shared';
import { extractErrorMessage } from '@/lib/error-message';

export function CreateDataRoomForm() {
  const router = useRouter();
  const createDataRoom = useCreateDataRoom();
  const [name, setName] = useState('');
  const [type, setType] = useState<DataRoomType>('CIRP');
  const [caseNumber, setCaseNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      const dataRoom = await createDataRoom.mutateAsync({
        name,
        type,
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
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          Name
        </label>
        <input
          id="name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. ABC Steel Ltd — CIRP 2026"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-slate-700">
          Type
        </label>
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value as DataRoomType)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {DATA_ROOM_TYPES.map((value) => (
            <option key={value} value={value}>
              {DATA_ROOM_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
        {type === 'CIRP' && (
          <p className="mt-1 text-xs text-slate-500">
            A standard CIRP folder structure will be created automatically.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="caseNumber" className="block text-sm font-medium text-slate-700">
          Case number <span className="text-slate-400">(optional)</span>
        </label>
        <input
          id="caseNumber"
          value={caseNumber}
          onChange={(e) => setCaseNumber(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
