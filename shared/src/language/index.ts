/**
 * LANG-UI-7 — CANONICAL DISPLAY-LOCALE TYPES.
 *
 * Authority: MAIN-LANG-UI-7-CONTRACT-R3-FINAL §3.1, plus Addendum A1 §A
 * (direction semantics) and Addendum A2 (run-boundary clarification).
 *
 * THE THREE-SET MODEL, KEPT DELIBERATELY DISTINCT.
 *
 *   1. `LanguageCode`  (analysis.ts, UNCHANGED)
 *      The REPRESENTABLE set. Includes `sw` and `rw` because they are
 *      load-bearing for source intelligence and retrieval strategy, and
 *      excludes `de` and `pt`. It is not a UI concept and is not widened
 *      here. LANG-UI-7-D1.
 *
 *   2. `DisplayLocale`  (below)
 *      The seven locales the PRODUCT UI is contracted to express. A
 *      different set for a different purpose; the two coexist.
 *
 *   3. The SELECTABLE registry  (frontend-owned, see
 *      frontend/src/lib/i18n/languages.ts)
 *      What this deployment actually offers a user today. It is a
 *      deployment fact, it does not cross the API boundary, and it can
 *      only ever be a subset of DISPLAY_LOCALES.
 *
 * Collapsing any two of these three is the exact defect LANG-UI-7 exists
 * to correct, so they are three names with three meanings.
 */

/** R3-FINAL §3.1 — the seven contracted display locales, in contract order. */
export const DISPLAY_LOCALES = ['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'] as const;

export type DisplayLocale = (typeof DISPLAY_LOCALES)[number];

export type TextDirection = 'ltr' | 'rtl';

/**
 * The formatting profile is a property of the LOCALE, not a user preference,
 * and is resolved in exactly one place. No component constructs its own
 * formatter and no component may select a regional Arabic variant
 * (`ar-EG`, `ar-MA`, `ar-SA`, …). R3-FINAL §6.2.
 */
export interface DisplayLocaleMeta {
  readonly locale: DisplayLocale;
  readonly direction: TextDirection;
  /** The locale's own name, in that locale. Never translated. */
  readonly endonym: string;
  /** BCP-47 tag handed to every Intl constructor for this locale. */
  readonly formattingProfile: string;
}

export const DISPLAY_LOCALE_META: Readonly<Record<DisplayLocale, DisplayLocaleMeta>> = {
  en: { locale: 'en', direction: 'ltr', endonym: 'English',    formattingProfile: 'en' },
  pl: { locale: 'pl', direction: 'ltr', endonym: 'Polski',     formattingProfile: 'pl' },
  fr: { locale: 'fr', direction: 'ltr', endonym: 'Français',   formattingProfile: 'fr' },
  de: { locale: 'de', direction: 'ltr', endonym: 'Deutsch',    formattingProfile: 'de' },
  es: { locale: 'es', direction: 'ltr', endonym: 'Español',    formattingProfile: 'es' },
  pt: { locale: 'pt', direction: 'ltr', endonym: 'Português',  formattingProfile: 'pt' },
  /**
   * R3-FINAL §6.2 — decided once, here. Eastern-Arabic numerals and the
   * Gregorian calendar. `ar` is the only RTL member and the only locale
   * whose profile carries Unicode extension subtags.
   */
  ar: { locale: 'ar', direction: 'rtl', endonym: 'العربية',    formattingProfile: 'ar-u-nu-arab-ca-gregory' },
} as const;

export function isDisplayLocale(value: unknown): value is DisplayLocale {
  return typeof value === 'string' && (DISPLAY_LOCALES as readonly string[]).includes(value);
}

/** Direction for a locale, from the single meta table. Never inferred per component. */
export function directionFor(locale: DisplayLocale): TextDirection {
  return DISPLAY_LOCALE_META[locale].direction;
}

/** The BCP-47 tag every Intl constructor for this locale must be given. */
export function formattingProfileFor(locale: DisplayLocale): string {
  return DISPLAY_LOCALE_META[locale].formattingProfile;
}

/* ------------------------------------------------------------------ *
 * PLURALS — R3-FINAL §5
 * ------------------------------------------------------------------ */

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/**
 * `other` is mandatory and is the ONLY permitted structural fallback.
 * A locale that needs no further categories supplies `other` alone.
 */
export type PluralForms = Partial<Record<PluralCategory, string>> & { other: string };

export type DictionaryEntry = string | PluralForms;

/* ------------------------------------------------------------------ *
 * SUPPORT CAPABILITY — R3-FINAL §3.2 / §3.3, Addendum A1 §D
 * ------------------------------------------------------------------ */

/**
 * Request-time only. NEVER persisted: no `SupportMessage` column, no
 * `kind`, no `routeReason` (R3-FINAL §3.3). The frontend RENDERS this and
 * computes none of it — dictionary presence is never the detector.
 */
export type SupportCapabilityState = 'QUALIFIED' | 'UNQUALIFIED' | 'UNAVAILABLE';

/**
 * SUPPORT-LANG-7-D16 (Addendum A1 §D) — a locale whose capability is not
 * `QUALIFIED` must never reach the EN/PL deterministic classifier. The
 * check is a PRECONDITION, not a post-filter: checking afterwards means the
 * wrong answer already exists and something downstream must remember to
 * discard it.
 */
export function mayEnterDeterministicClassifier(state: SupportCapabilityState): boolean {
  return state === 'QUALIFIED';
}

/**
 * The disclosure carried alongside a Support reply. An English reply to an
 * Arabic requester is `{ responseLocale: 'en', requestedLocale: 'ar',
 * fellBack: true }` — never recorded as Arabic, never silently English.
 */
export interface SupportResponseLanguage {
  readonly requestedLocale: DisplayLocale;
  readonly responseLocale: DisplayLocale;
  readonly fellBack: boolean;
}

/* ------------------------------------------------------------------ *
 * THE BOUNDARY BETWEEN THE DISPLAY SET AND THE REPRESENTABLE SET
 * ------------------------------------------------------------------ */

/**
 * LANG-UI-7-D1 — `DisplayLocale` and `LanguageCode` are NOT the same set and
 * neither is assignable to the other:
 *
 *   only in LanguageCode   sw, rw   (source intelligence / retrieval strategy)
 *   only in DisplayLocale  de, pt   (contracted UI locales with no source-
 *                                    intelligence counterpart today)
 *
 * Every crossing between them goes through this ONE function, so the places
 * where the two sets genuinely differ are enumerable rather than scattered as
 * silent casts. `undefined` means exactly what it says: this display locale has
 * no source-language counterpart yet. Callers decide what to do about that; the
 * boundary never invents one.
 */
export function sourceLanguageFor(
  locale: DisplayLocale,
): 'en' | 'pl' | 'sw' | 'fr' | 'es' | 'ar' | 'rw' | undefined {
  switch (locale) {
    case 'en': return 'en';
    case 'pl': return 'pl';
    case 'fr': return 'fr';
    case 'es': return 'es';
    case 'ar': return 'ar';
    case 'de': return undefined;
    case 'pt': return undefined;
    default:   return undefined;
  }
}

/* ------------------------------------------------------------------ *
 * MAIN-LANG-MEASURE-1 — REQUESTED vs EFFECTIVE, AS ONE SHARED CONTRACT
 * ------------------------------------------------------------------ */

/**
 * WHY THIS EXISTS, AND WHY IT IS NOT A NEW IDEA.
 *
 * Three different facts get called "the language", and collapsing any two of them produces a
 * page that lies about itself:
 *
 *   requestedDisplayLocale   what the reader asked for — cookie, ?lang=, Accept-Language,
 *                            account preference. This is what gets PERSISTED.
 *   effectiveContentLocale   the locale whose content is ACTUALLY rendered, after catalogue
 *                            resolution. This is what the document metadata must describe.
 *   fellBack                 whether those two differ, so the difference can be DISCLOSED
 *                            rather than hidden.
 *
 * THE PLATFORM ALREADY HAD THIS SHAPE, for exactly one surface: `SupportResponseLanguage`
 * carries `{ requestedLocale, responseLocale, fellBack }` so an English reply to an Arabic
 * requester is stated rather than disguised. That reasoning was never surface-specific. This
 * generalises the accepted shape instead of inventing a second one.
 *
 * THE MEASURED DEFECT THIS CLOSES. `frontend/public/offline.html` sets
 * `document.documentElement.lang` from the REQUESTED locale while choosing its visible content
 * from the blocks it actually has. A reader whose cookie says `ar` therefore receives
 * `lang="ar" dir="rtl"` wrapped around English text: assistive technology is told to speak
 * English prose as Arabic, and the bidi algorithm is applied to a left-to-right paragraph. The
 * production layout does NOT have this defect — it resolves through the selectable registry, so
 * its `lang` always matches what it serves — which is precisely why the rule belongs in one
 * shared place rather than being rediscovered per surface.
 *
 * NOTHING HERE WIDENS OR NARROWS `DISPLAY_LOCALES`, and nothing here is a deployment claim.
 * Which locales a deployment can actually render is the caller's fact, passed in.
 */
export interface DisplayLocaleResolution {
  /** What the reader asked for. Survives a fallback; this is the persisted preference. */
  readonly requestedDisplayLocale: DisplayLocale;
  /** The locale actually rendered. This — and only this — may describe the document. */
  readonly effectiveContentLocale: DisplayLocale;
  /** True when the two differ, so a surface can disclose it. */
  readonly fellBack: boolean;
}

/**
 * Resolve a requested locale against the locales a surface can ACTUALLY render.
 *
 * `renderable` is a deployment fact and is supplied by the caller — the frontend's
 * `SELECTABLE_LOCALES`, an offline page's authored blocks, a Support catalogue. This function
 * never consults `DISPLAY_LOCALES` for availability, because a contracted locale is not a
 * rendered one: a type existing is not a translation existing.
 *
 * Falls back to the first renderable locale, which the caller orders. It does not assume
 * English, because assuming a fallback is how a surface ends up claiming one it cannot render.
 */
export function resolveContentLocale(
  requestedDisplayLocale: DisplayLocale,
  renderable: readonly DisplayLocale[],
): DisplayLocaleResolution {
  if (renderable.length === 0) {
    throw new Error(
      'LANG-RESOLVE-1: a surface that can render no locale cannot claim a content language.',
    );
  }
  const effectiveContentLocale = renderable.includes(requestedDisplayLocale)
    ? requestedDisplayLocale
    : (renderable[0] as DisplayLocale);

  return {
    requestedDisplayLocale,
    effectiveContentLocale,
    fellBack: effectiveContentLocale !== requestedDisplayLocale,
  };
}

/** The `lang` and `dir` a document may honestly declare. */
export interface DocumentLanguageAttributes {
  readonly lang: DisplayLocale;
  readonly dir: TextDirection;
}

/**
 * THE BINDING RULE, EXPRESSED AS THE ONLY WAY TO OBTAIN THESE ATTRIBUTES.
 *
 * `lang` and `dir` describe the language of the CONTENT THAT IS RENDERED, so both derive from
 * `effectiveContentLocale`. The requested locale is deliberately unreachable from here: a
 * function that could return the requested locale would eventually be called with it.
 */
export function documentLanguageOf(
  resolution: DisplayLocaleResolution,
): DocumentLanguageAttributes {
  return {
    lang: resolution.effectiveContentLocale,
    dir: directionFor(resolution.effectiveContentLocale),
  };
}

/**
 * The preference to persist. It is the REQUESTED locale, unchanged by a fallback.
 *
 * A reader who asks for Arabic and is served English because no Arabic catalogue exists yet has
 * not changed their mind. Rewriting the stored preference to the served locale would silently
 * discard their choice, and they would have to make it again every time a catalogue was missing.
 */
export function persistedPreferenceOf(resolution: DisplayLocaleResolution): DisplayLocale {
  return resolution.requestedDisplayLocale;
}

/**
 * Executable form of the rule, for surfaces that build their attributes by hand.
 *
 * Rejects the exact defect measured in `offline.html`: metadata describing a locale other than
 * the one whose content is on the page.
 */
export function assertDocumentLanguageDescribesRenderedContent(
  attributes: DocumentLanguageAttributes,
  resolution: DisplayLocaleResolution,
): void {
  if (attributes.lang !== resolution.effectiveContentLocale) {
    throw new Error(
      `LANG-RESOLVE-2: document lang "${attributes.lang}" does not describe the rendered ` +
        `content locale "${resolution.effectiveContentLocale}". Metadata must describe what ` +
        'is on the page, not what was asked for.',
    );
  }
  if (attributes.dir !== directionFor(resolution.effectiveContentLocale)) {
    throw new Error(
      `LANG-RESOLVE-3: document dir "${attributes.dir}" does not match the direction of the ` +
        `rendered content locale "${resolution.effectiveContentLocale}".`,
    );
  }
}
