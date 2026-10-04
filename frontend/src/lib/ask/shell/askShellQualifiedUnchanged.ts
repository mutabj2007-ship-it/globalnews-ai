import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * QUALIFIED_UNCHANGED — THE VALUES CLAUDE L CHOSE TO LEAVE AS ENGLISH
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R4 · CTO RULING: *"A value may remain byte-identical to English only when L explicitly
 * marks it `QUALIFIED_UNCHANGED`. It must not count as fallback. This applies to proper nouns
 * and other intentionally invariant strings."*
 *
 * ── THE THREE WAYS A STRING CAN READ ENGLISH, KEPT APART ─────────────────
 *
 *   NOT TRANSLATED BY ANYONE   the product name and the four provider names. Excluded from
 *                              the translation scope entirely (`ASK_SHELL_PROPER_NOUNS`),
 *                              never asked of a translator, and not on this list.
 *   QUALIFIED_UNCHANGED        a value Claude L SUPPLIED that happens to equal English — a
 *                              true cognate. This list, and every path on it is asserted to
 *                              be present in her delivery for that locale.
 *   FALLBACK                   a key she never reached. Absent from the overlay, reported by
 *                              `shellFallbacks()`, declared or the suite fails. There are
 *                              none left.
 *
 * ── WHY THE DISTINCTION NEEDED A LIST AND NOT JUST A MECHANISM ───────────
 *
 * The mechanism already separates them: a supplied value is written into the overlay and a
 * missing one is absent, so a fallback can never masquerade as a translation. But this round
 * produced the case that shows why "already separated" is not enough on its own.
 * `dict.loadingStages[0..3]` arrived as an index-keyed object rather than a JSON array; the
 * merge ignored the shape and kept English, while the fallback accounting — which resolves
 * `[0]` to `.0` — found the key and reported the locale COMPLETE. Four qualified French
 * strings rendered English with a passing coverage test.
 *
 * So anything that LOOKS English is now enumerated and checked against her files. A value
 * English because she chose it stays here; a value English because something dropped it is
 * not in her delivery, fails that assertion, and this list cannot absorb it.
 *
 * What is on it: true cognates — `Sources`, `Point`, `Question`, `Versions`, `Situation`,
 * `Actions`, `corridor`, `transport`, `relations`, `alliance` — plus `Ask AI` where it is the
 * product's own name inside a longer label. Arabic has the fewest, which is what you would
 * expect of a language that shares no alphabet with English.
 */

/** Per locale, paths whose Claude-L-supplied value is intentionally identical to English. */
export const ASK_SHELL_QUALIFIED_UNCHANGED: Readonly<
  Partial<Record<DisplayLocale, readonly string[]>>
> = Object.freeze({
  fr: Object.freeze([
    'askR2Strings.sources',
    'askR2Strings.cookiesLink',
    'askR2Strings.r3.relations.CORRIDOR',
    'askR2Strings.r3.relations.TRANSPORT',
    'askR2Strings.r3.relations.DIPLOMATIC',
    'askR2Strings.r3.relations.ALLIANCE',
    'askStrings.frameLabel',
    'askStrings.metaTitle',
    'askStrings.regions.sources',
    'askStrings.answerBlocks.actions',
    'askStrings.suggestionCategories.situation',
    'askStrings.controls.questionMode',
    'askContinuityStrings.turnCount',
    'askContinuityStrings.turnCountOne',
    'briefingStrings.scopeQuestion',
    'briefingStrings.versions',
    'askEvidenceTableStrings.point',
    'askEvidenceTableStrings.sources',
    'askIntelligenceStrings.source',
    'askIntelligenceStrings.parties',
    'dict.askAi.launcher',
    'dict.askAi.resultSourcesHeading',
    'dict.footer.linkLabels./contact',
  ]),
  de: Object.freeze([
    'askR2Strings.cookiesLink',
    'askStrings.frameLabel',
    'askStrings.metaTitle',
    'briefingStrings.sectionTitle',
    'dict.askAi.launcher',
    'dict.navBar.support',
  ]),
  es: Object.freeze([
    'askR2Strings.cookiesLink',
    'askStrings.frameLabel',
    'askStrings.metaTitle',
    'dict.askAi.launcher',
    'dict.footer.groupTitles.Legal',
  ]),
  pt: Object.freeze([
    'askR2Strings.cookiesLink',
    'askStrings.frameLabel',
    'askStrings.metaTitle',
    'briefingStrings.sectionTitle',
    'dict.askAi.launcher',
  ]),
  ar: Object.freeze([
    'askStrings.frameLabel',
    'askStrings.metaTitle',
    'dict.askAi.launcher',
  ]),
});

export function qualifiedUnchangedFor(locale: DisplayLocale): readonly string[] {
  return ASK_SHELL_QUALIFIED_UNCHANGED[locale] ?? [];
}
