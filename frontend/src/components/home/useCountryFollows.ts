'use client';

import { useEffect, useState } from 'react';
import type { CountryFollowListResponse } from '@globalnews-ai/shared';
import { accountFetch } from '@/lib/api/accountFetch';

/**
 * R4 — WATCH: THE ENTIRE FOLLOW-STATE MECHANISM, AND NOTHING MORE.
 *
 * ── THIS IS NOT AN ALERT ENGINE, AND THE ABSENCES ARE THE CONTRACT ────────
 *
 * There is no interval, no timer, no scheduler, no worker, no socket, no
 * EventSource, no visibility or focus listener, no service-worker message and
 * no notification of any kind. Follow state is read EXACTLY TWICE in the life
 * of a page: once when the surface mounts, and once more immediately after a
 * mutation THE USER PERFORMED, so the list they are looking at agrees with the
 * row they just changed. Nothing else can cause a read.
 *
 * That is a deliberate ceiling, not an unfinished state. A surface that
 * re-read itself on a timer would be claiming to watch the world; this one
 * only ever reports what a single retrieval already contains, and re-reading
 * it would produce the same answer while implying otherwise.
 *
 * ── WHY IT LIVES BESIDE THE COMPONENTS RATHER THAN IN lib/hooks ───────────
 *
 * `lib/hooks/useAccount.ts` is the convention this file deliberately mirrors,
 * and by convention this hook belongs beside it. It is here instead because
 * CTO ruling D2 placed it here: the alternative widened this lane into
 * `lib/api/**` and `lib/hooks/**`, neither of which G owns. The cost is one
 * data hook under `components/home/`; the benefit is that no directory outside
 * the declared scope is touched. Recorded plainly rather than left to be
 * discovered.
 *
 * ── SIGNED OUT IS NOT AN ERROR ────────────────────────────────────────────
 *
 * `follows === null` means "no follow list is available to this visitor" — a
 * 401, a network failure, or simply nobody signed in. `useAccount` already
 * rules that these are indistinguishable to a guest and must never surface as
 * an error, and that ruling is repeated here rather than re-litigated: the
 * overwhelmingly common case for this endpoint is an anonymous reader, and the
 * guest homepage must not break because of it.
 *
 * `follows === []` is a DIFFERENT and equally real state — signed in, no
 * countries followed yet — and the surface renders an invitation for it, never
 * the anonymous copy. Collapsing the two would tell a signed-in reader to sign
 * in.
 *
 * ── NO ANONYMOUS IDENTITY, EVER ───────────────────────────────────────────
 *
 * Nothing here writes localStorage, sessionStorage, IndexedDB or a cookie, and
 * no anonymous identifier is generated, derived or persisted. Ownership comes
 * from the session cookie `accountFetch` sends, or the reader has no follows.
 * A local stand-in would be an identity the accepted architecture rules out
 * before MVP, and it would silently become a tracking surface.
 *
 * ── AND NOT `POST /users/me/seen` ─────────────────────────────────────────
 *
 * That route records a return visit and returns the previous one. It is a
 * mutation on load, and its only use is a "since your last visit" claim, which
 * this phase must not make. Watch does not call it.
 *
 * ── CODES ARE ISO-3 HERE, BECAUSE THE API IS ──────────────────────────────
 *
 * `CountryFollowView.countryCode` is ISO 3166-1 alpha-3, validated against the
 * canonical list by the backend DTO. `NewsArticle.countryCode` is alpha-2.
 * This hook keeps the API's own alphabet and never converts: the ONE canonical
 * conversion happens at the render boundary through `findCountryByIso3`, so a
 * truncated `slice(0, 2)` can never appear anywhere in the chain.
 */
export interface CountryFollowsState {
  /**
   * Followed countries as ISO-3, upper case — or `null` when no list is
   * available to this visitor (anonymous, 401, or a failed read). NEVER an
   * empty array in that case: `[]` means signed in with nothing followed.
   */
  follows: string[] | null;
  /**
   * The server's own ceiling, echoed from the response. A RESOURCE SAFETY
   * BOUND, never a plan entitlement — and never hard-coded here, so the
   * surface cannot disagree with the backend about the number.
   */
  maxFollows: number | null;
  isLoading: boolean;
  /** The ISO-3 code of the row whose mutation is in flight, if any. */
  pendingCountry: string | null;
  /** The ISO-3 code whose last mutation did not save, if any. */
  failedCountry: string | null;
  follow: (countryCode: string) => Promise<void>;
  unfollow: (countryCode: string) => Promise<void>;
}

const FOLLOWS_PATH = '/follows/countries';

export function useCountryFollows(): CountryFollowsState {
  const [follows, setFollows] = useState<string[] | null>(null);
  const [maxFollows, setMaxFollows] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCountry, setPendingCountry] = useState<string | null>(null);
  const [failedCountry, setFailedCountry] = useState<string | null>(null);

  /*
    THE ONLY READ PATH. Both the mount read and the post-mutation re-read go
    through this one function, so there is exactly one place a request to the
    follow API can originate and exactly one place its shape is interpreted.
  */
  async function read(): Promise<void> {
    try {
      const response = await accountFetch(FOLLOWS_PATH);
      if (!response.ok) {
        setFollows(null);
        setMaxFollows(null);
        return;
      }
      const data = (await response.json()) as CountryFollowListResponse;
      setFollows(data.follows.map((entry) => entry.countryCode.trim().toUpperCase()));
      setMaxFollows(data.maxFollows);
    } catch {
      setFollows(null);
      setMaxFollows(null);
    } finally {
      setIsLoading(false);
    }
  }

  /*
    ONE READ ON MOUNT. The empty dependency array is the guarantee, and it is
    written exactly the way `useAccount` writes it — including the lint
    suppression — so the two hooks cannot drift into different mount semantics.
  */
  useEffect(() => {
    void read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function mutate(countryCode: string, method: 'POST' | 'DELETE'): Promise<void> {
    const code = countryCode.trim().toUpperCase();
    setPendingCountry(code);
    setFailedCountry(null);
    try {
      const response =
        method === 'POST'
          ? await accountFetch(FOLLOWS_PATH, { method: 'POST', body: { countryCode: code } })
          : await accountFetch(`${FOLLOWS_PATH}/${code}`, { method: 'DELETE' });

      if (!response.ok) {
        /*
          A refusal is REPORTED, never swallowed and never optimistically
          applied. The at-limit case is a 409 the backend states as a conflict
          rather than a payment or permission problem, and the surface says the
          same thing: the row simply did not change.
        */
        setFailedCountry(code);
        return;
      }

      /* THE ONE RE-READ, AFTER A MUTATION THE USER PERFORMED. */
      await read();
    } catch {
      setFailedCountry(code);
    } finally {
      setPendingCountry(null);
    }
  }

  return {
    follows,
    maxFollows,
    isLoading,
    pendingCountry,
    failedCountry,
    follow: (countryCode: string) => mutate(countryCode, 'POST'),
    unfollow: (countryCode: string) => mutate(countryCode, 'DELETE'),
  };
}
