import {
  projectSummaryStatements,
  type SummaryStatement,
  type SummaryStatementKind,
} from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK INLINE EVIDENCE CITATIONS + INFERENCE LABEL R1 — THE BACKEND AUTHORITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Two jobs, both deterministic and both independent of prompt obedience.
 *
 * 1. CITATION AUTHORITY. The model may annotate its own summary: for each
 *    sentence, an exact copy, a kind, and the request-local evidenceIds it
 *    rests on. Every annotation is re-checked here — the ids through the same
 *    resolver every other cited field uses, the text by exact placement in the
 *    summary. A reported sentence whose ids do not resolve is not cited: it is
 *    marked UNSUPPORTED; one that cites nothing is left un-annotated (plain
 *    summary, as before). Nothing is ever cited that this file did not resolve.
 *
 * 2. INFERENCE AUTHORITY. PR #42 ASKED the model to write "Analytical
 *    inference:" before an unreported implication; the live Congo answer did
 *    not, and "could potentially affect military operations" read as fact.
 *    Asking is not enforcing. So a sentence that speaks in speculative modality
 *    ("could", "may", "potentially", "może", "prawdopodobnie") WITHOUT
 *    attributing that speculation to someone in the reporting is labelled
 *    ANALYTICAL_INFERENCE — whether the model annotated it as a fact, or did not
 *    annotate it at all. The same test keeps such sentences out of
 *    immediateImpacts / spilloverImplications / affectedParties unless the
 *    verified evidence excerpt itself carries the speculation.
 *
 * WHAT IT NEVER DOES: rewrite, reorder, add or remove summary text. The summary
 * the reader sees is byte-identical; only the annotation is governed here.
 */

/* Speculative modality. `(?<!\p{L})…(?!\p{L})` because \b does not see Polish letters. */
const SPECULATIVE_CI =
  /(?<!\p{L})(could|might|would|potentially|possibly|perhaps|conceivably|likely|unlikely|mo[żz]e|mog[ąa]|mog[łl]oby|mog[łl]aby|m[óo]g[łl]by|mog[łl]yby|mogliby|prawdopodobnie|potencjalnie|ewentualnie|przypuszczalnie)(?!\p{L})/iu;
/* "may" only in lower case: "In May, the army…" is a month, not a modal. */
const SPECULATIVE_MAY = /(?<!\p{L})may(?!\p{L})/u;

/* The speculation is SOMEONE ELSE'S when the sentence attributes it. */
const ATTRIBUTED =
  /(?<!\p{L})(said|says|told|stated|warned|warns|announced|according to|reported|claimed|confirmed|estimated|predicted|cautioned|powiedzia[łl][aoy]?|powiedzieli|poinformowa[łl][aoy]?|poinformowali|wed[łl]ug|o[śs]wiadczy[łl][aoy]?|ostrzeg[łl]a?|ostrzegaj[ąa]|ostrzega|przekaza[łl][aoy]?|zapowiedzia[łl][aoy]?|poda[łl][aoy]?|twierdzi|twierdz[ąa]|szacuje|szacuj[ąa]|przewiduje|przewiduj[ąa])(?!\p{L})/iu;

export function isSpeculative(text: string): boolean {
  return SPECULATIVE_CI.test(text) || SPECULATIVE_MAY.test(text);
}

/**
 * True when `text` voices a possibility in our own voice: speculative, not
 * attributed, and — when a verified evidence excerpt is supplied — not a
 * speculation the excerpt itself makes.
 */
export function isUnreportedAnalyticalInference(text: string, verifiedExcerpt?: string): boolean {
  if (!isSpeculative(text)) return false;
  if (ATTRIBUTED.test(text)) return false;
  if (verifiedExcerpt !== undefined && isSpeculative(verifiedExcerpt)) return false;
  return true;
}

const MODEL_KINDS: ReadonlySet<string> = new Set([
  'REPORTED_FACT',
  'REPORTED_CONSEQUENCE',
  'ANALYTICAL_INFERENCE',
]);

/** Sentence boundaries inside an un-annotated stretch of summary. */
function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+(?=[\p{Lu}\p{N}"“„(])/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function readCandidates(
  candidate: unknown,
  evidenceMap: Map<string, string>,
): SummaryStatement[] {
  if (!Array.isArray(candidate)) return [];
  const statements: SummaryStatement[] = [];

  for (const entry of candidate) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const raw = entry as Record<string, unknown>;
    if (typeof raw.text !== 'string' || typeof raw.kind !== 'string') continue;
    const text = raw.text.trim();
    /* A span across a paragraph break cannot be placed inside one paragraph. */
    if (text.length === 0 || /\n/.test(text)) continue;
    if (!MODEL_KINDS.has(raw.kind)) continue;

    const ids: string[] = [];
    if (Array.isArray(raw.evidenceIds)) {
      for (const id of raw.evidenceIds) {
        const articleId = typeof id === 'string' ? evidenceMap.get(id) : undefined;
        if (articleId !== undefined && !ids.includes(articleId)) ids.push(articleId);
      }
    }

    const claimedIds = Array.isArray(raw.evidenceIds) ? raw.evidenceIds.length : 0;
    let kind = raw.kind as SummaryStatementKind;
    if (kind !== 'ANALYTICAL_INFERENCE' && isUnreportedAnalyticalInference(text)) {
      kind = 'ANALYTICAL_INFERENCE';
    } else if (kind !== 'ANALYTICAL_INFERENCE' && ids.length === 0) {
      /*
        Cited nothing: no citation claim to judge, so no annotation — the
        sentence renders as plain summary, exactly as before (a sentence that
        states a gap, "the reporting does not establish the cause", is honest
        and uncited). Cited something that did not resolve: the sentence
        claimed support it does not have, and says so.
      */
      if (claimedIds === 0) continue;
      kind = 'UNSUPPORTED';
    }

    statements.push({
      text,
      kind,
      sourceArticleIds: kind === 'REPORTED_FACT' || kind === 'REPORTED_CONSEQUENCE' ? ids : [],
    });
  }

  return statements;
}

/**
 * The validated annotation of `summary`, in summary order. Empty when the
 * summary is empty. Model annotations that cannot be placed exactly are
 * dropped; every stretch the model left un-annotated is still checked, and a
 * sentence there that is an unreported inference is labelled as one.
 */
export function validateSummaryStatements(
  candidate: unknown,
  summary: string,
  evidenceMap: Map<string, string>,
): SummaryStatement[] {
  if (summary.trim().length === 0) return [];

  const { segments } = projectSummaryStatements(summary, readCandidates(candidate, evidenceMap));
  const result: SummaryStatement[] = [];

  for (const segment of segments) {
    if (segment.statement !== undefined) {
      result.push(segment.statement);
      continue;
    }
    for (const sentence of sentencesOf(segment.text)) {
      if (isUnreportedAnalyticalInference(sentence)) {
        result.push({ text: sentence, kind: 'ANALYTICAL_INFERENCE', sourceArticleIds: [] });
      }
    }
  }

  return result;
}

/**
 * ANCHORING R1 GATE C, EXTENDED TO THE SUMMARY. A consequence the reporting is
 * said to establish, but whose only support is CONTEXT_ONLY evidence, is not
 * established: it becomes UNSUPPORTED and loses its citations. Mirrors
 * withholdContextOnlyConsequenceClaims() — the summary text itself is never
 * removed, only its claim to be reported.
 */
export function demoteContextOnlyConsequenceStatements(
  statements: readonly SummaryStatement[] | undefined,
  contextArticleIds: ReadonlySet<string>,
): { statements: SummaryStatement[] | undefined; demoted: number } {
  if (statements === undefined || contextArticleIds.size === 0) {
    return { statements: statements === undefined ? undefined : [...statements], demoted: 0 };
  }
  let demoted = 0;
  const next = statements.map((statement) => {
    const contextOnly =
      statement.kind === 'REPORTED_CONSEQUENCE' &&
      statement.sourceArticleIds.length > 0 &&
      statement.sourceArticleIds.every((id) => contextArticleIds.has(id));
    if (!contextOnly) return statement;
    demoted += 1;
    return { text: statement.text, kind: 'UNSUPPORTED' as const, sourceArticleIds: [] };
  });
  return { statements: next, demoted };
}
