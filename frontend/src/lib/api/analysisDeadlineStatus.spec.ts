import { analyzeNews, AnalysisApiError } from './analysisApi';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * REV B FINDING 3 — A SERVER DEADLINE IS A TIMEOUT, NOT A SERVER FAULT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE CHAIN THIS PINS, END TO END:
 *
 *   AnalysisService.withResponseDeadline
 *     -> throws AnalysisDeadlineExceededError, which IS an HttpException(504)
 *     -> GlobalExceptionFilter's HttpException branch re-emits 504 unchanged
 *     -> analysisApi's codeForStatus(504)
 *     -> AnalysisApiError.code === 'timeout'
 *
 * In Rev A the second link was broken: the error extended plain `Error`, so the
 * filter's catch-all branch turned it into a sanitized 500, and `codeForStatus`
 * mapped `>= 500` to 'server'. The reader was told the backend had failed, when
 * the backend had enforced precisely the deadline it promised.
 *
 * ASSERTED THROUGH THE PUBLIC ENTRY POINT, NOT THROUGH THE MAPPER.
 * `codeForStatus` is module-private and stays that way — widening a module's
 * exports to make a branch reachable from a test changes the thing under test.
 * `analyzeNews` is what the UI calls, so `analyzeNews` is what is called here,
 * with `fetch` stubbed to produce the status the backend now returns.
 */

const originalFetch = global.fetch;

function respondWith(status: number): jest.Mock {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ status: 'error' }),
  } as unknown as Response);

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

/*
  A FRESH QUERY EVERY TIME, DELIBERATELY. `analyzeNews` coalesces concurrent
  identical questions through `inFlightAnalysisRequests`. That map is cleaned up
  on rejection as well as on success, so reuse would probably be safe — but
  "probably" is not what a regression suite should rest on, and a unique query
  removes the shared state from the test entirely.
*/
let questionCounter = 0;

async function codeFromStatus(status: number): Promise<AnalysisApiError> {
  respondWith(status);

  questionCounter += 1;
  const raised = await analyzeNews(`question ${questionCounter} for ${status}`).catch(
    (error: unknown) => error,
  );

  expect(raised).toBeInstanceOf(AnalysisApiError);
  return raised as AnalysisApiError;
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('REV B FINDING 3 — HTTP 504 is surfaced as a timeout', () => {
  it("a server deadline reaches the UI as code 'timeout', not 'server'", async () => {
    const error = await codeFromStatus(504);

    expect(error.code).toBe('timeout');
    expect(error.code).not.toBe('server');
  });

  it('the 504 is retained on the error so logs can still tell the two timeouts apart', async () => {
    /*
      NO NEW TAXONOMY MEMBER, BY INSTRUCTION. A local abort and a server
      deadline mean the same thing to the reader — it took too long — so they
      share one code. `status` is what still distinguishes them: undefined for
      the client's own abort, 504 for the server's deadline.
    */
    const error = await codeFromStatus(504);

    expect(error.status).toBe(504);
  });

  it('a genuine 5xx is still a server fault and is NOT folded into timeout', async () => {
    /*
      THE NEGATIVE CONTROL. The correction adds ONE status to the timeout
      branch; it must not swallow the general 5xx rule that existed before it.
    */
    expect((await codeFromStatus(500)).code).toBe('server');
    expect((await codeFromStatus(502)).code).toBe('server');
    expect((await codeFromStatus(503)).code).toBe('server');
  });

  it('every other mapped status is untouched by the new branch', async () => {
    expect((await codeFromStatus(429)).code).toBe('rate-limited');
    expect((await codeFromStatus(400)).code).toBe('invalid-query');
    expect((await codeFromStatus(422)).code).toBe('invalid-query');
    expect((await codeFromStatus(418)).code).toBe('unknown');
  });
});
