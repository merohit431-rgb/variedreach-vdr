import { HttpStatus } from '@nestjs/common';
import { AppController } from './app.controller';
import type { AppService, HealthResult } from './app.service';

function buildController(health: HealthResult) {
  const getHealth = jest.fn().mockResolvedValue(health);
  const controller = new AppController({ getHealth } as unknown as AppService);
  const status = jest.fn();
  const res = { status } as unknown as Parameters<AppController['getHealth']>[0];
  return { controller, res, status };
}

const BASE: HealthResult = {
  status: 'ok',
  service: 'insolvency-vdr-backend',
  timestamp: new Date().toISOString(),
  uptimeSeconds: 10,
  version: '1.0.0',
  db: { status: 'ok', latencyMs: 1 },
  redis: { status: 'ok', latencyMs: 1 },
  memory: { heapUsedMb: 1, heapTotalMb: 2, rssMb: 3 },
};

// Phase 4 fix: this endpoint used to always resolve with HTTP 200, even for
// a "degraded" body -- every Docker healthcheck in this stack keys off HTTP
// status alone, so an outage was never detected at the container level.
describe('AppController.getHealth (Phase 4)', () => {
  it('returns HTTP 200 when status is "ok"', async () => {
    const { controller, res, status } = buildController({ ...BASE, status: 'ok' });
    const body = await controller.getHealth(res);
    expect(status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(body.status).toBe('ok');
  });

  it('returns HTTP 503 when status is "degraded" -- the actual fix', async () => {
    const { controller, res, status } = buildController({ ...BASE, status: 'degraded', db: { status: 'error', latencyMs: null } });
    const body = await controller.getHealth(res);
    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(body.status).toBe('degraded');
  });

  it('still returns the full diagnostic body even when degraded, not just a bare error', async () => {
    const { controller, res } = buildController({ ...BASE, status: 'degraded', redis: { status: 'error', latencyMs: null } });
    const body = await controller.getHealth(res);
    expect(body.redis.status).toBe('error');
    expect(body.db.status).toBe('ok');
    expect(body.memory).toBeDefined();
  });
});
