import type {
  AnalysisClaimAssessment,
  ClaimVerificationState,
  NewsArticle,
} from '@globalnews-ai/shared';
import { canonicalPublisherHost } from '@globalnews-ai/shared';
import { clusterArticlesWithMembership } from '../duplicates/cluster-articles.util';
import { FEED_SOURCES } from '../../news/providers/feed-source-registry';
import { reportingLineageOf } from '../../news/evidence/reporting-lineage.util';
import {
  articleSpeaksToFacet,
  foldForPlan,
  type CompoundFacet,
} from '../../news/relevance/compound-plan-relevance.util';
import {
  namesEndpoint,
  namesIdentifier,
  type EventFrameAdmission,
} from '../../news/relevance/event-frame-relevance.util';
import {
  EVENT_COUNTER_EVIDENCE,
  HARM_COUNTER_EVIDENCE,
  HARM_WORDS,
} from './negative-assertion.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK TRUTHFUL RETRIEVAL R2A — THE CLAIM-LEVEL EVIDENCE GRAPH
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Not one blanket confidence for the whole answer: each claim the question asks about gets
 * its own supporting / contradicting evidence and a state decided HERE, deterministically,
 * before any prose — never "the model thinks the articles agree".
 *
 * INDEPENDENCE. Supporting reports are grouped into source FAMILIES: the same duplicate
 * cluster (syndicated copy — the unchanged clusterArticlesWithMembership()), the same
 * publisher host, or the same organisation collapse into one. A Reuters story and its copies
 * are one family; a ministry's site is one family however many of its pages are admitted.
 *
 * STATES.
 *   DISPUTED                supported AND explicitly contradicted by an admitted report
 *   CONFIRMED               ≥ 2 independent families, one of them the official source of the
 *                           organisation concerned (verified feed identity, never a name)
 *   CORROBORATED_REPORTING  ≥ 2 independent families of reporting
 *   REPORTED                exactly 1 family
 *   UNASSESSED              reports exist, but none carries accessible text to assess the claim
 *                           (title-only / body unavailable) — CTO R164 P-4, never a positive
 *   COVERAGE_INCOMPLETE     no support, and a source lane failed / was unavailable
 *   NOT_VERIFIED            no support, every attempted lane answered
 *
 * "Not verified" is the strongest negative the system can reach from its own retrieval.
 */

export interface ClaimInput {
  readonly id: string;
  readonly type: string;
  readonly text: string;
}

export interface ClaimContext {
  readonly event?: EventFrameAdmission;
  readonly facets?: readonly CompoundFacet[];
  readonly coverageIncomplete: boolean;
}

const CAUSE_CUES =
  /\b(?:after|due\s+to|because|caused\s+by|following|amid|blamed\s+on|engine|technical|turbulence|bird\s+strike|fire|smoke|fault|malfunction|weather|investigat\w*|suspected)\b/i;
const SAME_DAY_CUES =
  /\b(?:today|tonight|this\s+(?:morning|afternoon|evening)|earlier\s+today|on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i;

function textOf(article: Pick<NewsArticle, 'title' | 'summary'>): string {
  return `${article.title ?? ''} ${article.summary ?? ''}`;
}

function hostOf(article: Pick<NewsArticle, 'url'>): string | null {
  try {
    return canonicalPublisherHost(new URL(article.url).host);
  } catch {
    return null;
  }
}

/** A verified official publisher: a registry OFFICIAL_SOURCE whose link is on its own host. */
export function isOfficialSource(
  article: Pick<NewsArticle, 'sourceId' | 'url' | 'evidenceRole'>,
): boolean {
  /* R2B — an official role from governed / platform-verified identity. */
  if (article.evidenceRole === 'OFFICIAL_WEB' || article.evidenceRole === 'OFFICIAL_SOCIAL') {
    return true;
  }
  const entry = FEED_SOURCES.find((feed) => feed.sourceId === article.sourceId);
  const host = hostOf(article);
  return (
    entry !== undefined &&
    entry.sourceType === 'OFFICIAL_SOURCE' &&
    host !== null &&
    (host === entry.canonicalHost || host.endsWith(`.${entry.canonicalHost}`))
  );
}

/** Independent source families among the given reports. */
export function independentFamilies(articles: readonly NewsArticle[]): NewsArticle[][] {
  const parent = articles.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const index = new Map(articles.map((a, i) => [a, i]));
  for (const cluster of clusterArticlesWithMembership([...articles])) {
    const [first, ...rest] = cluster.members.map((m) => index.get(m)!);
    for (const other of rest) union(first!, other);
  }
  /* CTO R164 P-3 — one reporting chain per lineage (wire byline, wire host, declared family,
     masthead), shared with current-status corroboration. */
  const lineages = articles.map((a) => reportingLineageOf(a));
  const byLineage = new Map<string, number>();
  lineages.forEach((lineage, i) => {
    const seen = byLineage.get(lineage.key);
    if (seen === undefined) byLineage.set(lineage.key, i);
    else union(seen, i);
  });
  /* Unknown lineage never adds an independent family: it joins a known chain, or the other unknowns. */
  const anchor = lineages.findIndex((lineage) => lineage.known);
  const unknownAnchor = lineages.findIndex((lineage) => !lineage.known);
  lineages.forEach((lineage, i) => {
    if (!lineage.known) union(anchor >= 0 ? anchor : unknownAnchor, i);
  });
  const groups = new Map<number, NewsArticle[]>();
  articles.forEach((a, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), a]);
  });
  return [...groups.values()];
}

/** Journalism — a news-channel report or a governed newsroom account; never a witness post. */
const REPORTING_ROLES: ReadonlySet<string> = new Set([
  'LOCAL_REPORTING',
  'REGIONAL_REPORTING',
  'INTERNATIONAL_REPORTING',
  'WIRE_REPORTING',
  'AGGREGATOR',
  'SOCIAL_REPORT',
]);

function isReporting(article: NewsArticle): boolean {
  return article.evidenceRole === undefined || REPORTING_ROLES.has(article.evidenceRole);
}

/**
 * CTO R164 P-4 — a stance is read only from accessible report text. A title-only item (no body,
 * or a body withheld) is never support, never contradiction: it can only make a claim UNASSESSED.
 */
function isAssessable(article: NewsArticle): boolean {
  const summary = (article.summary ?? '').trim();
  /* Politics RV-21 — a body that only repeats the headline adds no accessible text. */
  return summary.length > 0 && summary.toLowerCase() !== (article.title ?? '').trim().toLowerCase();
}

/**
 * CTO R164 P-4 — an explicit refutation of the reported account (beyond "denies"), read per
 * sentence. Politics F-1: bound to a determined account ("rejects THE account", "calls THE
 * report false", "no evidence THE hospital was hit"), never negated ("not disputed", "no one
 * disputes"), never another kind of claim (insurance, asylum, compensation), and — when the
 * question names an event — in a sentence that names it. "Rejects a bill" is not a refutation.
 */
const ACCOUNT = String.raw`(?:account|claims?|reports?|allegations?|accusations?|version|narrative)`;
const DETERMINER = String.raw`(?:the|a|an|this|that|these|those|its|their|his|her|such)`;
const EVENT_REFUTATION: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:reject\w*|dismiss\w*|refut\w*|disput\w*|contest\w*)\s+(?:[\p{L}\p{N}'-]+\s+){0,2}?${DETERMINER}\s+(?:[\p{L}\p{N}'-]+\s+){0,3}?${ACCOUNT}\b`,
    'iu',
  ),
  /\bdisput\w*\s+that\b/i,
  /\bno\s+evidence\s+(?:that\s+)?(?:the|its|their|any)\b/i,
  new RegExp(
    String.raw`\bcall\w*\s+${DETERMINER}\s+(?:[\p{L}\p{N}'-]+\s+){0,3}?${ACCOUNT}\s+(?:as\s+)?(?:false|untrue|baseless|unfounded|fabricated|fake)\b`,
    'iu',
  ),
];
const REFUTATION_NEGATED =
  /\b(?:not|no\s+one|nobody|none|never)\s+(?:[\p{L}\p{N}'-]+\s+){0,2}?(?:disput|reject|dismiss|refut|contest)\w*|\bundisputed\b|n't\s+(?:[\p{L}\p{N}'-]+\s+){0,2}?(?:disput|reject|dismiss|refut|contest)/iu;
const OTHER_CLAIM_KIND = /\b(?:insur\w*|asylum|compensation|benefits?|refunds?|tax)\b/i;

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function refutesInSentence(sentence: string, ctx: ClaimContext): boolean {
  if (!EVENT_REFUTATION.some((pattern) => pattern.test(sentence))) return false;
  if (REFUTATION_NEGATED.test(sentence) || OTHER_CLAIM_KIND.test(sentence)) return false;
  if (ctx.event === undefined) return true;
  const folded = foldForPlan(sentence);
  return (
    namesIdentifier(folded, ctx.event.identifiers) ||
    ctx.event.endpoints.some((endpoint) => namesEndpoint(folded, endpoint))
  );
}

function supports(claim: ClaimInput, article: NewsArticle, ctx: ClaimContext): boolean {
  const text = textOf(article);
  const folded = foldForPlan(text);
  switch (claim.type) {
    case 'OCCURRENCE':
      return true;
    case 'ROUTE':
      return (
        ctx.event !== undefined &&
        (namesIdentifier(folded, ctx.event.identifiers) ||
          (ctx.event.endpoints.length > 1 &&
            ctx.event.endpoints.every((e) => namesEndpoint(folded, e))))
      );
    case 'TIME':
      return SAME_DAY_CUES.test(text);
    case 'CAUSE':
      return CAUSE_CUES.test(text);
    case 'CASUALTIES':
      return HARM_WORDS.test(text) || HARM_COUNTER_EVIDENCE.test(text);
    case 'ACTION':
      return articleSpeaksToFacet(folded, 'SECURITY');
    case 'IMPACT':
      return articleSpeaksToFacet(folded, 'HUMANITARIAN');
    default:
      return false;
  }
}

function contradicts(claim: ClaimInput, article: NewsArticle, ctx: ClaimContext): boolean {
  if (claim.type !== 'OCCURRENCE') return false;
  const text = textOf(article);
  return (
    EVENT_COUNTER_EVIDENCE.test(text) ||
    sentencesOf(text).some((sentence) => refutesInSentence(sentence, ctx))
  );
}

export function assessClaims(
  claims: readonly ClaimInput[],
  evidence: readonly NewsArticle[],
  ctx: ClaimContext,
): AnalysisClaimAssessment[] {
  return claims.map((claim) => {
    /* R2B — a discovery lead (repost / unknown origin) is never evidence for or against. */
    const present = evidence.filter((a) => a.evidenceRole !== 'DISCOVERY_LEAD');
    const usable = present.filter(isAssessable);
    const contradicting = usable.filter((a) => contradicts(claim, a, ctx));
    const supporting = usable.filter((a) => !contradicting.includes(a) && supports(claim, a, ctx));
    const families = independentFamilies(supporting);
    const officialFamily = families.some((family) => family.some(isOfficialSource));
    /* Independent JOURNALISM families: never a witness post, never the official source itself. */
    const reportingFamilies = families.filter((family) =>
      family.some((a) => isReporting(a) && !isOfficialSource(a)),
    ).length;
    const state: ClaimVerificationState =
      supporting.length > 0 && contradicting.length > 0
        ? 'DISPUTED'
        : supporting.length === 0
          ? contradicting.length > 0
            ? 'DISPUTED'
            : present.length > usable.length
              ? 'UNASSESSED'
              : ctx.coverageIncomplete
                ? 'COVERAGE_INCOMPLETE'
                : 'NOT_VERIFIED'
          : officialFamily && reportingFamilies >= 1
            ? 'CONFIRMED'
            : reportingFamilies >= 2
              ? 'CORROBORATED_REPORTING'
              : 'REPORTED';
    return {
      id: claim.id,
      type: claim.type,
      text: claim.text,
      state,
      supportingArticleIds: supporting.map((a) => a.id),
      independentFamilies: families.length,
      officialFamily,
      contradictingArticleIds: contradicting.map((a) => a.id),
    };
  });
}

/** The compound plan's facets as claims (security change / civilian impact). */
export function facetClaims(facets: readonly CompoundFacet[]): ClaimInput[] {
  return facets.map((facet) =>
    facet === 'SECURITY'
      ? { id: 'security', type: 'ACTION', text: 'Security or territorial changes' }
      : { id: 'civilian-impact', type: 'IMPACT', text: 'Effects on civilians or displacement' },
  );
}
