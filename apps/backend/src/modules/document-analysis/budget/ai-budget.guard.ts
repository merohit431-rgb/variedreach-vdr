import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiSummaryRunStatus, AiUsageStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export type AiBudgetLimitType = 'PER_DOCUMENT' | 'DAILY_ORG' | 'MONTHLY_ORG' | 'GLOBAL_STAGING' | 'CONCURRENCY';

export interface AiBudgetCheck {
  allowed: boolean;
  reason?: AiBudgetLimitType;
  // Present only when allowed -- the AiUsageLedger row id the caller must
  // later release (cancelled before dispatch) or finalize (call resolved).
  reservationId?: string;
}

export interface ReserveBudgetInput {
  organisationId: string;
  dataRoomId: string;
  fileId: string;
  documentAnalysisId: string;
  // Absent for a BUDGET_BLOCKED row recorded before an AiSummaryRun exists.
  aiSummaryRunId?: string;
  jobId: string;
  model: string;
  estimatedCostMicroUsd: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;

// A fixed, arbitrary key for a Postgres transaction-scoped advisory lock
// (pg_advisory_xact_lock) -- a server-side mutex held for the duration of
// one DB transaction and released automatically on commit/rollback,
// visible to and blocking on EVERY connection across EVERY process that
// requests the same key, not just within one Node process. This is what
// makes reserveBudget's check-then-insert genuinely atomic under real
// concurrent load (multiple BullMQ workers, multiple app instances) --
// something no amount of in-process locking (a mutex, a semaphore) could
// provide, since those only ever protect a single process's own memory.
const AI_BUDGET_ADVISORY_LOCK_KEY = 822020100401n;

// Every status that represents spend which has happened or is about to --
// a RESERVED row counts exactly like a resolved one, so a second concurrent
// reservation attempt (blocked on the advisory lock until the first
// commits) sees the true, up-to-the-moment total the instant it acquires
// the lock. BUDGET_BLOCKED (call never made) and RELEASED (reserved, then
// safely cancelled before dispatch) are the only two statuses that must
// never count -- both represent zero real or pending spend.
const COUNTED_STATUSES: AiUsageStatus[] = [
  AiUsageStatus.SUCCEEDED,
  AiUsageStatus.FAILED,
  AiUsageStatus.RATE_LIMITED,
  AiUsageStatus.TIMEOUT,
  AiUsageStatus.RESERVED,
];

// Sum of COALESCE(actualCostMicroUsd, estimatedCostMicroUsd) across a set of
// rows -- the actual figure once the API has returned usage, else the
// pre-call estimate (which is also what a live RESERVED row always carries,
// since it has no actual figure yet), so an in-flight or reserved call
// counts toward the budget immediately rather than only after it resolves.
function sumEffectiveCost(rows: Array<{ estimatedCostMicroUsd: number; actualCostMicroUsd: number | null }>): number {
  return rows.reduce((total, row) => total + (row.actualCostMicroUsd ?? row.estimatedCostMicroUsd), 0);
}

// Mirrors org-storage.util.ts's getOrgStorageUsage/assertOrgStorageAvailable
// pattern, upgraded from a pure check to a genuine atomic reservation: the
// four budget tiers, the concurrency cap, and the AiUsageLedger row that
// durably records the outcome all happen inside one advisory-locked
// transaction, so two callers racing each other can never both observe
// "room available" for the same budget twice over. Called once per chunk
// (every chunk is one real paid Anthropic request) by ClaudeSynthesisService,
// immediately before that chunk is dispatched.
@Injectable()
export class AiBudgetGuard {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async reserveBudget(input: ReserveBudgetInput): Promise<AiBudgetCheck> {
    const config = {
      maxCostPerDocumentUsd: this.configService.get<number>('aiBudget.maxCostPerDocumentUsd')!,
      maxDailyOrgCostUsd: this.configService.get<number>('aiBudget.maxDailyOrgCostUsd')!,
      maxMonthlyOrgCostUsd: this.configService.get<number>('aiBudget.maxMonthlyOrgCostUsd')!,
      maxGlobalStagingCostUsd: this.configService.get<number>('aiBudget.maxGlobalStagingCostUsd')!,
      maxConcurrentJobs: this.configService.get<number>('aiBudget.maxConcurrentJobs')!,
    };

    return this.prisma.$transaction(async (tx) => {
      // Everything from here to the end of the callback runs inside the
      // lock -- any other transaction (this process or another) requesting
      // the same key blocks until this one commits or rolls back.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AI_BUDGET_ADVISORY_LOCK_KEY})`;

      const now = Date.now();
      const costSelect = { estimatedCostMicroUsd: true, actualCostMicroUsd: true } as const;
      const countedWhere = { status: { in: COUNTED_STATUSES } };

      const [perDocumentRows, dailyOrgRows, monthlyOrgRows, globalRows, concurrentRunCount] = await Promise.all([
        tx.aiUsageLedger.findMany({
          where: { ...countedWhere, documentAnalysisId: input.documentAnalysisId },
          select: costSelect,
        }),
        tx.aiUsageLedger.findMany({
          where: { ...countedWhere, organisationId: input.organisationId, createdAt: { gte: new Date(now - ONE_DAY_MS) } },
          select: costSelect,
        }),
        tx.aiUsageLedger.findMany({
          where: { ...countedWhere, organisationId: input.organisationId, createdAt: { gte: new Date(now - THIRTY_DAYS_MS) } },
          select: costSelect,
        }),
        // Deliberately no time window -- a hard, all-time ceiling on this
        // entire staging deployment's AI spend, so raising it requires a
        // conscious config change rather than silently replenishing daily.
        tx.aiUsageLedger.findMany({ where: countedWhere, select: costSelect }),
        tx.aiSummaryRun.count({
          where: { status: { in: [AiSummaryRunStatus.PENDING, AiSummaryRunStatus.PROCESSING] } },
        }),
      ]);

      // Order matches the brief's own tier list; the first tier that would
      // be exceeded is reported, not every tier that would be.
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
        // Concurrency is a count of RUNS (documents), not chunks -- a
        // multi-chunk document already holds its one PROCESSING slot for
        // every chunk it processes, so this tier is unaffected by moving
        // reservation to per-chunk granularity.
        ['CONCURRENCY', concurrentRunCount >= config.maxConcurrentJobs],
      ];

      const exceeded = checks.find(([, isExceeded]) => isExceeded);

      const ledgerBase = {
        organisationId: input.organisationId,
        dataRoomId: input.dataRoomId,
        fileId: input.fileId,
        documentAnalysisId: input.documentAnalysisId,
        aiSummaryRunId: input.aiSummaryRunId,
        jobId: input.jobId,
        provider: 'ANTHROPIC',
        model: input.model,
        estimatedCostMicroUsd: input.estimatedCostMicroUsd,
      };

      if (exceeded) {
        await tx.aiUsageLedger.create({ data: { ...ledgerBase, status: AiUsageStatus.BUDGET_BLOCKED } });
        return { allowed: false, reason: exceeded[0] };
      }

      const reservation = await tx.aiUsageLedger.create({ data: { ...ledgerBase, status: AiUsageStatus.RESERVED } });
      return { allowed: true, reservationId: reservation.id };
    });
  }
}
