import { resolveRetrievalContextText } from './RetrievalContextStatus';
import type { AnalysisRetrievalContext } from '@globalnews-ai/shared';

function makeContext(overrides: Partial<AnalysisRetrievalContext> = {}): AnalysisRetrievalContext {
  return {
    dataMode: 'live',
    ...overrides,
  } as AnalysisRetrievalContext;
}

describe('resolveRetrievalContextText (Milestone #47 — retrieval context localization)', () => {
  describe('backward compatibility (default/explicit en)', () => {
    it('live: default (no language) matches original English exactly', () => {
      const text = resolveRetrievalContextText(makeContext({ dataMode: 'live' }));
      expect(text.label).toBe('Live reporting');
    });

    it('unavailable: default matches original English exactly', () => {
      const text = resolveRetrievalContextText(makeContext({ dataMode: 'unavailable' }));
      expect(text.label).toBe('Live data unavailable');
    });

    it('cached: default matches original English exactly', () => {
      const text = resolveRetrievalContextText(makeContext({ dataMode: 'cached' }));
      expect(text.label).toBe('Stored reporting');
    });

    it('mock: default matches original English exactly', () => {
      const text = resolveRetrievalContextText(makeContext({ dataMode: 'mock' }));
      expect(text.label).toBe('Demo reporting');
    });

    it('explicit "en" produces identical output to the default', () => {
      const ctx = makeContext({ dataMode: 'cached', fallbackReason: 'provider-error' });
      expect(resolveRetrievalContextText(ctx, 'en')).toEqual(resolveRetrievalContextText(ctx));
    });

    it('cached + provider-error explanation matches original English exactly', () => {
      const text = resolveRetrievalContextText(
        makeContext({ dataMode: 'cached', fallbackReason: 'provider-error' }),
      );
      expect(text.explanation).toBe('Live reporting was unavailable, so this analysis uses stored reporting.');
    });

    it('cached + no-live-results explanation matches original English exactly', () => {
      const text = resolveRetrievalContextText(
        makeContext({ dataMode: 'cached', fallbackReason: 'no-live-results' }),
      );
      expect(text.explanation).toBe('The live provider returned no usable results, so stored reporting was used.');
    });

    it('unavailable + provider-error explanation matches original English exactly', () => {
      const text = resolveRetrievalContextText(
        makeContext({ dataMode: 'unavailable', fallbackReason: 'provider-error' }),
      );
      expect(text.explanation).toBe(
        'The live news provider could not be reached, and no stored reporting was available for this question.',
      );
    });

    it('unavailable + other fallback reason explanation matches original English exactly', () => {
      const text = resolveRetrievalContextText(makeContext({ dataMode: 'unavailable' }));
      expect(text.explanation).toBe(
        'Live retrieval found nothing usable, and no stored reporting was available for this question.',
      );
    });

    it('freshness line matches original English "Newest stored article:" prefix', () => {
      const text = resolveRetrievalContextText(
        makeContext({ newestArticlePublishedAt: new Date().toISOString() }),
      );
      expect(text.freshnessLine).toMatch(/^Newest stored article: /);
    });

    it('geographic correction line matches original English "Interpreted ... as ..." phrasing', () => {
      const text = resolveRetrievalContextText(
        makeContext({ matchedFrom: 'kigali', canonicalLocation: 'kigali' }),
      );
      expect(text.correctionLine).toBe('Interpreted "Kigali" as Kigali');
    });
  });

  describe('Polish localization', () => {
    it('live label is localized', () => {
      const text = resolveRetrievalContextText(makeContext({ dataMode: 'live' }), 'pl');
      expect(text.label).toBe('Relacje na żywo');
    });

    it('cached label is localized', () => {
      const text = resolveRetrievalContextText(makeContext({ dataMode: 'cached' }), 'pl');
      expect(text.label).toBe('Relacje z pamięci');
    });

    it('unavailable label is localized', () => {
      const text = resolveRetrievalContextText(makeContext({ dataMode: 'unavailable' }), 'pl');
      expect(text.label).toBe('Dane na żywo niedostępne');
    });

    it('mock label is localized', () => {
      const text = resolveRetrievalContextText(makeContext({ dataMode: 'mock' }), 'pl');
      expect(text.label).toBe('Relacje demonstracyjne');
    });

    it('cached + provider-error explanation is localized', () => {
      const text = resolveRetrievalContextText(
        makeContext({ dataMode: 'cached', fallbackReason: 'provider-error' }),
        'pl',
      );
      expect(text.explanation).toContain('Relacje na żywo były niedostępne');
    });

    it('unavailable explanation is localized', () => {
      const text = resolveRetrievalContextText(makeContext({ dataMode: 'unavailable' }), 'pl');
      expect(text.explanation).toContain('nie znalazło niczego użytecznego');
    });

    it('freshness line label is localized while the relative-time value itself is also Polish', () => {
      const text = resolveRetrievalContextText(
        makeContext({ newestArticlePublishedAt: new Date().toISOString() }),
        'pl',
      );
      expect(text.freshnessLine).toContain('Najnowszy zapisany artykuł:');
      expect(text.freshnessLine).toContain('przed chwilą');
    });

    it('geographic correction sentence is localized, but the place names themselves are NOT translated', () => {
      const text = resolveRetrievalContextText(
        makeContext({ matchedFrom: 'kigali', canonicalLocation: 'kigali' }),
        'pl',
      );
      expect(text.correctionLine).toBe('Zinterpretowano "Kigali" jako Kigali');
    });
  });

  describe('location label composition (unaffected by language, geo data is never translated)', () => {
    it('city + country composes "City, Country" identically in both languages', () => {
      const ctx = makeContext({ dataMode: 'live', city: 'kigali', countryName: 'Rwanda' });
      expect(resolveRetrievalContextText(ctx, 'en').label).toBe('Live reporting \u00b7 Kigali, Rwanda');
      expect(resolveRetrievalContextText(ctx, 'pl').label).toBe('Relacje na żywo \u00b7 Kigali, Rwanda');
    });

    it('country name is never translated by this function in either language', () => {
      const ctx = makeContext({ dataMode: 'live', countryName: 'Rwanda' });
      expect(resolveRetrievalContextText(ctx, 'pl').label).toContain('Rwanda');
    });
  });
});
