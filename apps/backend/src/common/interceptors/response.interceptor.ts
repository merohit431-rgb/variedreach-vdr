import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface RawResponse<T> {
  data: T;
  meta?: PaginationMeta;
  message?: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse();

    return next.handle().pipe(
      map((result: T) => {
        const isEnveloped =
          result && typeof result === 'object' && 'data' in (result as Record<string, unknown>);
        const { data, meta, message } = isEnveloped
          ? (result as unknown as RawResponse<T>)
          : { data: result, meta: undefined, message: undefined };

        return {
          success: true,
          statusCode: response.statusCode,
          message: message ?? 'Operation successful',
          data,
          ...(meta ? { meta } : {}),
        };
      }),
    );
  }
}
