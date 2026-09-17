import type {
  CountryNewsResponse,
  NewsCategory,
  NewsResponse,
} from '@globalnews-ai/shared';

import type { MapEvidenceGeography } from '@/lib/api/mapFeedApi';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT C — RETAINED MAP STATE, SO RETURNING IS NOT RE-RETRIEVING
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT. `handleOpenAnalysis` does `router.push('/search?…')`, and `/map`
 * and `/search` are separate routes. Opening Analysis UNMOUNTS the map, and
 * browser Back REMOUNTS it. Every piece of retained evidence lived in component
 * state — the country corpora, the resolved geographies, the world feed, and
 * the B-1 resolution memo — so all of it was destroyed on the way out.
 *
 * The URL preserved the SELECTION (`?country=`, `sel=`, `cam=`, `mode=`,
 * `period=`) but not the CORPUS. So Back knew exactly what the reader had been
 * looking at and had nothing to show for it, and rebuilt the view by retrieving
 * it again: `/news/top-headlines`, `/news/country/POL`, `/geo/map-feed`, a GNews
 * attempt, an RSS fallback and a GDELT timeout — about 8.4 seconds to return to
 * a view that already existed.
 *
 * ─── WHY MODULE SCOPE, AND WHY NOT sessionStorage ─────────────────────────
 *
 * CTO ruling: a module-scope store with TTL, and no routing redesign.
 *
 * Module scope outlives a component and dies with the tab, which is exactly the
 * lifetime of "the map I was just looking at". It needs no serialisation, so a
 * `NewsResponse` keeps its identity rather than being rebuilt from JSON, and
 * there is no private-mode failure path to handle.
 *
 * ─── THE TTL IS NOT A TUNING KNOB ─────────────────────────────────────────
 *
 * It MIRRORS the backend's own freshness contract:
 *
 *     DEFAULT_HOME_NEWS_CACHE_TTL_SECONDS  = 300   (news.service.ts)
 *     DEFAULT_CACHE_TTL_SECONDS            = 300   (country-news.service.ts)
 *
 * It must never EXCEED them. A client store that outlived the server's window
 * would show a reader evidence the backend would no longer serve, and the two
 * would disagree about what is current with nothing reporting it. Shorter is
 * always safe; longer is a correctness bug.
 *
 * ─── WHAT MAY NEVER BE WRITTEN ────────────────────────────────────────────
 *
 * CTO ruling: never overwrite valid retained evidence with an empty response, a
 * failed provider response, or a transient retrieval failure.
 *
 * `retain*` refuses an empty corpus at the ONE place a write can happen, rather
 * than making it every caller's problem — the same judgement, and the same
 * reasoning, as `NewsService.rememberHomeNews`. A failed retrieval therefore
 * leaves the store exactly as it was, and the previous good corpus keeps
 * serving until it expires on its own.
 */

/**
 * ONE ARTICLE'S GEOGRAPHY, AS G'S ROUTE RETURNED IT.
 *
 * Declared here rather than in the component so the store can hold it without
 * importing from a page component, which would be a cycle. `feed` is stored
 * WHOLE: the four resolution states live inside it, and flattening it to "the
 * place" would be the reconstruction G's contract refuses.
 */
export interface ResolvedArticleGeography {
  readonly recordId: string;
  readonly feed: MapEvidenceGeography;
  readonly observedAt: string;
  readonly headline: string;
  readonly sourceCount: number;
  /**
   * CHECKPOINT H — carried so a retained corpus can still count DISTINCT
   * outlets after the Analysis round trip. Without it, restored evidence would
   * report a different source count from the evidence that produced it.
   */
  readonly publisherId: string;
  readonly category: NewsCategory;
  /** The country of the ARTICLE that produced this headline — the join-key expectation. */
  readonly countryIso3: string;
}

/**
 * Mirrors the backend freshness contract. See the header: this may be reduced
 * but must never be raised above the server's own TTL.
 */
export const RETAINED_MAP_STATE_TTL_MS = 300 * 1000;

interface RetainedEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

const globalFeeds = new Map<string, RetainedEntry<NewsResponse>>();
const globalGeographies = new Map<string, RetainedEntry<readonly ResolvedArticleGeography[]>>();
const countryCorpora = new Map<string, RetainedEntry<CountryNewsResponse>>();
const countryGeographies = new Map<string, RetainedEntry<readonly ResolvedArticleGeography[]>>();

/** Expired entries are deleted on read, mirroring both backend caches. */
function read<T>(store: Map<string, RetainedEntry<T>>, key: string, now: number): T | null {
  const entry = store.get(key);

  if (entry === undefined) return null;

  if (now > entry.expiresAt) {
    store.delete(key);

    return null;
  }

  return entry.value;
}

function write<T>(store: Map<string, RetainedEntry<T>>, key: string, value: T, now: number): void {
  store.set(key, { value, expiresAt: now + RETAINED_MAP_STATE_TTL_MS });
}

function snapshot<T>(store: Map<string, RetainedEntry<T>>, now: number): Record<string, T> {
  const out: Record<string, T> = {};

  for (const [key, entry] of store) {
    if (now > entry.expiresAt) {
      store.delete(key);
      continue;
    }

    out[key] = entry.value;
  }

  return out;
}

/* ── THE WORLD CORPUS ────────────────────────────────────────────────────── */

/** Key: the corpus identity the backend itself uses — width and language. */
export function globalFeedKey(limit: number, language: string): string {
  return `${limit}:${language}`;
}

export function retainedGlobalFeed(key: string, now: number = Date.now()): NewsResponse | null {
  return read(globalFeeds, key, now);
}

export function retainGlobalFeed(
  key: string,
  response: NewsResponse | null,
  now: number = Date.now(),
): void {
  /*
    AN EMPTY OR ABSENT CORPUS IS NOT EVIDENCE. Every failure mode converges on
    one of these, and storing either would replace a good corpus with the record
    of a bad moment.
  */
  if (response === null || response.articles.length === 0) return;

  write(globalFeeds, key, response, now);
}

export function retainedGlobalGeography(
  key: string,
  now: number = Date.now(),
): readonly ResolvedArticleGeography[] | null {
  return read(globalGeographies, key, now);
}

export function retainGlobalGeography(
  key: string,
  records: readonly ResolvedArticleGeography[],
  now: number = Date.now(),
): void {
  /*
    AN EMPTY LIST IS A REAL ANSWER HERE, unlike an empty corpus. It records that
    enrichment ran and resolved nothing finer than country level, which is a
    different state from "not asked yet" — and it is what stops the enrichment
    effect asking again on every render. The component already relies on that
    distinction; this store must not erase it.
  */
  write(globalGeographies, key, records, now);
}

/* ── PER-COUNTRY CORPORA ─────────────────────────────────────────────────── */

export function retainedCountryCorpora(now: number = Date.now()): Record<string, CountryNewsResponse> {
  return snapshot(countryCorpora, now);
}

export function retainCountryCorpus(
  key: string,
  response: CountryNewsResponse | null,
  now: number = Date.now(),
): void {
  if (response === null || response.articles.length === 0) return;

  write(countryCorpora, key, response, now);
}

export function retainedCountryGeographies(
  now: number = Date.now(),
): Record<string, readonly ResolvedArticleGeography[]> {
  return snapshot(countryGeographies, now);
}

export function retainCountryGeography(
  iso3: string,
  records: readonly ResolvedArticleGeography[],
  now: number = Date.now(),
): void {
  /* Empty is meaningful here too — see retainGlobalGeography. */
  write(countryGeographies, iso3, records, now);
}

/* ── TEST SUPPORT ────────────────────────────────────────────────────────── */

/**
 * Clears every slot. Module scope is deliberately process-wide, so a test that
 * did not reset would leak retained evidence into the next one — and a leaked
 * corpus would make a "restored without retrieving" assertion pass for the
 * wrong reason, which is the worst possible failure for this store.
 */
export function resetRetainedMapState(): void {
  globalFeeds.clear();
  globalGeographies.clear();
  countryCorpora.clear();
  countryGeographies.clear();
}
