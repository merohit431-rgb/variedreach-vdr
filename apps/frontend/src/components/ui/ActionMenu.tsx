'use client';

import { useEffect, useRef, useState, MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/cn';

const VIEWPORT_MARGIN = 8;
const MENU_WIDTH = 176;

export interface ActionMenuItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  danger?: boolean;
}

// Hover-reveal "⋮" trigger + portal-rendered dropdown, used for both file and
// folder rows -- portalled to document.body since these rows live inside
// overflow-hidden table/tree containers that would otherwise clip the menu.
export function ActionMenu({ items }: { items: ActionMenuItem[] }) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!position) return;

    function close() {
      setPosition(null);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setPosition(null);
    }

    document.addEventListener('click', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [position]);

  function toggle(event: MouseEvent) {
    event.stopPropagation();
    if (position) {
      setPosition(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      top: rect.bottom + 4,
      left: Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN),
    });
  }

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggle}
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={position !== null}
        className="rounded-md p-1.5 text-app-t3 hover:bg-app-s2 hover:text-app-t2"
      >
        <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {position &&
        createPortal(
          <div
            role="menu"
            className="fixed z-50 w-44 rounded-md border border-app-border bg-app-s1 py-1 text-sm shadow-lg"
            style={{ top: position.top, left: position.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item) => (
              <button
                key={item.key}
                role="menuitem"
                onClick={() => {
                  item.onClick();
                  setPosition(null);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left',
                  item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-app-t2 hover:bg-app-s2',
                )}
              >
                <item.icon
                  className={cn('h-3.5 w-3.5', item.danger ? '' : 'text-app-t3')}
                  aria-hidden="true"
                />
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
