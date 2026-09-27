/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE BACKEND + DATA R1 — THE SHARED CONTRACT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Types and rules shared by the backend and the (H-owned) My Intelligence
 * frontend. Nothing here performs I/O and nothing here can start compute.
 */

import type { PublishedAtBasis } from './news';

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
export const QUESTION_HISTORY_LIST_LIMIT = 50;
/** Entries retained per account; older ones are pruned on write. */
export const QUESTION_HISTORY_RETENTION_LIMIT = 200;

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
  WHAT_CHANGED: 1,
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
