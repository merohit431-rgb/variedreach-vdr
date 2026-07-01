'use client';

import { useParams } from 'next/navigation';
import { useDataRoomAccess } from '@/hooks/use-data-rooms';
import { QnaPanel } from '@/components/data-rooms/QnaPanel';
import { useAuthStore } from '@/store/auth-store';

const MANAGER_ROLES = ['SUPER_ADMIN', 'ORG_ADMIN', 'RP_LIQUIDATOR'];

export default function DataRoomQnaPage() {
  const { id } = useParams<{ id: string }>();
  const { data: access } = useDataRoomAccess(id);
  const user = useAuthStore((s) => s.user);

  const isManager = Boolean(
    access?.canManageRoom || (user?.role && MANAGER_ROLES.includes(user.role)),
  );

  return <QnaPanel dataRoomId={id} isManager={isManager} />;
}
