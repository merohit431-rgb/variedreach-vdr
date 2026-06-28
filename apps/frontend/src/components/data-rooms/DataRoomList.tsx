'use client';

import Link from 'next/link';
import { useDataRooms } from '@/hooks/use-data-rooms';
import { DATA_ROOM_TYPE_LABELS } from '@variedreach-vdr/shared';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700',
  ARCHIVED: 'bg-slate-100 text-slate-600',
  SUSPENDED: 'bg-red-50 text-red-700',
};

export function DataRoomList() {
  const { data: dataRooms, isLoading } = useDataRooms();

  if (isLoading) {
    return <p className="text-sm text-slate-400">Loading data rooms…</p>;
  }

  if (!dataRooms || dataRooms.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm text-slate-500">No data rooms yet.</p>
        <Link href="/data-rooms/new" className="mt-2 inline-block text-sm font-medium text-slate-900 underline">
          Create your first data room
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Case Number</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {dataRooms.map((room) => (
            <tr key={room.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`/data-rooms/${room.id}`} className="font-medium text-slate-900 hover:underline">
                  {room.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{DATA_ROOM_TYPE_LABELS[room.type]}</td>
              <td className="px-4 py-3 text-slate-600">{room.caseNumber || '—'}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[room.status]}`}>
                  {room.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
