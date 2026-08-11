import type {
  NewsArticle,
  RelationalEvidenceAssessment,
  RelationalEvidenceDirection,
  RelationalSupport,
  RelationalSupportDirection,
} from '@globalnews-ai/shared';
import { normalizeExcerptText } from '../prompt/build-analysis-prompt.util';

const VALID_DIRECTIONS: ReadonlySet<RelationalEvidenceDirection> = new Set([
  'requested-direction',
  'reverse-direction',
  'bidirectional',
  'association-only',
  'unclear',
  'non-substantive',
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRelationalEvidenceDirection(value: unknown): value is RelationalEvidenceDirection {
  return typeof value === 'string' && VALID_DIRECTIONS.has(value as RelationalEvidenceDirection);
}

/**
 * Milestone #40 — Steps 1-7 of the approved validation order: identify
 * raw assessmentId occurrences in the candidate array BEFORE trusting
 * or even inspecting evidenceId/excerpt/direction, invalidate ANY
 * assessmentId occurring more than once regardless of whether either
 * occurrence would individually validate (fail-closed, per CTO
 * correction — a {valid, malformed} duplicate pair is exactly as
 * ambiguous as a {valid, valid} pair; a malformed duplicate does NOT
 * make the other occurrence safe), then run evidenceId/excerpt/
 * direction validation only on the surviving unique assessmentIds to
 * build the trusted assessmentId -> validated assessment map.
 *
 * Mirrors resolveEvidenceBasis()'s trust template for the per-candidate
 * checks: an assessment is accepted only if its evidenceId resolves to
 * a real, currently-supplied article, its excerpt is independently
 * verified as an actual substring of the exact text shown to the model
 * for that article, and its direction is one of the closed enum
 * values. A malformed/unverifiable candidate is dropped, never
 * downgraded to a synthetic fallback value.
 *
 * Returns BOTH:
 * - assessmentsById: the trusted map, keyed by the request-local
 *   assessmentId, for claim-level resolution (see
 *   resolveRelationalSupport below) — discarded after validation,
 *   never exposed downstream.
 * - allValidatedAssessments: every surviving assessment (regardless of
 *   whether any claim ends up referencing it), in the REAL, canonical
 *   articleId/excerpt/direction shape — this is what populates
 *   NewsAnalysisResult.relationalEvidenceAssessments, so reverse/
 *   association/unclear/non-substantive evidence remains visible even
 *   when no claim cites it.
 */
export function resolveRelationalEvidenceAssessments(
  candidate: unknown,
  evidenceMap: Map<string, string>,
  evidenceTextMap: Map<string, string>,
): {
  assessmentsById: Map<string, RelationalEvidenceAssessment>;
  allValidatedAssessments: RelationalEvidenceAssessment[];
} {
  if (!Array.isArray(candidate)) {
    return { assessmentsById: new Map(), allValidatedAssessments: [] };
  }

  // Step 2/3: identify syntactically-usable assessmentId strings and
  // count their RAW occurrences in the candidate array — BEFORE
  // trusting or even inspecting evidenceId/excerpt/direction. This
  // ordering is load-bearing: ambiguity must be determined from
  // presence alone, not from "how many occurrences would otherwise
  // validate." A candidate entry with no usable assessmentId at all
  // doesn't count toward any real ID's ambiguity and is simply
  // excluded from further consideration entirely.
  const rawEntries: Array<{ assessmentId: string; raw: Record<string, unknown> }> = [];
  const occurrenceCount = new Map<string, number>();

  for (const entry of candidate) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const obj = entry as Record<string, unknown>;
    if (!isNonEmptyString(obj.assessmentId)) continue;

    rawEntries.push({ assessmentId: obj.assessmentId, raw: obj });
    occurrenceCount.set(obj.assessmentId, (occurrenceCount.get(obj.assessmentId) ?? 0) + 1);
  }

  // Step 4: any assessmentId occurring more than once — regardless of
  // whether either occurrence, on its own, would otherwise have
  // validated — is ambiguous. A {valid, malformed} pair is JUST AS
  // ambiguous as a {valid, valid} pair: a malformed duplicate does NOT
  // make the other occurrence safe, because the model itself has
  // demonstrated it cannot be trusted to keep this ID unique within
  // its own response.
  const ambiguousAssessmentIds = new Set(
    [...occurrenceCount.entries()]
      .filter(([, count]) => count > 1)
      .map(([assessmentId]) => assessmentId),
  );

  // Steps 5/6/7: only uniquely-occurring, non-ambiguous IDs proceed to
  // evidenceId/excerpt/direction validation at all. An ambiguous ID's
  // candidate(s) are discarded here, before any of that validation
  // runs — not filtered out afterward.
  const assessmentsById = new Map<string, RelationalEvidenceAssessment>();
  const allValidatedAssessments: RelationalEvidenceAssessment[] = [];

  for (const { assessmentId, raw } of rawEntries) {
    if (ambiguousAssessmentIds.has(assessmentId)) continue; // Step 5

    if (!isNonEmptyString(raw.evidenceId)) continue;
    if (!isNonEmptyString(raw.excerpt)) continue;
    if (!isRelationalEvidenceDirection(raw.direction)) continue;

    const articleId = evidenceMap.get(raw.evidenceId);
    if (!articleId) continue; // fabricated/unknown evidenceId — dropped

    const normalizedExcerpt = normalizeExcerptText(raw.excerpt);
    if (normalizedExcerpt.length === 0) continue;

    const evidenceText = evidenceTextMap.get(raw.evidenceId);
    if (!evidenceText || !evidenceText.includes(normalizedExcerpt)) continue; // unverifiable excerpt — dropped

    const validated: RelationalEvidenceAssessment = {
      articleId,
      excerpt: raw.excerpt,
      direction: raw.direction,
    };

    // Safe without a duplicate-check here: assessmentId is guaranteed
    // unique among the entries reaching this point, since every
    // assessmentId with occurrenceCount > 1 was already excluded above
    // (Step 5) — so each surviving assessmentId can appear in
    // rawEntries at most once.
    assessmentsById.set(assessmentId, validated);
    allValidatedAssessments.push(validated);
  }

  return { assessmentsById, allValidatedAssessments };
}

/**
 * Milestone #40 — Steps E/F/G/H of the approved validation order, for
 * ONE already-grounded entry (claim/agreement/position/timeline).
 *
 * `rawAssessmentIds` is the entry's own candidate `relationshipAssessmentIds`
 * (untrusted, request-local). `assessmentsById` is the trusted map from
 * resolveRelationalEvidenceAssessments above. `resolvedSourceArticleIds`
 * is THIS entry's own already-M31-resolved sourceArticleIds — never a
 * different entry's, and never merely "any article somewhere in the
 * response."
 *
 * An assessmentId is kept for this entry ONLY if:
 * (E) it exists in the trusted map (survived Step A/B/C above), AND
 * (F) its assessment.articleId is a member of THIS entry's own
 *     resolvedSourceArticleIds — an assessment about an article the
 *     entry cites is not automatically "about this entry" merely
 *     because the article also contains a different, unrelated
 *     assessment; the entry must have actually referenced that exact
 *     assessmentId. This is the fix for the article-level linkage
 *     defect identified during design review (see Case 9 test).
 *
 * (G) direction is derived from the surviving set: if all agree, that
 *     shared direction; if more than one distinct direction survives,
 *     'mixed'.
 *
 * (H) if zero assessmentIds survive E/F (none supplied, all fabricated,
 *     all ambiguous-invalidated, or all reference articles outside this
 *     entry's own grounding), returns undefined — relationalSupport is
 *     OMITTED, never manufactured as 'unclear' or any other synthetic
 *     value. The entry's ordinary M31 grounding is completely
 *     unaffected either way.
 */
export function resolveRelationalSupport(
  rawAssessmentIds: unknown,
  assessmentsById: Map<string, RelationalEvidenceAssessment>,
  resolvedSourceArticleIds: string[],
): RelationalSupport | undefined {
  if (!Array.isArray(rawAssessmentIds)) return undefined;

  const sourceArticleIdSet = new Set(resolvedSourceArticleIds);
  const matched: RelationalEvidenceAssessment[] = [];
  const seenAssessmentIds = new Set<string>();

  for (const rawId of rawAssessmentIds) {
    if (typeof rawId !== 'string') continue;
    if (seenAssessmentIds.has(rawId)) continue; // a claim citing the same assessmentId twice contributes it once
    seenAssessmentIds.add(rawId);

    const assessment = assessmentsById.get(rawId); // Step E — unknown/fabricated/ambiguous-invalidated IDs are simply absent from this map
    if (!assessment) continue;

    if (!sourceArticleIdSet.has(assessment.articleId)) continue; // Step F

    matched.push(assessment);
  }

  if (matched.length === 0) return undefined; // Step H

  const distinctDirections = new Set(matched.map((assessment) => assessment.direction));
  const direction: RelationalSupportDirection =
    distinctDirections.size === 1 ? matched[0].direction : 'mixed'; // Step G

  return { direction, assessments: matched };
}
