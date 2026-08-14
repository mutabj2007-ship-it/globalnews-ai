import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { getCurrentRequestId } from './request-context';
import { logWithRequestId } from './log-with-request-id';

/**
 * Milestone #55 — catches EVERYTHING (@Catch() with no argument), but
 * branches immediately on exception type:
 *
 * - HttpException (ValidationPipe's 400s, ThrottlerException's 429s —
 *   confirmed a real HttpException subclass — HealthController's
 *   ServiceUnavailableException 503s, NotFoundException 404s, and
 *   anything else this app or NestJS itself deliberately throws) —
 *   the existing status code and response body are re-emitted EXACTLY
 *   as NestJS would have returned them unfiltered
 *   (exception.getStatus() / exception.getResponse()). This filter
 *   changes NOTHING about that existing client-facing contract; it
 *   only adds a correlated log line for operational visibility.
 * - Anything else — a genuinely unexpected error that escaped every
 *   existing try/catch in this codebase's already-mature error
 *   handling — is logged with full detail (safe: same
 *   `error instanceof Error` discipline used throughout this
 *   codebase's existing catch blocks) but the CLIENT only ever
 *   receives a generic, sanitized 500. Never exception.message, never
 *   a stack, never any credential/connection detail — the response
 *   body below is a fixed, hardcoded shape, not derived from the
 *   caught exception in any way.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = getCurrentRequestId();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      logWithRequestId(this.logger, 'warn', `HTTP ${status} response`, exception);
      response.status(status).json(exception.getResponse());
      return;
    }

    logWithRequestId(
      this.logger,
      'error',
      'Unhandled exception',
      exception instanceof Error ? exception : undefined,
    );

    response.status(500).json({
      status: 'error',
      message: 'An unexpected error occurred.',
      requestId,
    });
  }
}
