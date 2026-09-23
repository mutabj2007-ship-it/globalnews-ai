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
  return {
    id: row.observationKey,
    geography: {
      id: row.observationKey,
      countryIso3: g.countryIso3,
      displayName: row.identity.upstreamEventId,
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
