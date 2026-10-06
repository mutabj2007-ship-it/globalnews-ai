import type { AskR2Route } from '../ask-router/ask-r2-route';
import { RELATION_KINDS, type RelationKind } from '../ask-router/bilateral-relationship';
import { semanticReaderText } from '../ask-router/semantic-ir/interpret-turn';
import type { InheritedScope } from '../ask-router/semantic-ir/prior-claim';
import {
  artifactPromptBlock,
  type ArtifactWindow,
  type PriorArtifact,
} from './conversation/conversation-artifact';
import {
  excludedPlaces,
  readAnswerRework,
  type AnswerReworkForm,
} from './conversation/answer-rework';

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
 *   inheritedScope      SHARED R4 CONTINUITY: the subject / scope of the SPECIFIC earlier answer the
 *                       turn is bound to, exposed to downstream shared retrieval (governed
 *                       contributors) with provenance EARLIER_TURN — null for every other turn
 * The job, freshness, geography and temporal requirement reach retrieval through the route as
 * before (reportingWindow, relationship, the composed question): no second parser exists here —
 * this module reads codes and the IR's own clause spans, never words.
 */
export type ExecutionContractKind =
  | 'DIRECT'
  | 'MIXED_CURRENT_PART'
  | 'CLAIM_RECHECK'
  | 'PRIOR_ANSWER_EVIDENCE'
  | 'PRIOR_ANSWER_CHANGE'
  | 'PRIOR_ANSWER_REWORK';

/**
 * ASK RETRIEVAL / CONVERSATION R2 (§7) — a follow-up that works on the findings of the earlier
 * SOURCED answer (a format, a priority among them, a revision). What the executor needs:
 *   form           which operation the reader asked for
 *   priorOutcome   what the earlier answer actually found — FINDINGS (it admitted evidence) or
 *                  NO_FINDINGS (its search found nothing: never an evidence bundle)
 *   evidenceUrls   the earlier answer's evidence identities, re-read from RETAINED reporting
 *   window         the earlier answer's reporting window (its own period and original instants)
 *   excluded       places the reader excluded in this turn ("not Mombasa"), ISO3
 */
export interface AnswerRework {
  readonly form: AnswerReworkForm;
  readonly priorOutcome: 'FINDINGS' | 'NO_FINDINGS';
  readonly evidenceUrls: readonly string[];
  readonly window: ArtifactWindow | null;
  readonly excluded: readonly string[];
}

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
  readonly inheritedScope: InheritedScope | null;
  /** R2 §7 — set only for PRIOR_ANSWER_REWORK */
  readonly rework?: AnswerRework;
  /**
   * R2 — a MIXED turn kept whole (DIRECT) because its explanatory part depends on the findings
   * (selfContainedStablePart): with no evidence, nothing of it is answerable from background.
   */
  readonly stableDependsOnFindings?: true;
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

const PRIOR_EVIDENCE_RULES =
  'EVIDENCE FOR YOUR EARLIER ANSWER. The reader asks which evidence stands behind the points of ' +
  'your own earlier answer (the EARLIER WORK block below). For EACH earlier point, name the ' +
  'provided source(s) that support it, or say plainly that no provided source supports it. Never ' +
  'invent, guess or describe a source that is not provided. The earlier answer is not evidence.';

const PRIOR_OFFICIAL_EVIDENCE_RULES =
  PRIOR_EVIDENCE_RULES +
  ' The reader asked for OFFICIAL evidence: news reporting is not an official source. Point only to ' +
  'governed official records provided for this request; where none supports a point, say that no ' +
  'qualifying official evidence was found.';

const PRIOR_CHANGE_RULES =
  'CHANGE SINCE YOUR EARLIER ANSWER. The reader asks what has changed since your own earlier answer ' +
  "(the EARLIER WORK block below), in that answer's scope. Report only changes the provided " +
  'evidence for this request shows, against the earlier points. If no change is evidenced, say ' +
  'that no material change is evidenced; never infer or invent a stage, step or event. The earlier ' +
  'answer is not evidence and must never be cited as current reporting.';

/*
  ASK RETRIEVAL / CONVERSATION R2 (§7) — the rules for a follow-up on the earlier answer's findings.
  Trusted rules (system); the earlier work and the reader's follow-up travel as delimited DATA.
*/
const REWORK_COMMON =
  'Do exactly what the READER FOLLOW-UP block asks (a format such as a table, a priority among ' +
  "the findings, or a revision for a corrected scope) and keep the earlier question's subject, " +
  'place and period. If the reader corrected or excluded a place, route or option, keep only the ' +
  'items relevant to the corrected scope, drop the excluded ones and say what changed. Distinguish ' +
  'reported facts from your own analysis. Never add a development that the reporting provided ' +
  'does not support; if fewer items qualify, give fewer. The earlier answer is not evidence.';

export const REWORK_REUSE_RULES =
  'FOLLOW-UP ON YOUR EARLIER ANSWER. The reader is working on your own earlier answer (the ' +
  'EARLIER WORK block below). The reporting provided is the SAME evidence that answer used, re-read ' +
  'from retained reporting: no new search was run, so never say or imply that anything was checked ' +
  'again or is newer than its own publication date, and give each item its original date. ' +
  REWORK_COMMON;

export const REWORK_RESEARCH_RULES =
  'FOLLOW-UP ON YOUR EARLIER ANSWER. The reader is working on your own earlier answer (the ' +
  'EARLIER WORK block below). Its evidence could not be re-read, so a new search was run now for ' +
  "that answer's scope: the reporting provided comes from that new search only — say so once. " +
  REWORK_COMMON;

export const REWORK_AFTER_NOTHING_RULES =
  'FOLLOW-UP AFTER AN EARLIER ANSWER THAT FOUND NOTHING. Your earlier answer (the EARLIER WORK ' +
  'block below) found no verified reporting, so there are no earlier findings to revise or ' +
  'reformat: say so plainly first and never present that earlier answer as findings. A new search ' +
  "was run now for the same question's scope (its place, subject and period); the reporting " +
  'provided comes from that new search only. ' +
  REWORK_COMMON;

/** ISO3 → the reader's own words for the place in THIS turn (the qualified reading's spans). */
function turnPlaceSpans(route: AskR2Route): Record<string, string> {
  if (route.outcome.status === 'NOT_READ') return {};
  const spans: Record<string, string> = {};
  for (const g of route.outcome.reading.geography)
    if (g.matchedText !== undefined && spans[g.value] === undefined) spans[g.value] = g.matchedText;
  return spans;
}

/** SHARED R4 CONTINUITY — the bound earlier answer's scope, as inherited (EARLIER_TURN). */
function inheritedScopeOf(prior: PriorArtifact, officialOnly: boolean): InheritedScope | null {
  if (prior.scope === undefined) return null;
  return {
    provenance: 'EARLIER_TURN',
    sourceOperationId: prior.sourceOperationId ?? null,
    question: prior.scope.question,
    countries: [...prior.scope.countries],
    relation: prior.scope.relation,
    job: prior.scope.job,
    evidenceRefs: [...(prior.evidenceRefs ?? [])],
    officialOnly,
  };
}

function scopedRelationship(
  scope: NonNullable<PriorArtifact['scope']>,
  fallback: ExecutionContract['relationship'],
): ExecutionContract['relationship'] {
  return scope.countries.length === 2 &&
    scope.relation !== null &&
    (RELATION_KINDS as readonly string[]).includes(scope.relation)
    ? { countries: [...scope.countries], relations: [scope.relation as RelationKind] }
    : fallback;
}

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

  /*
    SHARED R4 CONTINUITY — the evidence behind / the change since a SPECIFIC earlier answer: retrieval
    for THAT answer's own question, in THAT answer's scope, the earlier points as delimited data; the
    scope is inherited (EARLIER_TURN) by every downstream shared reader. Any provenance: a reasoning
    answer's evidence is truthfully "none provided", and its subject still scopes the reads.
  */
  if (
    route.priorAnswerRequest !== undefined &&
    route.job.discourseReference === 'PRIOR_WORK' &&
    priorArtifact?.scope !== undefined
  ) {
    const official = route.priorAnswerRequest === 'OFFICIAL_EVIDENCE';
    const change = route.priorAnswerRequest === 'CHANGE_SINCE';
    return {
      kind: change ? 'PRIOR_ANSWER_CHANGE' : 'PRIOR_ANSWER_EVIDENCE',
      retrievalQuestion: priorArtifact.scope.question,
      usePriorQuestion: false,
      stableQuestion: null,
      answerRules: change
        ? PRIOR_CHANGE_RULES
        : official
          ? PRIOR_OFFICIAL_EVIDENCE_RULES
          : PRIOR_EVIDENCE_RULES,
      answerData: artifactPromptBlock(priorArtifact),
      relationship: scopedRelationship(priorArtifact.scope, routeRelationship),
      inheritedScope: inheritedScopeOf(priorArtifact, official),
    };
  }

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
      relationship: scopedRelationship(scope, routeRelationship),
      /* the re-verified claim's subject reaches shared retrieval as inherited (EARLIER_TURN) */
      inheritedScope: inheritedScopeOf(priorArtifact, false),
    };
  }

  /*
    ASK RETRIEVAL / CONVERSATION R2 (§7) — A FOLLOW-UP ON THE EARLIER ANSWER'S FINDINGS. "Put those
    developments in a table", "Which should a small shopkeeper watch most closely?", "My shipment
    goes through Dar es Salaam, not Mombasa. Revise your answer…" operate on what the earlier
    SOURCED answer found: bound to THAT answer (its subject, place and period, inherited as
    EARLIER_TURN), its evidence re-read instead of a fresh unrelated search — and, when the earlier
    search found nothing, that outcome is stated and a new search runs only for the same scope.
    A format / priority turn that names a place of its own outside that scope is a new question.
  */
  const reworkForm = readAnswerRework(input.question, input.language);
  if (
    reworkForm !== null &&
    priorArtifact !== undefined &&
    priorArtifact.scope !== undefined &&
    /* an answer that stood on sourced reporting (or whose search found nothing), or a reasoning
       answer given beside a current part that found no verified reporting */
    ((priorArtifact.kind === 'SOURCED_REPORT' &&
      priorArtifact.provenance === 'SOURCED_REPORTING') ||
      (priorArtifact.kind === 'REASONED_ANSWER' && priorArtifact.currentFindings === 'NONE'))
  ) {
    const scope = priorArtifact.scope;
    const excluded = excludedPlaces(input.question, input.language, turnPlaceSpans(route));
    const typed = route.envelope.geography.candidates
      .filter((c) => c.source === 'TYPED_GEOGRAPHY')
      .map((c) => c.value)
      .filter((iso3) => !excluded.includes(iso3));
    const ownPlaceOutsideScope = typed.some((iso3) => !scope.countries.includes(iso3));
    if (reworkForm === 'REVISION' || !ownPlaceOutsideScope) {
      const findings =
        priorArtifact.kind === 'SOURCED_REPORT' && (priorArtifact.evidenceRefs ?? []).length > 0;
      const inherited = inheritedScopeOf(priorArtifact, false);
      const countries = [...new Set([...scope.countries, ...typed])].filter(
        (iso3) => !excluded.includes(iso3),
      );
      return {
        kind: 'PRIOR_ANSWER_REWORK',
        /* searched only when a search is needed: the earlier scope, as the reader revised it */
        retrievalQuestion:
          reworkForm === 'REVISION'
            ? `${scope.question} (revised by the reader: ${input.question})`
            : scope.question,
        usePriorQuestion: false,
        stableQuestion: null,
        answerRules: findings ? REWORK_REUSE_RULES : REWORK_AFTER_NOTHING_RULES,
        answerData:
          `${artifactPromptBlock(priorArtifact)}\n` +
          `<<<READER FOLLOW-UP (the reader's own words — what to do now)\n${input.question}\nREADER FOLLOW-UP>>>`,
        relationship: scopedRelationship(scope, routeRelationship),
        inheritedScope: inherited === null ? null : { ...inherited, countries },
        rework: {
          form: reworkForm,
          priorOutcome: findings ? 'FINDINGS' : 'NO_FINDINGS',
          evidenceUrls: findings ? [...(priorArtifact.evidenceUrls ?? [])] : [],
          window: scope.window ?? null,
          excluded,
        },
      };
    }
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
    /*
      ASK RETRIEVAL / CONVERSATION R2 — SPLIT ONLY A PART THAT STANDS ON ITS OWN.
      "…Finish by explaining, in no more than 60 words, which development a small shopkeeper should
      watch most closely and why." was read as a separate EXPLANATION clause and sent to the
      reasoning model by itself; it answered "what do you mean by why?" above the sourced answer,
      and the table, dates and the closing priority were lost (Alpha 2026-10-06 06:24 UTC). An
      explanatory part that points back at the findings, or is an instruction about the answer, is
      part of ONE request: the turn is then executed whole (DIRECT), with every instruction intact.
    */
    if (current.length > 0 && stable.length > 0 && stable.every(selfContainedStablePart)) {
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
        inheritedScope: null,
      };
    }
    /* R2 — kept whole because its explanatory part depends on the findings (see below): marked,
       so a retrieval that finds nothing is never answered from background as if it were stable */
    if (current.length > 0 && stable.length > 0)
      return {
        kind: 'DIRECT',
        retrievalQuestion: input.question,
        usePriorQuestion: true,
        stableQuestion: null,
        answerRules: '',
        answerData: '',
        relationship: routeRelationship,
        inheritedScope: null,
        stableDependsOnFindings: true,
      };
  }

  return {
    kind: 'DIRECT',
    retrievalQuestion: input.question,
    usePriorQuestion: true,
    stableQuestion: null,
    answerRules: '',
    answerData: '',
    relationship: routeRelationship,
    inheritedScope: null,
  };
}

/*
  ASK RETRIEVAL / CONVERSATION R2 — whether an explanatory part can be answered on its own.
  Not on its own: a bare "why" / "and why", a part that points back at the findings of the same
  request ("which development…", "those", "these", "it", "the above"), or an instruction about the
  answer itself ("Finish by…", "End with…", "Conclude…"). EN and PL (the deterministic reader's
  languages); any other wording keeps the existing split, which is unchanged.
*/
const STABLE_BACK_REFERENCE =
  /\b(?:those|these|them|it|its|which\s+(?:development|developments|one|ones|of\s+(?:these|those|them))|the\s+(?:development|developments|findings|above|ones?\s+above))\b|(?<![\p{L}\p{N}])(?:te|tych|któr\p{L}*|powyższ\p{L}*)(?![\p{L}\p{N}])/iu;
const STABLE_ANSWER_INSTRUCTION =
  /^(?:and\s+|then\s+)?(?:finish|end|conclude|close|wrap\s+up|summari[sz]e|explain(?:ing)?\s+(?:in|which|briefly)|in\s+no\s+more\s+than)\b|^(?:i\s+)?(?:zakończ|podsumuj|na\s+koniec)/iu;
const STABLE_FILLER = new Set([
  'why', 'and', 'or', 'also', 'how', 'what', 'is', 'are', 'was', 'were', 'does', 'do', 'did',
  'the', 'a', 'an', 'so', 'then', 'dlaczego', 'czemu', 'i', 'oraz', 'a',
]);

export function selfContainedStablePart(text: string): boolean {
  const t = text.trim().replace(/[?.!,;:]+$/u, '');
  if (STABLE_ANSWER_INSTRUCTION.test(t)) return false;
  if (STABLE_BACK_REFERENCE.test(t)) return false;
  const content = t
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0 && !STABLE_FILLER.has(w));
  return content.length >= 1;
}
