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
 * - A body-parser PayloadTooLargeError (S1.1) — see isPayloadTooLarge()
 *   below — becomes a real 413 with a sanitized body and a WARN-level
 *   log line.
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

/**
 * S1.1 — the sanitized 413 body. A fixed, hardcoded shape, exactly like the
 * 500 below it: nothing here is derived from the caught exception, so the
 * parser's own wording, the configured limit, the received length and the
 * request body itself are all structurally unable to reach the client.
 */
const PAYLOAD_TOO_LARGE_MESSAGE = 'Request payload is too large.';

/**
 * S1.1 — recognises the error body-parser throws when a request exceeds the
 * limit set in main.ts.
 *
 * WHY THIS BRANCH EXISTS. body-parser throws an `http-errors` error, which is
 * NOT a Nest HttpException, so before S1.1 it fell through to the generic
 * branch below: the client received "An unexpected error occurred." with a 500,
 * and the server logged it at ERROR level as an unhandled exception. Both were
 * wrong. A client that sent too much data could not tell its own mistake from a
 * server fault, and — because the endpoint is public and the trigger is
 * trivial — anyone could generate unlimited ERROR-level log entries, which is
 * how a real failure gets buried.
 *
 * DETECTED BY STATUS, NEVER BY MESSAGE TEXT. `type === 'entity.too.large'` is
 * body-parser's own stable marker; `status`/`statusCode` of 413 is the
 * `http-errors` convention any equivalent middleware follows. Matching on the
 * message string would break the first time a dependency reworded it.
 *
 * DELIBERATELY NARROW. Only 413 is normalised here. Widening this to "any
 * error carrying a numeric status" would silently change the response for
 * error shapes nobody has reviewed, which is a larger behavioural change than
 * this repair is for.
 *
 * Ordered AFTER the HttpException branch, so a deliberately thrown Nest
 * PayloadTooLargeException keeps its own response body exactly as it does
 * today rather than being rewritten by this one.
 */
function isPayloadTooLarge(exception: unknown): boolean {
  if (typeof exception !== 'object' || exception === null) {
    return false;
  }

  const candidate = exception as {
    type?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };

  return (
    candidate.type === 'entity.too.large' ||
    candidate.status === 413 ||
    candidate.statusCode === 413
  );
}
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

    if (isPayloadTooLarge(exception)) {
      // WARN, not ERROR: an oversized request is a CLIENT mistake, and this
      // one is trivially triggerable by anyone. Logging it at error level
      // would let a caller flood the error stream and bury a genuine failure.
      //
      // No error argument is passed, so nothing from the parser reaches the
      // log line at all — not the wording, not the limit, not the received
      // length. logWithRequestId would already have stripped the stack and
      // redacted credentials, but the cheapest way to disclose nothing is to
      // hand it nothing.
      logWithRequestId(this.logger, 'warn', 'HTTP 413 response (request body exceeded the limit)');

      response.status(413).json({
        status: 'error',
        message: PAYLOAD_TOO_LARGE_MESSAGE,
        requestId,
      });

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
