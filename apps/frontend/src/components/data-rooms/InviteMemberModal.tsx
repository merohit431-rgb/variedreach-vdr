'use client';

import { useState, FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useInviteMember, type InviteMemberInput } from '@/hooks/use-members';
import { USER_ROLES, ROLE_LABELS, type UserRole } from '@variedreach-vdr/shared';
import { extractErrorMessage } from '@/lib/error-message';

const EMPTY_FORM: InviteMemberInput = {
  fullName: '',
  email: '',
  role: 'PRA',
  clientOrganisation: '',
  company: '',
  designation: '',
  mobile: '',
  notes: '',
};

const FIELD_CLASSES =
  'mt-1.5 w-full rounded-lg border border-app-border px-3 py-2 text-sm text-app-text placeholder:text-app-t4 focus:border-app-primary focus:outline-none focus:ring-2 focus:ring-app-primary/20';
const LABEL_CLASSES = 'block text-xs font-medium text-app-t2';

export function InviteMemberModal({
  dataRoomId,
  open,
  onClose,
  onInvited,
}: {
  dataRoomId: string;
  open: boolean;
  onClose: () => void;
  onInvited: (message: string) => void;
}) {
  const inviteMember = useInviteMember(dataRoomId);
  const [form, setForm] = useState<InviteMemberInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof InviteMemberInput>(key: K, value: InviteMemberInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setForm(EMPTY_FORM);
    setError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const payload: InviteMemberInput = {
        fullName: form.fullName,
        email: form.email,
        role: form.role,
        ...(form.clientOrganisation ? { clientOrganisation: form.clientOrganisation } : {}),
        ...(form.company ? { company: form.company } : {}),
        ...(form.designation ? { designation: form.designation } : {}),
        ...(form.mobile ? { mobile: form.mobile } : {}),
        ...(form.notes ? { notes: form.notes } : {}),
      };
      const result = await inviteMember.mutateAsync(payload);
      handleClose();
      onInvited(
        result.emailSent
          ? `Invitation sent to ${form.email}`
          : `Member added, but the invitation email failed to send to ${form.email}. Use "Resend invite" to try again.`,
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Invite Member"
      description="Add an internal or external professional to this data room."
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="invite-fullName" className={LABEL_CLASSES}>
              Full Name
            </label>
            <input
              id="invite-fullName"
              required
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              placeholder="Jane Doe"
              className={FIELD_CLASSES}
            />
          </div>
          <div>
            <label htmlFor="invite-email" className={LABEL_CLASSES}>
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="name@company.com"
              className={FIELD_CLASSES}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="invite-role" className={LABEL_CLASSES}>
              Role
            </label>
            <select
              id="invite-role"
              value={form.role}
              onChange={(e) => update('role', e.target.value as UserRole)}
              className={FIELD_CLASSES}
            >
              {USER_ROLES.filter((r) => r !== 'SUPER_ADMIN').map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="invite-mobile" className={LABEL_CLASSES}>
              Mobile
            </label>
            <input
              id="invite-mobile"
              type="tel"
              value={form.mobile}
              onChange={(e) => update('mobile', e.target.value)}
              placeholder="+91 98765 43210"
              className={FIELD_CLASSES}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="invite-company" className={LABEL_CLASSES}>
              Company
            </label>
            <input
              id="invite-company"
              value={form.company}
              onChange={(e) => update('company', e.target.value)}
              placeholder="Their employer, e.g. Deloitte"
              className={FIELD_CLASSES}
            />
          </div>
          <div>
            <label htmlFor="invite-designation" className={LABEL_CLASSES}>
              Designation
            </label>
            <input
              id="invite-designation"
              value={form.designation}
              onChange={(e) => update('designation', e.target.value)}
              placeholder="e.g. Senior Associate"
              className={FIELD_CLASSES}
            />
          </div>
        </div>

        <div>
          <label htmlFor="invite-clientOrganisation" className={LABEL_CLASSES}>
            Organisation (client entity they represent in this room)
          </label>
          <input
            id="invite-clientOrganisation"
            value={form.clientOrganisation}
            onChange={(e) => update('clientOrganisation', e.target.value)}
            placeholder="e.g. Kalra Textiles Pvt Ltd"
            className={FIELD_CLASSES}
          />
        </div>

        <div>
          <label htmlFor="invite-notes" className={LABEL_CLASSES}>
            Notes
          </label>
          <textarea
            id="invite-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Any context for this invite (optional)"
            className={FIELD_CLASSES}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={inviteMember.isPending}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {inviteMember.isPending ? 'Inviting…' : 'Send Invite'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
