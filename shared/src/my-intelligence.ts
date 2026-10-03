/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE BACKEND + DATA R1 — THE SHARED CONTRACT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Types and rules shared by the backend and the (H-owned) My Intelligence
 * frontend. Nothing here performs I/O and nothing here can start compute.
 */

import type { NewsCategory, PublishedAtBasis } from './news';

/* ── NEW SINCE LAST VISIT — ONE RULE ONLY ─────────────────────────────── */

/**
 * A story is New Since the previous visit ONLY when the product first saw it
 * after that visit began: `firstSeenAt > previousSeenAt`.
 *
 * - publishedAt NEVER decides it (it is provider-reported and mutable).
 * - A missing firstSeenAt means "not new": no label, no count, and no
 *   substitute timestamp is ever fabricated.
 * - A missing previousSeenAt (first visit, or none known) means "make no
 *   return claim": nothing is new, never "everything is new".
 *
 * The frontend's newSince.ts must apply exactly this rule.
 */
export function isNewSince(
  firstSeenAt: string | null | undefined,
  previousSeenAt: string | null | undefined,
): boolean {
  if (!firstSeenAt || !previousSeenAt) return false;
  const seen = Date.parse(firstSeenAt);
  const boundary = Date.parse(previousSeenAt);
  if (Number.isNaN(seen) || Number.isNaN(boundary)) return false;
  return seen > boundary;
}

/* ── SAVED STORIES ────────────────────────────────────────────────────── */

/** sha256(normalizeArticleUrl(url)) as 64 lowercase hex characters. */
export const ARTICLE_REF_PATTERN = /^[0-9a-f]{64}$/;

/** A bounded collection: a saved list, not an archive. */
export const MAX_SAVED_STORIES = 200;

/**
 * What a client sends to save a story: the story's URL, plus an optional
 * provider article id used ONLY as a lookup hint. Title, source and every
 * other field are resolved by the server from retained reporting.
 */
export interface SaveStoryRequest {
  readonly url: string;
  readonly providerArticleId?: string;
}

export interface SavedStoryView {
  readonly articleRef: string;
  readonly canonicalUrl: string;
  readonly sourceUrl: string;
  readonly title: string;
  readonly sourceName: string;
  readonly sourceDomain: string;
  readonly publishedAt: string;
  readonly publishedAtBasis: PublishedAtBasis;
  readonly imageUrl?: string;
  readonly countryCodes: readonly string[];
  readonly savedAt: string;
  /** From the retained Article row when it still exists; absent otherwise. */
  readonly firstSeenAt?: string;
}

export interface SavedStoryListResponse {
  readonly stories: readonly SavedStoryView[];
  readonly limit: number;
}

/* ── RECENT INTELLIGENCE (QUESTION HISTORY) ───────────────────────────── */

/** The newest entries returned to the reader. */
export const SEARCH_HISTORY_LIST_LIMIT = 50;
/** Entries retained per account; older ones are pruned on write. */
export const SEARCH_HISTORY_RETENTION_LIMIT = 200;

export interface QuestionHistoryEntryView {
  readonly id: string;
  /** The reader's own question — never an answer, source or model output. */
  readonly query: string;
  readonly countryCode: string | null;
  readonly createdAt: string;
}

/* ── FOLLOWING / FOR YOU — RETAINED FEED ──────────────────────────────── */

export interface MyIntelligenceStory {
  readonly articleRef: string;
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly sourceName: string;
  readonly publishedAt: string;
  readonly publishedAtBasis?: PublishedAtBasis;
  readonly imageUrl?: string;
  /** The countries this story is attributed to among those the reader follows. */
  readonly countryCodes: readonly string[];
  /** Absent when the product never recorded when it first saw the story. */
  readonly firstSeenAt?: string;
  /** isNewSince(firstSeenAt, previousSeenAt), decided once, by the server. */
  readonly newSince: boolean;
  /**
   * INTEREST + SELECTION HOOK R1 — the retained article's own governed
   * NewsCategory (never the placeholder 'Following'), and the reader
   * interests it deterministically matches (`interestsForStory`), derived
   * server-side from retained title/summary/category. Zero AI, zero provider.
   */
  readonly category: NewsCategory;
  readonly interests: readonly MyIntelligenceInterest[];
}

export interface MyIntelligenceCountryFeed {
  readonly countryCode: string;
  readonly storyCount: number;
  readonly newSinceCount: number;
}

export interface MyIntelligenceFeedResponse {
  /** The stable previous-visit boundary (User.visitBoundaryAt); null = no return claim. */
  readonly previousSeenAt: string | null;
  readonly followedCountries: readonly MyIntelligenceCountryFeed[];
  /** Deduplicated retained stories across every followed country, newest first. */
  readonly stories: readonly MyIntelligenceStory[];
  readonly newSinceCount: number;
  /** Always 'retained': this feed never calls a live provider. */
  readonly source: 'retained';
}

/* ── MULTI-STORY INTELLIGENCE ─────────────────────────────────────────── */

export type MultiStoryAction =
  | 'COMPARE'
  | 'SUMMARIZE'
  | 'ASK_SELECTED'
  | 'EXPLAIN_DISAGREEMENTS'
  | 'WHAT_CHANGED'
  | 'CREATE_BRIEFING';

export const MULTI_STORY_ACTIONS: readonly MultiStoryAction[] = [
  'COMPARE',
  'SUMMARIZE',
  'ASK_SELECTED',
  'EXPLAIN_DISAGREEMENTS',
  'WHAT_CHANGED',
  'CREATE_BRIEFING',
];

/** CTO bound: at most 8 selected stories per compute request. */
export const MAX_SELECTED_STORIES = 8;

/** The fewest selected stories each action can honestly work with. */
export const MULTI_STORY_MIN_STORIES: Readonly<Record<MultiStoryAction, number>> = {
  COMPARE: 2,
  SUMMARIZE: 1,
  ASK_SELECTED: 1,
  EXPLAIN_DISAGREEMENTS: 2,
  /* TRUST R1 — aligned to the planner (frozen C minimumStoriesFor: a change needs two reports). */
  WHAT_CHANGED: 2,
  CREATE_BRIEFING: 2,
};

/**
 * One selected story. The URL is what the server resolves against RETAINED
 * reporting; articleRef must equal sha256(normalizeArticleUrl(url)) or the
 * story is refused. No title, summary or body is ever accepted from a client.
 */
export interface SelectedStoryRef {
  readonly articleRef: string;
  readonly url: string;
}

export interface AnalysisSelection {
  readonly action: MultiStoryAction;
  readonly stories: readonly SelectedStoryRef[];
}

/** Stamped on the retrieval context of a selection analysis. */
export interface AnalysisSelectionOutcome {
  readonly action: MultiStoryAction;
  readonly requested: number;
  readonly resolved: number;
  /** articleRefs that did not resolve to retained reporting. */
  readonly unresolvedRefs: readonly string[];
}

/* ── INTEREST + SELECTION HOOK R1 — EXPLICIT READER INTERESTS ─────────────
 *
 * Explicit, inspectable, reader-controlled. Never inferred from question
 * history, never guessed by AI, never free text. Persisted account-side
 * (UserIntelligenceInterest) so they survive devices.
 *
 * NOT A THIRD TAXONOMY. Every interest is defined ONLY in terms of the two
 * vocabularies the product already governs:
 *   · NewsCategory — the article's own retained category;
 *   · AnalyticalDomain — the deterministic keyword classifier in
 *     backend/src/modules/analysis/query/detect-analytical-domains.util.ts
 *     (the SAME implementation AnalysisService uses; its ids are quoted here
 *     as strings because shared cannot import backend, and a backend spec
 *     asserts they are exactly that util's ANALYTICAL_DOMAINS).
 */
export const MY_INTELLIGENCE_INTERESTS = [
  'politics_governance',
  'security_conflict',
  'economy_markets',
  'diplomacy',
  'humanitarian_society',
  'energy_infrastructure',
  'technology',
  'regional_affairs',
  'health_science',
  'sports',
  'entertainment',
] as const;

export type MyIntelligenceInterest = (typeof MY_INTELLIGENCE_INTERESTS)[number];

export function isMyIntelligenceInterest(value: unknown): value is MyIntelligenceInterest {
  return typeof value === 'string' && (MY_INTELLIGENCE_INTERESTS as readonly string[]).includes(value);
}

/** The analytical-domain ids of the canonical classifier (see note above). */
export type InterestAnalyticalDomain =
  | 'political'
  | 'economic'
  | 'security'
  | 'diplomatic'
  | 'social'
  | 'infrastructure'
  | 'technology'
  | 'regional';

/**
 * THE DETERMINISTIC MAPPING. A story matches an interest when its category is
 * one of the interest's categories OR the classifier detects one of the
 * interest's domains in its retained title + summary.
 */
export const MY_INTELLIGENCE_INTEREST_MAPPING: Readonly<
  Record<
    MyIntelligenceInterest,
    { readonly categories: readonly NewsCategory[]; readonly domains: readonly InterestAnalyticalDomain[] }
  >
> = {
  politics_governance: { categories: ['politics'], domains: ['political'] },
  security_conflict: { categories: [], domains: ['security'] },
  economy_markets: { categories: ['business'], domains: ['economic'] },
  diplomacy: { categories: [], domains: ['diplomatic'] },
  humanitarian_society: { categories: [], domains: ['social'] },
  energy_infrastructure: { categories: [], domains: ['infrastructure'] },
  technology: { categories: ['technology'], domains: ['technology'] },
  regional_affairs: { categories: [], domains: ['regional'] },
  health_science: { categories: ['health', 'science'], domains: [] },
  sports: { categories: ['sports'], domains: [] },
  entertainment: { categories: ['entertainment'], domains: [] },
};

/**
 * CATEGORY-EXCLUSIVE categories. A sports or entertainment story matches ONLY
 * its own category's interest: keyword domains are not applied to it, so a
 * football report that mentions a club "president" or stadium "security" is
 * not Politics or Security. This is what keeps followed-country football out
 * of a reader's Security / Politics For you.
 */
export const CATEGORY_EXCLUSIVE_INTERESTS: Readonly<Partial<Record<NewsCategory, MyIntelligenceInterest>>> = {
  sports: 'sports',
  entertainment: 'entertainment',
};

/** The interests a retained story matches, in the vocabulary's own order. Pure. */
export function interestsForStory(
  category: NewsCategory,
  detectedDomains: ReadonlySet<string> | readonly string[],
): MyIntelligenceInterest[] {
  const exclusive = CATEGORY_EXCLUSIVE_INTERESTS[category];
  if (exclusive !== undefined) return [exclusive];
  const domains = new Set(detectedDomains);
  return MY_INTELLIGENCE_INTERESTS.filter((interest) => {
    const rule = MY_INTELLIGENCE_INTEREST_MAPPING[interest];
    return rule.categories.includes(category) || rule.domains.some((domain) => domains.has(domain));
  });
}

export interface MyIntelligenceInterestsResponse {
  readonly interests: readonly MyIntelligenceInterest[];
}

/** One mutation replaces the whole set. An empty list clears it ("Show all"). */
export interface UpdateMyIntelligenceInterestsRequest {
  readonly interests: readonly MyIntelligenceInterest[];
}
