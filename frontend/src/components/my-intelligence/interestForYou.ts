import type { MyIntelligenceInterest } from '@globalnews-ai/shared';
import type { FixtureStory } from './devFixtures';

/**
 * INTEREST + SELECTION HOOK R1 — THE FOR YOU RULE, PURE.
 *
 *   no interests  → the broad followed-country behaviour, unchanged;
 *   interests set → ONLY stories matching ≥1 chosen interest, ordered by how
 *                   many chosen interests they match, then newest first.
 *                   Never backfilled with unrelated reporting to reach the
 *                   dashboard maximum: if two match, two are shown.
 *
 * The matching facts (`story.interests`) are computed server-side from
 * retained data by the one canonical classifier; nothing here infers, calls
 * AI or calls a provider. New since and Saved never pass through this rule.
 */
export interface ForYouSelection {
  readonly stories: readonly FixtureStory[];
  /** How many candidates match — the truthful count the header states. */
  readonly matchCount: number;
  readonly filtered: boolean;
}

export function matchedInterests(
  story: Pick<FixtureStory, 'interests'>,
  chosen: readonly MyIntelligenceInterest[],
): MyIntelligenceInterest[] {
  const own = new Set(story.interests ?? []);
  return chosen.filter((interest) => own.has(interest));
}

export function selectForYou(
  candidates: readonly FixtureStory[],
  chosen: readonly MyIntelligenceInterest[],
  limit: number,
): ForYouSelection {
  if (chosen.length === 0) {
    return { stories: candidates.slice(0, limit), matchCount: candidates.length, filtered: false };
  }
  const matches = candidates
    .map((story, index) => ({ story, index, score: matchedInterests(story, chosen).length }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Date.parse(b.story.publishedAt) - Date.parse(a.story.publishedAt) ||
        a.index - b.index,
    )
    .map((entry) => entry.story);
  return { stories: matches.slice(0, limit), matchCount: matches.length, filtered: true };
}
