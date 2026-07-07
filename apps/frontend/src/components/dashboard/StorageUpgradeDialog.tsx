'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useRequestStorageUpgrade } from '@/hooks/use-dashboard';
import { cn } from '@/lib/cn';

const PRESET_ADD_GB = [10, 25, 50] as const;

interface StorageUpgradeDialogProps {
  open: boolean;
  onClose: () => void;
  currentGb: number;
}

export function StorageUpgradeDialog({ open, onClose, currentGb }: StorageUpgradeDialogProps) {
  const requestUpgrade = useRequestStorageUpgrade();
  const [addGb, setAddGb] = useState<number>(PRESET_ADD_GB[0]);
  const [customGb, setCustomGb] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const requestedGb = customGb ? Number(customGb) : currentGb + addGb;

  function handleClose() {
    onClose();
    // Reset after the close animation so the dialog doesn't flash old state on next open.
    setTimeout(() => {
      setAddGb(PRESET_ADD_GB[0]);
      setCustomGb('');
      setNote('');
      setError('');
      setSent(false);
    }, 200);
  }

  async function handleSubmit() {
    if (!requestedGb || requestedGb <= currentGb) {
      setError(`Enter an amount greater than your current ${currentGb} GB plan`);
      return;
    }
    setIsSubmitting(true);
    setError('');
    const res = await requestUpgrade(requestedGb, note.trim() || undefined);
    setIsSubmitting(false);
    if (!res.success) {
      setError(res.message ?? 'Could not send the request. Please try again.');
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Dialog open={open} onClose={handleClose} title="Request sent">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden="true" />
          <p className="text-sm text-app-t2">
            We&apos;ve notified our team about your request for {requestedGb} GB. We&apos;ll be in touch shortly to get
            it activated.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleClose}>Done</Button>
        </DialogFooter>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Need more storage?"
      description={`You're currently on the ${currentGb} GB plan.`}
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium text-app-t3">Add to your plan</p>
          <div className="grid grid-cols-3 gap-2">
            {PRESET_ADD_GB.map((gb) => (
              <button
                key={gb}
                type="button"
                onClick={() => {
                  setAddGb(gb);
                  setCustomGb('');
                }}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                  !customGb && addGb === gb
                    ? 'border-app-primary bg-app-primary/10 text-app-primary'
                    : 'border-app-border text-app-t2 hover:border-app-border2',
                )}
              >
                +{gb} GB
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="custom-gb" className="mb-1 block text-xs font-medium text-app-t3">
            Or enter a custom total (GB)
          </label>
          <input
            id="custom-gb"
            type="number"
            min={currentGb + 1}
            value={customGb}
            onChange={(e) => setCustomGb(e.target.value)}
            placeholder={`e.g. ${currentGb + 100}`}
            className="h-10 w-full rounded-lg border border-app-border bg-app-s2 px-3 text-sm text-app-text placeholder:text-app-t4 focus:border-app-primary focus:outline-none focus:ring-2 focus:ring-app-primary/20"
          />
        </div>

        <div>
          <label htmlFor="upgrade-note" className="mb-1 block text-xs font-medium text-app-t3">
            Note (optional)
          </label>
          <textarea
            id="upgrade-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Anything we should know?"
            className="w-full resize-none rounded-lg border border-app-border bg-app-s2 px-3 py-2 text-sm text-app-text placeholder:text-app-t4 focus:border-app-primary focus:outline-none focus:ring-2 focus:ring-app-primary/20"
          />
        </div>

        <p className="text-xs text-app-t4">
          You&apos;ll be requesting <span className="font-semibold text-app-t2">{requestedGb || '—'} GB</span> total.
          Our team will action this and confirm by email.
        </p>

        {error && <Alert tone="danger">{error}</Alert>}
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} isLoading={isSubmitting}>
          Send request
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
