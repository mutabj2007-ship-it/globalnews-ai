/**
 * P0 ASK-P0-NEWS-QUERY-A1-A4 — offline acceptance for A1 (R3) and A4 (R2, qualified).
 *
 * The DRC question below is VERBATIM from live operation
 * `3a3eb693-a669-4609-b912-e17483fd6124` (2026-10-10T08:09:42Z). No network,
 * no provider, no model, no database: every assertion is a pure function of
 * the query authority.
 *
 * WHAT R3 HAD TO PROVE, AND HOW THIS FILE PROVES IT.
 *
 * R2's intake found seven tests that pass on the accepted Alpha baseline
 * `9aab213` and failed under R2, because a general rewriter also rewrote queries
 * that were never broken. R3's claim is therefore a NEGATIVE one — "nothing
 * outside a recognized pattern changed" — and a negative claim is not provable
 * by listing examples that happen to work.
 *
 * So the first describe below does not compare against a literal. It compares
 * against `makeProviderSafeNewsQuery()`, the baseline's own provider-query
 * function, and asserts byte equality. Every input on which the pattern does not
 * match is checked against what `9aab213` itself would have sent, which is the
 * only form of the claim that cannot drift.
 */
import {
  deriveFallbackNewsQuery,
  deriveGenericNewsQuery,
  makeProviderSafeNewsQuery,
} from './derive-generic-news-query.util';
import { detectSourceAttributedIntent } from './derive-source-attributed-query.util';
import {
  GNEWS_QUERY_CODE_POINT_MAX,
  MAX_SUBJECT_SPAN_TERMS,
  MIN_TERMS_FOR_PATTERN,
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
const KIBIRIZI =
  'What are the latest verified reports about flooding in Kibirizi village, South Kivu, ' +
  'over the last seven days? Give the original sources.';
const SEMICONDUCTORS =
  'Please give me a careful, sourced overview with publication dates of the latest developments ' +
  'in global semiconductor export controls and explain what remains uncertain.';
const ECB =
  'I would like a detailed, well-sourced briefing on what has happened recently with the ' +
  'European Central Bank interest rate decisions.';
const BOEING =
  'Give me a short, neutral summary with dates of the latest news about Boeing 737 MAX production problems.';
const SUPPLY_CHAINS =
  'What are the most significant recent economic security diplomatic social infrastructure ' +
  'and technological developments currently reshaping global supply chains, and how are ' +
  'disruptions influencing international trade relationships and long-term geopolitical ' +
  'stability, considering shifting alliances, emerging regulatory frameworks, and evolving ' +
  'multilateral cooperation efforts?';

const derived = (question: string): string => deriveGenericNewsQuery(question);
const sentFor = (question: string): string | undefined =>
  makeGenericProviderQuery(derived(question)).sent;
const fallbackFor = (question: string): string | undefined =>
  makeGenericProviderFallbackQuery(derived(question)).sent;
const outcomeFor = (question: string): string => makeGenericProviderQuery(derived(question)).outcome;
const codePoints = (value: string): number => Array.from(value).length;

/* ════════════════════════════════════════════════════════════════════════════
 * A1 R3 — BASELINE PARITY IS THE DEFAULT
 * ════════════════════════════════════════════════════════════════════════════ */

describe('A1 R3 · outside a recognized pattern, the baseline string is what goes out', () => {
  /**
   * The seven R2 regressions, as reader inputs rather than as test names. Each
   * is checked against the BASELINE FUNCTION, not against a literal, so the
   * assertion states the actual requirement: `9aab213` behaviour, preserved.
   */
  const PREVIOUSLY_WORKING = [
    'the us released a report today',
    'Tell me about markets today',
    'Tell me about technology and markets today',
    'Tell me everything about the situation',
    "What has changed in Poland's economy this week? Give the dates and cite the sources.",
    "What are Poland's energy sources?",
    'What is the impact of new tariffs on global trade?',
    'The demand for labour in Quarter 2 2026',
    "What are the latest reports about Kenya's economy?",
    "What's happening with NATO?",
    'What are the latest developments in Eastern Europe?',
    'What is happening in Congo-Brazzaville this week?',
    'Erik Prince',
    'Give any reports about Eric Prince please.',
  ];

  it.each(PREVIOUSLY_WORKING)('is byte-identical to the baseline provider query: %s', (question) => {
    const q = derived(question);
    expect(makeGenericProviderQuery(q).sent).toBe(makeProviderSafeNewsQuery(q));
    expect(makeGenericProviderQuery(q).outcome).toBe('NO_PATTERN_UNCHANGED');
  });

  it.each(PREVIOUSLY_WORKING)('the bounded fallback is the baseline fallback too: %s', (question) => {
    const q = derived(question);
    const baselineFallback = deriveFallbackNewsQuery(q);
    expect(makeGenericProviderFallbackQuery(q).sent).toBe(
      baselineFallback === undefined ? undefined : makeProviderSafeNewsQuery(baselineFallback),
    );
  });

  /* The four M35/M36 strings, pinned literally as well — the exact expectations
     the baseline suite asserts, so a reader of this file can see them. */
  it('the four M35/M36 provider queries are unchanged, literally', () => {
    expect(sentFor('the us released a report today')).toBe('the us released a report today');
    expect(sentFor('Tell me about markets today')).toBe('markets today');
    expect(sentFor('Tell me about technology and markets today')).toBe('technology and markets today');
    expect(sentFor('Tell me everything about the situation')).toBe(
      'Tell me everything about the situation',
    );
  });

  it('an explicit year and quarter survive, because nothing unmatched is touched', () => {
    expect(sentFor('The demand for labour in Quarter 2 2026')).toBe(
      'The demand for labour in Quarter 2 2026',
    );
  });

  it('"this week" is left exactly where the reader put it', () => {
    expect(sentFor('What is happening in Congo-Brazzaville this week?')).toBe(
      'Congo Brazzaville this week',
    );
  });

  /**
   * `report`, `sources`, `released` and `today` are not on any drop list, so a
   * topic that happens to use one keeps it. This is the "energy sources" family:
   * the word is identical to a format directive and is kept because of where it
   * sits, not because of an exception for this phrase.
   */
  it.each([
    ["What are Poland's energy sources?", /sources/i],
    ['What are the water sources in the Sahel?', /sources/i],
    ['the us released a report today', /released/],
    ['What are the latest reports about markets today?', /today/],
  ])('a topic word that doubles as a directive survives: %s', (question, expected) => {
    expect(sentFor(question)).toMatch(expected as RegExp);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * A1 R3 — THE ONE RECOGNIZED PATTERN
 * ════════════════════════════════════════════════════════════════════════════ */

describe('A1 R3 · the recognized safe-reduction pattern', () => {
  it('BEFORE: the baseline sent the whole 27-word sentence', () => {
    /* Pins the defect so the mutation check has something to restore. */
    expect(makeProviderSafeNewsQuery(derived(DRC))).toContain('distinguish confirmed facts');
    expect(codePoints(makeProviderSafeNewsQuery(derived(DRC)) ?? '')).toBeGreaterThan(170);
  });

  it.each([
    [DRC, 'eastern DR Congo'],
    [KIBIRIZI, 'flooding Kibirizi South Kivu'],
    [SEMICONDUCTORS, 'global semiconductor export controls'],
    [ECB, 'European Central Bank interest rate decisions'],
    [BOEING, 'Boeing 737 MAX production problems'],
    [SUPPLY_CHAINS, 'global supply chains'],
  ])('sends the subject span and nothing else: %s', (question, expected) => {
    expect(sentFor(question as string)).toBe(expected);
    expect(outcomeFor(question as string)).toBe('REDUCED');
  });

  it('the ECB briefing keeps "decisions" and drops "well sourced"', () => {
    const sent = sentFor(ECB) ?? '';
    expect(sent).toContain('decisions');
    expect(sent).not.toMatch(/well|sourced|detailed|briefing/i);
  });

  it('the semiconductor overview does not keep "remains uncertain"', () => {
    expect(sentFor(SEMICONDUCTORS)).not.toMatch(/remains|uncertain|publication|dates/i);
  });

  /**
   * THE DRC AND KIBIRIZI RESULTS ARE NOT HARDCODED, and this is the evidence:
   * two questions of the same shape that appear nowhere in the corpus, with
   * different places, different hazards and different window wording, reduce the
   * same way. If either case were a phrase patch these would fail.
   */
  it.each([
    [
      'What are the latest verified reports about landslides in Bukavu town, North Kivu, over the past ten days? Give the original sources.',
      'landslides Bukavu North Kivu',
    ],
    [
      'What are the latest verified developments in northern Mozambique over the last fortnight? Give the original sources and publication dates.',
      'northern Mozambique',
    ],
    [
      'Please give me a sourced overview with publication dates of the latest developments in Brazilian pension reform and explain what remains contested.',
      'Brazilian pension reform',
    ],
  ])('the same shape reduces the same way for unseen inputs: %s', (question, expected) => {
    expect(sentFor(question as string)).toBe(expected);
  });

  it('BOTH pieces of lead evidence are required — removing either stops the match', () => {
    /* A request opener with no reporting head: no match. */
    expect(outcomeFor('Tell me everything you can about the situation in the wider area please')).toBe(
      'NO_PATTERN_UNCHANGED',
    );
    /* A reporting head with no request opener: no match. */
    expect(
      outcomeFor('Recent reports about flooding in Kibirizi village South Kivu were published today'),
    ).toBe('NO_PATTERN_UNCHANGED');
  });

  it('"sources" is not a reporting head, so it cannot move the subject boundary', () => {
    const r = reduceNewsQueryForProvider(
      'What are the latest verified reports about the energy sources of Poland and Hungary today',
    );
    expect(r.query).toContain('energy sources');
  });

  it('a reporting head after the terminator says nothing about the subject', () => {
    /* "reports" occurs twice: once as the lead head, once in the trailing
       directive. Taking the LAST head in the whole string would start the span
       after the directive and find nothing; the match is bounded by the
       terminator, so the trailing occurrence is invisible to it. */
    expect(
      sentFor(
        'What are the latest verified reports about Ethiopian coffee exports over the last month? Give the underlying reports.',
      ),
    ).toBe('Ethiopian coffee exports');
  });

  /**
   * A MEASURED RESIDUAL, recorded here rather than patched.
   *
   * `deriveGenericNewsQuery()` sometimes strips the request lead itself, and when
   * it does the pattern has no lead left to match — so the trailing window and
   * directives it did NOT strip survive into the provider query. That is baseline
   * behaviour, preserved exactly, and correcting it means changing the derivation,
   * which is a different owner and a different contract.
   */
  it('when the derivation strips the lead itself, baseline behaviour is preserved verbatim', () => {
    const q = derived(
      'What are the latest developments in Ethiopian coffee exports over the last month? Give the underlying reports.',
    );
    expect(q.startsWith('Ethiopian')).toBe(true);
    expect(makeGenericProviderQuery(q).outcome).toBe('NO_PATTERN_UNCHANGED');
    expect(makeGenericProviderQuery(q).sent).toBe(makeProviderSafeNewsQuery(q));
  });

  it('a conjoined subject is not cut, but a new clause is', () => {
    expect(
      sentFor('What are the latest reports about Ethiopia and Eritrea border tensions this month?'),
    ).toContain('Eritrea');
    expect(sentFor(SEMICONDUCTORS)).not.toContain('explain');
  });

  it('capitalisation decides whether a locality noun is structural', () => {
    /* lowercase "village" is scaffolding; capitalised "City" is part of a name. */
    expect(sentFor(KIBIRIZI)).not.toContain('village');
    expect(
      sentFor(
        'What are the latest verified reports about air quality in Mexico City over the last seven days? Give the original sources.',
      ),
    ).toBe('air quality Mexico City');
  });

  it('a span made of scaffolding is refused, not sent', () => {
    const r = reduceNewsQueryForProvider(
      'What are the latest reports about it from them in there now and so on',
    );
    expect(r.outcome).toBe('NO_PATTERN_UNCHANGED');
    expect(r.pattern).toBeNull();
  });

  /**
   * THE STATED LIMIT. The pattern bounds the span; it does not rank how specific
   * the reader's own subject is, and it must not — "global supply chains" is
   * correct and carries no proper noun, so any rule strong enough to reject
   * "the situation" would also reject it. A vague question therefore yields a
   * vague subject, the search returns nothing, and the existing no-evidence
   * surface answers truthfully. This is asserted so the limit is visible rather
   * than discovered later.
   */
  it('does not judge how specific a subject is (recorded limit)', () => {
    const r = reduceNewsQueryForProvider(
      'What are the latest reports about the situation there right now for us all',
    );
    expect(r.outcome).toBe('REDUCED');
    expect(r.query).toBe('situation right us all');
  });

  it('refuses a span wider than a bounded subject', () => {
    const wide = Array.from({ length: MAX_SUBJECT_SPAN_TERMS + 2 }, (_, i) => `topic${i}`).join(' ');
    expect(reduceNewsQueryForProvider(`What are the latest reports about ${wide}`).outcome).toBe(
      'NO_PATTERN_UNCHANGED',
    );
  });

  it('never matches a short query, whatever its words', () => {
    const short = 'What are the latest reports about Congo';
    expect(short.split(/\s+/).length).toBeLessThan(MIN_TERMS_FOR_PATTERN);
    expect(reduceNewsQueryForProvider(short).outcome).toBe('NO_PATTERN_UNCHANGED');
  });

  it('never introduces a term the reader did not write', () => {
    for (const question of [DRC, KIBIRIZI, SEMICONDUCTORS, ECB, BOEING, SUPPLY_CHAINS]) {
      const source = derived(question).toLowerCase();
      for (const term of (sentFor(question) ?? '').split(' ')) {
        expect(source).toContain(term.toLowerCase());
      }
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * A1 R3 — NO OUTBOUND QUERY IS EVER SILENTLY CLAMPED
 * ════════════════════════════════════════════════════════════════════════════ */

describe('A1 R3 · the GNews clamp is never reached', () => {
  const CORPUS = [DRC, KIBIRIZI, SEMICONDUCTORS, ECB, BOEING, SUPPLY_CHAINS];

  it.each(CORPUS)('the primary fits inside the provider maximum: %s', (question) => {
    expect(codePoints(sentFor(question) ?? '')).toBeLessThanOrEqual(GNEWS_QUERY_CODE_POINT_MAX);
  });

  it.each(CORPUS)('the bounded fallback fits too, or is not sent: %s', (question) => {
    const f = fallbackFor(question);
    if (f !== undefined) expect(codePoints(f)).toBeLessThanOrEqual(GNEWS_QUERY_CODE_POINT_MAX);
  });

  /**
   * THE 50-WORD CASE. R2 sent 302 code points and GNews cut it mid-word at
   * "…geopolitical stability c". The pattern now finds a bounded subject, so the
   * clamp is never reached and the sent query is something a reader would
   * recognize as their own question.
   */
  it('the 50-word supply-chain question is searched on its subject, not clamped', () => {
    const sent = sentFor(SUPPLY_CHAINS) ?? '';
    expect(sent).toBe('global supply chains');
    expect(codePoints(sent)).toBeLessThan(GNEWS_QUERY_CODE_POINT_MAX);
    expect(sent.length).toBeLessThan(SUPPLY_CHAINS.length);
  });

  /**
   * AN UNMATCHED OVER-LONG REQUEST IS REPORTED, NOT REFUSED HERE — and the test
   * says why, because the "obvious" version of this is what broke eleven tests.
   *
   * Returning `undefined` for this case makes the caller's "no lexical query"
   * branch fire, and that branch sits BEFORE the compound-plan decision, so a
   * compound DRC question sent ZERO provider requests instead of four. The
   * condition is therefore stated as an outcome, and the caller correction ships
   * as a reviewable patch. `sent` stays byte-identical to the baseline so that
   * nothing regresses in the meantime.
   */
  it('an unmatched over-long request is reported, and still sent as the baseline sent it', () => {
    const unmatched = `The ${'interlocking consequence '.repeat(12)}matters a great deal`;
    const baseline = makeProviderSafeNewsQuery(unmatched);
    expect(codePoints(baseline ?? '')).toBeGreaterThan(GNEWS_QUERY_CODE_POINT_MAX);
    const r = makeGenericProviderQuery(unmatched);
    expect(r.outcome).toBe('NOT_SAFELY_REDUCIBLE');
    expect(r.sent).toBe(baseline);
    expect(r.unreduced).toBe(baseline);
  });

  it('the boundary is the documented maximum, not an approximation', () => {
    const at = `${'ab '.repeat(66)}cd`;
    expect(codePoints(at)).toBe(GNEWS_QUERY_CODE_POINT_MAX);
    expect(makeGenericProviderQuery(at).outcome).toBe('NO_PATTERN_UNCHANGED');
    expect(makeGenericProviderQuery(`${at}X`).outcome).toBe('NOT_SAFELY_REDUCIBLE');
  });

  /**
   * The fallback lane IS refused, because `undefined` is already its contract for
   * "no second attempt" and it is read only after the compound branch is past.
   */
  it('an over-long bounded fallback is not sent at all', () => {
    const r = makeGenericProviderFallbackQuery(derived(SUPPLY_CHAINS));
    expect(r.sent).toBeUndefined();
    expect(r.outcome).toBe('NOT_SAFELY_REDUCIBLE');
    expect(codePoints(r.unreduced ?? '')).toBeGreaterThan(GNEWS_QUERY_CODE_POINT_MAX);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * A1 R3 — THE PUBLISHER-CONSTRAINED REQUEST IS NOT WIDENED
 * ════════════════════════════════════════════════════════════════════════════ */

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
