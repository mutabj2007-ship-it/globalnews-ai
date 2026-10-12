import { STORY_SEARCH_MIN_LENGTH, type HomeRegionId, type HomeStoryCard } from '@globalnews-ai/shared';
import { accountFetch } from '@/lib/api/accountFetch';
import { PICKER_PUBLISHER_CONTENT } from '@/lib/rights/pickerPublisherContent';

/**
 * ASK D0.1 — the ONLY data path of the story picker (D1) and the region browse of Choose a place
 * (D2): the existing public, zero-compute GET /api/stories/search (HOME_ELIGIBLE scope).
 *
 *   q + 2 characters   D1 search (matrix G2-2)
 *   q = '' + region    D2 bounded retained region browse (matrix G1-2, Erratum E1 N1)
 *
 * Under the HOLD gate this module makes NO request and returns RIGHTS_HOLD, so no publisher
 * title, summary or image URL is fetched into the browser. Only the fields the picker may show
 * are kept: never `summary`, never `imageUrl` (D04, U-1).
 */
export interface PickerStory {
  readonly articleRef: string;
  readonly storyId: string | null;
  readonly url: string;
  readonly title: string;
  readonly publisher: string;
  /** Q5: "Published" only when the publisher supplied the date; otherwise "Seen" (retention). */
  readonly date: string;
  readonly dateBasis: 'publisher' | 'observed';
}

export type PickerSearchResult =
  | { readonly kind: 'RIGHTS_HOLD' }
  | { readonly kind: 'TOO_SHORT' }
  | { readonly kind: 'OK'; readonly stories: readonly PickerStory[] }
  | { readonly kind: 'UNAVAILABLE' }
  | { readonly kind: 'NETWORK' };

function toPickerStory(card: HomeStoryCard): PickerStory {
  const dateBasis = card.publishedAtBasis === 'publisher' ? 'publisher' : 'observed';
  return {
    articleRef: card.articleRef,
    storyId: card.storyId,
    url: card.url,
    title: card.title,
    publisher: card.publisher,
    date: dateBasis === 'publisher' ? card.publishedAt : card.firstSeenAt,
    dateBasis,
  };
}

async function get(params: URLSearchParams): Promise<PickerSearchResult> {
  if (PICKER_PUBLISHER_CONTENT !== 'CLEARED') return { kind: 'RIGHTS_HOLD' };
  try {
    const response = await accountFetch(`/stories/search?${params.toString()}`);
    if (response.status === 404) return { kind: 'UNAVAILABLE' };
    if (!response.ok) return { kind: 'UNAVAILABLE' };
    const body = (await response.json()) as { results?: readonly HomeStoryCard[] };
    return { kind: 'OK', stories: (body.results ?? []).map(toPickerStory) };
  } catch {
    return { kind: 'NETWORK' };
  }
}

/** D1 — S01 (under 2 characters: no request), S02/S03/S04. */
export function searchPickerStories(q: string): Promise<PickerSearchResult> {
  const term = q.trim();
  if (term.length < STORY_SEARCH_MIN_LENGTH) return Promise.resolve({ kind: 'TOO_SHORT' });
  return get(new URLSearchParams({ q: term, scope: 'home' }));
}

/** D2 — a coverage region's retained reporting. Not a place briefing, not a change comparison (N2). */
export function browseRegionStories(region: HomeRegionId): Promise<PickerSearchResult> {
  return get(new URLSearchParams({ q: '', region, scope: 'home' }));
}
