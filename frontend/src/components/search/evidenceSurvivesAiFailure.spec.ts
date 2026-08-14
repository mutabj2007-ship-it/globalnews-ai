import { readFileSync } from 'fs';
import { join } from 'path';

const searchClientSource = readFileSync(join(__dirname, 'SearchPageClient.tsx'), 'utf-8');

/**
 * Milestone #52-B, Authorized Test 1 — proves the EXISTING
 * SearchPageClient architecture: when an AnalysisApiResponse has real
 * retrieved articles, `analysis === null`, and
 * `provenance.status === 'failed'` (or any non-'success' status), the
 * source/evidence presentation still renders — it is NOT nested
 * inside (and therefore not gated by) the response.analysis ternary.
 *
 * This repository's frontend test architecture has no React Testing
 * Library/jsdom anywhere (confirmed in the M52-A round: not a
 * dependency, no jest.config/setup exists), so this proves the
 * separation the same way this repo's existing tests already do:
 * structurally, against the real source, by locating the exact
 * boundaries of the `response.analysis ? (...) : (...)` block and
 * confirming the article-grid rendering block lies textually AFTER
 * (outside, as a sibling of) that block's closing — not nested
 * inside either branch.
 *
 * This is investigation-only test hardening per CTO authorization —
 * no production defect was found, so SearchPageClient itself is
 * unmodified.
 */
describe('Evidence survives AI failure \u2014 SearchPageClient renders sources independently of analysis success (M52-B Test 1)', () => {
  it('the article-grid rendering block is a sibling of the response.analysis ternary, not nested inside either of its branches', () => {
    const ternaryStart = searchClientSource.indexOf('{response.analysis ? (');
    expect(ternaryStart).toBeGreaterThan(-1);

    const ternaryCloseMarker = '          )}\n\n          {response.articles.length > 0 && (';
    const ternaryCloseIndex = searchClientSource.indexOf(ternaryCloseMarker);
    expect(ternaryCloseIndex).toBeGreaterThan(ternaryStart);

    const articlesBlockStart = searchClientSource.indexOf('{response.articles.length > 0 && (');
    expect(articlesBlockStart).toBe(ternaryCloseIndex + '          )}\n\n          '.length);
  });

  it('the article grid\u2019s own condition depends only on response.articles.length \u2014 never on response.analysis or provenance.status', () => {
    const articlesBlockStart = searchClientSource.indexOf('{response.articles.length > 0 && (');
    const articlesBlockSnippet = searchClientSource.slice(articlesBlockStart, articlesBlockStart + 400);

    expect(articlesBlockSnippet).toMatch(/response\.articles\.length > 0/);
    expect(articlesBlockSnippet).not.toMatch(/response\.analysis/);
    expect(articlesBlockSnippet).not.toMatch(/provenance\.status/);
  });

  it('SourceArticleCard receives article data straight from response.articles \u2014 no synthetic/placeholder path exists for the failure case', () => {
    expect(searchClientSource).toMatch(/\{response\.articles\.map\(\(article\) => \(/);
    expect(searchClientSource).toMatch(/<SourceArticleCard key=\{article\.id\} article=\{article\} language=\{language\} \/>/);
  });

  it('the failure/rejection presentation (AnalysisModeBadge + message) and the evidence grid are two independent JSX expressions inside the same parent, not mutually exclusive branches of one conditional', () => {
    const wrapperStart = searchClientSource.indexOf('<div className="flex flex-col gap-10">');
    const ternaryStart = searchClientSource.indexOf('{response.analysis ? (');
    const articlesBlockStart = searchClientSource.indexOf('{response.articles.length > 0 && (');

    expect(wrapperStart).toBeLessThan(ternaryStart);
    expect(ternaryStart).toBeLessThan(articlesBlockStart);
  });
});
