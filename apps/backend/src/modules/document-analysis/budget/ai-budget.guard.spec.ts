import { AiSummaryRunStatus } from '@prisma/client';
import { AiBudgetGuard } from './ai-budget.guard';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';

const DEFAULT_LIMITS = {
  'aiBudget.maxCostPerDocumentUsd': 0.5,
  'aiBudget.maxDailyOrgCostUsd': 5,
  'aiBudget.maxMonthlyOrgCostUsd': 50,
  'aiBudget.maxGlobalStagingCostUsd': 100,
  'aiBudget.maxConcurrentJobs': 2,
};

function buildGuard(opts: {
  limits?: Partial<typeof DEFAULT_LIMITS>;
  perDocumentRows?: Array<{ estimatedCostMicroUsd: number; actualCostMicroUsd: number | null }>;
  dailyOrgRows?: Array<{ estimatedCostMicroUsd: number; actualCostMicroUsd: number | null }>;
  monthlyOrgRows?: Array<{ estimatedCostMicroUsd: number; actualCostMicroUsd: number | null }>;
  globalRows?: Array<{ estimatedCostMicroUsd: number; actualCostMicroUsd: number | null }>;
  concurrentRunCount?: number;
}) {
  const limits = { ...DEFAULT_LIMITS, ...opts.limits };
  const configService = {
    get: jest.fn((key: string) => limits[key as keyof typeof limits]),
  } as unknown as ConfigService;

  // findMany is called 4 times in a fixed order: per-document, daily-org,
  // monthly-org, global -- mockResolvedValueOnce chains matching that order.
  const findMany = jest
    .fn()
    .mockResolvedValueOnce(opts.perDocumentRows ?? [])
    .mockResolvedValueOnce(opts.dailyOrgRows ?? [])
    .mockResolvedValueOnce(opts.monthlyOrgRows ?? [])
    .mockResolvedValueOnce(opts.globalRows ?? []);
  const count = jest.fn().mockResolvedValue(opts.concurrentRunCount ?? 0);

  const prisma = {
    aiUsageLedger: { findMany },
    aiSummaryRun: { count },
  } as unknown as PrismaService;

  const guard = new AiBudgetGuard(prisma, configService);
  return { guard, findMany, count };
}

const BASE_INPUT = { organisationId: 'org-1', documentAnalysisId: 'analysis-1', estimatedCostMicroUsd: 100_000 };

describe('AiBudgetGuard.assertAvailable', () => {
  it('allows a request when every tier has headroom', async () => {
    const { guard } = buildGuard({});

    const result = await guard.assertAvailable(BASE_INPUT);

    expect(result).toEqual({ allowed: true });
  });

  it('blocks on PER_DOCUMENT when this document alone would exceed its cap', async () => {
    const { guard } = buildGuard({
      perDocumentRows: [{ estimatedCostMicroUsd: 450_000, actualCostMicroUsd: null }], // $0.45 already spent, cap is $0.50
    });

    const result = await guard.assertAvailable({ ...BASE_INPUT, estimatedCostMicroUsd: 100_000 }); // +$0.10 -> $0.55

    expect(result).toEqual({ allowed: false, reason: 'PER_DOCUMENT' });
  });

  it('blocks on DAILY_ORG when this org has spent close to its daily cap', async () => {
    const { guard } = buildGuard({
      dailyOrgRows: [{ estimatedCostMicroUsd: 4_950_000, actualCostMicroUsd: null }], // $4.95 of a $5 daily cap
    });

    const result = await guard.assertAvailable(BASE_INPUT); // +$0.10 -> $5.05

    expect(result).toEqual({ allowed: false, reason: 'DAILY_ORG' });
  });

  it('blocks on MONTHLY_ORG when this org has spent close to its monthly cap', async () => {
    const { guard } = buildGuard({
      monthlyOrgRows: [{ estimatedCostMicroUsd: 49_950_000, actualCostMicroUsd: null }], // $49.95 of a $50 monthly cap
    });

    const result = await guard.assertAvailable(BASE_INPUT);

    expect(result).toEqual({ allowed: false, reason: 'MONTHLY_ORG' });
  });

  it('blocks on GLOBAL_STAGING when the whole deployment is close to its all-time cap', async () => {
    const { guard } = buildGuard({
      globalRows: [{ estimatedCostMicroUsd: 99_950_000, actualCostMicroUsd: null }], // $99.95 of a $100 global cap
    });

    const result = await guard.assertAvailable(BASE_INPUT);

    expect(result).toEqual({ allowed: false, reason: 'GLOBAL_STAGING' });
  });

  it('blocks on CONCURRENCY when the configured number of jobs are already in flight', async () => {
    const { guard } = buildGuard({ concurrentRunCount: 2 });

    const result = await guard.assertAvailable(BASE_INPUT);

    expect(result).toEqual({ allowed: false, reason: 'CONCURRENCY' });
  });

  it('does not block on CONCURRENCY when fewer than the configured max are in flight', async () => {
    const { guard } = buildGuard({ concurrentRunCount: 1 });

    const result = await guard.assertAvailable(BASE_INPUT);

    expect(result).toEqual({ allowed: true });
  });

  it('counts only PENDING/PROCESSING runs toward concurrency', async () => {
    const { guard, count } = buildGuard({});

    await guard.assertAvailable(BASE_INPUT);

    expect(count).toHaveBeenCalledWith({
      where: { status: { in: [AiSummaryRunStatus.PENDING, AiSummaryRunStatus.PROCESSING] } },
    });
  });

  it('uses actualCostMicroUsd over estimatedCostMicroUsd once a row has resolved', async () => {
    const { guard } = buildGuard({
      // estimated was $0.10, but the real call turned out to cost $0.48 -- the
      // actual figure must be the one compared against the $0.50 cap, not the
      // stale pre-call estimate.
      perDocumentRows: [{ estimatedCostMicroUsd: 100_000, actualCostMicroUsd: 480_000 }],
    });

    const result = await guard.assertAvailable({ ...BASE_INPUT, estimatedCostMicroUsd: 30_000 }); // +$0.03 -> $0.51

    expect(result).toEqual({ allowed: false, reason: 'PER_DOCUMENT' });
  });

  it('reports the first exceeded tier in brief order, even when multiple tiers are exceeded', async () => {
    const { guard } = buildGuard({
      perDocumentRows: [{ estimatedCostMicroUsd: 1_000_000, actualCostMicroUsd: null }], // already over its own $0.50 cap
      dailyOrgRows: [{ estimatedCostMicroUsd: 10_000_000, actualCostMicroUsd: null }], // also already over its $5 cap
      concurrentRunCount: 5, // also already over its own cap of 2
    });

    const result = await guard.assertAvailable(BASE_INPUT);

    expect(result).toEqual({ allowed: false, reason: 'PER_DOCUMENT' });
  });
});
