/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK/SEARCH ENGINEERING R1 — THE ONE GOVERNED COMPUTE-CONSENT MECHANISM
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Product contract: opening, navigation, focus, typing, selecting a suggestion
 * and merely carrying a question in a URL cost ZERO AI. The compute moment is an
 * explicit Send/Ask, or an explicit acceptance of deeper analysis.
 *
 * `/search?q=…` used to execute `POST /analysis/news` on route arrival. A URL is
 * not consent: it is produced by links, history entries, reloads, shared links,
 * back/forward, prefetch-adjacent navigations and every map/topic/story entry.
 *
 * So consent is NOT carried in the URL (a URL marker would make a copied or
 * reloaded link spend again). It is a one-shot, short-lived, same-tab grant that
 * only an explicit compute action writes, immediately before it navigates:
 *
 *   grantAnalysisConsent(href)   — called by the explicit action, then navigate
 *   consumeAnalysisConsent(key)  — called once by /search on arrival
 *
 * A grant is bound to the exact request identity (question + story anchor), so
 * consent for one question can never run another. It is consumed on first use,
 * expires after ANALYSIS_CONSENT_TTL_MS, and lives in module memory (client
 * navigation) mirrored to sessionStorage (a same-tab full navigation, e.g. the
 * dock's real `<a href>` transition). A new tab, a reload, a shared link or a
 * back/forward arrival therefore finds no grant and renders the staged question
 * with an explicit Run control — zero requests until the reader accepts.
 */

export const ANALYSIS_CONSENT_TTL_MS = 60_000;

/*
 * No replay window: a grant is spent on first consumption. React Strict Mode's
 * repeated arrival effect is absorbed by the consuming component instance
 * (SearchPageClient's claim ref), never by re-validating a spent grant here —
 * a time window would let a quick back/forward or reload re-run a paid analysis.
 */

const STORAGE_KEY = 'gna:analysis-compute-consent';

export interface AnalysisRequestIdentity {
  q: string | null;
  articleId?: string | null;
  countryCode?: string | null;
  storyTitle?: string | null;
}

interface ConsentRecord {
  key: string;
  at: number;
}

let pending: ConsentRecord | null = null;

/** The exact request identity a grant is bound to. Absent anchors are empty. */
export function analysisConsentKey(identity: AnalysisRequestIdentity): string {
  return JSON.stringify([
    (identity.q ?? '').trim(),
    identity.articleId ?? '',
    identity.countryCode ?? '',
    identity.storyTitle ?? '',
  ]);
}

/** The identity of a `/search?…` href, read with the same parameter names /search reads. */
export function analysisConsentKeyFromHref(href: string): string {
  const query = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  return analysisConsentKey({
    q: params.get('q'),
    articleId: params.get('articleId'),
    countryCode: params.get('countryCode'),
    storyTitle: params.get('storyTitle'),
  });
}

function readStored(): ConsentRecord | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    return typeof parsed.key === 'string' && typeof parsed.at === 'number'
      ? { key: parsed.key, at: parsed.at }
      : null;
  } catch {
    return null;
  }
}

function writeStored(record: ConsentRecord | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (record === null) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* Storage can be unavailable (private mode, blocked). Memory still works. */
  }
}

/**
 * Record that the reader explicitly accepted running analysis for `href`.
 * Only explicit compute actions may call this. It performs no request itself.
 */
export function grantAnalysisConsent(href: string, now: number = Date.now()): void {
  const record = { key: analysisConsentKeyFromHref(href), at: now };
  pending = record;
  writeStored(record);
}

/**
 * True exactly once per grant, for the matching request identity, within the
 * TTL. Any grant it inspects is cleared, matching or not, so a stale grant can
 * never be spent by a later, unrelated arrival.
 */
export function consumeAnalysisConsent(key: string, now: number = Date.now()): boolean {
  const record = pending ?? readStored();
  pending = null;
  writeStored(null);

  if (record === null) return false;
  const fresh = now - record.at >= 0 && now - record.at <= ANALYSIS_CONSENT_TTL_MS;
  return fresh && record.key === key;
}

/** Test-only reset of module state. */
export function resetAnalysisConsentForTests(): void {
  pending = null;
  writeStored(null);
}
