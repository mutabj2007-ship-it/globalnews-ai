import type { NewsArticle } from '@globalnews-ai/shared';
import {
  PUBLISHED_AT_BASIS_VALUES,
  readPublishedAtBasis,
  writePublishedAtBasis,
} from './published-at-basis.util';
import { collapseDuplicateStories } from '../identity/article-identity.util';

/**
 * R4 GDELT — the read/write rules for a TEXT column that carries a
 * two-member contract, plus AE: what a database round trip must NOT enable.
 */

describe('readPublishedAtBasis — validated, never trusted', () => {
  it('returns the two contract values unchanged', () => {
    expect(readPublishedAtBasis('publisher')).toBe('publisher');
    expect(readPublishedAtBasis('observed')).toBe('observed');
    expect(PUBLISHED_AT_BASIS_VALUES).toEqual(['publisher', 'observed']);
  });

  /**
   * AC, at the unit level. The direction is the whole point: an unknown
   * string must NOT become 'publisher', because that would convert a value
   * nobody can vouch for into a positive claim that an outlet asserted this
   * publication time.
   */
  it.each([
    ['a near miss in case', 'Publisher'],
    ['a near miss in whitespace', ' observed'],
    ['shouting', 'PUBLISHER'],
    ['an invented member', 'guessed'],
    ['an empty string', ''],
    ['the string null', 'null'],
  ])('AC — %s is UNPROVEN, not publisher', (_name, stored) => {
    expect(readPublishedAtBasis(stored)).toBeUndefined();
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an object', { basis: 'publisher' }],
    ['an array', ['publisher']],
  ])('AC — %s is UNPROVEN, not publisher', (_name, stored) => {
    expect(readPublishedAtBasis(stored)).toBeUndefined();
  });
});

describe('writePublishedAtBasis — absence means publisher on the way IN', () => {
  it('stores observed as observed', () => {
    expect(writePublishedAtBasis('observed')).toBe('observed');
  });

  it('stores publisher as publisher', () => {
    expect(writePublishedAtBasis('publisher')).toBe('publisher');
  });

  /**
   * The asymmetry with the reader, asserted rather than only explained.
   * On WRITE, absence comes from this application's own pipeline, whose
   * only unlabelled producers are publisher-basis. On READ, an absent or
   * unknown value could have come from anywhere and earns nothing.
   */
  it('an unlabelled article is stored as publisher, matching the column default', () => {
    expect(writePublishedAtBasis(undefined)).toBe('publisher');
  });

  it('write and read deliberately disagree about absence, and only in that direction', () => {
    expect(writePublishedAtBasis(undefined)).toBe('publisher');
    expect(readPublishedAtBasis(undefined)).toBeUndefined();
  });
});

/**
 * ── AE — A DATABASE ROUND TRIP MUST NOT UNLOCK RUNG 3 ACROSS BASES ─────
 *
 * The migration means observed timestamps are now stored and restored. The
 * risk it introduces is that a GDELT record and a GNews record, both read
 * back out of the same table, start looking alike enough for the identity
 * ladder's time window to compare them — which is exactly what the basis
 * guard exists to prevent.
 *
 * These fixtures are shaped as if they had just come back from
 * `findRecent()`: same exact headline, same host, ten minutes apart, both
 * carrying `firstSeenAt`. Everything rung 3 needs EXCEPT a shared basis.
 */
function restoredArticle(overrides: Partial<NewsArticle> & Pick<NewsArticle, 'id'>): NewsArticle {
  return {
    title: 'Central bank holds rates',
    summary: 'Stored summary',
    url: `https://outlet.example/${overrides.id}`,
    imageUrl: 'https://cdn.outlet.example/shared.jpg',
    sourceId: 'outlet',
    sourceName: 'Outlet',
    category: 'business',
    sourcesCount: 1,
    publishedAt: '2026-08-26T09:00:00.000Z',
    firstSeenAt: '2026-08-26T09:30:00.000Z',
    ...overrides,
  } as NewsArticle;
}

describe('AE — mixed bases stay un-mergeable after a database round trip', () => {
  it('a restored publisher row and a restored observed row do NOT collapse', () => {
    const collapsed = collapseDuplicateStories([
      restoredArticle({ id: 'pub-1', publishedAtBasis: 'publisher' }),
      restoredArticle({
        id: 'obs-1',
        publishedAt: '2026-08-26T09:10:00.000Z',
        publishedAtBasis: 'observed',
      }),
    ]);

    expect(collapsed.map((a) => a.id).sort()).toEqual(['obs-1', 'pub-1']);
  });

  it('two restored rows sharing a proven basis still DO collapse', () => {
    const collapsed = collapseDuplicateStories([
      restoredArticle({ id: 'pub-1', publishedAtBasis: 'publisher' }),
      restoredArticle({
        id: 'pub-2',
        publishedAt: '2026-08-26T09:10:00.000Z',
        publishedAtBasis: 'publisher',
      }),
    ]);

    expect(collapsed).toHaveLength(1);
  });

  /**
   * The case the reader validation creates: a corrupt column value arrives
   * as undefined. Unproven cannot be shown to match anything, so the pair
   * stays apart — costing a duplicate rather than a false merge.
   */
  it('a row whose stored basis was INVALID cannot corroborate with anything', () => {
    const collapsed = collapseDuplicateStories([
      restoredArticle({ id: 'pub-1', publishedAtBasis: 'publisher' }),
      restoredArticle({
        id: 'unknown-1',
        publishedAt: '2026-08-26T09:10:00.000Z',
        publishedAtBasis: readPublishedAtBasis('something-else'),
      }),
    ]);

    expect(collapsed.map((a) => a.id).sort()).toEqual(['pub-1', 'unknown-1']);
  });

  /**
   * Rungs 1 and 2 are untouched by any of this. A shared normalized URL
   * still collapses two restored rows no matter what their bases say —
   * which is what keeps the guard from costing real duplicate suppression.
   */
  it('a shared URL still collapses restored rows across DIFFERENT bases', () => {
    const collapsed = collapseDuplicateStories([
      restoredArticle({
        id: 'pub-1',
        url: 'https://outlet.example/story?utm_source=gnews',
        publishedAtBasis: 'publisher',
      }),
      restoredArticle({
        id: 'obs-1',
        url: 'https://outlet.example/story?utm_campaign=gdelt',
        publishedAtBasis: 'observed',
      }),
    ]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].id).toBe('pub-1');
  });
});
