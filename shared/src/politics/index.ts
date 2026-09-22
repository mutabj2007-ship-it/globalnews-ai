/**
 * SHARED · POLITICS PLATFORM CONTRACT — MAIN-POLITICS-PLATFORM-1.
 *
 *     baseline   C37  37FDBB150AB1C5DF30D80B788C7094B9600779BE5613F592CE4C6889A48CC891
 *     design     Part VIII Politics Intelligence v1.0 (DESIGN ONLY, self-declared)
 *                  Phase 1 spec  317fa2b5172f6669b93004deab63fe8fa55113561584199e6abfba3256b7b184
 *                  Phase 2 spec  c44eda157e05c4c0ea0ba7287e7675c0b71b4d05da800a24c0f2eeb5f44c25f6
 *                  R16 rulings   9061f66a8761b73d64f849bbf5203c7bc4e565dfe6d7dc626190ea790adc9b7e
 *     audit      MAIN-POLITICS-V1-AUDIT  bbc6d7450793e777015a5bf268d20fc15986ef108954ae234c1774b7ea4d1011
 *
 * THIS FILE IS A CONTRACT, NOT AN IMPLEMENTATION. It declares vocabulary, identity and the shape of
 * obligations. It contains no provider, no producer, no scorer, no UI and no political conclusion.
 *
 * ── WHAT THIS FILE DELIBERATELY DOES NOT DO ─────────────────────────────────
 *
 *   · it does not create a second identity system — political actors are a FACET of the shared
 *     participant surface (Part VIII R04: "No second identity system");
 *   · it does not create CONSTITUENCY, POLL or GOVERNANCE_STATE as persistent subjects — the
 *     accepted rulings D-01, D-04 and D-02 make them a geography facet, an evidence artifact and a
 *     derived assessment, and this file encodes those refusals as types rather than as prose;
 *   · it does not add a Watch change state — `WatchChangeState` says "DO NOT EXTEND THIS UNION" and
 *     Politics has no need to: its lifecycle events are domain facts that TRIGGER reassessment;
 *   · it does not decide the two editorial thresholds it names, and it cannot: see §9;
 *   · it declares no political severity ladder (Part VIII §30, R11).
 */

import type { WatchChangeState, WatchSubjectType } from '../watch';
/*
  REBASE · the same split the Security convergence hit. R2 was cut against C39, where a
  single `../sourceModel` owned this name; THIS lineage split that authority and
  `SourceProvenance` is declared in `../source-provenance`. Repointed at the current
  owner — `sourceModel` is NOT recreated, since a second module standing in front of the
  split authority would give the name two homes.
*/
import type { SourceProvenance } from '../source-provenance';
import type { OfficialSourceClass } from '../officialSources';
/*
  CF-D1 RESOLVED · repointed at the canonical owner, not recovered by hand.

  R2 was cut against C39, where `SpatialPrecision` lived in `../news`. This lineage's
  `news.ts` never carried it, and the Politics R1 landing was HELD at this line rather
  than recovering the C39 declaration — because CF-D1 assigned that promotion to Main,
  with a ruling on widening `PRODUCIBLE_SPATIAL_PRECISION` attached to it.

  `MAIN-CONFLICT-CANONICAL-FOUNDATION-R2` has now made that ruling and delivered
  `shared/src/spatial/precision.ts` as the single canonical authority. This import names
  it. Nothing was recovered from `3db5a09`, nothing was stubbed, and exactly one
  declaration of this type exists in the tree.
*/
import type { SpatialPrecision } from '../spatial/precision';
import type { RelationshipDirectionality } from '../relationships';

/* ═══════════════════════════════════════════════════════════════════════════
 * §1 · DOMAIN REGISTRATION — THE ANSWER TO Q16
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Q16 asked how Politics registers "against the current closed domain union". THE PREMISE WAS
 * WRONG, AND THE CORRECTION MATTERS MORE THAN THE ANSWER.
 *
 * MAIN-POLITICS-V1-AUDIT F-01/F-14 measured `SpecialistDomainId` in
 * `frontend/src/lib/specialist/specialistDomain.ts` — a CLOSED three-member union — and concluded
 * that registering Politics meant widening a shared union. Re-measured at C37, the platform's own
 * identifier is `RegisteredSpecialistDomainId` in `shared/src/specialist-claim.ts`, and it is:
 *
 *     "an OPEN branded string, not a closed union. §16 reserves slots for domains that do not
 *      exist yet (ECONOMY, MARKET, ENERGY, SECURITY, HUMANITARIAN). A closed union would make
 *      registering a reserved domain an edit to the platform, which is the opposite of what §16
 *      intends."
 *
 * and the same file records that the two names are deliberately different concepts at different
 * layers, by CTO ruling: "what the platform will accept as a registration, versus what the frontend
 * currently knows how to render."
 *
 * SO: POLITICS REGISTERS WITH NO UNION WIDENING ANYWHERE. `registeredSpecialistDomainId('POLITICS')`
 * is sufficient at the platform layer. The frontend union is a presentation register and is not
 * touched by this contract — it acquires a member only when a Politics surface is built, which is
 * not this task.
 *
 * WHY THE ID IS `POLITICS` AND NOT `ELECTION`. `participantEntity.ts` names ELECTION as the
 * Addendum's second consumer, and the frontend union carries `ELECTION`. Adopting it would make the
 * domain id wrong for two of Politics' three subjects — a legislative bill and a protest campaign
 * are not elections — and the platform's §16 comment shows slot names are indicative of intent, not
 * binding on registration. Election is a SUBJECT of Politics, not the name of the domain.
 */
export const POLITICS_DOMAIN_ID = 'POLITICS';

/**
 * THE REGISTRATION IS BLOCKED ON A PLATFORM ACT, AND THIS NAMES IT PRECISELY.
 *
 * `SpecialistClaimRegistry` refuses any definition whose `authoritySha256` is not in
 * `ACCEPTED_SPECIALIST_DESIGN_AUTHORITIES`, "which is how a domain definition built against a
 * superseded or unreviewed document is caught", and states that "it is the platform, not a domain,
 * that accepts a new authority".
 *
 * No Part VIII hash is in that map at C37. These are the exact digests a platform acceptance would
 * add. They are measured, not asserted — a registration that cites one of them is verifiable
 * against the shipped design package.
 */
export const POLITICS_DESIGN_AUTHORITY_SHA256 = {
  phase1Specification: '317fa2b5172f6669b93004deab63fe8fa55113561584199e6abfba3256b7b184',
  phase2StateFamily: 'c44eda157e05c4c0ea0ba7287e7675c0b71b4d05da800a24c0f2eeb5f44c25f6',
  ctoRulingsRegister: '9061f66a8761b73d64f849bbf5203c7bc4e565dfe6d7dc626190ea790adc9b7e',
} as const;

/**
 * THE NINTH DECISION — DECLARED AS A PLATFORM GAP, EXACTLY AS THE PLATFORM ASKS.
 *
 * `specialistDomain.ts` states the rule: a domain supplies eight decisions, and "if a future domain
 * needs a ninth kind of decision, that is a platform gap and belongs in the shared layer."
 *
 * Politics supplies all eight. It also needs one thing none of the eight holds: A CATALOGUE OF
 * DOMAIN LIFECYCLE EVENTS. Part VIII R08 turns on the distinction that lifecycle events are DOMAIN
 * FACTS while change states are ASSESSMENT OUTPUTS, and none of object subtypes, map layers, queue
 * ranking rule, indicator set, assessment sections, watch scope vocabulary, metered action list or
 * honesty rules is a place to put "BILL_PASSED happened". Conflict did not need one because its
 * vocabulary is a state ladder; Politics cannot be expressed that way without collapsing the two
 * concepts R08 exists to keep apart.
 *
 * So it is declared here, in the shared layer, generically — the platform's own remedy — with
 * Politics as its first instance. It is NOT a Politics-only structure and it is not a Watch state.
 */
export interface DomainLifecycleEventDefinition {
  /** Symbolic, uppercase, domain-scoped by construction: `<DOMAIN>:<EVENT>`. */
  readonly eventId: string;
  /** The object type this event attaches to. */
  readonly attachesTo: string;
  /**
   * The change state the SHARED assessment service is expected to be able to produce once it can.
   * DECLARING IT IS NOT PRODUCING IT — see §5's producer matrix, where most of these are blocked.
   */
  readonly expectedChangeState: WatchChangeState;
  /**
   * True when the event is a REVISION of an earlier event rather than a new one — a recount, a
   * gazette correction. Part VIII A-20 asks for Economy revision semantics by ANALOGY; this flag is
   * that analogy and deliberately not an import: Economy keys revisions on
   * (seriesId, periodId, vintage) and a political correction has neither series nor period.
   */
  readonly isRevisionOfPriorEvent: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §2 · POLITICAL ACTOR — A FACET, NEVER A SECOND IDENTITY SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `frontend/src/lib/specialist/participantEntity.ts` already declares itself "ONE IDENTITY SURFACE
 * FOR ANY PARTY TO AN INTELLIGENCE OBJECT", with "consumers CONFLICT (1st) · ELECTION (2nd) ·
 * DELIVERY (3rd)". Politics is that second consumer. This section adds ONLY what is politically
 * specific and adds no identity of its own: there is no id, no name, no image and no store here.
 *
 * THE IMAGE RULE IS INHERITED AND MUST NOT BE RE-DERIVED. Addendum §21, quoted in that file:
 * "A generated, substituted or inferred candidate portrait, UNDER ANY CIRCUMSTANCE." Politics is
 * the domain most likely to break it, so it is restated here as a pointer, never as a second rule.
 */
export const POLITICAL_ACTOR_ROLES = [
  'PARTY',
  'COALITION',
  'INSTITUTION',
  'OFFICEHOLDER',
  'CANDIDATE',
  'MOVEMENT',
  'ELECTORAL_AUTHORITY',
] as const;
export type PoliticalActorRole = (typeof POLITICAL_ACTOR_ROLES)[number];

/**
 * A ROLE IS HELD FOR A PERIOD, AGAINST A JURISDICTION, ON EVIDENCE — it is not an attribute of a
 * person. "Officeholder" with no term is how a former minister stays a minister forever.
 *
 * `entityRef` is an opaque handle into the shared participant surface. This module never resolves
 * it, so it cannot become a second identity resolver.
 */
export interface PoliticalActorFacet {
  readonly entityRef: string;
  readonly role: PoliticalActorRole;
  /** ISO 3166-1 alpha-2, or a curated regional body code, matching `SourceProvenance.jurisdiction`. */
  readonly jurisdiction: string;
  /** ISO-8601. Required, for the same reason a relationship edge requires `validFrom`. */
  readonly heldFrom: string;
  /** ABSENT MEANS STILL HELD as far as the evidence says — never "ended, date unknown". */
  readonly heldTo?: string;
  /** Non-empty. A role nobody evidenced is an assertion the platform cannot account for. */
  readonly evidenceRefs: readonly string[];
}

export function actorFacetIsAccountable(facet: PoliticalActorFacet): boolean {
  return facet.evidenceRefs.length > 0 && facet.jurisdiction.trim().length > 0;
}

/**
 * ELECTORAL_AUTHORITY IS A ROLE, NOT A FIELD ON AN ELECTION.
 *
 * Part VIII models the commission as an Actor, and the payoff is that its statements route through
 * the same claim-level authority rule as anyone else's (R07). A dedicated `electoralAuthority`
 * field on the election would have made the commission structurally authoritative about everything
 * it says — the §12 breach R06 exists to prevent.
 */
export const ELECTORAL_AUTHORITY_IS_AN_ACTOR_ROLE = true;

/* ═══════════════════════════════════════════════════════════════════════════
 * §3 · PERSISTENT SUBJECTS — THREE, AND THE REFUSALS ARE PART OF THE CONTRACT
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** C-01 and C-02, as approved. Exactly three, and the register is closed to casual growth. */
export const POLITICS_SUBJECT_TYPES = [
  'ELECTION',
  'LEGISLATIVE_SUBJECT',
  'PROTEST_CAMPAIGN',
] as const;
export type PoliticsSubjectType = (typeof POLITICS_SUBJECT_TYPES)[number];

/**
 * THE REFUSALS, MADE EXECUTABLE.
 *
 * A ruling written only in prose is a ruling an implementer can forget. These three are the ones
 * most likely to be re-proposed, because each is a noun a political dashboard obviously "has", so
 * each is named here with its accepted disposition and asserted by test.
 */
export const POLITICS_REFUSED_SUBJECT_TYPES = {
  CONSTITUENCY: 'GEOGRAPHY_FACET_OF_ELECTION',
  POLL: 'EVIDENCE_ARTIFACT',
  GOVERNANCE_STATE: 'DERIVED_COMPOSITE_ASSESSMENT',
} as const;
export type PoliticsRefusedSubjectType = keyof typeof POLITICS_REFUSED_SUBJECT_TYPES;

export function isPoliticsSubjectType(value: string): value is PoliticsSubjectType {
  return (POLITICS_SUBJECT_TYPES as readonly string[]).includes(value);
}

/** A refused type can never become a subject by being spelled confidently. */
export function politicsSubjectRefusal(value: string): string | null {
  return (POLITICS_REFUSED_SUBJECT_TYPES as Record<string, string>)[value] ?? null;
}

/**
 * Stage vocabularies are DOMAIN vocabularies and are never change states. `WatchChangeState` and
 * these unions are deliberately disjoint sets of words, so no display can substitute one for the
 * other (Part VIII R07's four-axis separation, made structural).
 */
export const ELECTION_STAGES = [
  'ANNOUNCED',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'CAMPAIGN',
  'POLLING',
  'COUNTING',
  'RESULT_DECLARED',
  'RESULT_CHALLENGED',
  'CONCLUDED',
] as const;
export type ElectionStage = (typeof ELECTION_STAGES)[number];

export const LEGISLATIVE_STAGES = [
  'INTRODUCED',
  'AMENDED',
  'PASSED',
  /**
   * R2 — THE HONEST OPPOSITE OF `PASSED`, AND THE ONE STAGE THE SOURCES FORCE.
   *
   * G-POLITICS-P0-SCHEMA-1 measured the gap precisely: Sejm's `Voting` stage "can pass **or
   * reject**. The candidate has `PASSED` and no `REJECTED`. A rejected bill has nowhere to go."
   * `ProcessDetails.passed` is a boolean, and EP carries `PLENARY_REJECT_COUNCIL_POSITION`
   * outright. Without this member a defeated bill either silently disappears or is misrepresented
   * as something else — and the two available misrepresentations, `WITHDRAWN` and `VETOED`, are
   * both legally different acts by different actors.
   *
   * THIS IS NOT A REDESIGN OF PART VIII. The accepted spec states the legislative stages
   * illustratively — "introduced→amended→passed→vetoed→signed" — and says the persistent state IS
   * the stage. A lifecycle that can say a proposal succeeded and cannot say it failed is
   * incomplete, not differently designed. Nothing else in this file's stage vocabulary changed.
   */
  'REJECTED',
  'VETOED',
  'SIGNED',
  'IMPLEMENTED',
  'WITHDRAWN',
] as const;
export type LegislativeStage = (typeof LEGISLATIVE_STAGES)[number];

export const PROTEST_STAGES = ['CALLED', 'HELD', 'ESCALATED', 'CONCLUDED'] as const;
export type ProtestStage = (typeof PROTEST_STAGES)[number];

/**
 * A subject registration, as Politics would supply it. `subjectId` is the caller's, in the
 * platform's existing content-addressed sense; nothing here issues one.
 */
export interface PoliticsSubjectRegistration {
  readonly subjectType: PoliticsSubjectType;
  readonly subjectId: string;
  readonly jurisdiction: string;
  /**
   * The stage vocabulary this subject uses. Typed as the union of the three so a legislative stage
   * cannot be written onto an election without the compiler objecting.
   */
  readonly stage: ElectionStage | LegislativeStage | ProtestStage;
  /**
   * The geographic level at which this subject may be addressed AT MOST. Never raised by
   * provenance, never interpolated: `shared/src/news.ts` already owns that rule and this field only
   * carries its outcome.
   */
  readonly precisionCeiling: SpatialPrecision;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §4 · POLITICAL EDGE TYPES — OVER THE SHARED SUBSTRATE, NOT BESIDE IT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The types live here; the edge structure, identity, validity and evidence rules live in
 * `shared/src/relationships`. Politics contributes vocabulary and nothing structural, which is the
 * same division `specialistDomain.ts` requires of every domain: "a domain configures the platform,
 * never the reverse."
 *
 * Every id is namespaced `POLITICS:` because the platform already warns that three distinct
 * meanings of CONTESTED / CONTESTED_MEMBERSHIP / DISPUTED exist and "a later domain reusing one of
 * those words for its own state would make a fourth".
 */
export const POLITICS_EDGE_TYPES = {
  COALITION_MEMBER: { id: 'POLITICS:COALITION_MEMBER', directionality: 'SYMMETRIC' },
  SUPPORTS_GOVERNMENT: { id: 'POLITICS:SUPPORTS_GOVERNMENT', directionality: 'DIRECTED' },
  IN_OPPOSITION_TO: { id: 'POLITICS:IN_OPPOSITION_TO', directionality: 'DIRECTED' },
  ENDORSED_BY: { id: 'POLITICS:ENDORSED_BY', directionality: 'DIRECTED' },
  APPOINTED_BY: { id: 'POLITICS:APPOINTED_BY', directionality: 'DIRECTED' },
  HAS_OVERSIGHT_OF: { id: 'POLITICS:HAS_OVERSIGHT_OF', directionality: 'DIRECTED' },
  LEGAL_CHALLENGE_TO: { id: 'POLITICS:LEGAL_CHALLENGE_TO', directionality: 'DIRECTED' },
  SUCCEEDS: { id: 'POLITICS:SUCCEEDS', directionality: 'DIRECTED' },
} as const satisfies Record<
  string,
  { readonly id: string; readonly directionality: RelationshipDirectionality }
>;

export type PoliticsEdgeTypeName = keyof typeof POLITICS_EDGE_TYPES;

/**
 * GOVERNANCE STATE IS DERIVED FROM THESE AND FROM LIFECYCLE EVENTS — D-02, unchanged.
 *
 * The subset that composes it is named so the derivation is legible and so nothing else quietly
 * becomes constitutive of "who governs". This is a declaration of INPUTS, not a scorer: there is no
 * function in this module that takes edges and returns a governance state, and there must not be —
 * that is the shared assessment service's work, and Part VIII R11 puts ranking and assessment
 * outside the domain and outside the frontend.
 */
export const GOVERNANCE_STATE_CONSTITUTIVE_EDGES: readonly PoliticsEdgeTypeName[] = [
  'COALITION_MEMBER',
  'SUPPORTS_GOVERNMENT',
  'IN_OPPOSITION_TO',
  'APPOINTED_BY',
];

/* ═══════════════════════════════════════════════════════════════════════════
 * §5 · LIFECYCLE EVENTS, WATCH REGISTRATION AND THE PRODUCER MATRIX
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * NO WATCH CHANGE STATE IS ADDED. `shared/src/watch.ts` says "DO NOT EXTEND THIS UNION. R2: the
 * seven states are fixed here and closed to extension", and Politics has no need to extend it: an
 * election that acquires a date is a DOMAIN FACT, and SIGNIFICANT_CHANGE is the ASSESSMENT that may
 * follow. R08 states the chain and this section encodes it:
 *
 *     lifecycle event → shared reassessment → shared change state → attentionRank reorder
 */
export const POLITICS_LIFECYCLE_EVENTS: readonly DomainLifecycleEventDefinition[] = [
  { eventId: 'POLITICS:ELECTION_DATE_SET', attachesTo: 'ELECTION', expectedChangeState: 'SIGNIFICANT_CHANGE', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:CANDIDATE_LIST_PUBLISHED', attachesTo: 'ELECTION', expectedChangeState: 'NEW_EVIDENCE', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:REGISTRATION_OPENED', attachesTo: 'ELECTION', expectedChangeState: 'DEVELOPING', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:REGISTRATION_CLOSED', attachesTo: 'ELECTION', expectedChangeState: 'DEVELOPING', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:OFFICIAL_RESULT_DECLARED', attachesTo: 'ELECTION', expectedChangeState: 'SIGNIFICANT_CHANGE', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:RESULT_CORRECTED', attachesTo: 'ELECTION', expectedChangeState: 'SIGNIFICANT_CHANGE', isRevisionOfPriorEvent: true },
  { eventId: 'POLITICS:RESULT_CHALLENGED', attachesTo: 'ELECTION', expectedChangeState: 'DISPUTED', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:ELECTION_AUTHORITY_DECISION', attachesTo: 'ELECTION', expectedChangeState: 'NEW_EVIDENCE', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:BILL_INTRODUCED', attachesTo: 'LEGISLATIVE_SUBJECT', expectedChangeState: 'NEW', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:BILL_AMENDED', attachesTo: 'LEGISLATIVE_SUBJECT', expectedChangeState: 'DEVELOPING', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:BILL_PASSED', attachesTo: 'LEGISLATIVE_SUBJECT', expectedChangeState: 'SIGNIFICANT_CHANGE', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:BILL_REJECTED', attachesTo: 'LEGISLATIVE_SUBJECT', expectedChangeState: 'SIGNIFICANT_CHANGE', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:VETOED', attachesTo: 'LEGISLATIVE_SUBJECT', expectedChangeState: 'SIGNIFICANT_CHANGE', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:SIGNED', attachesTo: 'LEGISLATIVE_SUBJECT', expectedChangeState: 'SIGNIFICANT_CHANGE', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:GAZETTE_CORRECTION', attachesTo: 'LEGISLATIVE_SUBJECT', expectedChangeState: 'NEW_EVIDENCE', isRevisionOfPriorEvent: true },
  { eventId: 'POLITICS:COURT_RULING', attachesTo: 'LEGISLATIVE_SUBJECT', expectedChangeState: 'SIGNIFICANT_CHANGE', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:PROTEST_CALLED', attachesTo: 'PROTEST_CAMPAIGN', expectedChangeState: 'DEVELOPING', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:PROTEST_HELD', attachesTo: 'PROTEST_CAMPAIGN', expectedChangeState: 'DEVELOPING', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:PROTEST_ESCALATED', attachesTo: 'PROTEST_CAMPAIGN', expectedChangeState: 'DEVELOPING', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:COALITION_FORMED', attachesTo: 'POLITICAL_ACTOR', expectedChangeState: 'SIGNIFICANT_CHANGE', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:COALITION_COLLAPSED', attachesTo: 'POLITICAL_ACTOR', expectedChangeState: 'SIGNIFICANT_CHANGE', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:RESIGNATION', attachesTo: 'POLITICAL_ACTOR', expectedChangeState: 'SIGNIFICANT_CHANGE', isRevisionOfPriorEvent: false },
  { eventId: 'POLITICS:APPOINTMENT', attachesTo: 'POLITICAL_ACTOR', expectedChangeState: 'SIGNIFICANT_CHANGE', isRevisionOfPriorEvent: false },
  /**
   * R08's CTO correction, kept: a newly admissible independent poll IS new evidence whether or not
   * it moves the assessment. Evidence novelty and assessment materiality are different concepts.
   */
  { eventId: 'POLITICS:POLL_PUBLISHED', attachesTo: 'ELECTION', expectedChangeState: 'NEW_EVIDENCE', isRevisionOfPriorEvent: false },
];

/**
 * THE PRODUCER MATRIX — WHAT THE RUNTIME CAN ACTUALLY SAY TODAY.
 *
 * `WATCH_CHANGE_STATES_DERIVABLE_TODAY` is `['NEW_EVIDENCE','NO_MATERIAL_CHANGE']`, and
 * `watch-readiness.ts` names the missing capability behind each of the other five. This constant is
 * that measurement carried into the Politics contract so no implementer discovers it late.
 *
 * READ IT AS A GAP LIST, NOT A ROADMAP. Nothing here creates a producer, and this contract must not
 * be read as authorising one.
 */
export const POLITICS_CHANGE_STATE_PRODUCER_GAPS: Readonly<Record<string, string>> = {
  NEW: 'Needs run history — SUBJECT_PERSISTENCE. No table exists for watch subjects, snapshots or cursors.',
  SIGNIFICANT_CHANGE:
    'R2 gives it a ring, an alert and a chip but NO MAGNITUDE THRESHOLD. Not derivable until a rule exists. Twelve of the twenty-three Politics events expect it.',
  DEVELOPING: 'Needs at least two prior runs — persistence.',
  DISPUTED:
    'Needs assessment-level detection that sources disagree ABOUT WHAT CHANGED. Analysis-lane capability. RESULT_CHALLENGED has no other home.',
  STABLE: 'Shown with a duration; a duration needs history.',
};

/** The two that can be produced today. Copied from no one: re-stated so a Politics consumer sees it. */
export const POLITICS_CHANGE_STATES_PRODUCIBLE_TODAY: readonly WatchChangeState[] = [
  'NEW_EVIDENCE',
  'NO_MATERIAL_CHANGE',
];

/**
 * WATCH SUBJECT REGISTRATION IS BLOCKED, AND THE BLOCK IS NOT MINE TO LIFT.
 *
 * `WatchSurface` is `'MAP' | 'ECONOMY' | 'MARKET' | 'CONFLICT'` and `WatchSubjectType` is a closed
 * 16-member union, both tabulated from Part IV v1.2 R2 §17. Politics appears in neither. Unlike the
 * domain-registration union (§1), these are NOT open by design — they are a transcription of an
 * accepted table, and adding to them is an amendment to Part IV, not a platform affordance.
 *
 * This contract therefore declares the mapping it WOULD need and refuses to enact it. The proposed
 * subject types are given as plain strings, deliberately NOT as `WatchSubjectType`, so no consumer
 * can mistake a proposal for a registration.
 */
export interface PoliticsWatchRegistrationProposal {
  readonly proposedSurface: 'POLITICS';
  readonly proposedSubjectTypes: readonly string[];
  readonly compositeScopeRequired: boolean;
  readonly blockedBy: readonly string[];
}

export const POLITICS_WATCH_REGISTRATION_PROPOSAL = {
  proposedSurface: 'POLITICS',
  proposedSubjectTypes: [
    'ELECTION',
    'LEGISLATIVE_SUBJECT',
    'PROTEST_CAMPAIGN',
    'POLITICAL_ACTOR',
    'GOVERNANCE_STATE',
    'POLITICAL_THEME',
  ],
  /** GOVERNANCE_STATE and POLITICAL_THEME are composite scopes — C-03, approved for design only. */
  compositeScopeRequired: true,
  blockedBy: [
    'PART_IV_R2_S17: WatchSurface has no POLITICS member and the table is an accepted transcription, not an open register.',
    'PART_IV_RUNTIME: no composite Watch scope exists — WatchSubject is one subject; the only scope is the geographic WatchScopeChain.',
    'SUBJECT_PERSISTENCE: watch-readiness declares no table for subjects, snapshots or cursors.',
    'ENTITLEMENT: canonical states "no tier, no plan, no entitlement" (watch.ts) and that ceilings are resource bounds, not entitlements (follows.ts). Composite Watch counting has no runtime to reconcile against.',
  ],
} as const satisfies PoliticsWatchRegistrationProposal;

/** A compile-time reminder that the proposal is not a `WatchSubjectType`, and must not become one here. */
export type PoliticsWatchSubjectTypeIsNotRegistered = Exclude<
  (typeof POLITICS_WATCH_REGISTRATION_PROPOSAL.proposedSubjectTypes)[number],
  WatchSubjectType
>;

/** R3: adding a proposed type to WatchSubjectType must fail compilation. */
type ProposalIsUnregistered =
  [(typeof POLITICS_WATCH_REGISTRATION_PROPOSAL.proposedSubjectTypes)[number]] extends
    [PoliticsWatchSubjectTypeIsNotRegistered] ? true : never;
export const POLITICS_WATCH_PROPOSAL_IS_UNREGISTERED: ProposalIsUnregistered = true;

/* ═══════════════════════════════════════════════════════════════════════════
 * §6 · ARTIFACT-LEVEL SOURCE CLASS — THE §12 RULE, GIVEN A CARRIER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A CORRECTION TO THIS PROGRAMME'S OWN AUDIT. MAIN-POLITICS-V1-AUDIT F-02 said R06's rule "has no
 * carrier". Re-measured, that is half wrong and the precise version is more useful:
 * `SourceProvenance` IS a record-level carrier — "the provenance of one retrieved record" — and it
 * already holds `sourceType`, `evidenceRole` and `authorityClass`. What is true is narrower:
 * `authorityClass` is documented as "populated only for a source present in the official-source
 * registry", so it is INSTITUTION-DERIVED. It cannot express R06's actual rule, which is that the
 * same commission's gazette and press remark carry different classes.
 *
 * So the minimal change is not a new provenance model and not a replacement for
 * SourceType × EvidenceRole. It is one artifact-level classification that sits BESIDE provenance
 * and is forbidden from being derived from the registry.
 */
export const POLITICAL_SOURCE_CLASSES = [
  'OFFICIAL_LEGAL_RECORD',
  'ELECTORAL_AUTHORITY_RECORD',
  'PARLIAMENTARY_RECORD',
  'COURT_RULING',
  'PARTY_OR_CANDIDATE_STATEMENT',
  'GOVERNMENT_STATEMENT',
  'OBSERVER_FINDING',
  'POLLING_SURVEY',
  'JOURNALISM',
  'INDEPENDENT_ANALYSIS',
  'ATTRIBUTABLE_PUBLIC_STATEMENT',
] as const;
export type PoliticalSourceClass = (typeof POLITICAL_SOURCE_CLASSES)[number];

/**
 * R06's TWO COLUMNS, EXECUTABLE. "Authority for" and "never implies" are the whole of §12, and as
 * prose they are advisory. As data a consumer must read, a surface cannot show a party statement as
 * a confirmed fact without ignoring a field that is right there.
 */
export interface PoliticalSourceClassWarrant {
  readonly authorityFor: string;
  readonly neverImplies: string;
}

export const POLITICAL_SOURCE_CLASS_WARRANT: Readonly<
  Record<PoliticalSourceClass, PoliticalSourceClassWarrant>
> = {
  OFFICIAL_LEGAL_RECORD: { authorityFor: 'The legal fact of the instrument', neverImplies: "That the instrument's political framing is true" },
  ELECTORAL_AUTHORITY_RECORD: { authorityFor: 'Procedural facts, deadlines, declared results', neverImplies: 'Correctness of contested results' },
  PARLIAMENTARY_RECORD: { authorityFor: 'What was tabled, voted, minuted', neverImplies: 'Political effect' },
  COURT_RULING: { authorityFor: 'The legal finding and its operative order', neverImplies: 'A broader factual narrative' },
  PARTY_OR_CANDIDATE_STATEMENT: { authorityFor: 'That the actor said it', neverImplies: 'Truth of its content' },
  GOVERNMENT_STATEMENT: { authorityFor: 'Official position', neverImplies: 'Verified fact' },
  OBSERVER_FINDING: { authorityFor: 'A methodologically-bounded finding', neverImplies: 'Legal determination' },
  POLLING_SURVEY: { authorityFor: 'A measurement under a stated method', neverImplies: 'Election outcome' },
  JOURNALISM: { authorityFor: 'A reported claim with named sourcing', neverImplies: 'Confirmation' },
  INDEPENDENT_ANALYSIS: { authorityFor: 'An assessment with method', neverImplies: 'Fact' },
  ATTRIBUTABLE_PUBLIC_STATEMENT: { authorityFor: 'Attribution of the statement', neverImplies: 'Anything about its content' },
};

/**
 * TWO OF THE FOUR C-05 CLASSES ALREADY EXIST IN CANONICAL, AND ONE WAS NEVER REQUESTED.
 *
 * `OfficialSourceClass` at C37 already contains `COURT` and `OFFICIAL_ELECTION_AUTHORITY`. This map
 * says which political class an institutional class may legitimately hint at, in ONE direction
 * only: a registry class can never SET the artifact class, because that would reintroduce exactly
 * the institution-level derivation §12 forbids. It exists so a consumer can tell "consistent" from
 * "contradictory", not so anything can be auto-filled.
 */
export const INSTITUTIONAL_CLASS_CONSISTENT_WITH: Readonly<
  Partial<Record<OfficialSourceClass, readonly PoliticalSourceClass[]>>
> = {
  OFFICIAL_ELECTION_AUTHORITY: ['ELECTORAL_AUTHORITY_RECORD', 'GOVERNMENT_STATEMENT'],
  COURT: ['COURT_RULING', 'OFFICIAL_LEGAL_RECORD'],
  GOVERNMENT: ['GOVERNMENT_STATEMENT', 'OFFICIAL_LEGAL_RECORD'],
  RESEARCH: ['INDEPENDENT_ANALYSIS'],
  NEWS_AGENCY: ['JOURNALISM'],
  NEWS_PUBLISHER: ['JOURNALISM'],
};

/**
 * THE CARRIER. It attaches to ONE artifact and states how the class was decided.
 *
 * `assignedFrom` has no `REGISTRY` member and must never gain one. That absence is the contract:
 * there is nowhere to record "this class came from the institution", so the §12 breach cannot be
 * expressed, let alone shipped.
 */
export type PoliticalClassAssignment = 'ARTIFACT_INSPECTION' | 'PUBLISHER_DECLARATION';

export interface PoliticalArtifactClassification {
  /** Opaque handle to the artifact this classification is ABOUT. Never dereferenced here. */
  readonly artifactRef: string;
  readonly politicalClass: PoliticalSourceClass;
  readonly assignedFrom: PoliticalClassAssignment;
  /**
   * The claim this class is authoritative FOR, in the artifact's own terms. R07's claim-level
   * authority rule: "One authoritative record confirms only the fact for which that artifact is
   * authoritative." Required, because an authority with no stated scope is an authority that spills.
   */
  readonly authoritativeForClaimRef: string;
  /** Syndication: repeated wire copy counts as ONE source. R06. Absent when not syndicated. */
  readonly syndicationOriginRef?: string;
  /** Provenance stays where it already lives; this composes with it and never replaces it. */
  readonly provenance?: SourceProvenance;
}

/** A classification that names no claim cannot honour R07, so this is validity, not preference. */
export function classificationIsClaimScoped(c: PoliticalArtifactClassification): boolean {
  return c.authoritativeForClaimRef.trim().length > 0;
}

/**
 * Consistency, never derivation. Returns null when the registry says nothing about the pairing —
 * silence is not a contradiction, and treating it as one would push implementers toward filling the
 * field from the registry to keep the check quiet.
 */
export function institutionalClassIsConsistent(
  c: PoliticalArtifactClassification,
): boolean | null {
  const authorityClass = c.provenance?.authorityClass;
  if (authorityClass === undefined) return null;
  const permitted = INSTITUTIONAL_CLASS_CONSISTENT_WITH[authorityClass];
  if (permitted === undefined) return null;
  return permitted.includes(c.politicalClass);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §7 · POLL ARTIFACT — EVIDENCE, NEVER A SUBJECT, NEVER A FORECAST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * D-04 as amended: a poll is an evidence artifact; a derived comparison view is permitted only
 * where polls are genuinely comparable; every contributing poll is cited; no forecast.
 *
 * THE PROHIBITION IS STRUCTURAL, NOT WRITTEN. There is no function in this module that takes two or
 * more polls and returns a number, a trend, a lead, a swing or a projection — the same technique
 * `competingReadings.ts` already uses ("NO FUNCTION IN THIS MODULE THAT TAKES TWO READINGS AND
 * RETURNS A NUMBER"), and a test asserts none is added. A poll aggregate cannot be shipped by
 * accident because there is nowhere to put it.
 */
export interface PollArtifact {
  readonly artifactRef: string;
  /** The pollster as an actor reference — an organisation with a role, not a free-text name. */
  readonly pollsterRef: string;
  /** Who paid. ABSENT means not disclosed by the publication, and that absence is itself reportable. */
  readonly sponsorRef?: string;
  /** ISO-8601. Fieldwork start and end, never a single "date" — a poll is taken over a period. */
  readonly fieldStart: string;
  readonly fieldEnd: string;
  readonly sampleSize: number;
  /** Who was sampled, as the publication states it: "registered voters", "adults 18+". */
  readonly population: string;
  /** The geography the survey covers, at the precision the publication states. */
  readonly geographyRef: string;
  readonly geographyPrecision: SpatialPrecision;
  /** Verbatim. Two polls with different wording are not measuring the same thing. */
  readonly questionWording: string;
  readonly mode: PollMode;
  /** Only when the publication supplies it. Never computed here from the sample size. */
  readonly marginOfError?: number;
  readonly publishedAt: string;
  /** Where the methodology statement itself can be read. */
  readonly methodologyRef?: string;
  /** A pollster's own revision of an earlier release. Points at the artifact it revises. */
  readonly revisesArtifactRef?: string;
}

export const POLL_MODES = ['TELEPHONE', 'ONLINE_PANEL', 'FACE_TO_FACE', 'MIXED', 'UNSTATED'] as const;
export type PollMode = (typeof POLL_MODES)[number];

/**
 * COMPARABILITY IS DETERMINED UPSTREAM AND ONLY REPORTED HERE.
 *
 * These four axes are R16 ruling 13's own conditions. The function below states whether the four
 * MATCH — it does not decide whether matching makes two polls "genuinely comparable", because that
 * is an editorial determination with no owner today (§9). A surface may use a false result to
 * refuse a comparison; a true result is a precondition, never a permission.
 */
export interface PollComparabilityAxes {
  readonly samePollster: boolean;
  readonly sameSampleFrame: boolean;
  readonly sameQuestionWording: boolean;
  readonly bothPublishMargins: boolean;
}

export function comparabilityAxesAllMatch(axes: PollComparabilityAxes): boolean {
  return (
    axes.samePollster && axes.sameSampleFrame && axes.sameQuestionWording && axes.bothPublishMargins
  );
}

/** Excluded polls are DRAWN, not dropped — R16 ruling 13 and Phase 2 state 05. */
export interface PollComparisonExclusion {
  readonly artifactRef: string;
  readonly reason: 'DIFFERENT_METHOD' | 'DIFFERENT_GEOGRAPHY' | 'DIFFERENT_QUESTION' | 'NO_PUBLISHED_MARGIN';
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §8 · ELECTORAL GEOGRAPHY — A SEPARATE AXIS, AND THE LADDER IS NOT TOUCHED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Canonical already ruled on this, from data rather than from modelling taste:
 *
 *     administrative-ladder.contract.ts, KE absentBelow:
 *       "Constituency — ELECTORAL axis, not administrative — a constituency is not a sub-county
 *        even where boundaries coincide. No rung carries it, and county geometry additionally
 *        depends on IEBC boundary licensing."
 *
 * Kenya's declared ladder has exactly one rung (ADMIN1 County). NOTHING IN THIS CONTRACT MUTATES
 * THE LADDER, adds a rung, or makes an electoral unit addressable. The electoral axis is declared
 * as its own thing precisely so it cannot be mistaken for an administrative rung.
 */
export const ELECTORAL_UNIT_KINDS = ['CONSTITUENCY', 'WARD', 'DISTRICT_SEAT', 'NATIONAL'] as const;
export type ElectoralUnitKind = (typeof ELECTORAL_UNIT_KINDS)[number];

/**
 * DECLARED, AND PRODUCIBLE BY NOTHING.
 *
 * The same rule `PRODUCIBLE_GEO_PRECISION` follows: declaring a member is not claiming a producer.
 * No gazetteer carries electoral geometry, so this array is empty and a consumer reads it to learn
 * that the entire axis is currently unaddressable — rather than waiting for geometry that will not
 * arrive.
 */
export const PRODUCIBLE_ELECTORAL_UNIT_KINDS: readonly ElectoralUnitKind[] = [];

/**
 * An electoral unit is identified by the AUTHORITY that publishes it, never by a shape.
 *
 * `authorityRef` is the electoral commission as an actor; `officialCode` is that authority's own
 * code. Two authorities may both publish a "Constituency 12" and they are different units.
 * There is deliberately NO geometry field: a unit the platform cannot draw must not carry a
 * half-drawn outline, and Part VIII §16 forbids inventing constituency precision.
 */
export interface ElectoralUnitRef {
  readonly kind: ElectoralUnitKind;
  readonly authorityRef: string;
  readonly officialCode: string;
  /**
   * The administrative geography this unit is REPORTED AGAINST — the addressable ceiling, e.g.
   * `admin1:KE-30`. This is where the unit's results may honestly be shown, and it is NOT a claim
   * that the unit and that geography coincide.
   */
  readonly reportedAgainstGeographyId: string;
  readonly reportingPrecision: SpatialPrecision;
}

/**
 * D-01, executable: a constituency race is an ELECTION scoped to a geography, not a subject per
 * seat. The scoping is expressed as a field on the election, so there is no second geographic
 * identity space beside Spatial and no thousands of low-signal watchable objects.
 */
export interface ElectionElectoralScope {
  readonly electionSubjectId: string;
  readonly unit: ElectoralUnitRef;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §9 · EDITORIAL THRESHOLDS — WHERE THE DECISION BELONGS, NOT WHAT IT IS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Two determinations are required by the accepted design, forbidden to the frontend, and owned by
 * nobody at C37 (MAIN-POLITICS-V1-AUDIT F-06):
 *
 *   D-03  when a mobilisation is SUSTAINED, and therefore a subject rather than an event.
 *         "Threshold is editorial, supplied upstream, never inferred in the frontend."
 *   D-04  when polls are GENUINELY COMPARABLE, beyond the four mechanical axes in §7.
 *
 * THESE ARE NOT CONFIGURATION AND MUST NOT BECOME CONSTANTS. A number in a config file is still a
 * platform decision about what counts as a political movement; the design's point is that a person
 * with editorial accountability decides, and the platform records WHO decided and WHEN.
 *
 * So the contract surface is a DECISION RECORD, not a threshold value. There is no default, no
 * fallback and no inference path — a subject with no admitted decision is not a subject, and a
 * comparison with no admitted decision is not drawn.
 */
export type EditorialDeterminationKind = 'SUSTAINED_MOBILISATION' | 'POLL_COMPARABILITY';

export interface EditorialDetermination {
  readonly kind: EditorialDeterminationKind;
  /** What the determination is about: a candidate protest subject, or a poll set. */
  readonly aboutRefs: readonly string[];
  readonly admitted: boolean;
  /**
   * The accountable decider. NOT a service, NOT a model, NOT 'system'. A determination whose author
   * cannot be named is the inference the design forbids, wearing a record's clothes.
   */
  readonly decidedBy: string;
  readonly decidedAt: string;
  /** Free text, in the decider's own words. The platform never generates it. */
  readonly rationale: string;
}

/**
 * The absence of a determination is a distinct, reportable state — never a default of `false` and
 * never a reason to fall back to a rule of thumb.
 */
export type EditorialDeterminationOutcome =
  | { readonly status: 'ADMITTED'; readonly determination: EditorialDetermination }
  | { readonly status: 'REFUSED'; readonly determination: EditorialDetermination }
  | { readonly status: 'NOT_DETERMINED' };

export function editorialOutcome(
  determinations: readonly EditorialDetermination[],
  kind: EditorialDeterminationKind,
  aboutRef: string,
): EditorialDeterminationOutcome {
  const match = determinations.find(
    (d) => d.kind === kind && d.aboutRefs.includes(aboutRef),
  );
  if (match === undefined) return { status: 'NOT_DETERMINED' };
  return match.admitted
    ? { status: 'ADMITTED', determination: match }
    : { status: 'REFUSED', determination: match };
}

/**
 * A determination with no named human decider is not a determination. `SYSTEM`, `AUTO` and an empty
 * string are refused by name because those are the three spellings this would otherwise acquire.
 */
export function determinationIsAccountable(d: EditorialDetermination): boolean {
  const who = d.decidedBy.trim().toUpperCase();
  return who.length > 0 && who !== 'SYSTEM' && who !== 'AUTO' && who !== 'AI' && d.rationale.trim().length > 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §10 · FUTURE SECURITY RECONCILIATION REQUIRED — RECORDED, NOT RESOLVED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Security Intelligence is being designed elsewhere. These five items are carried verbatim from
 * MAIN-POLITICS-V1-AUDIT Gate 17. Nothing in this contract resolves, pre-empts or shapes them, and
 * no Security vocabulary is declared anywhere in this file.
 */
export const FUTURE_SECURITY_RECONCILIATION_REQUIRED: readonly string[] = [
  'S-1: Six Politics→Security link categories are named by R10 §18 — whether these are Security subjects, Politics facets, or cross-domain references under C-07 is Security\'s architecture to state.',
  'S-2: "Election security" straddles O2 and Security — ownership of an election-security assessment cannot be settled from the Politics side alone.',
  'S-3: Protest escalation already routes to Conflict (R08, C-07) — if Security later claims part of that path, the C-07 facet split must be re-cut, not duplicated.',
  'S-4: SpecialistDomainId (frontend, presentation) is a closed three-member union — adding Security, or Politics, is a presentation-layer change; the platform-layer id is open. The "ninth kind of decision is a platform gap" rule governs both.',
  'S-5: R06/C-05 source classes may need a security/intelligence-assessment class — raising it inside Politics would pre-empt Security\'s evidence model.',
];

/* ═══════════════════════════════════════════════════════════════════════════
 * §11 · R2 — SOURCE-STAGE FIDELITY. THE SUMMARY IS NOT THE PROCEDURE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G-POLITICS-P0-SCHEMA-1's verdict is the finding this section exists to honour:
 *
 *     "The candidate's seven stages are a lifecycle summary, not a legal-procedure vocabulary,
 *      and the sources are the opposite. Sejm exposes 15 typed stages, EP ~52 activity types
 *      crossed with a phase authority, CDM four independent date axes."
 *
 * ADDING THE MISSING STAGES TO THE SUMMARY WOULD BE THE WRONG FIX. Readings, committee
 * proceedings, Senate positions, presidential referral to the Constitutional Tribunal and trilogue
 * are Polish and European PROCEDURE. Folding fifteen of them into a shared vocabulary would make
 * every other jurisdiction's lifecycle wrong, and Part VIII deliberately specifies a summary.
 *
 * DROPPING THEM WOULD ALSO BE WRONG, and it is what R1 implicitly did: a source stage with no
 * target simply had nowhere to go.
 *
 * THE THIRD OPTION, WHICH IS THE ONE TAKEN: keep the summary stage exactly as Part VIII specifies,
 * and carry the SOURCE-NATIVE STAGE VERBATIM beside it, with the fidelity of the mapping stated.
 * Nothing is collapsed, nothing is invented, and a surface that wants to show "third reading" can,
 * while `summaryStage` stays the seven-member vocabulary the design drew.
 */
export const LEGISLATIVE_SOURCE_SCHEMES = [
  'SEJM_PROCESS_STAGE',
  'EP_ACTIVITY_TYPE',
  'EP_PROCEDURE_PHASE',
  'SEJM_ELI',
  'EU_CDM',
] as const;
export type LegislativeSourceScheme = (typeof LEGISLATIVE_SOURCE_SCHEMES)[number];

/**
 * EXACT       the source value determines the summary stage on its own.
 * CONDITIONAL the source value needs a SECOND field to decide, named in `conditionOn`. Sejm's
 *             `Voting` is the type case: the stage alone does not say whether the bill passed.
 * UNMAPPABLE  no summary stage is correct. `summaryStage` MUST be null — this is the member that
 *             makes "do not collapse" enforceable rather than advisory.
 */
export type LegislativeMappingFidelity = 'EXACT' | 'CONDITIONAL' | 'UNMAPPABLE';

export interface LegislativeStageObservation {
  readonly subjectId: string;
  readonly sourceScheme: LegislativeSourceScheme;
  /** The source's own value, verbatim. Never normalised, never translated, never dropped. */
  readonly sourceValue: string;
  readonly fidelity: LegislativeMappingFidelity;
  /** NULL is a legitimate, required answer when fidelity is UNMAPPABLE. */
  readonly summaryStage: LegislativeStage | null;
  /** REQUIRED when fidelity is CONDITIONAL: which other field decided it. */
  readonly conditionOn?: string;
  readonly observedAt: string;
}

/**
 * The two rules that stop a lossy mapping from being written as a clean one. Both directions are
 * checked: an UNMAPPABLE observation may not carry a stage, and a CONDITIONAL one may not hide
 * which field it depended on.
 */
export function stageObservationIsHonest(o: LegislativeStageObservation): boolean {
  if (o.sourceValue.trim().length === 0) return false;
  if (o.fidelity === 'UNMAPPABLE') return o.summaryStage === null;
  if (o.fidelity === 'CONDITIONAL') {
    return o.summaryStage !== null && (o.conditionOn ?? '').trim().length > 0;
  }
  return o.summaryStage !== null;
}

/* ── THE SEJM CROSSWALK — ALL 14 DOCUMENTED ProcessStage VARIANTS ──────────
 *
 * 2 EXACT · 3 CONDITIONAL · 9 UNMAPPABLE. No generic OTHER exists, and none was created to make
 * the table look complete: an unmappable stage is recorded with its reason and a null target.
 */
export interface LegislativeCrosswalkEntry {
  readonly sourceValue: string;
  readonly fidelity: LegislativeMappingFidelity;
  readonly summaryStage: LegislativeStage | null;
  readonly conditionOn?: string;
  /** Why, in the source's own terms. Required for every CONDITIONAL and UNMAPPABLE row. */
  readonly note: string;
}

export const SEJM_STAGE_CROSSWALK: readonly LegislativeCrosswalkEntry[] = [
  { sourceValue: 'Start', fidelity: 'EXACT', summaryStage: 'INTRODUCED', note: 'processStartDate + printNumber.' },
  { sourceValue: 'Veto', fidelity: 'EXACT', summaryStage: 'VETOED', note: 'Presidential veto, as the summary means it.' },
  { sourceValue: 'CommitteeReport', fidelity: 'CONDITIONAL', summaryStage: 'AMENDED', conditionOn: 'minorityMotions non-empty', note: 'A committee report with no motions is not an amendment. The summary has no committee stage.' },
  { sourceValue: 'Voting', fidelity: 'CONDITIONAL', summaryStage: 'PASSED', conditionOn: 'ProcessDetails.passed', note: 'A vote can pass OR reject. R2 adds REJECTED so the false branch has a target; the stage alone still does not say which.' },
  { sourceValue: 'End', fidelity: 'CONDITIONAL', summaryStage: 'PASSED', conditionOn: 'ProcessDetails.passed', note: 'End does not say which outcome. The stage alone is insufficient.' },
  { sourceValue: 'SejmReading', fidelity: 'UNMAPPABLE', summaryStage: null, note: 'Three readings exist in Polish procedure. Collapsing them into PASSED would destroy the distinction between first-reading referral and third-reading adoption.' },
  { sourceValue: 'SenatePosition', fidelity: 'UNMAPPABLE', summaryStage: null, note: 'A bicameral stage. The summary is unicameral in shape.' },
  { sourceValue: 'SenatePositionConsideration', fidelity: 'UNMAPPABLE', summaryStage: null, note: "The Sejm's consideration of the Senate position is a second, distinct bicameral stage." },
  { sourceValue: 'ToPresident', fidelity: 'UNMAPPABLE', summaryStage: null, note: 'Transmission is a real dated stage between PASSED and SIGNED, and is neither.' },
  { sourceValue: 'PresidentToTribunal', fidelity: 'UNMAPPABLE', summaryStage: null, note: 'Constitutional referral is a third presidential option, neither veto nor signature.' },
  { sourceValue: 'ConstitutionalTribunalRuling', fidelity: 'UNMAPPABLE', summaryStage: null, note: 'Carries verdict. Forcing it into WITHDRAWN would assert an act nobody performed.' },
  { sourceValue: 'PublicHearing', fidelity: 'UNMAPPABLE', summaryStage: null, note: 'Consultative stage.' },
  { sourceValue: 'Opinion', fidelity: 'UNMAPPABLE', summaryStage: null, note: 'Consultative stage.' },
  { sourceValue: 'GovermentPosition', fidelity: 'UNMAPPABLE', summaryStage: null, note: "Consultative stage. Spelling is the API's own." },
];

/* ── THE EP CROSSWALK — the eight measured signals ──────────────────────── */
export const EP_ACTIVITY_CROSSWALK: readonly LegislativeCrosswalkEntry[] = [
  { sourceValue: 'COMMITTEE_TABLING_AMENDMENT', fidelity: 'EXACT', summaryStage: 'AMENDED', note: 'An amendment as the summary means it.' },
  { sourceValue: 'PLENARY_AMEND', fidelity: 'EXACT', summaryStage: 'AMENDED', note: 'As above.' },
  { sourceValue: 'SIGNATURE', fidelity: 'EXACT', summaryStage: 'SIGNED', note: '' },
  { sourceValue: 'PLENARY_VOTE', fidelity: 'CONDITIONAL', summaryStage: 'PASSED', conditionOn: 'decision_outcome = ADOPTED', note: 'The activity alone does not say the outcome.' },
  { sourceValue: 'PLENARY_REJECT_COUNCIL_POSITION', fidelity: 'CONDITIONAL', summaryStage: 'REJECTED', conditionOn: 'the rejected object is the proposal, not a Council amendment', note: 'R2 gives rejection a target. The condition matters: rejecting a Council position is not always defeat of the file.' },
  { sourceValue: 'procedure-phase/RDG1', fidelity: 'UNMAPPABLE', summaryStage: null, note: 'A first reading is a PHASE, not one of the summary stages. EP carries stage on two orthogonal axes and neither alone is the summary axis.' },
  { sourceValue: 'COMMITTEE_VOTE', fidelity: 'UNMAPPABLE', summaryStage: null, note: 'A committee vote is not the bill passing.' },
  { sourceValue: 'INTERINSTITUTIONAL_NEGOTIATION', fidelity: 'UNMAPPABLE', summaryStage: null, note: 'Trilogue has no summary equivalent.' },
];

/**
 * SCHEDULED IS NOT HAPPENED — recorded as a rule rather than a row, because it applies to every EP
 * activity type at once. `type = ForeseenActivity` describes an intention; `executed` links it to
 * the activity that actually occurred. A producer that reads foreseen activities as lifecycle
 * events would populate a Timeline with things that have not happened.
 */
export const EP_FORESEEN_ACTIVITY_IS_NOT_AN_EVENT = true;

/**
 * FOUR ELI/CDM DATE AXES, ONE SUMMARY STAGE — and the loss is stated rather than hidden.
 * `entryIntoForce`, `validFrom`, `repealDate` and `expirationDate` are four independent dates;
 * only the first is `IMPLEMENTED`. Repeal and expiry are the END of a law in force, which is a
 * different axis from the end of a PROPOSAL — so neither is `WITHDRAWN`, and R2 does not invent a
 * stage for them. `inForce = UNKNOWN` likewise has no summary representation and must not become a
 * default.
 */
export const LAW_IN_FORCE_AXIS_IS_NOT_THE_PROPOSAL_AXIS = true;

/* ═══════════════════════════════════════════════════════════════════════════
 * §12 · R2 — ELECTION STAGE COVERAGE: A SOURCE LIMITATION, NOT A CONTRACT SHAPE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * RULING: **B — provider/source coverage limitation.** The Election vocabulary is NOT changed.
 *
 * G measured that 1 of 9 candidate stages has a clean structured producer, 1 is partial and 7 are
 * absent, and named the reason exactly: *"The candidate's election lifecycle is a campaign-period
 * model and KBW is a results archive. They meet at exactly one point."*
 *
 * That is a statement about the SOURCE, not about the vocabulary. `REGISTRATION_OPEN` is a real,
 * valid state of a real election; PKW simply publishes after the fact and has no forward calendar.
 * Deleting the stage would make the contract agree with one archive's publication policy and
 * disagree with the world — and the moment an electoral commission publishes a calendar, the
 * capability arrives with no contract change. The activation's own rule applies: do not change the
 * Election vocabulary merely because a current source is a results archive.
 *
 * The contrast with §11 is the whole point. The legislative gap WAS a contract-shape problem — a
 * rejected bill is a valid state the vocabulary could not express at all. This one is not: every
 * election stage is expressible, and seven of them currently have nobody to say them.
 */
export const ELECTION_STAGE_STRUCTURED_PRODUCER: Readonly<Record<ElectionStage, string>> = {
  ANNOUNCED: 'ABSENT — PKW/KBW publishes after the fact; no forward calendar in any P0 source.',
  REGISTRATION_OPEN: 'ABSENT — as above.',
  REGISTRATION_CLOSED: 'ABSENT — as above.',
  CAMPAIGN: 'ABSENT — as above.',
  POLLING: 'PARTIAL — the two turnout files (frekwencja at fixed hours) are the only in-progress signal found in any source.',
  COUNTING: 'ABSENT.',
  RESULT_DECLARED: 'PRESENT — the results files. The single clean producer.',
  RESULT_CHALLENGED: 'ABSENT — belongs to the Supreme Court, which publishes PDFs.',
  CONCLUDED: 'ABSENT.',
};

/** Exactly one stage has a clean structured producer today. Measured, not estimated. */
export const ELECTION_STAGES_WITH_STRUCTURED_PRODUCER: readonly ElectionStage[] = ['RESULT_DECLARED'];

/* ═══════════════════════════════════════════════════════════════════════════
 * §13 · R2 — POLL FIELD ABSENCE: PERMITTED, NAMED, AND NEVER RECONSTRUCTED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G measured that a real structured source omits fields R1 required. Eurobarometer's DataCite
 * record has `sizes` as an EMPTY ARRAY — no sample size at all — and carries no question wording or
 * headline margin in its structured metadata.
 *
 * R1 therefore could not represent a legitimately-published poll. The fix is to permit absence
 * WITH ITS REASON, in the same shape the platform already uses for figure gaps: absence is a
 * stated state, never a null pretending to be a value and never a computed substitute.
 *
 * WHAT IS NOT WEAKENED. `pollsterRef`, `fieldStart`, `fieldEnd`, `publishedAt`, `geographyRef` and
 * `population` stay required — all four measured sources carry them, and a "poll" missing its
 * pollster or its fieldwork period is not an admissible artifact at all.
 *
 * AND THE PROHIBITION HOLDS EXACTLY AS BEFORE. G's sharper observation is worth recording: the two
 * fields most often used to reconstruct a margin — sample size and the margin itself — are BOTH
 * absent in the same source, so there is nothing to reconstruct from even if it were permitted.
 * It is not permitted: no function in this module derives a margin, and none may be added.
 */
export const POLL_FIELD_ABSENCE_REASONS = [
  'NOT_PUBLISHED',
  'NOT_IN_STRUCTURED_METADATA',
] as const;
export type PollFieldAbsenceReason = (typeof POLL_FIELD_ABSENCE_REASONS)[number];

/**
 * Absence, declared per field. A field named here is absent for the stated reason; a field absent
 * from BOTH the artifact and this record is an incomplete artifact, not a permitted absence.
 */
export interface PollFieldAbsences {
  readonly sampleSize?: PollFieldAbsenceReason;
  readonly questionWording?: PollFieldAbsenceReason;
  readonly marginOfError?: PollFieldAbsenceReason;
  readonly sponsorRef?: PollFieldAbsenceReason;
}

/**
 * A poll artifact whose optional fields are all accounted for: present, or absent with a reason.
 * `marginOfError` gets the strictest treatment — it may be absent, but never present-and-derived,
 * and this predicate cannot be satisfied by computing one because nothing here can compute one.
 */
export function pollAbsencesAreAccountable(
  poll: {
    readonly sampleSize?: number;
    readonly questionWording?: string;
    readonly marginOfError?: number;
    readonly sponsorRef?: string;
  },
  absences: PollFieldAbsences,
): boolean {
  const accounted = (value: unknown, reason: PollFieldAbsenceReason | undefined): boolean =>
    value !== undefined ? reason === undefined : reason !== undefined;
  return (
    accounted(poll.sampleSize, absences.sampleSize) &&
    accounted(poll.questionWording, absences.questionWording) &&
    accounted(poll.marginOfError, absences.marginOfError) &&
    accounted(poll.sponsorRef, absences.sponsorRef)
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §14 · R2 — COURT OUTCOME IS OPTIONAL EVIDENCE, NOT A REQUIRED CARRIER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G's finding, stated as a clean dilemma: **"The source with the licence has no outcome; the source
 * with the outcome has no licence."** EU CELLAR models no judgment outcome at all — every candidate
 * predicate ASK-false, meaning zero triples anywhere in CELLAR — while Kenya Law models `outcomes`
 * as a controlled vocabulary but has no formal licence, only a policy statement. A second-order
 * catch: Kenya Law's `outcomes` is absent from the public API serializer, so an API-only read would
 * wrongly conclude the field does not exist.
 *
 * RULING: **the Politics contract does NOT require structured outcome data, and did not before.**
 * `COURT_RULING` enters through `PoliticalArtifactClassification`, whose required fields are the
 * artifact reference, the class, how the class was assigned and the claim it is authoritative for.
 * Outcome is not among them. This constant states that explicitly so nobody re-derives the question.
 *
 * AND NO OUTCOME IS INFERRED FROM TEXT. Reading a judgment's prose to decide who won would be an
 * analysis producer, which this contract task is forbidden to create.
 */
export const COURT_OUTCOME_IS_REQUIRED_BY_CONTRACT = false;

export const COURT_OUTCOME_PRODUCER_FACTS: Readonly<Record<string, string>> = {
  EU_CELLAR: 'NO OUTCOME MODELLED — every candidate predicate ASK-false. Licence CC BY 4.0.',
  KENYA_LAW: 'OUTCOME MODELLED as a controlled vocabulary, but absent from the public API serializer, and no formal licence exists — a policy statement only.',
};

/**
 * THE ATTACHMENT GAP, WHICH IS THE MORE SERIOUS ONE.
 *
 * `COURT_RULING` is the only lifecycle event attaching to three different subject types — Election,
 * Legislative Subject and Actor — and **no source in the study supplies the attachment**. The
 * artifact is retrievable; which Politics subject it concerns is a field nowhere. Establishing it
 * from text is exactly the inference this contract does not authorise.
 */
export const COURT_RULING_SUBJECT_ATTACHMENT_PRODUCER = 'NONE — no source carries it; deriving it from text is not authorised.';

/* ═══════════════════════════════════════════════════════════════════════════
 * §15 · R2 — PROTEST: PROVIDER UNSUITABILITY, NOT A CONTRACT DEFECT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * RULING: **provider unsuitability.** Protest Campaign identity is NOT changed to fit UCDP.
 *
 * G measured that UCDP's Violent Political Protest dataset is not what its name suggests: it is
 * **not an API resource** (download only) and its **unit of analysis is the dyad-year, not the
 * event** — 1989–2019, a 25-deaths-per-calendar-year threshold, with codebook labels Dyad, Side A,
 * Side B, Location, Incompatibility, Year, Intensity, Outcome, Version. An annual dyad summary
 * cannot be a `PROTEST_CALLED` or `PROTEST_HELD` event under any reshaping.
 *
 * Reshaping Protest Campaign to fit it would convert a named, sustained mobilisation with organisers
 * and demands into a violence-intensity row, which is Conflict's domain and not Politics'.
 *
 * DID THE CONTRACT WRONGLY ASSUME EVENT AVAILABILITY? No. R1 declares protest lifecycle events as
 * vocabulary and already carries the producer gaps separately; nothing in it asserts a producer.
 * The correct record is a producer fact, and here it is.
 */
export const PROTEST_EVENT_PRODUCER_FACTS: Readonly<Record<string, string>> = {
  UCDP_VPP: 'UNSUITABLE — dyad-year unit of analysis, download-only, 1989–2019, 25-deaths threshold. Not an event source.',
  UCDP_GED: 'ORGANIZED-VIOLENCE EVENTS ONLY — Conflict-domain data, not political mobilisation.',
  P0_SET: 'NO PROTEST EVENT PRODUCER. No source in the P0 study supplies a protest called, held or escalated.',
};
