import type { ChangeState } from '@/lib/observation/changeState';
import type { SeriesDisclosure } from '@/lib/energy/energyDisclosure';
import type {
  EnergyAssetRole,
  EnergyCanonicalAbsence,
  EnergyCorridorRole,
  EnergyCrossDomain,
  EnergyCrossDomainState,
  EnergyDataTier,
  EnergyEvidenceRole,
  EnergyGateId,
  EnergyPrecision,
  EnergyReaderState,
  EnergySourceClass,
  EnergySpatialKind,
  EnergySubjectType,
  EnergyZone,
} from '@/lib/energy/energyFrame';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART XI ENERGY — THE READER-SIDE SHAPES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THESE ARE NOT CANONICAL TYPES AND DO NOT PRETEND TO BE.
 *
 * `DomainObservation<EnergyClaim>`, `spatial/precision` and the shared absence
 * union are Main's, and all three are PROPOSED/UNLANDED (DEPENDENCY-MATRIX rows
 * 2, 4, 16). Authoring a competing version here is exactly the duplication the
 * reconciliation exists to prevent. What follows is the shape the FRAME renders
 * — a view model — and the mapping from canonical to reader runs one way, into
 * it, when the canonical contracts land.
 *
 * ── THE PROPERTIES THAT ARE ENFORCED BY THE TYPES, NOT BY CARE ────────────
 *
 * 1. `precision` is REQUIRED on every geometry. "A geometry without a precision
 *    statement must not render" — so there is no geometry shape without one.
 * 2. `geometry` is absent, not nullable-and-ignored: when it is `null` the
 *    record MUST say which gate withheld it. The two fields are one union.
 * 3. A system scope HAS NO GEOMETRY FIELD TO POPULATE. `kind: 'systemScope'`
 *    admits no coordinates, so no renderer can centre on one.
 * 4. Every subject carries BOTH a reader state and, where one exists, the
 *    canonical member — so NOT_CONNECTED can never be read as COVERAGE GAP.
 */

/**
 * The scope column's vocabulary. Tokens, so the column can be localized — see
 * `EnergyChangeRow.scope`.
 */
export const ENERGY_SCOPE_TOKENS = [
  'CORRIDOR',
  'INTERCONNECTOR',
  'SUPPLY_SITUATION',
  'ASSET',
  'GENERATION',
  'INFRASTRUCTURE',
  'GRID_SITUATION',
  'HISTORICAL',
] as const;
export type EnergyScopeToken = (typeof ENERGY_SCOPE_TOKENS)[number];

/** The tone keys the frozen palette allows. There is no green outside `mint`. */
export type EnergyTone = 'cyan' | 'mint' | 'amber' | 'red' | 'violet' | 'sand' | 'achromatic';

/* ── GEOMETRY ───────────────────────────────────────────────────────────── */

/** A drawn line: a maritime corridor, a pipeline route, an interconnector. */
export interface EnergyLineGeometry {
  readonly kind: 'line';
  /** [lon, lat] pairs. Public reference cartography only. */
  readonly path: readonly (readonly [number, number])[];
  readonly precision: EnergyPrecision;
}

/** A region a derived situation is scoped to. Orientation, never asset precision. */
export interface EnergyRegionGeometry {
  readonly kind: 'region';
  /** [west, north, east, south] — a frame, not a point. */
  readonly bbox: readonly [number, number, number, number];
  readonly precision: 'REGION_LEVEL';
}

/**
 * A system scope: a grid situation, a bidding zone, a derived regional supply
 * situation. IT CARRIES NO COORDINATES OF ANY KIND, and that absence is the
 * whole ruling: "No point geometry is fabricated from a system scope."
 *
 * A bidding zone additionally MAY NOT CARRY AN ISO3 CODE — its borders are
 * neither administrative nor physical and several span countries — so there is
 * no country field here either.
 */
export interface EnergySystemScope {
  readonly kind: 'systemScope';
  readonly precision: 'REGION_LEVEL';
}

export type EnergyGeometry = EnergyLineGeometry | EnergyRegionGeometry | EnergySystemScope;

export function geometryKind(geometry: EnergyGeometry): EnergySpatialKind {
  return geometry.kind;
}

/* ── EVIDENCE ───────────────────────────────────────────────────────────── */

export interface EnergyEvidenceArtifact {
  readonly id: string;
  readonly sourceClass: EnergySourceClass;
  readonly role: EnergyEvidenceRole;
  /** Source language, preserved; "AR → EN" when a translation is displayed. */
  readonly language: string;
  readonly title: string;
  /** Observed time as the record carries it. Never re-derived. */
  readonly observedAt: string | null;
  /**
   * R2 — TWO AXES, NOT A TIER FLAG.
   *
   * R1 carried `unavailableTier: EnergyDataTier | null`, a single field from
   * which availability was read. §B names exactly what that costs: *"The day
   * rights flips, a single boolean flips and the series renders. NOBODY WILL
   * HAVE DECIDED ANYTHING."*
   *
   * `SeriesDisclosure` carries rights and exposure as independent dispositions,
   * both floored at their most ignorant member, and `readerAvailability` takes
   * the WHOLE record. There is no `isAvailable(rights)` and no optional second
   * parameter, so availability cannot be computed from rights alone — *"not
   * because it is forbidden, but because no function exists that would let it."*
   *
   * `null` means this artifact is not a governed series at all.
   */
  readonly disclosure: SeriesDisclosure | null;
}

/* ── CROSS-DOMAIN ───────────────────────────────────────────────────────── */

export interface EnergyCrossDomainReference {
  readonly domain: EnergyCrossDomain;
  readonly state: EnergyCrossDomainState;
  /** Present only for a stored summary. A reference that found nothing has no text to show. */
  readonly summary: string | null;
}

/* ── TIMELINE ───────────────────────────────────────────────────────────── */

export interface EnergyTimelineEntry {
  readonly at: string;
  /**
   * R2 — THE TWO-AXIS CHANGE STATE, NOT A WORD.
   *
   * M01 is RESOLVED. A change state is a record of two required fields, and
   * this field now holds the record rather than an English phrase:
   *
   *   service   the observable condition moved, and to what
   *   cause     what we know about WHY
   *
   * Storing the pair as one string was the defect — it made a two-dimensional
   * fact one-dimensional and then asked a translator to fit the collapse into a
   * budget sized for one dimension. Labels are resolved per locale at render;
   * no English string is authority here any more.
   */
  readonly changeState: ChangeState | null;
  readonly text: string;
  readonly tone: EnergyTone;
}

/* ── SUBJECTS ───────────────────────────────────────────────────────────── */

export interface EnergySubject {
  readonly id: string;
  readonly type: EnergySubjectType;
  /** Chokepoint is a ROLE on a corridor — M04. Never a type. */
  readonly corridorRole: EnergyCorridorRole | null;
  readonly assetRole: EnergyAssetRole | null;

  readonly name: string;
  readonly scopeLabel: string;

  /**
   * One of the four reader states, or `null` when an ASSESSMENT IS PRESENT.
   *
   * The four states are a closed set of ABSENCES, and NO MATERIAL CHANGE is the
   * one among them that is a result rather than a gap. A subject whose
   * assessment is currently moving is in none of them — it is assessed — so the
   * honest value is null rather than a fifth member invented to fill the field.
   * A subject is never silent either way: `null` here means `changeState` and
   * `assessment` carry the statement instead.
   */
  readonly readerState: EnergyReaderState | null;
  /** The canonical member, carried so the distinction survives into telemetry. */
  readonly canonicalAbsence: EnergyCanonicalAbsence | null;
  /** The two-axis change state. Null where the subject carries no change event. */
  readonly changeState: ChangeState | null;
  readonly tone: EnergyTone;

  /**
   * The drawn geometry, or `null` WITH the gate that withheld it. A subject may
   * not be geometry-less and silent: if `geometry` is null, `geometryWithheldBy`
   * says which review owns the decision.
   */
  readonly geometry: EnergyGeometry | null;
  readonly geometryWithheldBy: EnergyGateId | null;

  readonly dataTier: EnergyDataTier;
  /** How many artifacts were actually reviewed. 0 forbids NO MATERIAL CHANGE. */
  readonly artifactsReviewed: number;
  readonly lastChecked: string | null;
  readonly nextCheck: string | null;

  readonly brief: string | null;
  readonly headline: string | null;
  readonly assessment: string | null;
  readonly uncertainty: string | null;
  readonly confidence: string | null;
  readonly revisions: string | null;

  /*
    R2 — THE MONITOR-NEXT SURFACE IS NOT IN THIS SHAPE, AND THAT IS THE POINT.

    R1 modelled it and rendered a withheld placeholder. Main's R2 delta is
    explicit: *"Do not build it. DO NOT BUILD IT BEHIND A FLAG EITHER — a flag
    is a decision to build it and defer the switch. Withhold it; do not show a
    placeholder. A 'coming soon' slot for the monitor-next surface TELLS A
    READER THE RANKING EXISTS, which is most of what the hold protects."*

    So the fields are gone rather than emptied. A field is a place somebody
    fills; an absent field is not.

    E04's reasoning, for the record: *a ranked list of what a reader should
    watch is a ranked list of what is under-observed*, and its most informative
    terms are our own coverage metadata — evidence count, last-checked age,
    coverage-gap status. No register contains that and no adversary can obtain
    it elsewhere.
  */

  readonly affectedSystems: readonly { readonly label: string; readonly meta: string; readonly tone: EnergyTone }[];
  readonly fields: readonly { readonly key: string; readonly value: string }[];
  readonly timeline: readonly EnergyTimelineEntry[];
  readonly evidence: readonly EnergyEvidenceArtifact[];
  readonly crossDomain: readonly EnergyCrossDomainReference[];

  /*
    R2 — NO WATCH GATE FIELD. E1's §C clears Watch on situations, corridors,
    grid situations AND SINGLE ASSETS; only a COMPOSITE REGIONAL watch is held,
    and that capability is not built at all, so there is nothing for a per-
    subject gate to express.

    Its absence also carries the second binding condition: *"watchability is
    declared, not earned … if an asset becomes watchable only once something is
    happening to it, 'watchable' is itself the disclosure."* With no per-subject
    gate there is nothing that could vary with what is happening to a subject.
  */
  readonly watched: boolean;
}

/* ── THE CHANGE GRID ────────────────────────────────────────────────────── */

/**
 * ══ R3 · `row.meta` IS STRUCTURED, BECAUSE ONE OF ITS PARTS IS A NUMBER ════
 *
 * It was a single string through R2, and a single string is exactly what
 * cannot be protected: `text-overflow: ellipsis` clips the logical end, the
 * logical end is where the evidence count lives, and **a clipped numeral is not
 * a shortened value — it is a different valid value.** `22 przejrzane` clipped
 * to `2…` reads as *two*. Nothing in the rendering says a digit is missing, so
 * the reader is shown a true-looking figure that is false.
 *
 * L's ruling 2 settles it: the overflow *"is a data-cardinality problem, and no
 * Polish string can close it."* The presentation rule needs the parts, so the
 * model carries the parts. **No geometry changes** — 236 / 118 / 190 / 190 and
 * the 60px row are exactly as the frozen file specifies.
 */
export type EnergyMetaCountedNoun = 'EVIDENCE' | 'REVIEWED';

export type EnergyRowMeta =
  /**
   * A row whose metadata is evidenced: when it was last checked, and how much
   * was counted. Two elements on one line, never wrapped; the recency may
   * ellipsize and the count may not.
   */
  | {
      readonly kind: 'EVIDENCED';
      /**
       * HOURS, at every magnitude, including 168 for a week. The unit and any
       * day-form belong to the locale (`metaRecencyDayUnit`), never to the data
       * — which is how EN keeps the design's own `checked 1d` while PL renders
       * L's delivered `sprawdzono 24 h`.
       */
      readonly checkedHours: number;
      readonly count: number;
      readonly counted: EnergyMetaCountedNoun;
    }
  /**
   * A row whose metadata is a governed statement rather than a measurement —
   * the three absence rows. It carries NO recency and NO count, so it has
   * nothing to segment: it renders as one element that does not shrink and does
   * not ellipsize, because clipping `no available record` would remove the
   * record-ness and clipping `0 qualifying sources` would clip a numeral.
   *
   * KNOWN AND REPORTED, NOT FIXED HERE: these three are not localized. They are
   * the design's own transcribed values and they render in English in the
   * Polish grid. The R3 order scopes `row.meta` to *recency and evidence count*;
   * authoring Polish for a governed absence phrase is L's lane, not H's, so it
   * is measured and handed over rather than invented. See the R3 README.
   */
  | { readonly kind: 'STATEMENT'; readonly statement: string };

export interface EnergyChangeRow {
  readonly subjectId: string | null;
  readonly subject: string;
  /**
   * R2 — A TOKEN, LOCALIZED AT RENDER. It was an English string in R1, which
   * meant the Polish change grid rendered English in the one column L measured
   * as having ZERO headroom in English. `SUPPLY SITUATION` is exactly 16
   * characters against a 16-character budget, and L's faithful Polish forms
   * (`SYTUACJA DOSTAW`, `SYTUACJA SIECI`) only exist if the column is
   * localizable at all.
   */
  readonly scope: EnergyScopeToken;
  /** Null when the row carries an assessment; see `EnergySubject.readerState`. */
  readonly readerState: EnergyReaderState | null;
  readonly canonicalAbsence: EnergyCanonicalAbsence | null;
  readonly changeState: ChangeState | null;
  readonly tone: EnergyTone;
  readonly meta: EnergyRowMeta;
  /** Column index -> tone. An empty map is a row with no assessment events, which is legible. */
  readonly bands: Readonly<Record<number, EnergyTone>>;
}

/* ── THE FLOW SUBSTRATE ─────────────────────────────────────────────────── */

/**
 * A Sankey link. `share` is SHARE OF ASSESSED SUPPLY — `ene:PCT`, a RATIO —
 * and never a flow rate. H03 requires the semantics to be explicit, and the
 * field name plus the unit are how they are made explicit rather than captioned.
 */
export interface EnergyFlowLink {
  readonly from: string;
  readonly to: string;
  readonly sharePct: number | null;
  readonly tone: EnergyTone;
  /** Two axes. See `EnergyEvidenceArtifact.disclosure`. */
  readonly disclosure: SeriesDisclosure | null;
}

export interface EnergyFlowNode {
  readonly id: string;
  readonly label: string;
  readonly column: number;
  readonly tone: EnergyTone;
}

export interface EnergyDependenceRow {
  readonly scopeLabel: string;
  readonly source: string;
  /** Null renders the absent marker, never a zero. */
  readonly sharePct: number | null;
  readonly readerState: EnergyReaderState | null;
  readonly note: string;
  readonly tone: EnergyTone;
}

export interface EnergyStorageRow {
  readonly scopeLabel: string;
  /** `ene:PCT`. Null renders the absent marker. */
  readonly levelPct: number | null;
  readonly readerState: EnergyReaderState | null;
  readonly meta: string;
  readonly tone: EnergyTone;
}

/* ── THE FEED ───────────────────────────────────────────────────────────── */

export interface EnergyFeedItem {
  readonly subjectId: string | null;
  /** Null when the item carries an assessment; see `EnergySubject.readerState`. */
  readonly readerState: EnergyReaderState | null;
  readonly canonicalAbsence: EnergyCanonicalAbsence | null;
  readonly changeState: ChangeState | null;
  readonly tone: EnergyTone;
  readonly ago: string;
  readonly title: string;
  readonly scopeLabel: string;
  readonly evidenceLabel: string;
  readonly evidenceTone: EnergyTone;
}

/* ── THE WHOLE FRAME ────────────────────────────────────────────────────── */

/**
 * ONE ZONE'S STATE, WHEN IT HAS NOTHING TO SHOW.
 *
 * ZONE-TO-DATA gives every zone a missing-data rule that RENDERS, so "no zone
 * requires a value to exist". This is that rule as data: the reader state, the
 * canonical member where one exists, and the gate that owns the decision. A
 * zone with an entry here renders its absence; a zone with no entry has content.
 */
export interface EnergyZoneState {
  readonly readerState: EnergyReaderState;
  readonly canonicalAbsence: EnergyCanonicalAbsence | null;
  /** Which review owns this absence. Null means "no data exists", not "nobody asked". */
  readonly gate: EnergyGateId | null;
  /** The sentence that says WHY there is nothing. Never optional. */
  readonly whyKey: 'stateWhy' | 'gate';
}

export interface EnergyFrameData {
  readonly retainedRead?: import('@globalnews-ai/shared').EnergyReadResult;
  /** Which data set this is. The banner is derived from it and cannot be suppressed. */
  readonly source: 'governed' | 'design-fixture';
  /** True only when a per-reader visit checkpoint exists. M05 — it does not. */
  readonly hasVisitCheckpoint: boolean;
  readonly subjects: readonly EnergySubject[];
  readonly feed: readonly EnergyFeedItem[];
  readonly changeRows: readonly EnergyChangeRow[];
  readonly flowNodes: readonly EnergyFlowNode[];
  readonly flowLinks: readonly EnergyFlowLink[];
  readonly dependence: readonly EnergyDependenceRow[];
  readonly storage: readonly EnergyStorageRow[];
  /** Corridors and routes that may be drawn. Asset-level geometry is E01's. */
  readonly spatialGeometry: readonly { readonly id: string; readonly geometry: EnergyLineGeometry; readonly tone: EnergyTone }[];
  /** Subjects that exist but whose geometry is withheld. They stay reachable. */
  readonly withheldGeometry: readonly { readonly id: string; readonly name: string; readonly gate: EnergyGateId }[];
  readonly changeAxis: readonly string[];
  readonly watchCount: number;
  /**
   * Per-zone absence. A zone listed here has nothing to show AND says why.
   * The map is partial by design: a zone with content is simply absent from it.
   */
  readonly zones: Readonly<Partial<Record<EnergyZone, EnergyZoneState>>>;
}

export function findSubject(data: EnergyFrameData, id: string | null): EnergySubject | null {
  if (id === null) return null;
  return data.subjects.find((subject) => subject.id === id) ?? null;
}
