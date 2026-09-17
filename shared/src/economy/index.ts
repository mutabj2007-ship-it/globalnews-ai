/**
 * ECON-CONTRACT-1 — THE CANONICAL SHARED ECONOMY DOMAIN / READ-MODEL CONTRACT.
 *
 * WHY THIS FILE EXISTS.
 *
 * Two validated Economy lanes arrived on C36 describing the same concepts in two
 * incompatible vocabularies. `ECON-DATA-1` (backend) and `ECON-UI-1` (frontend) each
 * declared their own `Series`, `Period`, `Observation`, `Assessment` and `Corridor`, and
 * their three value axes overlapped in exactly one member each. Two definitions of one
 * fact do not stay in agreement; they stay in agreement until somebody edits one.
 *
 * So this is the single semantic authority both lanes bind to. It is a CONTRACT, not an
 * implementation:
 *
 *   - it retrieves nothing, schedules nothing and scores nothing;
 *   - it declares no provider, no producer and no numeric datum;
 *   - it holds no presentation concern — no component, no layout, no breakpoint, no copy;
 *   - it holds no backend concern — no repository, no registry lookup, no transport.
 *
 * DECLARING A VOCABULARY IS NOT CLAIMING THE DATA. This deployment has no numeric
 * economic observation producer. Nothing here implies one exists, and
 * `EconomyObservationAvailability` exists precisely so a surface can say so out loud.
 *
 * THE SPINE, PRESERVED FROM THE ACCEPTED ARCHITECTURE:
 *
 *     Series -> Period -> Observation -> Assessment
 *
 * THE HARD RULE, RESTATED AS A TYPE RATHER THAN A CONVENTION:
 *
 *     AN OBSERVATION IS IMMUTABLE. A revision creates a LATER VINTAGE for the same
 *     Series + Period. The prior observation is never overwritten.
 *
 * NO LOCALE TYPE IS DECLARED HERE. The display-language authority is
 * `DisplayLocale` in `shared/src/language/`, and the source language of a record travels
 * on `SourceProvenance.language`. ECON-CONTRACT-1 introduces neither, by instruction: the
 * Economy locale correction is a separate specialist change owned by its lane.
 */

/*
  B4-A ADAPTATION — the only change to this file.

  Canonical imported from '../sourceModel', which B3.1 deliberately did NOT
  recover: it redeclares SourceType, and the sealed candidate's './source-type'
  already owns that symbol with a measured-equivalent union. The provenance
  structures were recovered into './source-provenance' instead, so the import is
  repointed and nothing else in this contract moves.
*/
import type { SourceProvenance } from '../source-provenance';
import type { WatchChangeState } from '../watch';

/* ------------------------------------------------------------------ *
 * 1 · THE THREE INDEPENDENT AXES OF AN ECONOMIC VALUE
 * ------------------------------------------------------------------ */

/**
 * AXIS 1 — WHERE THE PUBLISHER IS IN ITS OWN RELEASE CYCLE.
 *
 * A property of the PUBLISHER'S process. Never our confidence in the number, never how
 * old it is.
 *
 * RECONCILIATION. The backend lane carried five members; the frontend lane carried three
 * (`PRELIM | REVISED | FINAL`) but made the field NULLABLE, on the correct ground that a
 * forecast has no publication cycle and therefore no release status at all. Both
 * contributions survive here: the five members, because `SCHEDULED` and `WITHDRAWN` are
 * real publisher states neither lane may otherwise express, and the nullability, because
 * "not applicable" is not a sixth status. `PRELIM` was a spelling of `PRELIMINARY`.
 */
export const ECONOMY_RELEASE_STATUSES = [
  /** Announced in the release calendar; no figure published yet. */
  'SCHEDULED',
  /** First publication. The publisher itself expects to revise it. */
  'PRELIMINARY',
  /** A later vintage the publisher has issued for the same Series + Period. */
  'REVISED',
  /** The publisher states it will not revise further. */
  'FINAL',
  /** The publisher withdrew the figure without replacing it. */
  'WITHDRAWN',
] as const;

export type EconomyReleaseStatus = (typeof ECONOMY_RELEASE_STATUSES)[number];

/**
 * AXIS 2 — WHAT KIND OF NUMBER THIS IS.
 *
 * A property of the VALUE'S NATURE. An actual and a forecast for the same Series and
 * Period are both legitimate and are not competing versions of one fact — which is why a
 * forecast must never occupy an Observation slot and silently become "the value".
 *
 * RECONCILIATION. `OBSERVED` and `ACTUAL` were one concept under two names; `ACTUAL` is
 * kept because it is the word the release calendars themselves use beside `FORECAST` and
 * `PREVIOUS`. `ESTIMATED` is NOT kept as a member: a third party's estimate is a
 * `FORECAST` attributed to that party, and our own arithmetic on published actuals is
 * `DERIVED`. Keeping both would have left "who estimated it" unanswerable from the type.
 * `TARGET` is kept because a publisher's own objective — an inflation target, a policy
 * rate corridor — is neither a measurement nor a projection, and the frontend lane had no
 * way to say so.
 */
export const ECONOMY_VALUE_KINDS = [
  /** Observed and published by the statistical authority. */
  'ACTUAL',
  /** A projection attributed to a named forecaster. */
  'FORECAST',
  /** Derived by us from published actuals — a rate of change, a rebasing, an aggregate. */
  'DERIVED',
  /** The publisher's own target or objective, not a measurement. */
  'TARGET',
] as const;

export type EconomyValueKind = (typeof ECONOMY_VALUE_KINDS)[number];

/**
 * AXIS 3 — HOW OLD THIS IS RELATIVE TO THE PUBLISHER'S OWN CADENCE.
 *
 * A property of TIME, and the only one of the three that changes without anybody
 * publishing anything. That is why it cannot live inside either of the others: a value's
 * freshness decays while its release status and its kind stay exactly what they were.
 *
 * RECONCILIATION, AND THE ONE REAL CATEGORY ERROR FOUND. The frontend lane's axis was
 * named "FRESHNESS / AVAILABILITY" and carried `UNAVAILABLE` as a member. Availability is
 * NOT a freshness: a figure that was never published has no age to report, and a freshness
 * scale that can say "absent" will eventually be asked what an absent figure's value is.
 * `UNAVAILABLE` therefore does not appear here. Absence is modelled by
 * `EconomyFigureSlot`, below, which is the only place a gap can be expressed — and it
 * requires a reason. `CURRENT` became `FRESH`; `DELAYED` folded into `STALE`, which is
 * what "the next release is overdue" already means; `UNDETERMINED` is kept because a
 * Series whose cadence the publisher never stated cannot honestly be called fresh OR
 * stale, and the frontend lane could not say that at all.
 */
export const ECONOMY_FRESHNESS_STATES = [
  /** Within the publisher's stated cadence for this Series. */
  'FRESH',
  /** Past the cadence but inside the tolerance the Series declares. */
  'AGEING',
  /** Beyond tolerance — the next release is overdue or was missed. */
  'STALE',
  /** We hold no cadence for this Series, so age cannot be judged. */
  'UNDETERMINED',
] as const;

export type EconomyFreshness = (typeof ECONOMY_FRESHNESS_STATES)[number];

/**
 * The three axes carried together WITHOUT being merged. A consumer reads the one it
 * needs; nothing here computes a combined status, and no ordering or lattice is offered.
 * Every combination is meaningful:
 *
 *     FINAL       + ACTUAL   + STALE          a settled number nobody has revisited
 *     PRELIMINARY + ACTUAL   + FRESH          this morning's flash estimate
 *     SCHEDULED   + FORECAST + FRESH          a projection for a release not yet out
 *     null        + FORECAST + UNDETERMINED   a forecaster's number, no release cycle
 */
export interface EconomyValueSemantics {
  /** NULL means "this value has no publication cycle", not "unknown". */
  readonly releaseStatus: EconomyReleaseStatus | null;
  readonly valueKind: EconomyValueKind;
  readonly freshness: EconomyFreshness;
  /** REVISED only: which revision this is, so a surface can render "REV 2". */
  readonly revisionOrdinal?: number;
}

/**
 * Executable form of the nullability rule. A FORECAST, DERIVED or TARGET value carries no
 * publisher release cycle, so a release status on one is a category error rather than
 * extra information.
 */
export function assertReleaseStatusIsApplicable(semantics: EconomyValueSemantics): void {
  if (semantics.valueKind !== 'ACTUAL' && semantics.releaseStatus !== null) {
    throw new Error(
      `ECON-AXIS-1: valueKind ${semantics.valueKind} has no publisher release cycle, so ` +
        `releaseStatus must be null, not ${semantics.releaseStatus}.`,
    );
  }
  if (semantics.revisionOrdinal !== undefined && semantics.releaseStatus !== 'REVISED') {
    throw new Error(
      'ECON-AXIS-2: revisionOrdinal is meaningful only when releaseStatus is REVISED.',
    );
  }
}

/* ------------------------------------------------------------------ *
 * 2 · AVAILABILITY — A SEPARATE CONCEPT, NOT A FOURTH AXIS
 * ------------------------------------------------------------------ */

/**
 * WHETHER THIS DEPLOYMENT HAS A NUMERIC OBSERVATION PRODUCER AT ALL.
 *
 * This is a statement about the SYSTEM, not about any one figure, which is why it is not
 * an axis on a value. Declaring the vocabulary does not assert a state: the measured state
 * of a deployment is the owning lane's to publish, and at the time of writing no numeric
 * economic time-series producer exists.
 *
 * `FIXTURE` is named explicitly so a demo surface can never be mistaken for a producer.
 * A fixture is not an observation.
 */
export const ECONOMY_OBSERVATION_AVAILABILITY_STATES = [
  'OBSERVED',
  'NO_OBSERVATION_SOURCE',
  'FIXTURE',
] as const;

export type EconomyObservationAvailability =
  (typeof ECONOMY_OBSERVATION_AVAILABILITY_STATES)[number];

/** Only a real producer counts. A fixture never does. */
export function economyHasObservationSource(state: EconomyObservationAvailability): boolean {
  return state === 'OBSERVED';
}

/** Why a figure that a reader expected to see is not there. Never omitted, never guessed. */
export const ECONOMY_FIGURE_GAP_REASONS = [
  /** The publisher does not collect it. */
  'NOT_COLLECTED',
  /** The publisher collected it and did not release it. */
  'WITHHELD',
  /** The series was discontinued. */
  'DISCONTINUED',
  /** This deployment has no producer for it. A fact about us, not about the publisher. */
  'NO_PRODUCER',
] as const;

export type EconomyFigureGapReason = (typeof ECONOMY_FIGURE_GAP_REASONS)[number];

/* ------------------------------------------------------------------ *
 * 3 · THE SPINE — Series -> Period -> Observation -> Assessment
 * ------------------------------------------------------------------ */

/** The publisher's stated release cadence. ABSENT rather than guessed. */
export type EconomyCadence = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'IRREGULAR';

/** The categories the accepted Economy design names. Capability is declared separately. */
export const ECONOMY_CATEGORIES = [
  'INFLATION_CPI',
  'POLICY_RATE',
  'GROWTH_GDP',
  'EMPLOYMENT',
  'PUBLIC_DEBT_FISCAL',
  'TRADE_EXTERNAL_BALANCE',
  'FX_CONDITIONS',
] as const;

export type EconomyCategory = (typeof ECONOMY_CATEGORIES)[number];

/**
 * A measured quantity through time — "Rwanda headline CPI, year on year".
 *
 * `seriesId` is CALLER-SUPPLIED. This contract mints no identifiers: an id minted here
 * would be a second platform identity scheme beside the ones that already exist, and this
 * contract is explicitly not that.
 */
export interface EconomySeries {
  readonly seriesId: string;
  readonly label: string;
  /** ISO 3166-1 alpha-2 of the economy measured. Never inferred from a source. */
  readonly economyIso2: string;
  readonly unit: string;
  readonly category: EconomyCategory;
  /** A `geographyId` from the geo ladder, when the series is anchored to one. */
  readonly geographyId?: string;
  /** Absent rather than guessed — freshness is UNDETERMINED without it. */
  readonly cadence?: EconomyCadence;
}

/**
 * The interval an observation is ABOUT — never the interval it was published in.
 * "2026-Q1" is a period; the release date of the Q1 figure is not.
 */
export interface EconomyPeriod {
  readonly periodId: string;
  /** ISO-8601 date, inclusive. */
  readonly start: string;
  /** ISO-8601 date, inclusive. */
  readonly end: string;
  /** How the period prints on a figure — "AUG 2026", "Q2 2026". Display text, not an id. */
  readonly label?: string;
}

/**
 * ONE IMMUTABLE READING of one Series for one Period, as one publisher stated it at one
 * moment.
 *
 * `vintage` is what makes a revision a NEW RECORD rather than an edit. Two observations
 * sharing (seriesId, periodId) and differing in vintage are BOTH TRUE — they are what was
 * believed at two different times. There is deliberately no mutator, no `supersededValue`
 * and no `previousValue`: the prior value is a prior Observation, not a property of its
 * successor.
 *
 * `value` IS REQUIRED AND IS NOT NULLABLE. A reading that does not exist is not an
 * observation with a null in it — it is the absence of an observation, which
 * `EconomyFigureSlot` expresses with a reason. This is the reconciliation of the frontend
 * lane's `value: number | null` against the backend lane's `value: number`: the frontend
 * need was real (a surface must render an em-dash, never a zero) and is met by the slot,
 * without teaching the observation type to represent its own absence.
 */
export interface EconomyObservation {
  readonly seriesId: string;
  readonly periodId: string;
  /**
   * ISO-8601. WHEN THE PUBLISHER ISSUED THIS READING — not when we retrieved it.
   * Retrieval time lives in `provenance.retrievedAt`; conflating them makes our ingestion
   * schedule look like the publisher's revision history.
   */
  readonly vintage: string;
  readonly value: number;
  readonly unit: string;
  /** The three independent axes. Never collapsed into one status. */
  readonly semantics: EconomyValueSemantics;
  /**
   * The platform's own provenance model, reused verbatim. Economy declares NO provenance
   * vocabulary of its own and creates no second evidence system.
   */
  readonly provenance: SourceProvenance;
}

/**
 * A figure position that a surface must render: either a reading, or a stated gap.
 *
 * This is the only place absence may be expressed, and it cannot be expressed without a
 * reason. A gap is never a zero and never an empty cell with no explanation.
 */
export type EconomyFigureSlot =
  | { readonly kind: 'OBSERVATION'; readonly observation: EconomyObservation }
  | {
      readonly kind: 'GAP';
      readonly seriesId: string;
      readonly periodId: string;
      readonly reason: EconomyFigureGapReason;
    };

/**
 * An interpretation OF observations. A slot, deliberately without a producer.
 *
 * `producedBy` is required and has no default, so an assessment can never appear without
 * something accountable for it. This contract declares no scorer and no `attentionRank`:
 * a scoring function added here would become the second assessment engine the domain
 * boundary exists to prevent.
 *
 * RECONCILIATION. The backend lane carried an Economy-local three-member change state
 * (`NO_MATERIAL_CHANGE | MATERIAL_CHANGE | INSUFFICIENT_EVIDENCE`); the frontend lane
 * carried the platform's closed seven. The platform's seven govern —
 * `shared/src/watch.ts` states the union is "fixed here and closed to extension", and the
 * accepted Economy design adds none. `INSUFFICIENT_EVIDENCE` is not a state: it is the
 * ABSENCE of one, so `changeState` is nullable and `changeStateReason` explains the null.
 * That is the same shape the platform already uses in `WatchChangeStateMapping`, rather
 * than a new idea.
 */
export interface EconomyAssessment {
  readonly seriesId: string;
  readonly periodId: string;
  /** Which observation vintages this assessment read. Never empty. */
  readonly observedVintages: readonly string[];
  /** Identifier of the producer that formed it. No producer, no assessment. */
  readonly producedBy: string;
  /** ISO-8601. */
  readonly assessedAt: string;
  /** NULL when no state may honestly be asserted. Not a gap to be defaulted later. */
  readonly changeState: WatchChangeState | null;
  /** Required when `changeState` is null; explains which it was. */
  readonly changeStateReason?: string;
  /** The state this one replaced, when a surface shows the transition. */
  readonly priorChangeState?: WatchChangeState | null;
}

/** An assessment that names no vintages has read nothing and asserts about nothing. */
export function assertAssessmentIsAccountable(assessment: EconomyAssessment): void {
  if (assessment.observedVintages.length === 0) {
    throw new Error(
      'ECON-ASSESS-1: an assessment must name the observation vintages it read. ' +
        'An assessment over no observations is not an assessment.',
    );
  }
  if (assessment.producedBy.trim().length === 0) {
    throw new Error('ECON-ASSESS-2: an assessment must name its producer.');
  }
  if (assessment.changeState === null && assessment.changeStateReason === undefined) {
    throw new Error(
      'ECON-ASSESS-3: a null change state must state why none could be asserted. ' +
        'Silence is how a missing state becomes a default later.',
    );
  }
}

/* ------------------------------------------------------------------ *
 * 4 · CONSENSUS IS A DERIVED BENCHMARK, NOT AN OBSERVATION
 * ------------------------------------------------------------------ */

/**
 * A consensus figure is an aggregation performed over other people's forecasts. It has no
 * publisher, so no release cycle, so NO RELEASE STATUS; it is not an observation, so it
 * can never be a vintage of a Series + Period; and it is uninterpretable without its
 * method, its N and its cutoff — "consensus 5.2%" from 3 forecasters collected a month ago
 * and from 40 collected yesterday are different objects wearing the same number.
 *
 * The type therefore has no `releaseStatus` field, and cannot be given one by accident.
 */
export interface EconomyConsensusBenchmark {
  readonly seriesId: string;
  readonly periodId: string;
  readonly value: number;
  readonly unit: string;
  /** How the contributing forecasts were combined. Never omitted. */
  readonly aggregationMethod: 'MEAN' | 'MEDIAN' | 'TRIMMED_MEAN' | 'MODE';
  /** How many forecasts the aggregate is over. Never omitted, never estimated. */
  readonly contributorCount: number;
  /** ISO-8601. When contributions stopped being collected. */
  readonly collectionCutoff: string;
  /** Identifiers only — this contract neither stores nor republishes another's number. */
  readonly contributingForecastRefs: readonly string[];
  /** Always DERIVED. There is no actual and no release here. */
  readonly valueKind: Extract<EconomyValueKind, 'DERIVED'>;
}

/**
 * Executable form of the rule. A benchmark that has acquired a release status, or that
 * claims contributors it cannot name, has started pretending to be an Observation.
 */
export function assertConsensusIsNotObservation(benchmark: EconomyConsensusBenchmark): void {
  if ('releaseStatus' in benchmark) {
    throw new Error(
      'ECON-CONSENSUS-1: a consensus benchmark must not carry a release status. ' +
        'It is an aggregation of forecasts, not a publisher release.',
    );
  }
  if (benchmark.contributorCount !== benchmark.contributingForecastRefs.length) {
    throw new Error(
      `ECON-CONSENSUS-2: contributorCount ${benchmark.contributorCount} does not match ` +
        `${benchmark.contributingForecastRefs.length} contributing forecast references. ` +
        'An unattributable N is not a benchmark.',
    );
  }
  if (benchmark.contributorCount < 1) {
    throw new Error('ECON-CONSENSUS-3: a benchmark over zero forecasts is not a benchmark.');
  }
}

/* ------------------------------------------------------------------ *
 * 5 · LEDGER KEYS — INJECTIVE, BECAUSE THE PARTS ARE CALLER-SUPPLIED
 * ------------------------------------------------------------------ */

/**
 * KEY ENCODING VERSION. Versioned separately from any data version so a stored key stays
 * readable and self-identifying if the encoding ever changes.
 */
export const ECONOMY_KEY_ENCODING_VERSION = 'eco:1';

/**
 * WHY THESE ARE LENGTH-PREFIXED AND NOT DELIMITER-JOINED.
 *
 * `seriesId`, `periodId` and `vintage` are all caller-supplied strings. Any key built by
 * joining them with a separator collides as soon as one part can contain that separator:
 *
 *     join(' ')  { 'RW CPI', 'Q1',    'v1' }  ->  "RW CPI Q1 v1"
 *     join(' ')  { 'RW',     'CPI Q1', 'v1' }  ->  "RW CPI Q1 v1"     <- same key, two facts
 *
 * A ledger keyed like that silently merges two different observations, and the merge is
 * invisible: nothing throws, one row simply wins. Length-prefixing makes the encoding
 * injective by construction — the decoder always knows where each part ends — so no
 * caller input can produce a collision.
 *
 * THIS IS NOT A REUSE OF THE SITUATION IDENTITY CONTRACT. Injectivity is a property of
 * string encodings, derived here from Economy's own caller-supplied inputs. Situation
 * identity's partitioning, its discriminator space, its similarity threshold and its
 * attachment semantics are Situation-domain concerns; this file imports none of them and
 * asserts nothing about them. Economy object identity and Situation identity remain
 * separate domains unless an explicit shared authority says otherwise.
 *
 * These keys are LEDGER-LOCAL. They address a record inside an Economy store. They are
 * not a platform identity scheme and mint nothing: every part is supplied by the caller.
 */
function lengthPrefixed(parts: readonly string[]): string {
  return parts.map((p) => `${p.length}:${p}`).join('');
}

/** Identity of an observation for ledger purposes: Series + Period + vintage. */
export function economyObservationKey(
  o: Pick<EconomyObservation, 'seriesId' | 'periodId' | 'vintage'>,
): string {
  return `${ECONOMY_KEY_ENCODING_VERSION}:${lengthPrefixed([o.seriesId, o.periodId, o.vintage])}`;
}

/**
 * The slot a revision competes for: Series + Period, WITHOUT the vintage.
 *
 * Two observations with the same series-period key and different vintages are the SAME
 * SLOT and are both retained. That is the immutability rule expressed as a key.
 */
export function economySeriesPeriodKey(
  o: Pick<EconomyObservation, 'seriesId' | 'periodId'>,
): string {
  return `${ECONOMY_KEY_ENCODING_VERSION}:${lengthPrefixed([o.seriesId, o.periodId])}`;
}

/**
 * Executable form of the immutability rule: a later vintage for a slot NEVER replaces the
 * earlier one. Returns the retained set, oldest vintage first. It stores nothing.
 */
export function economyRetainVintages(
  existing: readonly EconomyObservation[],
  incoming: EconomyObservation,
): readonly EconomyObservation[] {
  const slot = economySeriesPeriodKey(incoming);
  const incomingKey = economyObservationKey(incoming);

  for (const o of existing) {
    if (economyObservationKey(o) === incomingKey) {
      if (o.value !== incoming.value) {
        throw new Error(
          `ECON-IMMUTABLE-1: observation ${incomingKey} already exists with a different ` +
            'value. A correction is a NEW VINTAGE, never an edit of an existing one.',
        );
      }
      return existing;
    }
  }

  const kept = [...existing, incoming];
  return kept.sort((a, b) =>
    economySeriesPeriodKey(a) === slot && economySeriesPeriodKey(b) === slot
      ? a.vintage.localeCompare(b.vintage)
      : 0,
  );
}

/* ------------------------------------------------------------------ *
 * 6 · CORRIDOR — CAPABILITY IS PART OF THE CONTRACT
 * ------------------------------------------------------------------ */

/**
 * WHAT SHARED SPATIAL CAN HONESTLY SUPPLY FOR A CORRIDOR.
 *
 * RECONCILIATION OF THE MEMBER NAME. The two lanes agreed on the VALUE in force
 * (`ENDPOINT_ONLY`) and disagreed on the name of its sibling: `ROUTE_GEOMETRY` against
 * `ROUTE_SUPPORTED`. `ROUTE_SUPPORTED` is kept, and not because it is longer: both members
 * of this union answer the same question — *what can the platform supply?* —
 * and `ENDPOINT_ONLY` is already phrased as a capability, not as a data kind. A union
 * whose members answer different questions is how a capability flag turns into a
 * type discriminator later.
 */
export const ECONOMY_CORRIDOR_CAPABILITIES = [
  /** Route/line geometry exists and may be drawn. NOT the state in force. */
  'ROUTE_SUPPORTED',
  /** Only endpoints, nodes and areas exist. The measured state in force. */
  'ENDPOINT_ONLY',
] as const;

export type EconomyCorridorCapability = (typeof ECONOMY_CORRIDOR_CAPABILITIES)[number];

/**
 * How one endpoint relates to the next. This is the ECONOMIC relationship, and it is what
 * replaces the drawn line — a corridor's meaning was never the polyline, it was the
 * dependency.
 */
export type EconomyCorridorLinkKind =
  /** Physical movement of goods between the two endpoints. */
  | 'FREIGHT_FLOW'
  /** One endpoint is the port or gateway through which the other trades. */
  | 'GATEWAY_DEPENDENCE'
  /** A price at one endpoint propagates to the other. */
  | 'PRICE_TRANSMISSION'
  /** A named policy or tariff couples the two. */
  | 'POLICY_LINKAGE';

/**
 * ONE ENDPOINT of a corridor, at the SHARED semantic level.
 *
 * The endpoint references geography by `geographyId` from the geo ladder — the same
 * reference `WatchSubject` already uses — and carries `renderable` so a surface knows an
 * unresolved endpoint is unresolved. The resolver's full evidence payload (precision,
 * location provenance, candidate set) is a backend type and stays in the backend: shared
 * carries the reference, not a copy of the resolver's output.
 *
 * An endpoint whose geography did not resolve is KEPT, with `renderable: false`. Dropping
 * it would silently shorten the chain, and "Red Sea to East African imports" has a real
 * economic meaning while one end is a region the gazetteer cannot resolve.
 */
export interface EconomyCorridorEndpoint {
  /** Caller-supplied label for the endpoint's role, e.g. 'ORIGIN_PORT'. */
  readonly role: string;
  /** A `geographyId` from the geo ladder. Absent when the resolver returned nothing. */
  readonly geographyId?: string;
  /** Whether the platform's resolver produced something a map may draw. */
  readonly renderable: boolean;
}

/**
 * One step in the transmission chain: from an endpoint, to an endpoint, by a stated
 * economic relationship. AT NO POINT IS A CONTINUOUS PATH IMPLIED — the steps are a
 * dependency graph, not a geometry, and that distinction is what keeps this honest while
 * route geometry is absent.
 */
export interface EconomyCorridorLink {
  readonly fromRole: string;
  readonly toRole: string;
  readonly kind: EconomyCorridorLinkKind;
  /**
   * Evidence identifiers supporting the link. Never empty — an asserted economic
   * relationship with nothing behind it is the fabrication this contract exists to avoid.
   */
  readonly evidenceRefs: readonly string[];
}

/**
 * A corridor as the platform can honestly express it.
 *
 * THERE IS NO GEOMETRY FIELD, AND THAT IS THE CONTRACT. A future route-capable state is
 * representable — `ROUTE_SUPPORTED` exists — but no geometry may be attached here, and
 * adding one is a shared Spatial change with its own authority, not an Economy field.
 */
export interface EconomyCorridor {
  readonly corridorId: string;
  readonly label: string;
  readonly capability: EconomyCorridorCapability;
  readonly endpoints: readonly EconomyCorridorEndpoint[];
  readonly chain: readonly EconomyCorridorLink[];
}

/**
 * REFUSES rather than degrades silently, because each rejected case would produce a
 * corridor that looks drawable and is not.
 */
export function assertCorridorIsHonest(corridor: EconomyCorridor): void {
  if (corridor.endpoints.length < 2) {
    throw new Error('ECON-CORRIDOR-1: a corridor needs at least two endpoints.');
  }
  const roles = new Set(corridor.endpoints.map((e) => e.role));
  for (const link of corridor.chain) {
    if (!roles.has(link.fromRole) || !roles.has(link.toRole)) {
      throw new Error(
        `ECON-CORRIDOR-2: link ${link.fromRole} -> ${link.toRole} names a role no endpoint ` +
          'declares. A dangling dependency is not a chain.',
      );
    }
    if (link.evidenceRefs.length === 0) {
      throw new Error(
        `ECON-CORRIDOR-3: link ${link.fromRole} -> ${link.toRole} has no evidence.`,
      );
    }
  }
  if (corridor.capability === 'ENDPOINT_ONLY' && 'geometry' in corridor) {
    throw new Error(
      'ECON-CORRIDOR-4: no geometry may be attached under ENDPOINT_ONLY. The chain is a ' +
        'dependency graph, not a path.',
    );
  }
}

/* ------------------------------------------------------------------ *
 * 7 · CLAIM KIND — CLASS ATTACHES TO THE RECORD, NEVER TO THE INSTITUTION
 * ------------------------------------------------------------------ */

/**
 * WHAT AN ECONOMY RECORD IS, independently of who published it.
 *
 * RECONCILIATION. The frontend lane classified the SOURCE
 * (`OFFICIAL_STATISTICAL | OFFICIAL_POLICY | INSTITUTIONAL_FORECAST | REPORTING_ANALYSIS`);
 * the backend lane classified the CLAIM. The platform rule is that class attaches to the
 * specific document, dataset or claim and never permanently brands an institution — so
 * the claim framing governs. The case that decides it: a central bank's rate announcement
 * and its statistical bulletin arrive from the same institution on the same day and are
 * not the same kind of record. A permanently-attached institutional class gets that wrong;
 * a claim kind cannot.
 *
 * The four members map one-to-one onto the frontend lane's four labels, so no
 * presentation capability is lost — see `ECONOMY_LEGACY_UI_SOURCE_CLASS`.
 */
export const ECONOMY_CLAIM_KINDS = [
  /** A statistical release: an indicator value for a period. */
  'STATISTICAL_RELEASE',
  /** An institution's record of its own decision — a rate announcement. */
  'POLICY_DECISION_RECORD',
  /** A projection attributed to a named forecaster. */
  'FORECAST_PUBLICATION',
  /** Journalism about any of the above. */
  'REPORTING_ON_ECONOMY',
] as const;

export type EconomyClaimKind = (typeof ECONOMY_CLAIM_KINDS)[number];

/**
 * The per-record evidence role. A POLICY_DECISION_RECORD is a PRIMARY_RECORD while a
 * STATISTICAL_RELEASE is REFERENCE_DATA, even from the same central bank on the same day —
 * which is exactly the case a permanently-attached institutional class gets wrong.
 *
 * Pure: it reads the claim, never a registry. Registry lookup, `sourceType` selection and
 * the assembly of a full `SourceProvenance` stay in the backend, where the registry is.
 */
export function economyEvidenceRoleFor(
  kind: EconomyClaimKind,
): NonNullable<SourceProvenance['evidenceRole']> {
  switch (kind) {
    case 'POLICY_DECISION_RECORD':
      return 'PRIMARY_RECORD';
    case 'STATISTICAL_RELEASE':
      return 'REFERENCE_DATA';
    case 'FORECAST_PUBLICATION':
      return 'CONTEXT';
    case 'REPORTING_ON_ECONOMY':
      return 'REPORTING';
  }
}

/* ------------------------------------------------------------------ *
 * 8 · THE MIGRATION BRIDGE — TRANSITIONAL, AND MARKED AS SUCH
 * ------------------------------------------------------------------ */

/**
 * TOTAL MAPPINGS FROM EACH LANE'S CURRENT VOCABULARY ONTO THIS CONTRACT.
 *
 * These exist so the reconciliation is machine-checkable rather than described in a
 * document, and so each lane's follow-up edit is mechanical instead of interpretive. Every
 * map below is asserted TOTAL by test: a member that stopped mapping would fail rather
 * than silently fall through to a default.
 *
 * THEY ARE TRANSITIONAL. Once both lanes bind to this contract directly, section 8 is
 * deletable in one move and nothing else changes. Nothing in sections 1–7 depends on it.
 */

/** Frontend lane release statuses. `PRELIM` was a spelling, not a distinct state. */
export const ECONOMY_LEGACY_UI_RELEASE_STATUS: Readonly<
  Record<'PRELIM' | 'REVISED' | 'FINAL', EconomyReleaseStatus>
> = {
  PRELIM: 'PRELIMINARY',
  REVISED: 'REVISED',
  FINAL: 'FINAL',
};

/**
 * Frontend lane value kinds. `ESTIMATED` is not a canonical member: whose estimate it was
 * decides. A third party's estimate is that party's FORECAST; our own arithmetic over
 * published actuals is DERIVED. This map takes the conservative reading — an unattributed
 * estimate is ours — and the lane's follow-up must confirm each call site.
 */
export const ECONOMY_LEGACY_UI_VALUE_KIND: Readonly<
  Record<'OBSERVED' | 'FORECAST' | 'ESTIMATED', EconomyValueKind>
> = {
  OBSERVED: 'ACTUAL',
  FORECAST: 'FORECAST',
  ESTIMATED: 'DERIVED',
};

/**
 * Frontend lane freshness states — THREE of the four map. `UNAVAILABLE` is deliberately
 * absent from this map because it is not a freshness: it is a figure that is not there,
 * which this contract expresses as an `EconomyFigureSlot` of kind `GAP` carrying an
 * `EconomyFigureGapReason`. A map entry for it would re-create exactly the category error
 * the axis reconciliation removed, so the omission is the ruling and is asserted by test.
 */
export const ECONOMY_LEGACY_UI_FRESHNESS: Readonly<
  Record<'CURRENT' | 'STALE' | 'DELAYED', EconomyFreshness>
> = {
  CURRENT: 'FRESH',
  STALE: 'STALE',
  DELAYED: 'STALE',
};

/** The frontend lane's `unavailableReason`, which becomes the gap reason. */
export const ECONOMY_LEGACY_UI_GAP_REASON: Readonly<
  Record<'NOT_COLLECTED' | 'WITHHELD' | 'DISCONTINUED', EconomyFigureGapReason>
> = {
  NOT_COLLECTED: 'NOT_COLLECTED',
  WITHHELD: 'WITHHELD',
  DISCONTINUED: 'DISCONTINUED',
};

/** Frontend lane source classes, onto the record-level claim kind. One-to-one. */
export const ECONOMY_LEGACY_UI_SOURCE_CLASS: Readonly<
  Record<
    'OFFICIAL_STATISTICAL' | 'OFFICIAL_POLICY' | 'INSTITUTIONAL_FORECAST' | 'REPORTING_ANALYSIS',
    EconomyClaimKind
  >
> = {
  OFFICIAL_STATISTICAL: 'STATISTICAL_RELEASE',
  OFFICIAL_POLICY: 'POLICY_DECISION_RECORD',
  INSTITUTIONAL_FORECAST: 'FORECAST_PUBLICATION',
  REPORTING_ANALYSIS: 'REPORTING_ON_ECONOMY',
};

/** Frontend lane corridor capability naming. Same values, one name. */
export const ECONOMY_LEGACY_UI_CORRIDOR_CAPABILITY: Readonly<
  Record<'ROUTE_GEOMETRY' | 'ENDPOINT_ONLY', EconomyCorridorCapability>
> = {
  ROUTE_GEOMETRY: 'ROUTE_SUPPORTED',
  ENDPOINT_ONLY: 'ENDPOINT_ONLY',
};

/**
 * Backend lane assessment change states, onto the platform's closed seven.
 *
 * `INSUFFICIENT_EVIDENCE` maps to NULL, not to a state — that is the whole point. The
 * platform's own `WatchChangeStateMapping` already models "nothing may honestly be shown"
 * as a null with a reason, and Economy inherits that rather than inventing an eighth state.
 */
export const ECONOMY_LEGACY_DATA_CHANGE_STATE: Readonly<
  Record<
    'NO_MATERIAL_CHANGE' | 'MATERIAL_CHANGE' | 'INSUFFICIENT_EVIDENCE',
    WatchChangeState | null
  >
> = {
  NO_MATERIAL_CHANGE: 'NO_MATERIAL_CHANGE',
  MATERIAL_CHANGE: 'SIGNIFICANT_CHANGE',
  INSUFFICIENT_EVIDENCE: null,
};

/**
 * Backend lane release statuses are already canonical, listed so the totality test covers
 * both directions and a future divergence fails rather than passes quietly.
 */
export const ECONOMY_LEGACY_DATA_RELEASE_STATUS: Readonly<
  Record<EconomyReleaseStatus, EconomyReleaseStatus>
> = {
  SCHEDULED: 'SCHEDULED',
  PRELIMINARY: 'PRELIMINARY',
  REVISED: 'REVISED',
  FINAL: 'FINAL',
  WITHDRAWN: 'WITHDRAWN',
};
