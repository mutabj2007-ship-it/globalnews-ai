import type {
  AgreementPoint,
  AnalysisEntities,
  AnalysisMode,
  AnalysisSourceRef,
  ConfidenceInfo,
  ConfidenceLevel,
  DifferenceItem,
  DifferencePosition,
  NewsArticle,
  NewsAnalysisResult,
  SourcedClaim,
  TimelineEvent,
} from '@globalnews-ai/shared';

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
 * Keeps only the sourceArticleIds that actually correspond to an
 * article we sent to the model. This is the core grounding rule from
 * Sprint 5.1: an AI statement citing a nonexistent or hallucinated
 * article ID is not evidence of anything, so those IDs are dropped
 * rather than trusted.
 */
function groundedIds(candidate: unknown, validIds: Set<string>): string[] {
  if (!isStringArray(candidate)) return [];
  return candidate.filter((id) => validIds.has(id));
}

function validateSourcedClaims(candidate: unknown, validIds: Set<string>, field: string): SourcedClaim[] {
  if (!Array.isArray(candidate)) {
    throw new AnalysisValidationError(`Expected "${field}" to be an array.`);
  }

  const result: SourcedClaim[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, field);
    if (!isNonEmptyString(obj.claim)) continue;
    const sourceArticleIds = groundedIds(obj.sourceArticleIds, validIds);
    // A key fact with zero valid supporting sources is not a
    // grounded fact — drop it rather than let it appear as one.
    if (sourceArticleIds.length === 0) continue;
    result.push({ claim: obj.claim, sourceArticleIds });
  }
  return result;
}

function validateAgreements(candidate: unknown, validIds: Set<string>): AgreementPoint[] {
  if (!Array.isArray(candidate)) {
    throw new AnalysisValidationError('Expected "agreements" to be an array.');
  }
  const result: AgreementPoint[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, 'agreements[]');
    if (!isNonEmptyString(obj.point)) continue;
    const sourceArticleIds = groundedIds(obj.sourceArticleIds, validIds);
    if (sourceArticleIds.length === 0) continue;
    result.push({ point: obj.point, sourceArticleIds });
  }
  return result;
}

function validatePositions(candidate: unknown, validIds: Set<string>): DifferencePosition[] {
  if (!Array.isArray(candidate)) return [];
  const result: DifferencePosition[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, 'differences[].positions[]');
    if (!isNonEmptyString(obj.description)) continue;
    const sourceArticleIds = groundedIds(obj.sourceArticleIds, validIds);
    if (sourceArticleIds.length === 0) continue;
    result.push({ description: obj.description, sourceArticleIds });
  }
  return result;
}

function validateDifferences(candidate: unknown, validIds: Set<string>): DifferenceItem[] {
  if (!Array.isArray(candidate)) {
    throw new AnalysisValidationError('Expected "differences" to be an array.');
  }
  const result: DifferenceItem[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, 'differences[]');
    if (!isNonEmptyString(obj.topic)) continue;
    const positions = validatePositions(obj.positions, validIds);
    if (positions.length === 0) continue;
    result.push({ topic: obj.topic, positions });
  }
  return result;
}

function validateTimeline(candidate: unknown, validIds: Set<string>): TimelineEvent[] {
  if (!Array.isArray(candidate)) {
    throw new AnalysisValidationError('Expected "timeline" to be an array.');
  }
  const result: TimelineEvent[] = [];
  for (const entry of candidate) {
    const obj = requireObject(entry, 'timeline[]');
    if (!isNonEmptyString(obj.event)) continue;
    const timestamp = isNonEmptyString(obj.timestamp) ? obj.timestamp : undefined;
    if (!timestamp || Number.isNaN(new Date(timestamp).getTime())) continue;
    const sourceArticleIds = groundedIds(obj.sourceArticleIds, validIds);
    if (sourceArticleIds.length === 0) continue;
    result.push({ timestamp, event: obj.event, sourceArticleIds });
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
  const explanation = isNonEmptyString(obj.explanation) ? obj.explanation : 'No explanation provided.';
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
 * non-array sections). Ungrounded individual entries (claims/agreements
 * /positions/timeline events whose sourceArticleIds don't correspond to
 * a real supplied article) are silently dropped rather than causing a
 * full rejection, since a partially-grounded analysis is still useful
 * and "drop the unsupported bit" is exactly what grounding requires.
 */
export function validateAnalysisResult(
  candidate: unknown,
  context: { query: string; articles: NewsArticle[]; analysisMode: AnalysisMode },
): NewsAnalysisResult {
  const obj = requireObject(candidate, 'analysis');
  const validIds = new Set(context.articles.map((article) => article.id));

  if (!isNonEmptyString(obj.headline)) {
    throw new AnalysisValidationError('Missing or empty "headline".');
  }
  if (!isNonEmptyString(obj.summary)) {
    throw new AnalysisValidationError('Missing or empty "summary".');
  }

  const keyFacts = validateSourcedClaims(obj.keyFacts, validIds, 'keyFacts');
  const agreements = validateAgreements(obj.agreements, validIds);
  const differences = validateDifferences(obj.differences, validIds);
  const unknowns = isStringArray(obj.unknowns) ? obj.unknowns.filter(isNonEmptyString) : [];
  const timeline = validateTimeline(obj.timeline, validIds);
  const confidence = validateConfidence(obj.confidence);
  const entities = validateEntities(obj.entities);

  const sources: AnalysisSourceRef[] = context.articles.map((article) => ({
    articleId: article.id,
    publisher: article.sourceName,
    title: article.title,
    url: article.url,
    publishedAt: article.publishedAt,
  }));

  return {
    query: context.query,
    headline: obj.headline,
    summary: obj.summary,
    keyFacts,
    agreements,
    differences,
    unknowns,
    timeline,
    confidence,
    entities,
    sources,
    generatedAt: new Date().toISOString(),
    analysisMode: context.analysisMode,
  };
}
