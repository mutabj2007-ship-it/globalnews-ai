import type {
  AgreementPoint,
  AnalysisEntities,
  AnalysisMode,
  AnalysisSourceRef,
  ConfidenceInfo,
  ConfidenceLevel,
  DifferenceItem,
  DifferencePosition,
  EvidenceBasis,
  EvidenceBreadth,
  NewsArticle,
  NewsAnalysisResult,
  RelationalEvidenceAssessment,
  SourcedClaim,
  TimelineEvent,
  UncertaintyItem,
} from '@globalnews-ai/shared';
import {
  buildEvidenceReferences,
  buildNormalizedEvidenceTextMap,
  normalizeExcerptText,
} from '../prompt/build-analysis-prompt.util';
import {
  resolveRelationalEvidenceAssessments,
  resolveRelationalSupport,
} from './resolve-relational-evidence-assessment.util';
import { buildRelationalComposition } from './build-relational-composition.util';
import { deriveTrustState } from './derive-trust-state.util';

export class AnalysisValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisValidationError';
  }
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AnalysisValidationError(`Expected "${field}" to be an object.`);
  }
  return value as Record<string, unknown>;
}

/**
 * Milestone #31 — the single trust boundary for citations. Resolves a
 * candidate's model-supplied "evidenceIds" (request-local S1/S2/...
 * aliases — see build-analysis-prompt.util.ts) against the exact
 * evidence map built from the same bounded article set this request
 * actually supplied to the provider, and returns ONLY the real,
 * canonical article IDs those aliases stand for.
 *
 * This is the sole point where an S-label ever becomes a trusted
 * article ID — nothing downstream of this function ever sees or stores
 * an S-label. Unknown, fabricated, malformed, out-of-scope (e.g. a real
 * article ID, a URL, or any string that isn't a currently-valid alias
 * for THIS request), or duplicate evidenceIds are silently dropped
 * rather than trusted, mirroring the pre-M31 groundedIds() behavior for
 * real article IDs. An entry with zero valid evidenceIds after
 * resolution is not grounded and is dropped by the caller, exactly as
 * before.
 */
function resolveEvidenceIds(candidate: unknown, evidenceMap: Map<string, string>): string[] {
  if (!isStringArray(candidate)) return [];
  const resolved: string[] = [];
  for (const evidenceId of candidate) {
    const articleId = evidenceMap.get(evidenceId);
    if (articleId && !resolved.includes(articleId)) {
      resolved.push(articleId);
    }
  }
  return resolved;
}

/**
 * Milestone #32 — deterministic, backend-only fact about citation
 * breadth for one already-grounded entry. Computed strictly from the
 * entry's own resolved (real, deduplicated) sourceArticleIds — never
 * from anything the provider emits. This is a count, not a semantic
 * support judgment; see EvidenceBreadth's doc comment in shared/.
 */
function computeEvidenceBreadth(sourceArticleIds: string[]): EvidenceBreadth {
  return {
    sourceCount: sourceArticleIds.length,
    singleSource: sourceArticleIds.length === 1,
  };
}

/**
 * Milestone #32 — the sole trust boundary for evidence-basis excerpts,
 * mirroring resolveEvidenceIds()'s role for citations. Accepts the
 * candidate ONLY if every one of the five CTO-authorized conditions
 * holds; otherwise returns undefined so the caller omits the field
 * entirely. Never invents, downgrades, or substitutes a synthetic
 * value — an unverifiable evidence basis is the same as no evidence
 * basis, exactly as an unresolvable evidenceId is the same as no
 * citation under M31.
 */
function resolveEvidenceBasis(
  candidate: unknown,
  evidenceMap: Map<string, string>,
  evidenceTextMap: Map<string, string>,
  resolvedSourceArticleIds: string[],
): EvidenceBasis | undefined {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return undefined;
  const obj = candidate as Record<string, unknown>;

  // Condition 4: excerpt must be non-empty after normalization.
  if (!isNonEmptyString(obj.excerpt)) return undefined;
  const normalizedExcerpt = normalizeExcerptText(obj.excerpt);
  if (normalizedExcerpt.length === 0) return undefined;

  // Condition 1: evidenceId must be a valid M31 alias for this request.
  if (!isNonEmptyString(obj.evidenceId)) return undefined;
  const articleId = evidenceMap.get(obj.evidenceId);
  // Condition 2: it must resolve to a real canonical article ID.
  if (!articleId) return undefined;

  // Condition 3: that article ID must be among THIS entry's own
  // successfully grounded sourceArticleIds — an evidence basis cannot
  // borrow grounding from an article the entry didn't itself cite.
  if (!resolvedSourceArticleIds.includes(articleId)) return undefined;

  // Condition 5: the normalized excerpt must be a deterministic
  // substring of the exact normalized/truncated evidence text supplied
  // to the model for that evidenceId — never additional article
  // content the model never saw.
  const evidenceText = evidenceTextMap.get(obj.evidenceId);
  if (!evidenceText || !evidenceText.includes(normalizedExcerpt)) return undefined;

  return { articleId, excerpt: obj.excerpt };
}

interface EvidenceContext {
  evidenceMap: Map<string, string>;
  evidenceTextMap: Map<string, string>;
  /** Milestone #40 — trusted, request-local assessmentId -> validated assessment map. Never exposed downstream; see resolveRelationalSupport. */
  assessmentsById: Map<string, RelationalEvidenceAssessment>;
}

function validateSourcedClaims(
  candidate: unknown,
  ctx: EvidenceContext,
  field: string,
): SourcedClaim[] {
  if (!Array.isArray(candidate)) {
    throw new AnalysisValidationError(`Expected "${field}" to be an array.`);
  }

  const result: SourcedClaim[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, field);
    if (!isNonEmptyString(obj.claim)) continue;
    const sourceArticleIds = resolveEvidenceIds(obj.evidenceIds, ctx.evidenceMap);
    // A key fact with zero valid supporting sources is not a
    // grounded fact — drop it rather than let it appear as one.
    if (sourceArticleIds.length === 0) continue;
    const evidenceBasis = resolveEvidenceBasis(
      obj.evidenceBasis,
      ctx.evidenceMap,
      ctx.evidenceTextMap,
      sourceArticleIds,
    );
    const relationalSupport = resolveRelationalSupport(
      obj.relationshipAssessmentIds,
      ctx.assessmentsById,
      sourceArticleIds,
    );
    result.push({
      claim: obj.claim,
      sourceArticleIds,
      evidenceBreadth: computeEvidenceBreadth(sourceArticleIds),
      ...(evidenceBasis ? { evidenceBasis } : {}),
      ...(relationalSupport ? { relationalSupport } : {}),
    });
  }
  return result;
}

function validateAgreements(candidate: unknown, ctx: EvidenceContext): AgreementPoint[] {
  if (!Array.isArray(candidate)) {
    throw new AnalysisValidationError('Expected "agreements" to be an array.');
  }
  const result: AgreementPoint[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, 'agreements[]');
    if (!isNonEmptyString(obj.point)) continue;
    const sourceArticleIds = resolveEvidenceIds(obj.evidenceIds, ctx.evidenceMap);
    if (sourceArticleIds.length === 0) continue;
    const evidenceBasis = resolveEvidenceBasis(
      obj.evidenceBasis,
      ctx.evidenceMap,
      ctx.evidenceTextMap,
      sourceArticleIds,
    );
    const relationalSupport = resolveRelationalSupport(
      obj.relationshipAssessmentIds,
      ctx.assessmentsById,
      sourceArticleIds,
    );
    result.push({
      point: obj.point,
      sourceArticleIds,
      evidenceBreadth: computeEvidenceBreadth(sourceArticleIds),
      ...(evidenceBasis ? { evidenceBasis } : {}),
      ...(relationalSupport ? { relationalSupport } : {}),
    });
  }
  return result;
}

function validatePositions(candidate: unknown, ctx: EvidenceContext): DifferencePosition[] {
  if (!Array.isArray(candidate)) return [];
  const result: DifferencePosition[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, 'differences[].positions[]');
    if (!isNonEmptyString(obj.description)) continue;
    const sourceArticleIds = resolveEvidenceIds(obj.evidenceIds, ctx.evidenceMap);
    if (sourceArticleIds.length === 0) continue;
    const evidenceBasis = resolveEvidenceBasis(
      obj.evidenceBasis,
      ctx.evidenceMap,
      ctx.evidenceTextMap,
      sourceArticleIds,
    );
    const relationalSupport = resolveRelationalSupport(
      obj.relationshipAssessmentIds,
      ctx.assessmentsById,
      sourceArticleIds,
    );
    result.push({
      description: obj.description,
      sourceArticleIds,
      evidenceBreadth: computeEvidenceBreadth(sourceArticleIds),
      ...(evidenceBasis ? { evidenceBasis } : {}),
      ...(relationalSupport ? { relationalSupport } : {}),
    });
  }
  return result;
}

function validateDifferences(candidate: unknown, ctx: EvidenceContext): DifferenceItem[] {
  if (!Array.isArray(candidate)) {
    throw new AnalysisValidationError('Expected "differences" to be an array.');
  }
  const result: DifferenceItem[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, 'differences[]');
    if (!isNonEmptyString(obj.topic)) continue;
    const positions = validatePositions(obj.positions, ctx);
    if (positions.length === 0) continue;
    result.push({ topic: obj.topic, positions });
  }
  return result;
}

function validateTimeline(candidate: unknown, ctx: EvidenceContext): TimelineEvent[] {
  if (!Array.isArray(candidate)) {
    throw new AnalysisValidationError('Expected "timeline" to be an array.');
  }
  const result: TimelineEvent[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, 'timeline[]');
    if (!isNonEmptyString(obj.event)) continue;
    const timestamp = isNonEmptyString(obj.timestamp) ? obj.timestamp : undefined;
    if (!timestamp || Number.isNaN(new Date(timestamp).getTime())) continue;
    const sourceArticleIds = resolveEvidenceIds(obj.evidenceIds, ctx.evidenceMap);
    if (sourceArticleIds.length === 0) continue;
    const evidenceBasis = resolveEvidenceBasis(
      obj.evidenceBasis,
      ctx.evidenceMap,
      ctx.evidenceTextMap,
      sourceArticleIds,
    );
    const relationalSupport = resolveRelationalSupport(
      obj.relationshipAssessmentIds,
      ctx.assessmentsById,
      sourceArticleIds,
    );
    result.push({
      timestamp,
      event: obj.event,
      sourceArticleIds,
      evidenceBreadth: computeEvidenceBreadth(sourceArticleIds),
      ...(evidenceBasis ? { evidenceBasis } : {}),
      ...(relationalSupport ? { relationalSupport } : {}),
    });
  }
  return result;
}

/**
 * Milestone #31 — grounded insufficient-evidence items. Unlike the
 * other sections, a zero-length sourceArticleIds is allowed to survive
 * (a general uncertainty not tied to any specific supplied article is
 * still meaningful — e.g. "no outlet reports the cause"), so this is
 * NOT dropped merely for having no resolved evidence, only for having
 * no description.
 */
function validateUncertainties(
  candidate: unknown,
  evidenceMap: Map<string, string>,
): UncertaintyItem[] {
  if (!Array.isArray(candidate)) return [];
  const result: UncertaintyItem[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, 'uncertainties[]');
    if (!isNonEmptyString(obj.description)) continue;
    const sourceArticleIds = resolveEvidenceIds(obj.evidenceIds, evidenceMap);
    result.push({ description: obj.description, sourceArticleIds });
  }
  return result;
}

const CONFIDENCE_LEVELS: ConfidenceLevel[] = ['low', 'medium', 'high'];

function validateConfidence(candidate: unknown): ConfidenceInfo {
  const obj = requireObject(candidate, 'confidence');
  const level = obj.level;
  if (!isString(level) || !CONFIDENCE_LEVELS.includes(level as ConfidenceLevel)) {
    throw new AnalysisValidationError('"confidence.level" must be one of low, medium, high.');
  }
  const score = typeof obj.score === 'number' && Number.isFinite(obj.score) ? obj.score : 0;
  const explanation = isNonEmptyString(obj.explanation)
    ? obj.explanation
    : 'No explanation provided.';
  return {
    level: level as ConfidenceLevel,
    score: Math.max(0, Math.min(100, Math.round(score))),
    explanation,
  };
}

function validateEntities(candidate: unknown): AnalysisEntities {
  const obj = requireObject(candidate, 'entities');
  const list = (value: unknown): string[] => (isStringArray(value) ? value : []);
  return {
    countries: list(obj.countries),
    locations: list(obj.locations),
    people: list(obj.people),
    organizations: list(obj.organizations),
    topics: list(obj.topics),
  };
}

/**
 * Validates and sanitizes a candidate analysis object from any
 * AnalysisProvider. Throws AnalysisValidationError for fundamentally
 * broken shapes (missing required strings, invalid confidence enum,
 * non-array sections) — this is the ONLY condition that produces
 * AnalysisService's "validation-rejected" provenance status (Milestone
 * #30). Ungrounded individual entries (claims/agreements/positions/
 * timeline events whose evidenceIds don't resolve to a real supplied
 * article) are silently dropped rather than causing a full rejection,
 * since a partially-grounded analysis is still useful and "drop the
 * unsupported bit" is exactly what grounding requires — even when every
 * entry in every section ends up dropped and the result is a
 * successful analysis with empty grounded sections. Milestone #31 does
 * not change or broaden this: citation failures never escalate to
 * validation-rejected on their own (see CTO Decision 1).
 *
 * Milestone #31 — every sourceArticleIds value returned here is a REAL
 * NewsArticle.id, resolved from the model's request-local evidenceIds
 * (S1/S2/...) via resolveEvidenceIds(). The evidence map is built fresh
 * from context.articles on every call using the same deterministic
 * assignment (buildEvidenceReferences) used to build the AI prompt for
 * this same array — see build-analysis-prompt.util.ts. No S-label is
 * ever stored on the returned NewsAnalysisResult.
 *
 * Milestone #32 — context.maxArticleChars must be the exact same
 * truncation length used to build the prompt this candidate is a
 * response to (AnalysisConfig.maxArticleChars, threaded in by
 * AnalysisService), so evidenceBasis excerpts are checked against
 * precisely what the model was shown — never a longer, untruncated
 * version of the article the model never saw. evidenceBreadth/
 * evidenceBasis are computed only for already-M31-grounded entries in
 * keyFacts/agreements/differences[].positions/timeline; uncertainties
 * is unchanged (out of M32 scope — see Milestone #32 authorization §2).
 */

/**
 * Milestone #32 — fallback truncation length used only when a caller
 * doesn't supply context.maxArticleChars, so pre-existing call sites
 * (and any future caller that hasn't been updated) keep compiling and
 * running rather than breaking outright. Mirrors
 * AnalysisConfigService's own DEFAULTS.maxArticleChars — kept as a
 * literal here rather than importing AnalysisConfigService, since this
 * module must stay a pure function with no NestJS/config dependency.
 * AnalysisService itself always passes the real configured value
 * explicitly (see analysis.service.ts), so this default is a
 * backward-compatibility safety net, not the normal path.
 */
const DEFAULT_MAX_ARTICLE_CHARS = 1200;

export function validateAnalysisResult(
  candidate: unknown,
  context: {
    query: string;
    articles: NewsArticle[];
    analysisMode: AnalysisMode;
    maxArticleChars?: number;
    /**
     * Milestone #40 (authoritative-context correction) — fail-closed
     * applicability signal. Optional and defaults to `false` (matches
     * the pre-existing-caller default of "not applicable") so any
     * caller that hasn't been updated to pass this still compiles and
     * behaves safely: relational assessments off by default, never on
     * by default. When `false`, relational assessments are forced
     * empty and no claim receives relationalSupport, REGARDLESS of what
     * the candidate/provider emits — this never relies on the model
     * having honored the prompt's "this is not a relational request"
     * instruction.
     */
    relationalContextPresent?: boolean;
    /**
     * Milestone #41 — the actual authoritative x/y pair, when this
     * request was relational. OPTIONAL and independent from
     * relationalContextPresent above (which continues to gate M40's
     * relationalEvidenceAssessments/relationalSupport fail-closed
     * behavior, unchanged). When absent — including when
     * relationalContextPresent is true but this specific field wasn't
     * supplied — relationalComposition is omitted entirely; this
     * function never invents or re-derives x/y itself (that would
     * duplicate deriveRelationalSearchQueries(), which is explicitly
     * out of scope here — see build-relational-composition.util.ts).
     */
    relationalContext?: { x: string; y: string };
  },
): NewsAnalysisResult {
  const obj = requireObject(candidate, 'analysis');

  const evidenceMap = new Map(
    buildEvidenceReferences(context.articles).map((ref) => [ref.evidenceId, ref.articleId]),
  );
  const evidenceTextMap = buildNormalizedEvidenceTextMap(
    context.articles,
    context.maxArticleChars ?? DEFAULT_MAX_ARTICLE_CHARS,
  );

  // Milestone #40 (authoritative-context correction) — fail-closed
  // applicability gate: when the current request did NOT match M37's
  // relational pattern set, the candidate's relationalEvidenceAssessments
  // are never even passed to the resolver — an empty array is used
  // instead. This protects against a malformed or disobedient provider
  // emitting relational assessments for a non-relational request; it
  // does not depend on the model having followed the "this is not a
  // relational request" prompt instruction (see build-analysis-prompt.util.ts).
  const relationalAssessmentsCandidate = context.relationalContextPresent
    ? obj.relationalEvidenceAssessments
    : [];

  // Milestone #40 — Steps A/B/C: validate every candidate relational
  // evidence assessment and build the trusted assessmentId map BEFORE
  // any claim/agreement/position/timeline entry is validated, since
  // those entries need it (Steps E/F/G/H) to resolve their own
  // relationalSupport.
  const { assessmentsById, allValidatedAssessments } = resolveRelationalEvidenceAssessments(
    relationalAssessmentsCandidate,
    evidenceMap,
    evidenceTextMap,
  );

  const evidenceCtx: EvidenceContext = { evidenceMap, evidenceTextMap, assessmentsById };

  if (!isNonEmptyString(obj.headline)) {
    throw new AnalysisValidationError('Missing or empty "headline".');
  }
  if (!isNonEmptyString(obj.summary)) {
    throw new AnalysisValidationError('Missing or empty "summary".');
  }

  const keyFacts = validateSourcedClaims(obj.keyFacts, evidenceCtx, 'keyFacts');
  const agreements = validateAgreements(obj.agreements, evidenceCtx);
  const differences = validateDifferences(obj.differences, evidenceCtx);
  const unknowns = isStringArray(obj.unknowns) ? obj.unknowns.filter(isNonEmptyString) : [];
  const uncertainties = validateUncertainties(obj.uncertainties, evidenceMap);
  const timeline = validateTimeline(obj.timeline, evidenceCtx);
  const confidence = validateConfidence(obj.confidence);
  const entities = validateEntities(obj.entities);

  const sources: AnalysisSourceRef[] = context.articles.map((article) => ({
    articleId: article.id,
    publisher: article.sourceName,
    title: article.title,
    url: article.url,
    publishedAt: article.publishedAt,
  }));

  // Milestone #41 — built from the FINAL VALIDATED keyFacts/agreements/
  // differences/timeline arrays computed just above (never from the
  // candidate) — undefined whenever relationalContext wasn't supplied,
  // exactly mirroring how relationalEvidenceAssessments/relationalSupport
  // are gated by relationalContextPresent above (a separate, independent
  // signal — see that field's own doc comment).
  const relationalComposition = context.relationalContext
    ? buildRelationalComposition(
        context.relationalContext.x,
        context.relationalContext.y,
        keyFacts,
        agreements,
        differences,
        timeline,
      )
    : undefined;

  // Milestone #42 — derived AFTER all M31-M41 validated structures are
  // available, using ONLY those already-validated structures plus the
  // already-authoritative context.analysisMode (never a second/new
  // execution-mode signal, never raw candidate fields, never
  // obj.confidence).
  const trustState = deriveTrustState(
    context.analysisMode,
    keyFacts,
    agreements,
    differences,
    timeline,
    uncertainties.length,
    relationalComposition,
  );

  return {
    query: context.query,
    headline: obj.headline,
    summary: obj.summary,
    keyFacts,
    agreements,
    differences,
    unknowns,
    uncertainties,
    timeline,
    confidence,
    entities,
    sources,
    generatedAt: new Date().toISOString(),
    analysisMode: context.analysisMode,
    // Milestone #40 — every validated assessment, regardless of
    // whether any claim ended up referencing it. Reverse/association/
    // unclear/non-substantive evidence remains visible here even when
    // no claim cites it — never filtered down to "supporting" evidence
    // only (see RelationalSupport's doc comment in shared/).
    relationalEvidenceAssessments: allValidatedAssessments,
    // Milestone #41 — undefined for every non-relational request.
    ...(relationalComposition ? { relationalComposition } : {}),
    // Milestone #42 — always present (required field), including in
    // mock mode (hard override to 'insufficient').
    trustState,
  };
}
