import type {
  PoliticsReadResponse,
  RetainedPoliticsObservation,
} from '@globalnews-ai/shared';
import { resolveApiBaseUrl } from '@/lib/api/apiBase';

const EMPTY: PoliticsReadResponse = {
  observations: [],
  absence: 'NOT_ASSESSED',
  truncated: false,
  acquisition: 'RETAINED_ONLY',
  coverage: { checkedCaptures: 0, admittedObservations: 0, withheld: false },
};

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function iso(value: unknown): value is string {
  return text(value) && Number.isFinite(Date.parse(value));
}

function politicsObservation(value: unknown): value is RetainedPoliticsObservation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const o = value as Record<string, any>;
  if (!text(o.observationKey) || !text(o.subjectId)) return false;
  if (!['ELECTION', 'LEGISLATIVE_SUBJECT', 'PROTEST_CAMPAIGN'].includes(o.subjectType)) return false;
  if (!['ELECTION_PROCESS_NOTICE', 'LEGISLATIVE_STAGE', 'PROTEST_HELD'].includes(o.observationKind)) return false;
  if (!o.claim || typeof o.claim !== 'object' || o.claim.kind !== o.observationKind || !text(o.claim.sourceText) || !text(o.claim.stage)) return false;
  if (!o.temporal || typeof o.temporal !== 'object' || !iso(o.temporal.retrievedAt)) return false;
  if (!o.provenance || typeof o.provenance !== 'object' || !text(o.provenance.sourceType)) return false;
  if (!o.sourceReference || typeof o.sourceReference !== 'object') return false;
  if (!o.revision || typeof o.revision !== 'object' || !Number.isInteger(o.revision.revisionOrdinal) || !iso(o.revision.recordedAt)) return false;
  if (!iso(o.publishedAt) || !text(o.artifactSha256)) return false;
  return true;
}

export function isPoliticsReadResponse(value: unknown): value is PoliticsReadResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as Record<string, any>;
  if (!Array.isArray(r.observations) || !r.observations.every(politicsObservation)) return false;
  if (![null, 'NOT_ASSESSED', 'EVIDENCE_WITHHELD'].includes(r.absence)) return false;
  if (typeof r.truncated !== 'boolean' || r.acquisition !== 'RETAINED_ONLY') return false;
  if (r.coverage !== undefined) {
    if (!r.coverage || typeof r.coverage !== 'object') return false;
    if (!Number.isInteger(r.coverage.checkedCaptures) || r.coverage.checkedCaptures < 0) return false;
    if (!Number.isInteger(r.coverage.admittedObservations) || r.coverage.admittedObservations < 0) return false;
    if (typeof r.coverage.withheld !== 'boolean') return false;
  }
  return true;
}

/**
 * Internal retained-only read. This is not a provider call and cannot execute AI.
 * A read failure is represented as NOT_ASSESSED rather than fabricated zero activity.
 */
export async function readPoliticsObservations(): Promise<PoliticsReadResponse> {
  try {
    const response = await fetch(
      `${resolveApiBaseUrl().replace(/\/$/, '')}/politics/observations?limit=100`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
        headers: { accept: 'application/json' },
      },
    );
    if (!response.ok) return EMPTY;
    const payload: unknown = await response.json();
    return isPoliticsReadResponse(payload) ? payload : EMPTY;
  } catch {
    return EMPTY;
  }
}
