/**
 * ════════════════════════════════════════════════════════════════════════════
 * DECLARED PRODUCT REGIONS — RSC-1 IS NARROWED, NOT REPEALED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Product-Owner ruling 2 of MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1, with the
 * Middle East and East Africa memberships supplied by the Product Owner in the
 * follow-up ruling:
 *
 *   "Do NOT repeal RSC-1 globally. Keep REGIONAL_NO_CLAIM for ambiguous/
 *    unbounded region labels whose membership is undefined … Only
 *    DECLARED_PRODUCT_REGION may aggregate member-country evidence."
 *
 * RSC-1's reasoning is preserved exactly where it applies. It refused regional
 * aggregation because "member evidence differs in precision, provenance and
 * retrieval readiness; summing it would produce a regional number whose ceiling
 * nobody could state". That objection is about UNKNOWN MEMBERSHIP and UNSTATED
 * CEILINGS. A governed region answers the first by naming its members and the
 * second through `coverageAccountingFor`, which reports the uncovered members
 * BY NAME. An operational label like "the Sahel" can answer neither, and keeps
 * REGIONAL_NO_CLAIM.
 *
 * ── TWO KINDS OF MEMBERSHIP, AND WHY THE DISTINCTION IS A FIELD ─────────────
 *
 * BACKEND_PUBLISHED — the membership already exists in an external standard or
 * treaty and the backend publishes it (`supranational-membership.ts` via
 * `/geo/place` and `/geo/children`). These entries carry NO member list here.
 * Copying those ISO3 lists into the frontend would create a second source of
 * truth that could drift silently, and a region whose membership two files
 * disagree about is exactly what RSC-1 refused to aggregate over.
 *
 * PRODUCT_GOVERNED — no external standard defines the region the product means,
 * so the Product Owner declares the membership and it lives here, explicitly.
 * This is the ONLY place a member list may be written, and every such entry
 * must say out loud that it is a product coverage decision rather than an
 * agreed geography.
 *
 * ── WHAT A PRODUCT-GOVERNED REGION IS NOT ──────────────────────────────────
 *
 * Not a claim that the membership is universally agreed. Not a boundary — see
 * `regionMayHighlight`, which still returns `false` for every region including
 * these. Not permission to widen: `excludedPending` records the countries that
 * were considered and deliberately left out, so a later quiet addition fails a
 * test instead of passing unnoticed.
 */

/** The scope a region selection carries. RSC-1's value plus the governed one. */
export const REGIONAL_NO_CLAIM = 'REGIONAL_NO_CLAIM' as const;
export const DECLARED_PRODUCT_REGION = 'DECLARED_PRODUCT_REGION' as const;

export type RegionalScope = typeof REGIONAL_NO_CLAIM | typeof DECLARED_PRODUCT_REGION;

export type MembershipSource = 'BACKEND_PUBLISHED' | 'PRODUCT_GOVERNED';

export interface ExcludedMember {
  readonly iso3: string;
  readonly reason: string;
}

export interface DeclaredProductRegion {
  /** The published region id the backend already resolves, or the product id. */
  readonly id: string;
  /** Display key. Never a hard-coded English string at a call site. */
  readonly label: string;
  /** WHO declares the membership. */
  readonly authority: string;
  /** The authority's own version/edition, so a change is visible as a change. */
  readonly authorityVersion: string;
  readonly membershipSource: MembershipSource;
  /** How membership reaches the product, stated as a path not as a promise. */
  readonly provenance: string;
  /**
   * PRODUCT_GOVERNED only. `null` for BACKEND_PUBLISHED, where writing a list
   * here would be the second source of truth this module exists to avoid.
   */
  readonly members: readonly string[] | null;
  /** Considered and deliberately excluded. Empty is allowed; silence is not. */
  readonly excludedPending: readonly ExcludedMember[];
}

/* ── PRODUCT-GOVERNED MEMBERSHIPS, EXACTLY AS THE PRODUCT OWNER DECLARED ──── */

/**
 * "For Alpha, define the GlobalNews AI Middle East monitoring region as … This
 * is an OPERATIONAL PRODUCT COVERAGE REGION. It is NOT a claim that this
 * membership is universally agreed."
 *
 * Sixteen countries, in the order declared. The backend records Middle East as
 * `CONTESTED_MEMBERSHIP` with an empty list and the source note "No agreed
 * membership. UN M49 has no 'Middle East'" — which is why this list is
 * product-governed and says so, rather than pretending to a standard.
 */
const MIDDLE_EAST_MEMBERS: readonly string[] = [
  'BHR', 'EGY', 'IRN', 'IRQ', 'ISR', 'JOR', 'KWT', 'LBN',
  'OMN', 'PSE', 'QAT', 'SAU', 'SYR', 'TUR', 'ARE', 'YEM',
];

/**
 * "Do NOT equate East Africa with EAC. For Alpha, define the GlobalNews AI East
 * Africa monitoring region as …"
 *
 * Eleven countries. This is deliberately NOT the East African Community, which
 * remains its own declared region below with its own treaty membership, and it
 * is deliberately NOT any one of the five attributed definitions in
 * `east-africa.tranche.ts` — it is the product's own monitoring baseline.
 */
const EAST_AFRICA_MEMBERS: readonly string[] = [
  'BDI', 'COD', 'DJI', 'ERI', 'ETH', 'KEN', 'RWA', 'SOM', 'SSD', 'TZA', 'UGA',
];

export const DECLARED_PRODUCT_REGIONS: readonly DeclaredProductRegion[] = [
  {
    id: 'region:middle-east',
    label: 'Middle East',
    authority: 'GlobalNews AI Alpha regional coverage baseline',
    authorityVersion: 'alpha-1',
    membershipSource: 'PRODUCT_GOVERNED',
    provenance:
      'Product-governed. An OPERATIONAL PRODUCT COVERAGE REGION declared by the Product Owner for Alpha — not a claim that this membership is universally agreed, and not derived from UN M49, which has no "Middle East".',
    members: MIDDLE_EAST_MEMBERS,
    excludedPending: [
      { iso3: 'CYP', reason: 'Not in the Alpha baseline. Requires separate approval.' },
      { iso3: 'AFG', reason: 'Not in the Alpha baseline. Requires separate approval.' },
      { iso3: 'PAK', reason: 'Not in the Alpha baseline. Requires separate approval.' },
      { iso3: 'DZA', reason: 'North Africa. Not in the Alpha baseline; requires separate approval.' },
      { iso3: 'LBY', reason: 'North Africa. Not in the Alpha baseline; requires separate approval.' },
      { iso3: 'MAR', reason: 'North Africa. Not in the Alpha baseline; requires separate approval.' },
      { iso3: 'TUN', reason: 'North Africa. Not in the Alpha baseline; requires separate approval.' },
      { iso3: 'SDN', reason: 'North Africa / Horn. Not in the Alpha baseline; requires separate approval.' },
    ],
  },
  {
    id: 'region:east-africa',
    label: 'East Africa',
    authority: 'GlobalNews AI Alpha regional coverage baseline',
    authorityVersion: 'alpha-1',
    membershipSource: 'PRODUCT_GOVERNED',
    provenance:
      'Product-governed. The governed product-region baseline declared by the Product Owner for Alpha. Deliberately NOT the East African Community, and deliberately not any single one of the five attributed definitions published in east-africa.tranche.ts.',
    members: EAST_AFRICA_MEMBERS,
    excludedPending: [
      {
        iso3: 'SDN',
        reason:
          'Adjacent / flashpoint context only. Named in EAST_AFRICA_FLASHPOINTS as a country the five accepted definitions disagree about; not a member without separate authority.',
      },
      {
        iso3: 'ZMB',
        reason:
          'Adjacent / flashpoint context only. Named in EAST_AFRICA_FLASHPOINTS as a country the five accepted definitions disagree about; not a member without separate authority.',
      },
    ],
  },
  {
    id: 'region:east-african-community',
    label: 'East African Community',
    authority: 'East African Community (treaty body)',
    authorityVersion: 'EAC membership as published in the shared country registry',
    membershipSource: 'BACKEND_PUBLISHED',
    provenance:
      'Backend supranational-membership.ts, basis POLITICAL_UNION. east-africa.tranche.ts states "EAC MEMBERSHIP IS READ FROM THE SHARED REGISTRY, NEVER RESTATED HERE" — this module honours the same rule.',
    members: null,
    excludedPending: [],
  },
  {
    id: 'region:europe',
    label: 'Europe',
    authority: 'UN Statistics Division, Standard Country or Area Codes (M49)',
    authorityVersion: 'M49 as encoded in supranational-membership.ts',
    membershipSource: 'BACKEND_PUBLISHED',
    provenance:
      'Backend supranational-membership.ts, basis UN_M49: the union of the four M49 European subregions. NOT the European Union, which is a different body with a different list.',
    members: null,
    excludedPending: [],
  },
];

export function declaredProductRegion(id: string): DeclaredProductRegion | undefined {
  return DECLARED_PRODUCT_REGIONS.find((r) => r.id === id);
}

export function isDeclaredProductRegion(id: string): boolean {
  return declaredProductRegion(id) !== undefined;
}

/**
 * The members a declared region aggregates over.
 *
 * PRODUCT_GOVERNED regions answer from their own declared list. BACKEND_PUBLISHED
 * regions answer from what the backend enumerated for this selection — passed in
 * by the caller, never guessed here, and an empty array when the caller has not
 * resolved it yet. That difference is the whole point of `membershipSource`.
 */
export function membersFor(
  id: string,
  backendMembers: readonly string[] = [],
): readonly string[] {
  const region = declaredProductRegion(id);
  if (region === undefined) return [];
  return region.membershipSource === 'PRODUCT_GOVERNED' ? (region.members ?? []) : backendMembers;
}

/**
 * COVERAGE ACCOUNTING — the shape a declared region must produce before any
 * aggregate derived from it may be shown.
 *
 * `uncoveredMembers` is a list of names, not a count, because "4 of 11 members
 * have no reporting" is a different statement from naming which four, and only
 * the second lets a reader judge the aggregate. A count alone is how missing
 * data starts reading as zero activity.
 */
export interface RegionCoverageAccounting {
  readonly regionId: string;
  readonly memberCount: number;
  readonly coveredMembers: readonly string[];
  readonly uncoveredMembers: readonly string[];
  /** True only when every declared member contributed evidence. */
  readonly complete: boolean;
  /** The region's own provenance, carried with the numbers it qualifies. */
  readonly provenance: string | null;
  /** Countries deliberately outside the region, so a gap is not read as one. */
  readonly excludedPending: readonly ExcludedMember[];
}

export function coverageAccountingFor(
  regionId: string,
  members: readonly string[],
  membersWithEvidence: ReadonlySet<string>,
): RegionCoverageAccounting {
  const region = declaredProductRegion(regionId);
  const covered = members.filter((iso3) => membersWithEvidence.has(iso3));
  const uncovered = members.filter((iso3) => !membersWithEvidence.has(iso3));

  return {
    regionId,
    memberCount: members.length,
    coveredMembers: covered,
    uncoveredMembers: uncovered,
    complete: uncovered.length === 0 && members.length > 0,
    provenance: region?.provenance ?? null,
    excludedPending: region?.excludedPending ?? [],
  };
}

/**
 * THE GATE ON AGGREGATION ITSELF.
 *
 * A declared region with NO enumerated members may not aggregate either — a
 * governed category with an empty list is the contested case wearing a better
 * label.
 */
export function mayAggregateMemberEvidence(regionId: string, members: readonly string[]): boolean {
  return isDeclaredProductRegion(regionId) && members.length > 0;
}
