/**
 * ════════════════════════════════════════════════════════════════════════════
 * BETA-ASK-005 — BOUNDED CURRENT-REPORTING WINDOWS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * "What has changed in eastern DRC over the last 7 days?" was refused as
 * CLARIFICATION_REQUIRED / BROADENING_OFFERED: frozen C has no time channel, so every stated
 * period was an untransportable constraint. The executor can now honour ONE family of periods
 * exactly — a relative window of the last / past N days or hours — as a PUBLICATION window:
 *
 *   from = requestInstant − N,  to = requestInstant
 *
 * `requestInstant` is the server-held instant of THIS request (never the browser clock, never
 * a clock read here: this module is pure). Evidence is then restricted to reports whose
 * TRUSTWORTHY publication time lies inside the window (analysis-side post-filter), and the
 * model is told the window bounds publication, not events.
 *
 * Everything else — "this week", "last month", "recently", absolute dates — is unchanged and
 * still reaches frozen C as a constraint (and may still clarify). The window is disclosed to
 * the reader as an APPLIED time chip.
 */

export interface ReportingWindow {
  /** The reader's own words ("last 7 days"). */
  readonly statedPeriod: string;
  /** Window length in hours (7 days = 168). */
  readonly hours: number;
  /** ISO-8601, requestInstant − hours. */
  readonly from: string;
  /** ISO-8601, the request instant. */
  readonly to: string;
  /** What the window bounds: the publication time of the evidence, never the event. */
  readonly basis: 'PUBLICATION_TIME';
}

export const MAX_WINDOW_DAYS = 30;
export const MAX_WINDOW_HOURS = 72;

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
};

const RELATIVE_WINDOW =
  /^(?:(?:over|in|during|within|for)\s+)?(?:the\s+)?(?:last|past|previous)\s+(\d{1,3}|[a-z]+)\s+(days?|hours?)$/i;

/** Hours of a supported relative window, or null when the phrase is not one. */
export function supportedWindowHours(statedPeriod: string): number | null {
  const match = statedPeriod.trim().replace(/\s+/g, ' ').match(RELATIVE_WINDOW);
  if (!match?.[1] || !match[2]) return null;
  const raw = match[1].toLowerCase();
  const n = /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw];
  if (n === undefined || !Number.isInteger(n) || n < 1) return null;
  const unit = match[2].toLowerCase().startsWith('day') ? 'day' : 'hour';
  if (unit === 'day') return n <= MAX_WINDOW_DAYS ? n * 24 : null;
  return n <= MAX_WINDOW_HOURS ? n : null;
}

/**
 * The bounded window for a stated relative period, anchored on the server request instant.
 * Null when the period is not a supported window or no valid request instant is held.
 */
export function reportingWindowFor(
  statedPeriod: string | undefined,
  anchor: string | undefined,
  requestInstant: string | undefined,
): ReportingWindow | null {
  if (statedPeriod === undefined || anchor !== 'RELATIVE_TO_ASK' || requestInstant === undefined) {
    return null;
  }
  const hours = supportedWindowHours(statedPeriod);
  const to = Date.parse(requestInstant);
  if (hours === null || !Number.isFinite(to)) return null;
  return {
    statedPeriod,
    hours,
    from: new Date(to - hours * 3_600_000).toISOString(),
    to: new Date(to).toISOString(),
    basis: 'PUBLICATION_TIME',
  };
}
