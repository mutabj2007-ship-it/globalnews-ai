import { safeExternalHref } from '@globalnews-ai/shared';

/*
  CTO R168 — GDELT coverage leads. The browser talks only to this product's backend; GDELT never
  sees the reader, their address or their question (the backend sends closed-vocabulary keywords).
  Sent only when the reader presses "Show coverage leads": POST so the question never lands in a
  URL; no cookie (the route is session-blind); same-origin through the existing /news rewrite.
*/
export interface CoverageLeadView {
  readonly outlet: string;
  readonly url: string;
  readonly seenByGdeltAt: string;
}

export interface CoverageLeadsResult {
  readonly leads: readonly CoverageLeadView[];
  readonly attribution: { readonly citation: string; readonly link: string };
}

export type CoverageLeadsOutcome =
  | { readonly kind: 'LEADS'; readonly result: CoverageLeadsResult }
  /** looked up (or deliberately not looked up for this question) and nothing to show */
  | { readonly kind: 'NONE' }
  /** switched off, not authorized, over capacity, GDELT down, or any failure */
  | { readonly kind: 'UNAVAILABLE' };

const GDELT_LINK = 'https://www.gdeltproject.org/';
const NONE_STATES: ReadonlySet<string> = new Set(['NONE', 'NO_PLACE', 'MULTI_PLACE', 'SUPPRESSED']);

/** Through the one shared external-href boundary, and https only on top of it. */
export function safeLeadHref(url: unknown): string | null {
  const href = safeExternalHref(url);
  return href !== undefined && href.startsWith('https://') ? href : null;
}

/** Untrusted text is shown as plain text, bounded; never markup. */
function plain(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, max) : null;
}

export function sanitizeCoverageLeads(raw: unknown): CoverageLeadsOutcome {
  if (raw === null || typeof raw !== 'object') return { kind: 'UNAVAILABLE' };
  const body = raw as { state?: unknown; leads?: unknown; attribution?: { link?: unknown } };
  if (typeof body.state === 'string' && NONE_STATES.has(body.state)) return { kind: 'NONE' };
  if (body.state !== 'LEADS' || !Array.isArray(body.leads)) return { kind: 'UNAVAILABLE' };
  /* the credit always points at GDELT itself, whatever the body says */
  if (body.attribution?.link !== GDELT_LINK) return { kind: 'UNAVAILABLE' };
  const leads: CoverageLeadView[] = [];
  for (const item of body.leads.slice(0, 5)) {
    if (item === null || typeof item !== 'object') continue;
    const lead = item as Record<string, unknown>;
    const url = safeLeadHref(lead.url);
    const outlet = plain(lead.outlet, 120);
    const seen = plain(lead.seenByGdeltAt, 40);
    if (url === null || outlet === null || seen === null || Number.isNaN(Date.parse(seen))) continue;
    leads.push({ outlet, url, seenByGdeltAt: seen });
  }
  return leads.length === 0
    ? { kind: 'NONE' }
    : { kind: 'LEADS', result: { leads, attribution: { citation: 'The GDELT Project', link: GDELT_LINK } } };
}

export async function fetchCoverageLeads(question: string, signal?: AbortSignal): Promise<CoverageLeadsOutcome> {
  try {
    const response = await fetch('/news/coverage-leads', {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.slice(0, 500) }),
      signal,
    });
    if (!response.ok) return { kind: 'UNAVAILABLE' };
    return sanitizeCoverageLeads(await response.json());
  } catch {
    return { kind: 'UNAVAILABLE' };
  }
}
