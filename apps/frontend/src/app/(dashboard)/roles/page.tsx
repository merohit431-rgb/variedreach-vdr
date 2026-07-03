import {
  USER_ROLES,
  ROLE_LABELS,
  ROLE_PROFILES,
  PERMISSION_LABELS,
  PERMISSION_MATRIX,
  type PermissionKey,
} from '@variedreach-vdr/shared';
import { Check, Minus } from 'lucide-react';

const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as PermissionKey[];

function Cell({ value }: { value: boolean | 'partial' }) {
  if (value === true)
    return (
      <span className="inline-flex items-center justify-center">
        <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.5} aria-label="Allowed" />
      </span>
    );
  if (value === 'partial')
    return <span className="text-xs font-medium text-amber-400">Own</span>;
  return (
    <span className="inline-flex items-center justify-center">
      <Minus className="h-3.5 w-3.5 text-app-border2" aria-label="Not allowed" />
    </span>
  );
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-violet-500/10 text-violet-300 ring-violet-500/30',
  ORG_ADMIN: 'bg-app-primary/10 text-blue-300 ring-app-primary/30',
  RP_LIQUIDATOR: 'bg-blue-500/10 text-blue-300 ring-blue-500/30',
  PRA: 'bg-teal-500/10 text-teal-300 ring-teal-500/30',
  COC_MEMBER: 'bg-orange-500/10 text-orange-300 ring-orange-500/30',
  AUDITOR: 'bg-amber-500/10 text-amber-400 ring-amber-500/30',
  LEGAL_ADVISOR: 'bg-rose-500/10 text-rose-300 ring-rose-500/30',
  GUEST: 'bg-app-s2 text-app-t2 ring-app-border',
};

export default function RolesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-app-text">Roles & Permissions</h1>
        <p className="mt-0.5 text-sm text-app-t3">
          What each role can do across every data room. Per-room overrides are set under a data
          room&apos;s Members tab.
        </p>
      </div>

      {/* Role profile cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLE_PROFILES.map((profile) => (
          <div
            key={profile.role}
            className="rounded-xl border border-app-border bg-app-s1 p-4 shadow-dark-soft"
          >
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${ROLE_COLORS[profile.role] ?? 'bg-app-s2 text-app-t2 ring-app-border'}`}
            >
              {ROLE_LABELS[profile.role]}
            </span>
            <p className="mt-2.5 text-xs leading-relaxed text-app-t3">{profile.description}</p>
            <p className="mt-2 text-[11px] font-medium text-app-t3">{profile.typicalUser}</p>
          </div>
        ))}
      </div>

      {/* Permission matrix table */}
      <div className="overflow-x-auto rounded-xl border border-app-border bg-app-s1 shadow-dark-soft">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-app-border bg-app-s2">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-app-t3">
                Permission
              </th>
              {USER_ROLES.map((role) => (
                <th
                  key={role}
                  className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-app-t3"
                >
                  <span className="hidden sm:inline">{ROLE_LABELS[role]}</span>
                  <span className="sm:hidden">{role.split('_')[0]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {PERMISSION_KEYS.map((key, i) => (
              <tr key={key} className={i % 2 === 0 ? 'bg-app-s1' : 'bg-app-s2/40'}>
                <td className="px-4 py-2.5 text-sm font-medium text-app-text">
                  {PERMISSION_LABELS[key]}
                </td>
                {USER_ROLES.map((role) => (
                  <td key={role} className="px-3 py-2.5 text-center">
                    <Cell value={PERMISSION_MATRIX[key][role]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
