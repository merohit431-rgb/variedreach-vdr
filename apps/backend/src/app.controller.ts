import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AppService } from './app.service';
import { Public } from './modules/auth/decorators/public.decorator';

@SkipThrottle()
@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  async getHealth(@Res({ passthrough: true }) res: Response) {
    const health = await this.appService.getHealth();
    // Phase 4 fix: this endpoint previously always returned HTTP 200, even
    // when the body said "degraded" -- every Docker healthcheck in this
    // stack (dev/staging/prod, plus the backend Dockerfile's own
    // HEALTHCHECK) keys off HTTP status alone, so a Postgres or Redis
    // outage was never detected at the container-orchestration level. The
    // body itself is unchanged either way, so existing monitoring that
    // reads health.status/db/redis directly keeps working exactly as before.
    res.status(health.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return health;
  }
}
