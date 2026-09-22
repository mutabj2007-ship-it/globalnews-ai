import type { SecurityReadResponse } from '@globalnews-ai/shared';
import { resolveApiBaseUrl } from './apiBase';
import { resolveForwardedClientHeaders } from './forwardedClient';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE SECURITY READ CLIENT — BETA-SECURITY-EVIDENCE-R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A THIN CLIENT, in the shape `newsApi.ts` established: resolve the base URL per request,
 * forward the visitor's client address across the SSR hop, time out, and hand back the
 * backend's own typed response. It does no validation, no mapping and no defaulting, and the
 * absence of all three is the point of this file.
 *
 * ── THREE THINGS THIS CLIENT DELIBERATELY DOES NOT DO ─────────────────────
 *
 * IT DOES NOT DEFAULT THE ABSENCE STATE. There is no `?? 'NOT_ASSESSED'` here and there must
 * never be one. The absence vocabulary refuses to have a default — *"A caller with nothing to
 * pass passes this, which is a decision it has to write down"* — and a client that supplied
 * one would be deciding, silently, on behalf of a Security surface.
 *
 * IT DOES NOT TURN A FAILURE INTO AN EMPTY RESULT. A network error throws
 * `SecurityApiError`. Returning an empty response with a friendly absence state would make a
 * dead backend indistinguishable from a country with nothing to report — the exact collapse
 * the backend's own three-way outcome vocabulary exists to prevent, undone in the last hop.
 *
 * IT DOES NOT RENDER A LIMITATION CODE. `limitations` arrives as language-neutral codes and
 * this file passes them through untouched. Turning a code into a sentence is a rendering
 * decision in the frontend's own two languages; doing it here would make English an
 * authority and put reader copy in an API client.
 *
 * ── WHY THIS FILE EXISTS AND NO SECURITY COMPONENT IS TOUCHED ─────────────
 *
 * Claude Design remains the visual authority. `SecurityScreen.tsx` and
 * `SecurityCompactScreen.tsx` are a 42-row zone-conformance surface asserted against
 * `manifest/SECURITY-ZONE-AUTHORITY.tsv`, and binding live data into them is a visual
 * decision with its own review — not a side effect of landing a backend.
 *
 * So this lane delivers the READ CAPABILITY and stops there. Nothing imports this client
 * yet, and that is deliberate rather than unfinished: wiring it into a zone is the CTO's
 * call, and the client is here so that call costs one import rather than a round trip.
 */

const REQUEST_TIMEOUT_MS = 10000;

export class SecurityApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'SecurityApiError';
  }
}

export interface FetchSecurityObservationsOptions {
  /** How many observations to return. The backend caps this at 30. */
  readonly limit?: number;
  /** The age window in minutes. The backend caps this at 30 days. */
  readonly maxAgeMinutes?: number;
}

/**
 * GET /security/observations/:countryCode
 *
 * Returns the provenance-backed Security observations for one geography, together with the
 * coverage declaration, the partial-limitation codes, and the reader projection of the
 * absence state where there is nothing to show.
 *
 * A COUNTRY WITH NOTHING RETAINED IS A 200, NOT A 404, and this client does not convert one
 * into the other. The backend's reasoning applies here too: a 404 would say *"we have no such
 * country"* while what is true is *"we have nothing to show for this country"*.
 */
export async function fetchSecurityObservations(
  countryCode: string,
  options: FetchSecurityObservationsOptions = {},
): Promise<SecurityReadResponse> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.maxAgeMinutes !== undefined) {
    params.set('maxAgeMinutes', String(options.maxAgeMinutes));
  }

  const query = params.toString();
  const path = `/security/observations/${encodeURIComponent(countryCode)}${
    query.length > 0 ? `?${query}` : ''
  }`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  /*
    Server-side only, and empty in every browser. Preserves the visitor's client address
    across the SSR hop so the backend's rate limit counts visitors rather than counting this
    container once for the whole world. Never synthesises an address. See forwardedClient.ts.
  */
  const forwardedHeaders = await resolveForwardedClientHeaders();

  let response: Response;
  try {
    /*
      `no-store`. A Security read is a live evidence read, and a cached one would let a
      reader act on a coverage state that has since changed — in the direction that matters,
      it would keep showing observations after the evidence behind them was withdrawn.
    */
    response = await fetch(`${resolveApiBaseUrl()}${path}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: forwardedHeaders,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new SecurityApiError('The request took too long to respond. Please try again.');
    }
    throw new SecurityApiError(
      error instanceof Error ? error.message : 'Failed to reach the GlobalNews AI backend',
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new SecurityApiError(`Backend responded with ${response.status}`, response.status);
  }

  return response.json() as Promise<SecurityReadResponse>;
}
