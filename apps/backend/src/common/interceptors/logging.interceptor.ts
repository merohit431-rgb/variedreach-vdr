import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { requestId?: string; user?: { id?: string; organisationId?: string }; ip?: string }>();
    const start = Date.now();
    const { method, originalUrl } = req as unknown as { method: string; originalUrl: string };

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<{ statusCode: number }>();
          this.logger.log(
            JSON.stringify({
              requestId: req.requestId,
              userId: req.user?.id,
              orgId: req.user?.organisationId,
              method,
              path: originalUrl,
              statusCode: res.statusCode,
              durationMs: Date.now() - start,
              ip: req.ip,
            }),
          );
        },
        error: (err: { status?: number; message?: string }) => {
          this.logger.error(
            JSON.stringify({
              requestId: req.requestId,
              userId: req.user?.id,
              orgId: req.user?.organisationId,
              method,
              path: originalUrl,
              statusCode: err.status ?? 500,
              durationMs: Date.now() - start,
              ip: req.ip,
              error: err.message,
            }),
          );
        },
      }),
    );
  }
}
