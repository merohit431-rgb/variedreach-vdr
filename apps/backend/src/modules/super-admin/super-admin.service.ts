import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { computeStoragePercent } from '../../common/org-storage.util';
import { IPaymentProvider, PAYMENT_PROVIDER } from '../payment/payment-provider.interface';
import { RazorpayPaymentProvider } from '../payment/providers/razorpay-payment.provider';
import { UpdateOrgDto } from './dto/update-org.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

// Mirror of shared pricing constants — same as registration.service.ts
const PRICING_PLANS: Record<string, { name: string; ratePerGbPerMonth: number; minimumStorageGb: number }> = {
  STARTER:      { name: 'Starter',      ratePerGbPerMonth: 4999, minimumStorageGb: 5  },
  PROFESSIONAL: { name: 'Professional', ratePerGbPerMonth: 4500, minimumStorageGb: 10 },
  BUSINESS:     { name: 'Business',     ratePerGbPerMonth: 4000, minimumStorageGb: 50 },
};

// Mirror of shared GST constants — same as registration.service.ts /
// provisioning.service.ts. This function previously always added 18% here
// regardless of GST_ENABLED, so every MRR/ARR figure on this dashboard (and
// the revenue chart) overstated real invoiced revenue by a flat 18%, since
// GST_ENABLED has been false everywhere else since GST was disabled platform-
// wide -- real invoices carry gstAmountPaisa: 0.
const GST_RATE = 0.18;
const GST_ENABLED = false;

function computeMonthlyRevenue(planSlug: string, storageGb: number, billingCycle: string): number {
  const plan = PRICING_PLANS[planSlug];
  if (!plan) return 0;
  const billableGb = Math.max(storageGb, plan.minimumStorageGb);
  const monthlyBase = billableGb * plan.ratePerGbPerMonth;
  const withDiscount = billingCycle === 'YEARLY' ? Math.round(monthlyBase * 0.9) : monthlyBase;
  return GST_ENABLED ? withDiscount + Math.round(withDiscount * GST_RATE) : withDiscount;
}

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: IPaymentProvider,
    // Reconciliation always needs the *real* Razorpay client, regardless of
    // which provider PAYMENT_PROVIDER currently selects -- "compare against
    // the gateway" is meaningless for the mock provider.
    private readonly razorpayProvider: RazorpayPaymentProvider,
  ) {}

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
          subscription: { select: { status: true, billingCycle: true, currentPeriodStart: true, currentPeriodEnd: true, storageGb: true, planSlug: true } },
          // Active OrganisationMembership rows, not User.organisationId --
          // that legacy column can drift from real membership (confirmed:
          // one real org shows 56 there against 55 actual active
          // memberships) since it's a point-in-time snapshot from the
          // multi-org migration backfill, never updated since. This is the
          // fix for that, not a cosmetic display change.
          _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
          dataRooms: { where: { deletedAt: null }, select: { storageUsedBytes: true } },
        },
      }),
      this.prisma.organisation.count({ where }),
    ]);

    const items = data.map(({ dataRooms, ...org }) => {
      const usedBytes = dataRooms.reduce((sum, r) => sum + r.storageUsedBytes, 0n);
      const limitBytes = BigInt(org.storageLimitGb) * 1024n * 1024n * 1024n;
      return {
        ...org,
        activeUserCount: org._count.memberships,
        storage: {
          usedBytes: usedBytes.toString(),
          limitGb: org.storageLimitGb,
          usagePercent: computeStoragePercent(usedBytes, limitBytes),
        },
      };
    });

    return { items, total, page, limit };
  }

  // Shared so getOrganisationById and updateOrganisation return an identical
  // shape. The detail page renders org.invoices/payments/subscription
  // directly, so any endpoint that feeds setOrg() MUST include these
  // relations -- returning the bare organisation row makes the page crash on
  // the next render. Deliberately does NOT include `users` -- that relation
  // is keyed off the legacy User.organisationId snapshot (frozen at
  // whatever it was during the multi-org migration backfill), which is
  // confirmed to drift from real membership (one real org: 56 there vs 55
  // actual active OrganisationMembership rows -- see getOrganisations'
  // fix). The member list here now comes from TeamPanel, which queries
  // OrganisationMembership directly.
  private readonly ORG_DETAIL_INCLUDE = {
    subscription: true,
    invoices: {
      take: 10,
      orderBy: { createdAt: 'desc' as const },
      select: { id: true, invoiceNumber: true, totalAmountPaisa: true, status: true, issuedAt: true, paidAt: true },
    },
    payments: {
      take: 10,
      orderBy: { createdAt: 'desc' as const },
      select: { id: true, amountPaisa: true, status: true, paidAt: true, gatewayPaymentId: true, createdAt: true },
    },
  };

  async getOrganisationById(id: string) {
    const org = await this.prisma.organisation.findUnique({
      where: { id },
      include: this.ORG_DETAIL_INCLUDE,
    });
    if (!org) throw new NotFoundException('Organisation not found');
    return org;
  }

  async updateOrganisation(id: string, dto: UpdateOrgDto, actorUserId: string) {
    const org = await this.prisma.organisation.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organisation not found');

    // Rename gets its own audit action (ORGANISATION_RENAMED) and its own
    // slug regeneration -- kept out of the generic limits/plan diff below so
    // "who renamed this org and from what" is a single, unambiguous entry
    // rather than buried inside a general-purpose update. slug is read-only
    // display text everywhere in the frontend (never a routing key or a
    // lookup identifier), so regenerating it alongside the name is safe.
    let slugUpdate: string | undefined;
    if (dto.name !== undefined && dto.name !== org.name) {
      slugUpdate = await this.generateUniqueSlug(dto.name, id);
    }

    // Record only the fields actually present in this request, each as a
    // {from, to} pair -- these limits gate real customer capability
    // (seats, storage, plan tier), so "something changed" isn't enough for
    // a defensible record of what a Super Admin did and why it might be
    // asked about later.
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of ['userLimit', 'storageLimitGb', 'planSlug'] as const) {
      if (dto[key] !== undefined && dto[key] !== org[key]) {
        changes[key] = { from: org[key], to: dto[key] };
      }
    }

    // Return the full detail shape (with relations) so the client can swap it
    // straight into state without a follow-up refetch or a crash.
    const updated = await this.prisma.organisation.update({
      where: { id },
      data: { ...dto, ...(slugUpdate && { slug: slugUpdate }) },
      include: this.ORG_DETAIL_INCLUDE,
    });

    if (slugUpdate) {
      await this.auditLogService.record({
        action: 'ORGANISATION_RENAMED',
        userId: actorUserId,
        organisationId: id,
        resourceType: 'Organisation',
        resourceId: id,
        metadata: { from: org.name, to: dto.name } as Prisma.InputJsonValue,
      });
    }

    if (Object.keys(changes).length > 0) {
      await this.auditLogService.record({
        action: 'ORGANISATION_UPDATED',
        userId: actorUserId,
        organisationId: id,
        resourceType: 'Organisation',
        resourceId: id,
        metadata: changes as Prisma.InputJsonValue,
      });
    }

    return updated;
  }

  private async generateUniqueSlug(name: string, excludeOrgId: string): Promise<string> {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    let slug = base;
    let n = 1;
    while (await this.prisma.organisation.findFirst({ where: { slug, id: { not: excludeOrgId } } })) {
      slug = `${base}-${n++}`;
    }
    return slug;
  }

  // Org-level activate/deactivate -- independent of, and immediately
  // effective on top of, per-member suspend (OrgMembersService). Blocks
  // every member of the org on their very next request (see
  // jwt.strategy.ts / auth.service.ts's organisation.status checks) without
  // touching any user, file, folder, or subscription row.
  async setOrganisationStatus(id: string, status: 'ACTIVE' | 'SUSPENDED', actorUserId: string) {
    const org = await this.prisma.organisation.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organisation not found');
    if (org.deletedAt) throw new BadRequestException('Cannot change the status of an archived organisation');
    if (org.status === status) return org;

    const updated = await this.prisma.organisation.update({ where: { id }, data: { status } });

    await this.auditLogService.record({
      action: status === 'SUSPENDED' ? 'ORGANISATION_DEACTIVATED' : 'ORGANISATION_ACTIVATED',
      userId: actorUserId,
      organisationId: id,
      resourceType: 'Organisation',
      resourceId: id,
    });

    return updated;
  }

  // Soft-delete/archive -- the only deletion path this product exposes (see
  // the Organisation model's own comment on why: every relation cascades,
  // so a real hard-delete is immediate and unrecoverable). Sets deletedAt
  // and SUSPENDED together so an archived org is blocked exactly like a
  // deactivated one, but stays clearly distinguished in the audit trail and
  // in any listing that filters deletedAt. Nothing else is touched --
  // users, files, folders, subscriptions, audit logs all remain, fully
  // recoverable by unsetting deletedAt (no product-facing "reactivate an
  // archived org" path yet; recovery today is a deliberate, manual step).
  async archiveOrganisation(id: string, confirmName: string, actorUserId: string) {
    const org = await this.prisma.organisation.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organisation not found');
    if (org.deletedAt) throw new BadRequestException('This organisation is already archived');
    if (confirmName.trim() !== org.name) {
      throw new BadRequestException('Organisation name confirmation does not match');
    }

    await this.prisma.organisation.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'SUSPENDED' },
    });

    await this.auditLogService.record({
      action: 'ORGANISATION_DELETED',
      userId: actorUserId,
      organisationId: id,
      resourceType: 'Organisation',
      resourceId: id,
      metadata: { name: org.name, note: 'Soft-delete/archive -- no data removed, recoverable' },
    });

    return { archived: true };
  }

  // Manual Super Admin control over subscription dates/status --
  // "extend", "early-expire", and "reactivate" are all this one operation
  // with different values, not different endpoints. Upserts: some real
  // organisations (manually provisioned before self-service billing
  // existed) have no Subscription row at all yet -- creating one uses the
  // organisation's own planSlug/storageLimitGb as sane defaults, since this
  // endpoint manages dates/status, not plan selection.
  async updateSubscription(organisationId: string, dto: UpdateSubscriptionDto, actorUserId: string) {
    const org = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      include: { subscription: true },
    });
    if (!org) throw new NotFoundException('Organisation not found');

    const existing = org.subscription;
    if (!existing && (!dto.currentPeriodStart || !dto.currentPeriodEnd)) {
      throw new BadRequestException(
        'This organisation has no subscription yet -- provide both currentPeriodStart and currentPeriodEnd to create one',
      );
    }
    if (dto.currentPeriodStart && dto.currentPeriodEnd && new Date(dto.currentPeriodStart) >= new Date(dto.currentPeriodEnd)) {
      throw new BadRequestException('currentPeriodStart must be before currentPeriodEnd');
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (existing) {
      for (const key of ['currentPeriodStart', 'currentPeriodEnd', 'status'] as const) {
        const incoming = dto[key];
        if (incoming === undefined) continue;
        const fromVal = key === 'status' ? existing[key] : existing[key].toISOString();
        if (incoming !== fromVal) changes[key] = { from: fromVal, to: incoming };
      }
    }

    const subscription = await this.prisma.subscription.upsert({
      where: { organisationId },
      create: {
        organisationId,
        planSlug: org.planSlug ?? 'CUSTOM',
        billingCycle: 'YEARLY',
        storageGb: org.storageLimitGb,
        status: dto.status ?? 'ACTIVE',
        currentPeriodStart: new Date(dto.currentPeriodStart!),
        currentPeriodEnd: new Date(dto.currentPeriodEnd!),
      },
      update: {
        ...(dto.currentPeriodStart && { currentPeriodStart: new Date(dto.currentPeriodStart) }),
        ...(dto.currentPeriodEnd && { currentPeriodEnd: new Date(dto.currentPeriodEnd) }),
        ...(dto.status && { status: dto.status }),
      },
    });

    const wasReactivated = existing && existing.status !== 'ACTIVE' && dto.status === 'ACTIVE';
    if (!existing || Object.keys(changes).length > 0) {
      await this.auditLogService.record({
        action: wasReactivated ? 'SUBSCRIPTION_REACTIVATED' : 'SUBSCRIPTION_DATES_UPDATED',
        userId: actorUserId,
        organisationId,
        resourceType: 'Subscription',
        resourceId: subscription.id,
        metadata: (existing
          ? changes
          : { created: true, currentPeriodStart: dto.currentPeriodStart, currentPeriodEnd: dto.currentPeriodEnd }) as Prisma.InputJsonValue,
      });
    }

    return subscription;
  }

  // Detailed storage breakdown for one organisation. "Live" is what actually
  // counts against storageLimitGb (see org-storage.util.ts): current,
  // non-deleted files only. Two categories are real disk usage that ISN'T
  // reflected in that headline number, documented rather than silently
  // rolled in:
  //  - trash: soft-deleted files (files.service.ts remove() decrements
  //    storageUsedBytes immediately on delete, so trashed files stop
  //    counting against quota right away even though nothing purges them)
  //  - priorVersions: every version before a file's current one. Uploading
  //    a new version only ever adds the *delta* to storageUsedBytes, so
  //    older versions' bytes are retained on disk forever but have never
  //    been counted anywhere until this endpoint.
  async getOrganisationStorageDetail(organisationId: string) {
    const org = await this.prisma.organisation.findUnique({ where: { id: organisationId } });
    if (!org) throw new NotFoundException('Organisation not found');

    const dataRoomWhere = { dataRoom: { organisationId } };
    const [live, trash, allVersions, folderCount, dataRoomCount] = await Promise.all([
      this.prisma.file.aggregate({ where: { ...dataRoomWhere, deletedAt: null }, _sum: { sizeBytes: true }, _count: true }),
      this.prisma.file.aggregate({ where: { ...dataRoomWhere, deletedAt: { not: null } }, _sum: { sizeBytes: true }, _count: true }),
      this.prisma.fileVersion.aggregate({ where: { file: dataRoomWhere }, _sum: { sizeBytes: true } }),
      this.prisma.folder.count({ where: { ...dataRoomWhere, deletedAt: null } }),
      this.prisma.dataRoom.count({ where: { organisationId, deletedAt: null } }),
    ]);

    const liveBytes = live._sum.sizeBytes ?? 0n;
    const trashBytes = trash._sum.sizeBytes ?? 0n;
    // All versions ever stored, minus what's already counted as each file's
    // current version (liveBytes + trashBytes together are exactly that,
    // since currentVersionId's file row IS the current version) -- the
    // remainder is prior-version bytes with no other representation.
    const priorVersionBytes = (allVersions._sum.sizeBytes ?? 0n) - liveBytes - trashBytes;

    return {
      organisationId,
      storageLimitGb: org.storageLimitGb,
      breakdown: {
        live: { bytes: liveBytes.toString(), fileCount: live._count },
        trash: { bytes: trashBytes.toString(), fileCount: trash._count },
        priorVersions: { bytes: (priorVersionBytes > 0n ? priorVersionBytes : 0n).toString() },
      },
      counts: { folders: folderCount, dataRooms: dataRoomCount },
    };
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
          mobileNumber: true, companyAddress: true, gstNumber: true,
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

  // Initiates a gateway refund and marks the Payment REFUNDED immediately --
  // razorpay-webhook.service.ts's refund.processed handler will find the
  // Payment already in this state and no-op, so this and a Razorpay-dashboard
  // -initiated refund converge on the same end state either way.
  async refundPayment(paymentId: string, actorUserId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'SUCCESSFUL') {
      throw new BadRequestException(`Only a SUCCESSFUL payment can be refunded (this one is ${payment.status})`);
    }
    if (!payment.gatewayPaymentId) {
      throw new BadRequestException('Payment has no gateway payment id on record -- cannot refund');
    }

    await this.auditLogService.record({
      action: 'PAYMENT_REFUND_INITIATED',
      userId: actorUserId,
      resourceType: 'Payment',
      resourceId: payment.id,
      metadata: { amountPaisa: payment.amountPaisa, gatewayPaymentId: payment.gatewayPaymentId },
    });

    await this.paymentProvider.refundPayment(payment.gatewayPaymentId, payment.amountPaisa);

    return this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
  }

  // Payments → Reconcile: every payment with a gatewayOrderId, plus whatever
  // the last reconciliation check found (stashed in Payment.metadata rather
  // than a new column -- keeps this feature schema-neutral). Sync Status is
  // "Not checked" until an admin actually runs the check for that row; this
  // deliberately never auto-calls Razorpay on page load, only on demand.
  async getPaymentsForReconciliation(page: number, limit: number) {
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { gatewayOrderId: { not: null } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, amountPaisa: true, status: true, metadata: true,
          gatewayOrderId: true, gatewayPaymentId: true, createdAt: true,
          organisation: { select: { id: true, name: true } },
          invoice: { select: { invoiceNumber: true } },
          subscription: { select: { planSlug: true, billingCycle: true, status: true } },
        },
      }),
      this.prisma.payment.count({ where: { gatewayOrderId: { not: null } } }),
    ]);

    const items = data.map((p) => {
      const reconciliation = (p.metadata as { reconciliation?: { checkedAt: string; inSync: boolean; razorpayStatus: string } } | null)?.reconciliation;
      return {
        id: p.id,
        amountPaisa: p.amountPaisa,
        status: p.status,
        gatewayOrderId: p.gatewayOrderId,
        gatewayPaymentId: p.gatewayPaymentId,
        createdAt: p.createdAt,
        organisation: p.organisation,
        invoiceNumber: p.invoice?.invoiceNumber ?? null,
        subscription: p.subscription,
        syncStatus: reconciliation ? (reconciliation.inSync ? 'IN_SYNC' : 'DRIFTED') : 'NOT_CHECKED',
        lastCheckedAt: reconciliation?.checkedAt ?? null,
        lastRazorpayStatus: reconciliation?.razorpayStatus ?? null,
      };
    });

    return { items, total, page, limit };
  }

  // The "Reconcile with Razorpay" button. Looks the order up by
  // gatewayOrderId (always present once an order was created) rather than
  // gatewayPaymentId (which may be missing -- exactly the drift this exists
  // to catch), compares Razorpay's real payment status against our local
  // Payment.status, and auto-corrects the two drift patterns that actually
  // matter: a captured payment we never learned about, and a refund that
  // happened on Razorpay's side without our refund.processed webhook firing
  // (dashboard-initiated refunds, a delivery failure, etc.).
  async reconcilePayment(paymentId: string, actorUserId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (!payment.gatewayOrderId) {
      throw new BadRequestException('Payment has no gateway order id -- nothing to reconcile against');
    }

    const razorpayPayments = await this.razorpayProvider.fetchOrderPayments(payment.gatewayOrderId);
    const checkedAt = new Date().toISOString();

    if (razorpayPayments.length === 0) {
      await this.stashReconciliationResult(payment.id, { checkedAt, inSync: false, razorpayStatus: 'no_payment_found' });
      return { inSync: false, localStatus: payment.status, razorpayStatus: null, discrepancy: 'No payment found on Razorpay for this order', corrected: false };
    }

    // An order can have more than one payment attempt (e.g. a failed try
    // followed by a successful one) -- the captured one is the one that
    // matters; otherwise take the most recent.
    const captured = razorpayPayments.find((p) => p.status === 'captured');
    const relevant = captured ?? razorpayPayments.sort((a, b) => b.createdAt - a.createdAt)[0];

    const razorpayImpliesStatus = captured ? 'SUCCESSFUL' : relevant.status === 'refunded' ? 'REFUNDED' : relevant.status === 'failed' ? 'FAILED' : payment.status;
    // Fully in sync requires both the status to agree AND the payment id to
    // actually be recorded locally -- a status match alone doesn't catch the
    // "never backfilled gatewayPaymentId" drift this feature exists for.
    const statusMatches = razorpayImpliesStatus === payment.status;
    const gatewayIdRecorded = payment.gatewayPaymentId === relevant.id;
    const inSync = statusMatches && gatewayIdRecorded;

    let corrected = false;
    if (!inSync && (razorpayImpliesStatus === 'SUCCESSFUL' || razorpayImpliesStatus === 'REFUNDED')) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: razorpayImpliesStatus, gatewayPaymentId: relevant.id },
      });
      corrected = true;
      await this.auditLogService.record({
        action: razorpayImpliesStatus === 'REFUNDED' ? 'PAYMENT_REFUNDED' : 'PAYMENT_CAPTURED',
        userId: actorUserId,
        resourceType: 'Payment',
        resourceId: payment.id,
        metadata: { viaReconciliation: true, previousStatus: payment.status, razorpayStatus: relevant.status, razorpayPaymentId: relevant.id },
      });
    }

    await this.stashReconciliationResult(payment.id, { checkedAt, inSync: inSync || corrected, razorpayStatus: relevant.status });

    return {
      inSync: inSync || corrected,
      localStatus: corrected ? razorpayImpliesStatus : payment.status,
      razorpayStatus: relevant.status,
      razorpayPaymentId: relevant.id,
      discrepancy: corrected ? `Corrected: was ${payment.status}, Razorpay shows ${relevant.status}` : inSync ? null : 'Statuses differ but were not auto-corrected -- needs manual review',
      corrected,
    };
  }

  private async stashReconciliationResult(paymentId: string, result: { checkedAt: string; inSync: boolean; razorpayStatus: string }): Promise<void> {
    const existing = await this.prisma.payment.findUnique({ where: { id: paymentId }, select: { metadata: true } });
    const metadata = { ...(existing?.metadata as object ?? {}), reconciliation: result };
    await this.prisma.payment.update({ where: { id: paymentId }, data: { metadata } });
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
