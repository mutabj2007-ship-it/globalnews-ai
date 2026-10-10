/*
  ASK R3 RESEARCH ACTIVITY R1.1 — THE READER'S "SEARCH ACTIVITY", DERIVED FROM PERSISTED FACTS ONLY.

  PO acceptance failure (Alpha 0717ff7, operation 7c7b9ecb…) and CTO diagnosis review: the record must
  never claim more than the stored evidence establishes. Two steps:

    SEARCH  from `payload.research` (backend research-record.ts, captured where the retrieval call is
            made; same classifier as AskObservation.retrievalOutcome):
              MATCHED / RETAINED_ONLY                ✓ Sources searched
              COMPLETED_NO_MATCH / ALL_FILTERED      ✓ Sources searched (+ what it found)
              PARTIAL / PARTIAL_NO_MATCH             ! Some sources searched (+ which not reached)
              PROVIDER_FAILED                        × Could not finish searching sources
              OUTCOME_UNAVAILABLE                    – Search attempted; detailed retrieval outcome unavailable.
              reused                                 ✓ Earlier sources reviewed (no new search)
              not performed                          → no record at all
    ANSWER  from the stored answer state — a completed REQUEST is not a verified ANSWER:
              CURRENTLY_VERIFIED / CURRENT_REPORTING / RETAINED_REPORTING   ✓ Answer ready
              PARTIAL                                                       ! Answer ready (some evidence missing)
              NO_ANSWER_PRODUCED / CAPABILITY_UNAVAILABLE                   × No answer was produced
              anything else (background, insufficient evidence)            ✓ Request completed — no verified answer

  ANSWERS STORED BEFORE R1 (no `research` field) — only what the payload proves:
    · a stored retrieval TRACE (analysis.retrievalContext.retrievalTrace): classified by the same rules;
    · otherwise, a fact that implies a retrieval call was made — guidance NO_EVIDENCE (set only after a
      retrieval), or (EXECUTABLE plan) guidance UNAVAILABLE / NO_ANSWER_PRODUCED with REPORTING missing,
      or a retrieval context without a trace → "Search attempted; detailed retrieval outcome unavailable."
      Never "no matching reports", never a successful-search check.
    · guidance UNAVAILABLE on a NON-executable plan (an untransportable current part: no retrieval ran)
      and everything else → no record.
*/
import type { AskR2Payload, AskResearchOutcome } from '@/lib/api/askV2Api';

export type SearchStepStatus = 'completed' | 'partial' | 'failed' | 'unknown';
export type SearchStepKind = 'SEARCH' | 'REUSED' | 'ANSWER';
export type AnswerOutcome = 'SOURCED' | 'PARTLY_SOURCED' | 'COMPLETED_UNVERIFIED' | 'NOT_PRODUCED';

export interface SearchStep {
  readonly kind: SearchStepKind;
  readonly status: SearchStepStatus;
  /** SEARCH: what a completed / partial search found. */
  readonly found?: 'EVIDENCE' | 'NO_MATCH' | 'FILTERED';
  /** SEARCH: lanes that could not be reached, as recorded. */
  readonly unreached?: readonly string[];
  /** MASTER CTO P0 RIGHTS CONTAINMENT R1 — found but withheld for rights (never "no match") */
  readonly rightsWithheld?: number;
  /** ANSWER: what the request produced. */
  readonly answer?: AnswerOutcome;
}

export interface SearchActivity {
  readonly steps: readonly SearchStep[];
  readonly basis: 'RECORD' | 'LEGACY_TRACE' | 'LEGACY_ATTEMPTED';
}

interface Facts {
  readonly outcome: AskResearchOutcome;
  readonly unreached: readonly string[];
}

type LegacyContext = {
  dataMode?: string;
  outcome?: string;
  retrievalOutcome?: string;
  fallbackReason?: string;
  providers?: readonly string[];
  providerFailures?: readonly { providerId?: string }[];
  retrievalTrace?: { candidatesSeen?: number; lanesUnavailable?: readonly { lane?: string }[] } | null;
} | null;

/* the backend classifier (retrieval-outcome.ts observedRetrievalOf) — for a STORED pre-R1 trace only */
function classifyLegacyTrace(articles: readonly unknown[] | undefined, ctx: NonNullable<LegacyContext>): Facts {
  const admitted = articles?.length ?? 0;
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

/* MASTER CTO P0 RIGHTS CONTAINMENT R1 — reporting withheld for rights is never told as "no matching
   reports" or "not relevant": that claim is dropped and the withholding is stated instead. */
function withRights(step: SearchStep, withheld: number | undefined): SearchStep {
  if (withheld === undefined || withheld <= 0) return step;
  const { found, ...rest } = step;
  return { ...rest, ...(found === 'NO_MATCH' || found === 'FILTERED' ? {} : found === undefined ? {} : { found }), rightsWithheld: withheld };
}

function searchStep({ outcome, unreached }: Facts): SearchStep {
  switch (outcome) {
    case 'MATCHED':
    case 'RETAINED_ONLY':
      return { kind: 'SEARCH', status: 'completed', found: 'EVIDENCE' };
    case 'COMPLETED_NO_MATCH':
      return { kind: 'SEARCH', status: 'completed', found: 'NO_MATCH' };
    /* MASTER CTO P0 RIGHTS CONTAINMENT R1.1 — found, but every item withheld for rights: no "found" claim */
    case 'RIGHTS_WITHHELD':
      return { kind: 'SEARCH', status: 'completed' };
    case 'ALL_FILTERED':
      return { kind: 'SEARCH', status: 'completed', found: 'FILTERED' };
    case 'PARTIAL':
      return { kind: 'SEARCH', status: 'partial', found: 'EVIDENCE', unreached };
    case 'PARTIAL_NO_MATCH':
      return { kind: 'SEARCH', status: 'partial', found: 'NO_MATCH', unreached };
    case 'PROVIDER_FAILED':
      return { kind: 'SEARCH', status: 'failed', unreached };
    case 'OUTCOME_UNAVAILABLE':
      return { kind: 'SEARCH', status: 'unknown' };
  }
}

const ATTEMPTED_UNKNOWN: SearchStep = { kind: 'SEARCH', status: 'unknown' };

/** A completed request is not a verified answer: the stored answer state decides which. */
export function answerStep(payload: AskR2Payload): SearchStep {
  const { state, basis } = payload.answer;
  if (basis === 'NO_ANSWER_PRODUCED' || state === 'CAPABILITY_UNAVAILABLE')
    return { kind: 'ANSWER', status: 'failed', answer: 'NOT_PRODUCED' };
  if (state === 'CURRENTLY_VERIFIED' || state === 'CURRENT_REPORTING' || state === 'RETAINED_REPORTING')
    return { kind: 'ANSWER', status: 'completed', answer: 'SOURCED' };
  if (state === 'PARTIAL') return { kind: 'ANSWER', status: 'partial', answer: 'PARTLY_SOURCED' };
  return { kind: 'ANSWER', status: 'completed', answer: 'COMPLETED_UNVERIFIED' };
}

function legacySearch(payload: AskR2Payload): { step: SearchStep; basis: SearchActivity['basis'] } | null {
  const analysis = payload.analysis as unknown as { articles?: readonly unknown[]; retrievalContext?: LegacyContext } | null;
  const ctx = analysis?.retrievalContext ?? null;
  if (ctx?.retrievalOutcome === 'CLARIFICATION_REQUIRED') return null;
  if (ctx != null && ctx.retrievalTrace != null) return { step: searchStep(classifyLegacyTrace(analysis?.articles, ctx)), basis: 'LEGACY_TRACE' };
  const executable = payload.route?.terminalState === 'EXECUTABLE';
  const part = payload.guidance?.currentPart;
  const attempted =
    ctx != null ||
    part === 'NO_EVIDENCE' ||
    (executable && part === 'UNAVAILABLE') ||
    (executable && payload.answer.basis === 'NO_ANSWER_PRODUCED' && payload.answer.missingRoles.includes('REPORTING'));
  return attempted ? { step: ATTEMPTED_UNKNOWN, basis: 'LEGACY_ATTEMPTED' } : null;
}

export function searchActivityOf(payload: AskR2Payload | null | undefined): SearchActivity | null {
  if (payload == null) return null;
  const record = payload.research;
  if (record !== undefined && record !== null) {
    if (record.reused) return { basis: 'RECORD', steps: [{ kind: 'REUSED', status: 'completed' }, answerStep(payload)] };
    if (!record.performed || record.outcome === null) return null;
    return {
      basis: 'RECORD',
      steps: [withRights(searchStep({ outcome: record.outcome, unreached: record.lanes.unavailable.map((u) => u.lane) }), record.rightsWithheld), answerStep(payload)],
    };
  }
  if (payload.priorAnswer?.evidence === 'REUSED')
    return { basis: 'LEGACY_TRACE', steps: [{ kind: 'REUSED', status: 'completed' }, answerStep(payload)] };
  const legacy = legacySearch(payload);
  return legacy === null ? null : { basis: legacy.basis, steps: [legacy.step, answerStep(payload)] };
}
