/**
 * SHARED · MARKET PLATFORM CONTRACT — MAIN-MARKET-PLATFORM-1.
 *
 *     baseline   C37  37FDBB150AB1C5DF30D80B788C7094B9600779BE5613F592CE4C6889A48CC891
 *     design     Part VII Market Intelligence v1.0
 *     audit      MAIN-MARKET-V1-AUDIT       ed08b4ba6b87ba01cc1d99f6ad71564cc69648bf7e5a76df68f8e041bed9fc1c
 *     measured   G-MARKET-CAP-1             9c6be3eac555d4ebb37db79a3166f8e45d37103bb7ef0d5283a97d142f69b37c
 *                G-MARKET-SOURCE-1          f03af6216dd2b77ae8a3357fe994d32d4da425047355166b524aef51cd7e4b6e
 *                G-MARKET-P0-SCHEMA-1       517de82404ea951b3f9969d17006d954a4da904e11a009638d45723049b78e45
 *
 * A CONTRACT, NOT AN IMPLEMENTATION. No provider, no producer, no scorer, no UI, no market view.
 *
 * ── WHAT THIS FILE REFUSES TO DO, AND WHY EACH REFUSAL IS MEASURED ──────────
 *
 *   · it declares NO Market observation vocabulary — G's P0 mapping shows the four
 *     observation-bearing sources already land on ECON-CONTRACT-1 field for field (§1);
 *   · it declares NO second provenance model — `SourceType × EvidenceRole` is reused (§7);
 *   · it declares NO second relationship graph — the shared substrate is reused (§4);
 *   · it declares NO similarity, confidence or match score anywhere, because C-15 rules that
 *     "AI similarity alone is not sufficient authority to merge procurement records" and the
 *     cleanest way to honour that is to have nowhere to put a score (§3);
 *   · it renames NO geography. Rwanda's `Sector` is an administrative rung in canonical and stays
 *     one (§5);
 *   · it adds NO Watch change state and registers NO Watch subject (§6).
 */

import type { WatchChangeState, WatchSubjectType } from '../watch';
import type { SourceProvenance } from '../source-provenance';
import type { EconomyCorridorCapability, EconomyFigureGapReason } from '../economy';

/* ═══════════════════════════════════════════════════════════════════════════
 * §1 · STRUCTURED-OBSERVATION SEAM — REUSE, WITH EXACTLY ONE ADDED AXIS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE RULING: THE ACCEPTED ECONOMY CONTRACT IS THE SEAM. IT IS NOT FORKED AND IT IS NOT RENAMED.
 *
 * G's P0 mapping is decisive and I did not improve on it: of eight P0 sources, four carry
 * observations (ECB, Eurostat yields, World Bank Pink Sheet, Comext) and four do not (TED, World
 * Bank procurement notices, GLEIF, NACE/PKD). Mapped field by field, the four land on
 * `EconomySeries → EconomyPeriod → EconomyObservation → EconomyAssessment` with nothing left over.
 * A Market-owned observation vocabulary would recreate the exact duplication the Economy adapter
 * lane just spent a package removing: two `observationKey` functions, two release-status enums, two
 * freshness axes.
 *
 * ON RENAMING. G left the question to Main: should the accepted contract be renamed when it is
 * generalised? **No.** A rename would move every accepted byte of `shared/src/economy/index.ts`,
 * invalidate ECON-CONTRACT-1's acceptance, and buy nothing but a tidier noun — while the domain that
 * would have to absorb the churn is the one already mid-convergence. The contract is named for its
 * first consumer, as `participantEntity.ts` is; a second consumer does not make the name wrong.
 *
 * ON WHERE THE ONE MISSING MEMBER GOES. `EconomyObservation.vintage` is required and means "when the
 * PUBLISHER issued this reading". Three of the four P0 observation sources cannot supply that at all
 * (§1.1). The seam therefore needs an axis the accepted contract does not carry. It is declared HERE,
 * as a composable annotation, and NOT by editing the accepted file — modifying accepted authority
 * needs its own authorization, and this task does not carry one. Folding it into ECON-CONTRACT-1
 * later is one well-understood edit, and it stays the Product Owner's call.
 */

/**
 * WHOSE FACT THE VINTAGE IS. Measured, not proposed — the three states are the three the P0 sources
 * actually exhibit.
 *
 *   PUBLISHER_VINTAGE     the publisher states when it issued this reading, and prior readings are
 *                         retrievable.                              ECB only, in the P0 set.
 *   PUBLISHER_CHANGED_AT  the publisher states THAT a record changed but not what it was.
 *                         World Bank `api_modified_date`; GLEIF `lastUpdateDate`.
 *   INGEST_SNAPSHOT       no publisher vintage exists. The vintage is OUR observation of the source
 *                         at a moment.       Eurostat ("no history available"), Comext, Pink Sheet.
 *
 * WITHOUT THIS AXIS THE SEAM SILENTLY ASSERTS THE FIRST. An append-only ledger whose history is our
 * polling schedule, presented as the publisher's revision history, is a fabrication that no
 * downstream consumer can detect — the `eco:1` key still works, the rows still never merge, and
 * every figure looks publisher-stamped.
 */
export const VINTAGE_PROVENANCE_KINDS = [
  'PUBLISHER_VINTAGE',
  'PUBLISHER_CHANGED_AT',
  'INGEST_SNAPSHOT',
] as const;
export type VintageProvenanceKind = (typeof VINTAGE_PROVENANCE_KINDS)[number];

/**
 * WHOSE CLAIM THE UNIT IS. Same discipline, same reason.
 *
 * Eurostat `irt_lt_mcby_m` has no unit field at all — that the readings are percent per annum lives
 * in the dataset label. Comext hides it inside an indicator code (`QUANTITY_IN_100KG` is hundreds of
 * kilograms, and nothing in the payload says so). The Pink Sheet binds it to a column position. ECB
 * splits it across `UNIT` and `UNIT_MULT`, so storing only the product destroys the publisher's
 * stated scale.
 *
 * Where we author the unit, provenance that implies the publisher stated it would be false.
 */
export const UNIT_AUTHORSHIP_KINDS = ['PUBLISHER_STATED', 'LOCALLY_ASSERTED'] as const;
export type UnitAuthorshipKind = (typeof UNIT_AUTHORSHIP_KINDS)[number];

/**
 * The annotation a structured-observation source must declare ALONGSIDE the accepted observation.
 * It composes; it does not replace, wrap or re-state any accepted member.
 */
export interface StructuredObservationSeamDeclaration {
  /** The provider entry this declaration is about. Opaque here. */
  readonly sourceId: string;
  readonly vintageProvenance: VintageProvenanceKind;
  readonly unitAuthorship: UnitAuthorshipKind;
  /**
   * The source's own key tuple, in the source's order. The seam derives `seriesId` from THIS, using
   * the accepted `eco:1` length-prefixed encoding — never a naive join. G's warning is concrete:
   * Comext keys on six parts whose `product` values are digit strings of mixed length and whose
   * `indicators` values contain underscores, which is the same collision shape ECON-CONTRACT-1 fixed.
   */
  readonly sourceKeyDimensions: readonly string[];
}

/**
 * A seam declaration that claims a publisher vintage must be able to retrieve prior readings.
 * Stated as a predicate rather than a comment because the failure it prevents — our download clock
 * presented as the publisher's revision history — is invisible downstream.
 */
export function seamDeclarationIsHonest(
  declaration: StructuredObservationSeamDeclaration,
  publisherRetainsHistory: boolean,
): boolean {
  if (declaration.vintageProvenance === 'PUBLISHER_VINTAGE') return publisherRetainsHistory;
  return true;
}

/** The four accepted gap reasons are sufficient for the whole P0 set. Re-exported, never re-declared. */
export type MarketFigureGapReason = EconomyFigureGapReason;

/* ═══════════════════════════════════════════════════════════════════════════
 * §2 · THE SIX MARKET SUBJECTS, RECONCILED AGAINST CANONICAL PLACEMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Canonical `WATCH_SUBJECT_TYPES_BY_SURFACE` at C37:
 *
 *     MAP       PLACE · SITUATION · ROUTE · ACTOR
 *     ECONOMY   INDICATOR · SECTOR · POLICY · TRADE_LANE
 *     MARKET    INSTRUMENT · COMMODITY · ISSUER · EXPOSURE
 *     CONFLICT  FRONT · ACTOR · CORRIDOR · INCIDENT_CLASS
 *
 * The instruction is explicit: do not force Market to reuse semantically wrong labels. Each of the
 * six is ruled on its own evidence rather than by pattern-matching a word.
 */
export const MARKET_SUBJECT_DISPOSITIONS = {
  /** The label already exists on the MARKET surface and means what Market means. Reuse, no change. */
  INSTRUMENT: 'REUSE_EXISTING_MARKET_TYPE',
  COMMODITY: 'REUSE_EXISTING_MARKET_TYPE',
  /**
   * NOT a subject type at all. "Sector" as something a professional WATCHES is the ECONOMY surface's
   * existing `SECTOR`; "sector" as a CLASSIFICATION of a company or instrument is a scheme-qualified
   * code and belongs in §5. Minting `MARKET:SECTOR` would create a third meaning of one word in a
   * platform that already carries two (§5).
   */
  SECTOR: 'NOT_A_SUBJECT_CLASSIFICATION_FACET',
  /**
   * `ISSUER` is NARROWER, and the difference is load-bearing: a contracting authority that publishes
   * a tender and a supplier that bids issue nothing. Forcing them under ISSUER would make "issuer"
   * mean "any company", after which the instrument-issuing role has no name. Commercial Entity is a
   * FACET of the shared participant surface (§4); ISSUER stays the instrument-issuing role.
   */
  COMMERCIAL_ENTITY: 'PARTICIPANT_FACET_ISSUER_STAYS_NARROW',
  /**
   * `CONFLICT:CORRIDOR` is a conflict corridor. Market's corridor is a trade and logistics corridor,
   * and the accepted Economy contract ALREADY models it — `EconomyCorridor`, endpoints plus an
   * economic relationship, `ENDPOINT_ONLY`. Reusing the CONFLICT label would be the semantically
   * wrong reuse the instruction warns against; reusing the Economy CORRIDOR CONTRACT is the right
   * one. A Watch placement for it remains a Part IV question (§6).
   */
  CORRIDOR: 'REUSE_ECONOMY_CORRIDOR_CONTRACT',
  /** No label anywhere, on any surface. A genuinely new subject type — a Part IV amendment (§6). */
  PROCUREMENT_OPPORTUNITY: 'NEW_SUBJECT_TYPE_REQUIRED',
} as const;

export type MarketSubjectName = keyof typeof MARKET_SUBJECT_DISPOSITIONS;
export type MarketSubjectDisposition = (typeof MARKET_SUBJECT_DISPOSITIONS)[MarketSubjectName];

/** Exactly the two that already exist on the MARKET surface and mean what Market means. */
export const MARKET_SUBJECT_TYPES_REUSED_AS_IS: readonly WatchSubjectType[] = [
  'INSTRUMENT',
  'COMMODITY',
];

/* ═══════════════════════════════════════════════════════════════════════════
 * §3 · PROCUREMENT IDENTITY AND REFERENCE RELATIONSHIPS — C-15, MADE STRUCTURAL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * C-15 / RL-23, verbatim in the accepted design: internal canonical identity distinct from any
 * portal reference; automatic merge ONLY on strong deterministic evidence; otherwise separate
 * canonical objects connected by typed relationships; and
 * "AI SIMILARITY ALONE IS NOT SUFFICIENT AUTHORITY TO MERGE PROCUREMENT RECORDS."
 *
 * THE PROHIBITION IS ENFORCED BY ABSENCE, NOT BY COMMENT. There is no `score`, `similarity`,
 * `confidence`, `matchStrength` or `probability` field anywhere in this section, and no function
 * that takes two procurement objects and returns a number. A merge that cannot cite one of the four
 * named authorities has nowhere to record why it happened, so it cannot be written.
 */

/** The internal canonical identity. `mkt:1`, length-prefixed, for the reason `eco:1` is. */
export const MARKET_KEY_ENCODING_VERSION = 'mkt:1';

function lengthPrefixed(parts: readonly string[]): string {
  return parts.map((part) => `${part.length}:${part}`).join('');
}

/**
 * A reference to a notice AS THE PORTAL PUBLISHES IT. Deliberately NOT an identity: two portals may
 * both publish notice "2026/S 123-456" and mean different things, which is exactly why C-15 keeps
 * the canonical identity internal.
 */
export interface ProcurementPortalReference {
  /** The publishing portal, e.g. 'TED', 'WB_PROCNOTICES'. */
  readonly portalId: string;
  /** The portal's own notice identifier, verbatim. */
  readonly noticeId: string;
  /**
   * The portal's version counter where it HAS one. TED carries `BT-757-notice` 01–99; the World
   * Bank's `notice_version_no` was measured never to exceed 1. Absent means the portal does not
   * version, NOT that this is version 1.
   */
  readonly noticeVersion?: string;
}

export function procurementPortalReferenceKey(reference: ProcurementPortalReference): string {
  return lengthPrefixed([reference.portalId, reference.noticeId, reference.noticeVersion ?? '']);
}

/**
 * THE INTERNAL CANONICAL IDENTITY. Minted by us, from a tuple we control, and never from a portal
 * string — so a portal renumbering its notices cannot silently re-identify our objects.
 */
export function marketProcurementIdentity(parts: {
  readonly jurisdiction: string;
  readonly contractingAuthorityRef: string;
  readonly canonicalDiscriminator: string;
}): string {
  return `${MARKET_KEY_ENCODING_VERSION}:${lengthPrefixed([
    parts.jurisdiction,
    parts.contractingAuthorityRef,
    parts.canonicalDiscriminator,
  ])}`;
}

/**
 * The four deterministic merge authorities, enumerated by the accepted ruling and closed here.
 * A merge cites one of these or it does not happen.
 */
export const PROCUREMENT_MERGE_AUTHORITIES = [
  'EXPLICIT_CROSS_REFERENCE_IN_AUTHORITATIVE_NOTICE',
  'SHARED_AUTHORITATIVE_PROCUREMENT_IDENTIFIER',
  'DOCUMENTED_AMENDMENT_OR_SUCCESSOR_CHAIN',
  'ISSUING_AUTHORITY_EXPLICIT_LINK',
] as const;
export type ProcurementMergeAuthority = (typeof PROCUREMENT_MERGE_AUTHORITIES)[number];

/** The five typed relationships. Nothing merges; these connect objects that stay separate. */
export const PROCUREMENT_REFERENCE_KINDS = [
  'POSSIBLY_RELATED',
  'AMENDS',
  'SUPERSEDES',
  'REISSUES',
  'CROSS_PORTAL_NOTICE',
] as const;
export type ProcurementReferenceKind = (typeof PROCUREMENT_REFERENCE_KINDS)[number];

/**
 * WHICH OF THE FIVE ANY P0 SOURCE CAN ACTUALLY PRODUCE. Measured by G, per field.
 *
 * `REISSUES` is the one to read twice: **TED has no reissue concept, verified by targeted negative
 * check**, and nothing else in the P0 set supplies one. It is declared because the design names it
 * and because a reissue with a genuinely new lifecycle must never be silently merged — but nothing
 * can emit it today, and the contract says so rather than leaving an implementer to discover it.
 */
export const PROCUREMENT_REFERENCE_PRODUCERS: Readonly<
  Record<ProcurementReferenceKind, string>
> = {
  AMENDS: 'TED only — BT-758-notice (pointer to the superseded version). World Bank: no producer.',
  SUPERSEDES: 'TED only — BT-758-notice, with BT-13716 naming which sections changed and BT-140 a coded reason. World Bank: no producer.',
  REISSUES: 'NO PRODUCER IN THE P0 SET. TED has no reissue concept (targeted negative check). Declared, unproducible.',
  CROSS_PORTAL_NOTICE: 'NO PRODUCER. Requires an authority that links two portals; none exists in the P0 set.',
  POSSIBLY_RELATED: 'NEVER MACHINE-MINTED. It is the state that holds when no merge authority applies — it is not evidence of a relationship, it is the absence of authority for one.',
};

/** Only these two are derivable at P0, and only from TED. */
export const PROCUREMENT_REFERENCE_KINDS_PRODUCIBLE_TODAY: readonly ProcurementReferenceKind[] = [
  'AMENDS',
  'SUPERSEDES',
];

export interface ProcurementReference {
  readonly kind: ProcurementReferenceKind;
  readonly fromIdentity: string;
  readonly toIdentity: string;
  /**
   * REQUIRED for a merge-bearing kind. `POSSIBLY_RELATED` carries none BY CONSTRUCTION — it exists
   * precisely because no authority was found, and letting it carry one would make "we could not
   * establish a link" indistinguishable from "we established a weak one".
   */
  readonly authority?: ProcurementMergeAuthority;
  /** Opaque evidence handles. Non-empty for every kind: a claimed relationship cites something. */
  readonly evidenceRefs: readonly string[];
}

/**
 * A merge-bearing reference must name a deterministic authority; `POSSIBLY_RELATED` must NOT.
 * Both halves matter, and the second is the one an implementer would erode first.
 */
export function procurementReferenceIsAuthorised(reference: ProcurementReference): boolean {
  if (reference.evidenceRefs.length === 0) return false;
  if (reference.kind === 'POSSIBLY_RELATED') return reference.authority === undefined;
  return reference.authority !== undefined;
}

/**
 * R1 — THE TREATMENT DECISION NOW ENFORCES VALIDITY ITSELF.
 *
 * E1-MARKET-PLATFORM-1 M-4, corrected here. `treatmentFor` previously read ONE field —
 * `authority !== undefined` — and never consulted `procurementReferenceIsAuthorised`, so two invalid
 * references reported a merge. Reproduced on the R0 candidate before correcting it:
 *
 *     AMENDS + authority + evidence            authorised=true   -> MERGED_IDENTITY
 *     AMENDS + authority + NO evidence         authorised=false  -> MERGED_IDENTITY   <- wrong
 *     POSSIBLY_RELATED carrying an authority   authorised=false  -> MERGED_IDENTITY   <- wrong
 *
 * The second row is C-15's own prohibition rendered on screen: a merely-possible relationship
 * presented as deterministic identity equivalence.
 *
 * ── WHY A THIRD STATE RATHER THAN FOLDING INVALID INTO `MERELY_RELATED` ─────
 *
 * Both satisfy the letter of the correction. Folding would be worse in practice: `MERELY_RELATED` is
 * a DESIGNED, legitimate state meaning "we looked for a deterministic authority and found none", and
 * routing a malformed record into it launders a broken reference into a real editorial finding. The
 * platform already draws exactly this distinction elsewhere — `WatchDerivationState` exists beside
 * `WatchChangeState` so "we could not look" is never shown as "we looked and nothing changed".
 * `UNAUTHORISED` is the same idea one domain over: not a treatment to render, a refusal to render one.
 *
 * ── AND THE COMPOSITION IS NO LONGER THE CALLER'S TO REMEMBER ───────────────
 *
 * The activation's requirement is explicit — do not rely on callers running two functions in the
 * right order. `treatmentFor` now calls the accepted predicate internally, so a consumer that never
 * heard of `procurementReferenceIsAuthorised` still cannot obtain a merge from an invalid reference.
 * The predicate itself is unchanged and remains exported for callers that want the reason.
 */
export const PROCUREMENT_IDENTITY_TREATMENTS = [
  'MERGED_IDENTITY',
  'MERELY_RELATED',
  'UNAUTHORISED',
] as const;
export type ProcurementIdentityTreatment = (typeof PROCUREMENT_IDENTITY_TREATMENTS)[number];

/** The two that are RENDERED. RL-23's "two visibly different treatments" is unchanged by R1. */
export const PROCUREMENT_RENDERABLE_TREATMENTS: readonly ProcurementIdentityTreatment[] = [
  'MERGED_IDENTITY',
  'MERELY_RELATED',
];

export function treatmentFor(reference: ProcurementReference): ProcurementIdentityTreatment {
  if (!procurementReferenceIsAuthorised(reference)) return 'UNAUTHORISED';
  return reference.authority === undefined ? 'MERELY_RELATED' : 'MERGED_IDENTITY';
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §4 · COMMERCIAL ENTITY — A FACET AND A REFERENCE, NOT A COMPANY DATABASE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Canonical entity resolution excludes companies, and this contract does NOT silently add them to
 * it. The boundary drawn here is narrow on purpose: Market may IDENTIFY a commercial entity by
 * external register reference and may carry a small profile facet. It does not resolve companies,
 * does not merge them, and does not own an ownership graph — ownership and exposure links use the
 * SHARED relationship substrate, so there is no second graph in the platform.
 */
export const COMMERCIAL_ENTITY_ROLES = [
  'ISSUER',
  'CONTRACTING_AUTHORITY',
  'SUPPLIER',
  'OPERATOR',
  'PARENT',
] as const;
export type CommercialEntityRole = (typeof COMMERCIAL_ENTITY_ROLES)[number];

/**
 * External register references. GLEIF's own join key to national registers is the PAIR
 * `RegistrationAuthorityID` + `RegistrationAuthorityEntityID` — the entity's number in its local
 * register (a KRS number, for example). Carried as a pair because either half alone identifies
 * nothing.
 */
export interface CommercialEntityRegisterRef {
  /** ISO 17442 LEI, when the entity has one. 3.02m active LEIs at Q1 2026 — a minority of companies. */
  readonly lei?: string;
  readonly registrationAuthorityId?: string;
  readonly registrationAuthorityEntityId?: string;
  readonly jurisdiction: string;
}

export interface CommercialEntityFacet {
  /** Opaque handle into the shared participant surface. Never resolved here. */
  readonly entityRef: string;
  readonly role: CommercialEntityRole;
  readonly register: CommercialEntityRegisterRef;
  readonly evidenceRefs: readonly string[];
}

/**
 * THE MEASURED NON-JOIN, DECLARED SO NOBODY IMPLEMENTS IT OPTIMISTICALLY.
 *
 * TED's buyer field `BT-501` carries an identifier with NO issuing-authority scheme, so it cannot be
 * deterministically joined to GLEIF's `registeredAt` + `registeredAs` pair. Neither TED nor the World
 * Bank notices carry an LEI. A procurement↔company join therefore has no deterministic authority in
 * the P0 set — which is the same conclusion C-15 reaches from the ruling side, arrived at
 * independently from the data side.
 */
export const PROCUREMENT_TO_COMPANY_JOIN = 'NO_DETERMINISTIC_JOIN' as const;

/**
 * GLEIF CARRIES NO SECTOR CODE OF ANY KIND. LEI-CDF v3.1 has `EntityLegalFormCode` (ISO 20275) and
 * `EntityCategory` — legal-form and entity-type codes, NOT economic-activity codes. A Market sector
 * classification cannot come from GLEIF, and §5's schemes are where it must come from instead.
 */
export const GLEIF_SUPPLIES_SECTOR_CODE = false;

/**
 * OWNERSHIP COVERAGE, STATED HONESTLY BECAUSE THE HEADLINE FIGURE IS MISLEADING.
 *
 * GLEIF Level 2 records accounting-consolidation parents. Of entities reporting, **4% reported a
 * direct parent WITH an LEI** and **89% reported "no direct parent"**. The widely-quoted "99%
 * reported information on direct and ultimate parents" counts REPORTING EXCEPTIONS as "reported" —
 * it is not 99% ownership coverage, and the parent definition is accounting consolidation rather
 * than legal or beneficial ownership.
 *
 * Ownership links are therefore modelled as ordinary evidence-bearing edges on the shared substrate,
 * with no completeness claim attached anywhere.
 */
export const GLEIF_DIRECT_PARENT_WITH_LEI_SHARE = 0.04;

/* ═══════════════════════════════════════════════════════════════════════════
 * §5 · SECTOR NAMESPACE — THREE MEANINGS OF ONE WORD, AND GEOGRAPHY KEEPS ITS ONE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE COLLISION IS REAL AND MEASURED, and it is three-way rather than two:
 *
 *   1. GEOGRAPHY.  `Sector` is an administrative rung — Rwanda's, in canonical's own East Africa
 *      tranche: "RWANDA'S SECTOR IS A REAL LEVEL WITH NO RUNG TO LIVE IN."
 *   2. WATCH.      `SECTOR` is a `WatchSubjectType` on the ECONOMY surface — a thing watched.
 *   3. MARKET.     "sector" is an economic-activity CLASSIFICATION of a company or instrument,
 *      expressed in a named scheme (NACE, PKD, CPV…).
 *
 * RULING: GEOGRAPHY IS NOT RENAMED. The instruction requires evidence to rename it and there is
 * none — Rwanda's sectors are what Rwanda calls them, the name is the country's, and a platform
 * renaming a national administrative unit to free up a word for a market taxonomy would be the kind
 * of change that reads as correct in a diff and wrong in Kigali.
 *
 * RULING: MARKET'S SECTOR IS NOT A SUBJECT TYPE EITHER. Watching "the fintech sector" is the ECONOMY
 * surface's existing `SECTOR` subject; classifying a company is a facet. Minting `MARKET:SECTOR`
 * would add a third meaning to a platform that already carries two.
 *
 * RULING: A MARKET SECTOR IS ONLY EVER A SCHEME-QUALIFIED CODE. There is no bare "sector" string in
 * this contract and there is nowhere to put one — the type requires the scheme, so an unscoped
 * classification cannot be represented at all. `62.10.A` means nothing until you know it is PKD, and
 * PKD 2007 and PKD 2025 disagree about what it means.
 */
export const SECTOR_CLASSIFICATION_SCHEMES = [
  'NACE_REV2',
  'PKD_2007',
  'PKD_2025',
  'CPV',
  'UNSPSC',
  'WORLD_BANK_SECTOR',
] as const;
export type SectorClassificationScheme = (typeof SECTOR_CLASSIFICATION_SCHEMES)[number];

export interface SectorClassification {
  readonly scheme: SectorClassificationScheme;
  /** The code exactly as the scheme spells it. Never normalised, never stripped of its dots. */
  readonly code: string;
  /** Which of possibly several classifications this is, as the register states it. */
  readonly rank: 'PRIMARY' | 'SECONDARY';
  /** Who says so — GUS is the authoritative company→PKD mapping for Poland, for example. */
  readonly assertedByRef: string;
}

/**
 * NO CROSSWALK EXISTS, AND THE EMPTY ARRAY IS THE MEASUREMENT.
 *
 * CPV, UNSPSC and the World Bank sector taxonomy have no published correspondence to NACE.
 * Unmappable at P0. A consumer reads this and knows not to wait for a translation that nobody
 * publishes, rather than discovering it when two sector filters disagree.
 */
export const SECTOR_SCHEME_CROSSWALKS: readonly {
  readonly from: SectorClassificationScheme;
  readonly to: SectorClassificationScheme;
}[] = [];

/**
 * R1 — CANONICAL SECTOR IDENTITY. E1-MARKET-PLATFORM-1 M-9, corrected here.
 *
 * The contract named the PKD 2007 / PKD 2025 trap and then exported no way to avoid it, so every
 * consumer wrote the comparison itself during exactly the overlap window the contract warns about —
 * and the natural naive implementation is the wrong one:
 *
 *     PKD_2007 '62.10.A'  vs  PKD_2025 '62.10.A'
 *       a.code === b.code   ->  TRUE     two schemes, one answer
 *
 * The key is length-prefixed for the reason `mkt:1` and `eco:1` are: a scheme or code containing the
 * separator must not be able to collide with a boundary.
 */
export const SECTOR_KEY_ENCODING_VERSION = 'sec:1';

export function sectorClassificationKey(c: {
  readonly scheme: SectorClassificationScheme;
  readonly code: string;
}): string {
  return `${SECTOR_KEY_ENCODING_VERSION}:${lengthPrefixed([c.scheme, c.code])}`;
}

/**
 * EQUALITY REQUIRES THE SCHEME, AND CROSS-SCHEME EQUIVALENCE REQUIRES A PUBLISHED AUTHORITY.
 *
 * `SECTOR_SCHEME_CROSSWALKS` is empty because no published correspondence exists, so today this
 * function is exactly "same scheme and same code" — and that is the measurement, not a limitation to
 * be worked around. The crosswalk consultation is present so that IF an authority is ever published
 * and registered, equivalence flows from it rather than from a consumer's assumption. Nothing here
 * creates one.
 */
export function sectorClassificationsEqual(
  a: { readonly scheme: SectorClassificationScheme; readonly code: string },
  b: { readonly scheme: SectorClassificationScheme; readonly code: string },
): boolean {
  if (sectorClassificationKey(a) === sectorClassificationKey(b)) return true;
  if (a.code !== b.code) return false;
  return SECTOR_SCHEME_CROSSWALKS.some(
    (w) =>
      (w.from === a.scheme && w.to === b.scheme) || (w.from === b.scheme && w.to === a.scheme),
  );
}

/**
 * A LIVE TRANSITION THAT WILL PRODUCE MIXED DATA, RECORDED BECAUSE IT IS A CORRECTNESS TRAP.
 * Poland's PKD 2007 → PKD 2025 migration runs to 31 December 2026, and many KRS entries had not
 * migrated as of September 2026. A Polish company population WILL contain both, so a consumer that
 * assumes one scheme per country will mis-classify.
 */
export const PKD_MIGRATION_DEADLINE = '2026-12-31';

/* ═══════════════════════════════════════════════════════════════════════════
 * §6 · WATCH — REGISTRATION PROPOSAL AND THE PRODUCER MATRIX
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * NO WATCH CHANGE STATE IS ADDED. The seven are closed to extension and Market needs none.
 * NO SUBJECT IS REGISTERED. `WatchSubjectType` is a closed transcription of Part IV R2 §17, so the
 * two genuinely new placements are amendments to Part IV, not platform affordances.
 *
 * The proposal is typed as plain strings, exactly as the Politics proposal is, so it cannot be
 * mistaken for a registration.
 */
export interface MarketWatchRegistrationProposal {
  readonly reusedAsIs: readonly WatchSubjectType[];
  readonly proposedNewSubjectTypes: readonly string[];
  readonly proposedPlacementChanges: readonly string[];
  readonly blockedBy: readonly string[];
}

export const MARKET_WATCH_REGISTRATION_PROPOSAL: MarketWatchRegistrationProposal = {
  reusedAsIs: MARKET_SUBJECT_TYPES_REUSED_AS_IS,
  proposedNewSubjectTypes: ['PROCUREMENT_OPPORTUNITY'],
  proposedPlacementChanges: [
    'CORRIDOR: Market needs a trade-corridor placement. CONFLICT:CORRIDOR is a conflict corridor and is NOT the same subject; the Economy corridor CONTRACT is what Market reuses.',
    'COMMERCIAL_ENTITY: no new type. ISSUER stays the instrument-issuing role; buyer and supplier are participant facets.',
    'SECTOR: no new type. ECONOMY:SECTOR remains the watchable subject; Market classification is a scheme-qualified facet.',
  ],
  blockedBy: [
    'PART_IV_R2_S17: WatchSubjectType is an accepted transcription with no PROCUREMENT_OPPORTUNITY member and no Market corridor placement.',
    'SUBJECT_PERSISTENCE: watch-readiness declares no table for watch subjects, snapshots or cursors.',
    'NO_MARKET_PRODUCER: no Market provider is registered or enabled; every Market change state would be derived from nothing.',
  ],
};

/** A compile-time reminder that the proposal is not a registration and must not become one here. */
export type MarketProposedTypesAreNotRegistered = Exclude<
  (typeof MARKET_WATCH_REGISTRATION_PROPOSAL.proposedNewSubjectTypes)[number],
  WatchSubjectType
>;

/**
 * The same two-of-seven ceiling Politics measured, restated for Market with its own event mapping.
 * Nothing here creates a producer, and this contract must not be read as authorising one.
 */
export const MARKET_CHANGE_STATES_PRODUCIBLE_TODAY: readonly WatchChangeState[] = [
  'NEW_EVIDENCE',
  'NO_MATERIAL_CHANGE',
];

export const MARKET_CHANGE_STATE_PRODUCER_GAPS: Readonly<Record<string, string>> = {
  NEW: 'Needs run history — SUBJECT_PERSISTENCE.',
  SIGNIFICANT_CHANGE: 'No magnitude threshold exists in Part IV. A price move, a tender value change and a rating action would each need one, and none is defined.',
  DEVELOPING: 'Needs at least two prior runs — persistence.',
  DISPUTED: 'Needs assessment-level disagreement detection. Analysis-lane capability.',
  STABLE: 'Shown with a duration; a duration needs history.',
};

/* ═══════════════════════════════════════════════════════════════════════════
 * §7 · SOURCE CLASS — REUSE SourceType × EvidenceRole, ADD ONE ARTIFACT CARRIER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No Market provenance is created. `SourceProvenance` composes in unchanged, exactly as it does for
 * Politics, and for the same reason: the platform already answers "what kind of source" and "what
 * role does this record play"; what it cannot answer is which MARKET artifact kind this is.
 *
 * `PoliticalClassAssignment`'s rule is reused deliberately: there is no `REGISTRY` member, so a
 * class derived from the institution rather than the artifact cannot be recorded.
 */
export const MARKET_ARTIFACT_CLASSES = [
  'PROCUREMENT_NOTICE',
  'CONTRACT_AWARD_RECORD',
  'COMPANY_REGISTER_RECORD',
  'STATISTICAL_RELEASE',
  'PRICE_BULLETIN',
  'CLASSIFICATION_TAXONOMY',
  'MARKET_REPORTING',
] as const;
export type MarketArtifactClass = (typeof MARKET_ARTIFACT_CLASSES)[number];

export type MarketClassAssignment = 'ARTIFACT_INSPECTION' | 'PUBLISHER_DECLARATION';

export interface MarketArtifactClassification {
  readonly artifactRef: string;
  readonly artifactClass: MarketArtifactClass;
  readonly assignedFrom: MarketClassAssignment;
  /** What this artifact is authoritative FOR. A tender notice states its own terms, not its outcome. */
  readonly authoritativeForClaimRef: string;
  readonly provenance?: SourceProvenance;
}

export function marketClassificationIsClaimScoped(c: MarketArtifactClassification): boolean {
  return c.authoritativeForClaimRef.trim().length > 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §8 · MEASURED DATA LIMITS — PRESERVED AS CONSTANTS, NOT AS PROSE
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Corroborated twice: by the Economy corridor contract and again from the P0 data side. */
export const MARKET_CORRIDOR_CAPABILITY: EconomyCorridorCapability = 'ENDPOINT_ONLY';

/** No P0 corridor source supplies a coordinate, linestring, waypoint or distance. */
export const PRODUCIBLE_ROUTE_GEOMETRY = false;

/** Not in the P0 set at all. No equity or index source satisfies the official/free requirement. */
export const EQUITY_OR_INDEX_SOURCE_QUALIFIED = false;

/** Every Market subject, measured across five capability states, is ABSENT or PARTIAL at C37. */
export const MARKET_RUNTIME_ENABLED_SUBJECTS: readonly MarketSubjectName[] = [];

/**
 * No scorer, no rank, no similarity — the same absence Politics enforces, restated because Market is
 * where the temptation is strongest: a "match score" between a tender and a company is the single
 * most obvious thing to build here, and C-15 forbids exactly that.
 */
export const MARKET_DECLARES_NO_SCORER = true;
