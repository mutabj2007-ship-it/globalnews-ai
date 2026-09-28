'use client';

import type { JSX, ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { CountryFollowListResponse } from '@globalnews-ai/shared';
import { useAccount, type AccountUser } from '@/lib/hooks/useAccount';
import { accountFetch } from '@/lib/api/accountFetch';
import { fetchMyIntelligenceFeed } from '@/lib/myIntelligence/myIntelligenceApi';

/**
 * HOME WELCOME & DISCOVERY R1 REV A — ONE ACCOUNT READ FOR EVERY HOME ISLAND.
 *
 * The rail, the returning-reader hero state, the 60-second ordering, For you
 * and the My Intelligence bridge all need to know whether the reader is signed
 * in. `useAccount` has no shared cache, so five islands would mean five
 * `GET /users/me`. This provider makes that read ONCE for the whole page.
 *
 * Follows and the New-since count are read only for a signed-in reader (an anonymous read is a known
 * 401), through the existing Follow API. Nothing here calls AI or a news
 * provider, and nothing is written to browser storage.
 *
 * THIS IS A CLIENT BOUNDARY THAT TAKES ITS CHILDREN AS A PROP, so everything
 * the page passes in stays server-rendered.
 */
export interface HomeSession {
  user: AccountUser | null;
  isLoading: boolean;
  /** ISO3 codes, or null while unknown / signed out. */
  follows: readonly string[] | null;
  /**
   * The truthful New-since count: a number > 0 only when the existing
   * previous-visit boundary exists and something is new; otherwise null
   * (never "0 new"). From GET /users/me/intelligence/feed — retained data,
   * no AI, no provider, and it does NOT advance the boundary.
   */
  newSinceCount: number | null;
}

const HomeSessionContext = createContext<HomeSession>({ user: null, isLoading: true, follows: null, newSinceCount: null });

const FOLLOWS_PATH = '/follows/countries';

export function HomeSessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const { user, isLoading } = useAccount();
  const [follows, setFollows] = useState<readonly string[] | null>(null);
  const [newSinceCount, setNewSinceCount] = useState<number | null>(null);

  useEffect(() => {
    if (user === null) {
      setFollows(null);
      setNewSinceCount(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await accountFetch(FOLLOWS_PATH);
        if (!response.ok) return;
        const data = (await response.json()) as CountryFollowListResponse;
        if (!cancelled) setFollows(data.follows.map((follow) => follow.countryCode));
      } catch {
        /* Follows are an enhancement; Home renders fully without them. */
      }
    })();
    void (async () => {
      try {
        const feed = await fetchMyIntelligenceFeed();
        if (cancelled) return;
        setNewSinceCount(feed.previousSeenAt !== null && feed.newSinceCount > 0 ? feed.newSinceCount : null);
      } catch {
        /* No count is shown rather than a guessed one. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return <HomeSessionContext.Provider value={{ user, isLoading, follows, newSinceCount }}>{children}</HomeSessionContext.Provider>;
}

export function useHomeSession(): HomeSession {
  return useContext(HomeSessionContext);
}
