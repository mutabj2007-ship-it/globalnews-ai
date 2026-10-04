import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE DECLARED UNQUALIFIED SET — NOW EMPTY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R4 · PHASE B · CLAUDE H.
 *
 * The CTO's rule: *"Missing catalogue keys must fail tests rather than silently displaying
 * English."* `askShellCoverage(locale).fallbacks` measures what ACTUALLY falls through; this
 * file declares what is ALLOWED to; and `askShellCoverage.spec.ts` asserts the two sets are
 * EQUAL — not that one contains the other.
 *
 * **It is empty, and the equality assertion is what makes that mean something.** An empty
 * declaration beside a passing equality test says every reachable Ask-shell key in
 * fr / de / es / pt-BR / ar renders qualified wording. If a key ever starts falling back, the
 * measured set gains an entry this file does not have and the suite fails.
 *
 * ── HOW IT GOT HERE, BECAUSE THE NUMBER MOVED FOUR TIMES ─────────────────
 *
 *   413  manifest Revision 2 — what Claude L first answered
 *   479  Revision 3: the enumerator had been skipping function-valued members (33 templates)
 *   559  Revision 4: eighty more keys were never in a catalogue at all — component-private
 *        records, bare `locale === 'pl' ? … : …` ternaries, two self-resolving view builders
 *   530  Revision 4 less `askSevenStrings` (already total over seven) and the proper nouns
 *   527  less the three product-NAME keys, moved out of translation scope by the brand ruling
 *
 * Three of those four moves made the number WORSE and every one was reported rather than
 * absorbed. A coverage report with the wrong denominator is not a report; it is a
 * reassurance.
 *
 *   535  overlay-managed keys  (`askShellKeyPaths().length`)
 *    -8  not translated in any locale: the product name ×3, and GNews, GDELT, X, YouTube, API
 *   ────
 *   527  qualified by Claude L in every one of the five
 *     0  declared below
 *
 * ── THE FILE STAYS, EMPTY ────────────────────────────────────────────────
 *
 * Deleting it and the assertion with it would remove the only thing standing between a future
 * key and a silent English fallback. The next key added to the English catalogue fails the
 * suite until someone either has it translated or writes it down here — which is the whole
 * mechanism, and it is worth more now that there is nothing in it than it was when there were
 * 469 lines.
 */

/** Empty: no locale falls back to English on any reachable Ask-shell key. */
const NONE: readonly string[] = Object.freeze([]);

/**
 * The declared fallback set per locale. EN and PL are authored catalogues; fr/de/es/pt/ar are
 * Claude L's qualified wording. A locale absent from this record is asserted to have no gap
 * either, so the empty record and the explicit empty lists say the same thing by design.
 */
export const ASK_SHELL_DECLARED_FALLBACKS: Readonly<
  Partial<Record<DisplayLocale, readonly string[]>>
> = Object.freeze({
  fr: NONE,
  de: NONE,
  es: NONE,
  pt: NONE,
  ar: NONE,
});

export function declaredFallbacksFor(locale: DisplayLocale): readonly string[] {
  return ASK_SHELL_DECLARED_FALLBACKS[locale] ?? [];
}
