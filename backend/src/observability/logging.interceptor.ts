import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap, catchError } from 'rxjs';
import type { Request, Response } from 'express';
import { getCurrentRequestId } from './request-context';

/**
 * Milestone #55 — HTTP access-timing logging for matched routes.
 *
 * Milestone #55 (unmatched-route correlation fix) — this interceptor
 * no longer generates the request ID or sets the X-Request-Id header.
 * Both are now established earlier, by RequestIdMiddleware, which
 * runs before Nest's router and therefore also covers requests that
 * match no route at all — a case this interceptor is never even
 * invoked for (NestJS interceptors only run after routing succeeds;
 * see request-id.middleware.ts's own doc comment for the full
 * reasoning and the real Docker evidence that first revealed this).
 * This interceptor now only READS the already-established ID via
 * getCurrentRequestId() and logs exactly two lines per matched
 * request — start and completion — with method, path, status, and
 * duration. Deliberately never logs the request body, query string
 * values, or any header (including Authorization/cookies) — only
 * these four fixed, safe fields.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const requestId = getCurrentRequestId();
    const idPrefix = requestId ? `[${requestId}] ` : '';

    const method = request.method;
    // Milestone #55 correction — request.originalUrl (Express) can
    // contain the complete query string (e.g. '/search?q=...&token=...').
    // Splitting on the first '?' and keeping only the portion before it
    // gives the pathname alone; query values — which may carry raw user
    // question text or other sensitive data — are never constructed
    // into the log line at all, not merely omitted after the fact.
    const rawPath = request.originalUrl ?? request.url;
    const path = rawPath.split('?')[0];
    const startedAt = Date.now();

    this.logger.log(`${idPrefix}HTTP request start method=${method} path=${path}`);

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startedAt;
        this.logger.log(
          `${idPrefix}HTTP request completed method=${method} path=${path} status=${response.statusCode} durationMs=${durationMs}`,
        );
      }),
      catchError((error: unknown) => {
        const durationMs = Date.now() - startedAt;
        // GlobalExceptionFilter is responsible for the actual client
        // response and its own detailed error log; this line only
        // records that this specific request ended in an error and
        // how long it took, kept at 'log' level (not 'error') to
        // avoid double-reporting the same failure twice at error
        // severity.
        this.logger.log(
          `${idPrefix}HTTP request completed method=${method} path=${path} status=error durationMs=${durationMs}`,
        );
        throw error;
      }),
    );
  }
}
