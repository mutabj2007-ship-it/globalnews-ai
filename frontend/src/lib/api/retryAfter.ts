/**
 * MAIN-C2 STAGE 2 — reading `Retry-After` off a real response.
 *
 * RFC 9110 permits two forms and the server may legitimately send either:
 * delta-seconds ("120") or an HTTP-date ("Wed, 21 Oct 2026 07:28:00 GMT").
 * AnalysisRateLimitGuard sends delta-seconds; @nestjs/throttler also sends
 * delta-seconds; a proxy in front of either may rewrite it. Both are parsed
 * rather than assuming the shape this repository happens to emit today.
 *
 * RETURNS UNDEFINED RATHER THAN GUESSING. A missing header is the ordinary
 * case while the analysis call is cross-origin — CORS hides it unless the
 * server lists it in Access-Control-Expose-Headers — and an unreadable header
 * must produce "unknown", never a fabricated number. Callers render a fallback
 * that names no duration; see rateLimitMessage.ts.
 *
 * A past or zero date also returns undefined: "retry in 0 seconds" invites the
 * immediate retry the limit exists to stop, so it is treated as no information
 * rather than as an instruction.
 */
export function parseRetryAfterSeconds(
  headerValue: string | null | undefined,
  now: number = Date.now(),
): number | undefined {
  if (typeof headerValue !== 'string') return undefined;

  const trimmed = headerValue.trim();
  if (trimmed.length === 0) return undefined;

  // delta-seconds: digits only. Deliberately strict — "12abc" is malformed,
  // not twelve, and parseInt would silently accept it.
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    return seconds > 0 ? seconds : undefined;
  }

  const asDate = Date.parse(trimmed);
  if (Number.isNaN(asDate)) return undefined;

  const seconds = Math.ceil((asDate - now) / 1000);
  return seconds > 0 ? seconds : undefined;
}

/**
 * Reads it from a Response, tolerating the header being absent.
 *
 * `headers.get` returning null is expected and normal cross-origin. This
 * helper exists so the null-handling lives in one place and the call sites
 * cannot each invent their own fallback.
 */
export function retryAfterSecondsFrom(response: Response, now: number = Date.now()): number | undefined {
  return parseRetryAfterSeconds(response.headers.get('Retry-After'), now);
}
