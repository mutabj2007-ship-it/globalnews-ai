import { Logger } from '@nestjs/common';
import { of, throwError, lastValueFrom } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';
import { getCurrentRequestId, runWithRequestId } from './request-context';

/**
 * Milestone #55 (unmatched-route correlation fix) — LoggingInterceptor
 * no longer generates the request ID or sets the X-Request-Id header;
 * both are now RequestIdMiddleware's job (see that file's own spec).
 * These tests reflect that: each one wraps the interceptor call in
 * runWithRequestId(...) first, exactly as RequestIdMiddleware would
 * have already done in the real pipeline, and asserts the interceptor
 * correctly READS that ID via getCurrentRequestId() into its own log
 * lines rather than generating a new one.
 */
describe('LoggingInterceptor (Milestone #55)', () => {
  function makeExecutionContext(overrides: { method?: string; originalUrl?: string } = {}) {
    const responseHeaders: Record<string, string> = {};
    let statusCode = 200;
    const response = {
      setHeader: (name: string, value: string) => {
        responseHeaders[name] = value;
      },
      get statusCode() {
        return statusCode;
      },
      set statusCode(value: number) {
        statusCode = value;
      },
    };
    const request = {
      method: overrides.method ?? 'GET',
      originalUrl: overrides.originalUrl ?? '/health',
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };

    return { context: context as never, responseHeaders, request, response };
  }

  it('does not set X-Request-Id itself \u2014 that is RequestIdMiddleware\u2019s job now', async () => {
    const interceptor = new LoggingInterceptor();
    const { context, responseHeaders } = makeExecutionContext();
    const next = { handle: () => of('result') };

    await runWithRequestId('req-already-established', () =>
      lastValueFrom(interceptor.intercept(context, next as never)),
    );

    expect(responseHeaders['X-Request-Id']).toBeUndefined();
  });

  it('reads the request ID already established in context (by RequestIdMiddleware in the real pipeline) into its start/completion log lines', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const interceptor = new LoggingInterceptor();
    const { context } = makeExecutionContext();
    const next = { handle: () => of('result') };

    await runWithRequestId('req-consumed-1234', () =>
      lastValueFrom(interceptor.intercept(context, next as never)),
    );

    const loggedMessages = logSpy.mock.calls.map((call) => String(call[0]));
    expect(loggedMessages.length).toBe(2);
    expect(loggedMessages.every((message) => message.startsWith('[req-consumed-1234] '))).toBe(
      true,
    );

    logSpy.mockRestore();
  });

  it('logs plainly (no ID prefix, never throws) when no request context is active \u2014 defensive behavior, not the expected real-pipeline case', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const interceptor = new LoggingInterceptor();
    const { context } = makeExecutionContext();
    const next = { handle: () => of('result') };

    await lastValueFrom(interceptor.intercept(context, next as never));

    const loggedMessages = logSpy.mock.calls.map((call) => String(call[0]));
    expect(loggedMessages.every((message) => !message.startsWith('['))).toBe(true);

    logSpy.mockRestore();
  });

  it('the request ID remains available via getCurrentRequestId() while the downstream handler runs \u2014 the mechanism a provider/persistence call site relies on', async () => {
    const interceptor = new LoggingInterceptor();
    const { context } = makeExecutionContext();
    let observedDuringHandler: string | undefined;
    const next = {
      handle: () => {
        observedDuringHandler = getCurrentRequestId();
        return of('result');
      },
    };

    await runWithRequestId('req-downstream-check', () =>
      lastValueFrom(interceptor.intercept(context, next as never)),
    );

    expect(observedDuringHandler).toBe('req-downstream-check');
  });

  it('re-throws the original error on failure \u2014 GlobalExceptionFilter, not this interceptor, owns the client-facing error response', async () => {
    const interceptor = new LoggingInterceptor();
    const { context } = makeExecutionContext();
    const originalError = new Error('downstream failure');
    const next = { handle: () => throwError(() => originalError) };

    await expect(
      runWithRequestId('req-error-path', () =>
        lastValueFrom(interceptor.intercept(context, next as never)),
      ),
    ).rejects.toBe(originalError);
  });

  /**
   * Milestone #55 correction — request.originalUrl (Express) can
   * contain the complete query string. This is the exact CTO-reported
   * scenario: a request to '/search?q=PRIVATE_QUESTION&token=PRIVATE_VALUE'
   * must never place either value, or the '?' separator itself, into
   * the emitted access-log path.
   */
  it('never logs query-string values \u2014 the exact reported case: /search?q=PRIVATE_QUESTION&token=PRIVATE_VALUE', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const interceptor = new LoggingInterceptor();
    const { context } = makeExecutionContext({
      method: 'GET',
      originalUrl: '/search?q=PRIVATE_QUESTION&token=PRIVATE_VALUE',
    });
    const next = { handle: () => of('result') };

    await runWithRequestId('req-query-check', () =>
      lastValueFrom(interceptor.intercept(context, next as never)),
    );

    const loggedMessages = logSpy.mock.calls.map((call) => String(call[0]));
    for (const message of loggedMessages) {
      expect(message).not.toContain('PRIVATE_QUESTION');
      expect(message).not.toContain('PRIVATE_VALUE');
      expect(message).not.toContain('?');
      expect(message).not.toContain('q=');
      expect(message).not.toContain('token=');
    }
    expect(loggedMessages.some((message) => message.includes('path=/search'))).toBe(true);

    logSpy.mockRestore();
  });
});
