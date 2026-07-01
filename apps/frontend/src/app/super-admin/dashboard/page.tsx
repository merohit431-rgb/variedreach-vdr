'use client';

import { useEffect, useState } from 'react';
import { Building2, Users, TrendingUp, IndianRupee, ArrowUpRight, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useSuperAdmin } from '@/hooks/use-super-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

function formatInr(paise: number) {
  const inr = paise / 100;
  if (inr >= 1_00_000) return `₹${(inr / 1_00_000).toFixed(2)}L`;
  if (inr >= 1_000) return `₹${(inr / 1_000).toFixed(1)}K`;
  return `₹${inr.toFixed(0)}`;
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function funnelPct(n: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

export default function SuperAdminDashboardPage() {
  const { getDashboard } = useSuperAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getDashboard().then((res) => {
      if (res.success) setData(res.data);
      else setError(res.message);
      setLoading(false);
    });
  }, [getDashboard]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;

  const { kpis, subscriptionsByPlan, registrationFunnel, recentRegistrations, recentOrganisations } = data;

  const KPI_CARDS = [
    { label: 'Total Organisations', value: kpis.totalOrganisations, sub: `+${kpis.newOrgsThisMonth} this month`, icon: Building2, color: 'text-brand-600' },
    { label: 'Total Users', value: kpis.totalUsers, sub: 'Active accounts', icon: Users, color: 'text-emerald-600' },
    { label: 'MRR', value: formatInr(kpis.mrr), sub: `ARR ${formatInr(kpis.arr)}`, icon: TrendingUp, color: 'text-violet-600' },
    { label: 'All-time Revenue', value: formatInr(kpis.totalRevenue), sub: `${kpis.activeSubscriptions} active subs`, icon: IndianRupee, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Platform Overview</h1>
        <p className="mt-0.5 text-sm text-slate-500">Real-time view of the entire VariedReach VDR SaaS platform.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_CARDS.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{kpi.value}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{kpi.sub}</p>
                </div>
                <div className={`rounded-lg bg-slate-50 p-2 ${kpi.color}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Registration Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Registration Funnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Started', value: registrationFunnel.started },
              { label: 'Email Verified', value: registrationFunnel.emailVerified },
              { label: 'Checkout Reached', value: registrationFunnel.checkoutReached },
              { label: 'Payment Successful', value: registrationFunnel.paymentSuccessful },
              { label: 'Provisioned', value: registrationFunnel.provisioned },
            ].map((step) => (
              <div key={step.label} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{step.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{step.value}</span>
                  <span className="text-xs text-slate-400">{funnelPct(step.value, registrationFunnel.started)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Subscriptions by Plan */}
        <Card>
          <CardHeader>
            <CardTitle>Active Subscriptions by Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {subscriptionsByPlan.length === 0 && (
              <p className="text-sm text-slate-400">No active subscriptions yet.</p>
            )}
            {subscriptionsByPlan.map((plan: any) => (
              <div key={plan.planSlug} className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{plan.planSlug}</span>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{plan.count} orgs</p>
                  <p className="text-xs text-slate-400">{formatInr(plan.mrr)}/mo</p>
                </div>
              </div>
            ))}
            <div className="border-t border-slate-100 pt-2 flex justify-between text-sm font-semibold text-slate-900">
              <span>Cancelled / Past Due</span>
              <span>{kpis.cancelledSubscriptions + kpis.pastDueSubscriptions}</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Organisations */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Organisations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentOrganisations.length === 0 && (
              <p className="text-sm text-slate-400">No organisations yet.</p>
            )}
            {recentOrganisations.map((org: any) => (
              <div key={org.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-slate-800 truncate max-w-[140px]">{org.name}</p>
                  <p className="text-xs text-slate-400">{formatDate(org.createdAt)}</p>
                </div>
                {org.planSlug && (
                  <Badge tone="brand">{org.planSlug}</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Registrations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Registrations</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">Company / Email</th>
                <th className="px-5 py-3 text-left">Plan</th>
                <th className="px-5 py-3 text-left">Signed up</th>
                <th className="px-5 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentRegistrations.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-400">No registrations yet.</td></tr>
              )}
              {recentRegistrations.map((reg: any) => (
                <tr key={reg.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-800">{reg.companyName}</p>
                    <p className="text-xs text-slate-400">{reg.email}</p>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{reg.selectedPlan}</td>
                  <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{formatDate(reg.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    {reg.provisionedAt ? (
                      <Badge tone="success" icon={CheckCircle2}>Provisioned</Badge>
                    ) : reg.paymentStatus === 'COMPLETED' ? (
                      <Badge tone="warning" icon={Clock}>Payment done</Badge>
                    ) : reg.verifiedAt ? (
                      <Badge tone="neutral" icon={ArrowUpRight}>Verified</Badge>
                    ) : (
                      <Badge tone="danger" icon={XCircle}>Pending</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 rounded bg-slate-200 animate-pulse" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-slate-200 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-48 rounded-xl bg-slate-200 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
