'use client';

import { useState } from 'react';
import { Shield, FileText } from 'lucide-react';
import { useNdaStatus, useAcceptNda } from '@/hooks/use-nda';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { extractErrorMessage } from '@/lib/error-message';

export function NdaGateModal({
  dataRoomId,
  children,
}: {
  dataRoomId: string;
  children: React.ReactNode;
}) {
  const { data: nda, isLoading } = useNdaStatus(dataRoomId);
  const acceptNda = useAcceptNda(dataRoomId);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return <p className="text-sm text-app-t3">Loading…</p>;
  }

  if (!nda || !nda.enabled || nda.hasAccepted) {
    return <>{children}</>;
  }

  async function handleAccept() {
    try {
      await acceptNda.mutateAsync();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl bg-app-s1 shadow-xl">
        <div className="flex items-center gap-3 border-b border-app-border px-6 py-4">
          <div className="rounded-lg bg-app-primary/10 p-2">
            <Shield className="h-5 w-5 text-app-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-app-text">Non-Disclosure Agreement</h2>
            <p className="text-sm text-app-t3">You must accept the NDA to access this data room.</p>
          </div>
        </div>

        <div className="px-6 py-4">
          {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

          {nda.text ? (
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-app-t3" />
              <div
                className="max-h-64 overflow-y-auto rounded-md border border-app-border bg-app-s2 p-4 text-sm text-app-t2 whitespace-pre-wrap"
              >
                {nda.text}
              </div>
            </div>
          ) : (
            <p className="rounded-md bg-app-s2 p-4 text-sm text-app-t2">
              By clicking &ldquo;Accept&rdquo;, you agree to keep all information within this data
              room confidential and not to disclose it to any third party without prior written
              consent.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-app-border px-6 py-4">
          <Button
            onClick={handleAccept}
            isLoading={acceptNda.isPending}
            className="min-w-32"
          >
            Accept &amp; Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
