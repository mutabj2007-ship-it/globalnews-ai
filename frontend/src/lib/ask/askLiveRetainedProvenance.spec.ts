import type { AskAnswerState, AskR2Payload } from '@/lib/api/askV2Api';
import { askR2Strings } from './askR2Strings';
import { askR2View } from './askR2View';

/**
 * PUBLIC BETA HARDENING R1C — LIVE VS RETAINED PROVENANCE COPY.
 *
 * Production 2026-10-01: "Any global news can you share?" was answered from LIVE GNews headlines
 * (Railway: path=BROAD_GLOBAL_HEADLINES live=[gnews] failed=[] retained=not-used coverage=LIVE),
 * yet the card said "Retained reporting to 1 Oct 2026, 06:33 UTC · 8 sources": every
 * CURRENT_REPORTING answer used the retained wording whatever its retrieval basis. The wording
 * now follows the basis the server stated; nothing else in the view changes.
 */

const GENERATED = '2026-10-01T06:40:00Z';
const NEWEST_PUBLISHED = '2026-10-01T06:33:00Z';

function payload(
  state: AskAnswerState,
  retrievalContext: Record<string, unknown> | null,
  articles = 3,
): AskR2Payload {
  return {
    schema: 'ask-r2-result/1',
    route: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      scopedBy: 'CLASSIFIED_SHAPE',
      refusals: [],
      disclosures: [],
      clarification: [],
      normalization: 'QUALIFIED',
      questionLanguage: 'en',
    },
    chips: { kind: 'NONE' },
    answer: { state, basis: 'x', missingRoles: [] },
    checkedAt: GENERATED,
    aiExecuted: articles > 0,
    modelPriorCitable: false,
    analysis:
      retrievalContext === null
        ? null
        : ({
            analysis: articles > 0 ? { generatedAt: GENERATED } : null,
            articles: Array.from({ length: articles }, (_, i) => ({ id: `a${i}` })),
            retrievalContext: { newestArticlePublishedAt: NEWEST_PUBLISHED, ...retrievalContext },
          } as never),
  } as AskR2Payload;
}

/* The retrieval contexts the backend actually produces (R1B broad headlines and the generic paths). */
const LIVE = {
  dataMode: 'live',
  providers: ['gnews'],
  articlesRetrieved: 9,
  retrievalTrace: {
    queryVariants: ['top-headlines'],
    timeWindow: null,
    languages: ['en'],
    lanesAttempted: ['gnews'],
    lanesSucceeded: ['gnews'],
    lanesUnavailable: [],
    candidatesSeen: 9,
    candidatesAdmitted: 9,
    independentClusters: 9,
  },
};
const LIVE_LIMITED = {
  dataMode: 'live',
  providers: ['rss-feeds'],
  fallbackReason: 'provider-error',
  articlesRetrieved: 2,
};
const RETAINED = {
  dataMode: 'cached',
  providers: ['rss-feeds'],
  fallbackReason: 'provider-error',
  outcome: 'RETAINED_ONLY',
  articlesRetrieved: 2,
};

const EN = askR2Strings('en');
const PL = askR2Strings('pl');
const view = (p: AskR2Payload, locale: 'en' | 'pl' = 'en') =>
  askR2View(p, locale === 'en' ? EN : PL, locale);

describe('PUBLIC BETA HARDENING R1C — CURRENT_REPORTING provenance follows the retrieval basis', () => {
  it('A · live current reporting says when it was CHECKED — never "Retained reporting" (EN / PL)', () => {
    const en = view(payload('CURRENT_REPORTING', LIVE));
    expect(en.freshness).toBe('Checked 1 Oct 2026, 06:40 UTC · 3 sources');
    expect(en.freshness).not.toMatch(/Retained/);
    expect(en.searchLimited).toBe(false);
    const pl = view(payload('CURRENT_REPORTING', LIVE), 'pl');
    expect(pl.freshness).toBe('Sprawdzono 1 paź 2026, 06:40 UTC · 3 źródła');
    expect(pl.freshness).not.toMatch(/^Doniesienia do/);
  });

  it('B · retained / cached evidence keeps the retained wording, dated by the newest publication (EN / PL)', () => {
    const en = view(payload('CURRENT_REPORTING', RETAINED));
    expect(en.freshness).toBe('Retained reporting to 1 Oct 2026, 06:33 UTC · 3 sources');
    expect(view(payload('CURRENT_REPORTING', RETAINED), 'pl').freshness).toBe(
      'Doniesienia do 1 paź 2026, 06:33 UTC · 3 źródła',
    );
    /* either typed signal alone is enough */
    expect(
      view(payload('CURRENT_REPORTING', { dataMode: 'cached' })).freshness.startsWith(
        'Retained reporting to',
      ),
    ).toBe(true);
    expect(
      view(
        payload('CURRENT_REPORTING', { dataMode: 'live', outcome: 'RETAINED_ONLY' }),
      ).freshness.startsWith('Retained reporting to'),
    ).toBe(true);
    /* without a newest publication time it falls back to the check time, as before */
    const undated = payload('CURRENT_REPORTING', RETAINED);
    (
      undated.analysis as unknown as { retrievalContext: Record<string, unknown> }
    ).retrievalContext.newestArticlePublishedAt = undefined;
    expect(view(undated).freshness).toBe('Retained reporting to 1 Oct 2026, 06:40 UTC · 3 sources');
  });

  it('C · live evidence with a degraded provider is not mislabelled retained; the limited disclosure stays', () => {
    const v = view(payload('CURRENT_REPORTING', LIVE_LIMITED));
    expect(v.freshness).toBe('Checked 1 Oct 2026, 06:40 UTC · 3 sources');
    expect(v.freshness).not.toMatch(/Retained/);
    expect(v.searchLimited).toBe(true);
    expect(view(payload('CURRENT_REPORTING', LIVE_LIMITED), 'pl').freshness).toBe(
      'Sprawdzono 1 paź 2026, 06:40 UTC · 3 źródła',
    );
  });

  it('I · the R1B broad-headlines LIVE result displays checked provenance', () => {
    const v = view(payload('CURRENT_REPORTING', LIVE, 9));
    expect(v.freshness).toBe('Checked 1 Oct 2026, 06:40 UTC · 9 sources');
    expect(v.searchLimited).toBe(false);
  });
});

describe('PUBLIC BETA HARDENING R1C — every other state is unchanged', () => {
  it('D · INSUFFICIENT after a provider refusal keeps its limited wording', () => {
    const v = view(
      payload(
        'INSUFFICIENT',
        { dataMode: 'live', fallbackReason: 'provider-error', outcome: 'PROVIDER_RATE_LIMITED' },
        0,
      ),
    );
    expect(v.freshness).toBe(
      'Checked 1 Oct 2026, 06:40 UTC · a news source was temporarily unavailable, so this was not a complete search',
    );
    expect(v.searchLimited).toBe(true);
  });

  it('E · REFERENCE_BACKGROUND (model-only) keeps its "not checked" wording', () => {
    expect(view(payload('REFERENCE_BACKGROUND', null, 0)).freshness).toBe(
      'Stable general knowledge · not checked against current sources',
    );
  });

  it('F · RETAINED_RECORD keeps its own wording', () => {
    expect(view(payload('RETAINED_RECORD', null, 0)).freshness).toBe(
      'Retained record · not current · no AI used',
    );
  });

  it('G · COMPUTED_RESULT keeps its own wording', () => {
    expect(view(payload('COMPUTED_RESULT', null, 0)).freshness).toBe(
      'Calculated deterministically from the values in your question · no sources needed · no AI used',
    );
  });

  it('CURRENTLY_VERIFIED keeps the checked wording; a corroborated PARTIAL keeps its as-of wording', () => {
    expect(view(payload('CURRENTLY_VERIFIED', LIVE)).freshness).toBe(
      'Checked 1 Oct 2026, 06:40 UTC · 3 sources',
    );
    const partial = {
      ...payload('PARTIAL', LIVE),
      verification: { asOf: NEWEST_PUBLISHED, reports: 2 },
    } as unknown as AskR2Payload;
    expect(view(partial).freshness).toBe(
      'As of 1 Oct 2026, 06:33 UTC · 2 independent reports agree',
    );
  });
});
