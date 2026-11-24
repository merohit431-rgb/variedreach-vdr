import { AiUsageStatus } from '@prisma/client';
import { AiUsageLedgerService } from './ai-usage-ledger.service';
import type { PrismaService } from '../../../prisma/prisma.service';

function buildService() {
  const update = jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({ id: where.id, ...data }));
  const prisma = { aiUsageLedger: { update } } as unknown as PrismaService;
  return { service: new AiUsageLedgerService(prisma), update };
}

describe('AiUsageLedgerService', () => {
  it('finalizeSuccess updates the reservation row to SUCCEEDED with the real token/cost figures', async () => {
    const { service, update } = buildService();

    await service.finalizeSuccess('reservation-1', { model: 'claude-sonnet-5-5', inputTokens: 1200, outputTokens: 300, actualCostMicroUsd: 5_400 });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'reservation-1' },
      data: { status: AiUsageStatus.SUCCEEDED, model: 'claude-sonnet-5-5', inputTokens: 1200, outputTokens: 300, actualCostMicroUsd: 5_400 },
    });
  });

  it('finalizeFailure updates only the status, leaving actualCostMicroUsd untouched (no usage was ever returned)', async () => {
    const { service, update } = buildService();

    await service.finalizeFailure('reservation-2', 'RATE_LIMITED');

    expect(update).toHaveBeenCalledWith({ where: { id: 'reservation-2' }, data: { status: 'RATE_LIMITED' } });
  });

  it('release marks a pre-dispatch-cancelled reservation RELEASED', async () => {
    const { service, update } = buildService();

    await service.release('reservation-3');

    expect(update).toHaveBeenCalledWith({ where: { id: 'reservation-3' }, data: { status: AiUsageStatus.RELEASED } });
  });
});
