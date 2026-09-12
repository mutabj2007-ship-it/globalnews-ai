'use client';

import { useEffect, useState } from 'react';
import { accountFetch } from '@/lib/api/accountFetch';

/**
 * R1/T2 — THE AUTHENTICATED RETURN BOUNDARY, FROM THE CONTRACT THAT ALREADY
 * EXISTS.
 *
 * ── WHAT THIS REPLACES, AND WHY ──────────────────────────────────────────
 *
 * The previous implementation held the boundary in `localStorage`. That is
 * removed entirely. It was a device-local clock: two people sharing a browser
 * shared it, the same person on a second device had none, and it was the
 * visitor's own time rather than the platform's. `POST /users/me/seen` was
 * built for exactly this surface — its own doc says "when the Today surface
 * exists it calls this once per load" — so this hook is a consumer, not a new
 * mechanism.
 *
 * ── THE TRACE, END TO END ────────────────────────────────────────────────
 *
 *   controller   users.controller.ts   @Post('me/seen'), @HttpCode(200),
 *                                      @UseGuards(RequireAuthGuard, CsrfGuard)
 *   service      users.service.ts      recordSeen(userId, now)
 *   database     User.lastSeenAt       written ONLY by this route
 *   request      no body
 *   response     { previousSeenAt: string | null, firstVisit, recorded }
 *   csrf         accountFetch echoes the gna_csrf cookie as X-CSRF-Token on
 *                every POST — already the frontend half of the double submit
 *   boundary     previousSeenAt is the value BEFORE this visit: the service
 *                READS BEFORE IT WRITES, which is the whole contract
 *   timing       throttled at RETURN_VISIT_MIN_INTERVAL_MS (30 minutes). Inside
 *                the window nothing is written and the REAL previous value is
 *                still returned, so a refresh is answered correctly and the
 *                comparison window never collapses to the gap between two page
 *                views
 *
 * ── AUTHENTICATED ONLY, BY DESIGN ────────────────────────────────────────
 *
 * `RequireAuthGuard` means an anonymous caller cannot reach this at all, and
 * the endpoint's own comment calls that the product boundary rather than an
 * oversight. So this hook is called ONLY where a follow list proves an account
 * exists, a 401 is a normal answer rather than an error, and the signed-out
 * surface makes no return-state claim of any kind.
 *
 * ── ABSENCE STAYS A RESULT ───────────────────────────────────────────────
 *
 * `previousSeenAt: null` with `firstVisit: true` is a first-ever visit: there
 * is genuinely no interval to report, and WATCH says so by naming what it IS
 * showing instead of inventing what was missed. A failed or refused request
 * lands in the same state. Nothing here ever turns "we do not know" into 0.
 */
const SEEN_PATH = '/users/me/seen';

/** Mirrors the backend's ReturnStateView. It lives in backend/, not shared/,
 *  so it is declared here rather than imported — the same way this frontend
 *  already declares every other response shape shared/ does not export. */
interface ReturnStateResponse {
  previousSeenAt: string | null;
  firstVisit: boolean;
  recorded: boolean;
}

export interface ReturnState {
  /** ISO-8601 boundary, or null when there is none to report. */
  previousSeenAt: string | null;
  /** True while the one request is in flight. */
  isLoading: boolean;
}

export function useReturnState(enabled: boolean): ReturnState {
  const [previousSeenAt, setPreviousSeenAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setPreviousSeenAt(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    /*
      ONE REQUEST, ON MOUNT, AND ONLY WHERE AN ACCOUNT IS ALREADY PROVEN.
      The same single-read shape useCountryFollows uses: no polling, no timer,
      no retry, and no second call anywhere in this surface.
    */
    async function read(): Promise<void> {
      try {
        const response = await accountFetch(SEEN_PATH, { method: 'POST' });
        if (!response.ok) {
          if (!cancelled) setPreviousSeenAt(null);
          return;
        }
        const data = (await response.json()) as ReturnStateResponse;
        if (cancelled) return;
        /* firstVisit is authoritative: it says there is no interval, which is
           not the same thing as an interval containing nothing. */
        setPreviousSeenAt(data.firstVisit ? null : data.previousSeenAt);
      } catch {
        if (!cancelled) setPreviousSeenAt(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void read();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { previousSeenAt, isLoading };
}

/**
 * How many of these records this system first observed AFTER the boundary.
 *
 * The comparison is against `firstSeenAt` — when GLOBALNEWS AI first wrote the
 * article down — never against `publishedAt`. A record published last week and
 * retrieved by us an hour ago is genuinely new to this surface; one published
 * an hour ago that we retrieved last week is not. Records with no `firstSeenAt`
 * are not counted, because for those no first observation can be established
 * and a guess would be a fabricated missed development.
 */
export function countSince(
  records: ReadonlyArray<{ firstSeenAt?: string }>,
  boundary: string | null,
): number {
  if (boundary === null) return 0;
  const at = Date.parse(boundary);
  if (Number.isNaN(at)) return 0;
  return records.filter((r) => {
    if (r.firstSeenAt === undefined) return false;
    const seen = Date.parse(r.firstSeenAt);
    return !Number.isNaN(seen) && seen > at;
  }).length;
}
