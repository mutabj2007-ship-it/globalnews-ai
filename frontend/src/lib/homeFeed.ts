import type { LanguageCode, NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { fetchTopHeadlines } from '@/lib/api/newsApi';
import {
  allocateHomeFeed,
  DEFAULT_IN_FOCUS_COUNT,
  DEFAULT_DISCOVERY_COUNT,
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
   * ── C7 · THE 60-SECOND BRIEF'S OWN ALLOCATION ──────────────────────────
   *
   * BETA HOME CLOSURE R2 replaces the brief's `return null` with a rule that
   * cannot starve it while the response has stories.
   *
   * THE DEFECT THIS FIXES. The brief was fed `latestUpdates`, which under the
   * governed `'exclusive'` stream policy is what REMAINS after the rail
   * consumes 1 + 5 + 6 = 12. At the released retrieval width of 24 that leaves
   * 12, which is a full panel — but a narrow provider response leaves nothing,
   * and the brief then vanished from a page that was otherwise full of
   * reporting. Rendering nothing was the correct emergency behaviour, because
   * the alternative was claiming a provider failure that had not happened, but
   * an always-absent-on-narrow-days panel is not an architecture.
   *
   * THE RULE, STATED ONCE: the brief is the response's chronological head,
   * minus the lead story, capped at three.
   *
   * - CHRONOLOGICAL HEAD, so "your world in 60 seconds" means the newest
   *   reporting rather than whatever the rail happened not to want. This uses
   *   the allocator's `'chronological-inclusive'` policy, which exists as a
   *   named opt-in for exactly this: a complete chronological record that MAY
   *   carry a story a rail role also surfaced.
   * - MINUS THE LEAD, because the lead is rendered a few hundred pixels below
   *   as the large editorial card, and the same headline twice on one screen
   *   reads as a bug. Overlap with inFocus and discovery is accepted: those are
   *   a curated selection, and "also among the newest" is a true statement
   *   about them.
   * - CAPPED AT THREE, which is what the panel renders — one image-led lead and
   *   two follow-up rows.
   *
   * It is therefore empty only when the response carries one story or none, and
   * in that case the panel genuinely has nothing to summarise. No second
   * request: this is another reading of the SAME response.
   */
  briefUpdates: NewsArticle[];
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
  briefUpdates: [],
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

      ALPHA POST-CUTOVER R1 — THE NUMBER STILL HAS NOT CHANGED, AND IT IS
      LOAD-BEARING AGAIN. C907 recorded 24 as no longer REQUIRED by an
      invariant, because `latestUpdates` had been made the whole chronological
      stream and would be populated from a response of any size. That is no
      longer the governing rule: the allocator's default `streamPolicy` is
      `'exclusive'`, so a story the rail places is not repeated in the main
      Home feed, and the stream is once again what REMAINS after the rail.

      THE ARITHMETIC, WHICH IS THE WHOLE REASON THIS IS SAFE. The rail consumes
      1 + 5 + 6 = 12. At width 24 the stream therefore receives 12 — a full
      feed, not a subtraction artefact. The twelve-in/zero-out case that once
      made a healthy provider look unavailable required a TWELVE-record
      retrieval, and that has not been the released width since C907.

      SO DO NOT REDUCE IT. Lowering this back to 12 would empty the Global
      Intelligence stream under the governed placement rule and reintroduce
      exactly the defect C907 was correcting. Reducing retrieval width is a
      product decision and must be taken as one, with the allocator's policy
      considered at the same time — never as a side effect of tuning.

      Still exactly one call per invocation: the single-request architecture is
      unchanged. Nothing in this module issues a second provider request under
      any outcome, empty responses included, and no policy branch in the
      allocator fetches anything.
    */
    const response = await fetchTopHeadlines(24, language);
    const { featured, inFocus, discovery, latestUpdates } = allocateHomeFeed(response.articles);

    /*
      C7 — the brief's allocation. See `briefUpdates` on HomeFeed for the rule
      and why it exists.

      A SECOND ALLOCATION CALL, NOT A SECOND REQUEST. `allocateHomeFeed` is
      pure: it performs no I/O under any policy, which its own module states in
      terms. Both calls read the one `response` already in hand, so the
      single-request architecture is untouched and the provider is called
      exactly once per invocation, as before.
    */
    const chronological = allocateHomeFeed(
      response.articles,
      DEFAULT_IN_FOCUS_COUNT,
      DEFAULT_DISCOVERY_COUNT,
      'chronological-inclusive',
    );
    const briefUpdates = chronological.latestUpdates
      .filter((article) => article.id !== featured?.id)
      .slice(0, 3);

    /*
      R2 — ONE instant, captured here, for the Today window.

      It is deliberately taken next to the response rather than in page.tsx,
      because the window this describes is "the UTC day we observed these
      articles in", and the response is the thing being observed. page.tsx's
      own `updatedAt` remains what it has always been — the page-render
      instant shown in the DATA STATUS row — and the two are not conflated:
      one describes a render, the other bounds a retrieval window.

      No new request, no new route, no new client. Today reads the SAME
      response the rail and the stream are allocated from, at the retrieval
      width documented above.
    */
    const observedAt = new Date().toISOString();

    return {
      featured,
      inFocus,
      discovery,
      latestUpdates,
      briefUpdates,
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
