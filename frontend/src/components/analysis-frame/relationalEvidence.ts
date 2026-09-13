import type {
  AnalysisApiResponse,
  RelationalEvidenceAssessment,
  RelationalEvidenceDirection,
} from '@globalnews-ai/shared';

/**
 * R4.2 — RELATIONAL COUNTER-EVIDENCE, BOUND TO ITS SOURCE.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────
 *
 * `analysis.relationalEvidenceAssessments` is a real production output —
 * the provider schema requests it, `validate-analysis-result.ts:788`
 * writes it, and `analysis.service.ts:943` returns the analysis whole. The
 * frontend rendered none of it.
 *
 * What made that a defect rather than a missing nicety is the contract's
 * own stated intent, repeated in `validate-analysis-result.ts` and in the
 * shared type: "Reverse/association/unclear/non-substantive evidence
 * remains visible here even when no claim cites it — never filtered down
 * to 'supporting' evidence only."
 *
 * This array is the ONLY carrier of validated relational evidence that no
 * claim references. `relationalComposition`, which the workspace already
 * renders, indexes CLAIMS — so an assessment nothing cites has no
 * ClaimReference and was reachable through nothing at all. The reader saw
 * a count of reverse evidence and could never open it.
 *
 * ── WHAT THE DIRECTION DOES AND DOES NOT MEAN ─────────────────────────
 *
 * The six directions are the contract's own, and none of them is a causal
 * finding. `RelationalEvidenceDirection`'s doc comment is explicit:
 * "Establishes only 'this excerpt is evidence relevant to the relationship
 * between X and Y in this sense' — never 'X caused Y'."
 *
 * The validation split matters just as much and is surfaced to the reader:
 * the EXCERPT is backend-verified to be real text from the article the
 * model was shown, while the DIRECTION is the model's own classification,
 * which "the backend cannot verify ... only that the excerpt is real".
 * Two different confidences, never merged into one.
 *
 * Nothing here re-labels a direction. `reverse-direction` stays reverse.
 * `association-only` never becomes support. `bidirectional` is kept
 * distinct from `requested-direction` even though the contract counts both
 * as direct support, because collapsing them would invent a category the
 * response did not return.
 */

export type { RelationalEvidenceDirection };

/** The contract's six values, in the order the panel presents them. */
export const RELATIONAL_DIRECTIONS: readonly RelationalEvidenceDirection[] = [
  'requested-direction',
  'bidirectional',
  'reverse-direction',
  'association-only',
  'unclear',
  'non-substantive',
];

export interface SourceRelationalGroup {
  readonly articleId: string;
  readonly assessments: readonly RelationalEvidenceAssessment[];
}

export interface RelationalEvidenceModel {
  /**
   * False when the response carries no assessments at all. The dock must
   * then render NOTHING extra — not a zero, and not an empty panel, which
   * would imply the provider evaluated a relational question and found
   * none.
   */
  readonly present: boolean;
  readonly total: number;
  /** Groups whose articleId IS in the dock, in the dock's own order. */
  readonly matched: readonly SourceRelationalGroup[];
  /**
   * Groups whose articleId is NOT among the retrieved articles. Never
   * discarded and never attached to an invented source — surfaced under
   * their own honest heading instead.
   */
  readonly unmatched: readonly SourceRelationalGroup[];
  readonly countsByDirection: Readonly<Record<RelationalEvidenceDirection, number>>;
  /** Assessments carried by unmatched sources — reported, not hidden. */
  readonly unmatchedCount: number;
}

const ZERO_COUNTS: Record<RelationalEvidenceDirection, number> = {
  'requested-direction': 0,
  bidirectional: 0,
  'reverse-direction': 0,
  'association-only': 0,
  unclear: 0,
  'non-substantive': 0,
};

export const EMPTY_RELATIONAL_EVIDENCE: RelationalEvidenceModel = {
  present: false,
  total: 0,
  matched: [],
  unmatched: [],
  countsByDirection: { ...ZERO_COUNTS },
  unmatchedCount: 0,
};

/**
 * Identity for de-duplication.
 *
 * The same excerpt may be referenced by several claims. Those are the same
 * piece of evidence and must render once. Two assessments quoting
 * DIFFERENT text, or the same text classified differently, are genuinely
 * different records and both survive.
 */
function identityOf(a: RelationalEvidenceAssessment): string {
  return `${a.articleId} ${a.direction} ${a.excerpt}`;
}

function isUsable(
  a: RelationalEvidenceAssessment | null | undefined,
): a is RelationalEvidenceAssessment {
  return (
    a !== null &&
    a !== undefined &&
    typeof a.articleId === 'string' &&
    a.articleId.length > 0 &&
    typeof a.excerpt === 'string' &&
    a.excerpt.trim().length > 0 &&
    typeof a.direction === 'string'
  );
}

export function buildRelationalEvidence(
  response: AnalysisApiResponse | null,
): RelationalEvidenceModel {
  const raw = response?.analysis?.relationalEvidenceAssessments;
  if (raw === undefined || raw === null || raw.length === 0) return EMPTY_RELATIONAL_EVIDENCE;

  const seen = new Set<string>();
  const byArticle = new Map<string, RelationalEvidenceAssessment[]>();
  const counts: Record<RelationalEvidenceDirection, number> = { ...ZERO_COUNTS };
  let total = 0;

  for (const assessment of raw) {
    if (!isUsable(assessment)) continue;
    const id = identityOf(assessment);
    if (seen.has(id)) continue;
    seen.add(id);

    const bucket = byArticle.get(assessment.articleId) ?? [];
    bucket.push(assessment);
    byArticle.set(assessment.articleId, bucket);
    total += 1;
    if (assessment.direction in counts) counts[assessment.direction] += 1;
  }

  if (total === 0) return EMPTY_RELATIONAL_EVIDENCE;

  /*
   * Matched groups follow the DOCK's order, not the assessments' order, so
   * a source's evidence appears with that source rather than reordering
   * the dock around the model's output.
   */
  const articleIds = (response?.articles ?? []).map((a) => a.id);
  const known = new Set(articleIds);

  const matched: SourceRelationalGroup[] = [];
  for (const articleId of articleIds) {
    const assessments = byArticle.get(articleId);
    if (assessments !== undefined && assessments.length > 0) {
      matched.push({ articleId, assessments });
    }
  }

  const unmatched: SourceRelationalGroup[] = [];
  let unmatchedCount = 0;
  for (const [articleId, assessments] of byArticle) {
    if (known.has(articleId)) continue;
    unmatched.push({ articleId, assessments });
    unmatchedCount += assessments.length;
  }

  return {
    present: true,
    total,
    matched,
    unmatched,
    countsByDirection: counts,
    unmatchedCount,
  };
}

/** The assessments for one source. Never another source's. */
export function assessmentsFor(
  model: RelationalEvidenceModel,
  articleId: string,
): readonly RelationalEvidenceAssessment[] {
  return model.matched.find((g) => g.articleId === articleId)?.assessments ?? [];
}
