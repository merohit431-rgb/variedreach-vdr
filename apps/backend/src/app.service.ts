import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from './prisma/prisma.service';

export interface HealthResult {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  db: { status: 'ok' | 'error'; latencyMs: number | null };
  redis: { status: 'ok' | 'error'; latencyMs: number | null };
  memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number };
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // Phase 4 finding: this previously checked only Postgres, via a method
  // that could never signal failure to its caller (see getHealth's own
  // fix below) -- Docker's healthcheck, which keys off this endpoint's own
  // HTTP status, would never notice a database OR a Redis outage. A
  // dedicated, short-lived ioredis client is used here deliberately rather
  // than reusing DocumentAnalysisModule's own Queue connection -- a
  // foundational health check has no business depending on one specific
  // feature module's wiring, even though they'd happen to point at the
  // same Redis instance today.
  private async checkRedis(): Promise<{ status: 'ok' | 'error'; latencyMs: number | null }> {
    const redisUrl = this.configService.get<string>('queue.redisUrl');
    const client = new Redis(redisUrl!, {
      lazyConnect: true,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // never schedule a retry -- this client exists for one ping, not a persistent connection
    });

    try {
      const t0 = Date.now();
      await client.connect();
      await client.ping();
      return { status: 'ok', latencyMs: Date.now() - t0 };
    } catch (err) {
      this.logger.error('Redis health check failed', err);
      return { status: 'error', latencyMs: null };
    } finally {
      client.disconnect();
    }
  }

  async getHealth(): Promise<HealthResult> {
    const mem = process.memoryUsage();
    let dbStatus: 'ok' | 'error' = 'ok';
    let dbLatencyMs: number | null = null;

    try {
      const t0 = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - t0;
    } catch (err) {
      this.logger.error('DB health check failed', err);
      dbStatus = 'error';
    }

    const redis = await this.checkRedis();
    const overall: 'ok' | 'degraded' = dbStatus === 'error' || redis.status === 'error' ? 'degraded' : 'ok';

    return {
      status: overall,
      service: 'insolvency-vdr-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      version: process.env.npm_package_version ?? 'unknown',
      db: { status: dbStatus, latencyMs: dbLatencyMs },
      redis,
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
      },
    };
  }
}
