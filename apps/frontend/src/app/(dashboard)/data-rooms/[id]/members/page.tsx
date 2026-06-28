'use client';

import { useParams } from 'next/navigation';
import { useDataRoomAccess } from '@/hooks/use-data-rooms';
import { MembersPanel } from '@/components/data-rooms/MembersPanel';

export default function DataRoomMembersPage() {
  const { id } = useParams<{ id: string }>();
  const { data: access } = useDataRoomAccess(id);
  const canManage = Boolean(access?.canManageRoom);

  return (
    <div className="pt-4">
      <MembersPanel dataRoomId={id} canManage={canManage} />
    </div>
  );
}
