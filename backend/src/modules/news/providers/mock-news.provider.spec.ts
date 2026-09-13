import { MockNewsProvider } from './mock-news.provider';

describe('MockNewsProvider search tokenization', () => {
  const provider = new MockNewsProvider();

  it('does not throw or break on punctuation-heavy natural-language queries', async () => {
    await expect(provider.search("what's happening in Ceuta?")).resolves.toBeInstanceOf(Array);
  });

  it('matches on a meaningful keyword within a full question', async () => {
    const results = await provider.search('Tell me about markets today');
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (article) =>
          article.title.toLowerCase().includes('market') ||
          article.summary.toLowerCase().includes('market'),
      ),
    ).toBe(true);
  });

  it('returns all articles when the query is only filler/stop words', async () => {
    const all = await provider.topHeadlines({ limit: 100 });
    const results = await provider.search('what is the latest news today');
    expect(results.length).toBe(all.length);
  });

  it('returns an empty array (not an error) when nothing matches', async () => {
    const results = await provider.search('xyznonexistentqueryterm');
    expect(results).toEqual([]);
  });
});
