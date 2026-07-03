'use client';

import { useParams } from 'next/navigation';
import { Shield, KeyRound } from 'lucide-react';
import { useDataRoomAccess } from '@/hooks/use-data-rooms';
import { useMfaStatus } from '@/hooks/use-mfa';
import { SecuritySettingsPanel } from '@/components/data-rooms/SecuritySettingsPanel';
import { MfaSettingsPanel } from '@/components/auth/MfaSettingsPanel';
import { Skeleton } from '@/components/ui/Skeleton';
import { useQueryClient } from '@tanstack/react-query';

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-app-border bg-app-s1 shadow-dark-soft">
      <div className="border-b border-app-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-s2">
            <Icon className="h-4 w-4 text-app-t3" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-app-text">{title}</p>
            <p className="text-xs text-app-t3">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function DataRoomSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: access } = useDataRoomAccess(id);
  const { data: mfaStatus, refetch: refetchMfa } = useMfaStatus();
  const queryClient = useQueryClient();

  function handleMfaStatusChange() {
    queryClient.invalidateQueries({ queryKey: ['auth', 'mfa-status'] });
    refetchMfa();
  }

  if (!access) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-app-border bg-app-s1 p-5 shadow-dark-soft">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-2 h-3 w-64" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const canManage = Boolean(access.canManageRoom);

  return (
    <div className="max-w-2xl space-y-4">
      <SettingsSection
        icon={KeyRound}
        title="Two-Factor Authentication"
        description="Protect your personal account with a time-based one-time password (TOTP)."
      >
        <MfaSettingsPanel
          isMfaEnabled={mfaStatus?.totpEnabled ?? false}
          onStatusChange={handleMfaStatusChange}
        />
      </SettingsSection>

      {canManage && (
        <SettingsSection
          icon={Shield}
          title="Data Room Security"
          description="Configure IP allowlisting and NDA requirements for this data room."
        >
          <SecuritySettingsPanel dataRoomId={id} />
        </SettingsSection>
      )}
    </div>
  );
}
