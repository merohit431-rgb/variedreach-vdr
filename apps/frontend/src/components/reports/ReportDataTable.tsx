'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ReportDataTableProps {
  headers: string[];
  rows: (string | number)[][];
  pageSize?: number;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T/;
const MIN_COL_WIDTH = 90;
const MAX_INITIAL_COL_WIDTH = 260;

function formatCell(value: string | number): string {
  if (typeof value === 'string' && ISO_DATE_RE.test(value)) {
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
  return String(value);
}

function initialColWidths(headers: string[]): number[] {
  return headers.map((h) => Math.min(MAX_INITIAL_COL_WIDTH, Math.max(MIN_COL_WIDTH + 30, h.length * 9 + 56)));
}

export function ReportDataTable({ headers, rows, pageSize = 25 }: ReportDataTableProps) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [colWidths, setColWidths] = useState<number[]>(() => initialColWidths(headers));
  const resizing = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(q)));
  }, [rows, search]);

  const sorted = useMemo(() => {
    if (sortCol === null) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const pageCount = Math.ceil(sorted.length / pageSize);
  const pageRows = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);

  function handleSortHeader(colIdx: number) {
    if (sortCol === colIdx) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(colIdx);
      setSortDir('asc');
    }
    setPage(0);
  }

  function handleSearch(value: string) {
    setSearch(value);
    setPage(0);
  }

  function handleResizeStart(e: React.MouseEvent, colIdx: number) {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = { colIdx, startX: e.clientX, startWidth: colWidths[colIdx] };
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
  }

  function handleResizeMove(e: MouseEvent) {
    const active = resizing.current;
    if (!active) return;
    const delta = e.clientX - active.startX;
    setColWidths((prev) => {
      const next = [...prev];
      next[active.colIdx] = Math.max(MIN_COL_WIDTH, active.startWidth + delta);
      return next;
    });
  }

  function handleResizeEnd() {
    resizing.current = null;
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeEnd);
  }

  return (
    <div className="min-w-0 space-y-2.5">
      {/* Search / filter */}
      <div className="flex items-center justify-between gap-4">
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Filter results…"
          className="w-56 rounded-md border border-app-border2 bg-app-s1 px-3 py-1.5 text-xs text-app-text focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <p className="flex-shrink-0 text-xs text-app-t3">
          {sorted.length} {sorted.length === 1 ? 'row' : 'rows'}
          {search && ` matching "${search}"`}
        </p>
      </div>

      {/* Table -- bounded height so the sticky header/column have a scroll
          region of their own; horizontal + vertical scroll both stay
          contained here and never leak out to the page. */}
      <div className="max-h-[65vh] min-w-0 overflow-auto rounded-lg border border-app-border bg-app-s1">
        <table
          className="text-left text-sm"
          style={{ width: `max(${totalWidth}px, 100%)`, tableLayout: 'fixed' }}
        >
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {headers.map((header, i) => (
                <th
                  key={header}
                  className={cn(
                    'sticky top-0 z-10 border-b border-app-border bg-app-s2 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-app-t3',
                    i === 0 && 'left-0 z-20',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleSortHeader(i)}
                    className="flex w-full min-w-0 select-none items-center gap-1 truncate text-left hover:text-app-text"
                  >
                    <span className="truncate">{header}</span>
                    {sortCol === i ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3 flex-shrink-0 text-app-t2" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="h-3 w-3 flex-shrink-0 text-app-t2" aria-hidden="true" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 flex-shrink-0 text-app-t4" aria-hidden="true" />
                    )}
                  </button>
                  {/* Column resize handle */}
                  <div
                    onMouseDown={(e) => handleResizeStart(e, i)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-app-primary/50"
                    aria-hidden="true"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-3 py-8 text-center text-sm text-app-t3">
                  No results.
                </td>
              </tr>
            ) : (
              pageRows.map((row, rowIdx) => {
                const zebraBg = rowIdx % 2 === 1 ? 'bg-app-s2/30' : 'bg-app-s1';
                return (
                  <tr key={rowIdx} className={cn('group transition-colors', zebraBg, 'hover:bg-app-s2/70')}>
                    {row.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        className={cn(
                          'truncate border-b border-app-border px-3 py-2 text-[13px] text-app-t2',
                          typeof cell === 'number' && 'tabular-nums',
                          cellIdx === 0 && cn('sticky left-0 z-[5] font-medium text-app-text group-hover:bg-app-s2/70', zebraBg),
                        )}
                      >
                        {formatCell(cell)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-md border border-app-border px-3 py-1.5 text-xs text-app-t2 hover:bg-app-s2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-xs text-app-t3">
            Page {page + 1} of {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page === pageCount - 1}
            className="rounded-md border border-app-border px-3 py-1.5 text-xs text-app-t2 hover:bg-app-s2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
