/*
  ASK R3 RESEARCH ACTIVITY R1 — THE STORED RECORD OF WHAT THE SEARCH ACTUALLY DID.

  PO acceptance failure (Alpha 0717ff7, operation 7c7b9ecb…): an answer that said "I couldn't
  verify relevant reporting" showed no Search activity, live or reopened. Two causes:
    · a current question whose search found nothing (or whose sources failed) and that had a
      stable part / an anchor-gated subject is answered by `executeBackground`, which never
      received the retrieval response — the search that RAN was dropped from the stored payload;
    · the frontend inferred "a search happened" from `payload.analysis !== null` and only for the
      answer that settled in the current session, so a reopened answer lost it.

  This record is the payload's governed account of research, derived by the SAME classifier that
  writes `AskObservation.retrievalOutcome` (`observedRetrievalOf`), so the reader's record and the
  operator's record cannot disagree:

      performed  a retrieval call was made for THIS answer (captured where the call is made, not
                 inferred from the final answer)
      outcome    MATCHED | RETAINED_ONLY            evidence found
                 COMPLETED_NO_MATCH | ALL_FILTERED  the search completed; nothing usable
                 PARTIAL | PARTIAL_NO_MATCH         some sources could not be reached
                 PROVIDER_FAILED                    the search could not be completed
                 OUTCOME_UNAVAILABLE                the call was made but returned no typed outcome
                                                    (never guessed as "no match" or "success")
      reused     a follow-up re-read the earlier answer's evidence; no new search was made
      lanes      which source lanes were tried, answered, and were unavailable (and why)

  Ids, codes and counts only: never the query, the reader's words or an article. Stored once at
  execution; reopening an answer reads it and runs nothing.
*/
import { observedRetrievalOf, type RetrievalOutcomeCode } from './retrieval-outcome';

export const ASK_RESEARCH_SCHEMA = 'ask-research/1' as const;

export interface AskResearchLanes {
  readonly attempted: readonly string[];
  readonly succeeded: readonly string[];
  readonly unavailable: readonly { readonly lane: string; readonly reason: string }[];
}

/** RESEARCH ACTIVITY R1.1 (CTO review) — a call was made but carried no typed outcome. */
export type AskResearchOutcome = RetrievalOutcomeCode | 'OUTCOME_UNAVAILABLE';

export interface AskResearchRecord {
  readonly schema: typeof ASK_RESEARCH_SCHEMA;
  readonly performed: boolean;
  readonly outcome: AskResearchOutcome | null;
  readonly reused: boolean;
  readonly lanes: AskResearchLanes;
  readonly candidatesSeen: number | null;
  readonly candidatesAdmitted: number | null;
}

/** The shape of a retrieval response this record reads (AnalysisApiResponse satisfies it). */
export interface ResearchFacts {
  readonly articles?: readonly unknown[];
  readonly retrievalContext?: {
    readonly dataMode?: string;
    readonly outcome?: string;
    readonly retrievalOutcome?: string;
    readonly fallbackReason?: string;
    readonly providers?: readonly string[];
    readonly providerFailures?: readonly unknown[];
    readonly retrievalTrace?: {
      readonly candidatesSeen?: number;
      readonly candidatesAdmitted?: number;
      readonly lanesAttempted?: readonly unknown[];
      readonly lanesSucceeded?: readonly unknown[];
      readonly lanesUnavailable?: readonly unknown[];
    };
  } | null;
}

const NO_LANES: AskResearchLanes = { attempted: [], succeeded: [], unavailable: [] };

const strings = (v: readonly unknown[] | undefined): string[] =>
  Array.from(new Set((v ?? []).filter((x): x is string => typeof x === 'string' && x !== '')));

function lanesOf(ctx: NonNullable<ResearchFacts['retrievalContext']>): AskResearchLanes {
  const unavailable = new Map<string, string>();
  for (const u of ctx.retrievalTrace?.lanesUnavailable ?? []) {
    const lane = (u as { lane?: unknown })?.lane;
    const reason = (u as { reason?: unknown })?.reason;
    if (typeof lane === 'string' && lane !== '') unavailable.set(lane, typeof reason === 'string' ? reason : 'unavailable');
  }
  for (const f of ctx.providerFailures ?? []) {
    const lane = (f as { providerId?: unknown })?.providerId;
    const reason = (f as { kind?: unknown })?.kind;
    if (typeof lane === 'string' && lane !== '' && !unavailable.has(lane))
      unavailable.set(lane, typeof reason === 'string' ? reason : 'unavailable');
  }
  const succeeded = strings([...(ctx.retrievalTrace?.lanesSucceeded ?? []), ...(ctx.providers ?? [])]).filter(
    (lane) => !unavailable.has(lane),
  );
  const attempted = strings([...(ctx.retrievalTrace?.lanesAttempted ?? []), ...succeeded, ...unavailable.keys()]);
  return { attempted, succeeded, unavailable: [...unavailable].map(([lane, reason]) => ({ lane, reason })) };
}

export function researchRecordOf(
  facts: ResearchFacts | null | undefined,
  options: { readonly reused?: boolean } = {},
): AskResearchRecord {
  const ctx = facts?.retrievalContext ?? null;
  const reused = options.reused === true;
  const notPerformed: AskResearchRecord = { schema: ASK_RESEARCH_SCHEMA, performed: false, outcome: null, reused, lanes: NO_LANES, candidatesSeen: null, candidatesAdmitted: null };
  /* no retrieval call for this answer, or the landed path asked the reader before searching */
  if (facts == null || ctx?.retrievalOutcome === 'CLARIFICATION_REQUIRED') return notPerformed;
  if (reused) return notPerformed;
  /* RESEARCH ACTIVITY R1.1 — a call WAS made (facts exist) but carried no typed outcome: say so */
  if (ctx === null) {
    return { ...notPerformed, performed: true, outcome: 'OUTCOME_UNAVAILABLE' };
  }
  const observed = observedRetrievalOf({ articles: facts.articles, retrievalContext: ctx });
  return {
    schema: ASK_RESEARCH_SCHEMA,
    performed: true,
    outcome: observed.retrievalOutcome ?? 'OUTCOME_UNAVAILABLE',
    reused,
    lanes: reused ? NO_LANES : lanesOf(ctx),
    candidatesSeen: observed.candidatesSeen,
    candidatesAdmitted: observed.candidatesAdmitted,
  };
}
