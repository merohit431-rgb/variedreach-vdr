'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Hold the latest onClose in a ref so the focus-management effect below can
  // depend on `open` ALONE. Callers almost always pass onClose as a fresh
  // closure each render (e.g. `onClose={() => setOpen(false)}` or a handler
  // recreated inside a form component). If the effect depended on onClose, then
  // every keystroke in an input rendered inside the dialog would re-run the
  // effect -- and its cleanup calls `previouslyFocused.focus()`, ripping focus
  // out of the field mid-typing and back onto the trigger behind the modal.
  // That was the "Invite Member modal loses focus / tries to close on every
  // character" bug: the 7-field form re-renders on each keystroke, minting a
  // new onClose reference every time. Keeping onClose in a ref decouples the
  // effect's identity from the caller's render cycle.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Respect a native `autoFocus` element inside the panel (e.g. PromptDialog's
    // input) if one already grabbed focus during commit, rather than stealing
    // it back to the first focusable node (the close button) unconditionally.
    if (!panel?.contains(document.activeElement)) {
      const focusable = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      focusable?.[0]?.focus();
    }

    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }

      if (event.key === 'Tab' && panel) {
        const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previouslyFocused?.focus();
    };
    // Depends on `open` only -- see onCloseRef note above. This effect must run
    // exactly once per open/close, never on content re-renders.
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? 'dialog-description' : undefined}
        className={cn(
          'relative w-full max-w-md animate-scale-in rounded-xl bg-app-s1 p-6 shadow-dark-popover',
          className,
        )}
      >
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-md p-1 text-app-t3 hover:bg-app-s2 hover:text-app-t2"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 id="dialog-title" className="text-base font-semibold text-app-text">
          {title}
        </h2>
        {description && (
          <p id="dialog-description" className="mt-1 text-sm text-app-t3">
            {description}
          </p>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex justify-end gap-2">{children}</div>;
}
