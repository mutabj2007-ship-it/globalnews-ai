import type { HomeEditorialResponse, HomeRegionRow, HomeStoryCard } from '@globalnews-ai/shared';
import { degradedRows } from './degradedRows';

/**
 * R135 · /visual HTTP 500 — THE EDITORIAL AS THE READER RECEIVES IT.
 *
 * The backend's reader-rights interceptor runs on /home/editorial like every reader route: an
 * uncleared third-party article object is REMOVED from arrays and DROPPED as a property. So `hero`
 * can arrive WITHOUT its `story`, and a row can arrive with no card while its counts still count the
 * store. Read as delivered, that crashed the server render (hero.story.articleRef of undefined).
 *
 *   · a hero whose story is not a card → no hero, and the read is not a "nothing happened" read:
 *     it is marked degraded, so the hero reads UNAVAILABLE (existing copy), never the empty-store line;
 *   · a row the server selected cards for (OK / SPARSE) but with no card left → UNAVAILABLE (existing copy, no "See all"),
 *     never "N in the last 72 hours" above an empty list;
 *   · anything that is not a card is dropped from `more` and the rows.
 *
 * Pure: nothing is fetched, nothing is shown that the response did not carry.
 */
export function readableEditorial(editorial: HomeEditorialResponse | null): HomeEditorialResponse | null {
  if (editorial === null || typeof editorial !== 'object') return null;
  const hero = editorial.hero ?? null;
  const heroWithheld = hero !== null && !isCard(hero.story);
  const regions = Array.isArray(editorial.regions) ? editorial.regions.map(readableRow) : degradedRows();
  return {
    ...editorial,
    hero: hero === null || heroWithheld ? null : { ...hero, more: (Array.isArray(hero.more) ? hero.more : []).filter(isCard) },
    regions,
    degraded: editorial.degraded === true || heroWithheld || !Array.isArray(editorial.regions),
  };
}

function readableRow(row: HomeRegionRow): HomeRegionRow {
  const stories = (Array.isArray(row.stories) ? row.stories : []).filter(isCard);
  /* the server states a row EMPTY when it selected no card, so OK / SPARSE with no card left means withheld */
  if (stories.length === 0 && (row.state === 'OK' || row.state === 'SPARSE')) return { ...row, state: 'UNAVAILABLE', stories };
  return { ...row, stories };
}

function isCard(value: unknown): value is HomeStoryCard {
  if (value === null || typeof value !== 'object') return false;
  const c = value as Partial<HomeStoryCard>;
  return typeof c.articleRef === 'string' && typeof c.url === 'string' && typeof c.title === 'string';
}
