'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, ExternalLink } from 'lucide-react';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success', PAST_DUE: 'warning', CANCELLED: 'danger', EXPIRED: 'neutral',
};

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function OrganisationsPage() {
  const { getOrganisations } = useSuperAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getOrganisations(page, 20, search || undefined);
    if (res.success) setData(res.data);
    setLoading(false);
  }, [getOrganisations, page, search]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Organisations</h1>
          <p className="mt-0.5 text-sm text-slate-500">All customer organisations on the platform.</p>
        </div>
        {data && <span className="text-sm text-slate-500">{data.total} total</span>}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
        <Input
          placeholder="Search by name…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Button type="submit" variant="secondary" size="sm">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      <TableContainer>
        <Table>
          <Thead>
            <tr>
              <Th>Organisation</Th>
              <Th>Plan</Th>
              <Th>Users</Th>
              <Th>Storage</Th>
              <Th>Sub Status</Th>
              <Th>Created</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {loading && (
              <Tr><Td colSpan={7} className="text-center text-slate-400 py-8">Loading…</Td></Tr>
            )}
            {!loading && data?.data?.length === 0 && (
              <Tr><Td colSpan={7} className="text-center text-slate-400 py-8">No organisations found.</Td></Tr>
            )}
            {!loading && data?.data?.map((org: any) => (
              <Tr key={org.id}>
                <Td>
                  <p className="font-medium text-slate-900">{org.name}</p>
                  <p className="text-xs text-slate-400">{org.slug}</p>
                </Td>
                <Td>{org.planSlug ? <Badge tone="brand">{org.planSlug}</Badge> : <span className="text-slate-400">—</span>}</Td>
                <Td>{org._count?.users ?? 0} / {org.userLimit}</Td>
                <Td>{org.subscription?.storageGb ?? org.storageLimitGb} GB</Td>
                <Td>
                  {org.subscription ? (
                    <Badge tone={STATUS_TONE[org.subscription.status] ?? 'neutral'}>
                      {org.subscription.status}
                    </Badge>
                  ) : (
                    <span className="text-slate-400 text-xs">No subscription</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-slate-500">{formatDate(org.createdAt)}</Td>
                <Td>
                  <Link href={`/super-admin/organisations/${org.id}`} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700">
                    View <ExternalLink className="h-3 w-3" />
                  </Link>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
