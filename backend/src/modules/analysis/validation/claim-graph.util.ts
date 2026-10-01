import type {
  AnalysisClaimAssessment,
  ClaimVerificationState,
  NewsArticle,
} from '@globalnews-ai/shared';
import { canonicalPublisherHost } from '@globalnews-ai/shared';
import { clusterArticlesWithMembership } from '../duplicates/cluster-articles.util';
import { FEED_SOURCES } from '../../news/providers/feed-source-registry';
import { familyOfHost } from '../../news/evidence/evidence-candidate';
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
  const byHost = new Map<string, number>();
  articles.forEach((a, i) => {
    /* R2B — a declared family (a shared report, an organisation's own account) or the host's
       family (a wire's copies are the wire). */
    const key = a.sourceFamily ?? familyOfHost(hostOf(a)) ?? `source:${a.sourceId}`;
    const seen = byHost.get(key);
    if (seen === undefined) byHost.set(key, i);
    else union(seen, i);
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

function contradicts(claim: ClaimInput, article: NewsArticle): boolean {
  return claim.type === 'OCCURRENCE' && EVENT_COUNTER_EVIDENCE.test(textOf(article));
}

export function assessClaims(
  claims: readonly ClaimInput[],
  evidence: readonly NewsArticle[],
  ctx: ClaimContext,
): AnalysisClaimAssessment[] {
  return claims.map((claim) => {
    /* R2B — a discovery lead (repost / unknown origin) is never evidence for or against. */
    const usable = evidence.filter((a) => a.evidenceRole !== 'DISCOVERY_LEAD');
    const contradicting = usable.filter((a) => contradicts(claim, a));
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
