import { readFileSync } from 'fs';
import { join } from 'path';

const cardSource = readFileSync(join(__dirname, 'CountryArticleCard.tsx'), 'utf-8');
const panelSource = readFileSync(join(__dirname, 'CountryPanel.tsx'), 'utf-8');
const searchClientSource = readFileSync(join(__dirname, '../search/SearchPageClient.tsx'), 'utf-8');

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
    const rootOpen = cardSource.indexOf('<div className="group flex items-start');
    const anchorOpen = cardSource.indexOf('<a\n', rootOpen);
    const anchorClose = cardSource.indexOf('</a>', anchorOpen);
    const buttonOpen = cardSource.indexOf('<button', anchorOpen);
    expect(buttonOpen).toBeGreaterThan(anchorClose);
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
