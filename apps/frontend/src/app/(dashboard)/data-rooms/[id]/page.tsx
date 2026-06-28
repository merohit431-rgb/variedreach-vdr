'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDataRoom, useSetDataRoomArchived, useDeleteDataRoom } from '@/hooks/use-data-rooms';
import { MembersPanel } from '@/components/data-rooms/MembersPanel';
import { DATA_ROOM_TYPE_LABELS, isDataRoomManager } from '@variedreach-vdr/shared';
import { extractErrorMessage } from '@/lib/error-message';

export default function DataRoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: dataRoom, isLoading } = useDataRoom(id);
  const setArchived = useSetDataRoomArchived(id);
  const deleteDataRoom = useDeleteDataRoom();
  const [error, setError] = useState<string | null>(null);

  const canManage = Boolean(user && isDataRoomManager(user.role));

  if (isLoading || !dataRoom) {
    return <p className="text-sm text-slate-400">Loading…</p>;
  }

  async function handleDelete() {
    if (!confirm(`Delete "${dataRoom!.name}"? This cannot be undone.`)) return;
    try {
      await deleteDataRoom.mutateAsync(dataRoom!.id);
      router.push('/data-rooms');
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dataRoom.name}</h1>
          <p className="text-sm text-slate-500">
            {DATA_ROOM_TYPE_LABELS[dataRoom.type]}
            {dataRoom.caseNumber && ` · ${dataRoom.caseNumber}`} · {dataRoom.status}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => setArchived.mutate(dataRoom.status !== 'ARCHIVED')}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              {dataRoom.status === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
            </button>
            <button
              onClick={handleDelete}
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <h2 className="mb-3 text-sm font-medium text-slate-700">Members</h2>
        <MembersPanel dataRoomId={dataRoom.id} canManage={canManage} />
      </div>
    </div>
  );
}
