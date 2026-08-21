import type { NewsArticle } from '@globalnews-ai/shared';
import { collapseCrossProviderDuplicates } from './cross-provider-dedup.util';

function article(overrides: Partial<NewsArticle> & Pick<NewsArticle, 'id'>): NewsArticle {
  return {
    title: 'Global markets steady after coordinated central bank statement',
    summary: 'Summary',
    url: `https://example.com/${overrides.id}`,
    sourceId: 'example',
    sourceName: 'Example',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const PROVIDER_ORDER = ['gnews', 'second-real-wire'];

describe('collapseCrossProviderDuplicates', () => {
  it('collapses the same story carried by two providers under provider-namespaced ids', () => {
    const fromGnews = article({ id: 'gnews-111', providerId: 'gnews' });
    const fromSecond = article({ id: 'second-222', providerId: 'second-real-wire' });

    const collapsed = collapseCrossProviderDuplicates([fromGnews, fromSecond], PROVIDER_ORDER);

    expect(collapsed).toHaveLength(1);
  });

  it('keeps genuinely different stories from different providers', () => {
    const first = article({ id: 'gnews-111', providerId: 'gnews' });
    const second = article({
      id: 'second-222',
      providerId: 'second-real-wire',
      title: 'Researchers map a previously unknown ocean current system',
    });

    const collapsed = collapseCrossProviderDuplicates([first, second], PROVIDER_ORDER);

    expect(collapsed.map((entry) => entry.id)).toEqual(['gnews-111', 'second-222']);
  });

  it('picks the SAME survivor regardless of which provider answered first — arrival order does not decide the winner', () => {
    const fromGnews = article({ id: 'gnews-111', providerId: 'gnews', sourcesCount: 4 });
    const fromSecond = article({
      id: 'second-222',
      providerId: 'second-real-wire',
      sourcesCount: 9,
    });

    const gnewsFirst = collapseCrossProviderDuplicates([fromGnews, fromSecond], PROVIDER_ORDER);
    const secondFirst = collapseCrossProviderDuplicates([fromSecond, fromGnews], PROVIDER_ORDER);

    expect(gnewsFirst.map((entry) => entry.id)).toEqual(['second-222']);
    expect(secondFirst.map((entry) => entry.id)).toEqual(['second-222']);
  });

  it('prefers the better-corroborated record (higher sourcesCount) over registration order', () => {
    const fromGnews = article({ id: 'gnews-111', providerId: 'gnews', sourcesCount: 2 });
    const fromSecond = article({
      id: 'second-222',
      providerId: 'second-real-wire',
      sourcesCount: 30,
    });

    expect(
      collapseCrossProviderDuplicates([fromGnews, fromSecond], PROVIDER_ORDER).map((e) => e.id),
    ).toEqual(['second-222']);
  });

  it('falls back to registration order when corroboration is tied', () => {
    const fromGnews = article({ id: 'zzz-gnews', providerId: 'gnews', sourcesCount: 5 });
    const fromSecond = article({
      id: 'aaa-second',
      providerId: 'second-real-wire',
      sourcesCount: 5,
    });

    // 'aaa-second' sorts first lexicographically, so a survivor of
    // 'zzz-gnews' proves registration order outranks the id tiebreak.
    expect(
      collapseCrossProviderDuplicates([fromSecond, fromGnews], PROVIDER_ORDER).map((e) => e.id),
    ).toEqual(['zzz-gnews']);
  });

  it('falls back to the id tiebreak when corroboration AND provider rank are tied, so the result is still deterministic', () => {
    const first = article({ id: 'gnews-aaa', providerId: 'gnews', sourcesCount: 3 });
    const second = article({ id: 'gnews-bbb', providerId: 'gnews', sourcesCount: 3 });

    expect(
      collapseCrossProviderDuplicates([second, first], PROVIDER_ORDER).map((e) => e.id),
    ).toEqual(['gnews-aaa']);
  });

  it('ranks an article with no providerId behind every known provider', () => {
    const withProvenance = article({ id: 'zzz-gnews', providerId: 'gnews', sourcesCount: 5 });
    const withoutProvenance = article({ id: 'aaa-unknown', sourcesCount: 5 });

    expect(
      collapseCrossProviderDuplicates([withoutProvenance, withProvenance], PROVIDER_ORDER).map(
        (e) => e.id,
      ),
    ).toEqual(['zzz-gnews']);
  });

  it('returns survivors in the caller’s original order, not preference order', () => {
    const lowCorroboration = article({
      id: 'gnews-111',
      providerId: 'gnews',
      sourcesCount: 1,
      title: 'Trade negotiators reconvene after week-long recess',
    });
    const highCorroboration = article({
      id: 'second-222',
      providerId: 'second-real-wire',
      sourcesCount: 40,
    });

    const collapsed = collapseCrossProviderDuplicates(
      [lowCorroboration, highCorroboration],
      PROVIDER_ORDER,
    );

    expect(collapsed.map((entry) => entry.id)).toEqual(['gnews-111', 'second-222']);
  });

  it('returns the input untouched when there is nothing that could collapse', () => {
    const single = [article({ id: 'gnews-111', providerId: 'gnews' })];

    expect(collapseCrossProviderDuplicates(single, PROVIDER_ORDER)).toBe(single);
    expect(collapseCrossProviderDuplicates([], PROVIDER_ORDER)).toEqual([]);
  });

  it('never mutates the array it was given', () => {
    const first = article({ id: 'gnews-111', providerId: 'gnews', sourcesCount: 1 });
    const second = article({ id: 'second-222', providerId: 'second-real-wire', sourcesCount: 9 });
    const input = [first, second];

    collapseCrossProviderDuplicates(input, PROVIDER_ORDER);

    expect(input).toEqual([first, second]);
  });
});
