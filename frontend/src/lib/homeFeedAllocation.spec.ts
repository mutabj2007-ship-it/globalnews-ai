import { allocateHomeFeed, allocateToday, EMPTY_TODAY_ALLOCATION } from './homeFeedAllocation';
import type { NewsArticle } from '@globalnews-ai/shared';

function makeArticle(id: string, publishedAt: string): NewsArticle {
  return {
    id,
    title: `Title ${id}`,
    summary: 'Summary',
    url: `https://example.com/${id}`,
    sourceId: 'source',
    sourceName: 'Source',
    category: 'world',
    sourcesCount: 1,
    publishedAt,
  };
}

describe('allocateHomeFeed (Milestone #51 Phase B)', () => {
  const now = Date.now();
  const twelveArticles = Array.from({ length: 12 }, (_, i) =>
    makeArticle(`a${i}`, new Date(now - i * 60_000).toISOString()),
  );

  it('1. selects exactly one featured story', () => {
    const result = allocateHomeFeed(twelveArticles);
    expect(result.featured?.id).toBe('a0');
  });

  it('2. featured is excluded from inFocus', () => {
    const result = allocateHomeFeed(twelveArticles);
    expect(result.inFocus.some((a) => a.id === result.featured?.id)).toBe(false);
  });

  it('3. inFocus is excluded from discovery', () => {
    const result = allocateHomeFeed(twelveArticles);
    expect(result.discovery.some((a) => result.inFocus.some((f) => f.id === a.id))).toBe(false);
  });

  it('4. no duplicate article identity across featured/inFocus/discovery', () => {
    const result = allocateHomeFeed(twelveArticles);
    const ids = [result.featured?.id, ...result.inFocus.map((a) => a.id), ...result.discovery.map((a) => a.id)].filter(
      Boolean,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('5. latestUpdates is sorted by publishedAt descending', () => {
    const result = allocateHomeFeed(twelveArticles);
    const times = result.latestUpdates.map((a) => new Date(a.publishedAt).getTime());
    const sorted = [...times].sort((a, b) => b - a);
    expect(times).toEqual(sorted);
  });

  /*
    INVERTED UNDER THE PRODUCT OWNER'S VISIBLE-SURFACE EXCLUSIVITY RULING.

    This assertion used to REQUIRE the repetition: latestUpdates carried the
    whole pool, so the hero live feed re-published whatever the rail had already
    shown. Measured on the live Alpha, that put 9 of 9 trending stories into the
    hero feed a second time. The standing release gate is now that a duplicate
    story appears once, so the old expectation is the defect, not the contract.
  */
  it('6. latestUpdates NEVER repeats a story already shown in featured/inFocus/discovery', () => {
    const result = allocateHomeFeed(twelveArticles);
    expect(result.latestUpdates.some((a) => a.id === result.featured?.id)).toBe(false);
    /* 12 in, 1 + 5 + 6 taken by the rail, nothing left over — and a short feed
       is the intended outcome rather than a repeated one. */
    expect(result.latestUpdates).toHaveLength(0);
  });

  it('7. does not mutate the source articles array or its objects', () => {
    const original = twelveArticles.map((a) => ({ ...a }));
    allocateHomeFeed(twelveArticles);
    expect(twelveArticles).toEqual(original);
  });

  it('8. handles empty input without throwing', () => {
    const result = allocateHomeFeed([]);
    expect(result.featured).toBeNull();
    expect(result.inFocus).toEqual([]);
    expect(result.discovery).toEqual([]);
    expect(result.latestUpdates).toEqual([]);
  });

  it('9. handles undersupplied input gracefully — each role gets only what genuinely remains', () => {
    const three = [
      makeArticle('x0', new Date(now).toISOString()),
      makeArticle('x1', new Date(now - 60_000).toISOString()),
      makeArticle('x2', new Date(now - 120_000).toISOString()),
    ];
    const result = allocateHomeFeed(three);
    expect(result.featured?.id).toBe('x0');
    expect(result.inFocus).toHaveLength(2);
    expect(result.discovery).toHaveLength(0);
    const ids = [result.featured?.id, ...result.inFocus.map((a) => a.id)];
    expect(new Set(ids).size).toBe(3);
  });
});

/*
  R2 — allocateToday(). Behavioural tests against the real function, not source
  assertions: this is a pure function, so it can simply be executed.
*/
describe('allocateToday (R2 — Today selection and country counts)', () => {
  const DAY = '2026-08-23T09:00:00.000Z';

  const record = (
    id: string,
    firstSeenAt: string | undefined,
    country?: [string, string],
    url = `https://example.test/${id}`,
  ): NewsArticle => ({
    id,
    title: `Story ${id}`,
    summary: `Summary ${id}`,
    url,
    sourceId: 's',
    sourceName: 'Source',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-08-23T08:00:00.000Z',
    ...(firstSeenAt ? { firstSeenAt } : {}),
    ...(country ? { countryCode: country[0], countryName: country[1] } : {}),
  });

  it('selects only articles first observed inside the UTC day, and never assumes a missing value is today', () => {
    const result = allocateToday(
      [
        record('a', '2026-08-23T00:00:00.000Z'),
        record('b', '2026-08-23T23:59:59.999Z'),
        record('c', '2026-08-22T23:59:59.999Z'),
        record('d', '2026-08-24T00:00:00.000Z'),
        record('e', undefined),
      ],
      DAY,
    );

    expect(result.records.map((r) => r.id).sort()).toEqual(['a', 'b']);
    // The absent one is COUNTED, not silently dropped — that is the honest
    // degraded signal, and it is never read as "not today".
    expect(result.withoutFirstSeenCount).toBe(1);
  });

  it('treats the window as half-open [00:00, 24:00) so neither boundary can be counted twice', () => {
    expect(allocateToday([record('a', '2026-08-23T00:00:00.000Z')], DAY).records).toHaveLength(1);
    expect(allocateToday([record('a', '2026-08-24T00:00:00.000Z')], DAY).records).toHaveLength(0);
    expect(allocateToday([], DAY).windowStart).toBe('2026-08-23T00:00:00.000Z');
    expect(allocateToday([], DAY).windowEnd).toBe('2026-08-24T00:00:00.000Z');
  });

  it('deduplicates by URL and never by id — buildStableId is a 32-bit hash and two providers give one story two ids', () => {
    const shared = 'https://example.test/one-story';
    const result = allocateToday(
      [
        record('id-from-provider-1', '2026-08-23T05:00:00.000Z', ['KE', 'Kenya'], shared),
        record('id-from-provider-2', '2026-08-23T06:00:00.000Z', ['KE', 'Kenya'], shared),
      ],
      DAY,
    );

    expect(result.records).toHaveLength(1);
    // First occurrence wins, so response order is preserved.
    expect(result.records[0].id).toBe('id-from-provider-1');
    expect(result.countries).toEqual([{ countryCode: 'KE', countryName: 'Kenya', count: 1 }]);
  });

  it('counts by country, keeps unresolved records in their own count, and never invents a country', () => {
    const result = allocateToday(
      [
        record('a', '2026-08-23T05:00:00.000Z', ['KE', 'Kenya']),
        record('b', '2026-08-23T06:00:00.000Z', ['KE', 'Kenya']),
        record('c', '2026-08-23T07:00:00.000Z', ['DE', 'Germany']),
        record('d', '2026-08-23T08:00:00.000Z'),
      ],
      DAY,
    );

    expect(result.countries).toEqual([
      { countryCode: 'KE', countryName: 'Kenya', count: 2 },
      { countryCode: 'DE', countryName: 'Germany', count: 1 },
    ]);
    expect(result.unresolvedCount).toBe(1);
    // Unresolved is never folded into a country and never given a placeholder.
    expect(result.countries.map((c) => c.countryCode)).not.toContain('');
  });

  it('orders countries by count descending, then by the CANONICAL name — so row order cannot depend on the interface language', () => {
    const result = allocateToday(
      [
        record('a', '2026-08-23T05:00:00.000Z', ['ZW', 'Zimbabwe']),
        record('b', '2026-08-23T06:00:00.000Z', ['DE', 'Germany']),
        record('c', '2026-08-23T07:00:00.000Z', ['KE', 'Kenya']),
        record('d', '2026-08-23T08:00:00.000Z', ['KE', 'Kenya']),
      ],
      DAY,
    );

    expect(result.countries.map((c) => c.countryCode)).toEqual(['KE', 'DE', 'ZW']);
  });

  it('orders records by first observation, newest first', () => {
    const result = allocateToday(
      [
        record('older', '2026-08-23T03:00:00.000Z'),
        record('newest', '2026-08-23T11:00:00.000Z'),
        record('middle', '2026-08-23T07:00:00.000Z'),
      ],
      DAY,
    );

    expect(result.records.map((r) => r.id)).toEqual(['newest', 'middle', 'older']);
  });

  it('degrades honestly when NOTHING carries a first observation', () => {
    const result = allocateToday([record('a', undefined), record('b', undefined)], DAY);

    expect(result.records).toEqual([]);
    expect(result.withoutFirstSeenCount).toBe(2);
    expect(result.countries).toEqual([]);
    expect(result.unresolvedCount).toBe(0);
  });

  it('treats an unparseable timestamp as an absent one rather than as today', () => {
    const result = allocateToday([record('a', 'not-a-date')], DAY);
    expect(result.records).toEqual([]);
    expect(result.withoutFirstSeenCount).toBe(1);
  });

  it('returns the empty allocation for an unusable observation instant rather than guessing a window', () => {
    expect(allocateToday([record('a', '2026-08-23T05:00:00.000Z')], 'nonsense')).toEqual(
      EMPTY_TODAY_ALLOCATION,
    );
  });

  it('never mutates the input array or any article in it', () => {
    const input = [
      record('a', '2026-08-23T05:00:00.000Z', ['KE', 'Kenya']),
      record('b', '2026-08-23T06:00:00.000Z'),
    ];
    const snapshot = JSON.parse(JSON.stringify(input));

    allocateToday(input, DAY);

    expect(input).toEqual(snapshot);
  });

  it('makes NO batch inference — two records sharing a first-observation value stay two records', () => {
    const same = '2026-08-23T05:00:00.000Z';
    const result = allocateToday(
      [
        record('a', same, ['KE', 'Kenya'], 'https://example.test/a'),
        record('b', same, ['DE', 'Germany'], 'https://example.test/b'),
      ],
      DAY,
    );

    expect(result.records).toHaveLength(2);
    expect(result.countries).toHaveLength(2);
  });
});
