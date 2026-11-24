import { Injectable } from '@nestjs/common';
import { AiUsageLedger, AiUsageStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface FinalizeSuccessInput {
  model: string;
  inputTokens: number;
  outputTokens: number;
  actualCostMicroUsd: number;
}

// One row per Claude call ATTEMPT (not per analysis) -- including failed,
// rate-limited, timed-out, and budget-blocked attempts, satisfying "usage
// accounting for failed and retried requests" directly. Deliberately
// carries no document text anywhere -- only IDs, model/token/cost numbers,
// and a status.
//
// Every live row starts life as AiBudgetGuard.reserveBudget's RESERVED
// insert (the one write that must happen inside its advisory-locked
// transaction) and ends via exactly one of the three methods below --
// there is no longer a standalone "create a resolved row from scratch"
// path, since every resolved call was necessarily reserved first.
@Injectable()
export class AiUsageLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async finalizeSuccess(reservationId: string, input: FinalizeSuccessInput): Promise<AiUsageLedger> {
    return this.prisma.aiUsageLedger.update({
      where: { id: reservationId },
      data: {
        status: AiUsageStatus.SUCCEEDED,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        actualCostMicroUsd: input.actualCostMicroUsd,
      },
    });
  }

  async finalizeFailure(
    reservationId: string,
    status: Extract<AiUsageStatus, 'FAILED' | 'RATE_LIMITED' | 'TIMEOUT'>,
  ): Promise<AiUsageLedger> {
    // actualCostMicroUsd stays null -- the call never returned a usage
    // figure, so the reserved estimate is the only honest number on this
    // row; it still counts toward every budget tier via sumEffectiveCost's
    // actual-else-estimated fallback, satisfying "accounting for billable
    // failed requests" without fabricating a real token count.
    return this.prisma.aiUsageLedger.update({ where: { id: reservationId }, data: { status } });
  }

  // The one case where a reservation must stop counting toward budget: the
  // chunk it was made for was safely cancelled before ever being
  // dispatched to Anthropic, so no spend -- billable or not -- occurred.
  async release(reservationId: string): Promise<AiUsageLedger> {
    return this.prisma.aiUsageLedger.update({ where: { id: reservationId }, data: { status: AiUsageStatus.RELEASED } });
  }
}
