import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
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

    const overall: 'ok' | 'degraded' = dbStatus === 'error' ? 'degraded' : 'ok';

    return {
      status: overall,
      service: 'insolvency-vdr-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      version: process.env.npm_package_version ?? 'unknown',
      db: { status: dbStatus, latencyMs: dbLatencyMs },
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
      },
    };
  }
}
