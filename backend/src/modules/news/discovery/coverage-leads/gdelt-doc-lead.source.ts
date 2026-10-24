import { parseGdeltLeads } from '../gdelt-lead/gdelt-lead.parser';
import type { GdeltLead } from '../gdelt-lead/gdelt-lead.types';
import type { LeadSource } from '../gdelt-lead/gdelt-lead.discovery';

/*
  CTO R168 · THE ONE NETWORK FILE OF THE COVERAGE-LEADS FEATURE.

  It reaches exactly one fixed origin, the GDELT Project's public DOC 2.0 API — never GDELT Cloud,
  never a publisher, never a URL that came from data. The only variable part is the query string
  built by lead-keywords.ts from closed vocabularies (no question text, no identifiers). No cookie,
  no header naming the reader, no redirect followed, a bounded timeout and a bounded body. Any
  non-200, a non-JSON body or a parse failure is "no leads", reported to the gate as a refusal
  where GDELT itself refused (429 / 5xx), and never retried.
*/
export const GDELT_DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc';
/*
  Bounded, and sized from the first live Alpha call (24 Oct, 08:26:40Z): TLS to api.gdeltproject.org
  was immediate, and GDELT's response arrived ~9 s later, after the original 8 s bound had aborted it.
  The DOC API is slow; 20 s keeps the call bounded without refusing every answer.
*/
export const GDELT_TIMEOUT_MS = 20_000;
export const GDELT_MAX_BODY_BYTES = 1_000_000;
export const GDELT_MAX_RECORDS = 25;
/** "current": what GDELT observed in the last three days */
export const GDELT_TIMESPAN = '3d';

export type LeadFetchOutcome =
  | { readonly kind: 'OK'; readonly leads: readonly GdeltLead[] }
  | { readonly kind: 'REFUSED_BY_GDELT'; readonly status: number }
  | { readonly kind: 'FAILED'; readonly reason: string };

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export function gdeltDocUrl(gdeltQuery: string): string {
  const params = new URLSearchParams({
    query: gdeltQuery,
    mode: 'ArtList',
    format: 'json',
    maxrecords: String(GDELT_MAX_RECORDS),
    timespan: GDELT_TIMESPAN,
    sort: 'DateDesc',
  });
  return `${GDELT_DOC_API}?${params.toString()}`;
}

export async function fetchGdeltLeads(
  gdeltQuery: string,
  fetchImpl: FetchLike = fetch,
): Promise<LeadFetchOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(gdeltDocUrl(gdeltQuery), {
      method: 'GET',
      redirect: 'error',
      credentials: 'omit',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(GDELT_TIMEOUT_MS),
    });
  } catch (error) {
    return { kind: 'FAILED', reason: error instanceof Error ? error.name : 'NETWORK' };
  }
  if (response.status === 429 || response.status >= 500)
    return { kind: 'REFUSED_BY_GDELT', status: response.status };
  if (response.status !== 200) return { kind: 'FAILED', reason: `HTTP_${response.status}` };
  const declared = Number(response.headers.get('content-length') ?? '0');
  if (declared > GDELT_MAX_BODY_BYTES) return { kind: 'FAILED', reason: 'BODY_TOO_LARGE' };
  const body = await readCapped(response, GDELT_MAX_BODY_BYTES);
  if (body === null) return { kind: 'FAILED', reason: 'BODY_TOO_LARGE' };
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    /* GDELT answers a query it cannot parse with plain text: that is "no leads", not an error page to show */
    return { kind: 'FAILED', reason: 'NOT_JSON' };
  }
  return { kind: 'OK', leads: parseGdeltLeads(json) };
}

async function readCapped(response: Response, cap: number): Promise<string | null> {
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Adapts the fetch to the discovery state machine's injected source. */
export class GdeltDocLeadSource implements LeadSource {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async fetchLeads(gdeltQuery: string): Promise<readonly GdeltLead[]> {
    const outcome = await fetchGdeltLeads(gdeltQuery, this.fetchImpl);
    if (outcome.kind === 'OK') return outcome.leads;
    throw new LeadFetchError(outcome);
  }
}

export class LeadFetchError extends Error {
  constructor(readonly outcome: Exclude<LeadFetchOutcome, { kind: 'OK' }>) {
    super(outcome.kind);
    this.name = 'LeadFetchError';
  }
}
