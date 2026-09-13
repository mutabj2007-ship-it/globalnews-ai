import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { AnalysisApiError } from '@/lib/api/analysisApi';
import { resolveAnalysisErrorMessage } from '../search/SearchPageClient';
import { frameHrefFor, resolveFrameView, runAnalysisRequest } from './frameRequest';
import { fixture } from './frameFixtures';

// `useSearchParams()` needs a Next router context, which a bare
// renderToStaticMarkup has none of. The mock supplies the ONLY thing the
// component reads from it — the URL's own parameters.
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

/*
  THE TEN MANDATORY REGRESSION TESTS (CTO, PAF-R1.1).

  This repository's jest is `testEnvironment: 'node'` with no jsdom and no
  test renderer, so an effect cannot be driven by mounting a component.
  `staleResponseProtection.spec.ts` established the answer already used
  here: execute the behaviour directly. R1.1 extracts that behaviour into
  `frameRequest.ts`, which the component itself calls — so these tests run
  the SHIPPED decision code, not a restatement of it.
*/

const dictionary = getDictionary('en');
const source = readFileSync(`${__dirname}/AnalysisFrameClient.tsx`, 'utf8');

interface Recorder {
  calls: Array<[string, string]>;
  loading: boolean[];
  results: Array<AnalysisApiResponse | null>;
  errors: string[];
  resets: number;
}

function ports(
  analyze: (q: string, l: string) => Promise<AnalysisApiResponse>,
  isCancelled: () => boolean = () => false,
): { rec: Recorder; p: Parameters<typeof runAnalysisRequest>[1] } {
  const rec: Recorder = { calls: [], loading: [], results: [], errors: [], resets: 0 };
  return {
    rec,
    p: {
      analyze: ((q: string, l: string) => {
        rec.calls.push([q, l]);
        return analyze(q, l);
      }) as never,
      resolveErrorMessage: resolveAnalysisErrorMessage,
      onLoading: (v: boolean) => rec.loading.push(v),
      onResult: (r: AnalysisApiResponse) => rec.results.push(r),
      onError: (m: string) => rec.errors.push(m),
      onReset: () => { rec.resets += 1; },
      isCancelled,
    },
  };
}

const ok = async () => fixture();

/* 1 — no q -> no spinner */
describe('1. no question renders no spinner', () => {
  it('the view decision for an absent question is never `loading`', () => {
    for (const isLoading of [true, false]) {
      for (const response of [null, fixture()]) {
        for (const fetchError of [null, 'boom']) {
          expect(resolveFrameView({ hasQuery: false, isLoading, response, fetchError }))
            .toBe('no-question');
        }
      }
    }
  });

  it('the rendered no-question state contains no LoadingStages copy', () => {
    const html = renderToStaticMarkup(
      createElement(require('./AnalysisFrameClient').AnalysisFrameClient as never, {} as never),
    );
    expect(html).toContain('data-paf="no-question"');
    for (const stage of dictionary.loadingStages) expect(html).not.toContain(stage);
  });

  it('its call to action routes to the EXISTING question-entry surface and does not analyse', () => {
    const html = renderToStaticMarkup(
      createElement(require('./AnalysisFrameClient').AnalysisFrameClient as never, {} as never),
    );
    expect(html).toMatch(/data-paf="ask-a-question"/);
    expect(html).toMatch(/href="\/search"/);
    expect(html).not.toMatch(/href="\/analysis/);
  });
});

/* 2 — no q -> zero analyzeNews calls */
describe('2. no question issues zero analyze calls', () => {
  it.each(['', '   ', '\t\n'])('query %j triggers no request', async (query) => {
    const { rec, p } = ports(ok);
    await runAnalysisRequest({ query, language: 'en', dictionary }, p);
    expect(rec.calls).toEqual([]);
    expect(rec.loading).toEqual([false]);
    expect(rec.resets).toBe(1);
  });
});

/* 3 — q -> exactly one analyzeNews call */
describe('3. a question issues exactly one analyze call', () => {
  it('calls once, with the verbatim query and the active language', async () => {
    const { rec, p } = ports(ok);
    await runAnalysisRequest({ query: 'What is happening in Kigali, Rwanda?', language: 'pl', dictionary }, p);
    expect(rec.calls).toHaveLength(1);
    expect(rec.calls[0]).toEqual(['What is happening in Kigali, Rwanda?', 'pl']);
  });

  it('a rejected request still costs exactly one call — no retry loop', async () => {
    const { rec, p } = ports(async () => { throw new AnalysisApiError('x', 500, 'server'); });
    await runAnalysisRequest({ query: 'q', language: 'en', dictionary }, p);
    expect(rec.calls).toHaveLength(1);
  });
});

/* 4 — pending -> loading */
describe('4. a pending request renders the loading state', () => {
  it('loading is raised before the request settles and lowered after', async () => {
    let release: (r: AnalysisApiResponse) => void = () => {};
    const pending = new Promise<AnalysisApiResponse>((resolve) => { release = resolve; });
    const { rec, p } = ports(() => pending);

    const run = runAnalysisRequest({ query: 'q', language: 'en', dictionary }, p);
    expect(rec.loading).toEqual([true]);                       // still pending
    expect(resolveFrameView({ hasQuery: true, isLoading: true, response: null, fetchError: null }))
      .toBe('loading');

    release(fixture());
    await run;
    expect(rec.loading).toEqual([true, false]);
  });

  it('the component initialises isLoading from hasQuery, so mount-with-query is never a failure flash', () => {
    expect(source).toMatch(/useState\(hasQuery\)/);
  });
});

/* 5 — resolve -> PAF frame */
describe('5. a resolved request renders the frame', () => {
  it('the result is handed on unmodified and the view becomes `frame`', async () => {
    const response = fixture();
    const { rec, p } = ports(async () => response);
    await runAnalysisRequest({ query: 'q', language: 'en', dictionary }, p);
    expect(rec.results).toEqual([response]);
    expect(rec.errors).toEqual([]);
    expect(resolveFrameView({ hasQuery: true, isLoading: false, response, fetchError: null })).toBe('frame');
  });
});

/* 6 — reject -> truthful terminal error state */
describe('6. a rejected request renders a truthful terminal state', () => {
  it('maps the error through the SAME localized taxonomy the existing client uses', async () => {
    const { rec, p } = ports(async () => { throw new AnalysisApiError('x', 429, 'rate-limited'); });
    await runAnalysisRequest({ query: 'q', language: 'en', dictionary }, p);
    expect(rec.errors).toEqual([dictionary.analysisErrorRateLimited]);
    expect(rec.results).toEqual([]);
  });

  it('the failure branch NEVER claims that retrieval succeeded', () => {
    expect(source).toContain('data-paf="request-failed"');
    expect(source).toContain('requestFailedTitle');
    // The R1 defect: the failure branch rendered the "retrieval
    // succeeded" sentence, which is the centre's copy for a DIFFERENT
    // condition — the AI failing after retrieval worked.
    const failureBranch = source.slice(source.indexOf('data-paf="request-failed"'), source.indexOf("destination === 'record'"));
    expect(failureBranch).not.toMatch(/analysisUnavailableRetrievalSucceeded/);
    for (const language of ['en', 'pl'] as const) {
      const t = getDictionary(language).analysisFrame;
      expect(t.requestFailedTitle).not.toBe(t.analysisUnavailableRetrievalSucceeded);
    }
  });

  it('a settled request with neither result nor error still terminates, never spins', () => {
    expect(resolveFrameView({ hasQuery: true, isLoading: false, response: null, fetchError: null })).toBe('failed');
  });
});

/* 7 — Polish loading -> Polish stage copy */
describe('7. loading stages use the active dictionary', () => {
  it('the component passes the dictionary stages rather than the component defaults', () => {
    expect(source).toMatch(/<LoadingStages stages=\{\[\.\.\.dictionary\.loadingStages\]\} \/>/);
    expect(source).not.toMatch(/<LoadingStages \/>/);
  });

  it('EN and PL stage copy differ, so a Polish reader cannot be shown English', () => {
    const en = getDictionary('en').loadingStages;
    const pl = getDictionary('pl').loadingStages;
    expect(pl).toHaveLength(en.length);
    for (let i = 0; i < en.length; i += 1) expect(pl[i]).not.toBe(en[i]);
  });
});

/* 8 — stale first request cannot overwrite a newer query */
describe('8. the stale-response guard', () => {
  it('a slower FIRST request never overwrites a newer query, in either direction', async () => {
    let releaseSlow: (r: AnalysisApiResponse) => void = () => {};
    const slow = new Promise<AnalysisApiResponse>((resolve) => { releaseSlow = resolve; });

    let cancelled = false;
    const { rec: slowRec, p: slowPorts } = ports(() => slow, () => cancelled);
    const slowRun = runAnalysisRequest({ query: 'first', language: 'en', dictionary }, slowPorts);

    cancelled = true;                                   // the effect's cleanup, on re-query
    const fresh = fixture();
    const { rec: fastRec, p: fastPorts } = ports(async () => fresh);
    await runAnalysisRequest({ query: 'second', language: 'en', dictionary }, fastPorts);

    releaseSlow(fixture());
    await slowRun;

    expect(slowRec.results).toEqual([]);                // dropped
    expect(slowRec.errors).toEqual([]);
    expect(slowRec.loading).toEqual([true]);            // never lowered after cancellation
    expect(fastRec.results).toEqual([fresh]);           // survives
  });

  it('a slow FAILURE also cannot overwrite a newer query', async () => {
    let rejectSlow: (e: unknown) => void = () => {};
    const slow = new Promise<AnalysisApiResponse>((_, reject) => { rejectSlow = reject; });
    let cancelled = false;
    const { rec, p } = ports(() => slow, () => cancelled);
    const run = runAnalysisRequest({ query: 'first', language: 'en', dictionary }, p);
    cancelled = true;
    rejectSlow(new AnalysisApiError('x', 500, 'server'));
    await run;
    expect(rec.errors).toEqual([]);
  });

  it('the component still implements the guard shape the existing client is pinned to', () => {
    expect(source).toMatch(/let cancelled = false;/);
    expect(source).toMatch(/isCancelled: \(\) => cancelled/);
    expect(source).toMatch(/return \(\) => \{\s*\n\s*cancelled = true;\s*\n\s*\};/);
  });
});

/* 9 — no loading state may exist without a pending request */
describe('9. no loading state without a pending request', () => {
  it('EXHAUSTIVE: across every reachable state, `loading` implies hasQuery', () => {
    const offenders: string[] = [];
    for (const hasQuery of [true, false]) {
      for (const isLoading of [true, false]) {
        for (const response of [null, fixture()]) {
          for (const fetchError of [null, 'boom']) {
            const view = resolveFrameView({ hasQuery, isLoading, response, fetchError });
            if (view === 'loading' && !(hasQuery && isLoading)) {
              offenders.push(JSON.stringify({ hasQuery, isLoading, hasResponse: response !== null, fetchError }));
            }
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('and `loading` is the ONLY view that may render a spinner', () => {
    const spinnerBranch = source.slice(source.indexOf("view === 'loading'"), source.indexOf("view === 'failed'"));
    expect(spinnerBranch).toContain('LoadingStages');
    const everythingElse = source.replace(spinnerBranch, '');
    expect(everythingElse).not.toContain('<LoadingStages');
  });

  it('the R1 defect condition is gone from the source', () => {
    expect(source).not.toMatch(/isLoading \|\| \(response === null && fetchError === null\)/);
    expect(source).not.toMatch(/if \(query\.trim\(\)\.length === 0\) return;/);
  });
});

/* 10 — the transition preserves the exact query */
describe('10. the /search -> /analysis transition preserves the query verbatim', () => {
  const searchClient = readFileSync(`${__dirname}/../search/SearchPageClient.tsx`, 'utf8');

  it.each([
    'What is happening in Kigali, Rwanda?',
    'Co się dzieje w Polsce?',
    'a & b = c',
    'quotes "inside" it',
  ])('round-trips %j through the URL unchanged', (query) => {
    const href = frameHrefFor(query);
    const roundTripped = new URLSearchParams(href.slice(href.indexOf('?') + 1)).get('q');
    expect(roundTripped).toBe(query);
  });

  /*
     R2a — RETARGETED, NOT WEAKENED. CTO ruling, R2a authorization.

     THE OLD ASSERTIONS. Two tests here asserted that
     `SearchPageClient.tsx` emits `href={`/analysis?q=${encodeURIComponent(query)}`}`
     carrying `data-paf="open-in-frame"`, and that the element is inert.
     They were correct for PAF-R1.1, whose whole purpose was to make the
     frame discoverable from `/search`.

     WHY THE APPROVED BEHAVIOUR INVALIDATES THEM. The CTO has ruled that
     `/search` and its rich Analysis Workspace are the canonical product
     surface, and that "the reduced `/analysis` frame must no longer be
     promoted as the canonical destination". The frame reaches none of
     the brief's answer cells, the context row, watch-next, the telemetry
     strip or the sub-view strip, so agreements, differences, timeline
     and spillover are unreachable from it. A test demanding that the
     canonical surface advertise the reduced one now pins a behaviour the
     product has deliberately reversed. Leaving it would make the suite
     enforce the regression.

     THE REPLACEMENT IS STRICTLY STRONGER. It asserted a link existed;
     this asserts NO promotion path exists at all — by href, by hook, and
     by the absence of the import that made it possible. That is a
     harder guarantee to satisfy accidentally.

     WHAT IS DELIBERATELY KEPT. The URL round-trip tests above and the
     frame's own `searchParams.get('q')` read below are UNTOUCHED. The
     frame is demoted, not deleted, so if anything ever links to it again
     the query contract it depends on is still proven here.
  */
  it('R2a: /search does NOT promote the reduced frame — no href, no hook', () => {
    expect(searchClient).not.toMatch(/\/analysis\?q=/);
    expect(searchClient).not.toMatch(/data-paf="open-in-frame"/);
    expect(searchClient).not.toMatch(/<Link/);
  });

  it('R2a: the import that made the promotion possible is gone too', () => {
    // A dangling `next/link` import is how a removed link quietly returns.
    expect(searchClient).not.toMatch(/from 'next\/link'/);
  });

  /*
   * ── RETARGETED IN R4 ─────────────────────────────────────────────────
   *
   * OLD ASSERTION: `/search` must still render `<AnalysisWorkspace`.
   *
   * WHY IT NO LONGER HOLDS: the assertion is a PROXY. What R2a protected
   * is stated in its own comment — "readers STAY here", i.e. the demotion
   * must remove the detour to the reduced frame, not the destination the
   * reader was on. In R2a the destination happened to be
   * `AnalysisWorkspace`, so naming the component was a fair shorthand.
   *
   * R4 §2 rejects that component's presentation and §3 replaces it with
   * the bounded persistent frame, which is now a FULLER destination than
   * the one R2a was defending, not a thinner one: `r4DataPreservation`
   * proves, on rendered markup, that every field named by §4 survives.
   * Keeping the old assertion would pin the shorthand and forbid the
   * thing it was shorthand FOR.
   *
   * WHAT REPLACES IT: the same invariant, asserted without naming a
   * component — `/search` renders a destination in place, and still does
   * not send the reader anywhere to read the analysis.
   */
  it('R2a: /search still renders the analysis IN PLACE, whatever the destination component is', () => {
    // A destination is mounted here...
    expect(searchClient).toMatch(/<AnalysisFrameSurface/);
    // ...it is given the response this page already fetched...
    expect(searchClient).toMatch(/response=\{response\}/);
    // ...and reading the analysis still costs no navigation.
    expect(searchClient).not.toMatch(/<Link/);
    expect(searchClient).not.toMatch(/router\.push\(`?\/analysis/);
  });

  it('and the frame reads that query back out of the URL', () => {
    expect(source).toMatch(/searchParams\.get\('q'\)/);
  });
});

/* Ruling 6 — no storage machinery was introduced */
describe('Ruling 6 — no store, no sessionStorage, no localStorage, no result cache', () => {
  it('neither changed component reaches for client persistence', () => {
    for (const [name, text] of [['AnalysisFrameClient', source], ['frameRequest', readFileSync(`${__dirname}/frameRequest.ts`, 'utf8')]] as const) {
      expect(`${name}: ${/sessionStorage|localStorage|indexedDB|createContext/.test(text)}`).toBe(`${name}: false`);
    }
  });
});
