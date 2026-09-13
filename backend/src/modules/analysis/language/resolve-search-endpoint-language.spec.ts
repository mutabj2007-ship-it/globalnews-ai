import {
  resolveSearchEndpointLanguage,
  resolveRetrievalStrategy,
} from './resolve-retrieval-language.util';

/**
 * R4 POLISH LIVE 400 — P3, unit level.
 *
 * The invariant: a language GNews /search does not support must never be
 * handed to it. Verified against the current official documentation — /search
 * lists 26 languages and pl is not among them; /top-headlines lists ~41 and pl
 * is.
 */
describe('resolveSearchEndpointLanguage — PL5 at the source', () => {
  it('never returns pl — the whole point', () => {
    expect(resolveSearchEndpointLanguage('pl')).not.toBe('pl');
  });

  it('returns the strategy’s OWN declared fallback for pl, not an invented default', () => {
    const strategy = resolveRetrievalStrategy('pl');
    expect(strategy.kind).toBe('staged-top-headlines-then-search-fallback');
    if (strategy.kind === 'staged-top-headlines-then-search-fallback') {
      expect(resolveSearchEndpointLanguage('pl')).toBe(strategy.fallbackLang);
    }
  });

  it('leaves a natively supported Search language exactly as it is', () => {
    for (const lang of ['en', 'fr', 'es', 'ar'] as const) {
      expect(resolveSearchEndpointLanguage(lang)).toBe(lang);
    }
  });

  it('imposes no language when none was requested — every pre-existing caller is unaffected', () => {
    expect(resolveSearchEndpointLanguage(undefined)).toBeUndefined();
  });

  it('sw and rw also resolve to their declared Search fallback rather than being sent through', () => {
    expect(resolveSearchEndpointLanguage('sw')).toBe('en');
    expect(resolveSearchEndpointLanguage('rw')).toBe(
      (resolveRetrievalStrategy('rw') as { fallbackLang: string }).fallbackLang,
    );
  });

  it('an unrecognised value imposes no language and does NOT throw', () => {
    // resolveRetrievalStrategy() throws on an unknown code by design. A stray
    // query parameter must not become a 500, so this guards before calling it.
    expect(() => resolveSearchEndpointLanguage('klingon')).not.toThrow();
    expect(resolveSearchEndpointLanguage('klingon')).toBeUndefined();
    expect(resolveSearchEndpointLanguage('')).toBeUndefined();
  });

  it('is case- and whitespace-tolerant, because query parameters are', () => {
    expect(resolveSearchEndpointLanguage(' PL ')).toBe('en');
    expect(resolveSearchEndpointLanguage('EN')).toBe('en');
  });
});
