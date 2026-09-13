import { ANALYSIS_CLIENT_TIMEOUT_MS } from '@globalnews-ai/shared';
import type { AnalysisApiResponse, LanguageCode, StoryContext } from '@globalnews-ai/shared';
import { resolveAccountApiBase } from './accountBase';

/*
  MAIN-C2 STAGE 1 — THE ANALYSIS CALL IS NOW FIRST-PARTY IN THE BROWSER.

  It used to post straight to `NEXT_PUBLIC_API_URL`, which on the live
  deployment is a DIFFERENT SITE — `up.railway.app` is on the Public Suffix
  List — and that had a consequence this file could not show: a SameSite=Lax
  cookie is never attached to a cross-site subresource request, so
  AnalysisRateLimitGuard saw no `gna_session`, resolved every caller as
  anonymous, and served a signed-in visitor the anonymous ceiling while the
  product told them signing in would raise it.

  Routing through this origin's own `/api` fixes it without touching the
  cookie's SameSite attribute — the same repair, and the same reasoning, that
  M-ALPHA-AUTH Option A applies to the account surfaces. `resolveAccountApiBase`
  is REUSED rather than re-derived so there is exactly one definition of where
  first-party requests go.

  RESOLVED PER CALL, NOT AT MODULE SCOPE. A module-scope constant would freeze
  a build-time value, which is the defect being removed rather than relocated.

  SERVER-SIDE CALLERS ARE UNAFFECTED: this module runs in the browser, and
  `resolveAccountApiBase()` returns the absolute backend origin when there is no
  document context, which is what a server-rendered call needs.

  SCOPE NOTE (Main, R2): C55 changes three further things in this file — the
  DisplayLocale type, the Stage 2 Retry-After plumbing, and the 30s -> 75s
  timeout. NONE of them is taken here. This backport carries the first-party
  base and nothing else.
*/
/*
  DERIVED FROM THE SERVER BUDGET. NOT CHOSEN HERE, AND NOT 30s OR 75s.

  The comment that used to stand here derived 30,000 as "the backend's own AI
  call timeout (ANALYSIS_TIMEOUT_MS, default 20s) ... plus network overhead".
  That arithmetic is valid for ONE provider call. `ANALYSIS_TIMEOUT_MS` is a
  PER-ATTEMPT budget, and the Executive Brief repair added a second full
  generation to the same request — so on Railway run 579a0134 the backend
  legitimately took 30,914 ms and this constant had already declared failure at
  30,000.

  There is now one authority for the whole budget, and this value is its
  arithmetic consequence:

      32,000 total server budget + 8,000 transport margin = 40,000 ms

  Changing the client deadline now REQUIRES changing the server budget, which is
  the only way these two can be prevented from drifting apart again.
*/
const REQUEST_TIMEOUT_MS = ANALYSIS_CLIENT_TIMEOUT_MS;

/**
 * M65 — a stable, localizable failure taxonomy.
 *
 * Before M65 the only failure signal this module produced was a
 * hardcoded English sentence, so a throttled or rejected request
 * surfaced to real users as the raw string "Backend responded with 429"
 * / "Backend responded with 400". The HTTP semantics were correct; the
 * user-facing presentation was not.
 *
 * `code` is that same information as a stable enum the UI maps to a
 * dictionary entry, in any language. `status` is retained untouched, so
 * the underlying HTTP semantics remain fully available to any caller
 * that wants them, and `message` still carries the developer-facing
 * detail for logs.
 */
export type AnalysisApiErrorCode =
  /**
   * The analysis did not finish inside the time budget.
   *
   * REV B — TWO SOURCES, ONE MEANING, DELIBERATELY NOT SPLIT. Either the
   * request never reached a response and was aborted locally at
   * REQUEST_TIMEOUT_MS, or the SERVER reached its own total response deadline
   * first and said so with an explicit HTTP 504. The fact the reader needs is
   * identical in both cases — it took too long, try again — and the existing
   * dictionary entry already says exactly that, so no new taxonomy member is
   * introduced. `status` still distinguishes them for logs: 504 for the
   * server-side deadline, undefined for the local abort.
   */
  | 'timeout'
  /** The request failed before any HTTP status existed (offline, DNS, CORS, backend down). */
  | 'network'
  /** HTTP 400/422 — the backend rejected the request itself (e.g. AnalyzeNewsDto's @MinLength(2)). */
  | 'invalid-query'
  /** HTTP 429 — the route's own @Throttle limit was hit. */
  | 'rate-limited'
  /** HTTP 5xx — the backend failed while handling a valid request. */
  | 'server'
  /** Any other non-OK status; deliberately distinct from the above rather than silently folded in. */
  | 'unknown';

/** Maps a real HTTP status onto the taxonomy above. Never invents a status. */
function codeForStatus(status: number): AnalysisApiErrorCode {
  if (status === 429) return 'rate-limited';
  if (status === 400 || status === 422) return 'invalid-query';
  /*
    REV B — 504 IS A DEADLINE, NOT A FAULT, AND MUST BE TESTED BEFORE `>= 500`.

    The backend's AnalysisDeadlineExceededError is a real HTTP 504. Without this
    line it falls through to the `>= 500` rule below and is reported as
    'server' — telling the reader the backend broke, when the backend in fact
    enforced exactly the deadline it promised. Order matters: this must precede
    the general 5xx rule, which stays unchanged for every genuine server fault.
  */
  if (status === 504) return 'timeout';
  if (status >= 500) return 'server';
  return 'unknown';
}

export class AnalysisApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    /** M65 — stable, localizable classification. Defaults to 'unknown' so every pre-M65 construction site keeps working. */
    public readonly code: AnalysisApiErrorCode = 'unknown',
  ) {
    super(message);
    this.name = 'AnalysisApiError';
  }
}

/**
 * In-flight request deduplication.
 *
 * NOT persistent caching: an entry exists only while its request is
 * actually pending, and is removed the instant it settles (success OR
 * failure) — see the `.finally()` below. A later call for the same
 * query after the first has settled always issues a brand-new fetch.
 *
 * This exists specifically because React Strict Mode's development-
 * only effect double-invocation was producing two real POST requests
 * for one user search — an in-flight AbortController approach was
 * tried and failed real-browser acceptance (both requests still
 * reached the backend before either could be aborted in time), so this
 * takes a different approach: reuse the same pending Promise for a
 * second, near-simultaneous call, so only ONE fetch is ever actually
 * issued for two callers requesting the same query at the same time.
 *
 * Keyed by `query.trim()` — the smallest safe key. The backend's own
 * normalizeQuery() (see shared/src/query-normalization.ts) does more
 * (smart-quote/whitespace normalization) than a plain trim, but
 * introducing that same logic here would be a second, independently-
 * evolving normalization algorithm on the frontend — exactly what this
 * hotfix must avoid. `.trim()` alone is already what this file's own
 * caller (SearchPageClient) uses for its own empty-query check, so it
 * introduces no new semantics, just reuses the same minimal notion of
 * "the same query" already implicit in this codebase. The actual HTTP
 * request body is NEVER altered by this — it always sends exactly the
 * raw `query` string the first (deduplication-winning) caller passed,
 * completely unchanged from pre-hotfix behavior.
 */
const inFlightAnalysisRequests = new Map<string, Promise<AnalysisApiResponse>>();

/**
 * Calls the GlobalNews AI backend's analysis endpoint. This is the only
 * place the frontend talks to for AI analysis — it never calls OpenAI
 * (or any AI provider) directly, so no AI key ever needs to exist in
 * frontend code or environment variables.
 *
 * If a request for the same (trimmed) query is already in flight, this
 * returns that exact same pending Promise instead of issuing a second
 * fetch — see inFlightAnalysisRequests above. Every other aspect of
 * this function's behavior (AnalysisApiError shapes, HTTP 429 handling,
 * timeout behavior) is byte-for-byte unchanged from before this hotfix.
 *
 * Milestone #47 — `requestedLanguage` defaults to 'en', so every
 * existing caller that never passes it keeps its exact prior behavior.
 * Now part of the in-flight dedup key too: the same query text
 * requested in two different languages must never share one in-flight
 * request or resolve to the wrong language's response.
 */
export function analyzeNews(
  query: string,
  requestedLanguage: LanguageCode = 'en',
  /**
   * Milestone #51 Phase B — optional, bounded story context (e.g.
   * from a World Map country-feed article's "Ask GlobalNews AI about
   * this" action). Every pre-#51 caller omits this and is completely
   * unaffected. Folded into the in-flight dedup key (via
   * countryCode only — the smallest safe key segment, mirroring the
   * backend's own cache-key strategy) so the same query text
   * anchored to two different stories/countries can never
   * accidentally share one pending request.
   */
  storyContext?: StoryContext,
): Promise<AnalysisApiResponse> {
  /**
   * Milestone #51 Phase B (CTO final correction): prefers
   * storyContext.articleId (the stable, server-resolvable story
   * identity) over countryCode alone, mirroring the backend's own
   * cache-key priority exactly — two different stories in the same
   * country must never share one in-flight request merely because
   * they share a country. Falls back to countryCode when articleId is
   * absent (this session's earlier, still-valid country-only
   * anchoring case); empty suffix when storyContext is absent
   * entirely, unchanged from before this correction.
   */
  const storyAnchorKeySegment = storyContext?.articleId
    ? `:story:${storyContext.articleId}`
    : storyContext?.countryCode
      ? `:story:${storyContext.countryCode.toLowerCase()}`
      : '';
  const key = `${requestedLanguage}:${query.trim()}${storyAnchorKeySegment}`;

  const existing = inFlightAnalysisRequests.get(key);
  if (existing) {
    return existing;
  }

  const request = performAnalyzeNews(query, requestedLanguage, storyContext).finally(() => {
    // Only delete this key's entry if it still points at THIS promise.
    // Guards against a theoretical race where an older, already-
    // resolved request's cleanup could otherwise delete a NEWER
    // in-flight request for the same key (e.g. if this .finally were
    // ever delayed past the point a fresh request for the same query
    // was already stored) — with this check, a stale cleanup is a
    // harmless no-op instead of deleting live state.
    if (inFlightAnalysisRequests.get(key) === request) {
      inFlightAnalysisRequests.delete(key);
    }
  });

  inFlightAnalysisRequests.set(key, request);
  return request;
}

/**
 * PH-1 — the CSRF cookie is deliberately NOT httpOnly (see the backend's
 * cookie.util.ts), so the double-submit echo the rest of the product already
 * performs in lib/api/accountFetch.ts is available here too. Absent cookie
 * means absent header, which is exactly right for a signed-out visitor: they
 * are resolved as anonymous rather than rejected.
 */
const CSRF_COOKIE_NAME = 'gna_csrf';

function readCsrfCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;

  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${CSRF_COOKIE_NAME}=`));

  return match?.split('=')[1];
}

function buildAnalysisHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const csrfToken = readCsrfCookie();

  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  return headers;
}

async function performAnalyzeNews(
  query: string,
  requestedLanguage: LanguageCode,
  storyContext?: StoryContext,
): Promise<AnalysisApiResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${resolveAccountApiBase()}/analysis/news`, {
      method: 'POST',
      headers: buildAnalysisHeaders(),
      /*
       * PH-1 — send the session cookie so an ALREADY SIGNED-IN visitor is
       * recognised and receives the authenticated analysis allowance rather
       * than the anonymous one.
       *
       * THIS DOES NOT MAKE ANALYSIS AUTHENTICATED. A visitor with no session
       * sends no cookie, the backend resolves them as anonymous, and the
       * request is served exactly as before. `credentials: 'include'` with no
       * cookies to send is an ordinary request; nothing here can fail for a
       * signed-out user.
       *
       * The X-CSRF-Token echo in buildAnalysisHeaders() is what stops a
       * cross-site page from spending a signed-in visitor's larger allowance
       * out of their browser — see AnalysisRateLimitGuard.resolveIdentity for
       * the full reasoning. This route had no CSRF semantics before; adding
       * the echo can only add protection, never remove any.
       *
       * NOT routed through accountFetch deliberately: this call needs the
       * abort/timeout controller and `cache: 'no-store'` that accountFetch
       * does not model, and widening accountFetch for one caller would put a
       * timeout policy on every authenticated request in the product.
       */
      credentials: 'include',
      body: JSON.stringify(storyContext ? { query, requestedLanguage, storyContext } : { query, requestedLanguage }),
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AnalysisApiError('The analysis is taking longer than expected. Please try again.', undefined, 'timeout');
    }
    throw new AnalysisApiError(
      error instanceof Error ? error.message : 'Failed to reach the GlobalNews AI backend',
      undefined,
      'network',
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // The message stays developer-facing (logs, debugging). What the
    // user sees is chosen by the caller from `code`, via the dictionary
    // — never this string.
    throw new AnalysisApiError(
      `Backend responded with ${response.status}`,
      response.status,
      codeForStatus(response.status),
    );
  }

  return response.json() as Promise<AnalysisApiResponse>;
}
