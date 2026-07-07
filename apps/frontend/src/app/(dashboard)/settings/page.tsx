'use client';

import { KeyRound, UserCircle, Monitor } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { EmailOtpSettingsPanel } from '@/components/auth/EmailOtpSettingsPanel';
import { SessionsPanel } from '@/components/auth/SessionsPanel';
import { Avatar } from '@/components/ui/Avatar';
import { ROLE_LABELS } from '@variedreach-vdr/shared';

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
            <p className="text-xs text-app-t4">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function AccountSettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-app-text">Account settings</h1>
        <p className="mt-0.5 text-sm text-app-t4">
          Manage your personal account and security preferences.
        </p>
      </div>

      <SettingsSection
        icon={UserCircle}
        title="Profile"
        description="Your account details across every data room."
      >
        {user ? (
          <div className="flex items-center gap-4">
            <Avatar name={`${user.firstName} ${user.lastName}`} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-app-text">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-sm text-app-t3">{user.email}</p>
              <span className="mt-1.5 inline-block rounded-full bg-app-primary/15 px-2.5 py-0.5 text-xs font-medium text-blue-300">
                {ROLE_LABELS[user.role]}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-app-t4">Loading your profile…</p>
        )}
      </SettingsSection>

      <SettingsSection
        icon={KeyRound}
        title="Two-Factor Authentication"
        description="Add a verification step to protect your account."
      >
        <EmailOtpSettingsPanel />
      </SettingsSection>

      <SettingsSection
        icon={Monitor}
        title="Active Sessions"
        description="Devices currently signed in to your account."
      >
        <SessionsPanel />
      </SettingsSection>
    </div>
  );
}
