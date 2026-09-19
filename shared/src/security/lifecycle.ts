/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PART IX SECURITY INTELLIGENCE — THE LIFECYCLE EVENT CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * MAIN-SECURITY-RUNTIME-CONTRACT-1.
 *
 * The accepted platform contract in `./index` says what a Security finding must
 * survive before anyone may see it. It says nothing about WHAT HAPPENED — there
 * is no event vocabulary in it, so a producer has nothing to emit into. G
 * measured that directly on C43: five of Part IX's ten event names appear
 * nowhere in canonical, the other five only inside prose comments. A producer
 * cannot emit an event that does not exist.
 *
 * This module is that vocabulary and nothing more.
 *
 * WHAT THIS MODULE IS NOT
 *
 *   It is not a producer. It defines no fetch, no adapter, no schedule and no
 *   provider. It cannot cause a Security finding to appear.
 *
 *   It is not an alert system. Part IX §21 is explicit: "Security defines no
 *   alert infrastructure, no notification channel and no delivery rule of its
 *   own." Nothing here delivers anything to anyone.
 *
 *   It is not a second Watch framework. The Watch seam below is a routing
 *   namespace on the EXISTING shared Watch contract in `../watch`.
 *
 * THE ONE SENTENCE THIS FILE EXISTS TO ENFORCE
 *
 *   AN EVENT HAPPENING IS NOT A REASON TO TELL ANYONE.
 *
 * Part IX §29 fixes the only permitted path, and every rule below is a
 * restatement of it:
 *
 *     lifecycle event (Security)
 *       -> reassessment (shared service)
 *         -> Assessment Revision with change state + confidence (shared service)
 *           -> display (Security frontend, computes nothing)
 *
 * Four things happen in that chain and only one of them is Security's. The
 * event is Security's. The reassessment, the change state and the delivery
 * decision are not, and this contract refuses to let an event reach across the
 * arrows and claim any of them.
 */

import type { SecurityCoverageAxis, AxisCoverageState, SourceQueryOutcome } from './index';
import {
  axisPermitsAssertion,
  outcomeIsComplete,
  ENTSOE_BUSINESS_TYPE,
  PRODUCER_ACTIVATION_BLOCKERS,
} from './index';
import type { WatchSurface, WatchSubjectType } from '../watch';

/*
 * ─── 1 · THE TEN EVENTS, EXACTLY AS PART IX TABULATES THEM ──────────────────
 *
 * Part IX, register `lifecycle-and-assessment-axes.md` §1, event table. Ten
 * rows. The register also states the governance rule for this list:
 *
 *   "New event types escalate. Adding an eleventh event type is a registry
 *    request, not a design decision."
 *
 * So the arity is itself part of the contract. `SECURITY_LIFECYCLE_EVENTS`
 * below is asserted to hold exactly ten members by a test, because a silently
 * grown vocabulary is how a domain acquires powers nobody granted it.
 */
export type SecurityLifecycleEvent =
  /** an occurrence entered the record; cause and actor unstated */
  | 'INCIDENT_REPORTED'
  /** cause established by a named authority; says nothing about actor */
  | 'SABOTAGE_CONFIRMED'
  /** a cyber incident affecting a named system is established */
  | 'CYBER_INCIDENT_CONFIRMED'
  /** a claim added, withdrawn or moved standing */
  | 'ATTRIBUTION_UPDATED'
  /** an authority issued, raised, lowered or expired a posture */
  | 'ALERT_LEVEL_CHANGED'
  /** a border or crossing regime changed, with scope and duration */
  | 'BORDER_POSTURE_CHANGED'
  /** service or capability on a shared asset degraded or stopped */
  | 'INFRASTRUCTURE_DISRUPTED'
  /** service or capability returned, fully or partly */
  | 'INFRASTRUCTURE_RESTORED'
  /** an airspace event within a stated geographic ceiling */
  | 'AIRSPACE_INCIDENT'
  /** a maritime security event in a declared area */
  | 'MARITIME_SECURITY_EVENT';

export const SECURITY_LIFECYCLE_EVENTS: readonly SecurityLifecycleEvent[] = [
  'INCIDENT_REPORTED',
  'SABOTAGE_CONFIRMED',
  'CYBER_INCIDENT_CONFIRMED',
  'ATTRIBUTION_UPDATED',
  'ALERT_LEVEL_CHANGED',
  'BORDER_POSTURE_CHANGED',
  'INFRASTRUCTURE_DISRUPTED',
  'INFRASTRUCTURE_RESTORED',
  'AIRSPACE_INCIDENT',
  'MARITIME_SECURITY_EVENT',
];

/** Part IX's own "Records" column, preserved verbatim so the contract carries its source. */
export const SECURITY_LIFECYCLE_EVENT_RECORDS: Readonly<
  Record<SecurityLifecycleEvent, string>
> = {
  INCIDENT_REPORTED: 'an occurrence entered the record; cause and actor unstated',
  SABOTAGE_CONFIRMED: 'cause established by a named authority; says nothing about actor',
  CYBER_INCIDENT_CONFIRMED: 'a cyber incident affecting a named system is established',
  ATTRIBUTION_UPDATED: 'a claim added, withdrawn or moved standing',
  ALERT_LEVEL_CHANGED: 'an authority issued, raised, lowered or expired a posture',
  BORDER_POSTURE_CHANGED: 'a border or crossing regime changed, with scope and duration',
  INFRASTRUCTURE_DISRUPTED: 'service or capability on a shared asset degraded or stopped',
  INFRASTRUCTURE_RESTORED: 'service or capability returned, fully or partly',
  AIRSPACE_INCIDENT: 'an airspace event within a stated geographic ceiling',
  MARITIME_SECURITY_EVENT: 'a maritime security event in a declared area',
};

export const SECURITY_LIFECYCLE_EVENT_COUNT = 10 as const;

/**
 * ADDING AN ELEVENTH IS A REGISTRY REQUEST, NOT A CODE CHANGE.
 *
 * Stated as a constant so the rule travels with the vocabulary rather than
 * living only in a design document nobody imports.
 */
export const NEW_EVENT_TYPES_ESCALATE = true as const;

/*
 * ─── 2 · WHICH AXIS AN EVENT MAY SPEAK ON ───────────────────────────────────
 *
 * The accepted contract's five axes are OCCURRENCE · CAUSE · ACTOR · POSTURE ·
 * SEVERITY. Part IX's "Records" column decides, for each event, which of them
 * the event is ABOUT. This table is a reading of that column and of nothing
 * else — no axis was assigned because it seemed useful.
 *
 * THE TABLE IS A CEILING, NOT AN ASSIGNMENT. An event instance declares the
 * axes it actually asserts, and that declaration must be a subset of the row
 * below. `ATTRIBUTION_UPDATED` is why the distinction is necessary: Part IX's
 * attribution timeline shows cause and actor moving on DIFFERENT DAYS —
 *
 *     day 2  government attributes cause    cause: official assessment · actor: unattributed
 *     day 7  assessment revised             cause: sabotage, moderate confidence
 *                                           actor: unattributed, 2 suspected claims disputed
 *
 * — so an attribution update that speaks about cause has not thereby said
 * anything about actor. Fixing one axis per event would flatten exactly the
 * separation §12 exists to protect.
 *
 * SEVERITY APPEARS IN NO ROW. That is deliberate and load-bearing. Part IX §2
 * gives severity to "the shared severity contract", and the accepted platform
 * contract states that severity is never imported pre-graded. An event says
 * what happened; how serious it is, is somebody else's judgement.
 */
export const EVENT_AUTHORISED_AXES: Readonly<
  Record<SecurityLifecycleEvent, readonly SecurityCoverageAxis[]>
> = {
  INCIDENT_REPORTED: ['OCCURRENCE'],
  SABOTAGE_CONFIRMED: ['CAUSE'],
  CYBER_INCIDENT_CONFIRMED: ['OCCURRENCE'],
  ATTRIBUTION_UPDATED: ['CAUSE', 'ACTOR'],
  ALERT_LEVEL_CHANGED: ['POSTURE'],
  BORDER_POSTURE_CHANGED: ['POSTURE'],
  INFRASTRUCTURE_DISRUPTED: ['OCCURRENCE'],
  INFRASTRUCTURE_RESTORED: ['OCCURRENCE'],
  AIRSPACE_INCIDENT: ['OCCURRENCE'],
  MARITIME_SECURITY_EVENT: ['OCCURRENCE'],
};

/**
 * NO EVENT MAY ASSERT SEVERITY — stated positively so a mutation has something
 * to bite, rather than left implicit in the absence of a table entry.
 */
export const AXES_NO_EVENT_MAY_ASSERT: readonly SecurityCoverageAxis[] = ['SEVERITY'];

export function eventMayAssertAxis(
  event: SecurityLifecycleEvent,
  axis: SecurityCoverageAxis,
): boolean {
  if (AXES_NO_EVENT_MAY_ASSERT.indexOf(axis) !== -1) return false;
  return EVENT_AUTHORISED_AXES[event].indexOf(axis) !== -1;
}

/*
 * ─── 3 · SOURCE-NATIVE VERSUS DERIVED ───────────────────────────────────────
 *
 * SOURCE_NATIVE   the source itself states the thing. An ENTSO-E outage record
 *                 says an outage occurred; a national authority says the alert
 *                 level is now X. Reading it is transcription.
 *
 * DERIVED         the value is a conclusion drawn ACROSS records, or a judgement
 *                 about what the record means.
 *
 * A PRODUCER MAY ONLY EMIT SOURCE-NATIVE MATERIAL. That is the whole of the
 * producer boundary in §6, and this enum is what lets a test say so.
 *
 * `SABOTAGE_CONFIRMED` is the one that looks derived and is not: Part IX says
 * "cause established by A NAMED AUTHORITY". The authority draws the conclusion
 * and we transcribe THAT. If nobody named has concluded it, the event does not
 * exist — a producer inferring sabotage from a pattern of outages is precisely
 * the thing this refuses.
 */
export type EventDerivationClass = 'SOURCE_NATIVE' | 'DERIVED';

export const EVENT_DERIVATION_CLASS: Readonly<
  Record<SecurityLifecycleEvent, EventDerivationClass>
> = {
  INCIDENT_REPORTED: 'SOURCE_NATIVE',
  SABOTAGE_CONFIRMED: 'SOURCE_NATIVE',
  CYBER_INCIDENT_CONFIRMED: 'SOURCE_NATIVE',
  ATTRIBUTION_UPDATED: 'SOURCE_NATIVE',
  ALERT_LEVEL_CHANGED: 'SOURCE_NATIVE',
  BORDER_POSTURE_CHANGED: 'SOURCE_NATIVE',
  INFRASTRUCTURE_DISRUPTED: 'SOURCE_NATIVE',
  INFRASTRUCTURE_RESTORED: 'SOURCE_NATIVE',
  AIRSPACE_INCIDENT: 'SOURCE_NATIVE',
  MARITIME_SECURITY_EVENT: 'SOURCE_NATIVE',
};

/**
 * ALL TEN ARE SOURCE-NATIVE, AND THAT IS THE POINT.
 *
 * There is no derived event in Part IX's table. A derived event type would be a
 * place for a model conclusion to enter the record wearing the same shape as a
 * transcribed fact, and the whole admission chain downstream would then be
 * guarding a door that had already been walked through.
 */
export const NO_LIFECYCLE_EVENT_IS_DERIVED = true as const;

/*
 * ─── 4 · SUBJECT RELATION — AN EVENT IS NEVER ITS OWN SUBJECT ───────────────
 *
 * Part IX object model, class B: a Security Incident is a LIFECYCLE EVENT. It
 * "has: own record, own drawer, evidence, geography, attribution claims" and it
 * "does NOT have: own attentionRank, own Watch, own timeline".
 *
 * So an event ATTACHES to a persistent subject; it never becomes one. Class A
 * (Security Situation) is the persistent subject and holds the Watch scope.
 *
 * `subjectId` is OPTIONAL and that is deliberate. Part IX: "An incident with no
 * plausible parent stays an unattached record linked POSSIBLY_RELATED." An
 * unattached incident is a real, valid state — forcing a parent would make
 * every producer invent one, and inventing parents is how a feed gets tidied
 * into a story nobody's evidence supports.
 *
 * PROMOTION IS NOT MODELLED HERE, ON PURPOSE. Whether an incident promotes into
 * a continuing Situation is "determined by the shared assessment and
 * entity-resolution architecture. NO RULE AND NO THRESHOLD IS ENCODED IN THE
 * FRONTEND OR AS A PRODUCT CONTRACT."
 */
export const PROMOTION_THRESHOLD_IS_NEVER_ENCODED_HERE = true as const;

export interface SecurityLifecycleEventRecord {
  /** Stable identity of this event record. */
  readonly eventId: string;
  readonly event: SecurityLifecycleEvent;
  /**
   * The persistent subject this event attaches to, when one is known.
   * `null` is the honest unattached state, not a missing value to be filled in.
   */
  readonly subjectId: string | null;
  /**
   * The canonical occurrence this event is about. ONE occurrence, shared across
   * domains — never a Security-private duplicate of a Conflict occurrence
   * (accepted M-2, and Part IX §17: raw event identity is never duplicated).
   */
  readonly occurrenceId: string;
  /** Which axes this record actually speaks on. Must be within the event's ceiling. */
  readonly assertedAxes: readonly SecurityCoverageAxis[];
  /** Who said so. Empty is refused: an event with no claimant has no provenance. */
  readonly claimantId: string;
  readonly observedAt: string;
  /** Source-native only. A producer that cannot say this is true must not emit. */
  readonly derivation: EventDerivationClass;
  /**
   * CYBER_INCIDENT_CONFIRMED ONLY — the named affected system. See §5.
   * `null` everywhere else, and `null` on a cyber event means the event is refused.
   */
  readonly namedAffectedSystem: NamedAffectedSystem | null;
  /**
   * INFRASTRUCTURE_RESTORED ONLY — how the restoration is grounded. See §12b.
   *
   * R3. THE FIELD THAT MAKES THE RULE REACHABLE. R2 wrote a correct restoration
   * guard and left the record unable to carry its input, so
   * `assertLifecycleEventIsWellFormed` had nothing to check and admitted a
   * restoration with no grounding at all. In the SAME FILE, the cyber correction
   * was wired into admission and refused. One correction reached the seam and one
   * did not, and the difference was this field's absence.
   *
   * `null` everywhere else, and `null` on a restoration means the event is refused.
   * Deliberately the same shape as `namedAffectedSystem`, because it is the same
   * problem: a rule whose input the record cannot express is documentation.
   */
  readonly restoration: RestorationClaim | null;
}

/*
 * ─── 5 · CYBER_INCIDENT_CONFIRMED — THE NAMED SYSTEM REQUIREMENT ────────────
 *
 * Part IX, event table, verbatim:
 *
 *     CYBER_INCIDENT_CONFIRMED | a cyber incident affecting a NAMED SYSTEM is
 *                                established
 *
 * G reported this question as unanswerable and proposed PO-CYBER-DEF, because
 * canonical held no definition to interpret. That was correct about CANONICAL
 * and it is not correct about PART IX: the accepted design text states the
 * requirement in the Records column. The Product Owner has ruled that it is
 * encoded literally. It is encoded literally.
 *
 * WHAT DOES NOT SATISFY IT, RULED EXPLICITLY:
 *   - an organization name alone
 *   - a business-unit name alone
 *   - generic language such as "information technology systems" with no
 *     identified affected system
 *
 * THE CONSEQUENCE IS UNFAVOURABLE AND IS NOT BEING SOFTENED. SEC 8-K Item 1.05
 * requires a registrant to describe a material cybersecurity incident, and a
 * filing may lawfully describe scope without naming an affected system. Such a
 * filing does not satisfy this event. SEC 8-K therefore stays a source/schema
 * candidate. The contract was not widened to admit the source; a source that
 * meets the contract will be admitted when one does.
 */
export const CYBER_INCIDENT_REQUIRES_NAMED_AFFECTED_SYSTEM = true as const;

/*
 * R2 · SUFFICIENCY, NOT MERELY PRESENCE.
 *
 * R1 enforced that `namedAffectedSystem` was a non-empty string. That is
 * PRESENCE. The ruling names three forms that are present and still insufficient,
 * and a non-empty-string check admits every one of them — including the ruling's
 * own verbatim counter-example, "information technology systems". R1's
 * `CYBER_NAMED_SYSTEM_INSUFFICIENT_FORMS` was read by no function: it was a list
 * of refusals that refused nothing.
 *
 * `string | null` IS THE WRONG SHAPE for a rule with named refused forms. The
 * accepted contract already solves this exact problem in B-1, where
 * `IDENTITY_BASES_PERMITTED` / `IDENTITY_BASES_REFUSED` make a refused basis a
 * NAMED MEMBER of the union rather than a string somebody must recognise. A
 * refused form that cannot be named cannot be refused. That precedent is followed
 * here rather than invented again.
 *
 * TWO INDEPENDENT GATES, because either alone is escapable:
 *
 *   1. THE DECLARED BASIS. A producer says how it knows. Three bases are refused
 *      by name. This catches an honest producer that has only an organization
 *      name and says so.
 *
 *   2. A STRUCTURAL CHECK ON THE VALUE, applied regardless of declared basis.
 *      This catches a producer that declares IDENTIFIED_SYSTEM and passes "-",
 *      "n/a", or "information technology systems" anyway. Basis alone would be
 *      self-certification; the structural check is what makes the rule bind on a
 *      producer that is wrong rather than merely candid.
 */

/** HOW THE AFFECTED SYSTEM IS KNOWN. Refused bases are MEMBERS so they can be refused. */
export type NamedSystemBasis =
  /** An actual system, service or asset is identified. The only sufficient basis. */
  | 'IDENTIFIED_SYSTEM'
  /** REFUSED. Only the organization is named. Who was hit, not what. */
  | 'ORGANIZATION_NAME_ONLY'
  /** REFUSED. Only a business unit is named. Narrower, still not a system. */
  | 'BUSINESS_UNIT_NAME_ONLY'
  /** REFUSED. Generic systems language identifying nothing. */
  | 'GENERIC_SYSTEMS_LANGUAGE'
  /** REFUSED. A placeholder or punctuation standing in for a value. */
  | 'PLACEHOLDER';

export const NAMED_SYSTEM_BASES_SUFFICIENT: readonly NamedSystemBasis[] = ['IDENTIFIED_SYSTEM'];

export const NAMED_SYSTEM_BASES_REFUSED: readonly NamedSystemBasis[] = [
  'ORGANIZATION_NAME_ONLY',
  'BUSINESS_UNIT_NAME_ONLY',
  'GENERIC_SYSTEMS_LANGUAGE',
  'PLACEHOLDER',
];

/**
 * DERIVED FROM THE REFUSED BASES — no second list.
 * R1 kept this as a hand-written array that nothing read. It is now a view of the
 * union the gate actually consults, so it cannot drift from the rule again.
 */
export const CYBER_NAMED_SYSTEM_INSUFFICIENT_FORMS: readonly NamedSystemBasis[] =
  NAMED_SYSTEM_BASES_REFUSED;

export const CYBER_GENERIC_LANGUAGE_EXAMPLE = 'information technology systems';

/**
 * Phrases that identify no system. Matched case-insensitively on the whole trimmed
 * value — a SUBSTRING match would refuse "SCADA controller for information
 * technology systems", which does identify one.
 */
export const CYBER_GENERIC_SYSTEM_PHRASES: readonly string[] = [
  'information technology systems',
  'information technology',
  'it systems',
  'computer systems',
  'systems',
  'network',
  'networks',
  'infrastructure',
  'corporate systems',
  'certain systems',
  'unspecified',
  'unknown',
  'n/a',
  'na',
  'none',
  'tbd',
];

export interface NamedAffectedSystem {
  readonly basis: NamedSystemBasis;
  readonly value: string;
}

/** Strip whitespace and punctuation-only content: "-", "--", " . " carry no identity. */
function identityBearingLength(value: string): number {
  return value.replace(/[\s\-–—_.,;:/\\()[\]{}'"|*+#~]/g, '').length;
}

/**
 * R3 · E1's C-2. Trailing punctuation defeated whole-value matching: R2 admitted
 * "information technology systems." — the ruling's own counter-example with a full
 * stop — because the compared string no longer equalled the phrase. The same
 * punctuation set `identityBearingLength` already strips is stripped from the ENDS
 * before comparison.
 *
 * STRIPPED AT THE ENDS ONLY, NOT THROUGHOUT. Removing interior punctuation would
 * fold "SCADA-2, unit 4" into something unrecognisable and could collide two
 * different real systems onto one string. The defect was decoration around the
 * phrase, so the fix removes decoration around the phrase.
 */
const EDGE_PUNCTUATION = /^[\s\-–—_.,;:/\\()[\]{}'"|*+#~!?]+|[\s\-–—_.,;:/\\()[\]{}'"|*+#~!?]+$/g;

export function namedSystemValueIsStructurallySufficient(value: string): boolean {
  if (identityBearingLength(value) === 0) return false;
  const normalized = value
    .replace(EDGE_PUNCTUATION, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return CYBER_GENERIC_SYSTEM_PHRASES.indexOf(normalized) === -1;
}

export function namedSystemIsSufficient(named: NamedAffectedSystem | null): boolean {
  if (named === null) return false;
  if (NAMED_SYSTEM_BASES_SUFFICIENT.indexOf(named.basis) === -1) return false;
  return namedSystemValueIsStructurallySufficient(named.value);
}

export function cyberEventHasNamedSystem(record: SecurityLifecycleEventRecord): boolean {
  if (record.event !== 'CYBER_INCIDENT_CONFIRMED') return true;
  return namedSystemIsSufficient(record.namedAffectedSystem);
}

/*
 * ─── 6 · THE PRODUCER OUTPUT BOUNDARY ───────────────────────────────────────
 *
 * A producer emits what its source said. It does not emit what the platform
 * concluded. The two lists below are the boundary, and they are stated as data
 * so a test can walk them instead of trusting a comment.
 *
 * The forbidden list is not a style preference. Each entry is a specific way a
 * producer could reach past its evidence:
 *
 *   NO_MATERIAL_CHANGE     is a CONCLUSION FROM COVERAGE — "we looked, and
 *                          nothing moved". A producer sees its own source. It
 *                          cannot know what every other source did, so it
 *                          cannot know that nothing moved. This is A-24 exactly:
 *                          no data may never become safety.
 *   FINAL_ASSESSMENT       belongs to the shared assessment service (§28).
 *   NOTIFICATION_AUTHORITY belongs to shared Watch sensitivity (§21).
 *   INFERRED_ACTOR         Part IX J: there is deliberately NO `attributedActor`
 *                          field anywhere in the model to flatten disagreement into.
 *   INFERRED_CAUSE         cause is established by a named authority or not at all.
 *   INFERRED_SEVERITY      severity is the shared ladder's, never imported pre-graded.
 */
export const PRODUCER_MAY_EMIT: readonly string[] = [
  'SOURCE_QUERY_OUTCOME',
  'COVERAGE_DECLARATION',
  'SOURCE_NATIVE_EVIDENCE',
  'CANONICAL_EVENT_CANDIDATE_FIELDS',
];

export const PRODUCER_MUST_NOT_EMIT: readonly string[] = [
  'NO_MATERIAL_CHANGE',
  'FINAL_ASSESSMENT',
  'NOTIFICATION_AUTHORITY',
  'INFERRED_ACTOR',
  'INFERRED_CAUSE',
  'INFERRED_SEVERITY',
];

export interface ProducerEmission {
  readonly producerId: string;
  readonly emitted: readonly string[];
}

export function producerEmissionIsPermitted(emission: ProducerEmission): {
  readonly permitted: boolean;
  readonly reasons: readonly string[];
} {
  const reasons: string[] = [];
  let permitted = true;
  for (const item of emission.emitted) {
    if (PRODUCER_MUST_NOT_EMIT.indexOf(item) !== -1) {
      permitted = false;
      reasons.push(
        `SEC-PROD-1: producer ${emission.producerId} emitted ${item}, which is a platform ` +
          'conclusion and not source-native material. A producer reports what its source said.',
      );
      continue;
    }
    if (PRODUCER_MAY_EMIT.indexOf(item) === -1) {
      permitted = false;
      reasons.push(
        `SEC-PROD-2: producer ${emission.producerId} emitted ${item}, which is not on the ` +
          'permitted list. The boundary is an allowlist: anything unnamed is refused rather ' +
          'than admitted by default.',
      );
    }
  }
  return { permitted, reasons };
}

/*
 * ─── 7 · THE WATCH SEAM ─────────────────────────────────────────────────────
 *
 * SECURITY is a routing namespace on the EXISTING shared Watch contract. Part IX
 * §21: "Security defines no alert infrastructure, no notification channel and
 * no delivery rule of its own." Nothing in this module creates one.
 *
 * WHAT IS WATCHABLE — Part IX Watch register §1, and the object model:
 *   Security Situation                class A, PRIMARY PERSISTENT, holds the Watch scope
 *   Campaign with a Security facet     class G, on the SHARED campaign primitive
 *   Infrastructure Asset               class D, SHARED identity, security-condition facet
 *
 * WHAT IS NOT WATCHABLE, from the same register's right-hand column:
 *   Security Incident       a trigger
 *   Attribution claim       evidence
 *   Posture value           a trigger on its subject
 *   LIFECYCLE EVENT         a trigger
 *   Relationship edge       part of a subject's exposure
 *
 * COMPOSITE SCOPE IS DELIBERATELY ABSENT FROM THE SUBJECT TYPES. Part IX class
 * I calls it a "COMPOSITE WATCH SCOPE ... saved in shared Watch", which "bears
 * no assessment of its own; inherits from members". A saved composition over
 * subjects is not itself a subject, and modelling it as one would give it an
 * assessment it is defined not to have.
 *
 * "Watching an incident would deliver a notification about something already
 * over. Watching the condition delivers what the professional needs."
 */
export const SECURITY_WATCH_SURFACE: WatchSurface = 'SECURITY';

export const SECURITY_WATCHABLE_SUBJECT_TYPES: readonly WatchSubjectType[] = [
  'SITUATION',
  'CAMPAIGN',
  'INFRASTRUCTURE_ASSET',
];

/**
 * A LIFECYCLE EVENT IS A TRIGGER AND NEVER A WATCH TARGET.
 *
 * Stated as an executable refusal rather than a comment, because the failure it
 * prevents is quiet: a watchboard that accepted an event id would deliver an
 * alert about something already finished, and would look like it was working.
 */
export function isWatchableSecuritySubjectType(candidate: string): boolean {
  if ((SECURITY_LIFECYCLE_EVENTS as readonly string[]).indexOf(candidate) !== -1) return false;
  return (SECURITY_WATCHABLE_SUBJECT_TYPES as readonly string[]).indexOf(candidate) !== -1;
}

/**
 * UPSTREAM DEPENDENCIES, DECLARED RATHER THAN ASSUMED.
 *
 * Two of the three watchables rest on shared machinery that is REQUESTED and not
 * yet built. Naming the subject type does not conjure the primitive, and a
 * contract that quietly implied otherwise would hand the next lane a surprise.
 */
export const SECURITY_WATCHABLE_UPSTREAM_DEPENDENCIES: Readonly<Record<string, string>> = {
  SITUATION:
    'available — SITUATION already exists as a shared WatchSubjectType (MAP uses it). ' +
    'Reused, not duplicated, exactly as ACTOR is reused across MAP and CONFLICT.',
  CAMPAIGN:
    'PENDING S-01 — Part IX class G puts campaign identity on a SHARED campaign subject ' +
    'primitive that Politics also needs. The subject type is declared; the primitive is a ' +
    'shared-component request and is not built. No Security-owned campaign architecture ' +
    'is created here.',
  INFRASTRUCTURE_ASSET:
    'CONDITIONAL — Part IX class D admits asset-level Watch "where the platform supports ' +
    'asset-level Watch". Declared so the seam exists; support is not asserted.',
};

/*
 * ─── 7b · COMPOSITE SCOPE — REFUSED PENDING AN UPSTREAM CONTRACT ────────────
 *
 * Part IX lists a Composite Watch scope among Security's watchables, and R0
 * omitted it. R1 inspected the question properly instead of leaving it implicit,
 * and the answer is that the platform cannot yet carry one honestly.
 *
 * THE RULING IS PATH C — NEITHER A REUSABLE PRIMITIVE NOR A COMPLETE DEFINITION.
 *
 *   NOT PATH A. No generic Composite or saved-scope primitive exists in canonical
 *   shared Watch. `WatchScopeChain` is the GEOGRAPHIC ladder — WORLD -> REGION ->
 *   COUNTRY -> PROVINCE -> DISTRICT -> CITY, with a deepest-supported level. That
 *   is where a subject SITS, not a user-composed set of subjects. There is no
 *   membership type, no saved-scope type and no collection type anywhere in the
 *   shared contract. Reusing the scope chain for this would mean calling a
 *   ladder a basket.
 *
 *   NOT PATH B. Part IX says what a Composite IS — "user-composed scope over
 *   existing subjects, assets and zones, saved in shared Watch", which "bears no
 *   assessment of its own; inherits from members" — and that is a description,
 *   not a representation. It supplies NO IDENTITY CONTRACT: no id scheme, no
 *   member reference type, no persistence. And it explicitly defers the rest:
 *   "Member limits, cadence, pricing and entitlement counting are
 *   configuration-driven and require Part IV / Main reconciliation — assumption
 *   A-21." A composition whose membership rules are undecided cannot be encoded
 *   as a minimum, because the minimum is one of the undecided things.
 *
 *   Its own phrase, "saved scope in shared Watch", presupposes a saved-scope
 *   facility that shared Watch does not have.
 *
 * SO IT IS REFUSED, AND THE REFUSAL IS THE HONEST STATE.
 *
 * The failure this prevents is specific: declaring COMPOSITE_SCOPE a Security
 * watch subject type would make it selectable, and a selectable composite with
 * no identity contract would acquire one by accident — whatever the first
 * producer or first UI happened to pass. Absent authority does not become
 * present authority by being used.
 */
export const SEC_WATCH_COMPOSITE_1 = 'SEC-WATCH-COMPOSITE-1' as const;

export type CompositeScopeAvailability = 'AVAILABLE' | 'UNAVAILABLE_PENDING_UPSTREAM';

export const COMPOSITE_SCOPE_AVAILABILITY: CompositeScopeAvailability =
  'UNAVAILABLE_PENDING_UPSTREAM';

export const COMPOSITE_SCOPE_RULING_PATH = 'C' as const;

export const COMPOSITE_SCOPE_DEPENDENCY_REASON: string =
  'SEC-WATCH-COMPOSITE-1: Part IX describes a Composite Watch scope but supplies no identity ' +
  'contract for one — no id scheme, no member reference type, no persistence — and defers member ' +
  'limits, cadence, pricing and entitlement counting to Part IV / Main reconciliation under ' +
  'assumption A-21. Canonical shared Watch has no Composite or saved-scope primitive to reuse; ' +
  'WatchScopeChain is the geographic ladder, not a composition over subjects. Composite scope is ' +
  'therefore UNAVAILABLE pending an upstream contract, and is not invented here.';

/** The literal a caller would reach for. Named so the refusal can be specific. */
export const COMPOSITE_SCOPE_CANDIDATE_LITERAL = 'COMPOSITE_SCOPE' as const;

/**
 * COMPOSITE SCOPE MAY NOT BECOME A WATCH TARGET WHILE IT IS UNAVAILABLE.
 *
 * Written as a guard rather than an omission. An omission is silent: the next
 * lane adds the literal to a list, nothing objects, and the platform acquires a
 * subject type whose identity nobody ever specified.
 */
export function compositeScopeIsWatchable(): boolean {
  return COMPOSITE_SCOPE_AVAILABILITY === 'AVAILABLE';
}

export function assertCompositeScopeNotUsedAsWatchTarget(candidateSubjectType: string): void {
  if (candidateSubjectType !== COMPOSITE_SCOPE_CANDIDATE_LITERAL) return;
  if (compositeScopeIsWatchable()) return;
  throw new Error(COMPOSITE_SCOPE_DEPENDENCY_REASON);
}

/*
 * ─── 8 · TRIGGER IS NOT ALERT ───────────────────────────────────────────────
 *
 * Part IX Watch register §3:
 *
 *     trigger -> reassessment (shared service) -> shared change state
 *             -> Watch sensitivity decides delivery
 *
 * All ten events carry a Watch trigger mark in Part IX's table, and the table's
 * own caption warns against reading the change-state column as a mapping: "The
 * third column is not a mapping. It lists what the service MAY return. No event
 * determines its own change state, and the frontend never infers one."
 *
 * So: every event may TRIGGER a reassessment, and no event may CONCLUDE one.
 */
export const EVERY_EVENT_MAY_TRIGGER_REASSESSMENT = true as const;
export const NO_EVENT_DETERMINES_ITS_OWN_CHANGE_STATE = true as const;

export type TriggerOutcomeStage =
  | 'TRIGGER'
  | 'REASSESSMENT'
  | 'CHANGE_STATE'
  | 'DELIVERY_DECISION';

export const TRIGGER_TO_DELIVERY_STAGES: readonly TriggerOutcomeStage[] = [
  'TRIGGER',
  'REASSESSMENT',
  'CHANGE_STATE',
  'DELIVERY_DECISION',
];

/** Which stages Security owns. Exactly one. */
export const STAGES_OWNED_BY_SECURITY: readonly TriggerOutcomeStage[] = ['TRIGGER'];

export function eventGrantsNotificationAuthority(): false {
  return false;
}

/*
 * ─── 9 · COVERAGE DEPENDENCY ────────────────────────────────────────────────
 *
 * An event is evidence that something happened. It is not evidence that we
 * looked everywhere. Those are different claims and A-24 exists because
 * conflating them is how "no data" becomes "safe".
 *
 * A producer emitting an event must ALSO emit its coverage declaration and its
 * source query outcomes. An event arriving with no coverage record does not
 * establish an axis — it is one source speaking, and an axis is established
 * only when every expected source has answered completely.
 */
export function eventEstablishesAxis(
  record: SecurityLifecycleEventRecord,
  axis: SecurityCoverageAxis,
  axisState: AxisCoverageState,
): boolean {
  if (!eventMayAssertAxis(record.event, axis)) return false;
  if (record.assertedAxes.indexOf(axis) === -1) return false;
  return axisPermitsAssertion(axisState);
}

/**
 * A single complete source outcome is NOT coverage. Retained as a named helper
 * so the distinction has somewhere to live and something to test.
 */
export function outcomeAloneEstablishesCoverage(_outcome: SourceQueryOutcome): false {
  return false;
}

/** Re-exported behaviour check, so a caller cannot reach for a looser one. */
export function eventSourceOutcomeIsComplete(outcome: SourceQueryOutcome): boolean {
  return outcomeIsComplete(outcome);
}

/*
 * ─── 10 · EVENT ADMISSION ───────────────────────────────────────────────────
 *
 * The refusals a candidate event must survive. This is admission INTO THE EVENT
 * RECORD — it is not evidence promotion, not assessment and not notification.
 * Those three gates already exist in the accepted contract and are untouched.
 */
export function assertLifecycleEventIsWellFormed(record: SecurityLifecycleEventRecord): void {
  if ((SECURITY_LIFECYCLE_EVENTS as readonly string[]).indexOf(record.event) === -1) {
    throw new Error(
      `SEC-EVENT-1: ${record.event} is not one of the ten Part IX lifecycle events. ` +
        'Adding an eleventh is a registry request, not a producer decision.',
    );
  }

  if (record.eventId.trim().length === 0) {
    throw new Error('SEC-EVENT-2: an event without an identifier cannot be corrected or superseded.');
  }

  if (record.occurrenceId.trim().length === 0) {
    throw new Error(
      'SEC-EVENT-3: an event must name the canonical occurrence it is about. ONE occurrence is ' +
        'shared across domains; an event with no occurrence id invites a Security-private duplicate.',
    );
  }

  if (record.claimantId.trim().length === 0) {
    throw new Error(
      'SEC-EVENT-4: an event must name its claimant. Every Security sentence names who said it.',
    );
  }

  if (record.derivation !== 'SOURCE_NATIVE') {
    throw new Error(
      `SEC-EVENT-5: event ${record.event} is marked ${record.derivation}. No lifecycle event is ` +
        'derived. A conclusion drawn across records is an assessment, and assessments are not ours.',
    );
  }

  if (record.assertedAxes.length === 0) {
    throw new Error(
      `SEC-EVENT-6: event ${record.event} asserts no axis. An event that says nothing about ` +
        'occurrence, cause, actor or posture is not a finding.',
    );
  }

  for (const axis of record.assertedAxes) {
    if (AXES_NO_EVENT_MAY_ASSERT.indexOf(axis) !== -1) {
      throw new Error(
        `SEC-EVENT-7: event ${record.event} asserts ${axis}. Severity is the shared ladder's ` +
          'judgement and is never imported pre-graded from a source.',
      );
    }
    if (!eventMayAssertAxis(record.event, axis)) {
      throw new Error(
        `SEC-EVENT-8: event ${record.event} asserts ${axis}, which Part IX does not authorise it ` +
          `to speak on. It records: "${SECURITY_LIFECYCLE_EVENT_RECORDS[record.event]}".`,
      );
    }
  }

  if (!cyberEventHasNamedSystem(record)) {
    throw new Error(
      'SEC-EVENT-9: CYBER_INCIDENT_CONFIRMED requires a SUFFICIENT NAMED AFFECTED SYSTEM. ' +
        'Part IX: "a cyber incident affecting a named system is established". Refused bases: ' +
        `${NAMED_SYSTEM_BASES_REFUSED.join(', ')}. Generic language such as ` +
        `"${CYBER_GENERIC_LANGUAGE_EXAMPLE}", and placeholders such as "-", identify no system ` +
        'and are refused whatever basis is declared.',
    );
  }

  if (record.event !== 'CYBER_INCIDENT_CONFIRMED' && record.namedAffectedSystem !== null) {
    throw new Error(
      `SEC-EVENT-10: ${record.event} carries a namedAffectedSystem. That field belongs to ` +
        'CYBER_INCIDENT_CONFIRMED alone; carrying it elsewhere invites a named-system claim on ' +
        'an event whose Part IX record does not support one.',
    );
  }

  /*
    R3 · THE RESTORATION SEAM. Mirrors SEC-EVENT-9 / SEC-EVENT-10 exactly, because
    the two problems are the same problem: a rule is only a rule where admission
    calls it. R2's guard was correct and unreachable.
  */
  if (record.event === 'INFRASTRUCTURE_RESTORED') {
    if (record.restoration === null) {
      throw new Error(
        'SEC-EVENT-11: INFRASTRUCTURE_RESTORED requires a restoration grounding. A restoration ' +
          'with no stated basis is an assertion that service returned, made by nobody. Canonical ' +
          'blocker U-2b exists because an ungrounded recovery on a Timeline is worse than silence.',
      );
    }
    try {
      assertRestorationClaimIsAdmissible(record.restoration);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`SEC-EVENT-11: restoration grounding is inadmissible — ${reason}`);
    }
  }

  if (record.event !== 'INFRASTRUCTURE_RESTORED' && record.restoration !== null) {
    throw new Error(
      `SEC-EVENT-12: ${record.event} carries a restoration grounding. That field belongs to ` +
        'INFRASTRUCTURE_RESTORED alone; carrying it elsewhere invites a recovery claim on an ' +
        'event whose Part IX record does not support one.',
    );
  }
}

/*
 * ─── 11 · CAP — SCHEMA REFERENCE, NOT A SECURITY PRODUCER ───────────────────
 *
 * G measured that CAP Poland and CAP Kenya fit CAP's field shape, and that the
 * source-native category semantics are METEOROLOGICAL. Structural resemblance
 * between a CAP field named `severity` and Part IX's severity axis is a
 * coincidence of vocabulary, not a mapping.
 *
 * RULED: CAP informs the SHAPE of a posture record and produces no Security
 * posture. Mapping a met-office urgency onto a security posture would import a
 * judgement about weather into a judgement about threat, and the fact that both
 * words are "severity" is the entire reason it would go unnoticed.
 */
export const CAP_CLASSIFICATION = 'SCHEMA_REFERENCE_NOT_SECURITY_PRODUCER' as const;

export const CAP_FIELDS_NEVER_MAPPED_TO_SECURITY: readonly string[] = [
  'severity',
  'urgency',
  'certainty',
  'category',
];

export function capFieldMapsToSecurityPosture(_capField: string): false {
  return false;
}

/*
 * ─── 12 · ENTSO-E A78 — CONTRACT FIT ONLY, NOT ACTIVATION ───────────────────
 *
 * Modelled only as far as a future A78 adapter needs. No client, no credential,
 * no endpoint. U-2 and S-6 remain WITHDRAWN and are not reinstated here.
 *
 * R2 · THE BUSINESS-TYPE TABLE IS NO LONGER RESTATED.
 *
 * R1 declared its own `ENTSOE_BUSINESS_TYPE_A78` and transcribed A54 as
 * "Unplanned outage" — dropping "/ forced unavailability" from canonical's
 * wording. Both were exported from the same barrel, so one code list had two
 * exported tables that disagreed.
 *
 * THE DROPPED WORDS WERE LOAD-BEARING. "forced unavailability" is what marks A54
 * as an AVAILABILITY CLASSIFICATION. "Unplanned outage" alone reads closer to a
 * CAUSE claim — and cause is a different axis, owned by a named authority. The
 * transcription quietly moved a code from the axis it belongs to toward one it
 * must never assert on its own.
 *
 * That this happened to the ENTSO-E code list specifically is the argument. U-2
 * was a hard producer blocker created by a transcription error against this very
 * table. Repeating the mistake one register later, in the module written to
 * prevent it, is why the second table is deleted rather than corrected.
 *
 * There is now ONE table: canonical's `ENTSOE_BUSINESS_TYPE`, re-used directly.
 */

/** The docStatus pair. Canonical carries this distinction in prose (U-2b); this is its only table. */
export type EntsoeDocStatus = 'A09' | 'A13';

export const ENTSOE_DOC_STATUS: Readonly<Record<EntsoeDocStatus, string>> = {
  A09: 'Cancelled',
  A13: 'Withdrawn',
};

/**
 * A78's business types ARE canonical's business types. Not a copy, not an alias
 * holding its own values — the canonical object itself, so drift is not
 * expressible. A guard asserts referential identity, which a copy cannot satisfy.
 */
export function entsoeBusinessTypeTable(): Readonly<Record<string, string>> {
  return ENTSOE_BUSINESS_TYPE;
}

export const ENTSOE_A09_IS_NOT_A13 = true as const;
export const ENTSOE_ACTIVATION_STATE = 'NOT_ACTIVATED' as const;
export const ENTSOE_U2_S6_STANDING = 'WITHDRAWN' as const;

/*
 * ─── 12b · THE RESTORATION RULE — A WITHDRAWN RECORD IS NOT A RECOVERY ──────
 *
 * R2 · BLOCKING CORRECTION. Canonical `PRODUCER_ACTIVATION_BLOCKERS` carries
 * U-2b, and its finding is the whole of this section:
 *
 *   "docStatus A09 Cancelled means the world changed; A13 Withdrawn means the
 *    RECORD was wrong. A13 must never produce a restoration event — that would
 *    put a false recovery on the Timeline."
 *
 * WHY THIS BECAME URGENT IN THIS LANE AND NOT BEFORE. At C43 the prohibition was
 * structurally safe for an accidental reason: `INFRASTRUCTURE_RESTORED` existed
 * only inside U-2b's own `blocks` STRING. There was no event type, so the event
 * it forbids could not be constructed. R0/R1 created the literal as a first-class
 * lifecycle event and did not carry the prohibition across — so an adapter could
 * satisfy every assertion in this file and still put a false recovery on a
 * Timeline. The register and the runtime contract disagreed, and only one of them
 * executed.
 *
 * THE HARM IS SPECIFIC, WHICH IS WHY A LABEL TABLE IS NOT ENOUGH. A withdrawal
 * says the outage record should never have existed. Reading that as "the outage
 * ended" publishes a recovery that never happened, to a professional deciding
 * whether a corridor is usable. The A09/A13 labels being correct in a table does
 * not stop that; only a refusal does.
 *
 * AND A09 IS NOT THE OPPOSITE. Cancelled means the world changed — it does NOT
 * mean "restored", and this contract does not infer restoration from it. A
 * cancellation is a fact about a planned event, not evidence a service returned.
 * Both directions are refused, because the failure this prevents is inference
 * from record lifecycle to world state, in either direction.
 */
export const U2B_BLOCKER_ID = 'U-2b' as const;

/** Does the canonical blocker still stand? Read from canonical, never assumed. */
export function u2bBlockerStands(): boolean {
  return PRODUCER_ACTIVATION_BLOCKERS.filter((b) => b.id === U2B_BLOCKER_ID).length > 0;
}

/**
 * HOW A RESTORATION CLAIM IS GROUNDED. A discriminated basis, so the refused
 * groundings are named rather than left to a free-text field to imply.
 */
export type RestorationEvidenceBasis =
  /** The source itself states the service or capability returned. The only sufficient basis. */
  | 'SOURCE_STATED_RESTORATION'
  /** REFUSED. The record was withdrawn — it should never have existed. */
  | 'RECORD_WITHDRAWN'
  /** REFUSED. The record was cancelled — the world changed; that is not a return of service. */
  | 'RECORD_CANCELLED'
  /** REFUSED. The outage stopped appearing in a feed. Absence is not evidence. */
  | 'INFERRED_FROM_ABSENCE';

export const RESTORATION_BASES_SUFFICIENT: readonly RestorationEvidenceBasis[] = [
  'SOURCE_STATED_RESTORATION',
];

export const RESTORATION_BASES_REFUSED: readonly RestorationEvidenceBasis[] = [
  'RECORD_WITHDRAWN',
  'RECORD_CANCELLED',
  'INFERRED_FROM_ABSENCE',
];

export interface RestorationClaim {
  /** The producer's source system, e.g. 'ENTSOE'. */
  readonly sourceSystem: string;
  /** Set only where the source carries one. */
  readonly docStatus: EntsoeDocStatus | null;
  readonly basis: RestorationEvidenceBasis;
}

export const ENTSOE_SOURCE_SYSTEM = 'ENTSOE' as const;

/**
 * MAY THIS CLAIM PRODUCE `INFRASTRUCTURE_RESTORED`?
 *
 * Four refusals, ordered so the most specific reason is the one reported.
 */
export function assertRestorationClaimIsAdmissible(claim: RestorationClaim): void {
  if (claim.docStatus === 'A13') {
    throw new Error(
      'SEC-RESTORE-1: docStatus A13 Withdrawn means the RECORD was wrong, not that service ' +
        'returned. A withdrawal must never produce INFRASTRUCTURE_RESTORED — it would put a ' +
        'false recovery on the Timeline (canonical blocker U-2b).',
    );
  }

  if (claim.docStatus === 'A09' && claim.basis !== 'SOURCE_STATED_RESTORATION') {
    throw new Error(
      'SEC-RESTORE-2: docStatus A09 Cancelled means the world changed. It is NOT a statement ' +
        'that a service returned, and restoration is never inferred from it.',
    );
  }

  if (RESTORATION_BASES_REFUSED.indexOf(claim.basis) !== -1) {
    throw new Error(
      `SEC-RESTORE-3: basis ${claim.basis} does not ground a restoration. Only a source that ` +
        'STATES the service or capability returned may produce INFRASTRUCTURE_RESTORED.',
    );
  }

  if (claim.sourceSystem === ENTSOE_SOURCE_SYSTEM && u2bBlockerStands()) {
    throw new Error(
      'SEC-RESTORE-4: canonical blocker U-2b stands and blocks ' +
        '"INFRASTRUCTURE_RESTORED from any ENTSO-E document". The blocker is broader than the ' +
        'A13 rule and is read from canonical rather than restated here.',
    );
  }
}

/** Convenience predicate; same rule, no second implementation. */
export function restorationClaimIsAdmissible(claim: RestorationClaim): boolean {
  try {
    assertRestorationClaimIsAdmissible(claim);
    return true;
  } catch {
    return false;
  }
}

/*
 * ─── 13 · SEC 8-K ITEM 1.05 — SOURCE-INDEPENDENT CONTRACT REQUIREMENTS ──────
 *
 * No EDGAR retrieval, no parser, no filing shape. The only thing recorded is
 * what ANY source must satisfy to raise CYBER_INCIDENT_CONFIRMED, and the
 * consequence for this particular source.
 */
export const SEC_8K_ITEM_105_CLASSIFICATION = 'SOURCE_SCHEMA_CANDIDATE' as const;

export const SEC_8K_BLOCKED_UNTIL: string =
  'a filing identifies a NAMED AFFECTED SYSTEM. Item 1.05 may lawfully describe a material ' +
  'incident without naming one, and the contract is not relaxed to fit the source.';

/*
 * ─── 14 · E-6, CARRIED UNCHANGED ────────────────────────────────────────────
 *
 * Recorded for runtime-contract purposes only. No canonical Security platform
 * semantics are changed by this module, and no provider is activated, so no E-6
 * exemption is needed to define a contract.
 */
export const E6_PLATFORM_REQUIREMENT = 'MET' as const;
export const E6_PRODUCER_REQUIREMENT = 'OPEN' as const;
export const E6A_SCOPE = 'mandatory single-producer controls' as const;
export const E6B_SCOPE = 'pairwise convergence controls' as const;
export const E6B_IS_CONDITIONAL_ON_OVERLAP = true as const;
