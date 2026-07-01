import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const id = (req.headers[REQUEST_ID_HEADER] as string | undefined) ?? randomUUID();
    (req as Request & { requestId: string }).requestId = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
  }
}
