'use client';

import { ReactNode, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

const VIEWPORT_MARGIN = 8;

export function Tooltip({
  label,
  children,
  side = 'right',
}: {
  label: string;
  children: ReactNode;
  side?: 'right' | 'top';
}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  function show() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (side === 'top') {
      setPosition({
        top: rect.top - 8,
        left: Math.min(Math.max(rect.left + rect.width / 2, VIEWPORT_MARGIN), window.innerWidth - VIEWPORT_MARGIN),
      });
    } else {
      setPosition({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    }
  }

  function hide() {
    setPosition(null);
  }

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex max-w-full"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {position &&
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            className={cn(
              'pointer-events-none fixed z-50 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white',
              side === 'top' ? '-translate-x-1/2 -translate-y-full' : '-translate-y-1/2',
            )}
            style={{ top: position.top, left: position.left }}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
