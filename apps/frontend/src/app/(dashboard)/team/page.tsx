'use client';

import { useAuthStore } from '@/store/auth-store';
import { TeamPanel } from '@/components/team/TeamPanel';
import { NotAuthorized } from '@/components/shared/NotAuthorized';

export default function TeamPage() {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;
  if (user.role !== 'ORG_ADMIN' && user.role !== 'SUPER_ADMIN') {
    return <NotAuthorized />;
  }

  return <TeamPanel organisationId={user.organisationId} />;
}
