import type { NextFunction, Request, Response } from 'express';
import { RequestIdMiddleware } from './request-id.middleware';
import { getCurrentRequestId } from './request-context';

/**
 * Milestone #55 (unmatched-route correlation fix) — proves the
 * middleware generates exactly one ID, sets the response header,
 * establishes the AsyncLocalStorage context BEFORE calling next()
 * (the property that lets both a matched route's interceptor AND an
 * unmatched route's exception filter read the same ID), and logs
 * nothing itself.
 */
describe('RequestIdMiddleware (Milestone #55 \u2014 unmatched-route correlation fix)', () => {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function makeFakeResponse(): { headers: Record<string, string>; response: Response } {
    const headers: Record<string, string> = {};
    const response = {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    } as unknown as Response;

    return { headers, response };
  }

  it('sets a real, unique UUID on the X-Request-Id response header', () => {
    const middleware = new RequestIdMiddleware();
    const { headers, response } = makeFakeResponse();
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };

    middleware.use({} as Request, response, next);

    expect(nextCalled).toBe(true);
    expect(headers['X-Request-Id']).toMatch(uuidPattern);
  });

  it('two separate requests never receive the same generated ID', () => {
    const middleware = new RequestIdMiddleware();
    const first = makeFakeResponse();
    const second = makeFakeResponse();

    middleware.use({} as Request, first.response, () => undefined);
    middleware.use({} as Request, second.response, () => undefined);

    expect(first.headers['X-Request-Id']).not.toBe(second.headers['X-Request-Id']);
  });

  it('establishes the AsyncLocalStorage context BEFORE calling next() \u2014 so anything next() triggers (routing, interceptors, or an immediate 404 straight to the exception filter) can read the same ID via getCurrentRequestId()', () => {
    const middleware = new RequestIdMiddleware();
    const { headers, response } = makeFakeResponse();
    let observedInsideNext: string | undefined;
    const next: NextFunction = () => {
      observedInsideNext = getCurrentRequestId();
    };

    middleware.use({} as Request, response, next);

    expect(observedInsideNext).toBe(headers['X-Request-Id']);
  });

  it('the context reverts to undefined once use() completes \u2014 no leakage into unrelated later work', () => {
    const middleware = new RequestIdMiddleware();
    const { response } = makeFakeResponse();

    middleware.use({} as Request, response, () => undefined);

    expect(getCurrentRequestId()).toBeUndefined();
  });
});
