/**
 * ════════════════════════════════════════════════════════════════════════════
 * HUMANITARIAN READ PRESENTATION — the real-data UI contract (lane G, R1)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Contract 6 asks for a UI contract that renders retained Humanitarian observations "without
 * overstating geography". This module is that contract: a pure projection from Main's canonical
 * retained read onto what a reader surface may show. No React, no I/O, no fetch, no model call —
 * which is also what makes "zero compute until pressed" provable rather than asserted.
 *
 * ── IT AUTHORS NO PROSE, DELIBERATELY ───────────────────────────────────────
 *
 * Every function here returns TOKENS and STRUCTURED FACTS. Reader copy belongs to lane L's
 * catalogue and to `humanitarianReadLabel`, which already authors EN/PL for the three read kinds.
 * A frontend lane inventing its own humanitarian sentences would fork the language authority and
 * would bypass the registered-catalogue pin in `humContract.spec.ts`.
 *
 * ── THE FOUR CTO RULINGS THIS ENCODES ───────────────────────────────────────
 *
 * These were my own R1 conflicts; the rulings came back and the retained-read contract already
 * names two of them. This module is where the other two become reader behaviour.
 *
 *   1 · A RETAINED SUCCESS CONTRACT EXISTS. `HumanitarianRetainedRead` now has three kinds —
 *       `UNAVAILABLE`, `NO_RETAINED_EVIDENCE`, `RETAINED`. So LIVE/RETAINED DATA is renderable.
 *
 *   2 · PUBLIC SOURCE TOPOLOGY REMAINS LOSSY. `readerAbsence()` projects
 *       `SOURCE_NOT_CONNECTED`, `SOURCE_TEMPORARILY_UNAVAILABLE` and protected withholding all
 *       onto `COVERAGE_GAP`. **So there is no reader-facing `SOURCE_UNAVAILABLE` view state, and
 *       this module must not be able to produce one.** Contract 6 lists it; the ruling overrides
 *       the list, because a reader who can tell "the source is down" from "we cannot see this
 *       scope" has been handed the source topology. `HUM_READ_VIEW_STATES` therefore omits it and
 *       a test asserts no input can yield it. Admin sees the distinction; readers do not.
 *
 *   3 · NO READER-FACING POLYGONS IN R1. The retained contract refuses any row carrying
 *       `geometryRecordKey` (HUM-READ-4), and `MAP_ALPHA` supports only `['NONE','POINT']`. No
 *       claim shape carries coordinates at all. So in R1 **nothing is drawable from a reader row**,
 *       and the map's honest output is `NOT_DRAWABLE_HERE` — an existing reader absence token, not
 *       a new vocabulary.
 *
 *   4 · RENDER ONLY ACTUALLY SUPPORTED PRECISION. Every claim scopes geography as
 *       `countryIso3: readonly string[]` and nothing finer. The only renderable levels are
 *       therefore COUNTRY (alias `COUNTRY`) and UNKNOWN (alias `UNPLACED`) — both of which
 *       `HUM_PRECISION_MAPPING` marks producible. EXACT, DISTRICT, REGION and ADMIN3 are
 *       unreachable here by construction, which is R09's rule enforced rather than restated.
 *
 * ── THE ONE THING THIS MODULE IS MOST LIKELY TO GET WRONG ───────────────────
 *
 * Making an absence look like a finding. `NO_RETAINED_EVIDENCE` means OUR STORE is empty; it is
 * not "nothing happened", and it is deliberately not an `absence` value so no projection can map
 * it onto `ASSESSED_NOTHING_QUALIFIED`. Every view state here keeps that separation, and
 * `humReadIsAssessment()` exists so a caller cannot accidentally treat any of them as one: it
 * returns false for all six.
 */
import {
  capabilityOfSurface,
  READER_ABSENCE_TOKENS,
  type HumanitarianRetainedRead,
  type HumanitarianRetainedRecord,
  type ReaderAbsenceToken,
  type RendererSurfaceId,
  type SourceGeometryKind,
} from '@globalnews-ai/shared';

import { HUM_PRECISION_MAPPING, type CanonicalPrecision, type HumPrecisionAlias } from './humAxes';

/* ══ 1 · VIEW STATE ════════════════════════════════════════════════════════ */

/**
 * The reader-visible states, and there is no seventh.
 *
 * `LOADING` is presentational and is NEVER derived from a read — it is the state before a read
 * exists. It matters that it is distinct: `readHumanitarianObservations` returns
 * `NOT_ASSESSED` when called in a browser, so a surface that treated "no read yet" as
 * `NOT_ASSESSED` would render "we have not looked" during its own fetch, which is a false
 * statement about the programme rather than about the request.
 */
export const HUM_READ_VIEW_STATES = [
  'LOADING',
  'RETAINED',
  'PARTIAL',
  'NO_RETAINED_EVIDENCE',
  'NOT_ASSESSED',
  'COVERAGE_GAP',
] as const;
export type HumReadViewState = (typeof HUM_READ_VIEW_STATES)[number];

/**
 * Why a retained read is PARTIAL rather than RETAINED. Each reason is a fact about a RECORD —
 * something the publisher did not supply — never an inference about the situation.
 */
export const HUM_PARTIAL_REASONS = [
  'ROW_WITHOUT_COUNTRY_SCOPE',
  'ROW_WITHOUT_SOURCE_REFERENCE',
] as const;
export type HumPartialReason = (typeof HUM_PARTIAL_REASONS)[number];

export interface HumReadView {
  readonly state: HumReadViewState;
  readonly rowCount: number;
  /** Empty unless `state === 'PARTIAL'`. Ordered as declared, deduplicated. */
  readonly partialReasons: readonly HumPartialReason[];
}

/** The state before a read exists. Separate entry point so LOADING can never be derived. */
export function humReadLoadingView(): HumReadView {
  return { state: 'LOADING', rowCount: 0, partialReasons: [] };
}

function partialReasonsFor(record: HumanitarianRetainedRecord): readonly HumPartialReason[] {
  const reasons: HumPartialReason[] = [];
  const claim = record.observation.claim as { readonly countryIso3?: readonly string[] };
  if (claim.countryIso3 === undefined || claim.countryIso3.length === 0) {
    reasons.push('ROW_WITHOUT_COUNTRY_SCOPE');
  }
  const reference = record.observation.sourceReference;
  if (
    (reference.sourceUrl === undefined || reference.sourceUrl.length === 0) &&
    (reference.citation === undefined || reference.citation.length === 0)
  ) {
    reasons.push('ROW_WITHOUT_SOURCE_REFERENCE');
  }
  /*
   * THERE IS DELIBERATELY NO "no publisher time basis" REASON.
   *
   * I wrote one, and it could never fire: HUM-READ-3 refuses a row whose `publisherReleasedAt` is
   * not an ISO timestamp, so every row that reaches a reader carries one by the time this runs.
   * A partial reason that cannot be false is the same vacuous-predicate defect this programme has
   * already paid for twice, so it is removed rather than asserted. Unknown age is still
   * representable — `humFreshnessView` returns `basis: 'NONE'` — but only for a record that has
   * not passed the retained contract, which a reader never sees.
   */
  return reasons;
}

/**
 * Project a read onto a view state.
 *
 * PARTIAL is derived, not invented: the retained contract refuses a malformed or inadmissible row
 * outright ("a read is never silently thinned"), so a RETAINED read is structurally sound by the
 * time it arrives. What it may still lack is a field the PUBLISHER did not supply, and that is
 * what PARTIAL reports — per row, by name.
 */
export function humReadView(read: HumanitarianRetainedRead): HumReadView {
  if (read.kind === 'UNAVAILABLE') {
    /* The lossy projection has already happened upstream; `absence` is one of exactly two. */
    return { state: read.absence, rowCount: 0, partialReasons: [] };
  }
  if (read.kind === 'NO_RETAINED_EVIDENCE') {
    return { state: 'NO_RETAINED_EVIDENCE', rowCount: 0, partialReasons: [] };
  }
  const found: HumPartialReason[] = [];
  for (const record of read.observations) {
    for (const reason of partialReasonsFor(record)) {
      if (!found.includes(reason)) found.push(reason);
    }
  }
  const ordered = HUM_PARTIAL_REASONS.filter((r) => found.includes(r));
  return {
    state: ordered.length === 0 ? 'RETAINED' : 'PARTIAL',
    rowCount: read.observations.length,
    partialReasons: ordered,
  };
}

/**
 * NO view state is an assessment of a humanitarian situation — not even RETAINED, which reports
 * what sources stated and never what is the case. Exported so a caller has something to call
 * instead of inferring one.
 */
export function humReadIsAssessment(_state: HumReadViewState): false {
  return false;
}

/* ══ 2 · GEOGRAPHY — ONLY THE PRECISION A RECORD ACTUALLY ESTABLISHES ══════ */

export interface HumRowGeography {
  readonly countryIso3: readonly string[];
  readonly alias: HumPrecisionAlias;
  readonly canonical: CanonicalPrecision;
  /** True only where `HUM_PRECISION_MAPPING` marks the level producible in this pipeline. */
  readonly renderable: boolean;
}

/**
 * A row scopes geography by ISO3 or not at all — those are the only two outcomes the record
 * supports, so they are the only two this returns. Nothing is widened to a province, narrowed to
 * a city, or turned into a coordinate.
 */
export function humRowGeography(record: HumanitarianRetainedRecord): HumRowGeography {
  const claim = record.observation.claim as { readonly countryIso3?: readonly string[] };
  const codes = claim.countryIso3 ?? [];
  const alias: HumPrecisionAlias = codes.length > 0 ? 'COUNTRY' : 'UNPLACED';
  const mapping = HUM_PRECISION_MAPPING.find((m) => m.alias === alias);
  /* Both of these are producible; the lookup is here so the claim is read from the authority. */
  return {
    countryIso3: Object.freeze([...codes]),
    alias,
    canonical: (mapping?.canonical ?? 'UNKNOWN') as CanonicalPrecision,
    renderable: mapping?.producible === true,
  };
}

/** The precision levels a reader surface may show in R1. Derived from the mapping, not listed. */
export const HUM_RENDERABLE_PRECISION_ALIASES: readonly HumPrecisionAlias[] = Object.freeze(
  (['COUNTRY', 'UNPLACED'] as const).filter(
    (alias) => HUM_PRECISION_MAPPING.find((m) => m.alias === alias)?.producible === true,
  ),
);

/* ══ 3 · MAP — WHAT MAY BE DRAWN, WHICH IN R1 IS NOTHING ══════════════════ */

export const HUM_MAP_REFUSALS = [
  /** The row carries no geometry at all: country scope is not a location. */
  'NO_GEOMETRY_ON_RECORD',
  /** Country scope only. Drawing a marker would place a point the source never established. */
  'COUNTRY_SCOPE_IS_NOT_A_POINT',
  /** The surface does not admit this geometry kind. R1: no reader-facing polygons. */
  'KIND_NOT_ADMITTED_ON_SURFACE',
] as const;
export type HumMapRefusal = (typeof HUM_MAP_REFUSALS)[number];

export interface HumMapOutcome {
  readonly drawn: false;
  /** An existing reader absence token — this module mints no map vocabulary of its own. */
  readonly token: ReaderAbsenceToken;
  readonly refusal: HumMapRefusal;
}

/**
 * ALWAYS REFUSES IN R1, AND THE RETURN TYPE SAYS SO — `drawn` is the literal `false`.
 *
 * This is not a stub. It is the measured consequence of three facts: no humanitarian claim shape
 * carries coordinates; a row referencing governed geometry is refused before it reaches a reader;
 * and the reader surface admits only `NONE` and `POINT`. A function that could return `drawn: true`
 * would be claiming a capability the programme has not granted, and the type is the cheapest place
 * to make that impossible.
 *
 * When the geometry authority permits a reader projection, this signature widens — and every call
 * site is then a compile error until it handles a drawn case, which is the point.
 */
export function humMapOutcome(
  record: HumanitarianRetainedRecord,
  surface: RendererSurfaceId,
): HumMapOutcome {
  const capability = capabilityOfSurface(surface);
  const geography = humRowGeography(record);
  /* Asked of the authority rather than assumed, so a widened surface changes this answer. */
  const admitsAPoint = capability.supports.includes('POINT' as SourceGeometryKind);
  if (geography.countryIso3.length > 0) {
    return {
      drawn: false,
      token: 'NOT_DRAWABLE_HERE',
      refusal: admitsAPoint ? 'COUNTRY_SCOPE_IS_NOT_A_POINT' : 'KIND_NOT_ADMITTED_ON_SURFACE',
    };
  }
  return { drawn: false, token: 'NOT_DRAWABLE_HERE', refusal: 'NO_GEOMETRY_ON_RECORD' };
}

/** Polygons are not admitted on any reader surface in R1. Asserted from the authority. */
export function humSurfaceAdmitsPolygon(surface: RendererSurfaceId): boolean {
  const supports = capabilityOfSurface(surface).supports;
  return (
    supports.includes('POLYGON' as SourceGeometryKind) ||
    supports.includes('MULTIPOLYGON' as SourceGeometryKind)
  );
}

/* ══ 4 · PROVENANCE AND FRESHNESS ═════════════════════════════════════════ */

export interface HumProvenanceView {
  readonly observationKey: string;
  readonly observationKind: string;
  readonly upstreamAuthority: string;
  readonly upstreamId: string;
  readonly sourceUrl: string | null;
  readonly citation: string | null;
  readonly publisherReleasedAt: string;
  readonly retrievedAt: string;
  readonly temporalBasis: string;
  readonly revisionOrdinal: number;
  readonly supersedesRevisionOrdinal: number | null;
  readonly captureKey: string;
}

/** Straight projection. Absent optional fields become `null` and never an empty-string default. */
export function humProvenanceView(record: HumanitarianRetainedRecord): HumProvenanceView {
  const o = record.observation;
  return {
    observationKey: o.observationKey,
    observationKind: o.observationKind,
    upstreamAuthority: o.identity.upstreamAuthority,
    upstreamId: o.identity.upstreamId,
    sourceUrl: o.sourceReference.sourceUrl ?? null,
    citation: o.sourceReference.citation ?? null,
    publisherReleasedAt: record.publisherReleasedAt,
    retrievedAt: o.temporal.retrievedAt,
    temporalBasis: o.temporal.temporalBasis,
    revisionOrdinal: o.revision.revisionOrdinal,
    supersedesRevisionOrdinal: o.revision.supersedesRevisionOrdinal,
    captureKey: record.captureKey,
  };
}

/**
 * A DISPLAY BOUND, NOT AN ASSESSMENT. Past this age a retained row is marked as old so a reader is
 * not shown month-old reporting as though it were current. It says nothing about whether the
 * situation changed — only that our newest retained record for it is this old.
 */
export const HUM_RETAINED_DISPLAY_STALE_AFTER_DAYS = 14;

export interface HumFreshnessView {
  /** Days since the publisher released the row, or null when it carries no publisher basis. */
  readonly ageDays: number | null;
  readonly basis: 'PUBLISHER_RELEASED' | 'PUBLISHER_VINTAGE' | 'OCCURRED' | 'NONE';
  readonly old: boolean;
}

export function humFreshnessView(
  record: HumanitarianRetainedRecord,
  now: string,
): HumFreshnessView {
  const temporal = record.observation.temporal;
  const candidates: readonly [HumFreshnessView['basis'], string | undefined][] = [
    ['PUBLISHER_RELEASED', record.publisherReleasedAt],
    ['PUBLISHER_VINTAGE', temporal.publisherVintage],
    ['OCCURRED', temporal.occurredAt],
  ];
  const nowMs = Date.parse(now);
  for (const [basis, value] of candidates) {
    if (value === undefined || value.length === 0) continue;
    const ms = Date.parse(value);
    if (Number.isNaN(ms) || Number.isNaN(nowMs)) continue;
    const ageDays = Math.floor((nowMs - ms) / 86_400_000);
    return { ageDays, basis, old: ageDays > HUM_RETAINED_DISPLAY_STALE_AFTER_DAYS };
  }
  /*
   * Unknown age: NOT zero and not "fresh". Unreachable for a row that came through
   * `humanitarianRetainedRead` (HUM-READ-3 guarantees a parseable `publisherReleasedAt`); kept
   * because this function is exported and may be handed a record that has not passed it.
   */
  return { ageDays: null, basis: 'NONE', old: false };
}

/**
 * The newest publisher release across retained rows, as the record states it — never "now", never
 * `retrievedAt` (our clock), and `null` when there are no rows. This is what replaces a freshness
 * slot hard-coded to "no data": with rows present, that slot was simply wrong.
 */
export function humNewestRelease(read: HumanitarianRetainedRead): string | null {
  if (read.kind !== 'RETAINED' || read.observations.length === 0) return null;
  let newest: string | null = null;
  let newestMs = Number.NEGATIVE_INFINITY;
  for (const record of read.observations) {
    const ms = Date.parse(record.publisherReleasedAt);
    if (Number.isNaN(ms)) continue;
    if (ms > newestMs) {
      newestMs = ms;
      newest = record.publisherReleasedAt;
    }
  }
  return newest;
}

/** Highest revision ordinal across retained rows, or null. A count of revisions, not a score. */
export function humMaxRevisionOrdinal(read: HumanitarianRetainedRead): number | null {
  if (read.kind !== 'RETAINED' || read.observations.length === 0) return null;
  let max: number | null = null;
  for (const record of read.observations) {
    const ordinal = record.observation.revision.revisionOrdinal;
    if (max === null || ordinal > max) max = ordinal;
  }
  return max;
}

/* ══ 5 · FIGURES — ONLY AS THE SOURCE STATED THEM ═════════════════════════ */

export interface HumFigureView {
  readonly measure: string;
  readonly value: number | string;
  readonly unit: string | null;
  readonly basis: string;
  readonly sourceBasisStatement: string;
  readonly aboutEventKey: string;
}

/**
 * One figure per impact-assertion row, carried verbatim with its basis.
 *
 * NOTHING IS COMBINED. There is no sum, mean, max or count-of-people here and there must not be:
 * two publishers' figures for one event are two source assertions, and adding them would mint a
 * number no source stated. Contradictory figures therefore both survive, side by side, which is
 * what the "contradictory impact figures" case requires.
 */
export function humFigureViews(read: HumanitarianRetainedRead): readonly HumFigureView[] {
  if (read.kind !== 'RETAINED') return [];
  const out: HumFigureView[] = [];
  for (const record of read.observations) {
    const claim = record.observation.claim as {
      readonly claimType: string;
      readonly measure?: string;
      readonly value?: number | string;
      readonly unit?: string;
      readonly basis?: string;
      readonly sourceBasisStatement?: string;
      readonly aboutEventKey?: string;
    };
    if (claim.claimType !== 'HUMANITARIAN_IMPACT_ASSERTION') continue;
    out.push({
      measure: claim.measure ?? '',
      value: claim.value ?? '',
      unit: claim.unit ?? null,
      basis: claim.basis ?? '',
      sourceBasisStatement: claim.sourceBasisStatement ?? '',
      aboutEventKey: claim.aboutEventKey ?? '',
    });
  }
  return Object.freeze(out);
}

/* ══ 6 · ASK LAUNCHER — ARMED, NEVER FIRED ════════════════════════════════ */

/**
 * The launcher context, as DATA. Pressing the button is the caller's job and the canonical Ask V2
 * turn is Ask's job; this module holds no execution path, which is why "zero compute until
 * pressed" is a property of the code rather than a promise about it. A test asserts this file
 * imports no API client and contains no `fetch`.
 */
export interface HumAskLaunch {
  /** False when there is nothing admitted to ask about — the button must not be offered. */
  readonly offered: boolean;
  readonly state: HumReadViewState;
  readonly rowCount: number;
  /** Stable identifiers only; no prose, no question text, no model instruction. */
  readonly observationKeys: readonly string[];
  readonly countryIso3: readonly string[];
}

export function humAskLaunch(read: HumanitarianRetainedRead): HumAskLaunch {
  const view = humReadView(read);
  if (read.kind !== 'RETAINED') {
    return {
      offered: false,
      state: view.state,
      rowCount: 0,
      observationKeys: Object.freeze([]),
      countryIso3: Object.freeze([]),
    };
  }
  const keys: string[] = [];
  const codes: string[] = [];
  for (const record of read.observations) {
    keys.push(record.observation.observationKey);
    for (const code of humRowGeography(record).countryIso3) {
      if (!codes.includes(code)) codes.push(code);
    }
  }
  return {
    offered: true,
    state: view.state,
    rowCount: read.observations.length,
    observationKeys: Object.freeze(keys),
    countryIso3: Object.freeze(codes.sort()),
  };
}

/* ══ 7 · PHONE AND DESKTOP DENSITY ════════════════════════════════════════ */

export interface HumDensityContract {
  readonly width: number;
  /** Provenance chips a card may show before it is too dense to read. */
  readonly provenanceChips: number;
  /** Rows rendered before the list defers the rest behind an explicit control. */
  readonly rowsBeforeDefer: number;
  readonly singleColumn: boolean;
}

/**
 * 360 is the narrowest width this programme has been asked to support; prior accepted work pinned
 * 430/428/390/375, so 360 is new here and is the binding case. The chip budget shrinks with width
 * rather than the font, because provenance that has to be zoomed to read is provenance a reader
 * will not check.
 */
export const HUM_DENSITY_CONTRACTS: readonly HumDensityContract[] = Object.freeze([
  Object.freeze({ width: 360, provenanceChips: 2, rowsBeforeDefer: 3, singleColumn: true }),
  Object.freeze({ width: 390, provenanceChips: 3, rowsBeforeDefer: 4, singleColumn: true }),
  Object.freeze({ width: 430, provenanceChips: 3, rowsBeforeDefer: 5, singleColumn: true }),
  Object.freeze({ width: 1024, provenanceChips: 5, rowsBeforeDefer: 10, singleColumn: false }),
]);

/** Widest contract not exceeding the viewport; the narrowest contract is the floor. */
export function humDensityFor(width: number): HumDensityContract {
  let chosen = HUM_DENSITY_CONTRACTS[0] as HumDensityContract;
  for (const contract of HUM_DENSITY_CONTRACTS) {
    if (width >= contract.width) chosen = contract;
  }
  return chosen;
}

/** Re-exported so a caller reads the token set from one place. */
export const HUM_MAP_TOKENS: readonly ReaderAbsenceToken[] = READER_ABSENCE_TOKENS;
