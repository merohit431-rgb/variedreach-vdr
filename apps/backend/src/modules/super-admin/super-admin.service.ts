import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateOrgDto } from './dto/update-org.dto';

// Mirror of shared pricing constants — same as registration.service.ts
const PRICING_PLANS: Record<string, { name: string; ratePerGbPerMonth: number; minimumStorageGb: number }> = {
  STARTER:      { name: 'Starter',      ratePerGbPerMonth: 4999, minimumStorageGb: 5  },
  PROFESSIONAL: { name: 'Professional', ratePerGbPerMonth: 4500, minimumStorageGb: 10 },
  BUSINESS:     { name: 'Business',     ratePerGbPerMonth: 4000, minimumStorageGb: 50 },
};

function computeMonthlyRevenue(planSlug: string, storageGb: number, billingCycle: string): number {
  const plan = PRICING_PLANS[planSlug];
  if (!plan) return 0;
  const billableGb = Math.max(storageGb, plan.minimumStorageGb);
  const monthlyBase = billableGb * plan.ratePerGbPerMonth;
  const withDiscount = billingCycle === 'YEARLY' ? Math.round(monthlyBase * 0.9) : monthlyBase;
  return withDiscount + Math.round(withDiscount * 0.18);
}

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalOrgs,
      totalUsers,
      activeSubscriptions,
      newOrgsThisMonth,
      totalRevenue,
      subscriptionStatusGroups,
      registrationCounts,
      recentRegistrations,
      recentOrgs,
    ] = await Promise.all([
      this.prisma.organisation.count(),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        select: { planSlug: true, storageGb: true, billingCycle: true },
      }),
      this.prisma.organisation.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCESSFUL' },
        _sum: { amountPaisa: true },
      }),
      this.prisma.subscription.groupBy({ by: ['status'], _count: true }),
      Promise.all([
        this.prisma.registration.count(),
        this.prisma.registration.count({ where: { verifiedAt: { not: null } } }),
        this.prisma.registration.count({ where: { gatewayOrderId: { not: null } } }),
        this.prisma.registration.count({ where: { paymentStatus: 'COMPLETED' } }),
        this.prisma.registration.count({ where: { provisionedAt: { not: null } } }),
      ]),
      this.prisma.registration.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, companyName: true, selectedPlan: true, createdAt: true, verifiedAt: true, provisionedAt: true, paymentStatus: true },
      }),
      this.prisma.organisation.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, planSlug: true, createdAt: true },
      }),
    ]);

    const mrr = activeSubscriptions.reduce(
      (sum, sub) => sum + computeMonthlyRevenue(sub.planSlug, sub.storageGb, sub.billingCycle),
      0,
    );

    const planMrr: Record<string, { count: number; mrr: number }> = {};
    for (const sub of activeSubscriptions) {
      if (!planMrr[sub.planSlug]) planMrr[sub.planSlug] = { count: 0, mrr: 0 };
      planMrr[sub.planSlug].count++;
      planMrr[sub.planSlug].mrr += computeMonthlyRevenue(sub.planSlug, sub.storageGb, sub.billingCycle);
    }
    const subscriptionsByPlan = Object.entries(planMrr).map(([planSlug, v]) => ({ planSlug, ...v }));

    const statusMap: Record<string, number> = {};
    for (const s of subscriptionStatusGroups) statusMap[s.status] = s._count;

    return {
      kpis: {
        totalOrganisations: totalOrgs,
        totalUsers,
        mrr,
        arr: mrr * 12,
        totalRevenue: totalRevenue._sum.amountPaisa ?? 0,
        newOrgsThisMonth,
        activeSubscriptions: statusMap['ACTIVE'] ?? 0,
        cancelledSubscriptions: statusMap['CANCELLED'] ?? 0,
        pastDueSubscriptions: statusMap['PAST_DUE'] ?? 0,
      },
      subscriptionsByPlan,
      registrationFunnel: {
        started: registrationCounts[0],
        emailVerified: registrationCounts[1],
        checkoutReached: registrationCounts[2],
        paymentSuccessful: registrationCounts[3],
        provisioned: registrationCounts[4],
      },
      recentRegistrations,
      recentOrganisations: recentOrgs,
    };
  }

  async getOrganisations(page: number, limit: number, search?: string, plan?: string) {
    const where = {
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(plan ? { planSlug: plan } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.organisation.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: { select: { status: true, billingCycle: true, currentPeriodEnd: true, storageGb: true, planSlug: true } },
          _count: { select: { users: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.organisation.count({ where }),
    ]);

    return { items: data, total, page, limit };
  }

  async getOrganisationById(id: string) {
    const org = await this.prisma.organisation.findUnique({
      where: { id },
      include: {
        subscription: true,
        users: {
          where: { deletedAt: null },
          select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, lastLoginAt: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { id: true, invoiceNumber: true, totalAmountPaisa: true, status: true, issuedAt: true, paidAt: true },
        },
        payments: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { id: true, amountPaisa: true, status: true, paidAt: true, gatewayPaymentId: true, createdAt: true },
        },
      },
    });
    if (!org) throw new NotFoundException('Organisation not found');
    return org;
  }

  async updateOrganisation(id: string, dto: UpdateOrgDto) {
    const org = await this.prisma.organisation.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organisation not found');
    return this.prisma.organisation.update({ where: { id }, data: dto });
  }

  async getRegistrations(page: number, limit: number) {
    const [started, emailVerified, checkoutReached, paymentSuccessful, provisioned, data, total] = await Promise.all([
      this.prisma.registration.count(),
      this.prisma.registration.count({ where: { verifiedAt: { not: null } } }),
      this.prisma.registration.count({ where: { gatewayOrderId: { not: null } } }),
      this.prisma.registration.count({ where: { paymentStatus: 'COMPLETED' } }),
      this.prisma.registration.count({ where: { provisionedAt: { not: null } } }),
      this.prisma.registration.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, fullName: true, companyName: true,
          selectedPlan: true, selectedStorageGb: true, billingCycle: true,
          createdAt: true, verifiedAt: true, paymentStatus: true, provisionedAt: true, gatewayOrderId: true,
        },
      }),
      this.prisma.registration.count(),
    ]);

    return {
      funnel: { started, emailVerified, checkoutReached, paymentSuccessful, provisioned },
      items: data,
      total,
      page,
      limit,
    };
  }

  async getPayments(page: number, limit: number) {
    const [analytics, data, total] = await Promise.all([
      this.prisma.payment.groupBy({
        by: ['status'],
        _count: true,
        _sum: { amountPaisa: true },
      }),
      this.prisma.payment.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, amountPaisa: true, currency: true, status: true,
          gatewayOrderId: true, gatewayPaymentId: true, failureReason: true,
          paidAt: true, createdAt: true,
          organisation: { select: { id: true, name: true } },
          invoice: { select: { invoiceNumber: true } },
        },
      }),
      this.prisma.payment.count(),
    ]);

    const analyticsMap: Record<string, { count: number; total: number }> = {};
    for (const g of analytics) {
      analyticsMap[g.status] = { count: g._count, total: g._sum.amountPaisa ?? 0 };
    }

    return {
      analytics: {
        successful: analyticsMap['SUCCESSFUL'] ?? { count: 0, total: 0 },
        pending:    analyticsMap['PENDING']    ?? { count: 0, total: 0 },
        failed:     analyticsMap['FAILED']     ?? { count: 0, total: 0 },
        refunded:   analyticsMap['REFUNDED']   ?? { count: 0, total: 0 },
      },
      items: data,
      total,
      page,
      limit,
    };
  }

  async getSubscriptions(page: number, limit: number, status?: string) {
    const where = status ? { status: status as any } : {};
    const [data, total, statusGroups] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organisation: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.subscription.count({ where }),
      this.prisma.subscription.groupBy({ by: ['status'], _count: true }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of statusGroups) statusMap[s.status] = s._count;

    return { items: data, total, page, limit, statusBreakdown: statusMap };
  }

  async getInvoices(page: number, limit: number) {
    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, invoiceNumber: true, amountPaisa: true, gstAmountPaisa: true,
          totalAmountPaisa: true, status: true, issuedAt: true, paidAt: true, createdAt: true,
          organisation: { select: { name: true } },
        },
      }),
      this.prisma.invoice.count(),
    ]);
    return { items: data, total, page, limit };
  }

  async getRevenue() {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [payments, activeSubscriptions, totalRevenue] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: 'SUCCESSFUL', paidAt: { gte: twelveMonthsAgo } },
        select: { amountPaisa: true, paidAt: true },
      }),
      this.prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        select: { planSlug: true, storageGb: true, billingCycle: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCESSFUL' },
        _sum: { amountPaisa: true },
      }),
    ]);

    // Build monthly chart for last 12 months
    const monthlyMap: Record<string, { revenue: number; count: number }> = {};
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = { revenue: 0, count: 0 };
    }
    for (const p of payments) {
      if (!p.paidAt) continue;
      const key = `${p.paidAt.getFullYear()}-${String(p.paidAt.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap[key]) {
        monthlyMap[key].revenue += p.amountPaisa;
        monthlyMap[key].count++;
      }
    }
    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }));

    const planMap: Record<string, { count: number; mrr: number }> = {};
    let mrr = 0;
    for (const sub of activeSubscriptions) {
      const m = computeMonthlyRevenue(sub.planSlug, sub.storageGb, sub.billingCycle);
      mrr += m;
      if (!planMap[sub.planSlug]) planMap[sub.planSlug] = { count: 0, mrr: 0 };
      planMap[sub.planSlug].count++;
      planMap[sub.planSlug].mrr += m;
    }
    const byPlan = Object.entries(planMap).map(([planSlug, v]) => ({ planSlug, ...v }));

    return {
      monthly,
      byPlan,
      summary: {
        totalRevenue: totalRevenue._sum.amountPaisa ?? 0,
        mrr,
        arr: mrr * 12,
      },
    };
  }

  async getHealth() {
    const start = Date.now();
    let dbStatus: 'ok' | 'error' = 'ok';
    let dbLatency = 0;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - start;
    } catch {
      dbStatus = 'error';
    }

    const [totalFiles, activeSessions, totalOrgs, totalUsers] = await Promise.all([
      this.prisma.fileVersion.count(),
      this.prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
      this.prisma.organisation.count(),
      this.prisma.user.count({ where: { deletedAt: null } }),
    ]);

    return {
      database: { status: dbStatus, latencyMs: dbLatency },
      platform: { totalOrgs, totalUsers, activeSessions },
      files: { totalFiles },
      uptime: Math.floor(process.uptime()),
      memory: {
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    };
  }

  async getActivity(page: number, limit: number) {
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.auditLog.count(),
    ]);
    return { items: data, total, page, limit };
  }
}
