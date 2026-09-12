import {
  resolveFeedBadgeText,
  resolveFallbackTitle,
  resolveFallbackDescription,
} from './CountryPanel';
import type { CountryNewsResponse } from '@globalnews-ai/shared';

function makeResponse(overrides: Partial<CountryNewsResponse> = {}): CountryNewsResponse {
  return {
    countryCode: 'RWA',
    countryName: 'Rwanda',
    articles: [],
    totalResults: 0,
    providers: ['gnews'],
    dataMode: 'live',
    feedTier: 'live',
    providerDisplayName: 'GNews Free',
    generatedAt: new Date().toISOString(),
    ...overrides,
  } as CountryNewsResponse;
}

/**
 * Milestone #49 (World Map EN/PL integration) — pure resolver tests,
 * mirroring the established resolveTrustVisual()/
 * resolveRetrievalContextText() pattern already proven for the
 * search-page components.
 */
describe('CountryPanel resolvers (Milestone #49)', () => {
  describe('resolveFeedBadgeText — backward compatibility', () => {
    it('live badge is byte-identical to the original hardcoded text', () => {
      expect(
        resolveFeedBadgeText(makeResponse({ dataMode: 'live', feedTier: 'live', providerDisplayName: 'GNews Free' })),
      ).toBe('LIVE \u00b7 POWERED BY GNews Free');
    });

    it('delayed badge is byte-identical to the original', () => {
      expect(
        resolveFeedBadgeText(
          makeResponse({ dataMode: 'live', feedTier: 'delayed', providerDisplayName: 'GNews Free' }),
        ),
      ).toBe('DELAYED FEED \u00b7 POWERED BY GNews Free');
    });

    it('cached badge is byte-identical to the original', () => {
      expect(resolveFeedBadgeText(makeResponse({ dataMode: 'cached' }))).toBe('STORED REPORTING');
    });

    it('mock badge is byte-identical to the original', () => {
      expect(resolveFeedBadgeText(makeResponse({ dataMode: 'mock' }))).toBe('DEMO MODE \u00b7 SAMPLE CONTENT ONLY');
    });
  });

  describe('resolveFeedBadgeText — Polish', () => {
    it('live badge is localized, provider name unchanged', () => {
      const text = resolveFeedBadgeText(
        makeResponse({ dataMode: 'live', feedTier: 'live', providerDisplayName: 'GNews Free' }),
        'pl',
      );
      expect(text).toBe('NA ŻYWO \u00b7 OBSŁUGIWANE PRZEZ GNews Free');
      expect(text).toContain('GNews Free');
    });

    it('cached/mock badges are localized', () => {
      expect(resolveFeedBadgeText(makeResponse({ dataMode: 'cached' }), 'pl')).toBe('ZAPISANE RELACJE');
      expect(resolveFeedBadgeText(makeResponse({ dataMode: 'mock' }), 'pl')).toBe(
        'TRYB DEMO \u00b7 WYŁĄCZNIE TREŚĆ PRZYKŁADOWA',
      );
    });
  });

  describe('resolveFallbackTitle / resolveFallbackDescription', () => {
    it('returns null when dataMode is not cached, regardless of language', () => {
      expect(resolveFallbackTitle(makeResponse({ dataMode: 'live' }))).toBeNull();
      expect(resolveFallbackDescription(makeResponse({ dataMode: 'live' }), 'pl')).toBeNull();
    });

    it('English titles/descriptions are byte-identical to the original hardcoded text', () => {
      expect(resolveFallbackTitle(makeResponse({ dataMode: 'cached', fallbackReason: 'provider-error' }))).toBe(
        'Live provider unavailable',
      );
      expect(resolveFallbackTitle(makeResponse({ dataMode: 'cached', fallbackReason: 'no-live-results' }))).toBe(
        'No usable live results',
      );
      expect(resolveFallbackTitle(makeResponse({ dataMode: 'cached' }))).toBe('Stored reporting');
      expect(
        resolveFallbackDescription(makeResponse({ dataMode: 'cached', fallbackReason: 'provider-error' })),
      ).toBe('The live news provider could not be reached. Previously retrieved reporting is shown instead.');
    });

    it('Polish titles/descriptions are present and distinct from English', () => {
      const plTitle = resolveFallbackTitle(makeResponse({ dataMode: 'cached', fallbackReason: 'provider-error' }), 'pl');
      expect(plTitle).toBe('Dostawca na żywo niedostępny');
      const plDescription = resolveFallbackDescription(
        makeResponse({ dataMode: 'cached', fallbackReason: 'no-live-results' }),
        'pl',
      );
      expect(plDescription).toContain('zapisane relacje');
    });
  });

  describe('Milestone #49 Phase D — unavailable state badge', () => {
    it('English + live/provider state remains unaffected', () => {
      expect(
        resolveFeedBadgeText(makeResponse({ dataMode: 'live', feedTier: 'live', providerDisplayName: 'GNews Free' })),
      ).toBe('LIVE \u00b7 POWERED BY GNews Free');
    });

    it('Polish + live/provider state remains unaffected', () => {
      expect(
        resolveFeedBadgeText(
          makeResponse({ dataMode: 'live', feedTier: 'live', providerDisplayName: 'GNews Free' }),
          'pl',
        ),
      ).toBe('NA ŻYWO \u00b7 OBSŁUGIWANE PRZEZ GNews Free');
    });

    it('English + unavailable: localized label, never "POWERED BY UNAVAILABLE"', () => {
      const text = resolveFeedBadgeText(
        makeResponse({ dataMode: 'unavailable', feedTier: 'delayed', providerDisplayName: 'Unavailable' }),
      );
      expect(text).toBe('FEED CURRENTLY UNAVAILABLE');
      expect(text.toUpperCase()).not.toContain('POWERED BY UNAVAILABLE');
    });

    it('Polish + unavailable: localized label, never exposes internal state values', () => {
      const text = resolveFeedBadgeText(
        makeResponse({ dataMode: 'unavailable', feedTier: 'delayed', providerDisplayName: 'Unavailable' }),
        'pl',
      );
      expect(text).toBe('ŹRÓDŁO TYMCZASOWO NIEDOSTĘPNE');
      expect(text.toUpperCase()).not.toContain('UNAVAILABLE');
      expect(text).not.toContain('provider-error');
    });

    it('cached state remains correctly represented in both languages, unaffected by the unavailable-state fix', () => {
      expect(resolveFeedBadgeText(makeResponse({ dataMode: 'cached' }))).toBe('STORED REPORTING');
      expect(resolveFeedBadgeText(makeResponse({ dataMode: 'cached' }), 'pl')).toBe('ZAPISANE RELACJE');
    });

    it('mock state remains unaffected', () => {
      expect(resolveFeedBadgeText(makeResponse({ dataMode: 'mock' }))).toBe('DEMO MODE \u00b7 SAMPLE CONTENT ONLY');
    });
  });
});
