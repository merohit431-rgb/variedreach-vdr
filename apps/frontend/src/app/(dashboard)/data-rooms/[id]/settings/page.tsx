'use client';

import { useParams } from 'next/navigation';
import { useDataRoomAccess } from '@/hooks/use-data-rooms';
import { useMfaStatus } from '@/hooks/use-mfa';
import { SecuritySettingsPanel } from '@/components/data-rooms/SecuritySettingsPanel';
import { MfaSettingsPanel } from '@/components/auth/MfaSettingsPanel';
import { useQueryClient } from '@tanstack/react-query';

export default function DataRoomSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: access } = useDataRoomAccess(id);
  const { data: mfaStatus, refetch: refetchMfa } = useMfaStatus();
  const queryClient = useQueryClient();

  const canManage = Boolean(access?.canManageRoom);

  function handleMfaStatusChange() {
    queryClient.invalidateQueries({ queryKey: ['auth', 'mfa-status'] });
    refetchMfa();
  }

  if (!access) {
    return <p className="text-sm text-slate-400 pt-4">Loading…</p>;
  }

  return (
    <div className="space-y-8 pt-4">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Two-Factor Authentication
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Protect your personal account with a time-based one-time password (TOTP).
        </p>
        <div className="mt-4">
          <MfaSettingsPanel
            isMfaEnabled={mfaStatus?.totpEnabled ?? false}
            onStatusChange={handleMfaStatusChange}
          />
        </div>
      </section>

      {canManage && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Data Room Security
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Configure IP allowlisting and NDA requirements for this data room.
          </p>
          <SecuritySettingsPanel dataRoomId={id} />
        </section>
      )}
    </div>
  );
}
