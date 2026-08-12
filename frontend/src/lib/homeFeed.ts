import type { LanguageCode, NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { fetchTopHeadlines } from '@/lib/api/newsApi';

export interface HomeFeed {
  featured: NewsArticle | null;
  trending: NewsArticle[];
  categoryCards: NewsArticle[];
  latestUpdates: NewsArticle[];
  /** Whether this feed came from a live backend response. */
  isLive: boolean;
  /** Whether the backend served live provider data or mock data. null = unknown (backend unreachable). */
  dataMode: NewsDataMode | null;
}

const EMPTY_FEED: HomeFeed = {
  featured: null,
  trending: [],
  categoryCards: [],
  latestUpdates: [],
  isLive: false,
  dataMode: null,
};

/**
 * Loads homepage content from the backend's /news/top-headlines endpoint
 * and slices it into the sections the homepage renders. A single request
 * powers the Featured Story, Trending sidebar, category cards, and the
 * Latest Updates feed, rather than four separate round trips.
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
    const headlines = response.articles;

    const featured = headlines[0] ?? null;
    const trending = headlines.slice(1, 6);
    const categoryCards = headlines.slice(6, 12);
    const latestUpdates = [...headlines].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

    return {
      featured,
      trending,
      categoryCards,
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
