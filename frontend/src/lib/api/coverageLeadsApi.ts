/*
  CTO R168 — GDELT coverage leads. The browser talks only to this product's backend; GDELT never
  sees the reader, their address or their question (the backend sends closed-vocabulary keywords).
  POST so the question never lands in a URL; no cookie is sent (the route is session-blind), and the
  request is same-origin through the existing /news rewrite. Any failure is "no leads", never an
  error to show.
*/
export interface CoverageLeadView {
  readonly outlet: string;
  readonly url: string;
  readonly seenByGdeltAt: string;
  readonly language: string | null;
  readonly outletCountry: string | null;
}

export interface CoverageLeadsResult {
  readonly state: string;
  readonly leads: readonly CoverageLeadView[];
  readonly attribution: { readonly citation: string; readonly link: string };
}

const GDELT_LINK = 'https://www.gdeltproject.org/';

/** Only https URLs with a host, re-checked on this side too; anything else is dropped. */
export function safeLeadHref(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname === '' || parsed.username !== '' || parsed.password !== '') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Untrusted text is shown as plain text, bounded; never markup. */
function plain(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, max) : null;
}

export function sanitizeCoverageLeads(raw: unknown): CoverageLeadsResult | null {
  if (raw === null || typeof raw !== 'object') return null;
  const body = raw as { state?: unknown; leads?: unknown; attribution?: { link?: unknown } };
  if (body.state !== 'LEADS' || !Array.isArray(body.leads)) return null;
  /* the credit always points at GDELT itself, whatever the body says */
  if (body.attribution?.link !== GDELT_LINK) return null;
  const leads: CoverageLeadView[] = [];
  for (const item of body.leads.slice(0, 5)) {
    if (item === null || typeof item !== 'object') continue;
    const lead = item as Record<string, unknown>;
    const url = safeLeadHref(lead.url);
    const outlet = plain(lead.outlet, 120);
    const seen = plain(lead.seenByGdeltAt, 40);
    if (url === null || outlet === null || seen === null || Number.isNaN(Date.parse(seen))) continue;
    leads.push({ outlet, url, seenByGdeltAt: seen, language: plain(lead.language, 40), outletCountry: plain(lead.outletCountry, 80) });
  }
  return leads.length === 0 ? null : { state: 'LEADS', leads, attribution: { citation: 'The GDELT Project', link: GDELT_LINK } };
}

export async function fetchCoverageLeads(question: string, signal?: AbortSignal): Promise<CoverageLeadsResult | null> {
  try {
    const response = await fetch('/news/coverage-leads', {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.slice(0, 500) }),
      signal,
    });
    if (signal?.aborted === true || !response.ok) return null;
    return sanitizeCoverageLeads(await response.json());
  } catch {
    return null;
  }
}
