import { randomUUID } from 'crypto';
import { AiSummaryRunStatus, DocumentAnalysisStatus, StatementVerificationStatus } from '@prisma/client';
import { ClaudeSynthesisService } from './claude-synthesis.service';
import { StatementVerificationService } from '../verification/statement-verification.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { AuditLogService } from '../../audit/audit-log.service';
import type { AiBudgetGuard } from '../budget/ai-budget.guard';
import type { AiUsageLedgerService } from '../budget/ai-usage-ledger.service';
import type { ChunkSentenceInput } from '../chunking/page-chunk.builder';
import type { ClaudeChunkAnalysisResult, DocumentSynthesisProvider } from '../providers/claude/claude-summary.interface';

const CONFIG: Record<string, unknown> = {
  'claude.apiEnabled': true,
  'claude.summaryModel': 'claude-sonnet-5-5',
  'claude.maxInputTokens': 150_000,
  'claude.maxTokens': 4096,
  'claude.inputPricePerMTokUsd': 2.0,
  'claude.outputPricePerMTokUsd': 10.0,
};

// A minimal, stateful in-memory fake covering only the four models/methods
// this orchestrator actually touches -- enough for assertions to read back
// real post-call state, without a disconnected pile of per-call jest.fn()s.
function buildFakePrisma() {
  const runs = new Map<string, Record<string, unknown>>();
  const statements: Array<Record<string, unknown>> = [];
  let documentAnalysisStatus: DocumentAnalysisStatus = DocumentAnalysisStatus.PROCESSING;

  const prisma = {
    aiSummaryRun: {
      findUnique: jest.fn(async ({ where }: { where: { documentAnalysisId: string } }) =>
        Array.from(runs.values()).find((r) => r.documentAnalysisId === where.documentAnalysisId) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: randomUUID(),
          completedChunkIndexes: [],
          inputTokens: 0,
          outputTokens: 0,
          actualCostMicroUsd: 0,
          modelUsed: null,
          ...data,
        };
        runs.set(row.id as string, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = runs.get(where.id)!;
        const updated = { ...existing };
        for (const [key, value] of Object.entries(data)) {
          if (key === 'completedChunkIndexes' && value && typeof value === 'object' && 'push' in (value as object)) {
            updated.completedChunkIndexes = [...(existing.completedChunkIndexes as number[]), (value as { push: number }).push];
          } else {
            updated[key] = value;
          }
        }
        runs.set(where.id, updated);
        return updated;
      }),
    },
    aiSummaryStatement: {
      count: jest.fn(async ({ where }: { where: { aiSummaryRunId: string } }) =>
        statements.filter((s) => s.aiSummaryRunId === where.aiSummaryRunId).length,
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: randomUUID(), ...data };
        statements.push(row);
        return row;
      }),
    },
    documentAnalysis: {
      findUnique: jest.fn(async () => ({ status: documentAnalysisStatus })),
    },
  } as unknown as PrismaService;

  return {
    prisma,
    runs,
    statements,
    setDocumentAnalysisStatus: (status: DocumentAnalysisStatus) => {
      documentAnalysisStatus = status;
    },
  };
}

function buildService(opts: {
  config?: Record<string, unknown>;
  budgetAllowed?: boolean;
  budgetReason?: string;
  providerResults?: ClaudeChunkAnalysisResult[];
  providerError?: Error;
}) {
  const config = { ...CONFIG, ...opts.config };
  const configService = { get: jest.fn((key: string) => config[key]) } as unknown as ConfigService;
  const auditRecord = jest.fn().mockResolvedValue({});
  const auditLogService = { record: auditRecord } as unknown as AuditLogService;
  const budgetAssertAvailable = jest
    .fn()
    .mockResolvedValue(opts.budgetAllowed === false ? { allowed: false, reason: opts.budgetReason ?? 'DAILY_ORG' } : { allowed: true });
  const budgetGuard = { assertAvailable: budgetAssertAvailable } as unknown as AiBudgetGuard;
  const ledgerRecord = jest.fn().mockResolvedValue({});
  const usageLedger = { record: ledgerRecord } as unknown as AiUsageLedgerService;
  const verificationService = new StatementVerificationService();

  let callIndex = 0;
  const analyzeChunk = jest.fn(async () => {
    if (opts.providerError) throw opts.providerError;
    const result = opts.providerResults?.[callIndex] ?? { statements: [], modelUsed: 'claude-sonnet-5-5', inputTokens: 100, outputTokens: 50, stopReason: 'end_turn' };
    callIndex += 1;
    return result;
  });
  const provider = { analyzeChunk } as unknown as DocumentSynthesisProvider;

  const fakePrisma = buildFakePrisma();
  const service = new ClaudeSynthesisService(
    fakePrisma.prisma,
    configService,
    auditLogService,
    budgetGuard,
    usageLedger,
    verificationService,
    provider,
  );

  return { service, ...fakePrisma, auditRecord, budgetAssertAvailable, ledgerRecord, analyzeChunk };
}

function sentence(id: string, pageNumber: number, text: string): ChunkSentenceInput {
  return { sentenceId: id, pageNumber, sequenceNumber: 0, text, extractionMethod: 'NATIVE_TEXT' };
}

const BASE_INPUT = {
  documentAnalysisId: 'analysis-1',
  dataRoomId: 'room-1',
  organisationId: 'org-1',
  fileId: 'file-1',
  jobId: 'job-1',
};

describe('ClaudeSynthesisService.run', () => {
  it('returns null and touches nothing when claude.apiEnabled is false', async () => {
    const { service, analyzeChunk, budgetAssertAvailable, runs } = buildService({ config: { 'claude.apiEnabled': false } });

    const result = await service.run({ ...BASE_INPUT, sentences: [sentence('s1', 1, 'Some text.')] });

    expect(result).toBeNull();
    expect(analyzeChunk).not.toHaveBeenCalled();
    expect(budgetAssertAvailable).not.toHaveBeenCalled();
    expect(runs.size).toBe(0);
  });

  it('returns null and creates no run when there are no sentences to analyze', async () => {
    const { service, runs } = buildService({});

    const result = await service.run({ ...BASE_INPUT, sentences: [] });

    expect(result).toBeNull();
    expect(runs.size).toBe(0);
  });

  it('returns SKIPPED_LIMIT_REACHED and records a BUDGET_BLOCKED ledger row + audit event, without calling the provider', async () => {
    const { service, analyzeChunk, ledgerRecord, auditRecord, runs } = buildService({
      budgetAllowed: false,
      budgetReason: 'DAILY_ORG',
    });

    const result = await service.run({ ...BASE_INPUT, sentences: [sentence('s1', 1, 'Some text.')] });

    expect(result).toBe(AiSummaryRunStatus.SKIPPED_LIMIT_REACHED);
    expect(analyzeChunk).not.toHaveBeenCalled();
    expect(ledgerRecord).toHaveBeenCalledWith(expect.objectContaining({ status: 'BUDGET_BLOCKED' }));
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AI_BUDGET_LIMIT_REACHED', metadata: expect.objectContaining({ limitType: 'DAILY_ORG' }) }),
    );
    expect(runs.size).toBe(0); // budget-blocked happens before any AiSummaryRun row is created
  });

  it('completes successfully, persisting a verified statement with its citation', async () => {
    const { service, runs, statements } = buildService({
      providerResults: [
        {
          statements: [{ sectionType: 'FINANCIAL_FIGURES', statementText: 'The claim is ₹10,00,000.', citedSentenceIds: ['s1'] }],
          modelUsed: 'claude-sonnet-5-5',
          inputTokens: 200,
          outputTokens: 60,
          stopReason: 'end_turn',
        },
      ],
    });

    const result = await service.run({
      ...BASE_INPUT,
      sentences: [sentence('s1', 1, 'The outstanding claim amount is ₹10,00,000.')],
    });

    expect(result).toBe(AiSummaryRunStatus.COMPLETED);
    expect(runs.size).toBe(1);
    const run = Array.from(runs.values())[0];
    expect(run.status).toBe(AiSummaryRunStatus.COMPLETED);
    expect(run.inputTokens).toBe(200);
    expect(run.outputTokens).toBe(60);
    expect(run.completedChunkIndexes).toEqual([0]);
    expect(statements).toHaveLength(1);
    expect(statements[0].verificationStatus).toBe(StatementVerificationStatus.VERIFIED);
  });

  it('marks the run COMPLETED_WITH_WARNINGS when a statement cannot be verified', async () => {
    const { service, runs } = buildService({
      providerResults: [
        {
          statements: [{ sectionType: 'FINANCIAL_FIGURES', statementText: 'The claim is ₹99,99,999.', citedSentenceIds: ['s1'] }],
          modelUsed: 'claude-sonnet-5-5',
          inputTokens: 200,
          outputTokens: 60,
          stopReason: 'end_turn',
        },
      ],
    });

    const result = await service.run({
      ...BASE_INPUT,
      sentences: [sentence('s1', 1, 'The outstanding claim amount is ₹10,00,000.')], // does not match ₹99,99,999
    });

    expect(result).toBe(AiSummaryRunStatus.COMPLETED_WITH_WARNINGS);
    expect(Array.from(runs.values())[0].status).toBe(AiSummaryRunStatus.COMPLETED_WITH_WARNINGS);
  });

  it('ADVERSARIAL: drops a statement entirely when every cited sentenceId is fabricated', async () => {
    const { service, statements } = buildService({
      providerResults: [
        {
          statements: [{ sectionType: 'PARTIES', statementText: 'A fabricated party is named here.', citedSentenceIds: ['does-not-exist'] }],
          modelUsed: 'claude-sonnet-5-5',
          inputTokens: 100,
          outputTokens: 30,
          stopReason: 'end_turn',
        },
      ],
    });

    await service.run({ ...BASE_INPUT, sentences: [sentence('s1', 1, 'Real sentence text.')] });

    expect(statements).toHaveLength(0);
  });

  it('ADVERSARIAL: a statement with a mix of valid and fabricated citations keeps only the valid one', async () => {
    const { service, statements } = buildService({
      providerResults: [
        {
          statements: [
            { sectionType: 'PARTIES', statementText: 'A party is named here.', citedSentenceIds: ['s1', 'fabricated-id'] },
          ],
          modelUsed: 'claude-sonnet-5-5',
          inputTokens: 100,
          outputTokens: 30,
          stopReason: 'end_turn',
        },
      ],
    });

    await service.run({ ...BASE_INPUT, sentences: [sentence('s1', 1, 'A party is named here in the real document.')] });

    expect(statements).toHaveLength(1);
    expect((statements[0].citations as { create: Array<{ extractedSentenceId: string }> }).create).toEqual([
      { extractedSentenceId: 's1', citationOrder: 0 },
    ]);
  });

  it('ADVERSARIAL (cross-chunk): a real sentenceId from a DIFFERENT chunk of the same document is treated as fabricated', async () => {
    // Two pages, small token budget forces two separate chunks.
    const page1 = sentence('s1', 1, 'x'.repeat(200));
    const page2 = sentence('s2', 2, 'y'.repeat(200));
    const { service, statements } = buildService({
      config: { 'claude.maxInputTokens': 60 }, // forces a chunk boundary between page 1 and page 2
      providerResults: [
        // Chunk 0 (page 1) claims to cite s2, which only exists in chunk 1 (page 2) -- never shown to it.
        {
          statements: [{ sectionType: 'OTHER_MATERIAL', statementText: 'Cross-chunk citation attempt.', citedSentenceIds: ['s2'] }],
          modelUsed: 'claude-sonnet-5-5',
          inputTokens: 50,
          outputTokens: 20,
          stopReason: 'end_turn',
        },
        { statements: [], modelUsed: 'claude-sonnet-5-5', inputTokens: 50, outputTokens: 20, stopReason: 'end_turn' },
      ],
    });

    await service.run({ ...BASE_INPUT, sentences: [page1, page2] });

    expect(statements).toHaveLength(0); // dropped -- s2 was real, but not part of chunk 0
  });

  it('stops the run and marks it FAILED when the provider throws, recording the failure in the ledger', async () => {
    const error = new Error('simulated failure');
    error.name = 'ClaudeRateLimitedError';
    const { service, runs, ledgerRecord } = buildService({ providerError: error });

    const result = await service.run({ ...BASE_INPUT, sentences: [sentence('s1', 1, 'Some text.')] });

    expect(result).toBe(AiSummaryRunStatus.FAILED);
    expect(Array.from(runs.values())[0].status).toBe(AiSummaryRunStatus.FAILED);
    expect(ledgerRecord).toHaveBeenCalledWith(expect.objectContaining({ status: 'RATE_LIMITED' }));
  });

  it('stops before the next chunk and marks the run FAILED when the analysis is cancelled mid-run', async () => {
    const page1 = sentence('s1', 1, 'x'.repeat(200));
    const page2 = sentence('s2', 2, 'y'.repeat(200));
    const { service, runs, analyzeChunk, setDocumentAnalysisStatus } = buildService({
      config: { 'claude.maxInputTokens': 60 },
    });

    // Cancel after the first chunk's analyzeChunk call resolves, before the second's.
    let calls = 0;
    (analyzeChunk as jest.Mock).mockImplementation(async () => {
      calls += 1;
      if (calls === 1) setDocumentAnalysisStatus(DocumentAnalysisStatus.CANCELLED);
      return { statements: [], modelUsed: 'claude-sonnet-5-5', inputTokens: 10, outputTokens: 10, stopReason: 'end_turn' };
    });

    const result = await service.run({ ...BASE_INPUT, sentences: [page1, page2] });

    expect(result).toBe(AiSummaryRunStatus.FAILED);
    expect(analyzeChunk).toHaveBeenCalledTimes(1); // the second chunk's paid call never happened
    expect(Array.from(runs.values())[0].status).toBe(AiSummaryRunStatus.FAILED);
  });

  it('resumes an existing run, skipping chunks already in completedChunkIndexes, never re-paying for completed work', async () => {
    const page1 = sentence('s1', 1, 'x'.repeat(200));
    const page2 = sentence('s2', 2, 'y'.repeat(200));
    const { service, runs, analyzeChunk } = buildService({ config: { 'claude.maxInputTokens': 60 } });

    // Seed an existing run as if chunk 0 already completed in a prior attempt.
    await service.run({ ...BASE_INPUT, sentences: [page1] }); // creates the run, completes chunk 0 alone
    analyzeChunk.mockClear();

    const result = await service.run({ ...BASE_INPUT, sentences: [page1, page2] });

    expect(result).toBe(AiSummaryRunStatus.COMPLETED);
    expect(analyzeChunk).toHaveBeenCalledTimes(1); // only chunk 1 (page2) was called -- chunk 0 was skipped
    expect(runs.size).toBe(1); // updated the existing run, not a second one
  });
});
