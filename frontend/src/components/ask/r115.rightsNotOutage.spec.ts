import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalysisApiResponse, AnalysisRetrievalContext } from '@globalnews-ai/shared';
import { fixture } from '@/components/analysis-frame/frameFixtures';
import { AskCompactResult } from './AskCompactResult';
import { resolveRetrievalContextText } from '@/components/search/RetrievalContextStatus';
import { rightsRefusedOnly } from '@/components/search/evidenceDisplay';
import { askRightsRefusalStrings } from '@/lib/ask/askRightsRefusal';

/*
  CTO R115 + Politics R115 live control (G-1): the live Alpha 8ec1f4a turn "What has changed in eastern
  DRC over the last 7 days?" — COD, 168 h window, gnews + gdelt-doc rights-skip BEFORE network — showed
  "Live data unavailable · DR Congo" and "Live reporting is temporarily unavailable. Please try again in
  a moment." even with the F6–F8 backend bc13149, because that backend keeps dataMode 'unavailable' /
  fallback 'provider-error' for an all-refused turn. The reader must be told the truth instead.
*/
const REFUSED = [
  { providerId: 'gnews', kind: 'rights-not-cleared' },
  { providerId: 'gdelt-doc', kind: 'rights-not-cleared' },
];
/* the live tuple as bc13149 serialises it (Politics' offline reproduction) */
const LIVE_TUPLE: Partial<AnalysisRetrievalContext> = {
  dataMode: 'unavailable',
  fallbackReason: 'provider-error',
  evidenceState: 'degraded-fallback',
  providers: [],
  providerFailures: REFUSED as never,
  articlesRetrieved: 0,
  countryName: 'DR Congo',
  retrievalTrace: {
    queryVariants: [], timeWindow: null, languages: ['en'], lanesAttempted: ['gnews', 'gdelt-doc'], lanesSucceeded: [],
    lanesUnavailable: [{ lane: 'gnews', reason: 'rights-not-cleared' }, { lane: 'gdelt-doc', reason: 'rights-not-cleared' }],
    candidatesSeen: 0, candidatesAdmitted: 0,
  } as never,
};
/* R-8 control: a genuine outage after a permitted network attempt */
const OUTAGE: Partial<AnalysisRetrievalContext> = {
  ...LIVE_TUPLE,
  providerFailures: [{ providerId: 'gnews', kind: 'unavailable' }, { providerId: 'gdelt-doc', kind: 'timeout' }] as never,
  retrievalTrace: { ...(LIVE_TUPLE.retrievalTrace as object), lanesUnavailable: [{ lane: 'gnews', reason: 'unavailable' }, { lane: 'gdelt-doc', reason: 'timeout' }] } as never,
};
const response = (patch: Partial<AnalysisRetrievalContext>): AnalysisApiResponse => {
  const base = fixture({ articleCount: 0, analysisNull: true });
  return { ...base, retrievalContext: { ...base.retrievalContext, ...patch } };
};
const render = (patch: Partial<AnalysisRetrievalContext>, locale?: 'en' | 'pl' | 'fr' | 'de' | 'es' | 'pt' | 'ar') =>
  renderToStaticMarkup(createElement(AskCompactResult, { response: response(patch), question: 'What has changed in eastern DRC over the last 7 days?', context: undefined, language: 'en', ...(locale ? { locale } : {}) } as never));

describe('rightsRefusedOnly', () => {
  it('the live tuple is refused-only', () => {
    expect(rightsRefusedOnly(response(LIVE_TUPLE).retrievalContext, 0)).toBe(true);
  });
  it('a genuine outage is not (R-8)', () => {
    expect(rightsRefusedOnly(response(OUTAGE).retrievalContext, 0)).toBe(false);
  });
  it('one refused lane + one outage lane is not', () => {
    expect(rightsRefusedOnly(response({ ...LIVE_TUPLE, providerFailures: [REFUSED[0], { providerId: 'gdelt-doc', kind: 'timeout' }] as never, retrievalTrace: undefined }).retrievalContext, 0)).toBe(false);
  });
  it('a lane that answered makes it not refused-only', () => {
    expect(rightsRefusedOnly(response({ ...LIVE_TUPLE, providers: ['rss-feeds'], retrievalTrace: { ...(LIVE_TUPLE.retrievalTrace as object), lanesSucceeded: ['rss-feeds'] } as never }).retrievalContext, 0)).toBe(false);
  });
  it('an admitted article makes it not refused-only', () => {
    expect(rightsRefusedOnly(response(LIVE_TUPLE).retrievalContext, 1)).toBe(false);
  });
});

describe('the live tuple renders the truth, never an outage', () => {
  it('EN: the CTO sentence; no "temporarily unavailable", no "try again"', () => {
    const html = render(LIVE_TUPLE);
    expect(html).toContain(askRightsRefusalStrings('en').notSearched);
    expect(html).not.toContain('Live reporting is temporarily unavailable');
    expect(html).not.toMatch(/temporarily unavailable|try again/i);
  });
  it.each(['pl', 'fr', 'de', 'es', 'pt', 'ar'] as const)('%s: the localised sentence', (locale) => {
    expect(render(LIVE_TUPLE, locale)).toContain(askRightsRefusalStrings(locale).notSearched);
  });
  it('the status chip says "Not searched: sources not cleared", never "Live data unavailable"', () => {
    const t = resolveRetrievalContextText(response(LIVE_TUPLE).retrievalContext, 'en', 0);
    expect(t.label).toContain(askRightsRefusalStrings('en').chip);
    expect(t.label).not.toMatch(/Live data unavailable/i);
  });
  it('R-8 control: a genuine outage keeps the outage wording', () => {
    expect(render(OUTAGE)).toMatch(/temporarily unavailable/i);
    expect(resolveRetrievalContextText(response(OUTAGE).retrievalContext, 'en', 0).label).toMatch(/Live data unavailable/i);
  });
  it('no source, publisher or count is named in the refusal sentence (W-2)', () => {
    for (const loc of ['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'] as const) {
      expect(askRightsRefusalStrings(loc).notSearched).not.toMatch(/gnews|gdelt|reuters|\d/i);
    }
  });
});
