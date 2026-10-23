import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalysisApiResponse, AnalysisRetrievalContext } from '@globalnews-ai/shared';
import { fixture } from '@/components/analysis-frame/frameFixtures';
import { AskCompactResult } from './AskCompactResult';
import { resolveRetrievalContextText } from '@/components/search/RetrievalContextStatus';
import { rightsRefusedOnly } from '@/components/search/evidenceDisplay';
import { askRightsRefusalStrings } from '@/lib/ask/askRightsRefusal';

/*
  CTO R116 (#95) — "FE-first/BE-second is acceptable ONLY if the intermediate FE is independently tested
  to remain honest on current live BE 8ec (dormant until typed right)".

  These are the EXACT envelopes the live Alpha backend 8ec1f4a produces, recorded by Politics offline
  through the real AnalysisService (R96-F6-F8-SKIP-REASON/POLITICS-R115-LIVE-CONTROL-626cebf/raw/
  8ec1f4a-obs.json). On 8ec an all-refused turn carries NO typed right ('rights-not-cleared'): the two
  lanes are recorded as kind 'unavailable'. The F6–F8 frontend rule must therefore stay DORMANT on 8ec —
  it never says "not cleared" (a reason 8ec does not state), never claims a cleared source, and renders
  each 8ec tuple exactly as a genuine outage renders (today's live presentation; no new claim).
*/
const BE_8EC: Readonly<Record<string, Partial<AnalysisRetrievalContext>>> = {
  'live-tuple': {
    dataMode: 'unavailable',
    fallbackReason: 'provider-error',
    evidenceState: 'degraded-fallback',
    providers: [],
    providerFailures: [
      { providerId: 'gnews', kind: 'unavailable' },
      { providerId: 'gdelt-doc', kind: 'unavailable' },
    ] as never,
    articlesRetrieved: 0,
    countryName: 'DR Congo',
  },
  'control-outage': {
    dataMode: 'unavailable',
    fallbackReason: 'provider-error',
    evidenceState: 'degraded-fallback',
    providers: [],
    providerFailures: [] as never,
    articlesRetrieved: 0,
    countryName: 'DR Congo',
    retrievalTrace: {
      queryVariants: [], timeWindow: null, languages: ['en'], lanesAttempted: ['news-providers'], lanesSucceeded: [],
      lanesUnavailable: [{ lane: 'news-providers', reason: 'provider-error' }],
      candidatesSeen: 0, candidatesAdmitted: 0,
    } as never,
  },
  'control-mixed': {
    dataMode: 'live',
    fallbackReason: null as never,
    evidenceState: 'no-relevant-evidence',
    providers: ['rss-feeds'],
    providerFailures: [] as never,
    articlesRetrieved: 0,
    countryName: 'DR Congo',
  },
};
const response = (patch: Partial<AnalysisRetrievalContext>): AnalysisApiResponse => {
  const base = fixture({ articleCount: 0, analysisNull: true });
  return { ...base, retrievalContext: { ...base.retrievalContext, ...patch } };
};
const render = (patch: Partial<AnalysisRetrievalContext>, locale: 'en' | 'pl' | 'fr' | 'de' | 'es' | 'pt' | 'ar' = 'en') =>
  renderToStaticMarkup(
    createElement(AskCompactResult, {
      response: response(patch),
      question: 'What has changed in eastern DRC over the last 7 days?',
      context: undefined,
      language: 'en',
      locale,
    } as never),
  );
const LOCALES = ['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'] as const;

describe('CTO R116 — FE 2827cf3 is DORMANT on the live Alpha backend 8ec1f4a', () => {
  it.each(Object.keys(BE_8EC))('8ec %s: the rights-refused rule does not fire (8ec states no typed right)', (k) => {
    expect(rightsRefusedOnly(response(BE_8EC[k]!).retrievalContext, 0)).toBe(false);
  });

  it.each(LOCALES)('%s: the 8ec live tuple never says "not cleared" in any surface it renders', (locale) => {
    const s = askRightsRefusalStrings(locale);
    const html = render(BE_8EC['live-tuple']!, locale);
    expect(html).not.toContain(s.notSearched);
    expect(html).not.toContain(s.chip);
    const chip = resolveRetrievalContextText(response(BE_8EC['live-tuple']!).retrievalContext, 'en', 0, locale);
    expect(chip.label).not.toContain(s.chip);
  });

  it('the 8ec live tuple renders exactly as 8ec’s genuine outage does (today’s presentation, nothing new)', () => {
    /* the only differences between the two envelopes are where the failure is recorded, not what the
       reader is told: the same sentence and the same chip */
    const tuple = resolveRetrievalContextText(response(BE_8EC['live-tuple']!).retrievalContext, 'en', 0);
    const outage = resolveRetrievalContextText(response(BE_8EC['control-outage']!).retrievalContext, 'en', 0);
    expect(tuple.label).toBe(outage.label);
    expect(render(BE_8EC['live-tuple']!)).toMatch(/temporarily unavailable/i);
    expect(render(BE_8EC['control-outage']!)).toMatch(/temporarily unavailable/i);
  });

  it('no 8ec envelope is ever presented as a cleared or searched source', () => {
    for (const k of Object.keys(BE_8EC)) {
      const html = render(BE_8EC[k]!);
      expect(html).not.toMatch(/sources? (?:are |is )?cleared(?! for use)/i);
      expect(html).not.toMatch(/cleared source/i);
    }
  });
});

describe('… and becomes truthful only once the backend states the typed right (bc13149)', () => {
  it('the same live turn as bc13149 serialises it → "not cleared", never an outage', () => {
    const typed: Partial<AnalysisRetrievalContext> = {
      ...BE_8EC['live-tuple'],
      providerFailures: [
        { providerId: 'gnews', kind: 'rights-not-cleared' },
        { providerId: 'gdelt-doc', kind: 'rights-not-cleared' },
      ] as never,
    };
    expect(rightsRefusedOnly(response(typed).retrievalContext, 0)).toBe(true);
    const html = render(typed);
    expect(html).toContain(askRightsRefusalStrings('en').notSearched);
    expect(html).not.toMatch(/temporarily unavailable|try again/i);
  });
});
