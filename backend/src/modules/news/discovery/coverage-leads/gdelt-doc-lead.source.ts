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

/*
  CTO R170 — a SANITIZED account of what came back, for the operator log: sizes, status, content type
  and which parsing path ran. Never a byte of the body, a title, a URL or the question.
*/
export interface LeadFetchDiagnostic {
  readonly status?: number;
  readonly bytes?: number;
  readonly contentType?: string;
  /** the body parsed only after GDELT's known JSON defects were repaired */
  readonly repaired?: boolean;
}

export type LeadFetchOutcome =
  | {
      readonly kind: 'OK';
      readonly leads: readonly GdeltLead[];
      readonly diag?: LeadFetchDiagnostic;
    }
  | {
      readonly kind: 'REFUSED_BY_GDELT';
      readonly status: number;
      readonly reason?: string;
      readonly diag?: LeadFetchDiagnostic;
    }
  | { readonly kind: 'FAILED'; readonly reason: string; readonly diag?: LeadFetchDiagnostic };

/** "content-type" reduced to its media type, bounded; never parameters a server could stuff */
function mediaType(response: Response): string {
  return (response.headers.get('content-type') ?? 'none').split(';')[0].trim().slice(0, 40);
}

/*
  GDELT's ArtList JSON is known to carry raw control characters and invalid escapes ("\'") inside
  title strings. Two repairs, both structure-preserving: every U+0000–U+001F becomes a space (legal
  between tokens, and inside a string it only replaces an illegal raw control), and a backslash
  before a character JSON cannot escape is itself escaped. Pairs are consumed together, so an
  escaped backslash ("\\") is never split. The repaired text is parsed and then discarded; the
  parser still constructs leads from the five allowlisted fields only.
*/
export function repairGdeltJson(text: string): string {
  return text
    .replace(/^﻿/, '')
    .replace(/[\u0000-\u001F]/g, ' ')
    .replace(/\\([\s\S])/g, (pair, c: string) => ('"\\/bfnrtu'.includes(c) ? pair : `\\\\${c}`));
}

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
  const head = { status: response.status, contentType: mediaType(response) };
  if (response.status === 429 || response.status >= 500)
    return { kind: 'REFUSED_BY_GDELT', status: response.status, diag: head };
  if (response.status !== 200)
    return { kind: 'FAILED', reason: `HTTP_${response.status}`, diag: head };
  const declared = Number(response.headers.get('content-length') ?? '0');
  if (declared > GDELT_MAX_BODY_BYTES)
    return { kind: 'FAILED', reason: 'BODY_TOO_LARGE', diag: head };
  const body = await readCapped(response, GDELT_MAX_BODY_BYTES);
  if (body === null) return { kind: 'FAILED', reason: 'BODY_TOO_LARGE', diag: head };
  const diag = { ...head, bytes: Buffer.byteLength(body, 'utf8') };
  const trimmed = body.trimStart();
  /*
    GDELT throttles with HTTP 200 and a plain-text sentence ("Please limit requests to one every 5
    seconds"), not a 429 (documented in gdelt-doc.provider.ts). That is a refusal: the gate cools down.
  */
  if (!trimmed.startsWith('{') && /limit requests/i.test(trimmed.slice(0, 300))) {
    return { kind: 'REFUSED_BY_GDELT', status: 200, reason: 'THROTTLE_TEXT', diag };
  }
  try {
    return {
      kind: 'OK',
      leads: parseGdeltLeads(JSON.parse(body)),
      diag: { ...diag, repaired: false },
    };
  } catch {
    /* fall through to the repair path */
  }
  try {
    return {
      kind: 'OK',
      leads: parseGdeltLeads(JSON.parse(repairGdeltJson(body))),
      diag: { ...diag, repaired: true },
    };
  } catch {
    /* GDELT answers a query it cannot parse with plain text: that is "no leads", not an error page to show */
    return {
      kind: 'FAILED',
      reason: trimmed.startsWith('{') ? 'JSON_UNREPAIRABLE' : 'NOT_JSON',
      diag,
    };
  }
}

/** One operator line: kinds, numbers and media type only. */
export function describeOutcome(outcome: LeadFetchOutcome): string {
  const d = outcome.diag ?? {};
  const detail =
    outcome.kind === 'OK'
      ? `leads=${outcome.leads.length}`
      : outcome.kind === 'REFUSED_BY_GDELT'
        ? `status=${outcome.status}${outcome.reason ? ` reason=${outcome.reason}` : ''}`
        : `reason=${outcome.reason}`;
  return `outcome=${outcome.kind} ${detail} httpStatus=${d.status ?? '-'} bytes=${d.bytes ?? '-'} type=${d.contentType ?? '-'} repaired=${d.repaired ?? '-'}`;
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
  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    /** receives every outcome (sanitized: see describeOutcome) for the operator log */
    private readonly onOutcome: (outcome: LeadFetchOutcome) => void = () => undefined,
  ) {}

  async fetchLeads(gdeltQuery: string): Promise<readonly GdeltLead[]> {
    const outcome = await fetchGdeltLeads(gdeltQuery, this.fetchImpl);
    this.onOutcome(outcome);
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
