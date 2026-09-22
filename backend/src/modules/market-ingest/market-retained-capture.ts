import { eurostatReleaseStatus, UnprovenMarketReleaseStatus } from './market-release-status';
import { createHash } from 'node:crypto';
import { parseStrictJson, type MarketArtifactClass } from '@globalnews-ai/shared';
import { assertComextRequestIsPermitted, type ComextRequest } from './eurostat-comext-carveouts';
import type { MarketObservationDraft } from './market-ingest.scheduler';

/** No acquisition authority: only an already admitted, byte-verifiable capture. */
export interface MarketRetainedCapture {
  retrievalId: string;
  providerId: string;
  endpointId: string;
  parameters: unknown;
  requestedAt: Date;
  retrievedAt: Date;
  admissibility: string;
  completeness: string;
  httpStatus: number;
  rightsGrade: string;
  rightsInstrumentRef: string;
  payloadRetentionPermitted: boolean;
  contentAddress: string | null;
  payload: { bytes: Uint8Array | null; storageState: string; byteLength: number } | null;
}
export class InvalidMarketCapture extends Error {}
function requireFact(ok: unknown, reason: string): asserts ok {
  if (!ok) throw new InvalidMarketCapture(reason);
}
function object(value: unknown): Record<string, any> {
  requireFact(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'Expected object',
  );
  return value as Record<string, any>;
}
const dimensions = ['freq', 'reporter', 'partner', 'product', 'flow', 'indicators'] as const;

/**
 * R09 ARTIFACT_INSPECTION: a verified JSON-stat dataset is a statistical release.
 * This is deliberately NOT G R4's unratified provider/subject classification table.
 * TED notices have no numeric reading in the accepted adapter and are unsupported here.
 */
export function inspectMarketCapture(c: MarketRetainedCapture): {
  sourceClass: MarketArtifactClass;
  subjectClass: 'CORRIDOR';
  geography: ComextRequest;
  labels: { reporterLabel?: string; partnerLabel?: string; productLabel?: string; flowLabel?: string; indicatorsLabel?: string; };
  observations: readonly MarketObservationDraft[];
} {
  requireFact(c.providerId === 'EUROSTAT', 'Undeclared retained Market provider');
  requireFact(
    c.admissibility === 'ADMITTED' && c.completeness === 'COMPLETE' && c.httpStatus === 200,
    'Capture is not admitted and complete',
  );
  requireFact(
    c.rightsGrade === 'E-5' && c.payloadRetentionPermitted && c.rightsInstrumentRef.trim(),
    'Capture rights do not permit retention',
  );
  requireFact(
    Number.isFinite(c.requestedAt.getTime()) &&
      Number.isFinite(c.retrievedAt.getTime()) &&
      c.requestedAt <= c.retrievedAt,
    'Invalid capture timestamps',
  );
  const bytes = c.payload?.bytes;
  requireFact(
    bytes &&
      c.payload?.storageState === 'RETAINED' &&
      bytes.length > 0 &&
      bytes.length <= 4 * 1024 * 1024 &&
      bytes.length === c.payload.byteLength,
    'Bytes unavailable or oversized',
  );
  requireFact(
    createHash('sha256').update(bytes).digest('hex') === c.contentAddress,
    'Capture digest mismatch',
  );
  requireFact(Array.isArray(c.parameters), 'Missing pinned request dimensions');
  const params = new Map<string, string>();
  for (const raw of c.parameters) {
    const p = object(raw);
    requireFact(
      typeof p.key === 'string' && typeof p.value === 'string' && !params.has(p.key),
      'Invalid request parameter',
    );
    params.set(p.key, p.value);
  }
  const request = Object.fromEntries(
    dimensions.map((key) => [key, params.get(key)]),
  ) as unknown as ComextRequest;
  requireFact(
    dimensions.every((key) => typeof request[key] === 'string' && request[key].trim()),
    'Unpinned Comext dimension',
  );
  requireFact(request.freq === 'M', 'Only declared monthly Comext observations are supported');
  try {
    assertComextRequestIsPermitted(request);
  } catch {
    throw new InvalidMarketCapture('Reporter geography is excluded');
  }
  let body: Record<string, any>;
  try {
    const parsed = parseStrictJson(bytes);
    requireFact(parsed.ok, 'Strict JSON refused');
    body = object(parsed.value);
  } catch {
    throw new InvalidMarketCapture('Malformed retained JSON');
  }
  requireFact(
    body.class === 'dataset' && body.version === '2.0' && body.source === 'ESTAT',
    'Not a declared Eurostat statistical artifact',
  );
  requireFact(
    typeof body.extension?.id === 'string' &&
      body.extension.id.toLowerCase() === c.endpointId.toLowerCase(),
    'Endpoint identity mismatch',
  );
  requireFact(
    Array.isArray(body.id) &&
      Array.isArray(body.size) &&
      body.id.length === 7 &&
      body.size.length === 7 &&
      new Set(body.id).size === 7 &&
      body.id.includes('time') &&
      dimensions.every((d) => body.id.includes(d)),
    'Unsupported Comext dimensions',
  );
  for (const d of dimensions) {
    const index = object(body.dimension?.[d]?.category?.index);
    requireFact(
      body.size[body.id.indexOf(d)] === 1 &&
        Object.keys(index).length === 1 &&
        index[request[d]] === 0,
      'Artifact does not match pinned subject/geography',
    );
  }
  // An indicator token is not a unit. Require an explicit publisher unit dimension/annotation.
  const annotations = body.extension?.annotation;
  requireFact(Array.isArray(annotations), 'Missing publisher annotations');
  const unitAnnotations = annotations.filter((a: any) => a?.type === 'UNIT');
  requireFact(
    unitAnnotations.length === 1 &&
      typeof unitAnnotations[0].title === 'string' &&
      unitAnnotations[0].title.trim() &&
      unitAnnotations[0].title !== 'PUBLISHER_STATED',
    'No explicit publisher unit',
  );
  const updates = annotations.filter((a: any) => a?.type === 'UPDATE_DATA');
  const changed = updates.length === 1 ? (updates[0].date ?? updates[0].title) : null;
  requireFact(
    typeof changed === 'string' &&
      /T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(changed) &&
      Number.isFinite(Date.parse(changed)) &&
      Date.parse(changed) <= c.retrievedAt.getTime(),
    'No valid publisher change timestamp',
  );
  const index = object(body.dimension?.time?.category?.index);
  const periods = Object.keys(index);
  requireFact(
    periods.length > 0 &&
      periods.length <= 250 &&
      body.size[body.id.indexOf('time')] === periods.length &&
      new Set(Object.values(index)).size === periods.length &&
      periods.every(
        (p) =>
          /^\d{4}-(0[1-9]|1[0-2])$/.test(p) &&
          Number.isInteger(index[p]) &&
          index[p] >= 0 &&
          index[p] < periods.length,
      ),
    'Invalid time axis',
  );
  const values = object(body.value);
  requireFact(
    Object.keys(values).length > 0 &&
      Object.entries(values).every(
        ([k, v]) =>
          /^\d+$/.test(k) &&
          Number(k) < periods.length &&
          (v === null || (typeof v === 'number' && Number.isFinite(v))),
      ),
    'Invalid numeric cells',
  );

  let releaseStatuses: ('PRELIMINARY' | 'REVISED')[];
  try {
    releaseStatuses = periods.map((period) => eurostatReleaseStatus(body.status, index[period]));
  } catch (error) {
    if (error instanceof UnprovenMarketReleaseStatus) throw new InvalidMarketCapture(error.message);
    throw error;
  }
  const parts = [c.endpointId, ...dimensions.map((d) => request[d])];
  const seriesId = `eco:1:${parts.map((p) => `${p.length}:${p}`).join('')}`;
  return {
    sourceClass: 'STATISTICAL_RELEASE',
    subjectClass: 'CORRIDOR',
    geography: request,
    labels: Object.fromEntries(dimensions.flatMap(d => {
      const label = body.dimension[d].category.label?.[request[d]];
      return typeof label === 'string' && label.trim() ? [[d + 'Label', label]] : [];
    })),
    observations: periods.map((periodId, position) => ({
      observationKey: `${seriesId}|${periodId}`,
      seriesId,
      periodId,
      value: values[String(index[periodId])] ?? null,
      unit: unitAnnotations[0].title,
      publisherVintage: null,
      publisherChangedAt: new Date(changed).toISOString(),
      vintageProvenance: 'PUBLISHER_CHANGED_AT',
      releaseStatus: releaseStatuses[position],
    })),
  };
}
