'use client';

import { useState } from 'react';
import { useUpdateDataRoom } from '@/hooks/use-data-rooms';
import { DOWNLOAD_POLICIES, DOWNLOAD_POLICY_LABELS, DOWNLOAD_POLICY_DESCRIPTIONS, type DownloadPolicy } from '@variedreach-vdr/shared';
import { extractErrorMessage } from '@/lib/error-message';

export function SecuritySettingsPanel({
  dataRoomId,
  currentPolicy,
}: {
  dataRoomId: string;
  currentPolicy: DownloadPolicy;
}) {
  const updateDataRoom = useUpdateDataRoom(dataRoomId);
  const [selected, setSelected] = useState<DownloadPolicy>(currentPolicy);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dirty = selected !== currentPolicy;

  async function handleSave() {
    setError(null);
    setNotice(null);
    try {
      await updateDataRoom.mutateAsync({ downloadPolicy: selected });
      setNotice('Download policy updated');
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Security Settings</h2>
        <p className="mt-1 text-xs text-slate-500">
          Controls who can take documents out of this data room, and in what form.
        </p>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-medium text-slate-900">Document Access Policy</h3>
          <p className="mt-1 text-xs text-slate-500">
            Applies to every user who already has download permission in this data room.
          </p>

          <div className="mt-3 space-y-2">
            {DOWNLOAD_POLICIES.map((policy) => (
              <label
                key={policy}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                  selected === policy ? 'border-slate-900 bg-slate-50' : 'border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="download-policy"
                  value={policy}
                  checked={selected === policy}
                  onChange={() => setSelected(policy)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{DOWNLOAD_POLICY_LABELS[policy]}</span>
                  <span className="block text-xs text-slate-500">{DOWNLOAD_POLICY_DESCRIPTIONS[policy]}</span>
                </span>
              </label>
            ))}
          </div>

          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            External roles (PRA, CoC Member, Auditor, Legal Advisor, Guest) can never receive unwatermarked
            original files, regardless of this setting.
          </p>

          {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {notice && <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>}

          <button
            onClick={handleSave}
            disabled={!dirty || updateDataRoom.isPending}
            className="mt-4 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {updateDataRoom.isPending ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
