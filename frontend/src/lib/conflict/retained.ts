import {
  validateConflictObservation,
  observationRestsOnAdmittedCapture,
  type ConflictObservation,
} from '@globalnews-ai/shared';
import type { EvidenceRecord } from '@/lib/map/evidence/evidenceModel';

/** Same strict validator as persistence. No admission, identity, assessment or rank is inferred. */
export function reviewedObservations(input: unknown): readonly ConflictObservation[] {
  if (!Array.isArray(input)) throw new Error('INVALID_CONFLICT_RESPONSE');
  const latest = new Map<string, ConflictObservation>();
  for (const value of input) {
    const row = validateConflictObservation(value);
    const prev = latest.get(row.observationKey);
    if (!prev || row.revision.revisionOrdinal > prev.revision.revisionOrdinal)
      latest.set(row.observationKey, row);
  }
  return [...latest.values()]
    .filter((row) => row.owner === 'CONFLICT' && observationRestsOnAdmittedCapture(row.acquisition))
    .sort(
      (a, b) =>
        Date.parse(b.temporal.eventStartedAt) - Date.parse(a.temporal.eventStartedAt) ||
        (a.observationKey < b.observationKey ? -1 : a.observationKey > b.observationKey ? 1 : 0),
    );
}

export interface ConflictDisplayStats {
  readonly retained: number;
  readonly drawable: number;
  readonly withheld: number;
  readonly exact: number;
  readonly city: number;
}

/** Source-stated place/country label for reader presentation. Never derived from coordinates. */
export function conflictPlaceLabel(row: ConflictObservation): string {
  return row.geography.sourceCountryName ?? row.geography.countryIso3 ?? row.identity.authority;
}

/**
 * Presentation counts over the retained objects themselves.
 *
 * "Drawable" means only that the existing Spatial point grammar can render the
 * observation without coercion. It is not a severity, confidence or attention rank.
 */
export function conflictDisplayStats(rows: readonly ConflictObservation[]): ConflictDisplayStats {
  let drawable = 0;
  let exact = 0;
  let city = 0;

  for (const row of rows) {
    const record = observationMapRecord(row);
    if (!record) continue;
    drawable++;
    if (row.geography.precision === 'EXACT') exact++;
    if (row.geography.precision === 'CITY') city++;
  }

  return {
    retained: rows.length,
    drawable,
    withheld: rows.length - drawable,
    exact,
    city,
  };
}

/** Spatial's point grammar cannot represent lines/areas/centroids. Withhold, never coerce. */
export function observationMapRecord(row: ConflictObservation): EvidenceRecord | null {
  const g = row.geography;
  if (
    row.revision.revisionKind === 'RETRACTION' ||
    g.origin !== 'SOURCE_NATIVE' ||
    g.geometryKind !== 'POINT' ||
    g.denotation !== 'EVENT_LOCATION' ||
    !['CITY', 'EXACT'].includes(g.precision) ||
    !g.countryIso3 ||
    !g.coordinates ||
    typeof g.coordinates !== 'object'
  )
    return null;
  const point = (g.coordinates as { coordinates: readonly [number, number] }).coordinates;
  if (!Array.isArray(point) || point.length < 2) return null;
  /*
    The geography id is the exact source point, not the event identity.

    EvidenceMapCanvas already groups records by geography.id. Using the event
    id here defeated that accepted collision rule and drew one coincident ring
    per UCDP row. Exact coordinate equality is not a spatial inference: both
    rows literally carry the same source-stated point. Nearby-but-different
    points remain separate.
  */
  const geographyId = [
    'conflict-point',
    g.countryIso3,
    String(point[0]),
    String(point[1]),
  ].join(':');

  return {
    id: row.observationKey,
    geography: {
      id: geographyId,
      countryIso3: g.countryIso3,
      displayName: conflictPlaceLabel(row),
      point: [point[0], point[1]],
    },
    precision: g.precision,
    provenance: g.locationProvenance,
    reportCount: 1,
    sourceCount: 1,
    publisherId: row.identity.authority,
    lastObservedAt: row.temporal.eventStartedAt,
  };
}
export function sourceHref(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
