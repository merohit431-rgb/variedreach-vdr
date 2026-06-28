'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Dialog, DialogFooter } from './Dialog';
import { Button } from './Button';
import { Input } from './Input';

interface PromptDialogProps {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  initialValue?: string;
  confirmLabel?: string;
  isLoading?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({
  open,
  title,
  description,
  label,
  initialValue = '',
  confirmLabel = 'Save',
  isLoading,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
  }

  return (
    <Dialog open={open} onClose={onCancel} title={title} description={description}>
      <form onSubmit={handleSubmit}>
        <label htmlFor="prompt-dialog-input" className="block text-sm font-medium text-slate-700">
          {label}
        </label>
        <Input
          id="prompt-dialog-input"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1.5"
        />
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading} disabled={!value.trim()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
