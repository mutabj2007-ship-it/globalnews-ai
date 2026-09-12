import { getCurrentRequestId, runWithRequestId } from './request-context';

/**
 * Milestone #55 — proves the actual AsyncLocalStorage correlation
 * mechanism, including propagation across real async boundaries
 * (setTimeout/await) and non-contamination between concurrent
 * requests, not merely that the functions exist.
 */
describe('request-context (Milestone #55 correlation foundation)', () => {
  it('returns undefined outside any request context', () => {
    expect(getCurrentRequestId()).toBeUndefined();
  });

  it('makes the request ID available synchronously inside the run() callback', () => {
    runWithRequestId('req-sync-1', () => {
      expect(getCurrentRequestId()).toBe('req-sync-1');
    });
  });

  it('propagates the request ID across a real async boundary (await/setTimeout), not just synchronous code', async () => {
    let observed: string | undefined;

    await runWithRequestId('req-async-1', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      observed = getCurrentRequestId();
    });

    expect(observed).toBe('req-async-1');
  });

  it('two concurrent request contexts never cross-contaminate each other\u2019s ID', async () => {
    const results: Record<string, string | undefined> = {};

    async function simulateRequest(id: string, delayMs: number): Promise<void> {
      await runWithRequestId(id, async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        results[id] = getCurrentRequestId();
      });
    }

    await Promise.all([
      simulateRequest('req-concurrent-A', 10),
      simulateRequest('req-concurrent-B', 3),
    ]);

    expect(results['req-concurrent-A']).toBe('req-concurrent-A');
    expect(results['req-concurrent-B']).toBe('req-concurrent-B');
  });

  it('the context reverts to undefined once run() completes', async () => {
    await runWithRequestId('req-scoped', async () => {
      expect(getCurrentRequestId()).toBe('req-scoped');
    });

    expect(getCurrentRequestId()).toBeUndefined();
  });
});
