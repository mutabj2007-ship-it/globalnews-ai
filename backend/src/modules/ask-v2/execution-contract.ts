import type { AskR2Route } from '../ask-router/ask-r2-route';
import { RELATION_KINDS, type RelationKind } from '../ask-router/bilateral-relationship';
import { semanticReaderText } from '../ask-router/semantic-ir/interpret-turn';
import { artifactPromptBlock, type PriorArtifact } from './conversation/conversation-artifact';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 ALPHA DEFECT RULING R-1 / R-2 / R-5 — THE EXECUTION CONTRACT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * LIVE DEFECT (Alpha op 364492e4): the SemanticTurnIR read "Explain why inflation can fall while
 * people still feel that prices are high, and tell me what the current situation is in Poland." as
 * MIXED with two clauses — and then the executable path handed the analysis service the RAW whole
 * question plus the previous user question, so retrieval re-derived the meaning from text (generic
 * Poland reporting) and the stable half was never composed.
 *
 * INVARIANT: after interpretation, execution never re-derives intent from raw text. This contract
 * is derived ONCE from the authoritative route (and the bound earlier answer, R-3) and is the only
 * thing the executable path reads to decide:
 *   retrievalQuestion   what reporting is retrieved for (the analysis call's query)
 *   usePriorQuestion    whether the previous USER question may steer retrieval — never once the
 *                       IR has resolved the subject itself (a MIXED part, a bound earlier claim)
 *   stableQuestion      R-2: the explanatory part of a MIXED turn, answered by reasoning beside the
 *                       sourced current part — whatever the current part's retrieval returned
 *   answerRules / Data  trusted rules (system) + delimited data (never instructions) for the one
 *                       analysis call, through the EXISTING governed prompt boundary
 *   relationship        the two-sided scope (the route's, or the bound earlier answer's)
 * The job, freshness, geography and temporal requirement reach retrieval through the route as
 * before (reportingWindow, relationship, the composed question): no second parser exists here —
 * this module reads codes and the IR's own clause spans, never words.
 */
export type ExecutionContractKind = 'DIRECT' | 'MIXED_CURRENT_PART' | 'CLAIM_RECHECK';

export interface ExecutionContract {
  readonly kind: ExecutionContractKind;
  readonly retrievalQuestion: string;
  readonly usePriorQuestion: boolean;
  readonly stableQuestion: string | null;
  readonly answerRules: string;
  readonly answerData: string;
  readonly relationship: {
    readonly countries: readonly string[];
    readonly relations: readonly RelationKind[];
  } | null;
}

const MIXED_CURRENT_RULES =
  'MIXED QUESTION — CURRENT PART ONLY. The reader asked one question with two parts. Its ' +
  'explanatory part is answered separately by reasoning. From the reporting provided, answer ONLY ' +
  'the CURRENT part named in the CURRENT PART block below (the explanatory part is given only as ' +
  'context for which subject the current part is about). Do not write a general explanation.';

const CLAIM_RECHECK_RULES =
  'EARLIER-ANSWER RE-VERIFICATION. The reader asks whether points from your own earlier answer ' +
  '(the EARLIER WORK block below) still hold now. Check EACH earlier point against the reporting ' +
  'provided for this request: say whether current reporting supports it, contradicts it, or does ' +
  'not address it, and what has changed. The earlier answer is not evidence and must never be ' +
  'cited or restated as if it were current reporting.';

/** The contract for one executable turn. Pure: route + request + the bound earlier answer. */
export function executionContractOf(input: {
  readonly question: string;
  readonly language: string;
  readonly route: AskR2Route;
  readonly priorArtifact?: PriorArtifact;
}): ExecutionContract {
  const { route, priorArtifact } = input;
  const routeRelationship =
    route.relationship === null
      ? null
      : {
          countries: [...route.relationship.countries],
          relations: [...route.relationship.relations],
        };

  /* R-5 — the earlier SOURCED answer's claim, re-verified in the earlier answer's own scope */
  if (
    route.job.discourseReference === 'PRIOR_WORK' &&
    route.semantic.references.target === 'ARTIFACT_PROPOSITION' &&
    route.semantic.turn.freshness !== 'NONE' &&
    priorArtifact?.provenance === 'SOURCED_REPORTING' &&
    priorArtifact.scope !== undefined
  ) {
    const scope = priorArtifact.scope;
    return {
      kind: 'CLAIM_RECHECK',
      retrievalQuestion: scope.question,
      usePriorQuestion: false,
      stableQuestion: null,
      answerRules: CLAIM_RECHECK_RULES,
      answerData: artifactPromptBlock(priorArtifact),
      relationship:
        scope.countries.length === 2 &&
        scope.relation !== null &&
        (RELATION_KINDS as readonly string[]).includes(scope.relation)
          ? { countries: [...scope.countries], relations: [scope.relation as RelationKind] }
          : routeRelationship,
    };
  }

  /* R-1 / R-2 — a MIXED turn: retrieval for the CURRENT part, the stable part answered beside it */
  if (
    route.knowledgeRequirement === 'MIXED_REFERENCE_CURRENT' &&
    route.semantic.clauses.length >= 2
  ) {
    const text = semanticReaderText(input.question, input.language);
    /* the IR's OWN clause jobs decide the parts: a stable part is a clause that asks for an
       explanation (or a settled past) by itself; a current part asks for current reporting. A
       context frame ("Based on today's market, …") or an unclassified clause is neither, and then
       the turn is executed as it was routed (DIRECT) — never split on a guess. */
    const parts = route.semantic.clauses.map((c) => ({
      text: text.slice(c.span[0], c.span[1]).trim(),
      current: c.freshness === 'CURRENT' && c.job === 'CURRENT_REPORTING',
      stable:
        c.freshness === 'NONE' && (c.job === 'EXPLANATION' || c.job === 'HISTORICAL_REFERENCE'),
    }));
    const current = parts.filter((p) => p.current && p.text !== '').map((p) => p.text);
    const stable = parts.filter((p) => p.stable && p.text !== '').map((p) => p.text);
    if (current.length > 0 && stable.length > 0) {
      const currentText = current.join(' ');
      const stableText = stable.join(' ');
      return {
        kind: 'MIXED_CURRENT_PART',
        /* the current part carries the subject of its sibling clause(s) as context: "the current
           situation" is the current situation OF what the explanatory part is about */
        retrievalQuestion: `${currentText} (context: ${stableText})`,
        usePriorQuestion: false,
        stableQuestion: stableText,
        answerRules: MIXED_CURRENT_RULES,
        answerData:
          `<<<CURRENT PART (the reader's own words)\n${currentText}\nCURRENT PART>>>\n` +
          `<<<EXPLANATORY PART (answered separately — context only)\n${stableText}\nEXPLANATORY PART>>>`,
        relationship: routeRelationship,
      };
    }
  }

  return {
    kind: 'DIRECT',
    retrievalQuestion: input.question,
    usePriorQuestion: true,
    stableQuestion: null,
    answerRules: '',
    answerData: '',
    relationship: routeRelationship,
  };
}
