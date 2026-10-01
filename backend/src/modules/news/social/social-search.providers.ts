import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { familyOfHost, hostOf, type EvidenceCandidate } from '../evidence/evidence-candidate';
import { classifySocialAccount } from './social-account-registry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK MULTI-SOURCE DISCOVERY R2B — APPROVED PUBLIC SOCIAL SEARCH (X, YouTube)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Official public APIs only — X API v2 recent search and YouTube Data API v3 search. No
 * scraping, no authenticated website, no access-control bypass.
 *
 * FAIL CLOSED AND OFF BY DEFAULT. A lane runs only when BOTH its explicit deployment switch is
 * exactly "true" AND its credential is present:
 *
 *   X        ASK_SOCIAL_X_ENABLED=true        and X_API_BEARER_TOKEN
 *   YouTube  ASK_SOCIAL_YOUTUBE_ENABLED=true  and YOUTUBE_API_KEY
 *
 * Otherwise the lane makes NO network call and reports `not-configured`, which the retrieval
 * trace shows to the reader ("X — unavailable"). No configuration is assumed or fabricated.
 *
 * What is retained (and nothing else): X — post id, author id/handle, created time, language,
 * text, referenced/reposted source, linked URLs, place id, the platform's verification type.
 * YouTube — video id, channel id/title, title, description, publication time. Plus the query.
 * Credentials never enter a candidate, a log line or the trace.
 */

export type SocialLaneId = 'x' | 'youtube';
export type SocialFailureKind =
  'not-configured' | 'auth' | 'rate-limited' | 'timeout' | 'unavailable';

export class SocialLaneError extends Error {
  constructor(
    readonly lane: SocialLaneId,
    readonly kind: SocialFailureKind,
    message: string,
  ) {
    super(message);
    this.name = 'SocialLaneError';
  }
}

export interface SocialSearchOptions {
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
}

export interface SocialSearchProvider {
  readonly id: SocialLaneId;
  /** Configured = switch on AND credential present. Never reads the network. */
  configured(): boolean;
  search(query: string, options?: SocialSearchOptions): Promise<EvidenceCandidate[]>;
}

export const SOCIAL_REQUEST_TIMEOUT_MS = 4_000;

type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

async function getJson(
  lane: SocialLaneId,
  fetcher: FetchLike,
  url: string,
  headers: Record<string, string> = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOCIAL_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetcher(url, { headers, signal: controller.signal });
    if (response.status === 401 || response.status === 403) {
      throw new SocialLaneError(lane, 'auth', `${lane} rejected the configured credential.`);
    }
    if (response.status === 429) {
      throw new SocialLaneError(lane, 'rate-limited', `${lane} rate limit reached.`);
    }
    if (!response.ok) {
      throw new SocialLaneError(lane, 'unavailable', `${lane} answered HTTP ${response.status}.`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof SocialLaneError) throw error;
    if ((error as Error)?.name === 'AbortError') {
      throw new SocialLaneError(lane, 'timeout', `${lane} did not answer in time.`);
    }
    throw new SocialLaneError(lane, 'unavailable', `${lane} request failed.`);
  } finally {
    clearTimeout(timer);
  }
}

const fetchImpl: FetchLike = (url, init) => fetch(url, init) as never;

interface XPost {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  lang?: string;
  referenced_tweets?: Array<{ type: string; id: string }>;
  entities?: { urls?: Array<{ expanded_url?: string }> };
  geo?: { place_id?: string };
}
interface XUser {
  id: string;
  username: string;
  name: string;
  verified_type?: string;
}

@Injectable()
export class XRecentSearchProvider implements SocialSearchProvider {
  readonly id = 'x' as const;

  constructor(
    private readonly config: ConfigService,
    private readonly fetcher: FetchLike = fetchImpl,
  ) {}

  private token(): string | undefined {
    const value = this.config.get<string>('X_API_BEARER_TOKEN')?.trim();
    return value === undefined || value.length === 0 ? undefined : value;
  }

  configured(): boolean {
    return (
      this.config.get<string>('ASK_SOCIAL_X_ENABLED')?.trim() === 'true' &&
      this.token() !== undefined
    );
  }

  async search(query: string, options: SocialSearchOptions = {}): Promise<EvidenceCandidate[]> {
    const token = this.token();
    if (!this.configured() || token === undefined) {
      throw new SocialLaneError('x', 'not-configured', 'The X lane is not configured.');
    }
    const url = new URL('https://api.x.com/2/tweets/search/recent');
    /* Pure reposts are never evidence; quotes are kept and classified as leads. */
    url.searchParams.set('query', `${query} -is:retweet`);
    url.searchParams.set('max_results', String(Math.min(Math.max(options.limit ?? 10, 10), 50)));
    if (options.from !== undefined) url.searchParams.set('start_time', options.from);
    if (options.to !== undefined) {
      /* X requires end_time at least 10 s before the request. */
      const end = Math.min(Date.parse(options.to), Date.now() - 15_000);
      url.searchParams.set('end_time', new Date(end).toISOString());
    }
    url.searchParams.set(
      'tweet.fields',
      'created_at,lang,author_id,referenced_tweets,entities,geo',
    );
    url.searchParams.set('expansions', 'author_id');
    url.searchParams.set('user.fields', 'username,name,verified_type');
    const body = (await getJson('x', this.fetcher, url.toString(), {
      Authorization: `Bearer ${token}`,
    })) as { data?: XPost[]; includes?: { users?: XUser[] } };

    const users = new Map((body.includes?.users ?? []).map((u) => [u.id, u]));
    return (body.data ?? []).map((post): EvidenceCandidate => {
      const user = post.author_id === undefined ? undefined : users.get(post.author_id);
      const referenced = post.referenced_tweets?.[0];
      const identity = classifySocialAccount({
        platform: 'x',
        accountId: post.author_id ?? 'unknown',
        platformVerification: user?.verified_type ?? null,
        isRepost: referenced !== undefined,
      });
      /* A post that shares a publisher's report belongs to that publisher's family. */
      const linked = (post.entities?.urls ?? [])
        .map((u) => familyOfHost(hostOf(u.expanded_url ?? '')))
        .find((family) => family !== null && family !== 'x.com' && family !== 'twitter.com');
      const handle = user?.username ?? post.author_id ?? 'unknown';
      return {
        id: `x:${post.id}`,
        url: `https://x.com/${handle}/status/${post.id}`,
        channel: 'SOCIAL',
        sourceRole: identity.role,
        sourceId: `social:x:${post.author_id ?? 'unknown'}`,
        sourceName: `@${handle} (X)`,
        title: post.text.length > 140 ? `${post.text.slice(0, 137)}…` : post.text,
        text: post.text,
        language: post.lang ?? null,
        publishedAt: post.created_at ?? null,
        observedAt: null,
        timestampBasis: post.created_at === undefined ? 'UNKNOWN' : 'PLATFORM',
        sourceFamily:
          identity.family ??
          linked ??
          (referenced !== undefined ? `x:post:${referenced.id}` : `x:${post.author_id ?? post.id}`),
        provenance: {
          lane: 'x',
          query,
          postId: post.id,
          authorId: post.author_id ?? null,
          verifiedType: user?.verified_type ?? null,
          referencedType: referenced?.type ?? null,
          placeId: post.geo?.place_id ?? null,
        },
      };
    });
  }
}

interface YouTubeItem {
  id?: { videoId?: string };
  snippet?: {
    publishedAt?: string;
    channelId?: string;
    channelTitle?: string;
    title?: string;
    description?: string;
    defaultAudioLanguage?: string;
  };
}

@Injectable()
export class YouTubeSearchProvider implements SocialSearchProvider {
  readonly id = 'youtube' as const;

  constructor(
    private readonly config: ConfigService,
    private readonly fetcher: FetchLike = fetchImpl,
  ) {}

  private key(): string | undefined {
    const value = this.config.get<string>('YOUTUBE_API_KEY')?.trim();
    return value === undefined || value.length === 0 ? undefined : value;
  }

  configured(): boolean {
    return (
      this.config.get<string>('ASK_SOCIAL_YOUTUBE_ENABLED')?.trim() === 'true' &&
      this.key() !== undefined
    );
  }

  async search(query: string, options: SocialSearchOptions = {}): Promise<EvidenceCandidate[]> {
    const key = this.key();
    if (!this.configured() || key === undefined) {
      throw new SocialLaneError('youtube', 'not-configured', 'The YouTube lane is not configured.');
    }
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'video');
    url.searchParams.set('order', 'date');
    url.searchParams.set('maxResults', String(Math.min(Math.max(options.limit ?? 10, 1), 25)));
    url.searchParams.set('q', query);
    if (options.from !== undefined) url.searchParams.set('publishedAfter', options.from);
    if (options.to !== undefined) url.searchParams.set('publishedBefore', options.to);
    url.searchParams.set('key', key);
    const body = (await getJson('youtube', this.fetcher, url.toString())) as {
      items?: YouTubeItem[];
    };

    return (body.items ?? [])
      .filter((item) => item.id?.videoId !== undefined && item.snippet !== undefined)
      .map((item): EvidenceCandidate => {
        const snippet = item.snippet!;
        const videoId = item.id!.videoId!;
        const channelId = snippet.channelId ?? 'unknown';
        const identity = classifySocialAccount({
          platform: 'youtube',
          accountId: channelId,
          platformVerification: null,
          isRepost: false,
        });
        return {
          id: `yt:${videoId}`,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          channel: 'VIDEO',
          sourceRole: identity.role,
          sourceId: `social:youtube:${channelId}`,
          sourceName: `${snippet.channelTitle ?? channelId} (YouTube)`,
          title: snippet.title ?? '',
          text: snippet.description ?? '',
          language: snippet.defaultAudioLanguage ?? null,
          publishedAt: snippet.publishedAt ?? null,
          observedAt: null,
          timestampBasis: snippet.publishedAt === undefined ? 'UNKNOWN' : 'PLATFORM',
          sourceFamily: identity.family ?? `youtube:${channelId}`,
          provenance: { lane: 'youtube', query, videoId, channelId },
        };
      });
  }
}
