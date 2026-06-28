'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { MembersPanel } from '@/components/data-rooms/MembersPanel';
import { isDataRoomManager } from '@variedreach-vdr/shared';

export default function DataRoomMembersPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canManage = Boolean(user && isDataRoomManager(user.role));

  return (
    <div className="pt-4">
      <MembersPanel dataRoomId={id} canManage={canManage} />
    </div>
  );
}
