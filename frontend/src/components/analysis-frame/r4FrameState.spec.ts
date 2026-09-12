import type { AnalysisApiResponse, NewsArticle } from '@globalnews-ai/shared';
import { resolveFrameEvidence } from './analysisFrameState';

const article = (over: Partial<NewsArticle> = {}): NewsArticle => ({
  id: `a${Math.random()}`, title: 't', summary: 's', url: 'https://e.test/x',
  sourceId: 'sid', sourceName: 'Outlet', category: 'world', sourcesCount: 1,
  publishedAt: '2026-08-22T06:00:00.000Z', ...over,
} as NewsArticle);

const res = (over: Partial<AnalysisApiResponse> = {}): AnalysisApiResponse => ({
  query: 'q', normalizedQuery: 'q', requestedLanguage: 'en', responseLanguage: 'en',
  analysis: null, articles: [],
  retrievalContext: { dataMode: 'live', providers: ['gnews'], articlesRetrieved: 0 },
  sourceEntities: { organizations: [] },
  provenance: { provider: 'openai', executionMode: 'production', analysisMode: 'live-ai', status: 'not-attempted', cached: false },
  ...over,
} as never);

describe('R4 — the frame states the reason an analysis is absent', () => {
  it('no question is not a failure', () => {
    expect(resolveFrameEvidence(null, false).state).toBe('no-question');
    expect(resolveFrameEvidence(res(), false).state).toBe('no-question');
  });

  it('provider unreachable is distinguished from nothing-found', () => {
    const unavailable = res({ retrievalContext: { dataMode: 'unavailable', providers: [], articlesRetrieved: 0 } as never });
    expect(resolveFrameEvidence(unavailable, true).state).toBe('provider-unavailable');
    expect(resolveFrameEvidence(res(), true).state).toBe('no-evidence');
  });

  it('THE DEFECT THIS FIXES: zero articles never claims retrieval succeeded', () => {
    const zero = resolveFrameEvidence(res(), true);
    expect(zero.state).not.toBe('analysis-failed');
    expect(zero.evidenceSurvives).toBe(false);
    expect(zero.articleCount).toBe(0);
  });

  it('an AI failure WITH articles is the one case where evidence survives', () => {
    const failed = resolveFrameEvidence(res({ articles: [article(), article()] }), true);
    expect(failed.state).toBe('analysis-failed');
    expect(failed.evidenceSurvives).toBe(true);
  });

  it('a real analysis is populated', () => {
    const ok = resolveFrameEvidence(res({ analysis: {} as never, articles: [article()] }), true);
    expect(ok.state).toBe('populated');
  });
});

/*
 * R4 WITHDRAWAL GUARD — replaces the precision-breakdown panel this lane
 * built and then withdrew.
 *
 * The panel counted `NewsArticle.geographicPrecision`. That field is
 * declared in shared/src/news.ts and written by NOTHING: it has zero
 * writers in backend/**, so in production every record resolves to
 * "unresolved" and the table could only ever restate, as a count, what
 * the one-line ceiling already says in words. A city or region row was
 * reachable only from a fixture — which is exactly the fabricated basis
 * PAF-R1 RULING 1 banned, and exactly what R4 §9 forbids.
 *
 * Three other lanes reached the same conclusion independently and left
 * their own guards: analysisDimensions.ts refuses to read the field on
 * purpose, dictionaries/index.spec.ts fails the day the vocabulary ships
 * without a writer, and the backend contract spec asserts the field never
 * enters the retrieval payload. This test is the frame lane's guard.
 *
 * Delete this test only together with the commit that gives the field a
 * real writer.
 */
describe('R4 — the frame never renders a precision basis that has no writer', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const files = fs
    .readdirSync(__dirname)
    .filter((f: string) => /\.tsx?$/.test(f) && !/\.spec\.tsx?$/.test(f) && f !== 'frameFixtures.ts');

  it.each(files)('%s does not read NewsArticle.geographicPrecision', (file: string) => {
    const src = fs.readFileSync(`${__dirname}/${file}`, 'utf8');
    /*
     * A READ, not a mention.
     *
     * R4.1 tightened this. The original regex matched the identifier
     * anywhere, which fired on `evidenceGeography.ts` and `EvidenceMap.tsx`
     * for the comments explaining WHY they refuse to read the field. A
     * guard that punishes documenting the rule teaches people to delete
     * the explanation, which is the opposite of what it is for.
     *
     * So comments are stripped and the identifier is then banned outright
     * from what remains. That is STRICTER than the original inside code —
     * any occurrence at all fails, not just a property access — while
     * leaving the documentation that explains the rule intact.
     */
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect({ file, reads: /\bgeographicPrecision\b/.test(code) }).toEqual({ file, reads: false });
  });

  it('the dock geography label comes from countryName, a field with real writers', () => {
    const src = fs.readFileSync(`${__dirname}/SourcesDock.tsx`, 'utf8');
    expect(src).toMatch(/countryName/);
    expect(src).not.toMatch(/geographicPrecision|matchesCity|resolutionTag/);
  });
});
