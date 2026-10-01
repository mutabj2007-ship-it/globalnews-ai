/*
 * PUBLIC BETA HARDENING R1E — EVALUATION-ONLY PROTOTYPES of the R1D options.
 *
 * NOT product code. Nothing in backend/src imports this file. Every signal is an EXISTING
 * repository function, imported (never re-implemented); every weight, cap and precedence here is
 * an UNVALIDATED prototype parameter, stated in the output so a reviewer can see it.
 */
import type { NewsArticle } from '@globalnews-ai/shared';
import { containsUnresolvedTemplatePlaceholder } from '../../../src/modules/news/article-metadata-hygiene.util';
import { detectArticleDomains } from '../../../src/modules/analysis/query/detect-analytical-domains.util';
import { newsRoleOf } from '../../../src/modules/news/evidence/evidence-candidate';
import { resolvePublisherIdentity } from '../../../src/modules/news/identity/publisher-identity.util';
import { scoreArticleConfidence } from '../../../src/modules/news/analysis/article-confidence.util';

/** The same bounded evidence size the product uses (AnalysisConfig maxArticles default). */
export const SLOTS = 8;

export interface Selection {
  readonly selected: NewsArticle[];
  readonly notes: Record<string, string>;
}

/* ── OPTION A — provider order + a NARROW, evidence-based unsuitability screen ─────────────── */
/**
 * The ONLY existing repository detector of an unsuitable item is the metadata-hygiene check for an
 * unresolved CMS template in the text (article-metadata-hygiene.util.ts). No category is used, no
 * topic is banned. Everything else keeps provider order.
 */
export function optionA(candidates: readonly NewsArticle[]): Selection {
  const notes: Record<string, string> = {};
  const kept = candidates.filter((article) => {
    const broken =
      containsUnresolvedTemplatePlaceholder(article.title) ||
      containsUnresolvedTemplatePlaceholder(article.summary ?? '');
    if (broken) notes[article.id] = 'EXCLUDED: unresolved CMS template placeholder in text';
    return !broken;
  });
  return { selected: kept.slice(0, SLOTS), notes };
}

/* ── OPTION B — visible score from existing signals only ──────────────────────────────────── */
export interface ScoreBreakdown {
  readonly analyticalDomains: { readonly value: number; readonly detail: string };
  readonly countryAttributed: { readonly value: number; readonly detail: string };
  readonly sourceRole: { readonly value: number; readonly detail: string };
  readonly corroboration: { readonly value: number; readonly detail: string };
  readonly freshness: { readonly value: number; readonly detail: string };
  readonly storedConfidence: { readonly value: number; readonly detail: string };
  readonly total: number;
}

/**
 * Equal-weight sum of components, each from an existing function. A missing signal contributes 0.
 * Category is NOT a component (R1D: category alone is not a significance signal); provider
 * position is used ONLY as the tie-break.
 */
export function scoreB(
  article: NewsArticle,
  clusterSize: number,
  nowMs: number,
): ScoreBreakdown {
  const domains = [...detectArticleDomains({ title: article.title, summary: article.summary })];
  const role = newsRoleOf(article);
  const roleValue = role === 'WIRE_REPORTING' || role === 'OFFICIAL_WEB' ? 1 : 0;
  const freshnessBonus = scoreArticleConfidence({ publishedAt: article.publishedAt }, 0, nowMs)
    .confidence;
  const stored = typeof article.confidence === 'number' ? article.confidence / 100 : 0;
  const parts = {
    analyticalDomains: {
      value: domains.length,
      detail: domains.length > 0 ? domains.join('+') : 'none detected',
    },
    countryAttributed: {
      value: article.countryCode ? 1 : 0,
      detail: article.countryCode ?? 'none',
    },
    sourceRole: { value: roleValue, detail: role },
    corroboration: {
      value: Math.max(0, clusterSize - 1),
      detail: `${clusterSize} report(s) in cluster`,
    },
    freshness: {
      value: freshnessBonus / 20,
      detail: `existing freshness bonus ${freshnessBonus}/20`,
    },
    storedConfidence: {
      value: stored,
      detail: typeof article.confidence === 'number' ? `${article.confidence}/100` : 'absent',
    },
  };
  const total = Object.values(parts).reduce((sum, part) => sum + part.value, 0);
  return { ...parts, total: Math.round(total * 100) / 100 };
}

export function optionB(
  candidates: readonly NewsArticle[],
  clusterSizeOf: (id: string) => number,
  nowMs: number,
): Selection & { readonly scores: Map<string, ScoreBreakdown> } {
  const scores = new Map(
    candidates.map((article) => [article.id, scoreB(article, clusterSizeOf(article.id), nowMs)]),
  );
  const ranked = candidates
    .map((article, position) => ({ article, position }))
    .sort(
      (a, b) =>
        scores.get(b.article.id)!.total - scores.get(a.article.id)!.total ||
        a.position - b.position,
    )
    .map((entry) => entry.article);
  return { selected: ranked.slice(0, SLOTS), notes: {}, scores };
}

/* ── OPTION C — bounded diversity reservation ─────────────────────────────────────────────── */
export type Bucket =
  | 'SECURITY'
  | 'POLITICS_GOVERNANCE'
  | 'ECONOMY'
  | 'INFRASTRUCTURE'
  | 'HEALTH_HUMANITARIAN'
  | 'TECHNOLOGY'
  | 'SPORTS'
  | 'ENTERTAINMENT'
  | 'UNCLASSIFIED';

/**
 * A bucket only from labels the repository itself produces (classifyCategory's category, already on
 * the article; detectArticleDomains). The classifier's no-match default 'world' is NOT a label:
 * with no detected domain the item is UNCLASSIFIED. The precedence below decides which of several
 * labels names the bucket; it is not an importance order (every bucket has the same cap).
 */
export function bucketOf(article: NewsArticle): { bucket: Bucket; basis: string } {
  const domains = detectArticleDomains({ title: article.title, summary: article.summary });
  const category = article.category;
  if (domains.has('security')) return { bucket: 'SECURITY', basis: 'domain:security' };
  if (category === 'sports') return { bucket: 'SPORTS', basis: 'category:sports' };
  if (category === 'entertainment')
    return { bucket: 'ENTERTAINMENT', basis: 'category:entertainment' };
  if (category === 'technology' || category === 'science' || domains.has('technology'))
    return { bucket: 'TECHNOLOGY', basis: `category:${category}/domain:technology` };
  if (category === 'business' || domains.has('economic'))
    return { bucket: 'ECONOMY', basis: `category:${category}/domain:economic` };
  if (domains.has('infrastructure'))
    return { bucket: 'INFRASTRUCTURE', basis: 'domain:infrastructure' };
  if (category === 'health') return { bucket: 'HEALTH_HUMANITARIAN', basis: 'category:health' };
  if (category === 'politics' || domains.has('political') || domains.has('diplomatic'))
    return { bucket: 'POLITICS_GOVERNANCE', basis: `category:${category}/domain:political` };
  return {
    bucket: 'UNCLASSIFIED',
    basis: `category:${category} (no rule matched) + no analytical domain`,
  };
}

export const BUCKET_CAP = 2;
export const PUBLISHER_CAP = 2;

function reserve(
  candidates: readonly NewsArticle[],
  bucketOfArticle: (article: NewsArticle) => Bucket,
): Selection {
  const notes: Record<string, string> = {};
  const perBucket = new Map<Bucket, number>();
  const perPublisher = new Map<string, number>();
  const selected: NewsArticle[] = [];
  const overflow: NewsArticle[] = [];
  for (const article of candidates) {
    if (selected.length >= SLOTS) break;
    const bucket = bucketOfArticle(article);
    const publisher = resolvePublisherIdentity(article) ?? article.id;
    const bucketFull = bucket !== 'UNCLASSIFIED' && (perBucket.get(bucket) ?? 0) >= BUCKET_CAP;
    const publisherFull = (perPublisher.get(publisher) ?? 0) >= PUBLISHER_CAP;
    if (bucketFull || publisherFull) {
      notes[article.id] = bucketFull
        ? `DEFERRED: bucket ${bucket} at cap ${BUCKET_CAP}`
        : `DEFERRED: publisher ${publisher} at cap ${PUBLISHER_CAP}`;
      overflow.push(article);
      continue;
    }
    selected.push(article);
    perBucket.set(bucket, (perBucket.get(bucket) ?? 0) + 1);
    perPublisher.set(publisher, (perPublisher.get(publisher) ?? 0) + 1);
  }
  /* Never leave a slot empty while candidates remain: backfill overflow in provider order. */
  for (const article of overflow) {
    if (selected.length >= SLOTS) break;
    selected.push(article);
    notes[article.id] = `${notes[article.id]} → BACKFILLED (slot would otherwise be empty)`;
  }
  return { selected, notes };
}

/** C1 — bucket reservation (cap per classified bucket) + publisher cap; UNCLASSIFIED uncapped. */
export function optionC1(candidates: readonly NewsArticle[]): Selection {
  return reserve(candidates, (article) => bucketOf(article).bucket);
}

/** C2 — NO bucket reservation (every item treated as unclassifiable); publisher cap only. */
export function optionC2(candidates: readonly NewsArticle[]): Selection {
  return reserve(candidates, () => 'UNCLASSIFIED');
}
