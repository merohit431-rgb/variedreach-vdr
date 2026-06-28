import {
  USER_ROLES,
  ROLE_LABELS,
  ROLE_PROFILES,
  PERMISSION_LABELS,
  PERMISSION_MATRIX,
  type PermissionKey,
} from '@variedreach-vdr/shared';

const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as PermissionKey[];

function Cell({ value }: { value: boolean | 'partial' }) {
  if (value === true) return <span className="text-green-600">✓</span>;
  if (value === 'partial') return <span className="text-amber-600">Own room</span>;
  return <span className="text-slate-300">—</span>;
}

export default function RolesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Roles & Permissions</h1>
        <p className="mt-1 text-sm text-slate-500">
          What each role can do across every data room. Per-data-room role overrides (set under a
          data room&apos;s Members tab) follow these same rules.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLE_PROFILES.map((profile) => (
          <div key={profile.role} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">{ROLE_LABELS[profile.role]}</p>
            <p className="mt-1 text-xs text-slate-500">{profile.description}</p>
            <p className="mt-2 text-xs font-medium text-slate-400">{profile.typicalUser}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Permission</th>
              {USER_ROLES.map((role) => (
                <th key={role} className="px-3 py-3 text-center">
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {PERMISSION_KEYS.map((key) => (
              <tr key={key}>
                <td className="px-4 py-3 font-medium text-slate-900">{PERMISSION_LABELS[key]}</td>
                {USER_ROLES.map((role) => (
                  <td key={role} className="px-3 py-3 text-center">
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
