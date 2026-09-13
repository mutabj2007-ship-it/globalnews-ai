import type { LanguageCode, NewsDataMode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * M66.13 — `unavailable` is added so the four NewsDataMode members and the
 * transport failure each map to their own state. It used to collapse into
 * `unknown`, which is weaker than the shared contract allows: shared/src/news.ts
 * distinguishes "we tried and there is nothing" from "we do not know", and only
 * the former guarantees no reporting exists.
 */
export type LiveStatusKey =
  | 'live'
  | 'cached'
  | 'mock'
  | 'unavailable'
  | 'reconnecting'
  | 'unknown';

export interface LiveStatusResult {
  /** True only when the fetch genuinely succeeded AND the backend reports dataMode 'live' — never true on cached/mock/reconnecting/unknown. */
  isReallyLive: boolean;
  /** Which honest state this is, for callers that need to branch on it directly rather than re-deriving it from badgeText. */
  statusKey: LiveStatusKey;
  /** Real, localized badge text — never a hardcoded English literal, regardless of caller. */
  badgeText: string;
  /** Real UTC time, formatted per the given language's locale ("HH:MM" digit format — en-US/pl-PL produce the identical digit format for this exact option set, so switching locale is safe). Never a hardcoded prototype value. */
  lastUpdated: string;
}

/**
 * M65 — extracted verbatim from LiveStatusStrip.tsx's own prior inline
 * computation (isReallyLive, the honest five-way badge-text branch, the
 * real toLocaleTimeString call) into one pure, presentation-independent
 * function. No Tailwind, no CSS, no colors, no JSX, no layout decisions
 * of any kind — those belong to each of the two visual presentations
 * (Hero's desktop DATA STATUS row, LiveStatusStrip's mobile strip) that
 * both call this same function with the same real isLive/dataMode
 * inputs. ONE truth model, two presentations — never two independent
 * computations that could silently drift apart.
 *
 * `updatedAt` is an explicit parameter (an ISO timestamp string) rather
 * than this function calling `new Date()` internally. Hero is a Client
 * Component; generating the time imperatively on every render there
 * would mean the mobile strip and the desktop row could each capture a
 * different instant and genuinely disagree. page.tsx (the Server
 * Component) resolves ONE timestamp per request and passes the SAME
 * value to both presentations — this function's own job stays exactly
 * what it was: turn a real time value into the correct UTC HH:MM format
 * for the given language, never a hardcoded prototype value.
 *
 * HONEST LIMITATION (unchanged from the pre-M65 behaviour it replaces):
 * `updatedAt` is the page-render instant, not the feed-fetch instant.
 * Centralising it here does not fix that, and this function does not
 * pretend otherwise — it only guarantees both surfaces show the SAME
 * real value.
 */
export function resolveLiveStatus(
  isLive: boolean,
  dataMode: NewsDataMode | null,
  language: LanguageCode,
  updatedAt: string | Date,
): LiveStatusResult {
  const t = getDictionary(language).liveStatusStrip;

  const isReallyLive = isLive && dataMode === 'live';

  const statusKey: LiveStatusKey = !isLive
    ? 'reconnecting'
    : dataMode === 'live'
      ? 'live'
      : dataMode === 'cached'
        ? 'cached'
        : dataMode === 'mock'
          ? 'mock'
          : dataMode === 'unavailable'
            ? 'unavailable'
            : 'unknown';

  const badgeText =
    statusKey === 'reconnecting'
      ? t.reconnecting
      : statusKey === 'live'
        ? t.live
        : statusKey === 'cached'
          ? t.cached
          : statusKey === 'mock'
            ? t.mock
            : statusKey === 'unavailable'
              ? t.unavailable
              : t.unknown;

  const lastUpdated = new Date(updatedAt).toLocaleTimeString(language === 'pl' ? 'pl-PL' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  });

  return { isReallyLive, statusKey, badgeText, lastUpdated };
}
