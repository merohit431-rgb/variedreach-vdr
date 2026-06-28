'use client';

import { useState, FormEvent } from 'react';
import {
  useMembers,
  useInviteMember,
  useUpdateMemberRole,
  useRemoveMember,
  useResetMemberPassword,
} from '@/hooks/use-members';
import { USER_ROLES, ROLE_LABELS, type UserRole } from '@variedreach-vdr/shared';
import { extractErrorMessage } from '@/lib/error-message';

export function MembersPanel({ dataRoomId, canManage }: { dataRoomId: string; canManage: boolean }) {
  const { data: members, isLoading } = useMembers(dataRoomId);
  const inviteMember = useInviteMember(dataRoomId);
  const updateRole = useUpdateMemberRole(dataRoomId);
  const removeMember = useRemoveMember(dataRoomId);
  const resetPassword = useResetMemberPassword(dataRoomId);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('PRA');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await inviteMember.mutateAsync({ email, role });
      setEmail('');
      setNotice(`Invitation sent to ${email}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleResetPassword(userId: string, userEmail: string) {
    try {
      await resetPassword.mutateAsync(userId);
      setNotice(`Password reset email sent to ${userEmail}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <label htmlFor="invite-email" className="block text-xs font-medium text-slate-700">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-xs font-medium text-slate-700">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              {USER_ROLES.filter((r) => r !== 'SUPER_ADMIN').map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={inviteMember.isPending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Invite
          </button>
        </form>
      )}

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>}

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading members…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members?.map((member) => (
                <tr key={member.userId}>
                  <td className="px-4 py-3">
                    {member.user.firstName} {member.user.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{member.user.email}</td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <select
                        value={member.roleOverride ?? member.user.role}
                        onChange={(e) =>
                          updateRole.mutate({ userId: member.userId, role: e.target.value as UserRole })
                        }
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      >
                        {USER_ROLES.filter((r) => r !== 'SUPER_ADMIN').map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      ROLE_LABELS[member.roleOverride ?? member.user.role]
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{member.user.status}</td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleResetPassword(member.userId, member.user.email)}
                        className="mr-3 text-xs text-slate-500 hover:text-slate-900"
                      >
                        Reset password
                      </button>
                      <button
                        onClick={() => removeMember.mutate(member.userId)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
