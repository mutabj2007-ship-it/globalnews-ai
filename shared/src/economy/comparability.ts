import type {
  EconomyCadence,
  EconomyCategory,
  EconomyFigureGapReason,
  EconomyObservation,
  EconomySeries,
} from './index';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CONVERSATIONAL INTELLIGENCE JOURNEY R3 §10, §11, §27, §31 — SERIES COMPARABILITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * "Compare economic growth in Rwanda, Kenya and Tanzania" may only become a table when the
 * numbers measure the SAME thing. GDP growth alone has at least five independent axes that
 * silently change its meaning: nominal vs real, annual vs quarterly, QoQ vs YoY, seasonally
 * adjusted vs not, aggregate vs per capita. Two series that differ on any declared axis are
 * NOT DIRECTLY COMPARABLE, and an axis that is not declared is UNKNOWN — never assumed equal.
 *
 * This module adds the definition the Series spine lacks (as a separate record keyed by
 * seriesId, so the accepted Economy contract is not edited) and two pure functions:
 *
 *   assessComparability   → COMPARABLE | NOT_DIRECTLY_COMPARABLE (with the differing axes)
 *                           | UNDETERMINED (with the undeclared axes)
 *   projectIndicatorTable → a country × indicator table from governed observations only:
 *                           every cell is an observation with provenance or a GAP with a reason;
 *                           an incomparable row is OMITTED and the omission disclosed. Never a
 *                           zero, never a normalised value, never a model figure.
 *
 * Nothing here retrieves, converts, rebases or normalises. Pure and total.
 */

export type MeasureBasis = 'NOMINAL' | 'REAL';
export type Transformation =
  | 'LEVEL'
  | 'PERCENT_CHANGE_YOY'
  | 'PERCENT_CHANGE_QOQ'
  | 'PERCENT_CHANGE_QOQ_ANNUALISED'
  | 'PERCENT_OF_GDP'
  | 'INDEX';
export type Adjustment = 'SEASONALLY_ADJUSTED' | 'NOT_SEASONALLY_ADJUSTED';
export type MeasureScope = 'AGGREGATE' | 'PER_CAPITA';

/** What a series MEASURES — declared by its publisher's definition, never inferred from a label. */
export interface SeriesDefinition {
  readonly seriesId: string;
  readonly indicatorId: string;
  readonly basis?: MeasureBasis;
  readonly transformation?: Transformation;
  readonly adjustment?: Adjustment;
  readonly scope?: MeasureScope;
  /** The publisher's own definition text (cited, never paraphrased into a different measure). */
  readonly definitionText?: string;
  readonly publisher: string;
}

export type ComparabilityAxis =
  | 'category'
  | 'indicator'
  | 'basis'
  | 'transformation'
  | 'adjustment'
  | 'scope'
  | 'cadence'
  | 'unit'
  | 'period';

export type Comparability =
  | { readonly verdict: 'COMPARABLE' }
  | {
      readonly verdict: 'NOT_DIRECTLY_COMPARABLE';
      readonly differing: readonly ComparabilityAxis[];
    }
  | { readonly verdict: 'UNDETERMINED'; readonly undeclared: readonly ComparabilityAxis[] };

export interface ComparableSide {
  readonly series: EconomySeries;
  readonly definition: SeriesDefinition | undefined;
  readonly observation: EconomyObservation | undefined;
}

const DEFINITION_AXES = ['basis', 'transformation', 'adjustment', 'scope'] as const;

/** Whether these sides measure the same thing for the same period. Undeclared is never "equal". */
export function assessComparability(sides: readonly ComparableSide[]): Comparability {
  if (sides.length < 2) return { verdict: 'COMPARABLE' };
  const differing = new Set<ComparabilityAxis>();
  const undeclared = new Set<ComparabilityAxis>();
  const same = <T>(axis: ComparabilityAxis, values: readonly (T | undefined)[]) => {
    if (values.some((v) => v === undefined)) undeclared.add(axis);
    else if (new Set(values).size > 1) differing.add(axis);
  };
  same<EconomyCategory>(
    'category',
    sides.map((s) => s.series.category),
  );
  same<string>(
    'indicator',
    sides.map((s) => s.definition?.indicatorId),
  );
  for (const axis of DEFINITION_AXES)
    same<string>(
      axis,
      sides.map((s) => s.definition?.[axis]),
    );
  same<EconomyCadence>(
    'cadence',
    sides.map((s) => s.series.cadence),
  );
  same<string>(
    'unit',
    sides.map((s) => s.observation?.unit ?? s.series.unit),
  );
  same<string>(
    'period',
    sides.map((s) => s.observation?.periodId),
  );
  if (differing.size > 0) return { verdict: 'NOT_DIRECTLY_COMPARABLE', differing: [...differing] };
  if (undeclared.size > 0) return { verdict: 'UNDETERMINED', undeclared: [...undeclared] };
  return { verdict: 'COMPARABLE' };
}

export type IndicatorCell =
  | { readonly kind: 'OBSERVATION'; readonly observation: EconomyObservation }
  | {
      readonly kind: 'GAP';
      readonly reason: EconomyFigureGapReason | 'NO_GOVERNED_SERIES' | 'NO_OBSERVATION_RETAINED';
    };

export interface IndicatorRow {
  readonly indicatorId: string;
  readonly label: string;
  /** Keyed by ISO2, in the requested country order. */
  readonly cells: Readonly<Record<string, IndicatorCell>>;
}

export interface IndicatorTable {
  readonly countries: readonly string[];
  readonly rows: readonly IndicatorRow[];
  /** Rows not shown, each with why (never silently dropped, never zero-filled). */
  readonly omitted: readonly {
    readonly indicatorId: string;
    readonly label: string;
    readonly comparability: Exclude<Comparability, { verdict: 'COMPARABLE' }> | null;
    readonly reason: 'NOT_DIRECTLY_COMPARABLE' | 'UNDETERMINED' | 'NO_OBSERVATIONS';
  }[];
}

export interface IndicatorRequest {
  readonly indicatorId: string;
  readonly label: string;
  /** One governed side per requested country (absent = no governed series for it). */
  readonly sides: Readonly<Record<string, ComparableSide | undefined>>;
}

/**
 * The table a comparison may show: only rows whose present sides are COMPARABLE and that hold
 * at least one observation. A missing country is a GAP cell; an incomparable or undetermined
 * row is omitted and disclosed.
 */
export function projectIndicatorTable(
  countries: readonly string[],
  requests: readonly IndicatorRequest[],
): IndicatorTable {
  const rows: IndicatorRow[] = [];
  const omitted: IndicatorTable['omitted'][number][] = [];
  for (const request of requests) {
    const present = countries
      .map((c) => request.sides[c])
      .filter((s): s is ComparableSide => s !== undefined);
    if (present.every((s) => s.observation === undefined)) {
      omitted.push({
        indicatorId: request.indicatorId,
        label: request.label,
        comparability: null,
        reason: 'NO_OBSERVATIONS',
      });
      continue;
    }
    const comparability = assessComparability(present.filter((s) => s.observation !== undefined));
    if (comparability.verdict !== 'COMPARABLE') {
      omitted.push({
        indicatorId: request.indicatorId,
        label: request.label,
        comparability,
        reason: comparability.verdict,
      });
      continue;
    }
    const cells: Record<string, IndicatorCell> = {};
    for (const country of countries) {
      const side = request.sides[country];
      cells[country] =
        side === undefined
          ? { kind: 'GAP', reason: 'NO_GOVERNED_SERIES' }
          : side.observation === undefined
            ? { kind: 'GAP', reason: 'NO_OBSERVATION_RETAINED' }
            : { kind: 'OBSERVATION', observation: side.observation };
    }
    rows.push({ indicatorId: request.indicatorId, label: request.label, cells });
  }
  return { countries: [...countries], rows, omitted };
}
