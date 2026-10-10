/*
  ASK R3 RESEARCH ACTIVITY R1 — THE READER'S "SEARCH ACTIVITY", DERIVED FROM STORED FACTS ONLY.

  PO acceptance failure (Alpha 0717ff7): an answer that could not verify relevant reporting showed
  no Search activity, and a reopened answer lost it. The record was inferred from
  `payload.analysis !== null` and only for the answer that settled in the current session. Now it
  is derived from what the backend RECORDED about the search, on every render — live, reopened or
  restored — static, collapsed, never animated (R3: no replay).

  Four states, never inferred from whether an analysis exists:
    research succeeded   MATCHED / RETAINED_ONLY              ✓ Sources searched
                         COMPLETED_NO_MATCH / ALL_FILTERED    ✓ Sources searched (+ what it found)
    research incomplete  PARTIAL / PARTIAL_NO_MATCH           ! Some sources searched (+ which not)
                         PROVIDER_FAILED                      × Could not finish searching sources
    reused               a follow-up re-read earlier evidence ✓ Earlier sources reviewed
    no research          nothing searched                     → no record at all
  A green check is drawn only for a stage that completed: a search that completed and found
  nothing DID complete (its note says so); one that could not reach every source is partial (!),
  one that reached none is failed (×). "Answer ready" is the answer the reader is looking at.

  Source of truth: `payload.research` (backend research-record.ts — the same classifier as
  AskObservation.retrievalOutcome). Answers stored before it fall back to the facts those payloads
  DO carry: `analysis.retrievalContext` (classified by the same rules, below), else the guidance
  outcome the backend set only after a search ran (NO_EVIDENCE: completed, nothing found;
  UNAVAILABLE: sources failed). Nothing else is ever read as research.
*/
import type { AskR2Payload, AskResearchOutcome } from '@/lib/api/askV2Api';

export type SearchStepStatus = 'completed' | 'partial' | 'failed';
export type SearchStepKind = 'SEARCH' | 'REUSED' | 'ANSWER';

export interface SearchStep {
  readonly kind: SearchStepKind;
  readonly status: SearchStepStatus;
  /** Present on the SEARCH step: what the completed / partial search found. */
  readonly found?: 'EVIDENCE' | 'NO_MATCH' | 'FILTERED';
  /** Present when some sources could not be reached: the lanes, as recorded. */
  readonly unreached?: readonly string[];
}

export interface SearchActivity {
  readonly steps: readonly SearchStep[];
  /** Where it came from — the stored record, or a pre-R1 payload's own facts. */
  readonly basis: 'RECORD' | 'LEGACY_TRACE' | 'LEGACY_GUIDANCE';
}

interface Facts {
  readonly outcome: AskResearchOutcome;
  readonly unreached: readonly string[];
}

/* the backend classifier (retrieval-outcome.ts observedRetrievalOf), for pre-R1 payloads only */
function classifyLegacyTrace(payload: AskR2Payload): Facts | null {
  const analysis = payload.analysis as unknown as {
    articles?: readonly unknown[];
    retrievalContext?: {
      dataMode?: string;
      outcome?: string;
      retrievalOutcome?: string;
      fallbackReason?: string;
      providers?: readonly string[];
      providerFailures?: readonly { providerId?: string }[];
      retrievalTrace?: { candidatesSeen?: number; lanesUnavailable?: readonly { lane?: string }[] };
    } | null;
  } | null;
  const ctx = analysis?.retrievalContext;
  if (analysis == null || ctx == null || ctx.retrievalOutcome === 'CLARIFICATION_REQUIRED') return null;
  const admitted = analysis.articles?.length ?? 0;
  const answered = (ctx.providers ?? []).length;
  const unreached = Array.from(
    new Set(
      [...(ctx.retrievalTrace?.lanesUnavailable ?? []).map((u) => u.lane), ...(ctx.providerFailures ?? []).map((f) => f.providerId)].filter(
        (v): v is string => typeof v === 'string' && v !== '',
      ),
    ),
  );
  const allFailed =
    (ctx.outcome ?? '').startsWith('PROVIDER_') ||
    (answered === 0 && ((ctx.providerFailures ?? []).length > 0 || ctx.fallbackReason === 'provider-error' || ctx.dataMode === 'unavailable'));
  const partial = unreached.length > 0 && answered > 0;
  const seen = ctx.retrievalTrace?.candidatesSeen;
  const outcome: AskResearchOutcome =
    allFailed && admitted === 0
      ? 'PROVIDER_FAILED'
      : admitted > 0
        ? partial
          ? 'PARTIAL'
          : ctx.outcome === 'RETAINED_ONLY' || ctx.dataMode === 'cached'
            ? 'RETAINED_ONLY'
            : 'MATCHED'
        : partial
          ? 'PARTIAL_NO_MATCH'
          : typeof seen === 'number' && seen > 0
            ? 'ALL_FILTERED'
            : 'COMPLETED_NO_MATCH';
  return { outcome, unreached };
}

function searchStep({ outcome, unreached }: Facts): SearchStep {
  switch (outcome) {
    case 'MATCHED':
    case 'RETAINED_ONLY':
      return { kind: 'SEARCH', status: 'completed', found: 'EVIDENCE' };
    case 'COMPLETED_NO_MATCH':
      return { kind: 'SEARCH', status: 'completed', found: 'NO_MATCH' };
    case 'ALL_FILTERED':
      return { kind: 'SEARCH', status: 'completed', found: 'FILTERED' };
    case 'PARTIAL':
      return { kind: 'SEARCH', status: 'partial', found: 'EVIDENCE', unreached };
    case 'PARTIAL_NO_MATCH':
      return { kind: 'SEARCH', status: 'partial', found: 'NO_MATCH', unreached };
    case 'PROVIDER_FAILED':
      return { kind: 'SEARCH', status: 'failed', unreached };
  }
}

const ANSWER: SearchStep = { kind: 'ANSWER', status: 'completed' };

export function searchActivityOf(payload: AskR2Payload | null | undefined): SearchActivity | null {
  if (payload == null) return null;
  const record = payload.research;
  if (record !== undefined && record !== null) {
    if (record.reused) return { basis: 'RECORD', steps: [{ kind: 'REUSED', status: 'completed' }, ANSWER] };
    if (!record.performed || record.outcome === null) return null;
    return {
      basis: 'RECORD',
      steps: [searchStep({ outcome: record.outcome, unreached: record.lanes.unavailable.map((u) => u.lane) }), ANSWER],
    };
  }
  /* answers stored before R1 */
  if (payload.priorAnswer?.evidence === 'REUSED') return { basis: 'LEGACY_TRACE', steps: [{ kind: 'REUSED', status: 'completed' }, ANSWER] };
  const legacy = classifyLegacyTrace(payload);
  if (legacy !== null) return { basis: 'LEGACY_TRACE', steps: [searchStep(legacy), ANSWER] };
  const part = payload.guidance?.currentPart;
  if (part === 'NO_EVIDENCE')
    return { basis: 'LEGACY_GUIDANCE', steps: [searchStep({ outcome: 'COMPLETED_NO_MATCH', unreached: [] }), ANSWER] };
  if (part === 'UNAVAILABLE')
    return { basis: 'LEGACY_GUIDANCE', steps: [searchStep({ outcome: 'PROVIDER_FAILED', unreached: [] }), ANSWER] };
  return null;
}
