import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalysisApiResponse, AnalysisRetrievalContext } from '@globalnews-ai/shared';
import { fixture } from '@/components/analysis-frame/frameFixtures';
import { AskCompactResult } from '@/components/ask/AskCompactResult';
import { resolveRetrievalContextText } from './RetrievalContextStatus';
import { rightsRefusedOnly } from './evidenceDisplay';
import { askRightsRefusalStrings } from '@/lib/ask/askRightsRefusal';

/*
  WAVE 1b (P0, live Alpha FE 0e95cd0 + BE bc13149) — a rights refusal is never told as an outage in the
  status EXPLANATION line either. At 0e95cd0 RetrievalContextStatus swapped only the chip label on a
  refusal; the line under it was still chosen from dataMode 'unavailable' + fallbackReason
  'provider-error' alone: "The live news provider could not be reached, and no stored reporting was
  available for this question." — false (nothing was attempted: no source is cleared for the use).

  Rule (Main, Wave 1b): when rightsRefusedOnly is true, NO outage explanation line. The chip ("Not
  searched: sources not cleared · <place>") and the turn's notSearched sentence carry the meaning. No new
  strings. A genuine outage, or a refusal beside any non-rights reason, keeps its line exactly as now.

  REFUSED is the reader payload's retrievalContext captured offline at bc13149 through the real Ask
  executor (Politics P0 repro 3105990, scratchpad p0w1-20261016T093926Z, scenario "fresh"; warm, cache-hit
  and Home-warmed turns were byte-identical apart from the request instants).
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

/* control: a genuine outage after a permitted attempt (R-8) */
const OUTAGE: AnalysisRetrievalContext = {
  ...REFUSED,
  providerFailures: [{ providerId: 'gnews', kind: 'unavailable' }, { providerId: 'gdelt-doc', kind: 'timeout' }],
  retrievalTrace: { ...REFUSED.retrievalTrace, lanesUnavailable: [{ lane: 'gnews', reason: 'unavailable' }, { lane: 'gdelt-doc', reason: 'timeout' }] },
} as unknown as AnalysisRetrievalContext;

/* mixed: one lane refused for rights, the other a genuine outage — an outage is still in play */
const MIXED: AnalysisRetrievalContext = {
  ...REFUSED,
  providerFailures: [{ providerId: 'gnews', kind: 'rights-not-cleared' }, { providerId: 'gdelt-doc', kind: 'timeout' }],
  retrievalTrace: { ...REFUSED.retrievalTrace, lanesUnavailable: [{ lane: 'gnews', reason: 'rights-not-cleared' }, { lane: 'gdelt-doc', reason: 'timeout' }] },
} as unknown as AnalysisRetrievalContext;

const LOCALES = ['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'] as const;
const OUTAGE_WORDS = /could not be reached|temporarily unavailable|try again|Live data unavailable/i;

/* the explanation an outage context gets today, per locale — what a refusal must NOT show */
const outageLine = (locale: (typeof LOCALES)[number]) => resolveRetrievalContextText(OUTAGE, 'en', 0, locale).explanation;

const response = (ctx: AnalysisRetrievalContext): AnalysisApiResponse => {
  const base = fixture({ articleCount: 0, analysisNull: true });
  return { ...base, retrievalContext: ctx };
};
const render = (ctx: AnalysisRetrievalContext, locale: (typeof LOCALES)[number] = 'en') =>
  renderToStaticMarkup(
    createElement(AskCompactResult, {
      response: response(ctx), question: 'What has changed in eastern DRC over the last 7 days?', context: undefined, language: 'en', locale,
    } as never),
  );

describe('Wave 1b · the fixtures are what they claim', () => {
  it('REFUSED is refused-only; OUTAGE and MIXED are not', () => {
    expect(rightsRefusedOnly(REFUSED, 0)).toBe(true);
    expect(rightsRefusedOnly(OUTAGE, 0)).toBe(false);
    expect(rightsRefusedOnly(MIXED, 0)).toBe(false);
  });
});

describe('Wave 1b · a rights refusal shows no outage explanation line (the P0 repro rows)', () => {
  it('EN: no explanation line; the chip still names the refusal and the place', () => {
    const t = resolveRetrievalContextText(REFUSED, 'en', 0, 'en');
    expect(t.explanation).toBeUndefined();
    expect(t.label).toBe(`${askRightsRefusalStrings('en').chip} · DR Congo`);
  });
  it('EN (no reader locale, the legacy Search path): no explanation line either', () => {
    expect(resolveRetrievalContextText(REFUSED, 'en', 0).explanation).toBeUndefined();
  });
  it('the compact result markup carries no outage wording, and still says "not searched"', () => {
    const html = render(REFUSED);
    expect(html).not.toMatch(OUTAGE_WORDS);
    expect(html).toContain(askRightsRefusalStrings('en').notSearched);
  });
  it.each(LOCALES)('%s: no explanation line when refused, and the outage line is not in the markup', (locale) => {
    const t = resolveRetrievalContextText(REFUSED, 'en', 0, locale);
    expect(t.explanation).toBeUndefined();
    expect(t.label).toContain(askRightsRefusalStrings(locale).chip);
    const line = outageLine(locale);
    expect(line).toBeTruthy(); /* never vacuous: the outage line exists in this locale */
    expect(render(REFUSED, locale)).not.toContain(line as string);
  });
});

describe('Wave 1b · controls: an outage keeps its line exactly as now', () => {
  it('genuine outage: the explanation line is unchanged (EN, exact)', () => {
    expect(resolveRetrievalContextText(OUTAGE, 'en', 0, 'en').explanation).toBe(
      'The live news provider could not be reached, and no stored reporting was available for this question.',
    );
    expect(resolveRetrievalContextText(OUTAGE, 'en', 0, 'en').label).toMatch(/Live data unavailable/);
  });
  it('mixed refused + outage: the outage explanation line is unchanged (EN, exact)', () => {
    expect(resolveRetrievalContextText(MIXED, 'en', 0, 'en').explanation).toBe(
      'The live news provider could not be reached, and no stored reporting was available for this question.',
    );
  });
  it.each(LOCALES)('%s: outage and mixed keep the same (non-empty) explanation line', (locale) => {
    const lang = 'en' as const;
    const outage = resolveRetrievalContextText(OUTAGE, lang, 0, locale).explanation;
    expect(outage).toBeTruthy();
    expect(resolveRetrievalContextText(MIXED, lang, 0, locale).explanation).toBe(outage);
  });
});
