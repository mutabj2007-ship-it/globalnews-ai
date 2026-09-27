'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { accountFetch } from '@/lib/api/accountFetch';
import { useAccount } from '@/lib/hooks/useAccount';
import { useCountryFollows } from '@/components/home/useCountryFollows';
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
import { savedStoryRef } from './savedStoryIdentity';

/**
 * THE ONE ADAPTER BETWEEN THIS SURFACE AND WHAT ACTUALLY EXISTS.
 *
 * Every section states its own provenance. `source: 'live'` means the data
 * came from a capability that exists on the release; `source: 'fixture'` means
 * it came from `devFixtures` because the capability does not exist yet. The
 * page renders a standing banner whenever any section is fixture-backed, so a
 * reviewer is never left to infer which is which.
 *
 * ── WHAT IS LIVE ─────────────────────────────────────────────────────────
 *   account      GET /users/me                    (useAccount)
 *   follows      GET /follows/countries           (useCountryFollows)
 *   history      GET /history                     — real, and really empty:
 *                nothing in the product calls POST /history, so this section
 *                is expected to render its empty state. That is the truth of
 *                the release, and R1.2 draws it deliberately.
 *
 * ── WHAT IS NOT, AND WHY IT IS NOT BUILT HERE ────────────────────────────
 *   saved        No SavedStory model, no /saved route. Building them is
 *                backend persistence, which this lane is forbidden.
 *   new since    Needs the feed plus a previous-visit boundary.
 *   for you      Needs the same feed, filtered by follows.
 *
 * ── THE PREVIOUS-VISIT BOUNDARY IS DELIBERATELY NOT FETCHED ──────────────
 *
 * `POST /users/me/seen` exists, but the capability sheet classifies it REUSE
 * WITH ADDITIVE VISIT-BOUNDARY REPAIR and lists shipping a surface on the
 * unrepaired endpoint among this feature's must-nots: inside the 30-minute
 * throttle a second caller receives the CURRENT visit's own timestamp, so the
 * prior-visit boundary is lost and "new since" silently reads zero. The repair
 * is a backend change and backend work is out of scope here.
 *
 * So this lane builds against the boundary's SHAPE — one nullable ISO string —
 * and reads it from the fixture. `readLiveBoundary` below is written out in
 * full and is never called; it is here so the wiring is obvious to whoever
 * lands the repair, and so that nobody has to guess what this surface expects.
 */

export type SectionSource = 'live' | 'fixture';

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

  readonly follows: readonly string[] | null;
  readonly followsSource: SectionSource;

  readonly recent: readonly RecentQuestion[];
  readonly recentSource: SectionSource;

  readonly usesFixtures: boolean;
  readonly hasError: boolean;
  readonly isDegraded: boolean;

  readonly savedRefs: ReadonlySet<string>;
  readonly toggleSaved: (url: string) => void;
  readonly retry: () => void;
}

export interface RecentQuestion {
  readonly id: string;
  readonly query: string;
  readonly countryCode: string | null;
  readonly createdAt: string;
}

/**
 * The live boundary read, written and intentionally unused.
 *
 * Landing the §4 repair means: call this instead of the fixture, and delete
 * the fixture branch. Nothing else on this surface changes, because every
 * consumer already reads one nullable ISO string.
 */
export async function readLiveBoundary(): Promise<{
  previousSeenAt: string | null;
  firstVisit: boolean;
}> {
  const response = await accountFetch('/users/me/seen', { method: 'POST' });
  if (!response.ok) throw new Error('boundary_unavailable');
  const data = (await response.json()) as {
    previousSeenAt: string | null;
    firstVisit: boolean;
  };
  return { previousSeenAt: data.firstVisit ? null : data.previousSeenAt, firstVisit: data.firstVisit };
}

interface Options {
  /** Render the first-visit state: no boundary at all. */
  readonly forceFirstVisit?: boolean;
  /** Render the degraded state: the boundary check failed. */
  readonly forceBoundaryFailure?: boolean;
  /** Render the empty state: nothing saved, followed or asked. */
  readonly forceEmpty?: boolean;
  /** Render the error state. */
  readonly forceError?: boolean;
}

export function useMyIntelligenceData(options: Options = {}): MyIntelligenceData {
  const { user, isLoading: accountLoading } = useAccount();
  const { follows: liveFollows, isLoading: followsLoading } = useCountryFollows();

  const [recent, setRecent] = useState<RecentQuestion[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [savedRefs, setSavedRefs] = useState<ReadonlySet<string>>(new Set());
  const [nonce, setNonce] = useState(0);

  /*
    THE DEVELOPMENT-REVIEW ACCOUNT.

    The approved signed-in states cannot be inspected without a session, and
    this lane has no backend to sign into. When — and only when — fixtures are
    enabled, a failed account probe presents a fixture reader so the states
    render. In every other configuration this is exactly `user !== null`, so
    production behaviour is the real session and nothing else.

    The fixture banner is on the page the whole time this is in effect, so a
    reviewer is never shown a fixture identity without being told.
  */
  const fixtureAccount = MI_FIXTURES_ENABLED && !accountLoading && user === null;
  const isSignedIn = user !== null || fixtureAccount;

  /*
    THE ONLY NETWORK READ THIS COMPONENT ADDS.

    One GET per mount. No interval, no focus listener, no revalidation. The
    surface reports what one retrieval contained; re-reading it on a timer
    would imply monitoring, which Part IV reserves for Watch and Watch is off.
  */
  useEffect(() => {
    if (accountLoading) return;
    if (!isSignedIn || fixtureAccount) {
      setRecent([]);
      setRecentLoading(false);
      return;
    }

    let cancelled = false;
    accountFetch('/history')
      .then((response) => (response.ok ? (response.json() as Promise<RecentQuestion[]>) : []))
      .then((entries) => {
        if (!cancelled) setRecent(entries);
      })
      .catch(() => {
        if (!cancelled) setRecent([]);
      })
      .finally(() => {
        if (!cancelled) setRecentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountLoading, isSignedIn, fixtureAccount, nonce]);

  /* Saved state starts from the fixture set so the approved collection renders. */
  useEffect(() => {
    if (!MI_FIXTURES_ENABLED || options.forceEmpty === true) {
      setSavedRefs(new Set());
      return;
    }
    setSavedRefs(new Set(FIXTURE_SAVED.map((story) => savedStoryRef(story.url))));
  }, [options.forceEmpty]);

  const toggleSaved = useCallback((url: string) => {
    const ref = savedStoryRef(url);
    setSavedRefs((current) => {
      const next = new Set(current);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }, []);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  const boundaryFailed = options.forceBoundaryFailure === true;
  const isFirstVisit = options.forceFirstVisit === true;

  const previousSeenAt = useMemo(() => {
    if (isFirstVisit || boundaryFailed) return null;
    return MI_FIXTURES_ENABLED ? FIXTURE_PREVIOUS_SEEN_AT : null;
  }, [isFirstVisit, boundaryFailed]);

  const emptied = options.forceEmpty === true;

  const newSinceAll = useMemo(
    () => (emptied ? [] : MI_FIXTURES_ENABLED ? FIXTURE_NEW_SINCE : []),
    [emptied],
  );
  const newSince = useMemo(
    () => selectNewSince(newSinceAll, previousSeenAt),
    [newSinceAll, previousSeenAt],
  );
  const newSinceCount = useMemo(
    () => countNewSince(newSinceAll, previousSeenAt),
    [newSinceAll, previousSeenAt],
  );

  const saved = useMemo(() => {
    if (emptied) return [];
    return FIXTURE_SAVED.filter((story) => savedRefs.has(savedStoryRef(story.url)));
  }, [emptied, savedRefs]);

  /* For you never repeats an item already shown in New since. */
  const forYou = useMemo(() => {
    if (emptied || !MI_FIXTURES_ENABLED) return [];
    const shown = new Set(newSince.map((story) => savedStoryRef(story.url)));
    return FIXTURE_FOR_YOU.filter((story) => !shown.has(savedStoryRef(story.url))).slice(0, 3);
  }, [emptied, newSince]);

  const follows = useMemo(() => {
    if (emptied) return [];
    if (liveFollows !== null && liveFollows.length > 0) return liveFollows;
    return MI_FIXTURES_ENABLED ? FIXTURE_FOLLOWS : liveFollows;
  }, [emptied, liveFollows]);

  const followsSource: SectionSource =
    liveFollows !== null && liveFollows.length > 0 ? 'live' : MI_FIXTURES_ENABLED ? 'fixture' : 'live';

  const usesFixtures =
    MI_FIXTURES_ENABLED &&
    (newSince.length > 0 || saved.length > 0 || forYou.length > 0 || followsSource === 'fixture');

  return {
    isLoading: accountLoading || followsLoading || recentLoading,
    isSignedIn,
    userEmail: user?.email ?? (fixtureAccount ? 'anna@example.com' : null),
    userName: user?.displayName ?? (fixtureAccount ? 'Anna' : null),

    previousSeenAt,
    isFirstVisit,
    boundarySource: MI_FIXTURES_ENABLED ? 'fixture' : 'live',
    boundaryFailed,

    newSince,
    newSinceCount,
    newSinceSource: MI_FIXTURES_ENABLED ? 'fixture' : 'live',

    saved,
    savedSource: MI_FIXTURES_ENABLED ? 'fixture' : 'live',

    forYou,
    forYouSource: MI_FIXTURES_ENABLED ? 'fixture' : 'live',

    follows,
    followsSource,

    /* Real, and really empty — see the header comment. */
    recent: emptied ? [] : recent,
    recentSource: 'live',

    usesFixtures,
    hasError: options.forceError === true,
    isDegraded: boundaryFailed,

    savedRefs,
    toggleSaved,
    retry,
  };
}
