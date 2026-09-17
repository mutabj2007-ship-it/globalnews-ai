/**
 * ECON-UI-CONTRACT-ADAPT-1 — ECONOMY PRESENTATION VIEW MODELS, BOUND TO THE SHARED CONTRACT.
 *
 * Authority: MAIN-ECON-CONTRACT-1 (accepted), §7 H FOLLOW-UP REQUIREMENTS.
 *
 * WHAT CHANGED AND WHY. This module previously declared its own `ReleaseStatus`, `ValueKind`,
 * `Freshness`, `SourceClass`, `Period`, `Observation`, `ConsensusBenchmark`, `Series` and
 * `Corridor`. Those were a SECOND semantic read model sitting beside the platform's. They are
 * gone. Every semantic type below is now the shared one, bound by alias — not re-declared, so
 * there is exactly one definition of each and a drift between them is not expressible.
 *
 * WHAT STAYED. Composition and presentation stay here, because they are not read-model
 * concerns: how a series composes a latest figure, a triad and a history; what a subject's
 * substrate is; how attention rows, timelines, policies and watch baskets are shaped for
 * rendering. MAIN-ECON-CONTRACT-1 §7 is explicit that `latest`/`triad`/`history` are
 * composition and stay in H.
 *
 * THE ONE STRUCTURAL CHANGE WITH REAL CALL-SITE IMPACT (§7.3, §7.4).
 * Absence is no longer a freshness and no longer a null value. The old model said
 * `freshness: 'UNAVAILABLE'` with `value: number | null`, which let a surface ask "what is the
 * value of a figure that was never published?" and get `null` back as if that were an answer.
 * The shared contract makes the distinction structural instead:
 *
 *     EconomyFigureSlot = { kind: 'OBSERVATION'; observation }   a reading exists
 *                       | { kind: 'GAP'; seriesId; periodId; reason }   it does not
 *
 * A GAP CANNOT BE CONSTRUCTED WITHOUT A REASON. So every place this surface used to render an
 * em-dash now renders a slot, and the reason for the absence travels with it.
 */
import type {
  EconomyAssessment,
  EconomyCadence,
  EconomyClaimKind,
  EconomyConsensusBenchmark,
  EconomyCorridor,
  EconomyCorridorCapability,
  EconomyFigureGapReason,
  EconomyFigureSlot,
  EconomyFreshness,
  EconomyObservation,
  EconomyPeriod,
  EconomySeries,
  EconomyReleaseStatus,
  EconomyValueKind,
  EconomyValueSemantics,
  WatchChangeState,
} from '@globalnews-ai/shared';

/* ------------------------------------------------------------------ *
 * THE SHARED CONTRACT, BOUND BY ALIAS — NOT RE-DECLARED
 *
 * Each line below is a binding to the single shared definition. None of them introduces a
 * member, so no local spelling of a canonical set can exist. The legacy names are retained as
 * aliases only so the presentation layer reads naturally; a guard asserts that this file
 * declares no union members of its own.
 * ------------------------------------------------------------------ */

/** Five publisher states. Nullable: a forecast has no publication cycle (§ contract). */
export type ReleaseStatus = EconomyReleaseStatus;
/** ACTUAL · FORECAST · DERIVED · TARGET. `ESTIMATED` no longer exists as a fifth category. */
export type ValueKind = EconomyValueKind;
/** FRESH · AGEING · STALE · UNDETERMINED. Availability is NOT on this axis any more. */
export type Freshness = EconomyFreshness;
/** Formerly `FigureAxes`. Same three axes, canonical names. */
export type FigureAxes = EconomyValueSemantics;
/** Classifies the CLAIM, never the institution. Formerly `SourceClass`. */
export type SourceClass = EconomyClaimKind;
/** The platform's closed seven. `INSUFFICIENT_EVIDENCE` is `null`, not an eighth member. */
export type ChangeState = WatchChangeState;
export type Cadence = EconomyCadence;
export type Period = EconomyPeriod;
export type Observation = EconomyObservation;
export type ConsensusBenchmark = EconomyConsensusBenchmark;
export type Corridor = EconomyCorridor;
export type CorridorCapability = EconomyCorridorCapability;
export type FigureSlot = EconomyFigureSlot;
export type FigureGapReason = EconomyFigureGapReason;
export type SharedSeries = EconomySeries;
export type SharedAssessment = EconomyAssessment;


/* ------------------------------------------------------------------ *
 * PRESENTATION-ONLY VOCABULARY — H-OWNED, DELIBERATELY NOT SHARED
 * ------------------------------------------------------------------ */

/** Which way the series moved. Presentation; never borrows change-state meaning. */
export type Direction = 'UP' | 'FLAT' | 'DOWN';

/** How confident the standing assessment is. Presentation tag, never a colour. */
export type Confidence = 'HIGH' | 'MODERATE' | 'LOW';




/** The reusable triad, plus the derived surprise (Phase 1 §5). */
export interface ActualExpectedPrevious {
  /** Slots, not observations: an actual that was never published is a GAP, not a null. */
  readonly actual: FigureSlot;
  readonly expected: ConsensusBenchmark | null;
  readonly previous: FigureSlot | null;
  /** Derived: actual minus expected. Never stored as an independent figure. */
  readonly surprise: number | null;
  readonly surpriseUnit: string;
}

/**
 * ECON-UI-ASSESSMENT-R1 — THE ASSESSMENT NOW COMPOSES THE SHARED CONTRACT.
 *
 * WHAT WAS WRONG. This interface used to declare its own `changeState: ChangeState` (non-null),
 * `priorChangeState` and `computedFromObservationIds` — a parallel local semantic contract beside
 * `EconomyAssessment`. `SharedAssessment` was aliased and never used. The consequence was not
 * cosmetic: the production subject asserted `changeState: 'NO_MATERIAL_CHANGE'` over
 * `computedFromObservationIds: []`, in a deployment measuring `NO_OBSERVATION_SOURCE`. The chip was
 * hidden so the SCREEN was honest, but the OBJECT claimed a real finding over zero evidence, and the
 * object is what the next consumer reads. That violates ECON-ASSESS-1 and ECON-ASSESS-3.
 *
 * WHY `model` IS NULLABLE, which is a deliberate refinement of the sketched Option B.
 * `assertAssessmentIsAccountable` rejects `observedVintages.length === 0` UNCONDITIONALLY —
 * "an assessment over no observations is not an assessment". So in the no-source state there is no
 * legal `EconomyAssessment` to hold. A required `model` would leave only two ways out, and the lane
 * forbids both: fabricate observations, or construct an unaccountable assessment. The honest third
 * option is that THERE IS NO ASSESSMENT, stated as such, with the reason attached.
 *
 * So: `model` is the accepted contract object when a producer formed one, and `null` when none did.
 * Every `EconomyAssessment` this module constructs satisfies `assertAssessmentIsAccountable`; the
 * no-source path constructs none. Read the change state through `assessmentChangeState()`, which
 * returns `null` exactly when no state may honestly be asserted.
 */
export interface Assessment {
  readonly id: string;
  readonly subjectId: string;
  /**
   * The accepted shared read model — `EconomyAssessment` — or `null` when no producer formed one.
   * Never a placeholder: an absent assessment is absent, not an empty one.
   */
  readonly model: SharedAssessment | null;
  /**
   * Why no assessment exists. REQUIRED when `model` is null — the frontend counterpart of
   * ECON-ASSESS-3's rule that silence is how a missing state becomes a default later.
   */
  readonly absentReason?: string;
  /**
   * The intelligence statement. Written FROM the triad and the change state, and never a
   * restatement of the value. Rendered at a 44ch measure. H-OWNED PRESENTATION.
   */
  readonly statement: string;
  /** H-OWNED PRESENTATION. A tag, never a colour. */
  readonly confidence: Confidence;
}

/* ---- Accessors. The ONLY way a surface reads assessment semantics. ---- */

/**
 * The change state, or `null` when none may honestly be asserted — which is precisely the case
 * when no producer formed an assessment. There is no code path that yields a state without a model,
 * and therefore none that yields a state without the observation vintages behind it.
 */
export const assessmentChangeState = (a: Assessment): ChangeState | null =>
  a.model ? a.model.changeState : null;

/** Why no state is asserted. From the model when it exists, else the absence reason. */
export const assessmentChangeStateReason = (a: Assessment): string | undefined =>
  a.model ? a.model.changeStateReason : a.absentReason;

/** The prior state, shown only where a surface renders the transition. */
export const assessmentPriorChangeState = (a: Assessment): ChangeState | null =>
  a.model?.priorChangeState ?? null;

/**
 * The observation vintages the assessment read. Empty exactly when there is no assessment —
 * which is the condition the frontend guard pins against a non-null change state.
 */
export const assessmentObservedVintages = (a: Assessment): readonly string[] =>
  a.model ? a.model.observedVintages : [];

/**
 * SERIES — PRESENTATION COMPOSITION OVER THE SHARED READ MODEL (§7.1).
 *
 * `model` IS the contract's `EconomySeries`; nothing here re-states its fields. What this adds
 * is composition, which MAIN-ECON-CONTRACT-1 §7 assigns to H: which figure is latest, which
 * triad frames it, what history to plot, and how the direction arrow reads.
 *
 * `latest` and `history` are SLOTS, not observations. A series whose newest period was never
 * published still has a latest slot — a GAP carrying its reason — so the surface can say what
 * is missing and why instead of printing a null.
 */
export interface Series {
  /** The shared read model. The single source of id, label, unit, category and cadence. */
  readonly model: SharedSeries;
  /** Short chrome label. Presentation only — the read model carries the full `label`. */
  readonly shortLabel: string;
  /** Presentation. Never borrows change-state meaning (Phase 1 §6). */
  readonly direction: Direction;
  /** The newest figure, present or absent. Absence is a GAP with a stated reason. */
  readonly latest: FigureSlot;
  readonly triad: ActualExpectedPrevious | null;
  /** Ordered oldest -> newest. Window LENGTH is a breakpoint concern, not a data one. */
  readonly history: readonly FigureSlot[];
}

/** Convenience accessors so call sites do not reach through `model` for the common fields. */
export const seriesId = (s: Series): string => s.model.seriesId;
export const seriesName = (s: Series): string => s.model.label;
export const seriesUnit = (s: Series): string => s.model.unit;

/**
 * Persistent INSTRUMENT / STANCE / PROGRAM — a policy rate, a tax regime, a subsidy
 * scheme. Individual decisions and holds are lifecycle events ATTACHED to it, never
 * independent persistent Policy objects (Phase 1 §2.3).
 */
export interface Policy {
  readonly id: string;
  readonly name: string;
  readonly geographyId: string;
  readonly stance: string;
  readonly events: readonly LifecycleEvent[];
}

/**
 * Release / event — NOT AN OBJECT. No persistent identity. It renders as a timeline entry
 * and as a Watch trigger on a persistent subject (Phase 1 §2.7).
 */
export interface LifecycleEvent {
  readonly id: string;
  readonly kind: 'NEW_RELEASE' | 'REVISED' | 'POLICY_DECISION' | 'POLICY_HOLD' | 'NEW_EVIDENCE';
  readonly label: string;
  readonly occurredAt: string;
  /** The persistent subject this event attaches to. An event is never its own subject. */
  readonly subjectId: string;
}


/** Secondary object. Watchable, but weak alone as a first-viewport subject. */
export interface Sector {
  readonly id: string;
  readonly name: string;
  readonly geographyId: string;
}

/* ------------------------------------------------------------------ *
 * RELATIONSHIPS, EVIDENCE, COMPETING READINGS
 * ------------------------------------------------------------------ */

/**
 * The CLOSED set of relation words (Phase 1 §9). A chain must never imply stronger
 * causality than its weakest supported link, so the vocabulary itself is bounded.
 */
export type RelationWord =
  | 'ORIGIN_OF'
  | 'ASSOCIATED_WITH'
  | 'CONTRIBUTES_TO'
  | 'EXPOSURE_THROUGH'
  | 'POTENTIAL_TRANSMISSION_CHANNEL';

export interface TransmissionLink {
  readonly id: string;
  readonly title: string;
  readonly relation: RelationWord;
  /** Free-text qualifier the board renders in italic beside the relation word. */
  readonly relationDetail?: string;
  readonly evidenceCount: number;
  readonly confidence: Confidence;
  /** Weak links stay VISIBLE and stay WEAK — dotted node, thinned connector. */
  readonly supported: boolean;
  readonly crossDomain?: 'CONFLICT' | 'SPATIAL';
}

export interface SourceArtifact {
  readonly id: string;
  readonly publisher: string;
  readonly title: string;
  /** Class attaches HERE, to the artifact — never permanently to the publisher. */
  readonly sourceClass: SourceClass;
  readonly publishedAt: string;
  readonly originalLanguage?: string;
}

/**
 * Two readings that disagree. NEITHER IS PROMOTED — that is the whole point of the state,
 * so this type deliberately offers no `preferred` or `primary` field to render from.
 */
export interface CompetingReading {
  readonly id: string;
  readonly source: SourceArtifact;
  readonly value: number;
  readonly unit: string;
  readonly claim: string;
  readonly evidenceCount: number;
  readonly officialStatisticalCount: number;
  readonly vintage: string;
}

export interface CompetingReadingSet {
  readonly readings: readonly [CompetingReading, CompetingReading];
  /** The shared observation base, shown explicitly so the disagreement is locatable. */
  readonly sharedObservationBase: readonly string[];
  readonly assessment: string;
  readonly confidence: Confidence;
  readonly disputedObservationCount: number;
}

/* ------------------------------------------------------------------ *
 * ATTENTION — CONSUMED, NEVER COMPUTED
 * ------------------------------------------------------------------ */

/**
 * A9 — attentionRank arrives from the shared assessment service. THE UI ORDERS; IT NEVER
 * SCORES. There is no local ranking, normalization or approximation anywhere in this
 * module, and a guard asserts it.
 */
export interface AttentionRow {
  readonly id: string;
  readonly subjectId: string;
  readonly headline: string;
  readonly changeState: ChangeState;
  /** Supplied by the shared service. Economy sorts on it and does nothing else with it. */
  readonly attentionRank: number;
  readonly ageLabel: string;
  readonly provenance: string;
  /** A row may NAME a triggering lifecycle event; the event is never ranked itself. */
  readonly triggeringEvent?: LifecycleEvent;
}

/* ------------------------------------------------------------------ *
 * WATCH — SHARED CAPABILITY, ECONOMY PAYLOAD
 * ------------------------------------------------------------------ */

export type WatchTrigger =
  | 'NEW_RELEASE'
  | 'REVISED'
  | 'SIGNIFICANT_CHANGE'
  | 'NEW_EVIDENCE'
  | 'POLICY_RESPONSE';

/** One member of a country-economy basket. The basket is always shown DECOMPOSED. */
export interface WatchBasketMember {
  readonly subjectId: string;
  readonly label: string;
  readonly enabled: boolean;
}

/**
 * A country economy is a CONFIGURED WATCH BASKET, never one imaginary "economy value".
 * This type has no aggregate score field, deliberately.
 */
export interface EconomyWatchScope {
  readonly id: string;
  readonly label: string;
  readonly members: readonly WatchBasketMember[];
  readonly triggers: readonly WatchTrigger[];
}

/* ------------------------------------------------------------------ *
 * TIMELINE
 * ------------------------------------------------------------------ */

export interface TimelineEntry {
  readonly id: string;
  readonly dateLabel: string;
  readonly body: string;
  /** The change state / lifecycle meta the board renders inline after the body. */
  readonly meta: string;
  readonly isCurrent: boolean;
  /** Superseded observations stay reachable, marked superseded — never deleted. */
  readonly supersededObservationId?: string;
}

/* ------------------------------------------------------------------ *
 * THE SUBJECT UNION AND THE SUBSTRATE
 * ------------------------------------------------------------------ */

export type EconomySubjectKind = 'SERIES' | 'POLICY' | 'CORRIDOR' | 'SECTOR' | 'COUNTRY';

/** The substrate switches; the frame does not (First Viewport Zoning). */
export type SubstrateMode = 'DATA_DOMINANT' | 'SPLIT' | 'MAP_DOMINANT' | 'MINI_MAP';

export interface EconomySubject {
  readonly id: string;
  readonly kind: EconomySubjectKind;
  readonly name: string;
  readonly scopeLabel: string;
  readonly contextLabel: string;
  readonly assessment: Assessment;
  readonly substrate: SubstrateMode;
  readonly primarySeries: Series | null;
  readonly corridor: Corridor | null;
  readonly indicators: readonly Series[];
  readonly attention: readonly AttentionRow[];
  readonly watch: EconomyWatchScope;
  readonly policyLane: readonly LifecycleEvent[];
}
