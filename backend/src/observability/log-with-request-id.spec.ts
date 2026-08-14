import { Logger } from '@nestjs/common';
import { logWithRequestId } from './log-with-request-id';
import { runWithRequestId } from './request-context';

/**
 * Milestone #55 — proves logWithRequestId actually emits the current
 * request ID into the message it hands to the underlying logger (not
 * merely that the ID is "available" somewhere), that it leaves the
 * message completely unchanged when no request context is active, and
 * (Milestone #55 correction) that an Error passed as the trailing
 * argument is NEVER forwarded to the logger as a raw object — only a
 * sanitized string extracted from its message, with representative
 * secret-bearing patterns redacted and the stack trace never included
 * at all.
 */
describe('logWithRequestId (Milestone #55)', () => {
  interface LoggedCall {
    level: string;
    args: unknown[];
  }

  /**
   * Milestone #55 test-typing correction — instantiates a REAL
   * NestJS `Logger` and spies on its four methods with Jest, rather
   * than casting a hand-built plain object to `Logger` (which
   * TypeScript correctly rejects with TS2352: a four-method object
   * does not structurally implement the full Logger class). This
   * keeps logWithRequestId's production `logger: Logger` parameter
   * type completely untouched — the test now satisfies that real
   * type by using a real instance of it, not by weakening it.
   * `calls` is returned separately with its own proper type, so
   * every assertion below reads it directly with no cast at all.
   */
  function makeFakeLogger(): { logger: Logger; calls: LoggedCall[] } {
    const calls: LoggedCall[] = [];
    const logger = new Logger('logWithRequestId.spec');

    jest.spyOn(logger, 'log').mockImplementation((...args: unknown[]) => {
      calls.push({ level: 'log', args });
    });
    jest.spyOn(logger, 'warn').mockImplementation((...args: unknown[]) => {
      calls.push({ level: 'warn', args });
    });
    jest.spyOn(logger, 'error').mockImplementation((...args: unknown[]) => {
      calls.push({ level: 'error', args });
    });
    jest.spyOn(logger, 'debug').mockImplementation((...args: unknown[]) => {
      calls.push({ level: 'debug', args });
    });

    return { logger, calls };
  }

  it('prefixes the message with the active request ID', () => {
    const { logger, calls } = makeFakeLogger();

    runWithRequestId('req-1234', () => {
      logWithRequestId(logger, 'warn', 'Provider "gnews" failed to respond');
    });

    expect(calls[0].args[0]).toBe('[req-1234] Provider "gnews" failed to respond');
  });

  it('leaves the message completely unchanged when no request context is active', () => {
    const { logger, calls } = makeFakeLogger();

    logWithRequestId(logger, 'log', 'application startup message');

    expect(calls[0].args[0]).toBe('application startup message');
  });

  it('routes to the correct log level method on the underlying logger', () => {
    const { logger, calls } = makeFakeLogger();

    runWithRequestId('req-level-check', () => {
      logWithRequestId(logger, 'error', 'Unhandled exception');
    });

    expect(calls[0].level).toBe('error');
  });

  it('calls the logger with exactly one string argument \u2014 never a raw Error object', () => {
    const { logger, calls } = makeFakeLogger();
    const error = new Error('Failed to reach OpenAI.');

    runWithRequestId('req-single-arg', () => {
      logWithRequestId(logger, 'warn', 'OpenAI call failed', error);
    });

    const call = calls[0];
    expect(call.args).toHaveLength(1);
    expect(typeof call.args[0]).toBe('string');
  });

  describe('Milestone #55 correction \u2014 secret redaction', () => {
    it('never emits the stack trace, even when one is present', () => {
      const { logger, calls } = makeFakeLogger();
      const error = new Error('generic failure');
      error.stack =
        'Error: generic failure\n    at /app/backend/dist/database/prisma.service.js:42:10\n    at postgresql://user:LEAKED_IN_STACK@host/db';

      logWithRequestId(logger, 'error', 'Unhandled exception', error);

      const message = calls[0].args[0];
      expect(message).not.toContain('prisma.service.js');
      expect(message).not.toContain('LEAKED_IN_STACK');
    });

    it('redacts a database connection string\u2019s embedded username:password while preserving the host for diagnosis', () => {
      const { logger, calls } = makeFakeLogger();
      const error = new Error(
        "Can't reach database server at postgresql://globalnews_ai_user:SUPER_SECRET_PASSWORD@prod-db-host:5432/globalnews_ai",
      );

      logWithRequestId(logger, 'warn', 'Failed to persist article', error);

      const message = calls[0].args[0];
      expect(message).not.toContain('SUPER_SECRET_PASSWORD');
      expect(message).toContain('prod-db-host');
    });

    it('redacts a "token=..." value embedded in an error message', () => {
      const { logger, calls } = makeFakeLogger();
      const error = new Error('Connection failed for token=sk-proj-REALKEY1234567890');

      logWithRequestId(logger, 'warn', 'Provider failed', error);

      expect(calls[0].args[0]).not.toContain('sk-proj-REALKEY1234567890');
    });

    it('redacts a bare OpenAI-style "sk-..." key appearing anywhere in the message', () => {
      const { logger, calls } = makeFakeLogger();
      const error = new Error('OpenAI key sk-abcdefghij1234567890 was rejected');

      logWithRequestId(logger, 'warn', 'Provider failed', error);

      expect(calls[0].args[0]).not.toContain('sk-abcdefghij1234567890');
    });

    it('redacts an "Authorization: Bearer ..." token value', () => {
      const { logger, calls } = makeFakeLogger();
      const error = new Error(
        'Request failed with header Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.secretpayload',
      );

      logWithRequestId(logger, 'warn', 'Provider failed', error);

      expect(calls[0].args[0]).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    });

    it('redacts session/cookie values', () => {
      const { logger, calls } = makeFakeLogger();
      const error = new Error('Request failed, cookie: session=abc123; auth-token=xyz789');

      logWithRequestId(logger, 'warn', 'Request failed', error);

      const message = calls[0].args[0];
      expect(message).not.toContain('abc123');
      expect(message).not.toContain('xyz789');
    });

    it('leaves an ordinary, already-safe error message completely unchanged \u2014 no over-redaction of non-secret content', () => {
      const { logger, calls } = makeFakeLogger();
      const error = new Error('Failed to reach OpenAI.');

      logWithRequestId(logger, 'warn', 'Provider failed', error);

      expect(calls[0].args[0]).toBe('Provider failed (Failed to reach OpenAI.)');
    });
  });
});
