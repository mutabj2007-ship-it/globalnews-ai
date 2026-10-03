/**
 * ════════════════════════════════════════════════════════════════════════════
 * STAGE-A · THE GOVERNED-RUN FRAGMENT GUARD
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MEASURED AT 752d8b7, BEFORE THIS FILE EXISTED:
 *
 *   "Cabo Delgado"                    -> BRA / Pernambuco / city "Cabo"
 *   "attacks in Cabo Delgado"         -> BRA / Pernambuco / city "Cabo"
 *   "floods in Cabo Delgado province" -> BRA / Pernambuco / city "Cabo"
 *   "Czech Republic"                  -> USA / city "Republic"
 *
 * Cabo Delgado is a province of MOZAMBIQUE. The resolver answered Brazil
 * because the gazetteer holds a settlement called "Cabo" in Pernambuco:
 * longest-first run consumption tries "cabo delgado", finds no CITY of that
 * name, falls back to the one-word run "cabo", and matches. "Czech Republic"
 * failed the same way through a settlement called "Republic" in the USA.
 *
 * THE DEFECT IS NOT THE FALLBACK, IT IS THE SILENCE. Falling back to a shorter
 * run is right when the shorter run is what the sentence says. It is wrong when
 * the shorter run is a FRAGMENT of a longer name THE TABLES THEMSELVES HOLD,
 * because the resolver then contradicts its own gazetteer and answers with a
 * different place on a different continent.
 *
 * ── THE SIGNAL IS POSITIVE EVIDENCE, AND THE FIRST VERSION'S WAS NOT ────────
 *
 * The first implementation of this guard refused a one-word city match whenever
 * the next token was capitalized, reasoning that a capital continues a proper
 * name. IT WAS MEASURED AGAINST TITLE-CASE HEADLINES AND IT WAS WRONG:
 *
 *   "Goma Residents Flee Fighting"  ->  NO_PLACE_EVIDENCE   (Goma refused)
 *   "Nairobi Protests Continue"     ->  NO_PLACE_EVIDENCE   (Nairobi refused)
 *   "Mogadishu Blast Wounds Ten"    ->  NO_PLACE_EVIDENCE   (Mogadishu refused)
 *
 * In a headline every word is capitalized, so "capital to the right" is not
 * evidence of a proper name at all - it is evidence of a headline. Inferring a
 * longer name from the ABSENCE of lowercase is the same mistake as inferring an
 * empty feed from the absence of an element.
 *
 * SO THE GUARD ASKS FOR THE LONGER NAME INSTEAD OF GUESSING AT IT. It refuses
 * the fragment only when a run in the SAME TEXT, strictly longer than the
 * match and containing it, WAS ITSELF RESOLVED to a governed region or
 * country. "Cabo Delgado" is a governed MZ province, so "Cabo" is refused;
 * "Kinshasa Floods" is no governed place at all, so Kinshasa stands.
 *
 * This is the containment rule the resolver already applies between a city and
 * a COUNTRY NAME ("Caledonia" inside "New Caledonia"), extended to the runs the
 * scan actually matched - which is what lets it reach regions and aliases, the
 * two cases canonical-name containment cannot see.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ────────────────────────────────────────
 *
 * AN EQUAL-LENGTH RUN IS NOT A CONTAINER. Kinshasa the city sits inside
 * Kinshasa the province and Shanghai inside Shanghai; refusing the city
 * because a region of the same name matched would destroy the finer of two
 * true answers, which is the reason the scan does not consume city tokens in
 * the first place. Only a STRICTLY LONGER run can contain a fragment.
 *
 * IT DOES NOT REACH UNGOVERNED LONGER NAMES, AND THAT COST IS STATED RATHER
 * THAN HIDDEN. "Cidade do Cabo" (Cape Town) still resolves to Cabo in Brazil,
 * because no governed entry spells Cape Town that way: the fix for that is an
 * exonym, not a heuristic. "Stade des Martyrs" still resolves to Stade in
 * GERMANY, because a stadium is a VENUE and a venue is not a weaker PLACE -
 * that needs a governed venue table. Both are recorded as cases.
 *
 * ── DIRECTION OF FAILURE ────────────────────────────────────────────────────
 *
 * The guard REFUSES; it never substitutes. Removing the fragment lets the
 * region and country tiers answer from their own evidence, and when they have
 * none the place is UNRESOLVED. Unknown place remains unresolved rather than
 * invented.
 */

/** Why a one-word match was refused. */
export const FRAGMENT_REFUSALS = ['FRAGMENT_OF_GOVERNED_RUN'] as const;
export type FragmentRefusal = (typeof FRAGMENT_REFUSALS)[number];

export interface FragmentVerdict {
  /** True when the match may stand. */
  readonly admitted: boolean;
  readonly refusal: FragmentRefusal | null;
  /** The governed run that contains the match, for the operator note. */
  readonly container: string | null;
}

const ADMITTED: FragmentVerdict = Object.freeze({
  admitted: true,
  refusal: null,
  container: null,
});

/** Does `container` hold `needle` as a contiguous whole-token sub-run? */
function containsTokenRun(container: readonly string[], needle: readonly string[]): boolean {
  if (needle.length === 0 || needle.length > container.length) return false;

  for (let i = 0; i + needle.length <= container.length; i += 1) {
    let hit = true;

    for (let j = 0; j < needle.length; j += 1) {
      if (container[i + j] !== needle[j]) {
        hit = false;
        break;
      }
    }

    if (hit) return true;
  }

  return false;
}

/**
 * Is a shorter place match a fragment of a longer governed name in the same text?
 *
 * `governedRuns` are the folded run texts the place scan RESOLVED in this text -
 * every run it accepted as a region or a country. A run that merely appeared and
 * matched nothing is not evidence and must not be passed here.
 */
export function fragmentVerdict(
  matchedText: string,
  governedRuns: readonly string[],
): FragmentVerdict {
  if (matchedText.length === 0) return ADMITTED;

  const needle = matchedText.split(' ').filter(Boolean);

  if (needle.length === 0) return ADMITTED;

  for (const run of governedRuns) {
    const tokens = run.split(' ').filter(Boolean);

    /* Equal length is the same name, not a container - see the header. */
    if (tokens.length <= needle.length) continue;
    if (!containsTokenRun(tokens, needle)) continue;

    return Object.freeze({
      admitted: false,
      refusal: 'FRAGMENT_OF_GOVERNED_RUN' as const,
      container: run,
    });
  }

  /*
   * NO GOVERNED RUN CONTAINS IT. The match is the longest reading the tables
   * support, which is what the text says.
   */
  return ADMITTED;
}
