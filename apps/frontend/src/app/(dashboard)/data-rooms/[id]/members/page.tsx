'use client';

import { useParams } from 'next/navigation';
import { useDataRoomAccess } from '@/hooks/use-data-rooms';
import { MembersPanel } from '@/components/data-rooms/MembersPanel';
import { NotAuthorized } from '@/components/shared/NotAuthorized';

export default function DataRoomMembersPage() {
  const { id } = useParams<{ id: string }>();
  const { data: access, isLoading } = useDataRoomAccess(id);

  if (isLoading) {
    return <p className="pt-4 text-sm text-slate-400">Loading…</p>;
  }

  if (!access?.canManageRoom) {
    return (
      <div className="pt-4">
        <NotAuthorized />
      </div>
    );
  }

  return (
    <div className="pt-4">
      <MembersPanel dataRoomId={id} canManage={access.canManageRoom} />
    </div>
  );
}
