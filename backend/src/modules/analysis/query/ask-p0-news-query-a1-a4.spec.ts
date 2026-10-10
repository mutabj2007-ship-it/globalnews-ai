/**
 * P0 ASK-P0-NEWS-QUERY-A1-A4-R1 — offline acceptance for A1 and A4.
 *
 * The DRC question below is VERBATIM from live operation
 * `3a3eb693-a669-4609-b912-e17483fd6124` (2026-10-10T08:09:42Z). No network,
 * no provider, no model, no database: every assertion is a pure function of
 * the query authority.
 */
import {
  deriveFallbackNewsQuery,
  deriveGenericNewsQuery,
  makeProviderSafeNewsQuery,
} from './derive-generic-news-query.util';
import { detectSourceAttributedIntent } from './derive-source-attributed-query.util';
import {
  MAX_PROVIDER_QUERY_TERMS,
  makeGenericProviderFallbackQuery,
  makeGenericProviderQuery,
  reduceNewsQueryForProvider,
} from './news-query-reduction.util';
import {
  WITHHELD_QUERY,
  buildSentQueryTrace,
  decideFallback,
  deriveRetrievalOutcome,
  primaryCompletedEmpty,
  recordDispatched,
  recordLane,
  recordSkipped,
  sentQueryVariants,
} from './news-sent-query-trace.util';

const DRC =
  'What are the latest verified developments in eastern DR Congo over the last seven days? ' +
  'Give the original sources, publication dates, and distinguish confirmed facts from allegations.';
const KIBIRIZI = 'What are the latest verified reports about flooding in Kibirizi villages';

const sentFor = (question: string): string | undefined =>
  makeGenericProviderQuery(deriveGenericNewsQuery(question)).sent;
const fallbackFor = (question: string): string | undefined =>
  makeGenericProviderFallbackQuery(deriveGenericNewsQuery(question)).sent;

describe('A1 · the measured failure, and that it is gone', () => {
  it('BEFORE: the baseline sent the whole 27-word sentence', () => {
    /* Pins the defect so the mutation check below has something to restore. */
    const before = makeProviderSafeNewsQuery(deriveGenericNewsQuery(DRC)) ?? '';

    expect(before.split(/\s+/).length).toBe(27);
    expect(before).toContain('distinguish confirmed facts from allegations');
  });

  it('BEFORE: the baseline fallback was 17 request and format words', () => {
    const before = deriveFallbackNewsQuery(deriveGenericNewsQuery(DRC)) ?? '';

    expect(makeProviderSafeNewsQuery(before)).toBe(
      'verified eastern DR Congo over last seven days original sources publication dates ' +
        'distinguish confirmed facts from allegations',
    );
  });

  it('AFTER: the DRC question sends exactly "eastern DR Congo"', () => {
    expect(sentFor(DRC)).toBe('eastern DR Congo');
  });

  it('AFTER: the DRC fallback is not weaker than the primary', () => {
    expect(fallbackFor(DRC)).toBe('eastern DR Congo');
  });

  it('AFTER: the Kibirizi question sends exactly "flooding Kibirizi"', () => {
    expect(sentFor(KIBIRIZI)).toBe('flooding Kibirizi');
    expect(fallbackFor(KIBIRIZI)).toBe('flooding Kibirizi');
  });

  it('keeps the geography terms and drops the window words', () => {
    const sent = sentFor(DRC) ?? '';

    /* COD is decided by the router; these terms are what lets the provider agree. */
    expect(sent).toContain('Congo');
    expect(sent).toContain('eastern');
    /* The 168-hour interval is reporting-window.ts's job, never a keyword. */
    expect(sent).not.toMatch(/\b(last|seven|days)\b/i);
  });

  it('drops only request, format and verification words', () => {
    const sent = sentFor(DRC) ?? '';

    for (const word of [
      'latest', 'verified', 'developments', 'Give', 'original', 'sources',
      'publication', 'dates', 'distinguish', 'confirmed', 'facts', 'allegations',
    ]) {
      expect(sent).not.toContain(word);
    }
  });

  it('never exceeds the term cap', () => {
    for (const q of [DRC, KIBIRIZI, 'Tanzania Rwanda bilateral trade in the last 30 days']) {
      expect((sentFor(q) ?? '').split(/\s+/).length).toBeLessThanOrEqual(MAX_PROVIDER_QUERY_TERMS);
    }
  });
});

describe('A1 · the queries that already worked are byte-identical', () => {
  it.each(["Kenya's economy", 'Erik Prince', 'NATO', 'UN report on Gaza aid'])(
    '%s is unchanged',
    (q) => {
      const derived = deriveGenericNewsQuery(q);

      expect(sentFor(q)).toBe(makeProviderSafeNewsQuery(derived));
    },
  );

  it("the Kenya query keeps its exact recorded form, apostrophe artefact and all", () => {
    /*
     * "Kenya s economy" is the one short query the live record shows DID
     * retrieve. It is NOT tidied here: changing a working query to look nicer
     * is outside A1 and would be an unmeasured risk.
     */
    expect(sentFor("Kenya's economy")).toBe('Kenya s economy');
  });

  it('leaves an unframed query alone, whatever its length', () => {
    /*
     * R2 CORRECTION. R1 triggered on LENGTH, which is why
     * "The demand for labour in Quarter 2 2026" — eight terms, no framing —
     * was cut to "demand labour Quarter 2" and lost the year. The trigger is
     * now the presence of a request frame to remove.
     */
    expect(reduceNewsQueryForProvider('Erik Prince').outcome).toBe('NO_FRAME_UNCHANGED');
    expect(reduceNewsQueryForProvider('The demand for labour in Quarter 2 2026')).toEqual({
      query: 'The demand for labour in Quarter 2 2026',
      outcome: 'NO_FRAME_UNCHANGED',
      dropped: [],
    });
  });
});

describe('A1 · conservative failure', () => {
  it('returns the input unchanged when no subject survives', () => {
    const r = reduceNewsQueryForProvider('give me the latest verified updates please');

    expect(r.outcome).toBe('NOT_SAFELY_REDUCIBLE');
    expect(r.query).toBe('give me the latest verified updates please');
  });

  it('offers no second attempt rather than a fallback of request words', () => {
    const f = makeGenericProviderFallbackQuery(
      deriveGenericNewsQuery('give me the latest verified updates please'),
    );

    expect(f.sent).toBeUndefined();
    expect(f.outcome).toBe('NOT_SAFELY_REDUCIBLE');
  });

  it('keeps a generic locality noun when no named place survives', () => {
    const r = reduceNewsQueryForProvider('what are the latest reports about flooding in villages');

    expect(r.query).toContain('villages');
  });
});

describe('A1 · Congo readings are never interchanged by reduction', () => {
  it.each([
    ['DR Congo', 'DR Congo'],
    ['eastern DR Congo', 'eastern DR Congo'],
    ['Republic of the Congo', 'Republic Congo'],
    ['South Kivu', 'South Kivu'],
  ])('reduction of a long question containing %s keeps its terms', (fragment, expected) => {
    const sent =
      makeGenericProviderQuery(
        deriveGenericNewsQuery(
          `What are the latest verified developments in ${fragment} over the last seven days?`,
        ),
      ).sent ?? '';

    for (const term of expected.split(' ')) expect(sent).toContain(term);
  });

  it('never introduces a Congo term the reader did not write', () => {
    const sent = sentFor('What are the latest verified developments in Brazzaville this week?') ?? '';

    expect(sent).not.toMatch(/\bDR\b/);
    expect(sent).toContain('Brazzaville');
  });
});

describe('A1 · the publisher-constrained request is not widened', () => {
  it('the Reuters constraint still carries, and reduction does not remove it', () => {
    const intent = detectSourceAttributedIntent(
      'Report abt Eric Prince in congo. According reuters please.',
    );

    expect(intent?.rawSourcePhrase).toBe('reuters');
  });

  it('EA-T N2: the retrieval subject carries no request words', () => {
    const topic =
      detectSourceAttributedIntent(
        "according to reuters, what happened to erik prince's forces in eastern congo?",
      )?.query?.topic ?? '';

    expect(topic).not.toMatch(/\b(report|reports|abt|about|according|reuters|please|give|any|recent|happened)\b/);
    expect(topic).toContain('erik prince');
    expect(topic).toContain('eastern congo');
  });
});

describe('A4 · the trace states what was sent, and only that', () => {
  it('records a dispatched primary with its exact string', () => {
    const t = buildSentQueryTrace([
      recordDispatched('PRIMARY', 'eastern DR Congo', 'SENT_ZERO_RESULTS', 'gnews'),
    ]);

    expect(t).toHaveLength(1);
    expect(t[0].query).toBe('eastern DR Congo');
    expect(t[0].outcome).toBe('SENT_ZERO_RESULTS');
  });

  it('a skipped attempt CANNOT carry a query', () => {
    const skipped = recordSkipped('FALLBACK', 'SKIPPED_PROVIDER_INELIGIBLE', 'gnews');

    expect(skipped.query).toBeNull();
    /* There is no argument to pass one — enforced by the signature. */
    expect(Object.keys(skipped).sort()).toEqual(['lane', 'outcome', 'query', 'role']);
  });

  it('a fallback skipped on provider failure is NOT recorded as sent', () => {
    const variants = sentQueryVariants([
      recordDispatched('PRIMARY', 'eastern DR Congo', 'SENT_PROVIDER_FAILED', 'gnews'),
      recordSkipped('FALLBACK', 'SKIPPED_PROVIDER_INELIGIBLE', 'gnews'),
    ]);

    expect(variants).toEqual(['eastern DR Congo']);
  });

  it('distinguishes the four outcomes the empty array used to conflate', () => {
    const outcomes = [
      recordSkipped('PRIMARY', 'SKIPPED_NO_QUERY'),
      recordDispatched('PRIMARY', 'x y', 'SENT_ZERO_RESULTS'),
      recordDispatched('PRIMARY', 'x y', 'SENT_PROVIDER_FAILED'),
      recordSkipped('PRIMARY', 'SKIPPED_RETAINED_SUBSTITUTED'),
    ].map((a) => a.outcome);

    expect(new Set(outcomes).size).toBe(4);
  });

  it('never stores a credential-shaped string', () => {
    const a = recordDispatched('PRIMARY', 'congo apikey=abcdefghijklmnopqrstuvwxyz012345', 'SENT_RESULTS');

    expect(a.query).toBe(WITHHELD_QUERY);
  });

  it('bounds the trace to the provider-call budget', () => {
    const t = buildSentQueryTrace([
      recordDispatched('PRIMARY', 'a b', 'SENT_RESULTS'),
      recordDispatched('PRIMARY', 'c d', 'SENT_RESULTS'),
      recordDispatched('FALLBACK', 'e f', 'SENT_RESULTS'),
      recordDispatched('FALLBACK', 'g h', 'SENT_RESULTS'),
    ]);

    expect(t).toHaveLength(2);
    expect(t.map((a) => a.role)).toEqual(['PRIMARY', 'FALLBACK']);
  });

  it('bounds the stored query length', () => {
    const a = recordDispatched('PRIMARY', 'congo '.repeat(100), 'SENT_RESULTS');

    expect((a.query ?? '').length).toBeLessThanOrEqual(200);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * R2 — THE NINE PHRASINGS FROM INTAKE DOC 31
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R1 kept "the first four terms not on its request list", which is POSITIONAL:
 * an unlisted framing word both survived and consumed a slot, so the subject
 * fell off the end. The wrong output for each row is recorded beside the right
 * one so the regression cannot come back quietly.
 */
describe('R2 · the nine intake phrasings', () => {
  const SUPPLY_CHAINS =
    'What are the most significant recent economic security diplomatic social infrastructure ' +
    'and technological developments currently reshaping global supply chains, and how are ' +
    'disruptions influencing international trade relationships and long-term geopolitical ' +
    'stability, considering shifting alliances, emerging regulatory frameworks, and evolving ' +
    'multilateral cooperation efforts?';

  it.each([
    ['careful sourced global semiconductor', 'Please give a careful, sourced overview of the global semiconductor export controls', 'global semiconductor export controls'],
    ['most important Sudan ceasefire', 'Can you summarize, with links, the most important Sudan ceasefire negotiations?', 'Sudan ceasefire negotiations'],
    ['like detailed well sourced European', 'I would like a detailed, well sourced briefing on European Central Bank interest rate decisions', 'European Central Bank interest rate decisions'],
    ['Using only reliable Ethiopia', 'Using only reliable sources, what are the Ethiopia Eritrea border tensions?', 'Ethiopia Eritrea border tensions'],
    ['short neutral Boeing 737', 'Give me a short, neutral summary of the Boeing 737 MAX production problems', 'Boeing 737 MAX production problems'],
    ['most cholera outbreaks Malawi', 'Show the most verified reports on cholera outbreaks in Malawi', 'cholera outbreaks Malawi'],
    ['clearly citing Taiwan Strait', 'Explain clearly, citing sources, the Taiwan Strait military tensions', 'Taiwan Strait military tensions'],
  ])('was "%s" — now sends the subject', (_wrong, question, expected) => {
    expect(sentFor(question)).toBe(expected);
  });

  it('keeps the named entity and the model designator together', () => {
    const sent = sentFor('Give me a short, neutral summary of the Boeing 737 MAX production problems') ?? '';

    expect(sent).toContain('Boeing');
    expect(sent).toContain('737');
    expect(sent).toContain('MAX');
  });

  it('a 50-word argument has no subject, so it is NOT reduced', () => {
    /*
     * R1 sent "most significant economic security" for a question about SUPPLY
     * CHAINS. Two dozen content nouns and no named entity leave nothing to
     * select deterministically, and both a parser and a model rewrite are
     * forbidden — so the reader's own words go out, which is also what the
     * baseline did and what the existing expectation requires.
     */
    const r = reduceNewsQueryForProvider(deriveGenericNewsQuery(SUPPLY_CHAINS));

    expect(r.outcome).toBe('NOT_SAFELY_REDUCIBLE');
    expect(sentFor(SUPPLY_CHAINS)).toContain('supply chains');
  });

  it('PRESERVES AN EXPLICIT YEAR — the R1 defect the rights test caught', () => {
    /* R1 sent "demand labour Quarter 2" and dropped 2026 entirely. */
    expect(sentFor('The demand for labour in Quarter 2 2026')).toBe(
      'The demand for labour in Quarter 2 2026',
    );
    expect(sentFor('Please give a verified summary of the demand for labour in Quarter 2 2026')).toContain('2026');
  });

  it('drops a bare number orphaned by a window unit', () => {
    /* "…in the last 30 days" lost "days" and kept "30"; 30 is not a subject. */
    expect(sentFor('Give me the latest on Tanzania Rwanda bilateral trade in the last 30 days')).toBe(
      'Tanzania Rwanda bilateral trade',
    );
  });

  it('never treats a sentence-initial capital as a named entity', () => {
    /* "Using" began the sentence; capitalisation there is orthography, not evidence. */
    expect(sentFor('Using only reliable sources, what are the Ethiopia Eritrea border tensions?')).not.toContain('Using');
  });
});

describe('R2 · the fallback ruling', () => {
  const base = {
    primarySent: 'eastern DR Congo',
    primaryOutcome: 'SENT_ZERO_RESULTS' as const,
    primaryCandidateCount: 0,
    fallbackQuery: 'DR Congo Kivu',
    budgetRemaining: 1,
  };

  it('permits a second search only after a completed, empty primary', () => {
    expect(decideFallback(base)).toBe('FALLBACK_PERMITTED');
  });

  it.each([
    ['SENT_PROVIDER_FAILED' as const],
    ['SKIPPED_PROVIDER_INELIGIBLE' as const],
    ['SKIPPED_NO_QUERY' as const],
  ])('refuses after %s — a failure is never a reason to search again', (primaryOutcome) => {
    expect(decideFallback({ ...base, primaryOutcome })).toBe(
      'FALLBACK_REFUSED_PRIMARY_DID_NOT_COMPLETE',
    );
  });

  it('refuses when the primary already found candidates', () => {
    expect(decideFallback({ ...base, primaryOutcome: 'SENT_RESULTS', primaryCandidateCount: 3 })).toBe(
      'FALLBACK_REFUSED_PRIMARY_HAD_CANDIDATES',
    );
  });

  it('refuses to send the same query twice', () => {
    expect(decideFallback({ ...base, fallbackQuery: 'eastern DR Congo' })).toBe(
      'FALLBACK_REFUSED_IDENTICAL_TO_PRIMARY',
    );
  });

  it('refuses with no distinct fallback, and when the budget is spent', () => {
    expect(decideFallback({ ...base, fallbackQuery: undefined })).toBe('FALLBACK_REFUSED_NO_QUERY');
    expect(decideFallback({ ...base, budgetRemaining: 0 })).toBe('FALLBACK_REFUSED_BUDGET_SPENT');
  });

  it('the completion check runs FIRST, so no combination smuggles a retry past it', () => {
    expect(
      decideFallback({
        ...base,
        primaryOutcome: 'SENT_PROVIDER_FAILED',
        primaryCandidateCount: 0,
        fallbackQuery: 'something distinct',
        budgetRemaining: 99,
      }),
    ).toBe('FALLBACK_REFUSED_PRIMARY_DID_NOT_COMPLETE');
  });
});

describe('R2 · per-lane outcomes (intake §6)', () => {
  it('GNews zero plus a GDELT timeout is PARTIAL, not a GNews failure', () => {
    /* Exactly live op 3a3eb693: succeeded ["gnews"], unavailable [gdelt-doc timeout]. */
    const lanes = [
      recordLane('gnews', 'LANE_RETURNED_ZERO', 0),
      recordLane('gdelt-doc', 'LANE_TIMED_OUT', null, 'timeout'),
    ];

    expect(deriveRetrievalOutcome(lanes)).toBe('RETRIEVAL_PARTIAL_SOME_LANES_UNAVAILABLE');
    expect(lanes[0].outcome).toBe('LANE_RETURNED_ZERO');
    expect(lanes[0].candidates).toBe(0);
    expect(lanes[1].candidates).toBeNull();
    expect(lanes[1].reason).toBe('timeout');
  });

  it('a genuine all-lanes zero is distinguishable from that', () => {
    expect(
      deriveRetrievalOutcome([
        recordLane('gnews', 'LANE_RETURNED_ZERO', 0),
        recordLane('gdelt-doc', 'LANE_RETURNED_ZERO', 0),
      ]),
    ).toBe('RETRIEVAL_ZERO_ALL_LANES_ANSWERED');
  });

  it('no lane answering is not a zero either', () => {
    expect(
      deriveRetrievalOutcome([
        recordLane('gnews', 'LANE_RATE_LIMITED', null, '429'),
        recordLane('gdelt-doc', 'LANE_TIMED_OUT', null, 'timeout'),
      ]),
    ).toBe('RETRIEVAL_NO_LANE_ANSWERED');
  });

  it('candidates anywhere means candidates', () => {
    expect(
      deriveRetrievalOutcome([
        recordLane('gnews', 'LANE_RETURNED_CANDIDATES', 4),
        recordLane('gdelt-doc', 'LANE_TIMED_OUT', null, 'timeout'),
      ]),
    ).toBe('RETRIEVAL_CANDIDATES');
  });

  it('a partial primary does NOT satisfy the fallback ruling', () => {
    /* A second query on the strength of someone else's timeout is the thing forbidden. */
    expect(
      primaryCompletedEmpty([
        recordLane('gnews', 'LANE_RETURNED_ZERO', 0),
        recordLane('gdelt-doc', 'LANE_TIMED_OUT', null, 'timeout'),
      ]),
    ).toBe(false);
    expect(
      primaryCompletedEmpty([
        recordLane('gnews', 'LANE_RETURNED_ZERO', 0),
        recordLane('gdelt-doc', 'LANE_RETURNED_ZERO', 0),
      ]),
    ).toBe(true);
  });

  it('a lane reason is sanitized like any stored string', () => {
    expect(recordLane('gnews', 'LANE_FAILED', null, 'apikey=abcdefghijklmnopqrstuvwxyz012345').reason).toBe(
      WITHHELD_QUERY,
    );
  });
});
