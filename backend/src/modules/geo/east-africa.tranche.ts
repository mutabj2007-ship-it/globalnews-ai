import {
  ladderDepthFor,
  nativeLadderFor,
  navigableRungsBelow,
  type NormalizedRung,
} from './administrative-ladder.contract';
import { supranationalById } from './supranational-membership';

/**
 * 2D — EAST AFRICA / EAC GEOGRAPHY TRANCHE.
 *
 * Built ON the 2C contract, which owns the generic ladder. This module adds
 * only what is TRUE OF EAST AFRICA and could not be expressed generically:
 *
 *   1  Kenya's ELECTORAL ladder, on its own axis, never relabelled as ADMIN
 *   2  Rwanda's Sector, as a declared deeper capability rather than a silence
 *   3  Uganda's administrative-depth gap (G-GEO-18), resolved by separating
 *      ADMINISTRATIVE depth from NAVIGABLE depth
 *   4  South Sudan's superseded subdivision set (G-GEO-17), fail-closed
 *   5  EAC as an INSTITUTION, kept apart from the five "East Africa" definitions
 *   6  Geometry and licence, fail-closed for every member
 *
 * NOTHING HERE REDEFINES THE 2C LADDER. `NormalizedRung` is untouched, no rung
 * is added, and the electoral units below are deliberately NOT `NormalizedRung`
 * values — the type system refuses to mix them.
 */

/* ── 1 · KENYA: TWO LADDERS, ONE COUNTRY ────────────────────────────────── */

/**
 * ELECTORAL UNITS ARE NOT ADMINISTRATIVE RUNGS, AND THIS IS A SEPARATE TYPE
 * SO THAT SAYING OTHERWISE DOES NOT COMPILE.
 *
 * R-GEO-1: a constituency is not a sub-county and a ward is not a district,
 * even where boundaries coincide today. Putting a constituency in ADMIN2 would
 * make an electoral unit indistinguishable from an administrative one and then
 * collide with Rwanda's real districts in the same namespace.
 *
 * Kenya runs both ladders at once, and they SHARE ONLY THEIR TOP RUNG:
 *
 *     ADMINISTRATIVE   County -> Sub-County -> Ward*        *administrative ward
 *     ELECTORAL        County -> Constituency -> Ward       *electoral ward
 *
 * The word "Ward" appears on both and means different units, which is the
 * clearest possible reason to keep the axes apart rather than merge them.
 */
export type ElectoralRung = 'ELECTORAL_COUNTY' | 'CONSTITUENCY' | 'WARD';

export const ELECTORAL_RUNG_ORDER: readonly ElectoralRung[] = [
  'ELECTORAL_COUNTY',
  'CONSTITUENCY',
  'WARD',
];

/** Whether the product can actually answer about a unit, and why not when it cannot. */
export type UnitReadiness =
  /** Units are present and addressable today. */
  | 'CARRIED'
  /** The level is real and published, but no units are in the shipped data. */
  | 'NOT_CARRIED'
  /** Units exist in the data but are known to describe a superseded division. */
  | 'SUPERSEDED';

export interface ElectoralLevel {
  readonly rung: ElectoralRung;
  readonly name: string;
  readonly plural: string;
  /** Count as the electoral authority publishes it. NOT a count of what we hold. */
  readonly publishedUnits: number;
  /** What we actually hold. */
  readonly unitsCarried: number;
  readonly readiness: UnitReadiness;
  readonly reason: string;
}

export interface ElectoralLadder {
  readonly iso2: string;
  readonly authority: string;
  readonly levels: readonly ElectoralLevel[];
  /**
   * TRUE when the top electoral rung happens to be the same set of units as the
   * top administrative rung. Kenya's counties are both — one set of 47 units
   * serving two ladders — and that coincidence must be STATED rather than left
   * for a consumer to infer, because it is a fact about Kenya and not a rule.
   */
  readonly topRungSharedWithAdministrative: boolean;
}

const KENYA_ELECTORAL: ElectoralLadder = {
  iso2: 'KE',
  authority: 'Independent Electoral and Boundaries Commission (IEBC)',
  topRungSharedWithAdministrative: true,
  levels: [
    {
      rung: 'ELECTORAL_COUNTY',
      name: 'County',
      plural: 'Counties',
      publishedUnits: 47,
      unitsCarried: 47,
      readiness: 'CARRIED',
      reason:
        'The 47 counties are carried as ADMIN1 with complete ISO 3166-2 codes. They are simultaneously the top electoral rung — the same units, reached by two ladders — which is a fact about Kenya rather than a general rule, so it is declared rather than inferred.',
    },
    {
      rung: 'CONSTITUENCY',
      name: 'Constituency',
      plural: 'Constituencies',
      publishedUnits: 290,
      unitsCarried: 0,
      readiness: 'NOT_CARRIED',
      reason:
        'The 290 constituencies are published by the IEBC and NONE are in the shipped gazetteer. They are not sub-counties and must never be placed in ADMIN2 to make them addressable; a constituency is an electoral unit whose boundaries the IEBC reviews on its own cycle.',
    },
    {
      rung: 'WARD',
      name: 'Ward',
      plural: 'Wards',
      publishedUnits: 1450,
      unitsCarried: 0,
      readiness: 'NOT_CARRIED',
      reason:
        'The 1,450 electoral wards are published by the IEBC and none are carried. NOTE the collision: Kenya also has ADMINISTRATIVE wards, which are a different set on the other axis. Merging the two axes would make that ambiguity invisible.',
    },
  ],
};

export function electoralLadderFor(iso2: string): ElectoralLadder | undefined {
  return iso2.toUpperCase() === 'KE' ? KENYA_ELECTORAL : undefined;
}

/**
 * The guard that keeps the axes apart at compile time AND at run time.
 *
 * Returns false for every electoral rung. It exists as a named function so that
 * code tempted to treat a constituency as a navigable administrative rung has
 * to delete something deliberate rather than add a branch.
 */
export function isAdministrativeRung(rung: ElectoralRung | NormalizedRung): boolean {
  return (['COUNTRY', 'ADMIN1', 'ADMIN2', 'CITY'] as string[]).includes(rung);
}

/* ── 2 · RWANDA: SECTOR AS A DECLARED CAPABILITY GAP ────────────────────── */

export interface DeeperCapability {
  readonly iso2: string;
  /** The native name of the level below the deepest rung we carry. */
  readonly name: string;
  readonly plural: string;
  /** The rung it would occupy IF a rung existed. Null when none does. */
  readonly wouldOccupyRung: NormalizedRung | null;
  readonly readiness: UnitReadiness;
  readonly reason: string;
}

/**
 * RWANDA'S SECTOR IS A REAL LEVEL WITH NO RUNG TO LIVE IN.
 *
 * 2C records Sector in `absentBelow`, which says it is missing. That is true
 * and insufficient for a regional tranche: it does not say whether the gap is a
 * dataset that could be loaded or a structural limit of the product. It is the
 * latter, and the difference decides whether anyone should go looking for data.
 */
const RWANDA_SECTOR: DeeperCapability = {
  iso2: 'RW',
  name: 'Sector',
  plural: 'Sectors',
  wouldOccupyRung: 'ADMIN3',
  readiness: 'CARRIED',
  reason:
    'Rwanda\'s ladder is Province -> District -> Sector -> Cell -> Village. ADMIN3 exists and is populated: all 416 sectors are carried under NISR authority with authoritative names and full parentage. This entry previously recorded Sector as structurally impossible to represent; that limit is gone. Boundary geometry is a separate coverage and is not held.',
};

/**
 * THE SHORTFALL IS CLOSED, AND THE SYMBOL THAT NAMED IT IS GONE.
 *
 * `RWANDA_DISTRICT_SHORTFALL` recorded that the product carried 21 of Rwanda's
 * 30 districts and that a picker had to disclose the gap. NISR now supplies all
 * 30 with authoritative names, so there is no shortfall to disclose and an
 * export whose whole purpose was to describe one would be a live statement that
 * is no longer true.
 *
 * It is REPLACED rather than edited in place, deliberately. A consumer still
 * importing the old name gets a compile error and has to look at what changed;
 * silently flipping 21 to 30 under the same name would let a surface keep
 * rendering a "list is incomplete" warning over a complete list.
 *
 * The superseded measurements are kept as audit history in
 * `RWANDA_SUPERSEDED_AUTHORITY`, which is the only place they remain.
 */
export const RWANDA_DISTRICT_COVERAGE = {
  iso2: 'RW',
  publishedUnits: 30,
  unitsCarried: 30,
  authority: 'NISR',
  readiness: 'CARRIED' as UnitReadiness,
  labelsAreAuthoritative: true,
  reason:
    'All 30 of Rwanda\'s districts are carried under NISR authority with authoritative published names. The rung is complete and a picker presents the full set. This supersedes the 21-of-30 settlement-derived shortfall, which survives only as audit history. Boundary geometry is a separate coverage and is not held.',
} as const;

export function deeperCapabilityFor(iso2: string): DeeperCapability | undefined {
  return iso2.toUpperCase() === 'RW' ? RWANDA_SECTOR : undefined;
}

/* ── 3 · G-GEO-18: ADMINISTRATIVE DEPTH IS NOT NAVIGABLE DEPTH ──────────── */

export interface DepthSplit {
  readonly iso2: string;
  /**
   * The deepest rung whose units ADMINISTER anything. COUNTRY when a country's
   * only sub-national rows are statistical or traditional.
   */
  readonly deepestAdministrativeRung: NormalizedRung;
  /** The deepest rung a picker may offer, which can be deeper. */
  readonly deepestNavigableRung: NormalizedRung;
  readonly navigable: readonly NormalizedRung[];
  /** Set whenever the two differ. Never empty when they do. */
  readonly divergenceReason?: string;
}

/**
 * G-GEO-18, RESOLVED BY SEPARATING TWO THINGS THAT WERE ONE NUMBER.
 *
 * Uganda's four ADMIN1 rows are STATISTICAL regions. They are navigable — a
 * reader can pick "Northern Region" and get news — and they administer nothing,
 * while Uganda's actual districts are absent at every rung.
 *
 * Reporting one depth for Uganda forces a choice between two wrong answers:
 * say ADMIN1 and the statistical rows masquerade as administrative units; say
 * COUNTRY and a real navigation capability disappears. So the tranche reports
 * BOTH, and the divergence carries its reason.
 *
 * This is the same discipline as 2C's three precision axes: when one number is
 * answering two questions, the fix is two numbers, not a better number.
 */
export function depthSplitFor(iso2: string): DepthSplit {
  const key = iso2.toUpperCase();
  const ladder = nativeLadderFor(key);
  const navigable = navigableRungsBelow(key, 'COUNTRY');
  const deepestNavigable = navigable.length > 0 ? navigable[navigable.length - 1] : 'COUNTRY';

  if (!ladder.declared) {
    return {
      iso2: key,
      deepestAdministrativeRung: 'COUNTRY',
      deepestNavigableRung: deepestNavigable,
      navigable,
      divergenceReason:
        'No native ladder is declared for this country, so no rung below COUNTRY can be asserted to administer anything. Navigation is unaffected; the administrative claim is simply not made.',
    };
  }

  const administrative = ladder.levels.filter((level) => level.kind === 'ADMINISTRATIVE');
  const deepestAdministrative =
    administrative.length > 0
      ? administrative[administrative.length - 1].rung
      : ('COUNTRY' as NormalizedRung);

  const nonAdministrative = ladder.levels.filter((level) => level.kind !== 'ADMINISTRATIVE');

  return {
    iso2: key,
    deepestAdministrativeRung: deepestAdministrative,
    deepestNavigableRung: deepestNavigable,
    navigable,
    divergenceReason:
      deepestAdministrative === deepestNavigable
        ? undefined
        : nonAdministrative.length > 0
          ? `${key} carries ${nonAdministrative
              .map((level) => `${level.plural} (${level.kind})`)
              .join(', ')} at rungs a picker may offer. Those units are navigable and administer nothing, so navigation reaches ${deepestNavigable} while the administrative claim stops at ${deepestAdministrative}. ${ladder.absentBelow
              .map((gap) => `${gap.name}: ${gap.reason}`)
              .join(' ')}`
          : `Navigation reaches ${deepestNavigable} through settlements, while the deepest rung that administers anything is ${deepestAdministrative}.`,
  };
}

/* ── 4 · G-GEO-17: SOUTH SUDAN, FAIL-CLOSED ────────────────────────────── */

export interface SubdivisionFreshness {
  readonly iso2: string;
  readonly readiness: UnitReadiness;
  /** What the carried rows actually describe. */
  readonly carriedDivision: string;
  /** What the country's structure is now. */
  readonly currentDivision: string;
  /** How the mismatch was detected, so the claim is checkable. */
  readonly evidence: string;
  /** What a surface must do until this is verified. */
  readonly untilVerified: string;
}

/**
 * SOUTH SUDAN'S 32 ROWS DESCRIBE A DIVISION THAT WAS ABOLISHED IN 2020.
 *
 * FAIL-CLOSED, because the failure mode is silent and confident: every row has
 * a plausible name, and a story datelined "Ruweng" resolves today to a state
 * that has not existed since February 2020, while "Unity" — a current state —
 * resolves to nothing.
 *
 * The detection is worth keeping because it generalises: 31 of the 32 rows
 * carry NO ISO 3166-2 code, and the one that does (Jonglei, SS-JG) is a name
 * that survives into the current set. ISO never coded the 32-state division, so
 * near-total absence of codes IS the signature of a superseded set inside a
 * standards-derived source.
 */
const SOUTH_SUDAN_FRESHNESS: SubdivisionFreshness = {
  iso2: 'SS',
  readiness: 'SUPERSEDED',
  carriedDivision:
    'The 32-state division created in 2015 and abolished in February 2020 (Gogrial, Gok, Jubek, Imatong, Tonj, Twic, Gbudwe, Ruweng, Maiwut, Latjoor and 22 others).',
  currentDivision:
    '10 states plus 3 administrative areas (Abyei, Pibor, Ruweng), restored by the February 2020 peace agreement.',
  evidence:
    '31 of the 32 carried rows have no ISO 3166-2 code. ISO never coded the 32-state division, so the near-total absence of codes is itself the signature. The single coded row is Jonglei (SS-JG), a name that survives into the current 10-state set.',
  untilVerified:
    'ADMIN1 for SS must not be offered as a current administrative picker and must not be used to date or place a story. Country-level navigation and the 18 carried settlements are unaffected. The set is replaced, not patched: individual names cannot be corrected one at a time because the division itself is superseded.',
};

const LATVIA_FRESHNESS_POINTER =
  'Latvia carries the same class of defect (R-GEO-FRESHNESS-LV / G-GEO-16) and belongs to the EU-27 tranche, not this one.';

export function subdivisionFreshnessFor(iso2: string): SubdivisionFreshness | undefined {
  return iso2.toUpperCase() === 'SS' ? SOUTH_SUDAN_FRESHNESS : undefined;
}

export { LATVIA_FRESHNESS_POINTER };

/* ── 5 · EAC IS AN INSTITUTION; "EAST AFRICA" IS FIVE DIFFERENT SETS ────── */

export interface AttributedDefinition {
  readonly authority: string;
  readonly kind: 'INSTITUTIONAL' | 'STATISTICAL' | 'POLITICAL' | 'OPERATIONAL';
  readonly regionName: string;
  /** Entries the authority PUBLISHES, territories included where it lists them. */
  readonly publishedEntries: number;
  /**
   * Of those, how many are sovereign states. Separate from `publishedEntries`
   * because this registry holds countries, so the two counts differ wherever an
   * authority lists dependent territories — and quoting the wrong one is how a
   * count becomes unreproducible.
   */
  readonly sovereignStates: number;
  readonly note: string;
}

/**
 * FIVE AUTHORITIES DEFINE "EAST AFRICA" AND NO TWO AGREE.
 *
 * Recorded as ATTRIBUTED DEFINITIONS with no canonical winner, per R-REG-3/4.
 * The EAC is one of them and is the only one that is a treaty organisation with
 * a published member list — which is why its 8 are a closed checkable set and
 * the others are not interchangeable with it.
 *
 * THE GENERAL MECHANISM FOR SERVING COMPETING DEFINITIONS IS 2F's, NOT THIS
 * MODULE'S. This is the East Africa DATA, recorded so 2F has something real to
 * generalise from and so no consumer in the meantime reads one authority's
 * answer as the answer.
 */
export const EAST_AFRICA_DEFINITIONS: readonly AttributedDefinition[] = [
  {
    authority: 'East African Community',
    kind: 'INSTITUTIONAL',
    regionName: 'EAC Partner States',
    publishedEntries: 8,
    sovereignStates: 8,
    note: 'A treaty organisation with a published member list: Burundi, DR Congo, Kenya, Rwanda, Somalia, South Sudan, Tanzania, Uganda. The only definition here that is a closed checkable set rather than a usage.',
  },
  {
    authority: 'UN Statistics Division (M49)',
    kind: 'STATISTICAL',
    regionName: 'Eastern Africa (014)',
    publishedEntries: 22,
    sovereignStates: 18,
    note: 'M49 lists 22 entries; 18 are sovereign states and 4 are dependent territories (British Indian Ocean Territory, French Southern Territories, Mayotte, Réunion). This registry holds COUNTRIES, so it carries the 18 — a deliberate subset, not a gap, and the reason the two counts are separate fields. The grouping reaches as far south as Zimbabwe and Mozambique, so using it as an operational filter over-captures badly.',
  },
  {
    authority: 'African Union',
    kind: 'POLITICAL',
    regionName: 'Eastern Region',
    publishedEntries: 14,
    sovereignStates: 14,
    note: 'The AU places Burundi in its CENTRAL region and Sudan in its Eastern one — disagreeing with M49 on both.',
  },
  {
    authority: 'IGAD',
    kind: 'INSTITUTIONAL',
    regionName: 'IGAD Member States',
    publishedEntries: 8,
    sovereignStates: 8,
    note: 'Eight on paper. Eritrea\'s participation has been suspended since 2007, so the operative number is commonly seven — a case where the published list and the working list differ.',
  },
  {
    authority: 'UNECA SRO-EA',
    kind: 'OPERATIONAL',
    regionName: 'Eastern Africa',
    publishedEntries: 14,
    sovereignStates: 14,
    note: 'The UN\'s own operational subregion, and NOT the same 14 as the AU\'s.',
  },
];

/**
 * The only countries every one of the five definitions includes.
 *
 * Four. Anything built on "East Africa" without naming an authority is, at
 * best, a claim about these four.
 */
export const EAST_AFRICA_UNIVERSAL_CORE: readonly string[] = ['KEN', 'SOM', 'SSD', 'UGA'];

/** Countries the authorities actively disagree about, with the disagreement. */
export const EAST_AFRICA_FLASHPOINTS: readonly { iso3: string; disagreement: string }[] = [
  {
    iso3: 'COD',
    disagreement: 'EAC and UNECA include DR Congo; M49 puts it in Middle Africa and the AU in Central.',
  },
  {
    iso3: 'SDN',
    disagreement: 'AU East and IGAD include Sudan; M49 puts it in Northern Africa and the IMF in MENA.',
  },
  {
    iso3: 'BDI',
    disagreement: 'EAC and M49 place Burundi in the east; the AU places it in Central.',
  },
  {
    iso3: 'ZMB',
    disagreement: 'M49 only. Zambia, Zimbabwe, Malawi and Mozambique are eastern by statistics and by no institution.',
  },
];

/**
 * EAC MEMBERSHIP IS READ FROM THE SHARED REGISTRY, NEVER RESTATED HERE.
 *
 * A second copy of the member list is how two lists drift apart. This resolves
 * the registry entry so the tranche and the registry cannot disagree, and the
 * spec asserts the resolution matches the eight above.
 */
export function eacMembers(): readonly string[] {
  return supranationalById('region:east-african-community')?.members ?? [];
}

/* ── 6 · GEOMETRY AND LICENCE, FAIL-CLOSED ─────────────────────────────── */

export type GeometryReadiness = 'NONE' | 'LICENCE_PENDING' | 'AVAILABLE';

export interface GeometryLicence {
  readonly iso2: string;
  readonly readiness: GeometryReadiness;
  readonly reason: string;
}

/**
 * NO BOUNDARY EXISTS ANYWHERE, SO THE ANSWER IS THE SAME FOR ALL EIGHT.
 *
 * Every extent in the artifact — all 215 country extents and all 3,020 region
 * extents — is `derived-from-settlements`: the bounding box of the settlements
 * inside a unit. That is a CAMERA AID and never a border, and a zero-span
 * point-extent is worse than none because it passes an `if (extent)` check and
 * then supplies a target with no span.
 *
 * FAIL-CLOSED IS THE WHOLE POINT: no boundary is production-ready merely
 * because a design draws one. Kenya additionally carries a licensing gate, so
 * even acquiring geometry would not by itself make county boundaries usable.
 */
export function geometryLicenceFor(iso2: string): GeometryLicence {
  const key = iso2.toUpperCase();

  if (key === 'KE') {
    return {
      iso2: key,
      readiness: 'LICENCE_PENDING',
      reason:
        'No boundary geometry is held. County and constituency boundaries are IEBC assets and their commercial reuse is not established — an official endpoint with empty licence metadata is not authority to reuse. Until that is resolved Kenya renders at COUNTRY ceiling, and this stays LICENCE_PENDING rather than NONE because the blocker is rights, not availability.',
    };
  }

  return {
    iso2: key,
    readiness: 'NONE',
    reason:
      'No boundary geometry is held for this country. Every extent in the artifact is derived from settlement positions and is a camera aid, never a border; none may be rendered as a boundary or used to decide whether a point falls inside a unit.',
  };
}

/* ── THE TRANCHE, PER MEMBER ────────────────────────────────────────────── */

export interface EacMemberProfile {
  readonly iso2: string;
  readonly iso3: string;
  readonly depth: DepthSplit;
  readonly electoral?: ElectoralLadder;
  readonly deeper?: DeeperCapability;
  readonly freshness?: SubdivisionFreshness;
  readonly geometry: GeometryLicence;
}

const EAC_ISO2_BY_ISO3: Readonly<Record<string, string>> = {
  BDI: 'BI',
  COD: 'CD',
  KEN: 'KE',
  RWA: 'RW',
  SOM: 'SO',
  SSD: 'SS',
  TZA: 'TZ',
  UGA: 'UG',
};

export function eacMemberProfile(iso3: string): EacMemberProfile | undefined {
  const key = iso3.toUpperCase();
  const iso2 = EAC_ISO2_BY_ISO3[key];
  if (!iso2) return undefined;

  return {
    iso2,
    iso3: key,
    depth: depthSplitFor(iso2),
    electoral: electoralLadderFor(iso2),
    deeper: deeperCapabilityFor(iso2),
    freshness: subdivisionFreshnessFor(iso2),
    geometry: geometryLicenceFor(iso2),
  };
}

/** Every EAC member, resolved from the registry rather than from a local list. */
export function eacTranche(): readonly EacMemberProfile[] {
  return eacMembers()
    .map((iso3) => eacMemberProfile(iso3))
    .filter((profile): profile is EacMemberProfile => profile !== undefined);
}

/** Re-exported for consumers that need the 2C depth beside the 2D split. */
export { ladderDepthFor };
