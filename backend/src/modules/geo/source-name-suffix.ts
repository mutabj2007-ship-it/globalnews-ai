import { foldPlaceName } from './geo-normalize.util';

/**
 * R-GEO-NAME-SUFFIX — THE `", <Country>"` DISAMBIGUATOR IN SOURCE NAMES.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THE DATA ACTUALLY SAYS, MEASURED BEFORE ANYTHING WAS BUILT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 121 admin1 names in `gazetteer.v1.json` contain a comma. Of those:
 *
 *     113   the text after the last comma is EXACTLY the record's own country
 *             "Bari, Somalia"  ·  "Bay, Somalia"  ·  "Hiran, Somalia"
 *             "Nugal, Somalia" ·  "Saint George Parish, Antigua and Barbuda"
 *       8   it is NOT, and every one of them is a name that must survive intact
 *
 * The eight are the whole reason this is a rule and not a regex:
 *
 *     "Fontana, Gozo"                                   Gozo is an island
 *     "Moravče, Moravče"            "Tabor, Tabor"      unit named for its seat
 *     "Kareliya, Respublika"                            inverted Russian form
 *     "Severnaya Osetiya-Alaniya, Respublika"
 *     "Vinica Municipality, Macedonia"                  see below
 *     "Archipelago of San Andrés, Providencia and Santa Catalina"
 *     "Southern Nations, Nationalities, and Peoples' Region"
 *
 * The last two are single names that simply contain commas. A blind "strip
 * everything after the comma" would turn the Colombian archipelago into
 * "Archipelago of San Andrés" and Ethiopia's region into "Southern Nations" —
 * renaming two real places to make 113 others tidier.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A trailing segment is removed ONLY when it folds equal to the name of the
 * country the record already belongs to. Not a country — THAT country. So the
 * function cannot act on a name whose tail happens to look like a place, and it
 * cannot act at all without being told whose country the record is in.
 *
 * `Vinica Municipality, Macedonia` is DELIBERATELY LEFT ALONE. Its country is
 * "North Macedonia" and the tail is "Macedonia", which is not an exact match.
 * Treating them as the same would mean deciding that "Macedonia" names North
 * Macedonia — a judgement with a contested history that a label-tidying helper
 * has no business making. One redundant-looking label is the correct price.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTHING IS REWRITTEN AND NOTHING IS LOST
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This derives an ADDITIONAL label. The source string stays exactly as the
 * gazetteer published it, travels beside the derived one, and remains what
 * provenance and audit read. `geographyId` is not built from either — admin1
 * ids come from the ISO 3166-2 code — so no identifier moves because of this.
 */

export interface CleanedSourceName {
  /** The gazetteer's string, byte for byte. Never derived, never rewritten. */
  readonly sourceLabel: string;
  /** The label to show and to search by. Equal to `sourceLabel` unless a suffix was removed. */
  readonly searchLabel: string;
  /** True only when the record's own country name was removed from the end. */
  readonly suffixRemoved: boolean;
}

/**
 * Derives the clean search/display label for one gazetteer name.
 *
 * TOTAL AND CONSERVATIVE. Every input yields a result; when in any doubt the
 * result is the source string unchanged, which is always a correct answer.
 */
export function cleanSourceName(sourceLabel: string, countryName: string | undefined): CleanedSourceName {
  const unchanged: CleanedSourceName = { sourceLabel, searchLabel: sourceLabel, suffixRemoved: false };

  if (!countryName) return unchanged;

  const comma = sourceLabel.lastIndexOf(',');
  if (comma <= 0) return unchanged;

  const head = sourceLabel.slice(0, comma).trim();
  const tail = sourceLabel.slice(comma + 1).trim();

  /*
   * The tail must BE the country, not merely contain or resemble it. Folded on
   * both sides so casing and diacritics do not decide, using the same
   * `foldPlaceName` the rest of the module matches names with rather than a
   * fourth opinion about equality.
   */
  if (foldPlaceName(tail) !== foldPlaceName(countryName)) return unchanged;

  /*
   * A head that folds to nothing would leave the record labelless. That cannot
   * happen with the current data and is guarded anyway, because the failure
   * would be silent and the record would simply lose its name.
   */
  if (head.length === 0 || foldPlaceName(head).length === 0) return unchanged;

  return { sourceLabel, searchLabel: head, suffixRemoved: true };
}
