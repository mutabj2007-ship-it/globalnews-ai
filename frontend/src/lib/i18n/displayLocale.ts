import {
  DISPLAY_LOCALES,
  directionFor,
  isDisplayLocale,
  type DisplayLocale,
  type TextDirection,
} from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * T2 · THE ONE DISPLAY-LOCALE SELECTION AND PERSISTENCE AUTHORITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Every selector writes through `persistDisplayLocale`; every route reads the stored choice
 * through `parseDisplayLocale` (server: `displayLocale.server.ts`), and the client-side
 * reconciliation (`LanguageSync`, `Hero`) reads it through `reconcileStoredDisplayLocale`.
 * There is no second validator: the stored value is checked against the shared contract's
 * `DISPLAY_LOCALES` — the seven the selector offers — and NEVER against `ACTIVE_LANGUAGES`
 * (the retrieval/source set, which cannot even express `de`/`pt`).
 *
 * ── THE DEFECT THIS RETIRES (measured at base 266007c9) ──────────────────
 *
 * `readLanguageCookie()` and `resolveInitialLanguage()` validated the stored value with
 * `isActiveLanguageCode` (en|pl). A reader who chose Français had `fr` in both stores, both
 * readers rejected it, `resolveInitialLanguage` fell through to browser detection, and on a
 * Polish browser `LanguageSync`/`Hero` then persisted `pl` over the reader's explicit choice.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────
 *
 *   1. An explicit stored choice ALWAYS wins. The cookie is the primary store (it is the only
 *      one a Server Component can read); localStorage is the long-lived mirror that restores
 *      the cookie when the cookie alone was cleared.
 *   2. Browser detection runs only when NOTHING valid is stored, and it detects any of the
 *      seven display locales (a French browser asks for French; whether a surface can render
 *      it is the effective-locale rule's question, answered and disclosed per surface).
 *   3. The requested locale is what is persisted — never the effective (rendered) one. A
 *      reader served English because a catalogue is incomplete has not changed their mind
 *      (`persistedPreferenceOf` in the shared contract).
 *
 * The cookie name and the localStorage key are UNCHANGED so no stored preference is lost.
 */

/** The cookie a Server Component reads. Unchanged since Milestone #47 — continuity. */
export const DISPLAY_LOCALE_COOKIE = 'globalnews-ai-language';

/** The localStorage mirror. Unchanged since Milestone #47 — continuity. */
export const DISPLAY_LOCALE_STORAGE_KEY = 'globalnews-ai:language';

/** The locale every surface can always render. The source language of every catalogue. */
export const SOURCE_DISPLAY_LOCALE = 'en' as const satisfies DisplayLocale;

/** The seven a reader may select. The shared contract's list, never re-authored. */
export const SELECTABLE_DISPLAY_LOCALES: readonly DisplayLocale[] = DISPLAY_LOCALES;

/** Validate any stored/raw value against the seven. `undefined` = nothing valid is stored. */
export function parseDisplayLocale(value: string | null | undefined): DisplayLocale | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return isDisplayLocale(trimmed) ? trimmed : undefined;
}

/** The requested locale from a raw cookie value: the stored choice, or English when none. */
export function requestedDisplayLocaleOf(value: string | null | undefined): DisplayLocale {
  return parseDisplayLocale(value) ?? SOURCE_DISPLAY_LOCALE;
}

/** Direction for a locale, from the shared meta table (ar = rtl). */
export function displayDirectionOf(locale: DisplayLocale): TextDirection {
  return directionFor(locale);
}

/** Read one cookie by name out of a `document.cookie`-shaped string. */
export function readCookieValue(cookieHeader: string, name: string): string | undefined {
  for (const entry of cookieHeader.split(';')) {
    const [rawKey, ...rest] = entry.split('=');
    if (rawKey?.trim() === name) return rest.join('=').trim();
  }
  return undefined;
}

/** Client-only: the stored cookie choice (validated), or `undefined`. */
export function readDisplayLocaleCookie(): DisplayLocale | undefined {
  if (typeof document === 'undefined') return undefined;
  try {
    return parseDisplayLocale(readCookieValue(document.cookie, DISPLAY_LOCALE_COOKIE));
  } catch {
    return undefined;
  }
}

/** Client-only: the stored localStorage choice (validated), or `undefined`. */
export function readDisplayLocaleStorage(): DisplayLocale | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return parseDisplayLocale(window.localStorage.getItem(DISPLAY_LOCALE_STORAGE_KEY));
  } catch {
    // localStorage can throw (private browsing, disabled storage).
    return undefined;
  }
}

/**
 * Deterministic browser-language detection over the SEVEN display locales. Only consulted
 * when nothing valid is stored (rule 2). `navigator.languages` is read in order so a reader
 * whose first preference is unsupported still gets their second.
 */
export function detectBrowserDisplayLocale(
  nav: { language?: string; languages?: readonly string[] } | undefined = typeof navigator ===
  'undefined'
    ? undefined
    : navigator,
): DisplayLocale {
  if (nav === undefined) return SOURCE_DISPLAY_LOCALE;
  const candidates = [...(nav.languages ?? []), ...(nav.language ? [nav.language] : [])];
  for (const tag of candidates) {
    const base = parseDisplayLocale(tag.split('-')[0]?.toLowerCase());
    if (base !== undefined) return base;
  }
  return SOURCE_DISPLAY_LOCALE;
}

/** Client-only: the stored choice (cookie first, then the localStorage mirror). */
export function readStoredDisplayLocale(): DisplayLocale | undefined {
  return readDisplayLocaleCookie() ?? readDisplayLocaleStorage();
}

/** Client-only: what the reader asked for — stored choice, else browser, else English. */
export function resolveClientDisplayLocale(): DisplayLocale {
  return readStoredDisplayLocale() ?? detectBrowserDisplayLocale();
}

/**
 * THE ONE WRITER. Every selector calls this (through the `persistLanguageSelection` alias in
 * `languages.ts`, kept so existing selectors need no edit). Writes both stores at once.
 */
export function persistDisplayLocale(locale: DisplayLocale): void {
  if (typeof window === 'undefined') return;
  if (!isDisplayLocale(locale)) return;
  try {
    window.localStorage.setItem(DISPLAY_LOCALE_STORAGE_KEY, locale);
  } catch {
    // Best-effort only.
  }
  try {
    document.cookie = `${DISPLAY_LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // Best-effort only.
  }
}

/** What the reconciliation decided — pure, so it is testable without a browser. */
export interface DisplayLocaleReconciliation {
  /** The locale to persist, or `undefined` when nothing needs writing. */
  readonly persist: DisplayLocale | undefined;
  /** True when the server rendered with a different requested locale than the reader's. */
  readonly refresh: boolean;
  readonly reason:
    | 'COOKIE_IS_THE_CHOICE'
    | 'RESTORED_FROM_STORAGE'
    | 'MIRROR_REPAIRED'
    | 'BROWSER_DETECTED'
    | 'NOTHING_STORED_ENGLISH';
}

/**
 * The pure decision behind `LanguageSync` and `Hero`'s sync effect.
 *
 *   cookie valid               → it is the reader's choice; nothing is overwritten. If the
 *                                mirror disagrees it is repaired FROM the cookie (no refresh —
 *                                the server already rendered the cookie's locale).
 *   cookie absent, mirror valid → restore the cookie from the mirror; refresh if it differs
 *                                from the English the server rendered without a cookie.
 *   nothing stored             → browser detection over the seven; persist it; refresh only if
 *                                it is not English.
 */
export function reconcileDisplayLocale(input: {
  readonly cookie: string | null | undefined;
  readonly storage: string | null | undefined;
  readonly browser: DisplayLocale;
}): DisplayLocaleReconciliation {
  const cookie = parseDisplayLocale(input.cookie);
  const storage = parseDisplayLocale(input.storage);
  if (cookie !== undefined) {
    return storage === cookie
      ? { persist: undefined, refresh: false, reason: 'COOKIE_IS_THE_CHOICE' }
      : { persist: cookie, refresh: false, reason: 'MIRROR_REPAIRED' };
  }
  if (storage !== undefined) {
    return {
      persist: storage,
      refresh: storage !== SOURCE_DISPLAY_LOCALE,
      reason: 'RESTORED_FROM_STORAGE',
    };
  }
  return input.browser === SOURCE_DISPLAY_LOCALE
    ? /* Nothing to write: the server already rendered English, and English was not chosen. */
      { persist: undefined, refresh: false, reason: 'NOTHING_STORED_ENGLISH' }
    : { persist: input.browser, refresh: true, reason: 'BROWSER_DETECTED' };
}

/** Client-only: run the reconciliation against the real stores. Returns whether to refresh. */
export function reconcileStoredDisplayLocale(): boolean {
  if (typeof window === 'undefined') return false;
  let storage: string | null = null;
  try {
    storage = window.localStorage.getItem(DISPLAY_LOCALE_STORAGE_KEY);
  } catch {
    storage = null;
  }
  const decision = reconcileDisplayLocale({
    cookie: readCookieValue(document.cookie, DISPLAY_LOCALE_COOKIE),
    storage,
    browser: detectBrowserDisplayLocale(),
  });
  if (decision.persist !== undefined) persistDisplayLocale(decision.persist);
  return decision.refresh;
}
