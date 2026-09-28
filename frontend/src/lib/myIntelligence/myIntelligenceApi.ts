import type {
  MyIntelligenceFeedResponse,
  MyIntelligenceInterest,
  MyIntelligenceInterestsResponse,
  UpdateMyIntelligenceInterestsRequest,
  QuestionHistoryEntryView,
  SavedStoryListResponse,
  SavedStoryView,
  SaveStoryRequest,
} from '@globalnews-ai/shared';
import { accountFetch } from '@/lib/api/accountFetch';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE R1 — THE DATA CLIENT (non-visual)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Every call goes through accountFetch: first-party /api, the session cookie,
 * and the double-submit CSRF header on mutations. All routes live under the
 * existing authenticated `users` and `history` families — no new proxy family.
 *
 * NONE OF THESE CAN START COMPUTE. They read and write account data only:
 * the feed is retained reporting, saving is metadata, history is the reader's
 * own questions. The only AI boundary in My Intelligence is an explicit Run,
 * which goes through analyzeNews() (see runSelectionAction).
 */

export class MyIntelligenceApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`My Intelligence request failed (${status}) for ${path}`);
    this.name = 'MyIntelligenceApiError';
  }
}

async function readJson<T>(path: string, response: Response): Promise<T> {
  if (!response.ok) throw new MyIntelligenceApiError(response.status, path);
  return (await response.json()) as T;
}

export const MY_INTELLIGENCE_PATHS = {
  feed: '/users/me/intelligence/feed',
  savedStories: '/users/me/saved/stories',
  history: '/history',
  interests: '/users/me/intelligence/interests',
} as const;

/** Following / For You / New Since — retained reporting only. */
export async function fetchMyIntelligenceFeed(): Promise<MyIntelligenceFeedResponse> {
  const path = MY_INTELLIGENCE_PATHS.feed;
  return readJson(path, await accountFetch(path));
}

export async function fetchSavedStories(): Promise<SavedStoryListResponse> {
  const path = MY_INTELLIGENCE_PATHS.savedStories;
  return readJson(path, await accountFetch(path));
}

/** Saves by URL (+ optional provider id hint). The server resolves everything else. */
export async function saveStory(request: SaveStoryRequest): Promise<SavedStoryView> {
  const path = MY_INTELLIGENCE_PATHS.savedStories;
  const body: SaveStoryRequest = {
    url: request.url,
    ...(request.providerArticleId ? { providerArticleId: request.providerArticleId } : {}),
  };
  return readJson(path, await accountFetch(path, { method: 'POST', body }));
}

export async function removeSavedStory(articleRef: string): Promise<void> {
  const path = `${MY_INTELLIGENCE_PATHS.savedStories}/${encodeURIComponent(articleRef)}`;
  const response = await accountFetch(path, { method: 'DELETE' });
  if (!response.ok) throw new MyIntelligenceApiError(response.status, path);
}

/** Recent Intelligence — the reader's own questions, newest first (bounded server-side). */
export async function fetchQuestionHistory(): Promise<QuestionHistoryEntryView[]> {
  const path = MY_INTELLIGENCE_PATHS.history;
  return readJson(path, await accountFetch(path));
}

/* INTEREST + SELECTION HOOK R1 — the reader's explicit interests. Account data only. */
export async function fetchIntelligenceInterests(): Promise<MyIntelligenceInterestsResponse> {
  const path = MY_INTELLIGENCE_PATHS.interests;
  return readJson(path, await accountFetch(path));
}

/** ONE mutation: the stored set becomes exactly `interests`. An empty list clears it. */
export async function updateIntelligenceInterests(
  interests: readonly MyIntelligenceInterest[],
): Promise<MyIntelligenceInterestsResponse> {
  const path = MY_INTELLIGENCE_PATHS.interests;
  const body: UpdateMyIntelligenceInterestsRequest = { interests };
  return readJson(path, await accountFetch(path, { method: 'PUT', body }));
}
