import type { LanguageCode, DisplayLocale } from '@globalnews-ai/shared';
import { isDisplayLocale } from '@globalnews-ai/shared';

/**
 * Milestone #47 — every language the shared LanguageCode type knows
 * about. Mirrors the backend contract exactly (see shared/src/analysis.ts's
 * own doc comment for the full production-status disclosure).
 */
export const ALL_LANGUAGES: LanguageCode[] = ['en', 'pl', 'sw', 'fr', 'es', 'ar', 'rw'];

/**
 * Milestone #47 — ONLY these are selectable in the frontend language
 * selector and treated as production-supported. The other five
 * LanguageCode members are architecturally known (the type includes
 * them, the backend retrieval-strategy resolver already has defined
 * behavior for each) but must not appear as if actually usable until
 * their own end-to-end acceptance criteria are implemented and tested —
 * per the explicit MVP acceptance principle: a language isn't
 * "supported" merely because the type or a menu label exists.
 */
export const ACTIVE_LANGUAGES: LanguageCode[] = ['en', 'pl'];

/**
 * ── B4-A · THE SELECTABLE REGISTRY, AS A DisplayLocale VIEW ───────────────
 *
 * Economy reads `SELECTABLE_LOCALES` — the LANG-UI-7 name for "what this
 * deployment actually offers a reader today". Canonical declared all SEVEN
 * display locales here.
 *
 * THIS DEPLOYMENT OFFERS TWO, AND RECOVERY MUST NOT WIDEN THAT. The CTO ruling
 * is explicit — DisplayLocale may be recovered only in a way that preserves the
 * current visible EN/PL runtime — so this is NOT canonical's list. It is the
 * same deployment fact `ACTIVE_LANGUAGES` already states, expressed in the type
 * the shared contract uses.
 *
 * DERIVED, NEVER RE-AUTHORED. Writing `['en','pl']` a second time would create
 * two registries that agree only by discipline, and the next language would be
 * added to one of them. This maps the existing one, so they cannot drift.
 *
 * The three-set model holds: `LanguageCode` is representable, `DisplayLocale`
 * is contracted, and this is the deployment fact — a subset of
 * `DISPLAY_LOCALES`, which a test asserts it can never widen beyond.
 */
/*
 * ── B5-C · THE CAST IS GONE. TYPE-GUARDED FILTER, NEVER A CAST ────────────
 *
 * B4-A wrote `ACTIVE_LANGUAGES as readonly DisplayLocale[]`. That was SOUND BY
 * VALUE and UNSOUND BY TYPE, and the difference is not academic.
 *
 * `ACTIVE_LANGUAGES` is `LanguageCode[]`, and LanguageCode includes 'sw' and
 * 'rw' — which are NOT DisplayLocales. The cast asserted membership the
 * compiler had not checked, so the day somebody added 'sw' to ACTIVE_LANGUAGES
 * it would have become a DisplayLocale SILENTLY, with no error anywhere, and
 * this registry would have started claiming a display locale the shared
 * contract does not define.
 *
 * The filter cannot do that. `isDisplayLocale` is the shared contract's own
 * type guard, so a LanguageCode that is not a DisplayLocale is dropped here
 * rather than admitted by assertion — which is exactly the ruling that sw, rw,
 * uk and ru are not to be forced into the display-locale type for symmetry.
 *
 * STILL DERIVED, NEVER RE-AUTHORED. Writing ['en','pl'] a second time would
 * create two registries that agree only by discipline, and the next language
 * would be added to one of them.
 */
export const SELECTABLE_LOCALES: readonly DisplayLocale[] = ACTIVE_LANGUAGES.filter(
  /*
    THE INTERSECTION IS LOAD-BEARING, and it is worth a line because the obvious
    form does not compile and the obvious repair is another cast.

    `filter` narrows only to a SUBTYPE of the array's element type, and
    DisplayLocale is not a subtype of LanguageCode — the two sets OVERLAP
    without either containing the other (LanguageCode has sw and rw;
    DisplayLocale has de and pt). So `filter(isDisplayLocale)` on its own leaves
    the result as LanguageCode[] and the assignment fails.

    `LanguageCode & DisplayLocale` IS a subtype of both, so the narrowing is
    legitimate and the compiler checks it. The RUNTIME test is still
    isDisplayLocale — the shared contract's own guard — so nothing is asserted
    here that is not also checked.
  */
  (code): code is LanguageCode & DisplayLocale => isDisplayLocale(code),
);

export const LANGUAGE_NATIVE_LABELS: Record<LanguageCode, string> = {
  en: 'English',
  pl: 'Polski',
  sw: 'Kiswahili',
  fr: 'Français',
  es: 'Español',
  ar: 'العربية',
  rw: 'Kinyarwanda',
};

/** Milestone #47 — only 'ar' is right-to-left among the planned seven languages. */
export const LANGUAGE_DIRECTION: Record<LanguageCode, 'ltr' | 'rtl'> = {
  en: 'ltr',
  pl: 'ltr',
  sw: 'ltr',
  fr: 'ltr',
  es: 'ltr',
  ar: 'rtl',
  rw: 'ltr',
};

const STORAGE_KEY = 'globalnews-ai:language';

/**
 * Milestone #47 (correction round 2) — a DISTINCT, cookie-safe name
 * from STORAGE_KEY. Cookie names may not contain ":" reliably across
 * all browsers/proxies, so this is deliberately a different physical
 * string from the localStorage key — the two remain the SAME logical
 * preference (one call in persistLanguageSelection writes both), just
 * stored under two different keys appropriate to their two different
 * storage mechanisms. localStorage's key is intentionally left
 * unchanged (STORAGE_KEY) so no existing stored preference is lost for
 * users who already have one set.
 */
export const LANGUAGE_COOKIE_NAME = 'globalnews-ai-language';

export function isActiveLanguageCode(value: string): value is LanguageCode {
  return (ACTIVE_LANGUAGES as string[]).includes(value);
}

/**
 * Milestone #47 — deterministic browser-language detection, no AI call.
 * Reads navigator.language (e.g. "pl-PL", "en-US"), takes only the base
 * language subtag (before any "-"), and checks it against the ACTIVE
 * (production-supported) language list — never the full planned list,
 * so a browser reporting "fr-FR" or "ar" does not silently select an
 * unimplemented language; it falls through to English.
 */
export function detectBrowserLanguage(): LanguageCode {
  if (typeof navigator === 'undefined' || !navigator.language) return 'en';
  const base = navigator.language.split('-')[0]?.toLowerCase();
  return base && isActiveLanguageCode(base) ? base : 'en';
}

/**
 * Milestone #47 — resolution order: explicit stored override > browser-
 * supported language > English fallback, exactly as specified. Reads
 * localStorage directly (no database, no account system) and validates
 * the stored value is still one of the ACTIVE languages before trusting
 * it (defensive against a stale/invalid value from an earlier build).
 */
export function resolveInitialLanguage(): LanguageCode {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isActiveLanguageCode(stored)) {
        return stored;
      }
    } catch {
      // localStorage can throw (private browsing, disabled storage) —
      // fall through to browser detection rather than failing the page.
    }
  }
  return detectBrowserLanguage();
}

/**
 * Milestone #47 (correction round 2) — reads the language cookie
 * directly from `document.cookie` (client-side only). Used to
 * determine what language the LAST Server Component render actually
 * used (see Hero.tsx's sync effect), so the client can decide whether
 * a refresh is actually needed instead of always refreshing. Returns
 * `undefined` for an absent, malformed, or unsupported value — the
 * caller is responsible for applying the SAME 'en' default page.tsx
 * itself applies, so the two stay in agreement.
 */
export function readLanguageCookie(): LanguageCode | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${LANGUAGE_COOKIE_NAME}=`));
  const value = match?.split('=')[1];
  return value && isActiveLanguageCode(value) ? value : undefined;
}

/**
 * Milestone #47 (homepage feed language correction) — now ALSO writes
 * a cookie (under LANGUAGE_COOKIE_NAME, a distinct, cookie-safe name —
 * see its own doc comment) alongside the existing, unchanged
 * localStorage write (under STORAGE_KEY). This is the smallest
 * mechanism that lets a Server Component (which cannot read
 * window/localStorage) learn the user's language preference on the
 * NEXT request, without introducing a database, account system, or a
 * second independent preference store. `path=/` so it's sent on every
 * route (including /search); `SameSite=Lax` and no `Secure` flag
 * forced (works over plain http:// in local dev, and is upgraded
 * automatically when served over https:// in production); a one-year
 * `max-age` mirrors localStorage's effectively-permanent persistence.
 * Never contains anything beyond one of the validated LanguageCode
 * strings.
 */
export function persistLanguageSelection(language: LanguageCode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Best-effort only — a failed write should never break the UI.
  }
  try {
    document.cookie = `${LANGUAGE_COOKIE_NAME}=${language}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // Best-effort only, matching the localStorage write above — a
    // failed cookie write degrades to "homepage feed uses English",
    // never breaks the page.
  }
}
