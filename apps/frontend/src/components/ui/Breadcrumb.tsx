import { Fragment, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

const COLLAPSE_THRESHOLD = 4;

// Keeps the first item (root) and the last two (current + its parent),
// collapsing everything in between into a single non-interactive "...".
export function collapseBreadcrumbItems(items: BreadcrumbItem[]): BreadcrumbItem[] {
  if (items.length <= COLLAPSE_THRESHOLD) return items;
  return [items[0], { label: '...' }, ...items.slice(-2)];
}

export function Breadcrumb({ items, trailing }: { items: BreadcrumbItem[]; trailing?: ReactNode }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center justify-between gap-3">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              <li className="flex items-center gap-1.5 min-w-0">
                {item.onClick && !isLast ? (
                  <button
                    onClick={item.onClick}
                    className="truncate text-slate-500 hover:text-brand-600"
                  >
                    {item.label}
                  </button>
                ) : (
                  <span
                    className={isLast ? 'truncate font-medium text-slate-900' : 'truncate text-slate-500'}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </li>
              {!isLast && <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" aria-hidden="true" />}
            </Fragment>
          );
        })}
      </ol>
      {trailing}
    </nav>
  );
}
