import { readFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';

const cardSource = readFileSync(join(__dirname, 'CountryArticleCard.tsx'), 'utf-8');
const panelSource = readFileSync(join(__dirname, 'CountryPanel.tsx'), 'utf-8');
const searchClientSource = readFileSync(join(__dirname, '../search/SearchPageClient.tsx'), 'utf-8');

/**
 * Every JSX element in a .tsx source, with the tag path of its ancestors.
 *
 * WHY A PARSER AND NOT indexOf(). The assertion below used to compare the
 * source-string positions of `'<a\n'`, `'</a>'` and `'<button'`. Three things
 * were wrong with that, and they compounded:
 *
 *   1. `'<a\n'` hard-codes a bare LF. This repository pins no EOL (there is no
 *      .gitattributes) and this file's own working copy is CRLF, where the JSX
 *      reads `<a\r\n` — so the search returned -1.
 *   2. String.prototype.indexOf() CLAMPS a negative start index to 0 rather
 *      than failing, so the two following searches silently restarted from the
 *      top of the file instead of from the anchor.
 *   3. `'<button'` then matched its first occurrence in the file, which is
 *      inside CountryArticleCard's own doc comment — the sentence explaining
 *      that a <button> must not be nested inside an <a>. The guard reported
 *      the documentation of the fix as the defect.
 *
 * Parsing removes all three failure modes at once: trivia (comments, string
 * literals, whitespace and line endings) cannot satisfy or break an assertion
 * made against the syntax tree, and the tree states containment directly
 * instead of inferring it from the order of two substrings.
 */
function jsxElements(source: string, fileName: string): Array<{ tag: string; ancestors: string[] }> {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: Array<{ tag: string; ancestors: string[] }> = [];

  const tagOf = (node: ts.Node): string | null =>
    ts.isJsxElement(node)
      ? node.openingElement.tagName.getText(sourceFile)
      : ts.isJsxSelfClosingElement(node)
        ? node.tagName.getText(sourceFile)
        : null;

  const walk = (node: ts.Node, ancestors: string[]): void => {
    const tag = tagOf(node);
    if (tag !== null) found.push({ tag, ancestors });
    node.forEachChild((child) => walk(child, tag === null ? ancestors : [...ancestors, tag]));
  };

  walk(sourceFile, []);
  return found;
}

/**
 * Milestone #51 — Map -> Story -> Q&A integration. Behavioral tests
 * only, per the explicit "avoid CSS-string tests for this milestone"
 * instruction. Covers the actual product journey: a country/story
 * context reaching the existing /search Q&A flow, using the SAME
 * plain-text-query + persisted-language architecture the app already
 * has, rather than inventing a new contract.
 */
describe('Country-level context reaches Q&A (pre-existing, re-verified)', () => {
  it('CountryPanel\u2019s "view full coverage" action navigates to /search with the real country name as the query \u2014 no fabricated field', () => {
    expect(panelSource).toMatch(/router\.push\(/);
    expect(panelSource).toMatch(/`\/search\?q=\$\{encodeURIComponent\(country\.name\)\}`/);
  });
});

describe('Story-level (article) context reaches Q&A \u2014 Milestone #51 Phase B, current contract', () => {
  it('CountryArticleCard builds a URLSearchParams-based navigation action carrying the real article title AND articleId (and countryCode when available) \u2014 the current, stronger anchoring contract', () => {
    // Milestone #53 regression repair — this test previously asserted
    // the OLD, title-only router.push string
    // (`/search?q=${encodeURIComponent(article.title)}`), which was
    // superseded by the M51 Phase B / CTO-final-correction work: a
    // country-only anchor could not distinguish one story from
    // another in the same country, so articleId became a real,
    // intentional part of this contract, not an accidental
    // regression. Updated to protect the CURRENT, stronger behavior.
    expect(cardSource).toMatch(
      /const params = new URLSearchParams\(\{ q: article\.title, articleId: article\.id \}\)/,
    );
    expect(cardSource).toMatch(/router\.push\(`\/search\?\$\{params\.toString\(\)\}`\)/);
  });

  it('the existing external "read full story" link is preserved unchanged \u2014 the new action is additive, not a replacement', () => {
    expect(cardSource).toMatch(/href=\{article\.url\}/);
    expect(cardSource).toMatch(/target="_blank"/);
    expect(cardSource).toMatch(/rel="noopener noreferrer"/);
  });

  it('articleId is a real, intentional part of the current contract \u2014 the smallest stable story identifier, never the whole article object/body', () => {
    expect(cardSource).toMatch(/articleId: article\.id/);
    expect(cardSource).not.toMatch(/JSON\.stringify\(article\)/);
  });

  it('the two actions are structurally independent (no nested <a><button>, which is invalid HTML and would break click handling)', () => {
    const elements = jsxElements(cardSource, 'CountryArticleCard.tsx');
    const INTERACTIVE = ['a', 'button'];

    const anchors = elements.filter((element) => element.tag === 'a');
    const buttons = elements.filter((element) => element.tag === 'button');

    // Fail loudly if either element disappears, rather than degrading into a
    // -1 that the old comparison could read as a pass.
    expect(anchors).toHaveLength(1);
    expect(buttons).toHaveLength(1);

    // THE ACTUAL RULE, asserted directly: no interactive element may have an
    // interactive ancestor. This is what "invalid <a><button> nesting" means,
    // and it also catches the inverse (<a> inside <button>) and any nesting a
    // simple ordering comparison would miss.
    for (const element of elements.filter((candidate) => INTERACTIVE.includes(candidate.tag))) {
      expect({ tag: element.tag, nestedInsideInteractive: element.ancestors.some((ancestor) => INTERACTIVE.includes(ancestor)) })
        .toEqual({ tag: element.tag, nestedInsideInteractive: false });
    }

    // ...and they are peers, so neither click target can swallow the other.
    expect(anchors[0].ancestors).toEqual(buttons[0].ancestors);
  });
});

describe('Language survives Map -> Q&A navigation (pre-existing persisted-language architecture, re-verified)', () => {
  it('the search page resolves language from the same persisted mechanism the rest of the app already uses, not from a URL parameter this milestone would need to add', () => {
    expect(searchClientSource).toMatch(/resolveInitialLanguage/);
  });

  it('neither the country nor the article navigation action appends a language parameter \u2014 confirming they correctly rely on the existing persisted mechanism instead of duplicating it', () => {
    expect(panelSource).not.toMatch(/&lang=/);
    expect(cardSource).not.toMatch(/&lang=/);
  });
});

describe('No fabricated backend contract fields were introduced', () => {
  it('the analysis request shape used by /search is unchanged \u2014 still query + language + the approved optional storyContext, never an arbitrary serialized object', () => {
    // Milestone #53 regression repair — updated from a 2-argument
    // analyzeNews(query, language) assertion to the current, approved
    // 3-argument call: storyContext is a real, deliberate addition
    // from M51 Phase B (see StoryContext in shared/src/analysis.ts),
    // not an untracked contract drift.
    expect(searchClientSource).toMatch(/analyzeNews\(query, language, storyContext\)/);
  });
});
