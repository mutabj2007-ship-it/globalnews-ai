/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE COUNTRY READ ACTION — THE ONE DOOR, AND THE HANDLE THAT WAS MISSING
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `MAP-GNEWS-QUOTA-REGRESSION-1` removed `fetchCountryNews` from the Map
 * entirely, and `MapPageClient` still records why:
 *
 *     "`fetchCountryNews` executes GNews. With the import gone the Map has no
 *      way to reach it, which is a stronger guarantee than a rule about who may
 *      call it."
 *
 * That removal was right and it is not being undone. What it left behind is the
 * defect `MAIN-COUNTRY-READER-RETRIEVAL-CONTRACT-R1` measures in its own words:
 * **the door was locked and no handle was fitted.** `EXPLICIT_RETRIEVAL_ACTION`
 * existed in the authority and in three spec suites, and in **zero** production
 * call sites — so a reader could select a country and had no way to ask for
 * anything about it.
 *
 * ── WHAT THIS MODULE IS, AND WHY IT IS A MODULE ──────────────────────────
 *
 * It is the ONE call site Main's §2 specifies, kept in one file so the
 * guarantee can stay close to the shape the original one had. The Map still
 * does not import the news client; it imports THIS, which cannot be invoked
 * without a `CountryReadRequest` — and that request cannot be constructed from
 * a selection the reader did not make, because `countryReadRequestFor` refuses
 * six ways and its `reason` is narrowed to the single explicit token.
 *
 * ** THE GUARANTEE HAS CHANGED CLASS, AND THAT IS STATED RATHER THAN HIDDEN. **
 * It was STRUCTURAL — the symbol was unreachable from the route. It is now
 * GATED — the symbol is reachable through exactly one function that demands a
 * token only an explicit reader action can produce. A gated guarantee is weaker
 * than an absent one and it is what the product needs to be honest about ACTIVE;
 * `providerBoundaryMatrix.spec.ts` records the trade and asserts the new shape,
 * scenario by scenario, rather than the old string absence alone.
 *
 * ── WHAT IT DOES NOT DO ──────────────────────────────────────────────────
 *
 * No cache, no retry, no queue, no polling, no prefetch, no background refresh.
 * A retry is the reader pressing the control again, which is another explicit
 * action and another deliberate cost.
 */
import { fetchCountryNews, CountryNewsApiError } from '@/lib/api/countryApi';
import type { CountryNewsResponse, LanguageCode, NewsCategory } from '@globalnews-ai/shared';
import type { CountryReadRequest } from '@/lib/map/retrieval/countryReadRequest';
import { COUNTRY_READ_COST_CLASS } from '@/lib/map/retrieval/countryReadRequest';

/**
 * The governed failure classes.
 *
 * Main §5.1: *"`CountryNewsApiError`, an abort, a timeout and a rate-limit are
 * all 'couldn't load right now — try again' to a reader; the distinction
 * belongs in telemetry."*
 *
 * So these tokens exist for the LOG, not for the screen. The reader-facing
 * sentence is one string chosen by the surface; these say which kind of thing
 * went wrong for whoever later has to find out why.
 */
export type CountryReadFailureClass =
  /** The request was superseded or the reader navigated away. Not a fault. */
  | 'ABORTED'
  /** Our API answered, and not with success. */
  | 'API_STATUS'
  /** Our API could not be reached, or did not answer in time. */
  | 'UNREACHABLE'
  /** Anything else. Present so that "unknown" is a named class, not a gap. */
  | 'UNKNOWN';

export interface CountryReadFailure {
  readonly failureClass: CountryReadFailureClass;
  /**
   * DIAGNOSTIC ONLY, AND NAMED SO IT CANNOT DRIFT ONTO A SCREEN.
   *
   * `CountryNewsApiError` carries strings like `Backend responded with 502` and
   * the raw `error.message` from a failed fetch. Those are the exact sentences
   * §5.1 forbids a reader seeing. The field keeps them for telemetry and the
   * name says what it is for; a guard asserts no rendered surface reads it.
   */
  readonly diagnostic: string;
  /** The HTTP status, when our API gave one. */
  readonly status?: number;
}

/**
 * Classify a thrown value. Total by construction — every input yields a class,
 * so there is no path on which a failure is silently not a failure.
 */
export function classifyCountryReadFailure(error: unknown): CountryReadFailure {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { failureClass: 'ABORTED', diagnostic: 'AbortError' };
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return { failureClass: 'ABORTED', diagnostic: 'AbortError' };
  }
  if (error instanceof CountryNewsApiError) {
    return error.status === undefined
      ? { failureClass: 'UNREACHABLE', diagnostic: error.message }
      : { failureClass: 'API_STATUS', diagnostic: error.message, status: error.status };
  }
  if (error instanceof Error) {
    return { failureClass: 'UNKNOWN', diagnostic: `${error.name}: ${error.message}` };
  }

  return { failureClass: 'UNKNOWN', diagnostic: 'non-Error thrown value' };
}

/** How many articles one explicit read asks for. */
export const COUNTRY_READ_LIMIT = 24;

/**
 * Perform the read.
 *
 * TAKES THE REQUEST, NOT ITS PARTS. A function that took `(iso3, category,
 * language)` could be called with a country the reader is merely near; this one
 * cannot be called at all without the object `countryReadRequestFor` produces,
 * and that object is only produced when the selection IS the country and the
 * reason IS `EXPLICIT_RETRIEVAL_ACTION`.
 *
 * The cost class is re-stated at the call site so that reading this function is
 * enough to know what pressing the control spends: the browser calls OUR API
 * and nothing else. The API may execute a news provider server-side, which is
 * the whole reason this is behind a deliberate action.
 */
export async function performCountryRead(
  request: CountryReadRequest,
): Promise<CountryNewsResponse> {
  /* `API_ORIGIN_READ` — asserted rather than commented, so the class is load-bearing. */
  if (COUNTRY_READ_COST_CLASS !== 'API_ORIGIN_READ') {
    throw new Error('country read cost class changed without this call site being revisited');
  }

  /*
    NO SIGNAL IS THREADED, AND THAT IS DELIBERATE.

    Main's A-4 measured `fetchCountryNews` as needing no change, and it does not
    get one: it owns its own `AbortController` and a 10 s timeout internally,
    and it exposes no `signal` parameter. Adding one to carry a caller's
    cancellation would be editing a landed, accepted client to suit a new
    caller — the opposite of reusing the governed seam.

    Supersession is therefore handled where it belongs, at the call site, by
    ignoring the result of a read that is no longer the current one. An ignored
    response costs the same as an aborted one (the request was already sent) and
    it cannot leak a previous country's articles under a new country's name,
    which is the only failure that would actually matter here.
  */
  return fetchCountryNews(request.iso3, {
    ...(request.category === null ? {} : { category: request.category as NewsCategory }),
    limit: COUNTRY_READ_LIMIT,
    lang: request.language as LanguageCode,
  });
}
