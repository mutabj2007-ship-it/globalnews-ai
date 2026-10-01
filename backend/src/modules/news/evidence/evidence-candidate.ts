import type { NewsArticle, SourceRole } from '@globalnews-ai/shared';
import { canonicalPublisherHost } from '@globalnews-ai/shared';
import { FEED_SOURCES } from '../providers/feed-source-registry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK MULTI-SOURCE DISCOVERY R2B — ONE EVIDENCE-CANDIDATE CONTRACT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Every lane — GNews, GDELT, publisher feeds, retained reporting, and (when configured) X and
 * YouTube — normalises into this ONE shape before admission. There is no second analysis
 * pipeline: an admitted candidate becomes a NewsArticle (with its role and source family) and
 * flows through the same relevance gates, window, clustering, claim states and prompt.
 *
 * SOCIAL DATA IS NOT AUTOMATICALLY VERIFIED DATA. A candidate's ROLE says what kind of source
 * it is; it never says that the content is true. Independence is decided by FAMILY: a repost of
 * a Reuters item is the Reuters family; an organisation's website and its own X account are the
 * same organisational family.
 */

export type EvidenceChannel = 'NEWS' | 'OFFICIAL_WEB' | 'SOCIAL' | 'VIDEO' | 'RETAINED';
export type TimestampBasis = 'PUBLISHER' | 'PLATFORM' | 'OBSERVED' | 'UNKNOWN';

export interface EvidenceCandidate {
  readonly id: string;
  readonly url: string;
  readonly channel: EvidenceChannel;
  readonly sourceRole: SourceRole;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly title: string;
  readonly text: string;
  readonly language: string | null;
  readonly publishedAt: string | null;
  readonly observedAt: string | null;
  readonly timestampBasis: TimestampBasis;
  /** Independence key: candidates of one family are never independent confirmation. */
  readonly sourceFamily: string;
  /** Safe provenance only: lane, query, platform ids. Never a credential or raw payload. */
  readonly provenance: Readonly<Record<string, string | number | boolean | null>>;
}

/** Wire services whose copy is syndicated widely; their copies are ONE family wherever they appear. */
const WIRE_HOSTS = ['reuters.com', 'apnews.com', 'afp.com', 'bloomberg.com'];

export function hostOf(url: string): string | null {
  try {
    return canonicalPublisherHost(new URL(url).host);
  } catch {
    return null;
  }
}

/** The registrable family of a host: a wire's subdomains and copies collapse to the wire. */
export function familyOfHost(host: string | null): string | null {
  if (host === null) return null;
  const wire = WIRE_HOSTS.find((w) => host === w || host.endsWith(`.${w}`));
  return wire ?? host;
}

/** The role of a news-channel article, from verified identity only (never its display name). */
export function newsRoleOf(
  article: Pick<NewsArticle, 'sourceId' | 'url' | 'publishedAtBasis'>,
): SourceRole {
  const host = hostOf(article.url);
  const feed = FEED_SOURCES.find((entry) => entry.sourceId === article.sourceId);
  const onOwnHost =
    feed !== undefined &&
    host !== null &&
    (host === feed.canonicalHost || host.endsWith(`.${feed.canonicalHost}`));
  if (feed !== undefined && onOwnHost) {
    return feed.sourceType === 'OFFICIAL_SOURCE' ? 'OFFICIAL_WEB' : 'LOCAL_REPORTING';
  }
  if (article.publishedAtBasis === 'observed') return 'AGGREGATOR';
  const family = familyOfHost(host);
  if (family !== null && WIRE_HOSTS.includes(family)) return 'WIRE_REPORTING';
  return 'INTERNATIONAL_REPORTING';
}

export function candidateFromArticle(article: NewsArticle, lane: string): EvidenceCandidate {
  const host = hostOf(article.url);
  return {
    id: article.id,
    url: article.url,
    channel: 'NEWS',
    sourceRole: article.evidenceRole ?? newsRoleOf(article),
    sourceId: article.sourceId,
    sourceName: article.sourceName,
    title: article.title,
    text: article.summary,
    language: article.sourceLanguage ?? null,
    publishedAt: article.publishedAtBasis === 'publisher' ? article.publishedAt : null,
    observedAt: article.publishedAtBasis === 'observed' ? article.publishedAt : null,
    timestampBasis:
      article.publishedAtBasis === 'publisher'
        ? 'PUBLISHER'
        : article.publishedAtBasis === 'observed'
          ? 'OBSERVED'
          : 'UNKNOWN',
    sourceFamily: article.sourceFamily ?? familyOfHost(host) ?? `source:${article.sourceId}`,
    provenance: { lane },
  };
}

/**
 * A non-news candidate entering the ONE analysis pipeline as a NewsArticle. A platform's own
 * post time is that post's publication time (the post is the publication), so it may satisfy
 * a strict window; an unknown time never does.
 */
export function articleFromCandidate(candidate: EvidenceCandidate): NewsArticle {
  const time = candidate.publishedAt ?? candidate.observedAt;
  return {
    id: candidate.id,
    title: candidate.title,
    summary: candidate.text,
    url: candidate.url,
    sourceId: candidate.sourceId,
    sourceName: candidate.sourceName,
    category: 'world',
    sourcesCount: 1,
    publishedAt: time ?? new Date(0).toISOString(),
    ...(candidate.timestampBasis === 'PUBLISHER' || candidate.timestampBasis === 'PLATFORM'
      ? { publishedAtBasis: 'publisher' as const }
      : candidate.timestampBasis === 'OBSERVED'
        ? { publishedAtBasis: 'observed' as const }
        : {}),
    ...(candidate.language === null ? {} : { sourceLanguage: candidate.language }),
    evidenceRole: candidate.sourceRole,
    sourceFamily: candidate.sourceFamily,
  };
}
