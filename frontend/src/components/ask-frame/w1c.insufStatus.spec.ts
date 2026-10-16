import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { AnalysisApiResponse, AnalysisRetrievalContext, DisplayLocale } from '@globalnews-ai/shared';
import type { AskR2Payload } from '@/lib/api/askV2Api';
import { AskR2TurnView } from '@/components/ask-frame/AskR2TurnView';
import { askR2View } from '@/lib/ask/askR2View';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { askRightsRefusalStrings } from '@/lib/ask/askRightsRefusal';
import { rightsRefusedOnly } from '@/components/search/evidenceDisplay';

/*
  WAVE 1c (P0, CTO R126 replay probe on 148e2ab) — after W1b, a rights-refused INSUFFICIENT turn still
  said, in its status line: "Checked <when> · a news source was temporarily unavailable, so this was not a
  complete search" (askR2View freshness.limited, chosen from evidenceState 'degraded-fallback' alone).
  False: nothing was attempted, no source is cleared for the use.

  Rule (Main W1c ruling, CTO may overturn): on a refused-only turn — the SAME predicate the turn and the
  status chip use, rightsRefusedOnly(retrieval, articles), no new rule — the INSUFFICIENT status line is
  "Checked <when> · <askRightsRefusalStrings(locale).chip>", composed from already-qualified strings
  (freshness.checked with {sources} := the chip) in all 7 locales. Never 'zero' / "0 matching reports":
  nothing was searched. The emitter sweep found one more reachable outage sentence on a refused-only turn:
  limitedNote ("A news source was temporarily unavailable. This answer uses the reporting that could be
  reached.") under a non-INSUFFICIENT answer and on the Sources sheet; it reads the turn's existing
  notSearched sentence instead (the R115 G-1 substitution already used for search-incomplete).
  A genuine outage, and a refusal beside any non-rights reason, keep freshness.limited / limitedNote
  byte-identical.

  REFUSED is the bc13149 reader payload's retrievalContext (Politics P0 repro 3105990, scenario "fresh"),
  the same fixture as w1b.refusedExplanation.spec.ts.
*/
const REFUSED: AnalysisRetrievalContext = {
  dataMode: 'unavailable', providers: [], fallbackReason: 'provider-error', countryCode: 'COD', countryName: 'DR Congo',
  providerDisplayName: 'Unavailable', articlesRetrieved: 0,
  reportingWindow: { statedPeriod: 'last 7 days', from: '2026-10-09T09:39:42.019Z', to: '2026-10-16T09:39:42.019Z', basis: 'PUBLICATION_TIME', excludedOutsideWindow: 0 },
  providerFailures: [{ providerId: 'gnews', kind: 'rights-not-cleared' }, { providerId: 'gdelt-doc', kind: 'rights-not-cleared' }],
  retrievalTrace: {
    queryVariants: [], timeWindow: { from: '2026-10-09T09:39:42.019Z', to: '2026-10-16T09:39:42.019Z', basis: 'REQUEST_INSTANT' }, languages: ['en'],
    lanesAttempted: ['gnews', 'gdelt-doc'], lanesSucceeded: [],
    lanesUnavailable: [{ lane: 'gnews', reason: 'rights-not-cleared' }, { lane: 'gdelt-doc', reason: 'rights-not-cleared' }],
    candidatesSeen: 0, candidatesAdmitted: 0, independentClusters: 0,
  },
  verificationNotice: 'COVERAGE_INCOMPLETE', evidenceState: 'degraded-fallback',
} as unknown as AnalysisRetrievalContext;
const OUTAGE = {
  ...REFUSED,
  providerFailures: [{ providerId: 'gnews', kind: 'unavailable' }, { providerId: 'gdelt-doc', kind: 'timeout' }],
  retrievalTrace: { ...REFUSED.retrievalTrace, lanesUnavailable: [{ lane: 'gnews', reason: 'unavailable' }, { lane: 'gdelt-doc', reason: 'timeout' }] },
} as unknown as AnalysisRetrievalContext;
const MIXED = {
  ...REFUSED,
  providerFailures: [{ providerId: 'gnews', kind: 'rights-not-cleared' }, { providerId: 'gdelt-doc', kind: 'timeout' }],
  retrievalTrace: { ...REFUSED.retrievalTrace, lanesUnavailable: [{ lane: 'gnews', reason: 'rights-not-cleared' }, { lane: 'gdelt-doc', reason: 'timeout' }] },
} as unknown as AnalysisRetrievalContext;

const LOCALES = ['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'] as const;
const Q = 'What has changed in eastern DRC over the last 7 days?';
const CHECKED_AT = '2026-10-16T09:39:42.019Z';

function payload(ctx: AnalysisRetrievalContext, state: 'INSUFFICIENT' | 'REFERENCE_BACKGROUND' = 'INSUFFICIENT'): AskR2Payload {
  return {
    schema: 'ask-r2-result/1',
    route: { questionClass: 'CURRENT_REPORTING', terminalState: 'EXECUTABLE', scopedBy: 'NONE', refusals: [], disclosures: [], clarification: [], normalization: 'QUALIFIED', questionLanguage: 'en' },
    chips: { kind: 'NONE' },
    answer: state === 'INSUFFICIENT'
      ? { state, basis: 'NO_ADMITTED_REPORTING', missingRoles: [] }
      : { state, basis: 'MODEL_REFERENCE', missingRoles: [] },
    checkedAt: CHECKED_AT,
    aiExecuted: state !== 'INSUFFICIENT',
    modelPriorCitable: false,
    analysis: {
      query: Q, analysis: null, articles: [], retrievalContext: ctx,
      provenance: { provider: 'none', executionMode: 'production', analysisMode: 'live-ai', status: 'success', cached: false },
    } as unknown as AnalysisApiResponse,
    background: null,
    intelligence: null,
  } as unknown as AskR2Payload;
}
const view = (ctx: AnalysisRetrievalContext, locale: DisplayLocale, state?: 'INSUFFICIENT' | 'REFERENCE_BACKGROUND') =>
  askR2View(payload(ctx, state), askShellStrings(locale).askR2Strings, locale);
const s = (locale: DisplayLocale) => askShellStrings(locale).askR2Strings;
/** the locale's outage sentence fragments that must never appear on a refused-only turn */
const limitedSuffix = (locale: DisplayLocale) => s(locale).freshness.limited.split('{when}')[1].trim();

function renderTurn(p: AskR2Payload, locale: DisplayLocale): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(createElement(AskR2TurnView, { turn: { question: Q, payload: p }, locale, context: undefined, onUseQuestion: () => undefined } as never));
  });
  return r;
}
const textOf = (n: ReactTestInstance | string): string => (typeof n === 'string' ? n : ` ${n.children.map(textOf).join('')} `);
const squash = (t: string) => t.replace(/\s+/g, ' ').trim();
const byData = (r: ReactTestRenderer, name: string) =>
  r.root.findAll((n) => typeof n.type === 'string' && n.props['data-ask'] === name).map((n) => squash(textOf(n)));

describe('W1c · the fixtures are what they claim', () => {
  it('REFUSED is refused-only; OUTAGE and MIXED are not', () => {
    expect(rightsRefusedOnly(REFUSED, 0)).toBe(true);
    expect(rightsRefusedOnly(OUTAGE, 0)).toBe(false);
    expect(rightsRefusedOnly(MIXED, 0)).toBe(false);
  });
  it('all three would read "limited" by evidence state alone (the old predicate)', () => {
    for (const ctx of [REFUSED, OUTAGE, MIXED]) expect(view(ctx, 'en').searchLimited).toBe(true);
  });
});

describe('W1c · a refused-only INSUFFICIENT turn: "Checked <when> · <chip>", in every locale', () => {
  it.each(LOCALES)('%s: the status line is freshness.checked with the not-searched chip, never the outage line', (locale) => {
    const v = view(REFUSED, locale);
    const chip = askRightsRefusalStrings(locale).chip;
    const [before] = s(locale).freshness.checked.split('{when}');
    expect(v.freshness.startsWith(before)).toBe(true);
    expect(v.freshness).toContain(` · ${chip}`);
    expect(v.freshness).not.toContain(limitedSuffix(locale));
    /* nothing was searched: never the zero-matches line */
    expect(v.freshness).not.toContain(s(locale).freshness.zero.split('{when}')[1].trim());
  });
  it('EN reads exactly "Checked 16 Oct 2026, 09:39 UTC · Not searched: sources not cleared" (+ the stated window)', () => {
    expect(view(REFUSED, 'en').freshness.startsWith('Checked 16 Oct 2026, 09:39 UTC · Not searched: sources not cleared')).toBe(true);
  });
  it.each(['en', 'de'] as const)('%s: the rendered turn carries no outage words anywhere', (locale) => {
    const r = renderTurn(payload(REFUSED), locale);
    const all = squash(textOf(r.root));
    const words = locale === 'en' ? /temporarily|unavailable|could not be reached|try again/i : /vorübergehend|zeitweise|nicht verfügbar|nicht erreichbar|erneut versuchen/i;
    expect(all).not.toMatch(words);
    expect(all).toContain(askRightsRefusalStrings(locale).chip);
  });
});

describe('W1c · the sweep: limitedNote on a refused-only non-INSUFFICIENT turn reads the notSearched sentence', () => {
  it.each(['en', 'de'] as const)('%s: search-limited shows notSearched, never limitedNote', (locale) => {
    const r = renderTurn(payload(REFUSED, 'REFERENCE_BACKGROUND'), locale);
    const lines = byData(r, 'search-limited');
    expect(lines).toEqual([askRightsRefusalStrings(locale).notSearched]);
    expect(squash(textOf(r.root))).not.toContain(s(locale).limitedNote);
  });
});

describe('W1c · controls: a genuine outage and a mixed refusal keep their copy byte-identical', () => {
  it.each(LOCALES)('%s: OUTAGE and MIXED keep freshness.limited', (locale) => {
    for (const ctx of [OUTAGE, MIXED]) {
      const v = view(ctx, locale);
      expect(v.freshness).toContain(limitedSuffix(locale));
      expect(v.freshness).not.toContain(askRightsRefusalStrings(locale).chip);
    }
  });
  it.each(['en', 'de'] as const)('%s: OUTAGE keeps limitedNote under a non-INSUFFICIENT answer', (locale) => {
    const r = renderTurn(payload(OUTAGE, 'REFERENCE_BACKGROUND'), locale);
    expect(byData(r, 'search-limited')).toEqual([s(locale).limitedNote]);
  });
});
