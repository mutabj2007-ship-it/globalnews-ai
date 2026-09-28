'use client';

import { useCallback, useMemo } from 'react';
import {
  normalizeArticleUrl,
  type MyIntelligenceInterest,
  type MyIntelligenceStory,
  type SavedStoryView,
} from '@globalnews-ai/shared';
import { useAccount } from '@/lib/hooks/useAccount';
import {
  useIntelligenceInterests,
  useMyIntelligenceFeed,
  useQuestionHistory,
  useSavedStories,
} from '@/lib/myIntelligence/hooks';
import {
  FIXTURE_FOLLOWS,
  FIXTURE_FOR_YOU,
  FIXTURE_NEW_SINCE,
  FIXTURE_PREVIOUS_SEEN_AT,
  FIXTURE_SAVED,
  MI_FIXTURES_ENABLED,
  type FixtureStory,
} from './devFixtures';
import { countNewSince, selectNewSince } from './newSince';
import { selectForYou } from './interestForYou';

/**
 * MY INTELLIGENCE LIVE ADAPTER.
 *
 * PR #45 added the retained feed, saved-story persistence and question-history
 * APIs. The visual R1.2/R1.3 lane originally predated that backend and therefore
 * rendered fixtures/local state. This adapter is the convergence seam: signed-in
 * Alpha readers now consume the live backend; fixtures remain review-only and
 * are used only when NEXT_PUBLIC_MI_DEV_FIXTURES=true and no real session exists.
 *
 * Opening the page still runs zero AI. These hooks perform account reads/writes
 * only; analysis remains behind an explicit Run/Send boundary elsewhere.
 */

export type SectionSource = 'live' | 'fixture';

/** The most For-you stories the workspace ever holds (SPEC.md: the dashboard shows 6, 3 on phone). */
export const FOR_YOU_LIMIT = 6;

export interface MyIntelligenceData {
  readonly isLoading: boolean;
  readonly isSignedIn: boolean;
  readonly userEmail: string | null;
  readonly userName: string | null;

  readonly previousSeenAt: string | null;
  readonly isFirstVisit: boolean;
  readonly boundarySource: SectionSource;
  readonly boundaryFailed: boolean;

  readonly newSince: readonly FixtureStory[];
  readonly newSinceCount: number;
  readonly newSinceSource: SectionSource;

  readonly saved: readonly FixtureStory[];
  readonly savedSource: SectionSource;

  readonly forYou: readonly FixtureStory[];
  readonly forYouSource: SectionSource;
  /* INTEREST + SELECTION HOOK R1 — explicit interests and the For you rule's facts. */
  readonly interests: readonly MyIntelligenceInterest[];
  readonly interestsLoaded: boolean;
  readonly forYouFiltered: boolean;
  readonly forYouMatchCount: number;
  /** The broad followed-country list, shown ONLY when the reader explicitly asks for it. */
  readonly forYouBroad: readonly FixtureStory[];
  readonly saveInterests: (next: readonly MyIntelligenceInterest[]) => Promise<boolean>;
  readonly isSavingInterests: boolean;

  readonly follows: readonly string[] | null;
  readonly followsSource: SectionSource;

  readonly recent: readonly RecentQuestion[];
  readonly recentSource: SectionSource;

  readonly usesFixtures: boolean;
  readonly hasError: boolean;
  readonly isDegraded: boolean;

  /**
   * URLs/normalized URLs currently saved. Kept as a Set so existing visual
   * components need no persistence knowledge.
   */
  readonly savedRefs: ReadonlySet<string>;
  readonly toggleSaved: (url: string) => void;
  readonly retry: () => void;
  /** PREMIUM WORKSPACE R1 — the drawer/rail identity footer's Sign out: the SAME account hook this page already mounts. */
  readonly signOut: () => Promise<void>;
}

export interface RecentQuestion {
  readonly id: string;
  readonly query: string;
  readonly countryCode: string | null;
  readonly createdAt: string;
}

interface Options {
  readonly forceFirstVisit?: boolean;
  readonly forceBoundaryFailure?: boolean;
  readonly forceEmpty?: boolean;
  readonly forceError?: boolean;
}

function firstCountry(codes: readonly string[]): string {
  return codes[0] ?? 'GLOBAL';
}

function feedStoryToUi(story: MyIntelligenceStory): FixtureStory {
  return {
    articleRef: story.articleRef,
    id: story.id,
    url: story.url,
    title: story.title,
    sourceName: story.sourceName,
    publishedAt: story.publishedAt,
    countryCode: firstCountry(story.countryCodes),
    /* INTEREST + SELECTION HOOK R1 — the story's real category (older feeds without one keep the old label). */
    category: story.category ?? 'Following',
    interests: story.interests ?? [],
    ...(story.firstSeenAt ? { firstSeenAt: story.firstSeenAt } : {}),
    ...(story.imageUrl ? { imageUrl: story.imageUrl } : {}),
  };
}

function savedStoryToUi(story: SavedStoryView): FixtureStory {
  return {
    articleRef: story.articleRef,
    id: story.articleRef,
    url: story.sourceUrl || story.canonicalUrl,
    title: story.title,
    sourceName: story.sourceName,
    publishedAt: story.publishedAt,
    countryCode: firstCountry(story.countryCodes),
    category: 'Saved',
    savedAt: story.savedAt,
    ...(story.firstSeenAt ? { firstSeenAt: story.firstSeenAt } : {}),
    ...(story.imageUrl ? { imageUrl: story.imageUrl } : {}),
  };
}

export function useMyIntelligenceData(options: Options = {}): MyIntelligenceData {
  const { user, isLoading: accountLoading, signOut } = useAccount();
  const feed = useMyIntelligenceFeed();
  const savedState = useSavedStories();
  const history = useQuestionHistory();
  const interestState = useIntelligenceInterests();
  const chosenInterests = useMemo(() => interestState.data ?? [], [interestState.data]);

  const fixtureAccount = MI_FIXTURES_ENABLED && !accountLoading && user === null;
  const isSignedIn = user !== null || fixtureAccount;
  const emptied = options.forceEmpty === true;

  const liveFeedStories = useMemo(
    () => (feed.data?.stories ?? []).map(feedStoryToUi),
    [feed.data],
  );
  const liveSavedStories = useMemo(
    () => (savedState.data ?? []).map(savedStoryToUi),
    [savedState.data],
  );

  const boundaryFailed =
    options.forceBoundaryFailure === true || (!fixtureAccount && user !== null && feed.failed);

  const previousSeenAt = useMemo(() => {
    if (options.forceFirstVisit === true || boundaryFailed) return null;
    if (fixtureAccount) return FIXTURE_PREVIOUS_SEEN_AT;
    return feed.data?.previousSeenAt ?? null;
  }, [boundaryFailed, feed.data?.previousSeenAt, fixtureAccount, options.forceFirstVisit]);

  const isFirstVisit =
    options.forceFirstVisit === true || (!boundaryFailed && previousSeenAt === null);

  const allFeedStories = useMemo(
    () => (emptied ? [] : fixtureAccount ? [...FIXTURE_NEW_SINCE, ...FIXTURE_FOR_YOU] : liveFeedStories),
    [emptied, fixtureAccount, liveFeedStories],
  );

  const newSince = useMemo(
    () => (emptied ? [] : selectNewSince(allFeedStories, previousSeenAt)),
    [allFeedStories, emptied, previousSeenAt],
  );
  const newSinceCount = useMemo(
    () => (emptied ? 0 : countNewSince(allFeedStories, previousSeenAt)),
    [allFeedStories, emptied, previousSeenAt],
  );

  const saved = useMemo(
    () => (emptied ? [] : fixtureAccount ? FIXTURE_SAVED : liveSavedStories),
    [emptied, fixtureAccount, liveSavedStories],
  );

  const savedRefs = useMemo(() => {
    const refs = new Set<string>();
    for (const story of saved) {
      refs.add(story.url);
      refs.add(normalizeArticleUrl(story.url));
    }
    if (!fixtureAccount) {
      for (const story of savedState.data ?? []) {
        refs.add(story.canonicalUrl);
        refs.add(story.sourceUrl);
        refs.add(normalizeArticleUrl(story.canonicalUrl));
        refs.add(normalizeArticleUrl(story.sourceUrl));
      }
    }
    return refs;
  }, [fixtureAccount, saved, savedState.data]);

  /* The For you candidates: retained followed-country reporting, minus New since and Saved. */
  const forYouCandidates = useMemo(() => {
    if (emptied) return [];
    const shown = new Set(newSince.map((story) => normalizeArticleUrl(story.url)));
    if (fixtureAccount) {
      return FIXTURE_FOR_YOU.filter((story) => !shown.has(normalizeArticleUrl(story.url)));
    }
    const savedUrls = new Set(saved.map((story) => normalizeArticleUrl(story.url)));
    return liveFeedStories.filter((story) => {
      const ref = normalizeArticleUrl(story.url);
      return !shown.has(ref) && !savedUrls.has(ref);
    });
  }, [emptied, fixtureAccount, liveFeedStories, newSince, saved]);

  /*
    INTEREST + SELECTION HOOK R1 — explicit interests filter For you only
    (selectForYou): no backfill, match-then-recency order, the dashboard max
    (SPEC.md "For you … Shows 6"; the dashboard bounds phone to 3). New since
    and Saved are never filtered by interests.
  */
  const forYouSelection = useMemo(
    () => selectForYou(forYouCandidates, chosenInterests, FOR_YOU_LIMIT),
    [chosenInterests, forYouCandidates],
  );
  const forYou = forYouSelection.stories;
  const forYouBroad = useMemo(() => forYouCandidates.slice(0, FOR_YOU_LIMIT), [forYouCandidates]);

  const follows = useMemo<readonly string[] | null>(() => {
    if (emptied) return [];
    if (fixtureAccount) return FIXTURE_FOLLOWS;
    if (feed.data === null) return null;
    return feed.data.followedCountries.map((entry) => entry.countryCode);
  }, [emptied, feed.data, fixtureAccount]);

  const recent = useMemo<readonly RecentQuestion[]>(
    () => (emptied || fixtureAccount ? [] : history.data ?? []),
    [emptied, fixtureAccount, history.data],
  );

  const toggleSaved = useCallback(
    (url: string) => {
      if (fixtureAccount) return;
      const normalized = normalizeArticleUrl(url);
      const existing = savedState.data?.find(
        (story) =>
          normalizeArticleUrl(story.canonicalUrl) === normalized ||
          normalizeArticleUrl(story.sourceUrl) === normalized,
      );

      if (existing) {
        void savedState.remove(existing.articleRef);
      } else {
        void savedState.save({ url });
      }
    },
    [fixtureAccount, savedState],
  );

  const retry = useCallback(() => {
    void Promise.all([feed.refresh(), savedState.refresh(), history.refresh()]);
  }, [feed, history, savedState]);

  const liveFailure =
    !fixtureAccount &&
    user !== null &&
    (feed.failed || savedState.failed || history.failed);

  const source: SectionSource = fixtureAccount ? 'fixture' : 'live';
  const usesFixtures = fixtureAccount && !emptied;

  return {
    isLoading:
      accountLoading ||
      (user !== null && (feed.isLoading || savedState.isLoading || history.isLoading)),
    isSignedIn,
    userEmail: user?.email ?? (fixtureAccount ? 'anna@example.com' : null),
    userName: user?.displayName ?? (fixtureAccount ? 'Anna' : null),

    previousSeenAt,
    isFirstVisit,
    boundarySource: source,
    boundaryFailed,

    newSince,
    newSinceCount,
    newSinceSource: source,

    saved,
    savedSource: source,

    forYou,
    forYouSource: source,
    interests: chosenInterests,
    interestsLoaded: !interestState.isLoading,
    forYouFiltered: forYouSelection.filtered,
    forYouMatchCount: forYouSelection.matchCount,
    forYouBroad,
    saveInterests: interestState.save,
    isSavingInterests: interestState.isSaving,

    follows,
    followsSource: source,

    recent,
    recentSource: source,

    usesFixtures,
    hasError: options.forceError === true || liveFailure,
    isDegraded: boundaryFailed || liveFailure,

    savedRefs,
    toggleSaved,
    retry,
    signOut,
  };
}
