import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiSummaryRunStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export type AiBudgetLimitType = 'PER_DOCUMENT' | 'DAILY_ORG' | 'MONTHLY_ORG' | 'GLOBAL_STAGING' | 'CONCURRENCY';

export interface AiBudgetCheck {
  allowed: boolean;
  reason?: AiBudgetLimitType;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;

// Sum of COALESCE(actualCostMicroUsd, estimatedCostMicroUsd) across a set of
// rows -- the actual figure once the API has returned usage, else the
// pre-call estimate, so an in-flight call counts toward the budget
// immediately rather than only after it resolves. Summed in application
// code rather than a raw-SQL COALESCE: at this product's real scale (a few
// hundred ledger rows at most under the suggested starting budgets), a
// plain findMany + reduce is simpler and avoids coupling a safety-critical
// check to Postgres-specific SQL.
function sumEffectiveCost(rows: Array<{ estimatedCostMicroUsd: number; actualCostMicroUsd: number | null }>): number {
  return rows.reduce((total, row) => total + (row.actualCostMicroUsd ?? row.estimatedCostMicroUsd), 0);
}

// Mirrors org-storage.util.ts's getOrgStorageUsage/assertOrgStorageAvailable
// pattern: a pure usage computation, consulted by a guard that throws/denies
// before the gated action (here, a Claude API call) proceeds. All four
// budget tiers plus the concurrency cap are checked together in one call
// against the single AiUsageLedger/AiSummaryRun source of truth, since a
// submission must clear every tier atomically before any spend happens.
@Injectable()
export class AiBudgetGuard {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async assertAvailable(input: {
    organisationId: string;
    documentAnalysisId: string;
    estimatedCostMicroUsd: number;
  }): Promise<AiBudgetCheck> {
    const config = {
      maxCostPerDocumentUsd: this.configService.get<number>('aiBudget.maxCostPerDocumentUsd')!,
      maxDailyOrgCostUsd: this.configService.get<number>('aiBudget.maxDailyOrgCostUsd')!,
      maxMonthlyOrgCostUsd: this.configService.get<number>('aiBudget.maxMonthlyOrgCostUsd')!,
      maxGlobalStagingCostUsd: this.configService.get<number>('aiBudget.maxGlobalStagingCostUsd')!,
      maxConcurrentJobs: this.configService.get<number>('aiBudget.maxConcurrentJobs')!,
    };

    const now = Date.now();
    const costSelect = { estimatedCostMicroUsd: true, actualCostMicroUsd: true } as const;

    const [perDocumentRows, dailyOrgRows, monthlyOrgRows, globalRows, concurrentRunCount] = await Promise.all([
      this.prisma.aiUsageLedger.findMany({
        where: { documentAnalysisId: input.documentAnalysisId },
        select: costSelect,
      }),
      this.prisma.aiUsageLedger.findMany({
        where: { organisationId: input.organisationId, createdAt: { gte: new Date(now - ONE_DAY_MS) } },
        select: costSelect,
      }),
      this.prisma.aiUsageLedger.findMany({
        where: { organisationId: input.organisationId, createdAt: { gte: new Date(now - THIRTY_DAYS_MS) } },
        select: costSelect,
      }),
      // Deliberately no time window -- a hard, all-time ceiling on this
      // entire staging deployment's AI spend, so raising it requires a
      // conscious config change rather than silently replenishing daily.
      this.prisma.aiUsageLedger.findMany({ select: costSelect }),
      this.prisma.aiSummaryRun.count({
        where: { status: { in: [AiSummaryRunStatus.PENDING, AiSummaryRunStatus.PROCESSING] } },
      }),
    ]);

    // Order matches the brief's own tier list; the first tier that would be
    // exceeded is reported, not every tier that would be.
    const checks: Array<[AiBudgetLimitType, boolean]> = [
      [
        'PER_DOCUMENT',
        sumEffectiveCost(perDocumentRows) + input.estimatedCostMicroUsd > config.maxCostPerDocumentUsd * 1_000_000,
      ],
      [
        'DAILY_ORG',
        sumEffectiveCost(dailyOrgRows) + input.estimatedCostMicroUsd > config.maxDailyOrgCostUsd * 1_000_000,
      ],
      [
        'MONTHLY_ORG',
        sumEffectiveCost(monthlyOrgRows) + input.estimatedCostMicroUsd > config.maxMonthlyOrgCostUsd * 1_000_000,
      ],
      [
        'GLOBAL_STAGING',
        sumEffectiveCost(globalRows) + input.estimatedCostMicroUsd > config.maxGlobalStagingCostUsd * 1_000_000,
      ],
      ['CONCURRENCY', concurrentRunCount >= config.maxConcurrentJobs],
    ];

    const exceeded = checks.find(([, isExceeded]) => isExceeded);
    return exceeded ? { allowed: false, reason: exceeded[0] } : { allowed: true };
  }
}
