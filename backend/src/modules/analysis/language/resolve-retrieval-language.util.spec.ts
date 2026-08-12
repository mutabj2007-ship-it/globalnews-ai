import {
  resolveRetrievalStrategy,
  KINYARWANDA_FALLBACK_LANGUAGE,
} from './resolve-retrieval-language.util';

describe('resolveRetrievalStrategy (Milestone #47)', () => {
  it('en -> native-search', () => {
    const strategy = resolveRetrievalStrategy('en');
    expect(strategy.kind).toBe('native-search');
    expect((strategy as { lang: string }).lang).toBe('en');
  });

  it('fr -> native-search', () => {
    expect(resolveRetrievalStrategy('fr').kind).toBe('native-search');
  });

  it('es -> native-search', () => {
    expect(resolveRetrievalStrategy('es').kind).toBe('native-search');
  });

  it('ar -> native-search', () => {
    expect(resolveRetrievalStrategy('ar').kind).toBe('native-search');
  });

  it('pl -> staged Top-Headlines-then-Search-fallback, primary pl, fallback en', () => {
    const strategy = resolveRetrievalStrategy('pl');
    expect(strategy.kind).toBe('staged-top-headlines-then-search-fallback');
    expect((strategy as { primaryLang: string }).primaryLang).toBe('pl');
    expect((strategy as { fallbackLang: string }).fallbackLang).toBe('en');
  });

  it('sw -> direct search fallback to en, with fallbackChoiceUnproven=false', () => {
    const strategy = resolveRetrievalStrategy('sw');
    expect(strategy.kind).toBe('direct-search-fallback');
    expect((strategy as { fallbackLang: string }).fallbackLang).toBe('en');
    expect((strategy as { fallbackChoiceUnproven: boolean }).fallbackChoiceUnproven).toBe(false);
  });

  it('rw -> direct search fallback to the configurable KINYARWANDA_FALLBACK_LANGUAGE, marked fallbackChoiceUnproven=true (no product claim of superiority)', () => {
    const strategy = resolveRetrievalStrategy('rw');
    expect(strategy.kind).toBe('direct-search-fallback');
    expect((strategy as { fallbackLang: string }).fallbackLang).toBe(KINYARWANDA_FALLBACK_LANGUAGE);
    expect((strategy as { fallbackChoiceUnproven: boolean }).fallbackChoiceUnproven).toBe(true);
  });

  it('every LanguageCode has a defined strategy (exhaustiveness)', () => {
    const languages: Array<Parameters<typeof resolveRetrievalStrategy>[0]> = [
      'en',
      'pl',
      'sw',
      'fr',
      'es',
      'ar',
      'rw',
    ];
    for (const language of languages) {
      expect(() => resolveRetrievalStrategy(language)).not.toThrow();
    }
  });

  it('is a pure, deterministic function', () => {
    expect(resolveRetrievalStrategy('pl')).toEqual(resolveRetrievalStrategy('pl'));
  });
});
