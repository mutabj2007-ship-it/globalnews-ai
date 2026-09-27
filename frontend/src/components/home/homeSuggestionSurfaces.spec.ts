import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HOME_SUGGESTIONS, type AnalysisApiResponse } from '@globalnews-ai/shared';
import { HomeSideRail } from './HomeSideRail';
import { AskCompactResult } from '../ask/AskCompactResult';
import { fixture } from '../analysis-frame/frameFixtures';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * LANE E — ONE SUGGESTION AUTHORITY, AND TWO FAILURE STATES THAT READ APART.
 */

describe('the Home suggestion authority', () => {
  it.each(['en', 'pl'] as const)('%s: the dictionary IS the canonical shared list', (language) => {
    expect(getDictionary(language).hero.exampleQuestions).toEqual([...HOME_SUGGESTIONS[language]]);
  });

  it.each(['en', 'pl'] as const)('%s: the side rail renders the first three canonical suggestions', (language) => {
    const html = renderToStaticMarkup(createElement(HomeSideRail as never, { language } as never));
    for (const prompt of HOME_SUGGESTIONS[language].slice(0, 3)) {
      expect(html).toContain(prompt.replace(/'/g, '&#x27;'));
    }
  });

  it('no removed ambiguous suggestion survives anywhere in the copy', () => {
    for (const language of ['en', 'pl'] as const) {
      const text = JSON.stringify(getDictionary(language));
      expect(text).not.toMatch(/central bank announcement|ogłoszenie banku centralnego|election polling this week/i);
    }
  });
});

describe('failure states read apart (backend distinction preserved)', () => {
  const noAnswer = (evidenceState: 'degraded-fallback' | 'no-relevant-evidence'): AnalysisApiResponse => {
    const base = fixture({ analysisNull: true }) as AnalysisApiResponse;
    return {
      ...base,
      articles: [],
      retrievalContext: {
        ...base.retrievalContext,
        evidenceState,
        dataMode: evidenceState === 'degraded-fallback' ? 'unavailable' : 'live',
        ...(evidenceState === 'degraded-fallback' ? { fallbackReason: 'provider-error' } : {}),
        articlesRetrieved: 0,
      },
    } as AnalysisApiResponse;
  };
  const render = (response: AnalysisApiResponse, language: 'en' | 'pl') =>
    renderToStaticMarkup(
      createElement(AskCompactResult as never, { response, question: 'q', language, context: undefined } as never),
    );

  it.each([
    ['en', 'Live reporting is temporarily unavailable. Please try again in a moment.', 'No relevant reporting found for this question. Try naming the place, organisation or event.'],
    ['pl', 'Bieżące doniesienia są chwilowo niedostępne. Spróbuj ponownie za chwilę.', 'Nie znaleziono doniesień pasujących do tego pytania. Spróbuj podać miejsce, instytucję lub wydarzenie.'],
  ] as const)('%s', (language, providerCopy, evidenceCopy) => {
    const unavailable = render(noAnswer('degraded-fallback'), language);
    const nothing = render(noAnswer('no-relevant-evidence'), language);
    expect(unavailable).toContain(providerCopy);
    expect(unavailable).not.toContain(evidenceCopy);
    expect(nothing).toContain(evidenceCopy);
    expect(nothing).not.toContain(providerCopy);
    /* "Live data unavailable" is reserved for the provider state. */
    const liveDataUnavailable = getDictionary(language).retrievalContextStatus.liveDataUnavailable;
    expect(nothing).not.toContain(liveDataUnavailable);
  });
});
