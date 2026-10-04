import {
  DISPLAY_LOCALES,
  isDisplayLocale,
  resolveContentLocale,
  type DisplayLocale,
  type DisplayLocaleResolution,
} from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK LOCALE — ONE RESOLUTION FOR SEVEN LANGUAGES, AND ONE DECLARED BOUNDARY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R4 · CLAUDE H · SEVEN-LANGUAGE ASK FRONTEND.
 *
 * ── THE DEFECT THIS REPLACES, MEASURED ────────────────────────────────────
 *
 * Before this module, Ask narrowed the reader's locale in FOUR components and SIX
 * routes, each with its own copy of the same line:
 *
 *     const r2Locale: 'en' | 'pl' = locale === 'pl' ? 'pl' : 'en';
 *
 * (`AskFrameScreen.tsx:109`, `AskAiDock.tsx:276`, `SearchPageClient.tsx:230`,
 * `MyIntelligenceClient.tsx:240`, plus `app/ask/page.tsx:35`, `app/ask/recent/page.tsx:34`,
 * `app/saved/page.tsx:32`, `app/saved/briefing/page.tsx:28`, `app/page.tsx:116`,
 * `app/account/settings/page.tsx:26`.)
 *
 * Ten independent clamps mean a reader who selects French is told nothing and shown
 * English, and the next surface added gets an eleventh clamp. This module replaces all of
 * them with one resolution, so the number of places that can narrow a locale is one.
 *
 * ── SEVEN LANGUAGES IN, SEVEN LANGUAGES OUT (CORRECTED — PO RULING) ──────
 *
 * The interface is contracted for seven locales (`DISPLAY_LOCALES`) and this module resolves
 * all seven without clamping. **The answer comes back in the reader's selected language.**
 *
 * THIS IS A CORRECTION, AND THE ERROR IS WORTH RECORDING. The first round of this lane
 * measured the only backend it could see — the one at its own base `c7e8c03`:
 *
 *     backend/src/modules/ask-v2/ask-v2.dto.ts:19      @IsIn(['en', 'pl']) language!: Language;
 *     backend/src/modules/ask-router/knowledge-requirement.ts:207
 *                                                      if (language !== 'en' && language !== 'pl') return false;
 *
 * and concluded that FR–AR readers had to be TOLD the answer would return in English. That
 * was a true statement about `c7e8c03` and a FALSE statement about the product, because the
 * integration line had already moved past that base: the current head carries
 * `route(q, 'fr')`, `SEMANTIC_FIRST_INTERPRETER_SYSTEM`,
 * `semantic-interpreter.seven-language.reliability.spec.ts`, and a Run-3 battery scored per
 * language across fr / de / es / pt / ar. A frontend lane pinned to an old base measured a
 * stale fact and disclosed it as a current one. The Product Owner's ruling stands and the
 * disclosure is gone.
 *
 * ── THE DISTINCTION THAT CAUSED THE ERROR, NOW SEPARATED ──────────────────
 *
 * The old code had ONE idea doing TWO jobs: `'en' | 'pl'` was simultaneously "the languages
 * the engine answers in" and "the languages the frozen `AskR2Strings` catalogue exists in".
 * Those are different facts about different systems, and conflating them is exactly how a
 * copy-coverage gap got rendered to readers as an answer-language limitation.
 *
 *   `answerLocale`    — the language the answer comes back in. The reader's own, all seven.
 *   `catalogueLocale` — the index into the EN/PL-only frozen copy catalogues. A deployment
 *                       fact about TRANSLATION COVERAGE, reported by `askCopyCoverage` and
 *                       owned by Claude L. It is never shown to a reader as a claim about
 *                       answers, and it never narrows what is sent.
 *
 * ── WHAT THIS MODULE IS NOT ───────────────────────────────────────────────
 *
 * It is not a translation layer and it does not touch the question. Nothing here reads,
 * rewrites, translates or routes on question text — the reader's words go to the one Ask
 * engine unchanged. There is no per-language branch beyond the two declared data tables
 * below, and no regex.
 */

/** Every locale the Ask interface is contracted to express. The shared contract's order. */
export const ASK_DISPLAY_LOCALES: readonly DisplayLocale[] = DISPLAY_LOCALES;

/**
 * THE LOCALES THE ANSWER ENGINE UNDERSTANDS TODAY — declared once, derived from nothing.
 *
 * It is written as a literal because it mirrors a backend `@IsIn` list this lane cannot
 * read at runtime and must not edit. When the backend widens, exactly one line changes
 * here and every Ask surface follows, because every surface asks this module rather than
 * repeating a ternary.
 */
export const ASK_ANSWER_LOCALES: readonly DisplayLocale[] = DISPLAY_LOCALES;

/**
 * THE LOCALES THE FROZEN COPY CATALOGUES EXIST IN — a translation fact, nothing more.
 *
 * `AskR2Strings`, `askNavStrings` and the released dictionaries are TOTAL records over two
 * locales. Indexing them needs one of those two. That is all this list means: it says
 * nothing about what the engine can answer, and it is never used to narrow a request.
 * Widening it is Claude L's lane, not this one's.
 */
export const ASK_CATALOGUE_LOCALES: readonly DisplayLocale[] = Object.freeze(['en', 'pl'] as const);

/** The locale an Ask surface falls back to when it cannot render the requested one. */
export const ASK_FALLBACK_LOCALE = 'en' as const satisfies DisplayLocale;

/** The answer comes back in the reader's own language, so this is the whole seven. */
export type AskAnswerLocale = DisplayLocale;

/** The two locales the frozen copy catalogues can be indexed by. */
export type AskCatalogueLocale = 'en' | 'pl';

/**
 * Read the reader's locale without narrowing it.
 *
 * Accepts the raw cookie value, a `?lang=` value, or anything else a caller has. An
 * unrecognised value resolves to the fallback — which is a resolution, not a clamp,
 * because an unrecognised value is not a request for a locale.
 */
export function resolveAskLocale(value: string | undefined | null): DisplayLocale {
  return isDisplayLocale(value) ? value : ASK_FALLBACK_LOCALE;
}

/**
 * WHY THE DISPOSITION STILL HAS SEPARATE FIELDS WHEN THREE OF THEM NOW AGREE.
 *
 * `requested`, `interfaceLocale` and `answerLocale` are all the reader's own locale today.
 * They are kept distinct because they are answers to three different questions — what was
 * asked for, what the chrome renders in, what the answer comes back in — and the last time
 * two of them were collapsed into one value, a copy-coverage fact was rendered to readers as
 * an answer-language limitation. One name per fact is what makes a future divergence
 * visible instead of silent.
 *
 * `catalogueLocale` is the only narrowing in the module, it narrows nothing that is SENT,
 * and `fullAskCopy` states whether it was a narrowing at all.
 *
 * `requested` is preserved unchanged so the stored preference is never rewritten by a
 * fallback — the rule `persistedPreferenceOf` states in the shared contract.
 */
export interface AskLanguageDisposition {
  readonly requested: DisplayLocale;
  readonly interfaceLocale: DisplayLocale;
  /** The language the answer comes back in: the reader's own. */
  readonly answerLocale: AskAnswerLocale;
  /** The index into the EN/PL-only frozen copy catalogues. Never sent anywhere. */
  readonly catalogueLocale: AskCatalogueLocale;
  /** False when the reader's locale has no full frozen copy catalogue yet (Claude L's lane). */
  readonly fullAskCopy: boolean;
}

export function askLanguageDisposition(requested: DisplayLocale): AskLanguageDisposition {
  const catalogue = resolveContentLocale(requested, ASK_CATALOGUE_LOCALES);
  return {
    requested,
    /* The interface renders in what the reader asked for. */
    interfaceLocale: requested,
    /* And so does the answer. */
    answerLocale: requested,
    catalogueLocale: catalogue.effectiveContentLocale as AskCatalogueLocale,
    fullAskCopy: !catalogue.fellBack,
  };
}

/**
 * The resolution for the INTERFACE, against the locales a surface can actually render.
 *
 * Kept separate from the disposition because the two answer different questions, and
 * because `renderable` is a deployment fact the caller owns — the shared contract is
 * explicit that a contracted locale is not a rendered one.
 */
export function resolveAskInterfaceLocale(
  requested: DisplayLocale,
  renderable: readonly DisplayLocale[],
): DisplayLocaleResolution {
  return resolveContentLocale(requested, renderable);
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE REQUEST LANGUAGE — DECLARED HERE, BECAUSE THE CLIENT ITSELF IS FROZEN
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CONTRACT ITEM 1 asked that the Ask request contract be able to carry any of the seven
 * without clamping FR–AR back to EN/PL. This type IS that contract, and under the CTO's
 * authorization `lib/api/askV2Api.ts` now declares `AskV2Language = DisplayLocale`, so the
 * request carries the reader's selection end to end. The type stays declared here as well
 * because it is the name the Ask surfaces reason about, and because one module — not ten
 * call sites — remains the only place a locale could ever be narrowed again.
 */
export type AskRequestLanguage = DisplayLocale;

/**
 * The value the Ask V2 client carries. The reader's own locale, unnarrowed.
 *
 * Kept as a named function rather than inlining `disposition.requested` at four call sites,
 * so the request language has exactly one definition.
 */
export function askClientLanguage(disposition: AskLanguageDisposition): DisplayLocale {
  return disposition.requested;
}

/**
 * The language value an Ask request may carry.
 *
 * It is the reader's REQUESTED locale, not the answer locale, and that is deliberate: the
 * server is the authority on what it can answer and must be told what was actually asked.
 * A frontend that pre-clamped would make the backend's own refusal unreachable and its
 * disclosure impossible.
 */
export function askRequestLanguage(disposition: AskLanguageDisposition): DisplayLocale {
  return disposition.requested;
}

/**
 * The locale value the LEGACY five-member `AskLocale` catalogue can accept.
 *
 * `AskLocale` is `LanguageCode & DisplayLocale` — `'en'|'pl'|'fr'|'es'|'ar'` — so it cannot
 * express `de` or `pt` at all, and widening it would mean widening `LanguageCode`, which is
 * the source-intelligence set and not a UI concept (the shared contract's LANG-UI-7-D1).
 *
 * This crossing is therefore explicit and enumerable rather than a cast at each call site.
 * `de` and `pt` resolve to `'en'`, and `resolveAskStrings` reports that as `fellBack: true`
 * — the one Ask resolver that already discloses its own fallback — so the substitution is
 * visible to the surface instead of silent.
 */
export function askLocaleForLegacyCatalogue(
  locale: DisplayLocale,
): 'en' | 'pl' | 'fr' | 'es' | 'ar' {
  switch (locale) {
    case 'en':
    case 'pl':
    case 'fr':
    case 'es':
    case 'ar':
      return locale;
    case 'de':
    case 'pt':
      return ASK_FALLBACK_LOCALE;
    default:
      return ASK_FALLBACK_LOCALE;
  }
}

/**
 * True when the engine answers in the reader's own language — now unconditional.
 *
 * Kept as the single place that question is answered, so if a future backend ruling ever
 * narrows the answer set again, it narrows HERE and every surface follows, instead of a
 * ternary reappearing in ten files.
 */
export function answerIsInReaderLanguage(disposition: AskLanguageDisposition): boolean {
  return (ASK_ANSWER_LOCALES as readonly string[]).includes(disposition.requested);
}

/** True when the reader's locale has to borrow a frozen copy catalogue. A copy fact only. */
export function usesBorrowedCopyCatalogue(disposition: AskLanguageDisposition): boolean {
  return !disposition.fullAskCopy;
}
