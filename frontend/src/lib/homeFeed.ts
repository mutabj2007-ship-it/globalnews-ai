import type { LanguageCode, NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { fetchTopHeadlines } from '@/lib/api/newsApi';
import {
  allocateHomeFeed,
  allocateToday,
  EMPTY_TODAY_ALLOCATION,
  type TodayAllocation,
} from '@/lib/homeFeedAllocation';

/**
 * Milestone #51 Phase B — field names now match the four explicit
 * semantic roles (featured / inFocus / discovery / latestUpdates).
 * `trending` and `categoryCards` are renamed to `inFocus` and
 * `discovery` respectively — the OLD names implied concepts (measured
 * popularity; genuine category navigation) the underlying data never
 * actually provided. This is a rename of the data shape only; see
 * homeFeedAllocation.ts for the actual selection logic, now a pure,
 * separately-tested function rather than positional slicing
 * previously inlined in page.tsx.
 */
export interface HomeFeed {
  featured: NewsArticle | null;
  inFocus: NewsArticle[];
  discovery: NewsArticle[];
  latestUpdates: NewsArticle[];
  /**
   * R2 — the Today surface's own view of the SAME single response: the
   * articles this system first observed inside the current UTC day, counted
   * by country. Derived, never fetched — see allocateToday().
   */
  today: TodayAllocation;
  /** Whether this feed came from a live backend response. */
  isLive: boolean;
  /** Whether the backend served live provider data or mock data. null = unknown (backend unreachable). */
  dataMode: NewsDataMode | null;
}

const EMPTY_FEED: HomeFeed = {
  featured: null,
  inFocus: [],
  discovery: [],
  latestUpdates: [],
  today: EMPTY_TODAY_ALLOCATION,
  isLive: false,
  dataMode: null,
};

/**
 * Loads homepage content from the backend's /news/top-headlines endpoint
 * and allocates it into the sections the homepage renders. A single request
 * powers every homepage news section — Featured, In Focus, Discovery, and
 * Latest Updates — rather than four separate round trips. Milestone #51
 * Phase B: the actual allocation logic now lives in the pure, independently
 * tested allocateHomeFeed() (homeFeedAllocation.ts) rather than being
 * inlined here or in page.tsx.
 *
 * If the backend is unreachable (e.g. not started yet in local dev), this
 * degrades to an empty feed instead of throwing, so the homepage still
 * renders with its existing empty-state messaging.
 *
 * Milestone #47 (homepage feed language correction) — `language` is new
 * and optional. Omitted (backward compatible): identical behavior to
 * before. When supplied (from page.tsx's server-side cookie read), the
 * SAME single request now also requests that language from the
 * provider, so the homepage feed itself is language-contained instead
 * of ignoring the user's selection.
 */
export async function getHomeFeed(language?: LanguageCode): Promise<HomeFeed> {
  try {
    /*
      ONE request, of width 24.

      C907 CORRECTION 1 — THE RATIONALE RECORDED HERE HAS CHANGED; THE NUMBER
      HAS NOT. This comment used to justify 24 by visible-surface exclusivity:
      once a story could appear only once, the twelve editorial roles consumed
      a twelve-article response entirely and the Global Intelligence stream
      received nothing. That exclusivity rule is superseded — `latestUpdates`
      is now the whole chronological stream and would be correctly populated
      from a response of any size — so 24 is no longer REQUIRED by an
      invariant.

      IT IS KEPT ANYWAY, AND DELIBERATELY NOT REDUCED. Lowering the single
      request back to 12 would shrink the corpus every homepage surface draws
      from, and no ruling asks for that. Reducing retrieval width is a product
      decision, not a side effect of a feed-allocation correction, so the
      width is left exactly as released and the change is reported to CTO
      rather than made quietly.

      Still exactly one call per invocation: the single-request architecture is
      unchanged. Nothing in this module issues a second provider request under
      any outcome, empty responses included.
    */
    const response = await fetchTopHeadlines(24, language);
    const { featured, inFocus, discovery, latestUpdates } = allocateHomeFeed(response.articles);

    /*
      R2 — ONE instant, captured here, for the Today window.

      It is deliberately taken next to the response rather than in page.tsx,
      because the window this describes is "the UTC day we observed these
      articles in", and the response is the thing being observed. page.tsx's
      own `updatedAt` remains what it has always been — the page-render
      instant shown in the DATA STATUS row — and the two are not conflated:
      one describes a render, the other bounds a retrieval window.

      No new request, no new route, no new client. The corpus width is
      unchanged at 12 (CTO decision D5).
    */
    const observedAt = new Date().toISOString();

    return {
      featured,
      inFocus,
      discovery,
      latestUpdates,
      today: allocateToday(response.articles, observedAt),
      isLive: true,
      dataMode: response.dataMode,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[home-feed] Failed to load headlines from backend:', error);
    return EMPTY_FEED;
  }
}
