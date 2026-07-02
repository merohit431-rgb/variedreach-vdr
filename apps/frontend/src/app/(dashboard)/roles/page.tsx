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
        <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} aria-label="Allowed" />
      </span>
    );
  if (value === 'partial')
    return <span className="text-xs font-medium text-amber-600">Own</span>;
  return (
    <span className="inline-flex items-center justify-center">
      <Minus className="h-3.5 w-3.5 text-slate-200" aria-label="Not allowed" />
    </span>
  );
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-violet-50 text-violet-700 ring-violet-200',
  ORG_ADMIN: 'bg-brand-50 text-brand-700 ring-brand-200',
  RP_LIQUIDATOR: 'bg-blue-50 text-blue-700 ring-blue-200',
  PRA: 'bg-teal-50 text-teal-700 ring-teal-200',
  COC_MEMBER: 'bg-orange-50 text-orange-700 ring-orange-200',
  AUDITOR: 'bg-amber-50 text-amber-700 ring-amber-200',
  LEGAL_ADVISOR: 'bg-rose-50 text-rose-700 ring-rose-200',
  GUEST: 'bg-slate-50 text-slate-600 ring-slate-200',
};

export default function RolesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Roles & Permissions</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          What each role can do across every data room. Per-room overrides are set under a data
          room&apos;s Members tab.
        </p>
      </div>

      {/* Role profile cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLE_PROFILES.map((profile) => (
          <div
            key={profile.role}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft"
          >
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${ROLE_COLORS[profile.role] ?? 'bg-slate-50 text-slate-600 ring-slate-200'}`}
            >
              {ROLE_LABELS[profile.role]}
            </span>
            <p className="mt-2.5 text-xs leading-relaxed text-slate-500">{profile.description}</p>
            <p className="mt-2 text-[11px] font-medium text-slate-400">{profile.typicalUser}</p>
          </div>
        ))}
      </div>

      {/* Permission matrix table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-soft">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Permission
              </th>
              {USER_ROLES.map((role) => (
                <th
                  key={role}
                  className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  <span className="hidden sm:inline">{ROLE_LABELS[role]}</span>
                  <span className="sm:hidden">{role.split('_')[0]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {PERMISSION_KEYS.map((key, i) => (
              <tr key={key} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                <td className="px-4 py-2.5 text-sm font-medium text-slate-800">
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
