import type { EconomyCategory, EconomyFigureGapReason, EconomyFreshness } from '@globalnews-ai/shared';

import type { EconomyProducedCell } from './eurostat-economy.producer';
import { ALPHA_SERIES, alphaSeries } from './eurostat-economy.series';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE INTERNAL READ SHAPE — WHAT THE INDICATOR STRIP CONSUMES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The exact shape Claude Code / H bind to. It is a PROJECTION of what the producer
 * already holds, computed here once, so no renderer has to decide what a missing figure
 * means — and so no renderer can decide differently from another one.
 *
 * ── FOUR THINGS IT DELIBERATELY DOES NOT CARRY ────────────────────────────
 *
 * 1. NO FORMATTED STRING. `value` is a number and `unit` is a code. Formatting is
 *    locale-dependent and this is not the locale layer; a pre-formatted "3,5 %" here
 *    would arrive in the English surface too.
 * 2. NO CHANGE ARROW, AND NO CHANGE AT ALL BY DEFAULT. `change` is present only when two
 *    observations of the SAME series and the SAME vintage basis exist. One observation
 *    has no direction, and `UNKNOWN` is the honest answer rather than a flat zero.
 * 3. NO PROSE. `gapReason` and `detail` are codes. The sentence a reader sees is the
 *    frontend's, in both its languages.
 * 4. NO SOURCE URL AS IDENTITY. `provenance` carries the dataset code and the pinned
 *    tuple, because one URL returns many series and a URL cannot say which one this is.
 */

export type EconomyChangeDirection = 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN';

export interface EconomyIndicatorProvenance {
  readonly providerId: string;
  readonly institution: string;
  /** The publisher's dataset code, verbatim — the identity a reader can act on. */
  readonly datasetCode: string;
  /** The pinned tuple, publisher spellings. Rendered in the source-disclosure panel. */
  readonly dimensions: readonly { readonly key: string; readonly value: string }[];
  /** Present only when the bytes behind this figure are retained and provable. */
  readonly snapshotSha256?: string;
  readonly parserId?: string;
  readonly parserVersion?: string;
  /** Retained so a human can follow it. NEVER the identity. */
  readonly sourceUrl?: string;
}

export interface EconomyIndicatorCell {
  readonly seriesId: string;
  readonly label: string;
  readonly category: EconomyCategory;
  readonly economyIso2: string;

  /** Present only for an OBSERVATION cell. A gap has no value, not a zero. */
  readonly value?: number;
  readonly unit: string;
  /** The period the figure is ABOUT — never the date it was fetched. */
  readonly periodId?: string;
  /** The observation frequency. A surface must not print this as a release schedule. */
  readonly frequency: 'M' | 'Q' | 'A';
  /** The publisher's stated adjustment, or NOT_DECLARED. Shown in source disclosure. */
  readonly adjustment: string;

  /**
   * UNDETERMINED whenever the publisher states no cadence — which, for Eurostat, is
   * every row. A surface must render "as at <period>" and NOT "updated monthly".
   */
  readonly freshness: EconomyFreshness;
  /** True when the figure may be shown at all. False means render the gap. */
  readonly available: boolean;
  readonly gapReason?: EconomyFigureGapReason;
  /** Operator-facing classified code. Never rendered to a reader verbatim. */
  readonly detail?: string;

  readonly change: EconomyChangeDirection;
  readonly provenance: EconomyIndicatorProvenance;
  /** Labels a surface must never apply to this row. Carried so the UI cannot drift. */
  readonly mustNotBeLabelled: readonly string[];
}

export function toIndicatorCell(cell: EconomyProducedCell): EconomyIndicatorCell {
  const declaration = alphaSeries(
    cell.kind === 'GAP' ? cell.seriesId : cell.observation.seriesId,
  );
  const base = {
    seriesId: declaration.seriesId,
    label: declaration.label,
    category: declaration.category,
    economyIso2: declaration.economyIso2,
    unit: declaration.unit,
    frequency: declaration.frequency,
    adjustment: declaration.adjustment,
    /* Frequency is not cadence, and no row declares one. */
    freshness: 'UNDETERMINED' as EconomyFreshness,
    change: 'UNKNOWN' as EconomyChangeDirection,
    mustNotBeLabelled: declaration.mustNotBeLabelled ?? [],
  };

  if (cell.kind === 'GAP') {
    return {
      ...base,
      available: false,
      gapReason: cell.reason,
      detail: cell.detail,
      provenance: {
        providerId: 'EUROSTAT',
        institution: 'Eurostat',
        datasetCode: declaration.datasetCode,
        dimensions: declaration.dimensions,
      },
    };
  }

  return {
    ...base,
    value: cell.observation.value,
    periodId: cell.observation.periodId,
    available: cell.publishable,
    ...(cell.publishable
      ? {}
      : {
          gapReason: 'NO_PRODUCER' as EconomyFigureGapReason,
          detail: 'ECON-NOT-PUBLISHABLE: the lineage does not satisfy every clause.',
        }),
    provenance: {
      providerId: cell.lineage.upstream.providerId,
      institution: 'Eurostat',
      datasetCode: cell.lineage.upstream.datasetCode,
      dimensions: cell.lineage.upstream.dimensions,
      ...(cell.lineage.retrieval.contentAddress === undefined
        ? {}
        : { snapshotSha256: cell.lineage.retrieval.contentAddress }),
      parserId: 'eurostat.jsonstat',
      parserVersion: '1.0.0',
      /* Present only when the upstream ref carries one. Under
         `exactOptionalPropertyTypes` an explicit `undefined` is a DIFFERENT fact from an
         absent key, and "we have no URL" is the one this should state. */
      ...(cell.lineage.upstream.requestUrl === undefined
        ? {}
        : { sourceUrl: cell.lineage.upstream.requestUrl }),
    },
  };
}

/** Every declared row, in matrix order, so the strip has a stable shape before any fetch. */
export function emptyIndicatorStrip(): readonly EconomyIndicatorCell[] {
  return ALPHA_SERIES.map((s) =>
    toIndicatorCell({
      kind: 'GAP',
      seriesId: s.seriesId,
      reason: 'NO_PRODUCER',
      detail:
        s.alphaState === 'BLOCKED'
          ? (s.blockedBy ?? 'ECON-BLOCK-UNSTATED')
          : 'ECON-NO-ADMITTED-BYTES: no capture exists for this series.',
    }),
  );
}
