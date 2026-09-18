import {
  navigatorCameraTarget,
  type NavigatorPlace,
} from '@/lib/api/geoNavigatorApi';
import type { Bounds } from '@/lib/map/camera/cameraState';
import {
  DECLARED_PRODUCT_REGION,
  declaredProductRegion,
  isDeclaredProductRegion,
  type RegionalScope,
} from './declaredProductRegions';

/**
 * RSC-1 / RSC-1.1 — THE REGIONAL SELECTION STATE CONTRACT, IMPLEMENTED.
 *
 *     contract   MAIN — RSC-1: REGIONAL SELECTION STATE CONTRACT
 *                MAIN-R2-CONVERGENCE-GOVERNANCE.zip
 *                9990dc3433230e4189df1d65d46d4d84eb3a746f037e5b03056f75eb267f6bd2
 *                RSC-1.1 published in CONTRACT-RSC-1.1-CLOSURE.md
 *     baseline   C8  24F5690305BDCAE3F424ADB9772D655C619702B57FDEBC2B0732D2FB779AF14B
 *     issue      CI-EA-01 — DEPENDENCY-HOLD (MAIN) -> PENDING-LIVE (H)
 *
 * Main published the contract; the implementation, the file and the naming are
 * H's. This module is the ONE place G's published vocabulary is mapped into the
 * product's, so that no surface reads `admittedBy` — RSC-1: "H reads
 * `regionType`, NEVER `basis`."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT THIS CORRECTS, MEASURED BEFORE THE CONTRACT EXISTED
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * On the shipped C8 build at 1440x900, clicking EAST AFRICA:
 *
 *   camera moved            YES  Z 1.1 -> Z 3.9, centre 3.15S 35.40E
 *   chip styling changed    only the HOVER treatment (#B4C8D4 -> #E4EEF4),
 *                           because the pointer was still on it
 *   active/pressed state    NONE
 *   region identity         NONE
 *   rail identity           NONE — the card never opens
 *   evidence scope          UNCHANGED
 *   URL                     `?cam=3.89/35.4/-3.15` — a camera, not a region
 *
 * Main's ruling: "A camera move without those state transitions is PARTIAL."
 * My own earlier diagnosis of the same class of bug is the sentence RSC-1 says
 * it exists to make impossible: "'selects nothing' was implemented as 'changes
 * nothing'."
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ALIAS TRAP — WHY THIS MODULE NEVER MINTS AN ID
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * RSC-1 names it exactly:
 *
 *     { name: 'Eastern Africa', aliases: ['East Africa'] } -> region:eastern-africa
 *     { name: 'East African Community', aliases: ['EAC'] } -> region:east-african-community
 *
 * "East Africa" resolves THROUGH AN ALIAS to Eastern Africa. A surface that
 * builds `region:east-africa` from the typed string has invented a region that
 * does not exist. So every id here arrives on `NavigatorPlace.geographyId` and
 * is copied, never constructed, never parsed, never folded from a label.
 *
 * And `{ id: 'eastAfrica' }` in `breadcrumbs.ts` is a DICTIONARY LABEL KEY, not
 * a geographyId. `regionSelectionFrom` cannot be handed one: it takes a
 * `NavigatorPlace`, and a jump target is not one. That is deliberate — it makes
 * the trap unreachable by construction rather than by review.
 */

/**
 * MAIN'S FOUR REGION TYPES. Not G's `admittedBy`, and not my earlier
 * CLOSED/CONTESTED pair, which Main superseded.
 *
 *   INSTITUTIONAL  a published body defines a closed list      <- political-union
 *   STATISTICAL    a published standard defines it             <- un-m49
 *   OPERATIONAL    in common use, membership disputed          <- contested-membership
 *   UNDEFINED      no definition encoded here yet              <- anything else
 *
 * `OPERATIONAL` rather than `CONTESTED` is Main's deliberate choice: it keeps
 * `CONTESTED` for source-location provenance and `DISPUTED` for the R2 Watch
 * change state, so the R2-10 token collision cannot re-enter through this door.
 *
 * GOVERNED joins the union — MAP-REGION-STATE-PRESENTATION-1.
 *
 * The four existing types all describe how an OUTSIDE authority admitted a
 * region: a published body, a published standard, common use, or nothing. A
 * product-governed coverage region fits none of them, and forcing it into the
 * nearest one would misdescribe it in the reader's own words — OPERATIONAL
 * renders as "membership is disputed", which is false of a baseline the Product
 * Owner declared, and UNDEFINED renders as "no definition is encoded", which is
 * false of one carrying an explicit member list.
 *
 * So this is a fifth type rather than the nearest wrong one.
 */
export type RegionType =
  | 'INSTITUTIONAL'
  | 'STATISTICAL'
  | 'OPERATIONAL'
  | 'GOVERNED'
  | 'UNDEFINED';

export const REGION_TYPES: readonly RegionType[] = [
  'INSTITUTIONAL',
  'STATISTICAL',
  'OPERATIONAL',
  'GOVERNED',
  'UNDEFINED',
];

/**
 * THE ONLY MAPPING SITE IN THE FRONTEND.
 *
 * An unrecognised or absent basis becomes UNDEFINED — "no definition encoded
 * here yet" — and never falls back to a type that would grant capability. A new
 * vocabulary word from G therefore arrives as LESS capability, not as a
 * silently mis-typed region.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * R1 — THE OPERATIONAL BASIS WAS RENAMED, AND THIS IS THE ONE LINE THAT MOVES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * G retired `'contested-vocabulary'` for `'contested-membership'` per Part IV
 * v1.2 §14.1 — CONTESTED was already taken by `locationProvenance`, and a
 * region whose MEMBERSHIP is disputed is a different claim about a different
 * thing. Main ratified the RSC-1 basis→type row; H did not track the rename on
 * its own, because deciding which of G's words earns which type is Main's.
 *
 * Between the rename and this line, Middle East / Sahel / Balkans typed
 * UNDEFINED and the rail read "No definition is encoded for this region."
 * Nothing false was ever shown — the default arm is the fail-safe, and it held.
 * The retired word now falls to that same arm, which is the correct outcome for
 * a spelling no publisher emits any more.
 */
export function regionTypeFrom(admittedBy: string): RegionType {
  switch (admittedBy) {
    case 'political-union':
      return 'INSTITUTIONAL';
    case 'un-m49':
      return 'STATISTICAL';
    case 'contested-membership':
      return 'OPERATIONAL';
    default:
      return 'UNDEFINED';
  }
}

/**
 * A DEFINITION IS NOT SELECTED UNTIL SOMEONE SELECTS ONE.
 *
 * RSC-1.1: `definitionId` absent means NO DEFINITION IS ASSERTED — not "the
 * default one". A definition may not be pre-selected, defaulted, remembered or
 * inferred from locale. `null` is the value of that sentence; there is no
 * initialiser anywhere in this module that produces anything else.
 */
export type RegionDefinitionId = string | null;

export interface RegionSelection {
  /** G's opaque canonical id, copied verbatim. Join by it; never parse it. */
  readonly geographyId: string;
  readonly name: string;
  readonly regionType: RegionType;
  /**
   * The published basis, verbatim — G's `provenance.dataset`. For an
   * OPERATIONAL region this is the sentence that says WHY there is no agreed
   * membership, and rendering it is the difference between honest-and-empty and
   * honest-and-useful.
   */
  readonly definition: string;
  /**
   * DERIVED FROM MEMBER EXTENTS. A camera target, never a border. `null` when G
   * published none, which is the correct and expected state for a region whose
   * membership is disputed.
   */
  readonly extent: Bounds | null;
  /** `null` is UNKNOWN. It never means zero members. */
  readonly memberCount: number | null;
  /** RSC-1.1. `null` until a reader chooses one. */
  readonly definitionId: RegionDefinitionId;
}

/**
 * A navigator node as a region selection, or `null` when it is not a region.
 *
 * A country is selected through the existing evidence-geography path; routing
 * one through here would give a country a region's treatment — no highlight, no
 * evidence claim — which would be a regression dressed as a contract.
 */
export function regionSelectionFrom(place: NavigatorPlace): RegionSelection | null {
  if (place.kind !== 'region') return null;

  const regionType = regionTypeFrom(place.admittedBy);

  return {
    geographyId: place.geographyId,
    name: place.name,
    regionType,
    definition: place.datasetAttribution,
    /*
      TWO INDEPENDENT GUARDS AGAINST ONE FAILURE.

      G does not publish bounds for a region with no agreed membership, and this
      refuses them anyway for OPERATIONAL and UNDEFINED. Duplicated on purpose:
      the failure — flying the camera to a confident frame around a region whose
      membership is disputed — is a claim the product would be making in the
      most persuasive medium it has, which is the map itself.
    */
    extent:
      regionType === 'INSTITUTIONAL' || regionType === 'STATISTICAL'
        ? navigatorCameraTarget(place)
        : null,
    memberCount: place.memberCount,
    definitionId: null,
  };
}

/**
 * Whether selecting this region may move the camera.
 *
 * RSC-1 step 3: "one `focus-bounds` if a derived extent exists; EMIT NOTHING if
 * it does not. An unmoved camera is a correct outcome." A region with no extent
 * still selects — identity and rail intact — and the camera stays exactly where
 * the reader put it.
 */
/**
 * ══ A PRODUCT-GOVERNED REGION RESOLVES LOCALLY, BECAUSE G DOES NOT HOLD IT ══
 *
 * MEASURED against the deployed Alpha backend:
 *
 *     GET /geo/place?id=region:east-africa  ->  {"found":false,"node":null}
 *
 * That is correct, not broken. `region:east-africa` is a PRODUCT_GOVERNED
 * coverage region declared by the Product Owner in `declaredProductRegions.ts`;
 * it is deliberately not the East African Community and not a UN M49 grouping,
 * so no gazetteer holds it and none should.
 *
 * Without this, selecting East Africa would set the scope correctly and then
 * render "This region could not be resolved" in the rail — the URL right, the
 * reader told nothing. The product owns this identity, so the product resolves
 * it.
 *
 * NOTHING IS INVENTED HERE. The name, the membership count and the provenance
 * all come from the declaration. The extent is the deployment's own published
 * jump bounds for the same region, which the map already flies to — a camera
 * frame, not a boundary. The card continues to state separately that no
 * regional boundary is drawn, because none is.
 */
export function declaredRegionSelection(
  id: string,
  extent: Bounds | null = null,
): RegionSelection | null {
  const declared = declaredProductRegion(id);

  if (declared === undefined) return null;

  return {
    geographyId: declared.id,
    name: declared.label,
    regionType: 'GOVERNED',
    definition: `${declared.authority} (${declared.authorityVersion})`,
    extent,
    memberCount: declared.members === null ? null : declared.members.length,
    definitionId: null,
  };
}

export function regionMayFrame(region: RegionSelection): boolean {
  return region.extent !== null;
}

/**
 * NEVER, FOR ANY TYPE — INCLUDING THE EU.
 *
 * RSC-1 states this as a ruling rather than as caution: a member-country union
 * is not a region boundary. Painting 27 countries and calling it "the EU"
 * asserts a border no source in this system published. A licensed regional
 * geometry would be a separate contract with its own provenance.
 *
 * A function rather than a constant because a caller has to CALL it, and the
 * call site is where the reason gets read.
 */
export function regionMayHighlight(_region: RegionSelection): false {
  return false;
}

/**
 * THE EVIDENCE SCOPE OF ANY REGION SELECTION, WHATEVER ITS TYPE.
 *
 * RSC-1: a region selection makes NO evidence claim. Member evidence differs in
 * precision, provenance and retrieval readiness; summing it would produce a
 * regional number whose ceiling nobody could state, breaking the rule that
 * navigation depth never raises the evidence ceiling.
 *
 * RSC-1.1 keeps it at this value even once a definition is chosen: narrowing
 * which countries are meant creates no evidence.
 */
export const REGIONAL_EVIDENCE_SCOPE = 'REGIONAL_NO_CLAIM' as const;

/**
 * ── NARROWED BY PO RULING 2, NOT REPEALED ────────────────────────────────
 *
 * "Keep REGIONAL_NO_CLAIM for ambiguous/unbounded region labels whose
 * membership is undefined … Only DECLARED_PRODUCT_REGION may aggregate
 * member-country evidence."
 *
 * The default arm is unchanged and is still the fail-safe: anything this
 * product has not explicitly declared — every operational label, every region
 * with an empty or disputed membership, and anything G adds tomorrow that
 * nobody has governed yet — comes back `REGIONAL_NO_CLAIM`. A region earns the
 * governed scope by being named in `DECLARED_PRODUCT_REGIONS` with an
 * authority, a version and a provenance path, never by its type or its shape.
 *
 * NOTE WHAT IS **NOT** RELAXED HERE. `regionMayHighlight` still returns `false`
 * for every region including a declared one: a member-country union is still
 * not a published boundary, and knowing exactly who is in a union does not
 * license drawing a border no source published. Aggregating evidence and
 * painting a polygon are different claims, and only the first was granted.
 */
export type RegionalEvidenceScope = RegionalScope;

export function regionEvidenceScope(region: RegionSelection): RegionalEvidenceScope {
  return isDeclaredProductRegion(region.geographyId)
    ? DECLARED_PRODUCT_REGION
    : REGIONAL_EVIDENCE_SCOPE;
}

/**
 * RSC-1.1 — CHOOSING A DEFINITION REFINES THE SAME SELECTION.
 *
 * `kind` and `id` are unchanged; the member set becomes that definition's and is
 * NEVER blended; the camera may move for the first time if the chosen
 * definition yields an extent; the URL gains `def=`.
 *
 * INERT TODAY, AND HONESTLY SO. G has not landed attributed definitions
 * (G-REG-3), so there is nothing to choose and nothing calls this with a real
 * id. The shape is fixed now so the two lanes need not negotiate later — Main's
 * words. It is wired, not simulated: no definition list is invented to make a
 * control appear.
 */
export function refineDefinition(
  region: RegionSelection,
  definitionId: string,
  members: { readonly definition: string; readonly extent: Bounds | null; readonly memberCount: number | null },
): RegionSelection {
  return {
    ...region,
    definitionId,
    definition: members.definition,
    extent: members.extent,
    memberCount: members.memberCount,
  };
}

/**
 * Clearing returns to absent. RSC-1.1 adds one thing worth stating: THE CAMERA
 * IS NEVER REWOUND. Undoing a claim about membership is not a request to go
 * somewhere, and yanking the view back would lose the place the reader is
 * looking at — the same rule deselection already follows.
 */
export function clearDefinition(region: RegionSelection): RegionSelection {
  return { ...region, definitionId: null };
}

/**
 * WHAT A REGION SELECTION CAN AND CANNOT DO, BY TYPE.
 *
 * Read by the rail so capability is stated once rather than re-derived per
 * surface. `highlight` is `false` on every row — see `regionMayHighlight`.
 */
export interface RegionCapability {
  readonly membershipEnumerable: boolean;
  readonly authorityNameable: boolean;
  readonly cameraTargetDerivable: boolean;
  readonly highlight: false;
  /**
   * RSC-1 lists "Watch scoping to a region" among the things it DOES NOT
   * SETTLE. So this is `false` for every type — not because a region is
   * unwatchable in principle, but because no contract says what a regional
   * Watch would check. Offering the control would be the fabricated-capability
   * failure the monetization rules forbid.
   */
  readonly watchScopeable: false;
}

export function regionCapability(region: RegionSelection): RegionCapability {
  const published = region.regionType === 'INSTITUTIONAL' || region.regionType === 'STATISTICAL';

  return {
    membershipEnumerable: published,
    authorityNameable: published,
    cameraTargetDerivable: region.extent !== null,
    highlight: false,
    watchScopeable: false,
  };
}
