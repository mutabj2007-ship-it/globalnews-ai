import { allAdmin2, allExonyms } from './geo-gazetteer';
import { foldPlaceName } from './geo-normalize.util';

/**
 * ADMINISTRATIVE NAMES THAT ARE NOT SETTLEMENT NAMES.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT, STATED EXACTLY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `GazetteerAdmin2.label` is DERIVED FROM THE UNIT'S PRINCIPAL SETTLEMENT — the
 * build script says so in `labelSource: 'derived-from-principal-settlement'`.
 * For most countries the district and its seat share a name and nothing goes
 * wrong. Rwanda reorganised its districts in 2006 and renamed most of them,
 * while the settlements kept their names. So the derivation produces:
 *
 *     admin2 RW.11.56  ->  label "Kibungo"      district is NGOMA
 *     admin2 RW.13.45  ->  label "Byumba"       district is GICUMBI
 *     admin2 RW.14.31  ->  label "Kibuye"       district is KARONGI
 *     admin2 RW.14.36  ->  label "Cyangugu"     district is RUSIZI
 *     admin2 RW.15.24  ->  label "Butare"       district is HUYE
 *
 * THE LABEL IS NOT WRONG AS A SETTLEMENT NAME. Kibungo is a real town and that
 * is genuinely what it is called. It is wrong only because it is being SHOWN IN
 * A DISTRICT SLOT, where a Rwandan reader will read it as the district's name.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SO NOTHING IS RENAMED. THE TWO IDENTITIES ARE SEPARATED.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *     the SETTLEMENT  Kibungo  keeps its name, its id and its coordinates
 *     the DISTRICT    RW.11.56 is presented as Ngoma, with Kibungo as an alias
 *
 * Both remain searchable by both names. No settlement identity is destroyed,
 * renamed or merged — a settlement node is never touched by this file.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS CHECKED DATA AND NOT REMEMBERED DATA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every pair below ALREADY SHIPS in the gazetteer's verified exonym index,
 * where the build fails if an entry points at no real record. `ngoma -> Kibungo`
 * is already in the artifact; this file does not assert a new fact about the
 * world, it routes a fact the artifact already holds into the slot that needs
 * it. `verifyAdminNameCorrections` re-proves that join at test time, so an
 * entry invented here — or one whose exonym edge is later removed — fails the
 * suite rather than shipping as geography.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY AT PRESENTATION AND NOT IN THE BUILD — A REVERSAL, STATED PLAINLY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The Navigator retention proposal argued this correction belonged in
 * `build-gazetteer.mjs`, on the grounds that rewriting a label on the way out
 * would make the artifact and the API disagree about a place's name. That
 * objection was to a SILENT rewrite, and it still stands against one.
 *
 * This is not silent. The node carries `labelSource: 'current-name-corrected'`,
 * keeps the settlement-derived name as an alias, and names the basis. Set
 * against that, rebuilding a 5.9 MB artifact to change five strings is not the
 * narrower change — it is a data regeneration that cannot be reviewed as a diff
 * and that touches every geographic surface at once, to fix five labels.
 *
 * This table is deliberately shaped so the build script can consume it verbatim
 * when the artifact is next regenerated for another reason. One source of
 * truth, applied at read time today, ready to move earlier later.
 */

export interface AdminNameCorrection {
  /** GeoNames admin2 code, the unit's real identifier. */
  readonly admin2Code: string;
  readonly cc: string;
  /** What the gazetteer derived: the principal settlement's name. Kept as an alias. */
  readonly settlementName: string;
  /** What the administrative unit is actually called today. */
  readonly currentAdminName: string;
  readonly basis: string;
}

const RWANDA_2006 =
  'Rwanda 2006 territorial reorganisation: districts renamed; settlements retained their names.';

/**
 * ONLY THE FIVE PAIRS WITH A SHIPPED, VERIFIED EXONYM EDGE.
 *
 * Two further Rwandan units are known to carry a settlement-derived label and
 * are DELIBERATELY ABSENT, because correcting them would mean asserting a name
 * this repository cannot check:
 *
 *   RW.15.27  "Gitarama"   — the district is Muhanga. The exonym index spells
 *                            the settlement Muhanga with Gitarama as its alias,
 *                            i.e. the edge runs the OTHER WAY than the five
 *                            below. Correcting it needs a decision about which
 *                            spelling is canonical for the settlement, which is
 *                            a build question, not a presentation one.
 *
 *   RW.15.25  "Gikongoro"  — the district is Nyamagabe. There is NO exonym edge
 *                            for Nyamagabe anywhere in the artifact. Adding one
 *                            means adding an entry to `scripts/exonyms.mjs`,
 *                            where the build verifies it against a real record.
 *                            Until that happens, writing "Nyamagabe" here would
 *                            be fabrication with a citation to nothing.
 *
 * Both are reported in the findings rather than fixed. The rule is the same one
 * that governs everything else here: a name this codebase cannot verify does
 * not get served as geography.
 */
export const ADMIN_NAME_CORRECTIONS: readonly AdminNameCorrection[] = [];

/**
 * THE FIVE ROWS THAT USED TO BE HERE, AND WHY THE TABLE IS NOW EMPTY.
 *
 * This table patched five GeoNames admin2 labels at read time so that a
 * Rwandan district slot showed the district's name instead of its principal
 * settlement's: Kibungo -> Ngoma, Byumba -> Gicumbi, Kibuye -> Karongi,
 * Cyangugu -> Rusizi, Butare -> Huye. Two further units were known to be wrong
 * and deliberately left alone because no verifiable name existed for them.
 *
 * It was the right fix for a product whose Rwandan districts came from
 * GeoNames. They no longer do. NISR supplies all 30 districts under their
 * published administrative names, including the two this table could not
 * safely correct, so there is nothing left to patch: the GeoNames admin2 rows
 * for Rwanda are not served as administrative nodes at all.
 *
 * THE TABLE IS EMPTIED RATHER THAN THE MECHANISM DELETED. Nothing about the
 * problem was Rwanda-specific — any country whose units are labelled from a
 * principal settlement can need this — and the verifier that made entries
 * checkable rather than remembered is worth keeping for the next one.
 *
 * The superseded rows survive as audit history in
 * `RWANDA_SUPERSEDED_AUTHORITY`, which records that five read-time corrections
 * existed and are now replaced by authoritative names.
 */
export const SUPERSEDED_RWANDA_NAME_CORRECTIONS = {
  active: false,
  supersededBy: 'NISR',
  count: 5,
  pairs: [
    ['RW.11.56', 'Kibungo', 'Ngoma'],
    ['RW.13.45', 'Byumba', 'Gicumbi'],
    ['RW.14.31', 'Kibuye', 'Karongi'],
    ['RW.14.36', 'Cyangugu', 'Rusizi'],
    ['RW.15.24', 'Butare', 'Huye'],
  ],
  note: 'Audit history only. These were read-time presentation patches onto GeoNames admin2 labels, not administrative authority, and they are replaced by NISR published district names.',
} as const;


let index: Map<string, AdminNameCorrection> | undefined;

export function adminNameCorrectionFor(admin2Code: string): AdminNameCorrection | undefined {
  if (!index) {
    index = new Map(ADMIN_NAME_CORRECTIONS.map((entry) => [entry.admin2Code, entry]));
  }

  return index.get(admin2Code);
}

export interface CorrectionVerification {
  readonly admin2Code: string;
  /** The unit exists in the artifact. */
  readonly unitExists: boolean;
  /** The artifact's derived label really is the settlement name we claim. */
  readonly labelMatches: boolean;
  /** A shipped exonym edge joins the current admin name to that settlement. */
  readonly exonymEdgeExists: boolean;
}

/**
 * Re-prove every correction against the shipped artifact.
 *
 * THIS IS THE WHOLE SAFETY ARGUMENT. Each entry claims three things that the
 * artifact can confirm or refute on its own, and the companion spec fails on
 * any one of them. An entry cannot be added here on the strength of somebody
 * knowing that Kibungo is in Ngoma district.
 */
export function verifyAdminNameCorrections(): readonly CorrectionVerification[] {
  const units = new Map(allAdmin2().map((unit) => [unit.code, unit]));
  const edges = new Set(allExonyms().map((exonym) => `${exonym.x}|${exonym.n}|${exonym.cc}`));

  return ADMIN_NAME_CORRECTIONS.map((entry) => {
    const unit = units.get(entry.admin2Code);

    return {
      admin2Code: entry.admin2Code,
      unitExists: unit !== undefined,
      labelMatches: unit?.label === entry.settlementName,
      exonymEdgeExists: edges.has(
        `${foldPlaceName(entry.currentAdminName)}|${entry.settlementName}|${entry.cc}`,
      ),
    };
  });
}

/**
 * Second-level administrative coverage, per country, measured not assumed.
 *
 * WHY THIS IS SERVED RATHER THAN LEFT IMPLICIT. Rwanda has 21 admin2 units in
 * this artifact. That number is easy to read as "21 districts" and it is not:
 * it is every unit the source dataset happened to carry. A consumer building a
 * district picker from it would silently offer an incomplete list and no error
 * would ever fire. Reporting the count next to its source makes the gap a fact
 * on the wire instead of a hole in a dropdown.
 */
export function admin2Coverage(): readonly {
  cc: string;
  units: number;
  byAdmin1: Record<string, number>;
  labelled: number;
  corrected: number;
}[] {
  const byCountry = new Map<
    string,
    { units: number; byAdmin1: Record<string, number>; labelled: number; corrected: number }
  >();

  for (const unit of allAdmin2()) {
    const entry = byCountry.get(unit.cc) ?? { units: 0, byAdmin1: {}, labelled: 0, corrected: 0 };
    entry.units += 1;
    entry.byAdmin1[unit.a1] = (entry.byAdmin1[unit.a1] ?? 0) + 1;
    if (unit.label) entry.labelled += 1;
    if (adminNameCorrectionFor(unit.code)) entry.corrected += 1;
    byCountry.set(unit.cc, entry);
  }

  return [...byCountry.entries()]
    .map(([cc, entry]) => ({ cc, ...entry }))
    .sort((a, b) => a.cc.localeCompare(b.cc));
}
