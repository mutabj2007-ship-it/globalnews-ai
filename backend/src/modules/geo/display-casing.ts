/**
 * G-GEO-12 — TITLE-CASING A LABEL THE READER TYPED.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FOURTH TRANSFORM, AND THE ONE THAT HAD NO HOME
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Four different questions are asked about a place name in this module, and
 * keeping them apart is the whole discipline:
 *
 *   foldGeographyIdSegment    what is this name's stable form inside an id?
 *   foldPlaceName             are these two names the same name?
 *   foldForLabelComparison    is this alias a different LABEL from the canonical?
 *   toDisplayCase             how is this label WRITTEN OUT for a reader?      <- here
 *
 * The first three live in named, documented functions. The fourth was an inline
 * regex in the middle of `toMapGeography`, which is how it went wrong without
 * anyone having to make a decision.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT WAS WRONG: `\b` IS ASCII, EVEN UNDER THE `u` FLAG
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *     alias.replace(/\b\p{Ll}/gu, (c) => c.toUpperCase())
 *
 * `\p{Ll}` is Unicode-aware. `\b` is not, and no flag makes it so: it is defined
 * against `[A-Za-z0-9_]`, so JavaScript sees a word boundary on BOTH SIDES of
 * every non-ASCII letter. The expression therefore uppercased the letter after
 * every accent, and never the first letter of a word that began with one.
 *
 * The consequence was NOT that non-Latin labels failed to capitalise. That is
 * the mild half. The severe half is that accented Latin labels were MANGLED,
 * because each accented character created two spurious boundaries:
 *
 *     "a coruña"    ->  "A CoruÑA"          ->  "A Coruña"
 *     "abaeté"      ->  "AbaetÉ"            ->  "Abaeté"
 *     "abramów"     ->  "AbramÓW"           ->  "Abramów"
 *     "ísafjörður"  ->  "íSafjÖRÐUr"        ->  "Ísafjörður"
 *     "канильо"     ->  "канильо"           ->  "Канильо"
 *
 * MEASURED over the shipped gazetteer, lowercasing every name and alias and
 * comparing the two expressions:
 *
 *     73,096   names considered
 *     16,574   render differently
 *                13,192   Latin-extended — the MANGLED case
 *                 3,382   Cyrillic       — the merely-uncapitalised case
 *
 * The Cyrillic case is the one that was noticed. It is the smaller one.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A DISPLAY OPERATION AND NOTHING ELSE. Its output is shown to a reader and is
 * never stored, never compared, never part of an identifier, and never sent to
 * a provider. It must not be reached for by anything asking whether two names
 * match, and the provider slug expressions that share the old expression's
 * ASCII assumption are a different lane and are deliberately untouched.
 */

/**
 * The Unicode analogue of `\b\p{Ll}`: a lowercase letter that does not follow a
 * letter, a digit, or a combining mark.
 *
 * `\p{M}` IS IN THE LOOKBEHIND AND IT IS NOT DECORATION. Without it, a
 * decomposed character breaks the run at its own combining mark: the Turkish
 * dotted capital lowercases to `i` + COMBINING DOT ABOVE, so the following `s`
 * would look like the start of a new word and "i̇stanbul" would render as
 * "İStanbul". With it, "İstanbul".
 */
const LEADING_LOWERCASE = /(?<![\p{L}\p{N}\p{M}])\p{Ll}/gu;

/**
 * Title-cases a label for display, in any script.
 *
 * TOTAL AND CONSERVATIVE. Every input yields a string. A script with no case
 * distinction — Arabic, CJK, Hangul, Hebrew — has no lowercase letters to
 * match, so it passes through untouched, which is the correct answer rather
 * than a special case.
 *
 * Word separators are whatever is NOT a letter, digit or mark, so spaces,
 * hyphens and apostrophes all begin a word exactly as they did before:
 * "saint-denis" -> "Saint-Denis", "n'djamena" -> "N'Djamena". That parity with
 * the previous behaviour on ASCII input is asserted over the whole gazetteer.
 */
export function toDisplayCase(value: string): string {
  return value.replace(LEADING_LOWERCASE, (c) => c.toUpperCase());
}
