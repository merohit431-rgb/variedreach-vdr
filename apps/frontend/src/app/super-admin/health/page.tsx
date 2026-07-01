'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCcw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

export default function HealthPage() {
  const { getHealth } = useSuperAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getHealth();
    if (res.success) { setData(res.data); setLastRefreshed(new Date()); }
    setLoading(false);
  }, [getHealth]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <div className="h-64 rounded-xl bg-slate-200 animate-pulse" />;

  const allOk = data?.database?.status === 'ok';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Platform Health</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {lastRefreshed ? `Last checked: ${lastRefreshed.toLocaleTimeString('en-IN')}` : 'Live system status.'}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} isLoading={loading}>
          <RefreshCcw className="h-4 w-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Overall status banner */}
      {data && (
        <div className={`flex items-center gap-3 rounded-xl p-4 ${allOk ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
          {allOk
            ? <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            : <XCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          }
          <div>
            <p className={`font-semibold text-sm ${allOk ? 'text-emerald-800' : 'text-rose-800'}`}>
              {allOk ? 'All systems operational' : 'System degraded — check database'}
            </p>
          </div>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Database */}
          <Card>
            <CardHeader><CardTitle>Database</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Connection</span>
                <Badge tone={data.database.status === 'ok' ? 'success' : 'danger'} icon={data.database.status === 'ok' ? CheckCircle2 : XCircle}>
                  {data.database.status === 'ok' ? 'Connected' : 'Error'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Latency</span>
                <span className={`font-semibold ${data.database.latencyMs > 100 ? 'text-amber-700' : 'text-slate-900'}`}>
                  {data.database.latencyMs}ms
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Platform stats */}
          <Card>
            <CardHeader><CardTitle>Platform</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Organisations', value: data.platform.totalOrgs },
                { label: 'Active Users', value: data.platform.totalUsers },
                { label: 'Active Sessions', value: data.platform.activeSessions },
                { label: 'Total Files', value: data.files.totalFiles },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{row.label}</span>
                  <span className="font-semibold text-slate-900">{row.value.toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Process */}
          <Card>
            <CardHeader><CardTitle>Backend Process</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Uptime</span>
                <span className="flex items-center gap-1 font-semibold text-slate-900">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {formatUptime(data.uptime)}
                </span>
              </div>
              {[
                { label: 'Heap Used', value: `${data.memory.heapUsedMb} MB`, warn: data.memory.heapUsedMb > 400 },
                { label: 'Heap Total', value: `${data.memory.heapTotalMb} MB`, warn: false },
                { label: 'RSS', value: `${data.memory.rssMb} MB`, warn: data.memory.rssMb > 700 },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{row.label}</span>
                  <span className={`font-semibold ${row.warn ? 'text-amber-700' : 'text-slate-900'}`}>{row.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
