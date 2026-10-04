import { DISPLAY_LOCALES } from '@globalnews-ai/shared';
import {
  DISPLAY_LOCALE_COOKIE,
  DISPLAY_LOCALE_STORAGE_KEY,
  detectBrowserDisplayLocale,
  parseDisplayLocale,
  persistDisplayLocale,
  readCookieValue,
  readStoredDisplayLocale,
  reconcileDisplayLocale,
  reconcileStoredDisplayLocale,
  requestedDisplayLocaleOf,
} from './displayLocale';
import { LANGUAGE_COOKIE_NAME, persistLanguageSelection, resolveInitialLanguage } from './languages';

/**
 * T2 · the one display-locale selection + persistence authority.
 *
 * The measured P0 at base 266007c9: `LanguageSync`/`Hero` validated both stores against
 * ACTIVE_LANGUAGES (en|pl), so a stored French choice was rejected and a Polish browser wrote
 * 'pl' over it. These tests pin the replacement rule: an explicit stored choice always wins.
 */

type Store = Map<string, string>;

function installBrowser(opts: { cookie?: string; storage?: Record<string, string>; languages?: string[] }): {
  store: Store;
  jar: () => string;
} {
  const store: Store = new Map(Object.entries(opts.storage ?? {}));
  let cookie = opts.cookie ?? '';
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  };
  g.document = {
    get cookie() {
      return cookie;
    },
    set cookie(value: string) {
      const [pair] = value.split(';');
      const [name] = pair.split('=');
      const rest = cookie
        .split('; ')
        .filter((entry) => entry !== '' && !entry.startsWith(`${name}=`));
      cookie = [...rest, pair].join('; ');
    },
    documentElement: { lang: '' },
  };
  g.navigator = { language: opts.languages?.[0] ?? 'en-US', languages: opts.languages ?? ['en-US'] };
  return { store, jar: () => cookie };
}

function uninstallBrowser(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.window;
  delete g.document;
  delete g.navigator;
}

afterEach(uninstallBrowser);

describe('T2 · the stored value is validated against the SEVEN display locales', () => {
  it.each([...DISPLAY_LOCALES])('%s is a valid stored choice', (locale) => {
    expect(parseDisplayLocale(locale)).toBe(locale);
    expect(requestedDisplayLocaleOf(locale)).toBe(locale);
  });

  it.each(['sw', 'rw', 'uk', 'xx', '', '  ', 'EN', 'pl-PL'])('%p is not a display locale', (value) => {
    expect(parseDisplayLocale(value)).toBeUndefined();
    expect(requestedDisplayLocaleOf(value)).toBe('en');
  });

  it('the cookie name and storage key are unchanged (continuity for every stored preference)', () => {
    expect(DISPLAY_LOCALE_COOKIE).toBe('globalnews-ai-language');
    expect(LANGUAGE_COOKIE_NAME).toBe(DISPLAY_LOCALE_COOKIE);
    expect(DISPLAY_LOCALE_STORAGE_KEY).toBe('globalnews-ai:language');
  });

  it('reads one cookie out of a cookie header', () => {
    expect(readCookieValue('a=1; globalnews-ai-language=ar; b=2', DISPLAY_LOCALE_COOKIE)).toBe('ar');
    expect(readCookieValue('a=1', DISPLAY_LOCALE_COOKIE)).toBeUndefined();
  });
});

describe('T2 · reconciliation — an explicit stored choice ALWAYS wins over browser detection', () => {
  it.each(['fr', 'de', 'es', 'pt', 'ar'] as const)(
    'a stored %s cookie on a POLISH browser is never overwritten with pl (the measured P0)',
    (stored) => {
      const decision = reconcileDisplayLocale({ cookie: stored, storage: stored, browser: 'pl' });
      expect(decision).toEqual({ persist: undefined, refresh: false, reason: 'COOKIE_IS_THE_CHOICE' });
    },
  );

  it('a cookie disagreeing with the mirror repairs the MIRROR from the cookie, without a refresh', () => {
    expect(reconcileDisplayLocale({ cookie: 'ar', storage: 'pl', browser: 'pl' })).toEqual({
      persist: 'ar',
      refresh: false,
      reason: 'MIRROR_REPAIRED',
    });
  });

  it('a cleared cookie is restored from the localStorage mirror (fr), not from the browser (pl)', () => {
    expect(reconcileDisplayLocale({ cookie: undefined, storage: 'fr', browser: 'pl' })).toEqual({
      persist: 'fr',
      refresh: true,
      reason: 'RESTORED_FROM_STORAGE',
    });
  });

  it('a stored English mirror restores the cookie without a refresh (the server already rendered en)', () => {
    expect(reconcileDisplayLocale({ cookie: null, storage: 'en', browser: 'ar' })).toEqual({
      persist: 'en',
      refresh: false,
      reason: 'RESTORED_FROM_STORAGE',
    });
  });

  it('only when NOTHING valid is stored does browser detection run — over all seven', () => {
    expect(reconcileDisplayLocale({ cookie: 'sw', storage: 'garbage', browser: 'de' })).toEqual({
      persist: 'de',
      refresh: true,
      reason: 'BROWSER_DETECTED',
    });
    expect(reconcileDisplayLocale({ cookie: undefined, storage: null, browser: 'en' })).toEqual({
      persist: undefined,
      refresh: false,
      reason: 'NOTHING_STORED_ENGLISH',
    });
  });

  it('browser detection reads navigator.languages in order and only display locales', () => {
    expect(detectBrowserDisplayLocale({ languages: ['sw-KE', 'pt-BR', 'en'] })).toBe('pt');
    expect(detectBrowserDisplayLocale({ language: 'ar-EG' })).toBe('ar');
    expect(detectBrowserDisplayLocale({ languages: ['rw', 'sw'] })).toBe('en');
    expect(detectBrowserDisplayLocale(undefined)).toBe('en');
  });
});

describe('T2 · persistence — one writer, both stores, survives refresh and navigation', () => {
  it('persistDisplayLocale writes the cookie (path=/, 1 year) and the mirror', () => {
    const { store, jar } = installBrowser({});
    persistDisplayLocale('ar');
    expect(store.get(DISPLAY_LOCALE_STORAGE_KEY)).toBe('ar');
    expect(jar()).toContain('globalnews-ai-language=ar');
    expect(readStoredDisplayLocale()).toBe('ar');
  });

  it('the historical persistLanguageSelection alias accepts every display locale and ignores sw/rw', () => {
    const { store } = installBrowser({});
    persistLanguageSelection('de');
    expect(store.get(DISPLAY_LOCALE_STORAGE_KEY)).toBe('de');
    persistLanguageSelection('sw');
    expect(store.get(DISPLAY_LOCALE_STORAGE_KEY)).toBe('de');
  });

  it('end to end on a Polish browser: choose fr once, reconcile on every later page — fr stays', () => {
    const { store, jar } = installBrowser({ languages: ['pl-PL'] });
    persistLanguageSelection('fr');
    for (let page = 0; page < 5; page += 1) {
      expect(reconcileStoredDisplayLocale()).toBe(false);
    }
    expect(store.get(DISPLAY_LOCALE_STORAGE_KEY)).toBe('fr');
    expect(jar()).toContain('globalnews-ai-language=fr');
  });

  it('a cleared cookie on a Polish browser comes back as the stored ar, with one refresh', () => {
    const { jar } = installBrowser({ storage: { [DISPLAY_LOCALE_STORAGE_KEY]: 'ar' }, languages: ['pl'] });
    expect(reconcileStoredDisplayLocale()).toBe(true);
    expect(jar()).toContain('globalnews-ai-language=ar');
    expect(reconcileStoredDisplayLocale()).toBe(false);
  });

  it('resolveInitialLanguage returns the document EFFECTIVE language, never the stored preference', () => {
    installBrowser({ cookie: 'globalnews-ai-language=fr' });
    (globalThis as unknown as { document: { documentElement: { lang: string } } }).document.documentElement.lang = 'en';
    expect(resolveInitialLanguage()).toBe('en');
    (globalThis as unknown as { document: { documentElement: { lang: string } } }).document.documentElement.lang = 'pl';
    expect(resolveInitialLanguage()).toBe('pl');
  });
});
