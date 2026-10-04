import type { LanguageCode, DisplayLocale } from '@globalnews-ai/shared';
import { DISPLAY_LOCALES, DISPLAY_LOCALE_META, directionFor, isDisplayLocale } from '@globalnews-ai/shared';
import { DISPLAY_LOCALE_COOKIE, parseDisplayLocale, persistDisplayLocale } from './displayLocale';

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
/**
 * ════════════════════════════════════════════════════════════════════════════
 * R4 · CLAUDE H — THE DEPLOYMENT FACT IS NOW THE CONTRACTED SEVEN
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO AUTHORIZATION: "This contract explicitly opens the previously deferred frontend
 * language work." The registry was `['en','pl']` because no deployment offered more; the
 * selector is now contracted to offer FR / DE / ES / PT / AR, so the deployment fact is the
 * seven and this is where that is stated.
 *
 * IT IS STILL DERIVED AND STILL GUARDED. It is `DISPLAY_LOCALES` — the shared contract's own
 * list — rather than a second literal, so it cannot drift from the contract and cannot
 * exceed it. The previous derivation ran through `ACTIVE_LANGUAGES`, which is typed
 * `LanguageCode[]` and therefore CANNOT express `de` or `pt` at all: deriving the seven from
 * it is impossible, not merely awkward. `ACTIVE_LANGUAGES` keeps its own meaning (the
 * representable source-intelligence codes this deployment treats as active) and is left
 * exactly as it was, because the two sets answer different questions — the distinction
 * LANG-UI-7-D1 exists to preserve.
 *
 * WHAT THIS DOES NOT CLAIM. Offering a locale in the selector is a UI fact. It is not a
 * claim that every catalogue is translated, and it is not a claim that the Ask engine
 * answers in it — `lib/ask/askLocale.ts` names that boundary and `askSevenStrings` discloses
 * catalogue coverage. A locale appearing here with an undisclosed English fallback behind it
 * would be the defect; a disclosed one is a state.
 */
export const SELECTABLE_LOCALES: readonly DisplayLocale[] = DISPLAY_LOCALES;

/** The previous EN/PL-derived registry, kept for the surfaces that are still EN/PL only. */
export const ANSWER_CAPABLE_LOCALES: readonly DisplayLocale[] = ACTIVE_LANGUAGES.filter(
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

/**
 * R4 · TOTAL OVER BOTH SETS, AND THE DISPLAY NAMES ARE NOT RE-AUTHORED.
 *
 * It was `Record<LanguageCode, string>`, which has no `de` and no `pt` — so a selector
 * offering the contracted seven could not name two of them. The seven display endonyms now
 * come from `DISPLAY_LOCALE_META`, the shared contract's own table ("the locale's own name,
 * in that locale. Never translated"), and `sw`/`rw` keep their entries because they are
 * `LanguageCode` members with no display counterpart.
 *
 * Deriving rather than re-typing matters here: 'Français' written twice would agree with
 * itself only by discipline, and a correction would land in one copy.
 */
export const LANGUAGE_NATIVE_LABELS: Record<LanguageCode | DisplayLocale, string> = {
  sw: 'Kiswahili',
  rw: 'Kinyarwanda',
  ...(Object.fromEntries(
    DISPLAY_LOCALES.map((locale) => [locale, DISPLAY_LOCALE_META[locale].endonym]),
  ) as Record<DisplayLocale, string>),
};

/**
 * Milestone #47 — only 'ar' is right-to-left among the planned seven languages.
 *
 * T2 · DERIVED FROM THE SHARED META TABLE for every LanguageCode that is also a display locale,
 * so the direction has one source (`directionFor`). `sw`/`rw` are source languages with no
 * display meta and are LTR.
 */
export const LANGUAGE_DIRECTION: Record<LanguageCode, 'ltr' | 'rtl'> = {
  en: directionFor('en'),
  pl: directionFor('pl'),
  sw: 'ltr',
  fr: directionFor('fr'),
  es: directionFor('es'),
  ar: directionFor('ar'),
  rw: 'ltr',
};

/**
 * Milestone #47 (correction round 2) — the cookie a Server Component reads. T2: the name is
 * owned by the display-locale authority (`displayLocale.ts`) and re-exported here UNCHANGED, so
 * every existing stored preference survives.
 */
export const LANGUAGE_COOKIE_NAME = DISPLAY_LOCALE_COOKIE;

/**
 * Membership in ACTIVE_LANGUAGES — the SOURCE/retrieval set (`['en','pl']`).
 *
 * T2 · NOT A DISPLAY GATE ANY MORE. Every route and the root layout now read the reader's locale
 * through the display-locale authority (`displayLocale.server.ts` + the effective-locale rule).
 * This predicate is RETAINED only because three HUMANITARIAN-protected route files that T2 may
 * not edit still import it (`app/page.tsx`, `app/humanitarian/page.tsx`,
 * `app/humanitarian/compact/page.tsx`); `displayLocaleAuthority.spec.ts` asserts no other
 * non-test file imports it. The patch for those files is specified in the T2 dossier.
 */
export function isActiveLanguageCode(value: string): value is LanguageCode {
  return (ACTIVE_LANGUAGES as string[]).includes(value);
}

/**
 * The language the CURRENT DOCUMENT renders in, as a `LanguageCode`-typed value — for client
 * components that need the rendered language after mount (Search, Map callbacks, error pages).
 *
 * T2 · This is the EFFECTIVE locale, read from `<html lang>`, which the root layout sets from the
 * surface's effective-locale decision. It is deliberately NOT the stored preference: a client
 * that re-derived the language from the cookie would undo a declared English fallback and render
 * a mixed-language page. `de`/`pt` (not LanguageCodes) and anything unrecognised read as 'en'.
 */
export function documentRenderLanguage(): LanguageCode & DisplayLocale {
  if (typeof document === 'undefined') return 'en';
  const rendered = parseDisplayLocale(document.documentElement?.lang);
  switch (rendered) {
    case 'pl':
    case 'fr':
    case 'es':
    case 'ar':
      return rendered;
    default:
      return 'en';
  }
}

/**
 * Milestone #47 — kept as the name H's SearchPageClient calls on mount.
 *
 * T2 · It no longer reads localStorage or browser language (that path rejected fr–ar and let a
 * Polish browser overwrite a stored French choice). It returns the document's EFFECTIVE render
 * language, which is exactly what the server rendered the surface in, so the client agrees with
 * the server and with `<html lang>` by construction.
 */
export function resolveInitialLanguage(): LanguageCode {
  return documentRenderLanguage();
}

/**
 * The ONE writer, re-exported under its historical name so every selector keeps working.
 * Accepts any display locale; a LanguageCode that is not a display locale (sw, rw) is ignored —
 * it is not a UI choice.
 */
export function persistLanguageSelection(language: LanguageCode | DisplayLocale): void {
  if (isDisplayLocale(language)) persistDisplayLocale(language);
}

/**
 * R4 · THE ONE CROSSING FROM A STORED/REPRESENTABLE CODE TO A DISPLAY LOCALE.
 *
 * An unrecognised value resolves to `'en'`, which is a resolution and not a clamp: a value the
 * contract does not contain is not a request for a locale.
 */
export function displayLocaleOf(value: string | undefined | null): DisplayLocale {
  return parseDisplayLocale(value) ?? 'en';
}
