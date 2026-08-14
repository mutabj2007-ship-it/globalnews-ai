import { AsyncLocalStorage } from 'async_hooks';

/**
 * Milestone #55 — the entire request-correlation mechanism. A single
 * AsyncLocalStorage store holding just the current request's ID (a
 * string, not a broader context object — the smallest shape M55
 * actually needs). Set once per request by LoggingInterceptor; read
 * anywhere downstream (providers, persistence, the exception filter)
 * via getCurrentRequestId() without threading the ID through every
 * existing method signature in the codebase — this is deliberately
 * the mechanism that keeps M55 from requiring a broad rewrite of
 * every service's call chain.
 */
const requestIdStorage = new AsyncLocalStorage<string>();

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return requestIdStorage.run(requestId, fn);
}

export function getCurrentRequestId(): string | undefined {
  return requestIdStorage.getStore();
}
