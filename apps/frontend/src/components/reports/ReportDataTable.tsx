'use client';

import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface ReportDataTableProps {
  headers: string[];
  rows: (string | number)[][];
  pageSize?: number;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T/;

function formatCell(value: string | number): string {
  if (typeof value === 'string' && ISO_DATE_RE.test(value)) {
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
  return String(value);
}

export function ReportDataTable({ headers, rows, pageSize = 25 }: ReportDataTableProps) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

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

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex items-center justify-between gap-4">
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search within results…"
          className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <p className="flex-shrink-0 text-xs text-slate-400">
          {sorted.length} {sorted.length === 1 ? 'row' : 'rows'}
          {search && ` matching "${search}"`}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {headers.map((header, i) => (
                <th
                  key={header}
                  onClick={() => handleSortHeader(i)}
                  className="cursor-pointer select-none whitespace-nowrap px-4 py-3 hover:text-slate-900"
                >
                  {header}
                  {sortCol === i ? (
                    sortDir === 'asc' ? (
                      <ArrowUp className="ml-1 inline h-3 w-3 text-slate-700" aria-hidden="true" />
                    ) : (
                      <ArrowDown className="ml-1 inline h-3 w-3 text-slate-700" aria-hidden="true" />
                    )
                  ) : (
                    <ArrowUpDown className="ml-1 inline h-3 w-3 text-slate-400" aria-hidden="true" />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-8 text-center text-sm text-slate-400">
                  No results.
                </td>
              </tr>
            ) : (
              pageRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-slate-50">
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatCell(cell)}
                    </td>
                  ))}
                </tr>
              ))
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
            className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-slate-500">
            Page {page + 1} of {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page === pageCount - 1}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
