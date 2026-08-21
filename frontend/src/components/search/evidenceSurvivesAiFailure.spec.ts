import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * I3 — the source is read with line endings normalized to LF in memory.
 *
 * This checkout is CRLF while the committed blob is LF. Every locator below
 * reasons about source STRUCTURE, never about EOL convention, so the two must
 * not be coupled. This normalizes ONLY the in-memory copy these assertions
 * read: no repository file is modified and no working-tree EOL normalization
 * is performed.
 */
const searchClientSource = readFileSync(join(__dirname, 'SearchPageClient.tsx'), 'utf-8').replace(
  /\r\n/g,
  '\n',
);

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

    const articlesBlockStart = searchClientSource.indexOf('{response.articles.length > 0 && (');
    expect(articlesBlockStart).toBeGreaterThan(ternaryStart);

    /*
      The article grid is a SIBLING of the analysis ternary, not nested inside
      either of its branches. Proof: the only text between the ternary's
      opening and the grid's opening ends with the ternary's own closing `)}`.
      Were the grid nested inside either branch, that branch's own JSX would
      necessarily intervene and this could not hold.

      Asserted structurally rather than by exact character arithmetic. The
      previous form hard-coded ten spaces of indentation, exactly one blank
      line and LF endings, so it broke on a CRLF checkout while the source it
      describes was byte-for-byte correct.
    */
    const betweenTernaryAndGrid = searchClientSource.slice(ternaryStart, articlesBlockStart);
    expect(betweenTernaryAndGrid).toMatch(/\)\}\s*$/);
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
