import { Injectable } from '@nestjs/common';
import { AiUsageLedger, AiUsageStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface RecordUsageInput {
  organisationId: string;
  dataRoomId: string;
  fileId: string;
  documentAnalysisId: string;
  // Absent for a BUDGET_BLOCKED row recorded before an AiSummaryRun exists.
  aiSummaryRunId?: string;
  jobId: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostMicroUsd: number;
  // Absent until the (synchronous) Messages API response returns usage --
  // in practice only ever absent for a BUDGET_BLOCKED/FAILED-before-response row.
  actualCostMicroUsd?: number;
  status: AiUsageStatus;
}

// One write per call ATTEMPT, not per analysis -- deliberately including
// failed, rate-limited, timed-out, and budget-blocked attempts, so spend
// visibility and "usage accounting for failed and retried requests" (Phase
// 3C brief, section 11) aren't limited to successful calls only. Never
// stores document text, a prompt, or a response -- only IDs, token/cost
// numbers, and a status, matching the brief's cost-ledger privacy
// requirement directly.
@Injectable()
export class AiUsageLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordUsageInput): Promise<AiUsageLedger> {
    return this.prisma.aiUsageLedger.create({
      data: {
        organisationId: input.organisationId,
        dataRoomId: input.dataRoomId,
        fileId: input.fileId,
        documentAnalysisId: input.documentAnalysisId,
        aiSummaryRunId: input.aiSummaryRunId,
        jobId: input.jobId,
        provider: 'ANTHROPIC',
        model: input.model,
        inputTokens: input.inputTokens ?? 0,
        outputTokens: input.outputTokens ?? 0,
        estimatedCostMicroUsd: input.estimatedCostMicroUsd,
        actualCostMicroUsd: input.actualCostMicroUsd,
        status: input.status,
      },
    });
  }
}
