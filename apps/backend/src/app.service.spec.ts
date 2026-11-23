import { AppService } from './app.service';
import type { PrismaService } from './prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';

const mockConnect = jest.fn();
const mockPing = jest.fn();
const mockDisconnect = jest.fn();

jest.mock('ioredis', () => {
  const MockRedis = jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    ping: mockPing,
    disconnect: mockDisconnect,
  }));
  return { __esModule: true, default: MockRedis };
});

// Phase 4 finding: getHealth() previously only checked Postgres, and the
// controller always returned HTTP 200 regardless of what it found --
// Docker's own healthcheck (keyed off HTTP status alone) could never detect
// a database OR Redis outage. These tests cover the fixed service; the
// controller's status-code behavior is covered separately in
// app.controller.spec.ts.
describe('AppService.getHealth (Phase 4)', () => {
  const configService = { get: jest.fn().mockReturnValue('redis://localhost:6379') } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports "ok" when both Postgres and Redis respond', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as unknown as PrismaService;
    mockConnect.mockResolvedValue(undefined);
    mockPing.mockResolvedValue('PONG');
    const service = new AppService(prisma, configService);

    const health = await service.getHealth();

    expect(health.status).toBe('ok');
    expect(health.db.status).toBe('ok');
    expect(health.redis.status).toBe('ok');
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('reports "degraded" when Postgres fails, even if Redis is fine', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')) } as unknown as PrismaService;
    mockConnect.mockResolvedValue(undefined);
    mockPing.mockResolvedValue('PONG');
    const service = new AppService(prisma, configService);

    const health = await service.getHealth();

    expect(health.status).toBe('degraded');
    expect(health.db.status).toBe('error');
    expect(health.redis.status).toBe('ok');
  });

  it('reports "degraded" when Redis fails, even if Postgres is fine', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as unknown as PrismaService;
    mockConnect.mockRejectedValue(new Error('ECONNREFUSED'));
    const service = new AppService(prisma, configService);

    const health = await service.getHealth();

    expect(health.status).toBe('degraded');
    expect(health.db.status).toBe('ok');
    expect(health.redis.status).toBe('error');
    expect(health.redis.latencyMs).toBeNull();
  });

  it('reports "degraded" when both fail', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('down')) } as unknown as PrismaService;
    mockConnect.mockRejectedValue(new Error('down'));
    const service = new AppService(prisma, configService);

    const health = await service.getHealth();

    expect(health.status).toBe('degraded');
  });

  it('always disconnects the health-check Redis client, even on failure', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as unknown as PrismaService;
    mockConnect.mockRejectedValue(new Error('timeout'));
    const service = new AppService(prisma, configService);

    await service.getHealth();

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('never throws, regardless of what fails -- the health endpoint must always return a body', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('down')) } as unknown as PrismaService;
    mockConnect.mockRejectedValue(new Error('down'));
    const service = new AppService(prisma, configService);

    await expect(service.getHealth()).resolves.toBeDefined();
  });
});
