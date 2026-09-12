import { admin2Coverage } from './admin-name-corrections';
import {
  NISR,
  rwandaBoundaryGeometryCoverage,
  rwandaIdentityCoverage,
} from './rwanda-nisr.authority';
import { admin2PriorityCountries } from './geo-gazetteer';
import type { GeoNodePrecision } from './gazetteer-search';

/**
 * 2C — THE REGIONAL SEMANTICS / DEPTH CONTRACT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONE SENTENCE THIS MODULE EXISTS TO MAKE UNSAYABLE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *     "Province: Munster"
 *
 * Munster is one of Ireland's four provinces, and Ireland's provinces have no
 * governing body. `admin1` is a SLOT IN OUR GRAMMAR, not a level in the world,
 * and the shipped gazetteer puts at least six different real-world things in
 * it — measured, not assumed:
 *
 *     Kenya         47   Counties                ADMINISTRATIVE, current
 *     Tanzania      30   Regions                 ADMINISTRATIVE, current
 *     Somalia       18   Regions (gobolka)       ADMINISTRATIVE, current
 *     Luxembourg    12   Cantons                 ADMINISTRATIVE, sub-district
 *     Malta         68   Local councils          ADMINISTRATIVE, LOWEST rung
 *     Slovenia     212   Municipalities          ADMINISTRATIVE, LOWEST rung
 *     Ireland        4   Connacht/Leinster/…     TRADITIONAL, no administration
 *     Uganda         4   Central/Eastern/…       STATISTICAL, ABOVE the districts
 *
 * Rendering any of those as "Province" is wrong in a different way each time,
 * and for Uganda it is worse than wrong: Uganda's actual administrative
 * districts are absent at every rung, so "Province" advertises a depth the
 * product does not have.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SO THERE ARE TWO VOCABULARIES AND THEY ARE NOT THE SAME
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   NormalizedRung    COUNTRY · ADMIN1 · ADMIN2 · CITY
 *                     OURS. A machine coordinate. Stable across every country,
 *                     safe in an id, safe to compare. Says nothing about what
 *                     the rung IS anywhere.
 *
 *   NativeLevel       "County" · "Voivodeship" · "Local council" · "Province"
 *                     THE COUNTRY'S. What that rung is actually called and
 *                     whether it administers anything. Data describing a
 *                     country, never a branch on which country it is.
 *
 * `GeoNodePrecision` (COUNTRY/PROVINCE/DISTRICT/CITY) is a THIRD thing — the
 * Design v1.1 presentation vocabulary — and PROVINCE and DISTRICT there are our
 * words for a depth, not claims about administration. `precisionForRung` maps
 * between them and is deliberately lossy in the direction that matters: it
 * never invents a native meaning.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THREE PRECISION AXES, WHICH MUST NEVER COLLAPSE INTO ONE NUMBER
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   NAVIGATION   how far a picker may let someone DRILL. A data question.
 *   EVIDENCE     how precisely a STORY's location is known. An evidence
 *                question, and never raised by navigation: existing in a
 *                hierarchy is not evidence at that place (R-GEO-3).
 *   ENTITLEMENT  how far this ACCOUNT is allowed to see. A commercial question,
 *                read from configuration, absent from this module entirely.
 *
 * They are separate TYPES here, not separate conventions, so a caller cannot
 * pass one where another is expected and have it compile. The failure this
 * prevents is specific: merging navigation and entitlement would tell a
 * restricted user that district data does not exist, and make a real data gap
 * look like something an upgrade could buy. Neither is true.
 */

/* ── 1 · THE MACHINE RUNG ───────────────────────────────────────────────── */

/** OURS. A coordinate, not a claim. */
export type NormalizedRung = 'COUNTRY' | 'ADMIN1' | 'ADMIN2' | 'ADMIN3' | 'CITY';

/**
 * -- ADMIN3 ADDED: MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1, PO RULING 2 -----
 *
 * "ADMIN3 / SECTOR becomes a first-class geography rung."
 *
 * Before this the ladder stopped at ADMIN2, and this file's own Rwanda entry
 * recorded the consequence: "No admin3 rung exists in this product at all, for
 * any country" -- so a sector had nowhere to live, and loading sector data
 * would have had nothing to load it into. That is now a rung.
 *
 * ARCHITECTURE LANDS; DATA DOES NOT FOLLOW AUTOMATICALLY, and the ruling is
 * explicit that it must not be made to: no sector names derived from
 * settlements, no invented polygons, no settlement-derived district label
 * promoted to authoritative. `ladderDepthFor` therefore reports ADMIN3
 * unsupported for every country until a real dataset arrives, which is a
 * COVERAGE GAP rather than a floor.
 */
export const RUNG_ORDER: readonly NormalizedRung[] = ['COUNTRY', 'ADMIN1', 'ADMIN2', 'ADMIN3', 'CITY'];

/**
 * Maps our machine rung onto the Design v1.1 presentation vocabulary.
 *
 * PROVINCE and DISTRICT here are OUR NAMES FOR A DEPTH. They are not assertions
 * that the unit is a province or a district anywhere, which is exactly why a
 * surface must render `NativeLevel.name` and not this.
 */
export function precisionForRung(rung: NormalizedRung): GeoNodePrecision {
  switch (rung) {
    case 'COUNTRY':
      return 'COUNTRY';
    case 'ADMIN1':
      return 'PROVINCE';
    case 'ADMIN2':
      return 'DISTRICT';
    case 'ADMIN3':
      /*
       * -- THE TEMPORARY SEMANTIC DEPENDENCY IS REMOVED --------------------
       *
       * This arm used to return 'DISTRICT'. That was a deliberate stand-in,
       * documented as such, for one reason only: `GeoNodePrecision` had no
       * SECTOR token, so a sector had no honest precision to report and the
       * coarser neighbour was the only answer that did not overclaim.
       *
       * SECTOR is now a first-class token in all five precision vocabularies
       * and the authoritative sector data exists, so the stand-in has stopped
       * being conservative and started being WRONG: reporting a sector as
       * DISTRICT precision states that sector-level evidence addresses a
       * district, which is a 45 km halo around a 4.5 km place.
       *
       * The guard it leaned on is untouched and still governs:
       * `assertNavigationDoesNotRaiseEvidence` means a reader NAVIGATING to a
       * sector does not thereby make any evidence sector-precise. This function
       * maps a RUNG to the precision that rung denotes; what an individual
       * piece of evidence may claim is decided by the evidence, not by where it
       * sits in a hierarchy.
       */
      return 'SECTOR';
    case 'CITY':
      return 'CITY';
  }
}

/* ── 2 · WHAT THE RUNG IS, WHERE IT IS ──────────────────────────────────── */

/**
 * What a level DOES, which is a different question from what it is called.
 *
 * The distinction earns its place because it changes what a surface may offer.
 * A TRADITIONAL or STATISTICAL level can be navigated and labelled, but it
 * governs nothing, so it must never be presented as the administrative unit a
 * reader would act on.
 */
export type NativeLevelKind =
  /** Has a governing body with administrative competence. */
  | 'ADMINISTRATIVE'
  /** Used for statistics or planning; no administration of its own. */
  | 'STATISTICAL'
  /** Cultural or historical; no administration and often no current legal status. */
  | 'TRADITIONAL'
  /** Exists for elections only, and is a SEPARATE AXIS from the administrative one. */
  | 'ELECTORAL';

export interface NativeLevel {
  readonly rung: NormalizedRung;
  /** Singular, as the country names it. Rendered to readers. */
  readonly name: string;
  /** Plural, because "3 Countys" is how a contract leaks into a UI. */
  readonly plural: string;
  readonly kind: NativeLevelKind;
  /** Why this is the right name and kind. Never empty. */
  readonly note: string;
}

export interface NativeLadder {
  readonly iso2: string;
  readonly levels: readonly NativeLevel[];
  /**
   * Levels the country really has that this product does NOT carry, named so a
   * gap is a stated fact rather than a silent floor.
   */
  readonly absentBelow: readonly { readonly name: string; readonly reason: string }[];
}

/**
 * DECLARED PER COUNTRY, AND DELIBERATELY INCOMPLETE.
 *
 * Every entry here was read off the shipped gazetteer's own rows and checked
 * against what that country calls the unit. A country NOT in this table returns
 * UNDECLARED and its rung is rendered by the neutral machine name — which is
 * honest, where guessing "Province" would not be.
 *
 * THIS IS NOT `admin2Priority` BY ANOTHER ROUTE. Nothing here changes which
 * data is built or how deep navigation may go. Adding a country adds a NAME;
 * depth is measured from the artifact in section 4 and cannot be widened from
 * this table. `ladderDoesNotDetermineDepth` asserts exactly that.
 */
const NATIVE_LADDERS: Readonly<Record<string, NativeLadder>> = {
  /* ── EAC ─────────────────────────────────────────────────────────────── */
  KE: {
    iso2: 'KE',
    levels: [
      {
        rung: 'ADMIN1',
        name: 'County',
        plural: 'Counties',
        kind: 'ADMINISTRATIVE',
        note: 'The 47 counties of the 2010 Constitution. All 47 are present with complete ISO 3166-2 codes, so Kenya\'s top rung is already the electoral ladder\'s County level too.',
      },
    ],
    absentBelow: [
      {
        name: 'Sub-County',
        reason: 'Administrative axis. No admin2 units for KE in the shipped gazetteer.',
      },
      {
        name: 'Constituency',
        reason:
          'ELECTORAL axis, not administrative — a constituency is not a sub-county even where boundaries coincide. No rung carries it, and county geometry additionally depends on IEBC boundary licensing.',
      },
      {
        name: 'Ward',
        reason: 'Electoral axis, one rung below Constituency. Not carried.',
      },
    ],
  },
  RW: {
    iso2: 'RW',
    levels: [
      {
        rung: 'ADMIN1',
        name: 'Province',
        plural: 'Provinces',
        kind: 'ADMINISTRATIVE',
        note: 'Four provinces plus Kigali City, which is a province-level unit rather than a province.',
      },
      {
        rung: 'ADMIN2',
        name: 'District',
        plural: 'Districts',
        kind: 'ADMINISTRATIVE',
        note: 'Rwanda has 30 districts and all 30 are carried under NISR authority with authoritative names. The prior state -- 21 units, every label derived from a principal settlement -- is superseded and survives only as audit history in RWANDA_SUPERSEDED_AUTHORITY. Boundary polygons are a separate coverage and are not yet held.',
      },
      {
        rung: 'ADMIN3',
        name: 'Sector',
        plural: 'Sectors',
        kind: 'ADMINISTRATIVE',
        note: 'The rung below District. All 416 sectors are carried under NISR authority with authoritative names and full parentage. Sector names are never derived from settlements; these are the published administrative names. Boundary polygons are a separate coverage and are not yet held.',
      },
    ],
    absentBelow: [
      {
        name: 'Cell',
        reason:
          'The rung below Sector. No rung below ADMIN3 exists in this product for any country, so a cell has nowhere to live. Sector itself is now POPULATED -- 416 units under NISR authority -- so the honest statement about Cell is that the product has no rung for it, not that the data is missing.',
      },
    ],
  },
  UG: {
    iso2: 'UG',
    levels: [
      {
        rung: 'ADMIN1',
        name: 'Region',
        plural: 'Regions',
        kind: 'STATISTICAL',
        note: 'Central, Eastern, Northern and Western. These are statistical regions with no administration, and they sit ABOVE Uganda\'s districts rather than being them.',
      },
    ],
    absentBelow: [
      {
        name: 'District',
        reason:
          'Uganda\'s actual administrative rung, and the sharpest gap in EAC: the four rows we hold are statistical, so Uganda has NO administrative unit at any rung here.',
      },
    ],
  },
  TZ: {
    iso2: 'TZ',
    levels: [
      {
        rung: 'ADMIN1',
        name: 'Region',
        plural: 'Regions',
        kind: 'ADMINISTRATIVE',
        note: 'Thirty administrative regions (mikoa). Unlike Uganda\'s, these do administer.',
      },
    ],
    absentBelow: [{ name: 'District', reason: 'No admin2 units for TZ in the shipped gazetteer.' }],
  },
  SO: {
    iso2: 'SO',
    levels: [
      {
        rung: 'ADMIN1',
        name: 'Region',
        plural: 'Regions',
        kind: 'ADMINISTRATIVE',
        note: 'Eighteen regions (gobolka), complete with ISO 3166-2 codes. Four carry a ", Somalia" source suffix, handled by R-GEO-NAME-SUFFIX rather than by renaming the source.',
      },
    ],
    absentBelow: [{ name: 'District', reason: 'No admin2 units for SO in the shipped gazetteer.' }],
  },
  BI: {
    iso2: 'BI',
    levels: [
      {
        rung: 'ADMIN1',
        name: 'Province',
        plural: 'Provinces',
        kind: 'ADMINISTRATIVE',
        note: 'Eighteen provinces. Burundi has communes below them; none are carried here.',
      },
    ],
    absentBelow: [{ name: 'Commune', reason: 'No admin2 units for BI in the shipped gazetteer.' }],
  },
  CD: {
    iso2: 'CD',
    levels: [
      {
        rung: 'ADMIN1',
        name: 'Province',
        plural: 'Provinces',
        kind: 'ADMINISTRATIVE',
        note: 'Twenty-six provinces since the 2015 découpage.',
      },
    ],
    absentBelow: [
      { name: 'Territory', reason: 'No admin2 units for CD in the shipped gazetteer.' },
    ],
  },
  SS: {
    iso2: 'SS',
    levels: [
      {
        rung: 'ADMIN1',
        name: 'State',
        plural: 'States',
        kind: 'ADMINISTRATIVE',
        note: 'FRESHNESS HOLD (R-GEO-FRESHNESS-SSD). The 32 rows carried are the 2015-2020 division, abolished February 2020, and 31 of 32 carry no ISO 3166-2 code because ISO never coded that division. The name of the level is right; the SET is not verified against the current structure and must be before production use.',
      },
    ],
    absentBelow: [
      { name: 'County', reason: 'No admin2 units for SS in the shipped gazetteer.' },
    ],
  },

  /* ── EU-27, the countries whose rows were actually read ──────────────── */
  PL: {
    iso2: 'PL',
    levels: [
      {
        rung: 'ADMIN1',
        name: 'Voivodeship',
        plural: 'Voivodeships',
        kind: 'ADMINISTRATIVE',
        note: 'Sixteen voivodeships (województwa). "Province" is a common English gloss and is not what the unit is called.',
      },
      {
        rung: 'ADMIN2',
        name: 'Powiat',
        plural: 'Powiaty',
        kind: 'ADMINISTRATIVE',
        note: 'The artifact carries 380, which is 380 of the 401 admin2 units in the whole gazetteer. That concentration is the shape R-GEO-4 forbids becoming permanent.',
      },
    ],
    absentBelow: [
      { name: 'Gmina', reason: 'Poland\'s rung below Powiat. No admin3 rung exists here.' },
    ],
  },
  LV: {
    iso2: 'LV',
    levels: [
      {
        rung: 'ADMIN1',
        name: 'Municipality',
        plural: 'Municipalities',
        kind: 'ADMINISTRATIVE',
        note: 'FRESHNESS HOLD (R-GEO-FRESHNESS-LV). The 119 rows are exactly the pre-2021 division — 110 novadi plus 9 republican cities — and the current structure is 43 units. Every row carries an ISO code, so nothing about the data looks broken from inside.',
      },
    ],
    absentBelow: [],
  },
  SI: {
    iso2: 'SI',
    levels: [
      {
        rung: 'ADMIN1',
        name: 'Municipality',
        plural: 'Municipalities',
        kind: 'ADMINISTRATIVE',
        note: 'Slovenia has no rung between the state and its 212 municipalities, so admin1 here is the LOWEST administrative level, not the highest.',
      },
    ],
    absentBelow: [],
  },
  MT: {
    iso2: 'MT',
    levels: [
      {
        rung: 'ADMIN1',
        name: 'Local council',
        plural: 'Local councils',
        kind: 'ADMINISTRATIVE',
        note: 'Sixty-eight local councils. Like Slovenia this is the lowest rung, so "Province: Attard" would name a town of roughly eleven thousand people as a province.',
      },
    ],
    absentBelow: [],
  },
  LU: {
    iso2: 'LU',
    levels: [
      {
        rung: 'ADMIN1',
        name: 'Canton',
        plural: 'Cantons',
        kind: 'ADMINISTRATIVE',
        note: 'Twelve cantons, which sit between the state and its communes. Cantons administer, but Luxembourg\'s communes are the rung a resident deals with.',
      },
    ],
    absentBelow: [
      { name: 'Commune', reason: 'No admin2 units for LU in the shipped gazetteer.' },
    ],
  },
  IE: {
    iso2: 'IE',
    levels: [
      {
        rung: 'ADMIN1',
        name: 'Province',
        plural: 'Provinces',
        kind: 'TRADITIONAL',
        note: 'Connacht, Leinster, Munster and Ulster. These have NO governing body — the name is right and the kind is what stops a surface presenting them as administrative units.',
      },
    ],
    absentBelow: [
      {
        name: 'County',
        reason:
          'Ireland\'s actual administrative rung. Not carried at admin2, so Ireland has no administrative unit at any rung here.',
      },
    ],
  },
};

/** Returned when no ladder is declared. Not a failure — a stated absence. */
export interface UndeclaredLadder {
  readonly iso2: string;
  readonly declared: false;
  readonly reason: string;
}

export type LadderResult = (NativeLadder & { readonly declared: true }) | UndeclaredLadder;

/**
 * The native ladder for a country, or a stated absence.
 *
 * A surface that gets `declared: false` MUST fall back to the neutral machine
 * rung, never to "Province". Saying "Admin 1" is unhelpful; saying "Province"
 * about Ireland is wrong, and a contract should make the unhelpful answer
 * available rather than the wrong one.
 */
export function nativeLadderFor(iso2: string | undefined): LadderResult {
  const key = (iso2 ?? '').toUpperCase();
  const found = NATIVE_LADDERS[key];

  if (!found) {
    return {
      iso2: key,
      declared: false,
      reason:
        'No native administrative ladder is declared for this country. The rung is reported by its neutral machine name; no level name is guessed, because the same slot holds counties, cantons, local councils, statistical regions and traditional provinces in different countries.',
    };
  }

  return { ...found, declared: true };
}

export function nativeLevelFor(iso2: string | undefined, rung: NormalizedRung): NativeLevel | undefined {
  const ladder = nativeLadderFor(iso2);

  return ladder.declared ? ladder.levels.find((level) => level.rung === rung) : undefined;
}

/** Every country with a declared ladder. For coverage reporting, not for depth. */
export function declaredLadderCountries(): readonly string[] {
  return Object.keys(NATIVE_LADDERS).sort();
}

/* ── 3 · THE THREE PRECISION AXES, AS SEPARATE TYPES ────────────────────── */

declare const AXIS: unique symbol;

/** How far a picker may let someone drill. A DATA question. */
export type NavigationPrecision = GeoNodePrecision & { readonly [AXIS]?: 'navigation' };
/** How precisely a story's location is known. An EVIDENCE question. */
export type EvidencePrecision = GeoNodePrecision & { readonly [AXIS]?: 'evidence' };
/** How far this account may see. A COMMERCIAL question, owned elsewhere. */
export type EntitlementPrecision = GeoNodePrecision & { readonly [AXIS]?: 'entitlement' };

/**
 * The rule, enforced rather than documented: NAVIGATION NEVER RAISES EVIDENCE.
 *
 * Returns the evidence precision unchanged, whatever the navigation depth. It
 * exists as a function so that any future code tempted to promote a story
 * because the map can drill further has to delete a named guard to do it.
 *
 * This is R-GEO-3 in executable form: existing in a hierarchy is not evidence
 * at that place.
 */
export function assertNavigationDoesNotRaiseEvidence(
  evidence: EvidencePrecision,
  navigation: NavigationPrecision,
): EvidencePrecision {
  void navigation;

  return evidence;
}

/**
 * NO ENTITLEMENT VALUE APPEARS IN THIS MODULE, and none may.
 *
 * The entitlement ceiling is read from configuration by the lane that owns
 * commerce, and applied ON TOP of the data limit. The narrower of the two wins
 * at render time, and because they arrive separately a surface can say WHICH
 * one bound the result — which is the whole point of keeping them apart.
 */
export const ENTITLEMENT_CEILING_IS_NOT_OWNED_HERE = true as const;

/* ── 4 · DEPTH, MEASURED FROM THE ARTIFACT ──────────────────────────────── */

export interface RungSupport {
  readonly rung: NormalizedRung;
  readonly supported: boolean;
  readonly units?: number;
  /** Required whenever `supported` is false. Never empty. */
  readonly reason?: string;
}

export interface LadderDepth {
  readonly iso2: string;
  /** The deepest rung the SHIPPED DATA supports. Not an entitlement ceiling. */
  readonly deepestSupportedRung: NormalizedRung;
  readonly rungs: readonly RungSupport[];
  /** Every unsupported rung with its reason, coarsest first. */
  readonly unsupportedBelow: readonly { readonly rung: NormalizedRung; readonly reason: string }[];
}

/**
 * MEASURED, PER COUNTRY, FROM `admin2Coverage()` — WHICH READS THE ARTIFACT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * R-GEO-DEPTH: DEPTH IS NOT DERIVED FROM `admin2Priority`, AND MUST NOT BE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `admin2Priority` is `['RW','PL']` — a BUILD input saying which countries the
 * gazetteer builder was told to complete. Reading depth from it would make the
 * literal list the definition of capability, so the way to "support" a country
 * would be to append its code. That is the expansion R-GEO-DEPTH forbids.
 *
 * This function never reads it. It counts units actually present, so a build
 * that adds Kenyan admin2 data makes Kenya deeper with no code change here, and
 * appending 'KE' to the priority list with no data changes nothing.
 * `depthIgnoresPriorityList` asserts both directions.
 */
export function ladderDepthFor(iso2: string | undefined): LadderDepth {
  const key = (iso2 ?? '').toUpperCase();
  /*
   * AN AUTHORITATIVE COUNTRY'S ADMIN2 COUNT COMES FROM ITS AUTHORITY.
   *
   * `admin2Coverage()` counts the GeoNames rows in the shipped artifact, and
   * for Rwanda that is 21 -- the number this product used to serve as "Rwanda's
   * districts" and no longer does. The artifact still holds those 21 rows and
   * the coverage function is still right about them; it is simply no longer the
   * answer to how many districts Rwanda has. That answer belongs to NISR, and
   * it is 30.
   */
  const authoritative = key === 'RW' ? rwandaIdentityCoverage() : undefined;
  const admin2 = admin2Coverage().find((entry) => entry.cc === key);
  const admin2Units =
    authoritative?.find((row) => row.rung === 'ADMIN2')?.carriedUnits ?? admin2?.units ?? 0;
  const hasAdmin2 = admin2Units > 0;
  const ladder = nativeLadderFor(key);

  const unsupportedBelow: { rung: NormalizedRung; reason: string }[] = [];

  if (!hasAdmin2) {
    const named = ladder.declared
      ? ladder.absentBelow.find((entry) => entry.reason.includes('admin2'))
      : undefined;

    unsupportedBelow.push({
      rung: 'ADMIN2',
      reason: named
        ? `${named.name}: ${named.reason}`
        : key
          ? `No second-level administrative units are present for ${key} in the shipped gazetteer. Districts are never synthesised from settlements.`
          : 'No second-level administrative units are present for this country in the shipped gazetteer.',
    });
  }

  /*
   * CITY IS SUPPORTED INDEPENDENTLY OF ADMIN2, and that is not a bug.
   *
   * Settlements come from a different source than second-level units, so a
   * country can have cities and no districts. The ladder is therefore not
   * strictly nested for navigation, and `deepestSupportedRung` reports the
   * deepest rung that IS supported while `unsupportedBelow` names the hole in
   * the middle. Reporting CITY without naming the missing ADMIN2 would be the
   * dishonest simplification.
   */
  /*
   * ADMIN3 IS SUPPORTED WHERE AN AUTHORITY CARRIES SECTORS, AND NOWHERE ELSE.
   *
   * This used to be unconditionally unsupported, because no sector dataset
   * existed for any country. Rwanda now has one -- 416 units, NISR, authoritative
   * names, full parentage -- so the rung reports supported FOR RWANDA and stays
   * unsupported everywhere else, with the reason naming the absence.
   *
   * MEASURED, NOT DECLARED. The count comes from the authority artifact via
   * `rwandaIdentityCoverage()`, so a truncated or missing artifact makes the
   * rung unsupported rather than making this function lie. Adding a country to
   * any priority list still changes nothing here.
   *
   * IDENTITY, NOT GEOMETRY. A supported ADMIN3 means the product can NAME and
   * TRAVERSE the sectors. It says nothing about boundary polygons, which are a
   * separate coverage reported by `rwandaBoundaryGeometryCoverage()` and are
   * currently absent. A picker may offer sectors; a renderer may not draw their
   * borders.
   */
  const admin3Units = authoritative?.find((row) => row.rung === 'ADMIN3')?.carriedUnits ?? 0;
  const hasAdmin3 = admin3Units > 0;

  const admin3Reason = hasAdmin3
    ? `ADMIN3 / Sector is supported for ${key}: ${admin3Units} units under ${NISR} authority with authoritative names and full parentage. Boundary geometry is a SEPARATE coverage and is not held; see rwandaBoundaryGeometryCoverage().`
    : 'ADMIN3 / Sector is a declared rung of this product, and no sector dataset is carried for this country in the shipped gazetteer. ' +
      'Sector names are never derived from settlements and no sector geometry is synthesised, so the rung is present and empty. This is a COVERAGE GAP, not a floor.';

  if (!hasAdmin3) unsupportedBelow.push({ rung: 'ADMIN3', reason: admin3Reason });

  const rungs: RungSupport[] = [
    { rung: 'COUNTRY', supported: true },
    { rung: 'ADMIN1', supported: true },
    hasAdmin2
      ? { rung: 'ADMIN2', supported: true, units: admin2Units }
      : { rung: 'ADMIN2', supported: false, reason: unsupportedBelow[0].reason },
    hasAdmin3
      ? { rung: 'ADMIN3', supported: true, units: admin3Units, reason: admin3Reason }
      : { rung: 'ADMIN3', supported: false, units: 0, reason: admin3Reason },
    { rung: 'CITY', supported: true },
  ];

  return {
    iso2: key,
    deepestSupportedRung: 'CITY',
    rungs,
    unsupportedBelow,
  };
}

/**
 * The rungs a picker may offer below a target, in order, with holes removed.
 *
 * Derived from measured support rather than from the enum, so a rung with no
 * data behind it never reaches a dropdown.
 */
export function navigableRungsBelow(
  iso2: string | undefined,
  from: NormalizedRung,
): readonly NormalizedRung[] {
  const depth = ladderDepthFor(iso2);
  const blocked = new Set(depth.unsupportedBelow.map((entry) => entry.rung));
  const start = RUNG_ORDER.indexOf(from) + 1;

  return RUNG_ORDER.slice(start).filter((rung) => !blocked.has(rung));
}

/**
 * What 2D/2E/2F consume: identity, semantics and depth for one country, in the
 * shape the regional packages were told to deliver.
 *
 * GEOMETRY AND LICENCE ARE DELIBERATELY ABSENT. There is no boundary polygon
 * anywhere in the artifact — every extent is derived from settlements and is a
 * camera aid, never a border — so geometry is a readiness COLUMN in the
 * regional packages, not a field this contract can populate.
 */
export interface CountryLadderContract {
  readonly iso2: string;
  readonly ladder: LadderResult;
  readonly depth: LadderDepth;
  readonly navigableFromCountry: readonly NormalizedRung[];
}

export function countryLadderContract(iso2: string): CountryLadderContract {
  return {
    iso2: iso2.toUpperCase(),
    ladder: nativeLadderFor(iso2),
    depth: ladderDepthFor(iso2),
    navigableFromCountry: navigableRungsBelow(iso2, 'COUNTRY'),
  };
}

/** Exposed so a test can prove depth does not read it. */
/* -- 5 - RWANDA COVERAGE TRUTH -------------------------------------------- */

/**
 * WHAT RWANDA'S ADMINISTRATIVE COVERAGE ACTUALLY IS, AS A VALUE.
 *
 * PO ruling 2: "Current measured district state: 21 / 30, all 21
 * derived-from-principal-settlement, must be represented as incomplete /
 * non-authoritative coverage."
 *
 * It is a value rather than prose because a surface has to be able to SAY it.
 * The two failures this exists to prevent are different from each other and
 * both are quiet:
 *
 *   1. presenting 21 districts as if they were the country's districts, so a
 *      reader concludes nine districts have no news rather than no data;
 *   2. presenting a settlement-derived label as the district's name, so
 *      "Kibungo" reads as an authoritative name for what is actually Ngoma.
 *
 * MEASURED, NOT DECLARED: `publishedUnits` is Rwanda's real count and
 * `carriedUnits` is what `admin2Coverage()` reports from the shipped artifact.
 * `labelsAreAuthoritative` is false because every carried label has
 * `labelSource: 'derived-from-principal-settlement'`.
 */
export interface AdministrativeCoverageTruth {
  readonly iso2: string;
  readonly rung: NormalizedRung;
  /** How many units the country really has. */
  readonly publishedUnits: number;
  /** How many the shipped artifact carries. */
  readonly carriedUnits: number;
  /** False when labels are derived rather than authoritative. */
  readonly labelsAreAuthoritative: boolean;
  readonly labelSource: string;
  /** True whenever a surface must show a coverage gap for this rung. */
  readonly isCoverageGap: boolean;
  readonly note: string;
}

const GEOMETRY_NOTE =
  ' ADMINISTRATIVE IDENTITY is complete at this rung. BOUNDARY GEOMETRY is a separate coverage, is currently ' +
  'absent, and is reported by rwandaBoundaryGeometryCoverage(). A surface may name and traverse these units ' +
  'and may not draw their borders.';

/**
 * MEASURED FROM THE AUTHORITY ARTIFACT, NOT DECLARED HERE.
 *
 * These rows used to be literals describing the GeoNames shortfall: 21 of 30
 * districts, 0 of 416 sectors, no authoritative labels. That state is
 * superseded and survives only in `RWANDA_SUPERSEDED_AUTHORITY` as audit
 * history, which is where the receiving contract puts it.
 *
 * What replaces it counts the artifact. `carriedUnits` and `isCoverageGap` come
 * from `rwandaIdentityCoverage()`, so this table cannot claim a coverage the
 * data does not support: a truncated artifact reports a gap instead of
 * reporting 30.
 */
export const RWANDA_ADMIN_COVERAGE: readonly AdministrativeCoverageTruth[] =
  rwandaIdentityCoverage()
    .filter((row) => row.rung !== 'ADMIN1')
    .map((row) => ({
      iso2: row.iso2,
      rung: row.rung as NormalizedRung,
      publishedUnits: row.publishedUnits,
      carriedUnits: row.carriedUnits,
      labelsAreAuthoritative: row.labelsAreAuthoritative,
      labelSource: row.labelSource,
      isCoverageGap: row.isCoverageGap,
      note:
        (row.rung === 'ADMIN2'
          ? `All ${row.carriedUnits} of Rwanda's ${row.publishedUnits} districts are carried under ${row.authority} authority with authoritative published names.`
          : `All ${row.carriedUnits} of Rwanda's ${row.publishedUnits} sectors are carried under ${row.authority} authority with authoritative published names and full parentage.`) +
        GEOMETRY_NOTE,
    }));

/**
 * The boundary half of the two-dimensional coverage answer, re-exported so a
 * consumer reading administrative truth from this module cannot reach identity
 * coverage without geometry coverage being one call away.
 */
export function rwandaBoundaryCoverage(): ReturnType<typeof rwandaBoundaryGeometryCoverage> {
  return rwandaBoundaryGeometryCoverage();
}

export function administrativeCoverageTruth(
  iso2: string | undefined,
  rung: NormalizedRung,
): AdministrativeCoverageTruth | undefined {
  const key = (iso2 ?? '').toUpperCase();
  return RWANDA_ADMIN_COVERAGE.find((entry) => entry.iso2 === key && entry.rung === rung);
}

export function admin2PriorityListForAudit(): readonly string[] {
  return admin2PriorityCountries();
}
