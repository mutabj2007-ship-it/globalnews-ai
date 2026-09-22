import type { SourceProvenance } from '../source-provenance';
import { SPATIAL_PRECISION_LADDER, type SpatialPrecision } from '../spatial/precision';

/** Retained facts only. No assessments, inferred geometry, or news-to-metric conversion. */
export interface EnergyObservation {
  observationKey: string;
  subjectId: string;
  subjectName: string;
  subjectType: 'SYSTEM' | 'CORRIDOR' | 'ASSET';
  geographyId: string;
  spatialPrecision: SpatialPrecision;
  metric: 'GENERATION' | 'CAPACITY' | 'STORAGE' | 'OUTAGE' | 'FLOW' | 'GRID' | 'ASSET';
  period: string;
  value: number | null;
  unit: string;
  releaseStatus: 'PRELIMINARY' | 'REVISED' | 'FINAL' | 'WITHDRAWN';
  publisherChangedAt: string | null;
  provenance: SourceProvenance;
  retrievalId: string;
  freshnessBasis: 'RETAINED_ONLY';
}
export type EnergyReadResult =
  | { kind: 'OBSERVATIONS'; observations: EnergyObservation[] }
  | { kind: 'EMPTY'; observations: [] }
  | { kind: 'UNAVAILABLE'; observations: [] };
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const date = (v: unknown): boolean =>
  text(v) && /T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
export function isEnergyObservation(value: unknown): value is EnergyObservation {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, any>;
  const p = o.provenance;
  return (
    [
      'observationKey',
      'subjectId',
      'subjectName',
      'geographyId',
      'period',
      'unit',
      'retrievalId',
    ].every((k) => text(o[k])) &&
    ['SYSTEM', 'CORRIDOR', 'ASSET'].includes(o.subjectType) &&
    (SPATIAL_PRECISION_LADDER as readonly string[]).includes(o.spatialPrecision) &&
    ['GENERATION', 'CAPACITY', 'STORAGE', 'OUTAGE', 'FLOW', 'GRID', 'ASSET'].includes(o.metric) &&
    ['PRELIMINARY', 'REVISED', 'FINAL', 'WITHDRAWN'].includes(o.releaseStatus) &&
    (o.value === null || (typeof o.value === 'number' && Number.isFinite(o.value))) &&
    (o.publisherChangedAt === null || date(o.publisherChangedAt)) &&
    o.freshnessBasis === 'RETAINED_ONLY' &&
    !!p &&
    ['OFFICIAL_SOURCE', 'PUBLIC_DATA'].includes(p.sourceType) &&
    ['PRIMARY_RECORD', 'REFERENCE_DATA'].includes(p.evidenceRole) &&
    text(p.providerId) &&
    text(p.institution) &&
    date(p.retrievedAt)
  );
}
