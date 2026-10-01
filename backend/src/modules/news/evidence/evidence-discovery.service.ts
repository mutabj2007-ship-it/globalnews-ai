import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FEED_SOURCES, resolveActiveFeedSources } from '../providers/feed-source-registry';
import type { EvidenceCandidate } from './evidence-candidate';
import {
  SocialLaneError,
  type SocialSearchOptions,
  type SocialSearchProvider,
} from '../social/social-search.providers';

export const SOCIAL_SEARCH_PROVIDERS = Symbol('SOCIAL_SEARCH_PROVIDERS');

export interface DiscoveryLaneStatus {
  readonly lane: string;
  /** 'ok' or the reason the lane produced nothing usable. */
  readonly status: 'ok' | 'not-configured' | 'auth' | 'rate-limited' | 'timeout' | 'unavailable';
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK MULTI-SOURCE DISCOVERY R2B — THE NON-NEWS LANES, ORCHESTRATED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The news lanes (GNews, GDELT, publisher feeds, retained reporting) keep running through
 * NewsService exactly as before. This service runs the OTHER configured lanes for the same
 * Ask, in parallel, bounded:
 *
 *   at most ONE search per social lane per Ask (the frame's most specific query);
 *   each lane bounded by its own request timeout;
 *   a lane's failure never cancels another lane (Promise.allSettled);
 *   an unconfigured lane makes no call and is reported `not-configured`.
 *
 * It returns normalised EvidenceCandidates and the per-lane status for the retrieval trace.
 * It admits nothing: admission is the caller's existing relevance gate.
 */
@Injectable()
export class EvidenceDiscoveryService {
  private readonly logger = new Logger(EvidenceDiscoveryService.name);

  constructor(
    @Optional()
    @Inject(SOCIAL_SEARCH_PROVIDERS)
    private readonly social: readonly SocialSearchProvider[] = [],
    @Optional()
    private readonly config?: ConfigService,
  ) {}

  /**
   * R2B — governed local fan-out: does the ACTIVE publisher-feed selection (the SAME resolver
   * the feed provider uses: shipped flags, or the RSS_FEED_SOURCES override) carry a feed for
   * any of these countries? Then that lane is asked alongside the primary provider.
   */
  hasGovernedLocalFeeds(iso2s: readonly string[]): boolean {
    const active = resolveActiveFeedSources(
      FEED_SOURCES,
      this.config?.get<string>('RSS_FEED_SOURCES'),
    ).sources;
    return active.some((feed) => iso2s.includes(feed.countryCode));
  }

  /** Every registered non-news lane and whether it can run. */
  lanes(): readonly DiscoveryLaneStatus[] {
    return this.social.map((p) => ({
      lane: p.id,
      status: p.configured() ? 'ok' : 'not-configured',
    }));
  }

  async discover(
    query: string,
    options: SocialSearchOptions = {},
  ): Promise<{ candidates: EvidenceCandidate[]; lanes: DiscoveryLaneStatus[] }> {
    const settled = await Promise.allSettled(
      this.social.map(async (provider) => {
        if (!provider.configured()) {
          throw new SocialLaneError(provider.id, 'not-configured', 'not configured');
        }
        return provider.search(query, options);
      }),
    );
    const candidates: EvidenceCandidate[] = [];
    const lanes: DiscoveryLaneStatus[] = [];
    settled.forEach((result, i) => {
      const lane = this.social[i]!.id;
      if (result.status === 'fulfilled') {
        candidates.push(...result.value);
        lanes.push({ lane, status: 'ok' });
      } else {
        const kind =
          result.reason instanceof SocialLaneError ? result.reason.kind : ('unavailable' as const);
        lanes.push({ lane, status: kind });
        if (kind !== 'not-configured') {
          this.logger.warn(`Discovery lane ${lane} unavailable: ${kind}`);
        }
      }
    });
    return { candidates, lanes };
  }
}
