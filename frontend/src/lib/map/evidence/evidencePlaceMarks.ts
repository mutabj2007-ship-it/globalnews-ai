import type { EvidenceRecord } from './evidenceModel';
import type { LocationProvenance } from '@/lib/spatial/spatialPrecision';
import type { DisplayPrecision } from '@/lib/map/spatial/precisionModel';
import {
  countsAsVerified,
  displayPrecisionFor,
  rendersAsPoint,
} from '@/lib/map/spatial/precisionModel';

export interface EvidencePlaceMark {
  readonly geographyId: string;
  readonly recordId: string;
  readonly point: readonly [number, number];
  readonly precision: DisplayPrecision;
  readonly provenance: LocationProvenance | undefined;
}

/**
 * One visual mark per evidence geography.
 *
 * This is the single grouping authority for both the MapLibre marker/halo layers
 * and the DOM ripple layer. If those two consumers group independently they can
 * disagree on cardinality and React keys, which is exactly how stale ripple
 * trails appeared during camera movement on dense Conflict data.
 */
export function evidencePlaceMarks(
  records: readonly EvidenceRecord[],
): readonly EvidencePlaceMark[] {
  const byGeography = new Map<string, EvidencePlaceMark>();

  for (const record of records) {
    const point = record.geography.point;
    if (point === undefined || !rendersAsPoint(record.precision)) continue;

    const key = record.geography.id;
    const existing = byGeography.get(key);

    if (existing === undefined) {
      byGeography.set(key, {
        geographyId: key,
        recordId: record.id,
        point,
        precision: record.precision,
        provenance: record.provenance,
      });
      continue;
    }

    const precision =
      displayPrecisionFor(record.precision, existing.precision) !== record.precision
        ? record.precision
        : existing.precision;
    const provenance = countsAsVerified(record.provenance)
      ? record.provenance
      : existing.provenance;

    byGeography.set(key, {
      ...existing,
      precision,
      provenance,
    });
  }

  return [...byGeography.values()];
}
