import type { NewsArticle } from '@globalnews-ai/shared';
import { resolveRegistrableDomain } from '../identity/publisher-identity.util';
import { familyOfHost, hostOf } from './evidence-candidate';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R164 P-3 — ONE REPORTING-LINEAGE RULE FOR BOTH READER PATHS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * "N independent reports agree" (current-status corroboration) and "Corroborated reporting"
 * (claim graph) both count reporting CHAINS, never copies. One chain is:
 *
 *   WIRE BYLINE   a body carrying a wire dateline / byline ("WARSAW (Reuters) -", "(AP) —",
 *                 "By The Associated Press", "(أ ف ب)") is that wire, on whatever host it
 *                 was republished and under whatever headline the outlet wrote;
 *   DECLARED      an organisational family declared by the lane (an org's site + its account);
 *   WIRE HOST     a wire's own hosts and subdomains;
 *   PUBLISHER     one masthead across its country domains (bbc.co.uk + bbc.com = BBC).
 *
 * UNKNOWN lineage — an aggregator repost or discovery lead with no byline — is never an
 * independent count: it can stand alone as one report, never add a second.
 */

export interface ReportingLineage {
  readonly key: string;
  readonly known: boolean;
}

const WIRE_BYLINES: ReadonlyArray<readonly [string, RegExp]> = [
  ['reuters.com', /\(\s*(?:reuters|رويترز)\s*\)|\bby\s+reuters\b/i],
  [
    'apnews.com',
    /\(\s*ap\s*\)|\bby\s+(?:the\s+)?associated\s+press\b|\(\s*associated\s+press\s*\)/i,
  ],
  ['afp.com', /\(\s*(?:afp|أ\s*ف\s*ب|agence\s+france[-\s]presse)\s*\)|\bby\s+afp\b/i],
  ['bloomberg.com', /\(\s*bloomberg\s*\)/i],
];

const WIRE_HOST_KEYS: ReadonlySet<string> = new Set(WIRE_BYLINES.map(([wire]) => wire));

const UNKNOWN_ROLES: ReadonlySet<string> = new Set(['AGGREGATOR', 'DISCOVERY_LEAD']);

/** The wire whose dateline / byline the report carries, or null. */
export function wireBylineOf(article: Pick<NewsArticle, 'title' | 'summary'>): string | null {
  const text = `${article.title ?? ''} ${article.summary ?? ''}`;
  return WIRE_BYLINES.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

/** The masthead of a URL: the registrable domain without its suffix (bbc.co.uk → bbc). */
function mastheadOf(url: string): string | null {
  const domain = resolveRegistrableDomain(url);
  return domain === undefined ? null : (domain.split('.')[0] ?? null);
}

export function reportingLineageOf(
  article: Pick<
    NewsArticle,
    'title' | 'summary' | 'url' | 'sourceId' | 'sourceFamily' | 'evidenceRole'
  >,
): ReportingLineage {
  const wire = wireBylineOf(article);
  if (wire !== null) return { key: `wire:${wire}`, known: true };
  const hostFamily = familyOfHost(hostOf(article.url ?? ''));
  if (hostFamily !== null && WIRE_HOST_KEYS.has(hostFamily)) {
    return { key: `wire:${hostFamily}`, known: true };
  }
  /* a family the lane declared beyond the plain host (an organisation's site + its account) */
  if (article.sourceFamily !== undefined && article.sourceFamily !== hostFamily) {
    return { key: `family:${article.sourceFamily}`, known: true };
  }
  if (article.evidenceRole !== undefined && UNKNOWN_ROLES.has(article.evidenceRole)) {
    return { key: `unknown:${hostFamily ?? article.sourceId}`, known: false };
  }
  const masthead = mastheadOf(article.url ?? '');
  return {
    key: masthead === null ? `source:${article.sourceId}` : `publisher:${masthead}`,
    known: true,
  };
}
