'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useDataRooms } from '@/hooks/use-data-rooms';
import { useAuthStore } from '@/store/auth-store';
import { EXTERNAL_ROLES } from '@variedreach-vdr/shared';
import { DataRoomList } from '@/components/data-rooms/DataRoomList';

export default function DataRoomsPage() {
  const { user } = useAuthStore();
  const { data: dataRooms } = useDataRooms();
  const isExternal = user ? EXTERNAL_ROLES.includes(user.role) : false;
  const count = dataRooms?.length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {isExternal ? 'My Assignments' : 'Data Rooms'}
          </h1>
          {count > 0 && (
            <p className="mt-0.5 text-sm text-slate-400">
              {count} {count === 1 ? 'room' : 'rooms'}
            </p>
          )}
        </div>
        {!isExternal && (
          <Link
            href="/data-rooms/new"
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Data Room
          </Link>
        )}
      </div>
      <DataRoomList />
    </div>
  );
}
