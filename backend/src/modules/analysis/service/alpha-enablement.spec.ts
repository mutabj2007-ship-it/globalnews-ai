import { harness } from './map-geography-context.harness-spec';

/**
 * ASK R2 ALPHA ENABLEMENT R1 — the landed /analysis path (the Ask fallback for a signed-out
 * reader, the Map dock and /search), run for real with its news/country services stubbed at
 * their own boundaries and a provider that THROWS if reached.
 *
 *   MC-055  a question about the reader's own saved stories is ASKED about, never searched:
 *           IDENTITY_REQUIRED signed out, PERSONAL_LIBRARY_UNAVAILABLE signed in.
 *   MC-070  a first-turn continuation ("And Kenya?") says there is nothing to continue and
 *           keeps the place; with an earlier question it is untouched.
 */
function calls(h: ReturnType<typeof harness>) {
  return {
    provider: (h.provider.analyzeNews as jest.Mock).mock.calls.length,
    searches: h.searchCalls.length,
    countries: h.countryCalls.length,
  };
}

describe('MC-055 — personal questions: identity first, nothing searched, nothing read', () => {
  it.each([
    ['Compare my saved stories', 'en'],
    ['What have I saved about Rwanda?', 'en'],
    ['Porównaj moje zapisane materiały', 'pl'],
  ] as const)(
    'signed out: %s → IDENTITY_REQUIRED, 0 provider / 0 model / 0 retained',
    async (q, lg) => {
      const h = harness();
      const r = await h.service.analyzeNews(q, lg);
      expect(r.retrievalContext).toMatchObject({
        retrievalOutcome: 'CLARIFICATION_REQUIRED',
        clarificationReason: 'IDENTITY_REQUIRED',
      });
      expect(r.analysis).toBeNull();
      expect(r.articles).toEqual([]);
      expect(calls(h)).toEqual({ provider: 0, searches: 0, countries: 0 });
    },
  );

  it('signed in: governed by capability — the library is not reachable from this path', async () => {
    const h = harness();
    const r = await h.service.analyzeNews(
      'Compare my saved stories',
      'en',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { verified: true },
    );
    expect(r.retrievalContext.clarificationReason).toBe('PERSONAL_LIBRARY_UNAVAILABLE');
    expect(calls(h)).toEqual({ provider: 0, searches: 0, countries: 0 });
  });

  it('no saved-story data can leak: the answer depends on identity and is cached per identity', async () => {
    const h = harness();
    const out = await h.service.analyzeNews('Compare my saved stories', 'en');
    const signedIn = await h.service.analyzeNews(
      'Compare my saved stories',
      'en',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { verified: true },
    );
    const outAgain = await h.service.analyzeNews('Compare my saved stories', 'en');
    expect(out.retrievalContext.clarificationReason).toBe('IDENTITY_REQUIRED');
    expect(signedIn.retrievalContext.clarificationReason).toBe('PERSONAL_LIBRARY_UNAVAILABLE');
    expect(outAgain.retrievalContext.clarificationReason).toBe('IDENTITY_REQUIRED');
    for (const r of [out, signedIn, outAgain]) expect(r.articles).toEqual([]);
  });

  it('a news question is untouched (still searched)', async () => {
    const h = harness();
    const r = await h.service.analyzeNews('What is happening in Kenya?', 'en');
    expect(r.retrievalContext.retrievalOutcome).toBeUndefined();
    expect(calls(h).searches + calls(h).countries).toBeGreaterThan(0);
  });
});

describe('MC-070 — "And Kenya?" with nothing to continue', () => {
  it.each([
    ['And Kenya?', 'en'],
    ['What about Kenya?', 'en'],
    ['A Kenia?', 'pl'],
    ['A co z Kenią?', 'pl'],
  ] as const)(
    'first turn: %s → NO_PRIOR_SUBJECT, Kenya kept, 0 provider / 0 model',
    async (q, lg) => {
      const h = harness();
      const r = await h.service.analyzeNews(q, lg);
      expect(r.retrievalContext).toMatchObject({
        retrievalOutcome: 'CLARIFICATION_REQUIRED',
        clarificationReason: 'NO_PRIOR_SUBJECT',
        clarificationCandidates: ['KEN'],
      });
      expect(r.analysis).toBeNull();
      expect(calls(h)).toEqual({ provider: 0, searches: 0, countries: 0 });
    },
  );

  it('with an earlier question it is a real follow-up — not clarified', async () => {
    const h = harness();
    const r = await h.service.analyzeNews(
      'And Kenya?',
      'en',
      undefined,
      'What is happening in Rwanda?',
    );
    expect(r.retrievalContext.clarificationReason).not.toBe('NO_PRIOR_SUBJECT');
  });

  it('under an anchored story it is left to the story path', async () => {
    const h = harness();
    const r = await h.service.analyzeNews('And Kenya?', 'en', {
      title: 'Nairobi budget vote',
      countryCode: 'KEN',
    });
    expect(r.retrievalContext.clarificationReason).not.toBe('NO_PRIOR_SUBJECT');
  });
});
