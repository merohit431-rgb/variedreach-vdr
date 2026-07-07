'use client';

import { Building2, Briefcase, Phone, Landmark, StickyNote, CalendarClock } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Avatar } from '@/components/ui/Avatar';
import { ROLE_LABELS } from '@variedreach-vdr/shared';
import type { Member } from '@/hooks/use-members';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function ProfileField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-app-t3" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-app-t4">{label}</p>
        <p className="text-sm text-app-text">{value}</p>
      </div>
    </div>
  );
}

export function MemberProfileModal({
  member,
  onClose,
}: {
  member: Member | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={member !== null}
      onClose={onClose}
      title="Member Profile"
      className="max-w-md"
    >
      {member && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Avatar name={`${member.user.firstName} ${member.user.lastName}`} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-app-text">
                {member.user.firstName} {member.user.lastName}
              </p>
              <p className="truncate text-xs text-app-t3">{member.user.email}</p>
              <span className="mt-1 inline-block rounded-full bg-app-primary/15 px-2.5 py-0.5 text-xs font-medium text-blue-300">
                {ROLE_LABELS[member.roleOverride ?? member.user.role]}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-lg border border-app-border bg-app-s2 p-4">
            <ProfileField icon={Briefcase} label="Company" value={member.user.company} />
            <ProfileField icon={Landmark} label="Designation" value={member.user.designation} />
            <ProfileField icon={Phone} label="Mobile" value={member.user.mobile} />
            <ProfileField
              icon={Building2}
              label="Organisation (this room)"
              value={member.clientOrganisation}
            />
          </div>

          {member.notes && (
            <div className="rounded-lg border border-app-border bg-app-s2 p-4">
              <div className="flex items-start gap-2.5">
                <StickyNote className="mt-0.5 h-4 w-4 flex-shrink-0 text-app-t3" aria-hidden="true" />
                <div>
                  <p className="text-xs text-app-t4">Notes</p>
                  <p className="whitespace-pre-wrap text-sm text-app-text">{member.notes}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 border-t border-app-border pt-4">
            <CalendarClock className="mt-0.5 h-4 w-4 flex-shrink-0 text-app-t3" aria-hidden="true" />
            <div className="text-xs text-app-t3">
              <p>Invited {formatDate(member.invitedAt)}</p>
              <p>{member.joinedAt ? `Joined ${formatDate(member.joinedAt)}` : 'Not yet accepted'}</p>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
