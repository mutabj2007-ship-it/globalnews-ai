import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FEED_SOURCES, resolveActiveFeedSources } from '../providers/feed-source-registry';
import type { EvidenceCandidate } from './evidence-candidate';
import {
  OfficialBulletinCollector,
  type OfficialBulletinItem,
} from '../../official-bulletin/official-bulletin.collector';
import { providerAdmission } from '../rights/provider-admission';
import {
  SocialLaneError,
  type SocialSearchOptions,
  type SocialSearchProvider,
} from '../social/social-search.providers';

export const SOCIAL_SEARCH_PROVIDERS = Symbol('SOCIAL_SEARCH_PROVIDERS');

/** CTO R155 states, plus the two NOT_SEARCHED_* states for a lane that is off or has not yet had its first read. */
export interface OfficialBulletinResult {
  readonly sourceName: string | null;
  readonly state:
    | 'SEARCHED_MATCH'
    | 'SEARCHED_NO_MATCH'
    | 'RIGHTS_NOT_ADMITTED'
    | 'UPSTREAM_FAILED'
    | 'NOT_SEARCHED_LANE_OFF'
    | 'NOT_SEARCHED_NOT_DUE';
  readonly reason: string | null;
  readonly checkedAt: string | null;
  readonly items: readonly OfficialBulletinItem[];
  /** Listing items the source does not place in any country: reported, never counted as coverage. */
  readonly unknownCountryCount: number;
}

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
    @Optional()
    private readonly officialBulletin?: OfficialBulletinCollector,
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

  /**
   * CTO R158 — official-bulletin METADATA for these countries (ISO3), from the collector's last snapshot. Makes no
   * request. Only items the source places IN one of these countries are returned: an item with an unknown country is
   * never counted as coverage, and is reported only as a count. Link, date, source name and checked-at time only.
   */
  officialBulletins(iso3s: readonly string[]): OfficialBulletinResult {
    const snapshot = this.officialBulletin?.current();
    if (snapshot === undefined) {
      return {
        sourceName: null,
        state: 'NOT_SEARCHED_LANE_OFF',
        reason: 'LANE_NOT_REGISTERED',
        checkedAt: null,
        items: [],
        unknownCountryCount: 0,
      };
    }
    const base = {
      sourceName: snapshot.sourceName,
      reason: snapshot.reason,
      checkedAt: snapshot.checkedAt,
    };
    if (snapshot.state !== 'SEARCHED') {
      const state =
        snapshot.state === 'RIGHTS_NOT_ADMITTED' || snapshot.state === 'UPSTREAM_FAILED'
          ? snapshot.state
          : snapshot.state === 'OFF' || snapshot.state === 'MISCONFIGURED'
            ? 'NOT_SEARCHED_LANE_OFF'
            : 'NOT_SEARCHED_NOT_DUE';
      return { ...base, state, items: [], unknownCountryCount: 0 };
    }
    const items = snapshot.items.filter(
      (item) => item.eventCountry !== null && iso3s.includes(item.eventCountry),
    );
    return {
      ...base,
      state: items.length > 0 ? 'SEARCHED_MATCH' : 'SEARCHED_NO_MATCH',
      items,
      unknownCountryCount: snapshot.items.filter((item) => item.eventCountry === null).length,
    };
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
        /* MASTER CTO R62/R64 · #96 GATE A — no recorded per-use right: never started, named unavailable */
        if (!providerAdmission({ id: provider.id }).admitted) {
          throw new SocialLaneError(provider.id, 'unavailable', 'no recorded per-use right');
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
