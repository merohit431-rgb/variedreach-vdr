'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import {
  useDataRoom,
  useDataRoomAccess,
  useSetDataRoomArchived,
  useDeleteDataRoom,
} from '@/hooks/use-data-rooms';
import { DATA_ROOM_TYPE_LABELS } from '@variedreach-vdr/shared';
import { extractErrorMessage } from '@/lib/error-message';

export default function DataRoomLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { data: dataRoom, isLoading } = useDataRoom(id);
  const { data: access } = useDataRoomAccess(id);
  const setArchived = useSetDataRoomArchived(id);
  const deleteDataRoom = useDeleteDataRoom();
  const [error, setError] = useState<string | null>(null);

  const canManage = Boolean(access?.canManageRoom);

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

  const tabs = [
    { href: `/data-rooms/${id}`, label: 'Files' },
    { href: `/data-rooms/${id}/activity`, label: 'Activity' },
    ...(canManage
      ? [
          { href: `/data-rooms/${id}/members`, label: 'Members' },
          { href: `/data-rooms/${id}/reports`, label: 'Reports' },
          { href: `/data-rooms/${id}/settings`, label: 'Settings' },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
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

      <div className="flex gap-4 border-b border-slate-200">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-1 py-2 text-sm font-medium ${
              pathname === tab.href
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
