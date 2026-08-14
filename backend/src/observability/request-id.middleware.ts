import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { runWithRequestId } from './request-context';

/**
 * Milestone #55 (unmatched-route correlation fix) — runs as Express
 * middleware, BEFORE Nest's router attempts to match a route. This is
 * the only way to guarantee every request — including one that
 * matches no controller at all and produces a 404 straight from
 * GlobalExceptionFilter — gets a request ID and the X-Request-Id
 * header. LoggingInterceptor (a NestJS interceptor) only runs AFTER a
 * route has matched, so it cannot cover the unmatched case; this
 * middleware is what closes that gap.
 *
 * Generates exactly ONE server-side UUID per request
 * (crypto.randomUUID(), Node built-in) — per existing CTO instruction,
 * always generated server-side rather than trusting a client-supplied
 * X-Request-Id, since this application has no established
 * trusted-proxy convention. Sets the response header, then runs the
 * REST of the request (next()) inside runWithRequestId()'s
 * AsyncLocalStorage context, so everything downstream — whether
 * that's LoggingInterceptor + the matched controller, or
 * GlobalExceptionFilter alone for an unmatched route — sees the same
 * ID via getCurrentRequestId(). Logs nothing itself; HTTP access
 * logging remains LoggingInterceptor's job for matched routes.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = randomUUID();
    response.setHeader('X-Request-Id', requestId);

    runWithRequestId(requestId, () => {
      next();
    });
  }
}
