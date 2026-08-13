import type { NewsArticle } from '@globalnews-ai/shared';
import { computeSourceDiversity } from './compute-source-diversity.util';

function makeArticle(overrides: Partial<NewsArticle>): NewsArticle {
  return {
    id: 'id',
    title: 'title',
    summary: '',
    url: 'https://example.com/unique',
    sourceId: 'src',
    sourceName: 'Source',
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('computeSourceDiversity (Milestone #43)', () => {
  it('A. zero articles', () => {
    const result = computeSourceDiversity([]);
    expect(result).toEqual({
      retrievedArticleCount: 0,
      reportingClusterCount: 0,
      duplicateLikeClusterCount: 0,
      largestClusterSize: 0,
      knownDomainCount: 0,
      unknownDomainArticleCount: 0,
      distinctSourceNameCount: 0,
    });
  });

  it('B. one article', () => {
    const result = computeSourceDiversity([makeArticle({ id: 'a', url: 'https://a.example.com/x' })]);
    expect(result.retrievedArticleCount).toBe(1);
    expect(result.reportingClusterCount).toBe(1);
    expect(result.duplicateLikeClusterCount).toBe(0);
    expect(result.largestClusterSize).toBe(1);
    expect(result.knownDomainCount).toBe(1);
  });

  it('C. all articles distinct', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://a.example.com', title: 'Markets rally on rate news' }),
      makeArticle({ id: 'b', url: 'https://b.example.com', title: 'New telescope data reveals galaxy' }),
      makeArticle({ id: 'c', url: 'https://c.example.com', title: 'Local election results announced' }),
    ];
    const result = computeSourceDiversity(articles);
    expect(result.reportingClusterCount).toBe(3);
    expect(result.duplicateLikeClusterCount).toBe(0);
    expect(result.largestClusterSize).toBe(1);
  });

  it('D. all articles one duplicate-like cluster', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://example.com/story', title: 'Story one' }),
      makeArticle({ id: 'b', url: 'https://example.com/story', title: 'Story one (v2)' }),
      makeArticle({ id: 'c', url: 'https://example.com/story', title: 'Story one (v3)' }),
    ];
    const result = computeSourceDiversity(articles);
    expect(result.reportingClusterCount).toBe(1);
    expect(result.duplicateLikeClusterCount).toBe(1);
    expect(result.largestClusterSize).toBe(3);
  });

  it('E. exact duplicate URL', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://example.com/story' }),
      makeArticle({ id: 'b', url: 'https://example.com/story' }),
    ];
    const result = computeSourceDiversity(articles);
    expect(result.reportingClusterCount).toBe(1);
    expect(result.largestClusterSize).toBe(2);
  });

  it('F. query/tracking URL variants do not affect domain grouping', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://example.com/story?utm_source=x&utm_campaign=y' }),
      makeArticle({ id: 'b', url: 'https://example.com/other-story?ref=abc' }),
    ];
    const result = computeSourceDiversity(articles);
    expect(result.knownDomainCount).toBe(1);
  });

  it('F2 (Milestone #43 URL-identity correction). same-path tracking/query variants now correctly collapse into ONE reporting cluster', () => {
    const articles = [
      makeArticle({
        id: 'a',
        url: 'https://example.com/story?utm_source=x',
        title: 'Alpha completely unrelated headline wording here',
      }),
      makeArticle({
        id: 'b',
        url: 'https://example.com/story?ref=abc',
        title: 'Zeta totally different phrasing altogether now',
      }),
    ];
    const result = computeSourceDiversity(articles);
    expect(result.reportingClusterCount).toBe(1);
    expect(result.duplicateLikeClusterCount).toBe(1);
    expect(result.largestClusterSize).toBe(2);
  });

  it('G. www vs non-www -> same normalized domain', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://www.example.com/story-a' }),
      makeArticle({ id: 'b', url: 'https://example.com/story-b' }),
    ];
    const result = computeSourceDiversity(articles);
    expect(result.knownDomainCount).toBe(1);
  });

  it('H. same domain but different paths -> 1 domain, 2 articles', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://example.com/story-a', title: 'First distinct report' }),
      makeArticle({ id: 'b', url: 'https://example.com/story-b', title: 'Second distinct report' }),
    ];
    const result = computeSourceDiversity(articles);
    expect(result.knownDomainCount).toBe(1);
    expect(result.retrievedArticleCount).toBe(2);
  });

  it('I. different domains -> distinct domain count', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://a.example.com/x' }),
      makeArticle({ id: 'b', url: 'https://b.example.com/y' }),
    ];
    const result = computeSourceDiversity(articles);
    expect(result.knownDomainCount).toBe(2);
  });

  it('J. title near-duplicate inside 12h -> clustered', () => {
    const now = new Date();
    const articles = [
      makeArticle({
        id: 'a',
        url: 'https://a.example.com/x',
        title: 'Coastal cities begin evacuation drills ahead of storm season',
        publishedAt: now.toISOString(),
      }),
      makeArticle({
        id: 'b',
        url: 'https://b.example.com/y',
        title: 'Coastal cities begin evacuation drills ahead of storm season today',
        publishedAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      }),
    ];
    const result = computeSourceDiversity(articles);
    expect(result.reportingClusterCount).toBe(1);
    expect(result.duplicateLikeClusterCount).toBe(1);
  });

  it('K. similar title outside 12h -> not clustered', () => {
    const now = new Date();
    const articles = [
      makeArticle({
        id: 'a',
        url: 'https://a.example.com/x',
        title: 'Committee schedules vote on cross-border data proposal',
        publishedAt: now.toISOString(),
      }),
      makeArticle({
        id: 'b',
        url: 'https://b.example.com/y',
        title: 'Committee schedules vote on cross-border data proposal',
        publishedAt: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      }),
    ];
    const result = computeSourceDiversity(articles);
    expect(result.reportingClusterCount).toBe(2);
    expect(result.duplicateLikeClusterCount).toBe(0);
  });

  it('L. malformed URL -> does not crash, increases unknownDomainArticleCount, never invents a domain', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'not a valid url at all' }),
      makeArticle({ id: 'b', url: 'https://good.example.com/x' }),
    ];
    const result = computeSourceDiversity(articles);
    expect(result.unknownDomainArticleCount).toBe(1);
    expect(result.knownDomainCount).toBe(1);
  });

  it('M. empty sourceName excluded', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://a.example.com', sourceName: '' }),
      makeArticle({ id: 'b', url: 'https://b.example.com', sourceName: 'Real Source' }),
    ];
    const result = computeSourceDiversity(articles);
    expect(result.distinctSourceNameCount).toBe(1);
  });

  it('N. whitespace-only sourceName excluded', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://a.example.com', sourceName: '   ' }),
      makeArticle({ id: 'b', url: 'https://b.example.com', sourceName: 'Real Source' }),
    ];
    const result = computeSourceDiversity(articles);
    expect(result.distinctSourceNameCount).toBe(1);
  });

  it('O. distinct non-empty raw sourceName values counted, never normalized/merged', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://a.example.com', sourceName: 'Reuters' }),
      makeArticle({ id: 'b', url: 'https://b.example.com', sourceName: 'reuters' }),
      makeArticle({ id: 'c', url: 'https://c.example.com', sourceName: 'Reuters' }),
    ];
    const result = computeSourceDiversity(articles);
    // "Reuters" and "reuters" are NOT merged -> 2 distinct raw values.
    expect(result.distinctSourceNameCount).toBe(2);
  });

  it('P. duplicateLikeClusterCount correctness across a mixed fixture', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://example.com/story', title: 'Story one' }),
      makeArticle({ id: 'b', url: 'https://example.com/story', title: 'Story one dup' }),
      makeArticle({ id: 'c', url: 'https://c.example.com', title: 'Totally unrelated report' }),
      makeArticle({ id: 'd', url: 'https://d.example.com/story2', title: 'Another repeated story' }),
      makeArticle({ id: 'e', url: 'https://d.example.com/story2', title: 'Another repeated story copy' }),
    ];
    const result = computeSourceDiversity(articles);
    expect(result.duplicateLikeClusterCount).toBe(2); // {a,b} and {d,e}
    expect(result.reportingClusterCount).toBe(3); // {a,b}, {c}, {d,e}
  });

  it('Q. largestClusterSize correctness', () => {
    const articles = [
      makeArticle({ id: 'a', url: 'https://example.com/story', title: 'Story one' }),
      makeArticle({ id: 'b', url: 'https://example.com/story', title: 'Story one v2' }),
      makeArticle({ id: 'c', url: 'https://example.com/story', title: 'Story one v3' }),
      makeArticle({ id: 'd', url: 'https://d.example.com', title: 'Singleton report' }),
    ];
    const result = computeSourceDiversity(articles);
    expect(result.largestClusterSize).toBe(3);
  });

  it('T. does not mutate the original NewsArticle objects or their URLs', () => {
    // Milestone #50 post-integration fix: `makeArticle()`'s default
    // `publishedAt` is `new Date().toISOString()`, generated fresh on
    // every call. The comparison fixture below previously called
    // makeArticle() a second time with no `publishedAt` override,
    // capturing a genuinely different (if millisecond-close)
    // timestamp than the first call — a flaky TEST-fixture defect, not
    // a real mutation bug. Both calls now share one fixed timestamp.
    const fixedPublishedAt = new Date().toISOString();
    const article = makeArticle({ id: 'a', url: 'https://example.com/story?utm_source=x', publishedAt: fixedPublishedAt });
    const originalUrl = article.url;
    const originalRef = article;
    computeSourceDiversity([article]);
    expect(article.url).toBe(originalUrl);
    expect(article).toBe(originalRef);
    expect(article).toEqual(
      makeArticle({ id: 'a', url: 'https://example.com/story?utm_source=x', publishedAt: fixedPublishedAt }),
    );
  });
});
