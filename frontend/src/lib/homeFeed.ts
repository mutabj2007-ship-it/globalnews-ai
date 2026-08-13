import type { LanguageCode, NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { fetchTopHeadlines } from '@/lib/api/newsApi';
import { allocateHomeFeed } from '@/lib/homeFeedAllocation';

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
    const response = await fetchTopHeadlines(12, language);
    const { featured, inFocus, discovery, latestUpdates } = allocateHomeFeed(response.articles);

    return {
      featured,
      inFocus,
      discovery,
      latestUpdates,
      isLive: true,
      dataMode: response.dataMode,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[home-feed] Failed to load headlines from backend:', error);
    return EMPTY_FEED;
  }
}
