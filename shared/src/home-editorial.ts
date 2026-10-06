/**
 * PHONE-FIRST HOME CORRECTION R1 — the business/conflict Home editorial read and the persisted
 * story search. One contract for backend (modules/home-editorial) and frontend (/visual Home).
 *
 * Identity: `articleRef` (sha256 of the normalized URL) is the same identity the Story Brief,
 * Discussion, Alerts and Admin (`/admin/news/stories?articleRef=`) use; `storyId` is filled when a
 * canonical Story already exists for it. Home never owns a story store of its own.
 */
export type HomeEditorialDomain = 'business' | 'conflict';

export type HomeRegionId = 'region:east-africa' | 'region:european-union' | 'region:middle-east';

/** Row order is a Product Owner ruling: East Africa, then European Union, then Middle East. */
export const HOME_REGION_ORDER: readonly HomeRegionId[] = Object.freeze([
  'region:east-africa',
  'region:european-union',
  'region:middle-east',
]);

/**
 * Display/ranking windows — NOT deletion windows (contract §11). Older stories stay searchable.
 *   LAST_72H           first reported or materially updated in the last 72 hours
 *   DEVELOPING         first reported earlier, with a newer report in the last 72 hours
 *   ACTIVE_DISCUSSION  older, kept prominent by substantive discussion in the last 7 days
 *   EARLIER            older qualifying reporting, labelled with its date
 */
export type HomeFreshness = 'LAST_72H' | 'DEVELOPING' | 'ACTIVE_DISCUSSION' | 'EARLIER';

export interface HomeVisibilityPolicy {
  readonly priorityWindowHours: number;
  readonly discussionWindowDays: number;
  readonly discussionMinParticipants: number;
  readonly earlierWindowDays: number;
  readonly perRegionMax: number;
  readonly sparseBelow: number;
  readonly heroRotationHours: number;
}

export interface HomeStoryCountry {
  readonly iso3: string;
  readonly name: string;
}

export interface HomeStoryCard {
  readonly articleRef: string;
  readonly storyId: string | null;
  readonly url: string;
  readonly title: string;
  /** The publisher's own summary — the "what changed" text. Never generated. */
  readonly summary: string | null;
  readonly imageUrl: string | null;
  readonly publisher: string;
  readonly sourceId: string | null;
  readonly publishedAt: string;
  readonly publishedAtBasis: 'publisher' | 'observed';
  /** When GlobalNewsAI first retained this report. */
  readonly firstSeenAt: string;
  readonly category: string;
  /** null only for a broader-archive search result outside the business/conflict focus. */
  readonly primaryDomain: HomeEditorialDomain | null;
  readonly domains: readonly HomeEditorialDomain[];
  /** The supporting terms found in the reporting — the stated reason this story is on Home. */
  readonly signals: readonly string[];
  /** ASK RELIABILITY R1 (O) — plain topic families for "Why it is here" (e.g. "Energy and fuel"). */
  readonly topics: readonly string[];
  readonly countries: readonly HomeStoryCountry[];
  readonly regions: readonly HomeRegionId[];
  readonly freshness: HomeFreshness;
  /** Other retained reports of the same development (near-identical headlines, ±4 days). */
  readonly otherReports: { readonly count: number; readonly publishers: readonly string[]; readonly firstReportedAt: string };
  readonly discussion: { readonly comments: number; readonly participants: number; readonly lastActivityAt: string } | null;
  /** Retained publisher report; coverage of a region by international outlets is said, not hidden. */
  readonly sourceStatus: 'RETAINED_PUBLISHER_REPORT';
}

export type HomeRowState = 'OK' | 'SPARSE' | 'EMPTY' | 'UNAVAILABLE';

export interface HomeRegionRow {
  readonly id: HomeRegionId;
  readonly scopeLabel: string;
  readonly disclosure: string;
  readonly memberCount: number;
  readonly state: HomeRowState;
  readonly stories: readonly HomeStoryCard[];
  /** Eligible stories in this region inside the priority window / in total (before the row cap). */
  readonly counts: { readonly recent: number; readonly total: number };
}

export type HomeHeroBasis = 'PREFERENCES' | 'DEFAULT';

export interface HomeHero {
  readonly story: HomeStoryCard;
  readonly basis: HomeHeroBasis;
  /** Why this story — only facts: the followed countries / interests it matched. */
  readonly matched: { readonly countries: readonly HomeStoryCountry[]; readonly domains: readonly HomeEditorialDomain[] };
  /** Up to two further qualifying stories for "Your world in 60 seconds" (not repeated in rows). */
  readonly more: readonly HomeStoryCard[];
}

export interface HomeEditorialResponse {
  readonly generatedAt: string;
  readonly policy: HomeVisibilityPolicy;
  readonly hero: HomeHero | null;
  readonly regions: readonly HomeRegionRow[];
  /** True when the read failed — rows are UNAVAILABLE, never "nothing happened". */
  readonly degraded: boolean;
}

export type StorySearchScope = 'HOME_ELIGIBLE' | 'ALL_RETAINED';

export interface StorySearchResponse {
  readonly query: string;
  readonly scope: StorySearchScope;
  readonly region: HomeRegionId | null;
  readonly domain: HomeEditorialDomain | null;
  readonly days: number | null;
  readonly results: readonly HomeStoryCard[];
  /** Matching reports before grouping and the result cap. */
  readonly matched: number;
  /** True when the exact words found nothing and a looser (word-stem) match was used. */
  readonly relaxed: boolean;
}

export const STORY_SEARCH_MIN_LENGTH = 2;
export const STORY_SEARCH_MAX_LENGTH = 120;
