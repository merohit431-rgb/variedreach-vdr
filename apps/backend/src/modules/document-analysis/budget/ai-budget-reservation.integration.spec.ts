import { randomUUID } from 'crypto';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import type EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import { AiBudgetGuard } from './ai-budget.guard';
import { AiUsageLedgerService } from './ai-usage-ledger.service';
import type { ConfigService } from '@nestjs/config';

// This is the one test in the suite that talks to a REAL Postgres instead
// of a mocked PrismaService. Unit tests (ai-budget.guard.spec.ts) prove the
// guard's tier logic and that it acquires an advisory lock before reading
// any totals; neither proves the lock actually serializes concurrent
// transactions under real connection-pool parallelism, which is the entire
// point of the fix (a check-then-write race that a mocked single-process
// test structurally cannot exercise). A real `pg_advisory_xact_lock`
// against a real embedded Postgres 16 instance (matching production's
// postgres:16-alpine) is the only genuine way to prove it. Starting a real
// cluster and running a real `prisma db push` takes real wall-clock time --
// this file is intentionally the only place that cost is paid.
jest.setTimeout(180_000);

const PORT = 54_329;
const DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?connection_limit=20`;
const BACKEND_ROOT = path.resolve(__dirname, '../../../..');
// npm workspaces hoist devDependency binaries (prisma included) to the
// monorepo root's node_modules/.bin, not apps/backend's own (which doesn't
// exist as a separate directory at all) -- same place `prisma generate` was
// run from by hand earlier in this phase.
const WORKSPACE_ROOT = path.resolve(BACKEND_ROOT, '../..');
const PRISMA_BIN = path.join(WORKSPACE_ROOT, 'node_modules/.bin/prisma');

// embedded-postgres ships ESM-only (no CJS build) -- this backend's Jest
// runs under ts-jest/commonjs, which can't `require()` it. A plain static
// `import` gets downleveled to `require` and fails exactly like the
// project's earlier bullmq-vs-@nestjs/bullmq ESM lesson; routing the import
// through `new Function` hides the call from TypeScript's own static
// downleveling so Node's real dynamic-import loader handles it instead.
const importEsm = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ default: typeof EmbeddedPostgres }>;

describe('AiBudgetGuard.reserveBudget concurrency (real Postgres)', () => {
  let pg: EmbeddedPostgres;
  let prisma: PrismaClient;
  let guard: AiBudgetGuard;
  let ledger: AiUsageLedgerService;

  beforeAll(async () => {
    const { default: EmbeddedPostgresCtor } = await importEsm('embedded-postgres');
    pg = new EmbeddedPostgresCtor({
      databaseDir: path.join(os.tmpdir(), `vdr-ai-budget-pg-${randomUUID()}`),
      user: 'postgres',
      password: 'postgres',
      port: PORT,
      persistent: false,
      onLog: () => undefined,
      onError: () => undefined,
    });
    await pg.initialise();
    await pg.start();

    // Reuses the project's real schema.prisma rather than hand-duplicating
    // table definitions in raw SQL -- this is exactly what a staging
    // deploy runs (see the Operations Runbook), just pointed at a throwaway
    // local cluster instead.
    execFileSync(PRISMA_BIN, ['db', 'push', '--skip-generate', '--accept-data-loss'], {
      cwd: BACKEND_ROOT,
      env: { ...process.env, DATABASE_URL },
      stdio: 'pipe',
    });

    prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await pg?.stop();
  });

  function buildGuard(limits: Partial<Record<string, number>>) {
    const defaults = {
      'aiBudget.maxCostPerDocumentUsd': 100,
      'aiBudget.maxDailyOrgCostUsd': 100,
      'aiBudget.maxMonthlyOrgCostUsd': 100,
      'aiBudget.maxGlobalStagingCostUsd': 100,
      'aiBudget.maxConcurrentJobs': 100,
      ...limits,
    };
    const configService = { get: jest.fn((key: string) => defaults[key as keyof typeof defaults]) } as unknown as ConfigService;
    return new AiBudgetGuard(prisma as never, configService);
  }

  function reservationInput(documentAnalysisId: string, estimatedCostMicroUsd: number) {
    return {
      organisationId: 'org-concurrency-test',
      dataRoomId: 'room-concurrency-test',
      fileId: 'file-concurrency-test',
      documentAnalysisId,
      jobId: `job-${randomUUID()}`,
      model: 'claude-sonnet-5-5',
      estimatedCostMicroUsd,
    };
  }

  beforeEach(() => {
    guard = buildGuard({});
    ledger = new AiUsageLedgerService(prisma as never);
  });

  afterEach(async () => {
    await prisma.aiUsageLedger.deleteMany({});
  });

  it('never lets concurrent reservations collectively exceed the per-document cap, even with 10 racing at once', async () => {
    // $0.10 per chunk, a $0.30 document cap -- room for exactly 3.
    const documentAnalysisId = `analysis-${randomUUID()}`;
    guard = buildGuard({ 'aiBudget.maxCostPerDocumentUsd': 0.3 });
    const PER_CHUNK_MICRO_USD = 100_000;
    const ATTEMPTS = 10;

    const results = await Promise.all(
      Array.from({ length: ATTEMPTS }, () => guard.reserveBudget(reservationInput(documentAnalysisId, PER_CHUNK_MICRO_USD))),
    );

    const allowed = results.filter((r) => r.allowed);
    const blocked = results.filter((r) => !r.allowed);
    expect(allowed).toHaveLength(3);
    expect(blocked).toHaveLength(7);
    expect(blocked.every((r) => r.reason === 'PER_DOCUMENT')).toBe(true);

    // Independently re-read the real persisted state (not the in-memory
    // return values) -- this is the figure a second, later process would
    // actually see, and is the thing that must never exceed the cap.
    const rows = await prisma.aiUsageLedger.findMany({ where: { documentAnalysisId, status: 'RESERVED' } });
    expect(rows).toHaveLength(3);
    const totalReservedMicroUsd = rows.reduce((sum, r) => sum + r.estimatedCostMicroUsd, 0);
    expect(totalReservedMicroUsd).toBe(3 * PER_CHUNK_MICRO_USD);
    expect(totalReservedMicroUsd).toBeLessThanOrEqual(300_000);

    const blockedRows = await prisma.aiUsageLedger.findMany({ where: { documentAnalysisId, status: 'BUDGET_BLOCKED' } });
    expect(blockedRows).toHaveLength(7);
  });

  it('never lets concurrent reservations across DIFFERENT documents collectively exceed the shared org/global cap', async () => {
    // Same organisation, but each attempt uses its own documentAnalysisId --
    // proves the lock's scope is genuinely global/org-wide, not keyed only
    // to one document, matching "concurrent-request protection across
    // multiple workers" rather than just within one document's chunk loop.
    guard = buildGuard({ 'aiBudget.maxDailyOrgCostUsd': 0.3 });
    const PER_CHUNK_MICRO_USD = 100_000;
    const ATTEMPTS = 10;

    const results = await Promise.all(
      Array.from({ length: ATTEMPTS }, () => guard.reserveBudget(reservationInput(`analysis-${randomUUID()}`, PER_CHUNK_MICRO_USD))),
    );

    expect(results.filter((r) => r.allowed)).toHaveLength(3);
    expect(results.filter((r) => !r.allowed).every((r) => r.reason === 'DAILY_ORG')).toBe(true);
  });

  it('releasing a reservation frees real, persisted capacity for a subsequent one', async () => {
    const documentAnalysisId = `analysis-${randomUUID()}`;
    guard = buildGuard({ 'aiBudget.maxCostPerDocumentUsd': 0.1 });
    const CHUNK_MICRO_USD = 100_000; // exactly the whole cap -- room for 1

    const first = await guard.reserveBudget(reservationInput(documentAnalysisId, CHUNK_MICRO_USD));
    expect(first.allowed).toBe(true);

    const second = await guard.reserveBudget(reservationInput(documentAnalysisId, CHUNK_MICRO_USD));
    expect(second.allowed).toBe(false); // cap already fully reserved by `first`

    await ledger.release(first.reservationId!);

    const third = await guard.reserveBudget(reservationInput(documentAnalysisId, CHUNK_MICRO_USD));
    expect(third.allowed).toBe(true); // released capacity is real, not just returned-value bookkeeping

    const releasedRow = await prisma.aiUsageLedger.findUnique({ where: { id: first.reservationId! } });
    expect(releasedRow?.status).toBe('RELEASED');
  });

  it('a RESERVED row that is never finalized still counts, exactly like a resolved call -- no silent expiry', async () => {
    const documentAnalysisId = `analysis-${randomUUID()}`;
    guard = buildGuard({ 'aiBudget.maxCostPerDocumentUsd': 0.1 });
    const CHUNK_MICRO_USD = 100_000;

    const reservation = await guard.reserveBudget(reservationInput(documentAnalysisId, CHUNK_MICRO_USD));
    expect(reservation.allowed).toBe(true);
    // Deliberately never finalized or released -- simulates a worker
    // process crashing between reserving and dispatching.

    const second = await guard.reserveBudget(reservationInput(documentAnalysisId, CHUNK_MICRO_USD));
    expect(second.allowed).toBe(false);
    expect(second.reason).toBe('PER_DOCUMENT');
  });
});
