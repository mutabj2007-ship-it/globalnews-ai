import { readFileSync } from 'fs';
import { join } from 'path';

const cardSource = readFileSync(join(__dirname, 'CountryArticleCard.tsx'), 'utf-8');
const panelSource = readFileSync(join(__dirname, 'CountryPanel.tsx'), 'utf-8');
const searchClientSource = readFileSync(
  join(__dirname, '../search/SearchPageClient.tsx'),
  'utf-8',
);
const analysisApiSource = readFileSync(join(__dirname, '../../lib/api/analysisApi.ts'), 'utf-8');

/**
 * Milestone #51 Phase B — regression coverage for the story-context
 * handoff defect confirmed by real-browser CTO acceptance: selecting
 * a Rwanda migration story and asking "Ask GlobalNews AI about this"
 * produced an unrelated Italian swimming analysis.
 *
 * CTO final correction — country-only anchoring was later found
 * insufficient: it could not distinguish one Rwanda story from
 * another (e.g. migration vs. football vs. economy). This file now
 * also covers the articleId-based story anchor, which lets the
 * backend resolve the EXACT selected article server-side.
 *
 * Behavioral tests only, per the explicit "avoid CSS-string tests for
 * this milestone" instruction.
 */
describe('B. CountryArticleCard carries selected-story context, not title-only navigation', () => {
  it('includes both articleId (article.id, already available) and countryCode in the /search navigation URL', () => {
    expect(cardSource).toMatch(/const params = new URLSearchParams\(\{ q: article\.title, articleId: article\.id \}\)/);
    expect(cardSource).toMatch(/if \(countryCode\) \{\s*\n\s*params\.set\('countryCode', countryCode\)/);
  });

  it('CountryPanel threads the real, already-known country identifier through \u2014 not a placeholder or re-derived value', () => {
    expect(panelSource).toMatch(
      /<CountryArticleCard key=\{article\.id\} article=\{article\} language=\{language\} countryCode=\{country\.iso2\}/,
    );
  });

  it('the existing external "read full story" link is preserved unchanged \u2014 the fix is additive', () => {
    expect(cardSource).toMatch(/href=\{article\.url\}/);
    expect(cardSource).toMatch(/target="_blank"/);
  });
});

describe('A/I. Generic Q&A and existing country/map functionality are unaffected when there is no story context', () => {
  it('SearchPageClient only builds a storyContext when the URL actually carries a countryCode param \u2014 ordinary homepage/search Q&A gets storyContext === undefined', () => {
    expect(searchClientSource).toMatch(/const storyContext: StoryContext \| undefined = countryCodeParam/);
    expect(searchClientSource).toMatch(
      /\? \{ title: query, countryCode: countryCodeParam, articleId: articleIdParam \?\? undefined \}\s*\n\s*: undefined/,
    );
  });

  it('CountryPanel\u2019s own pre-existing "view full coverage" country-level navigation is untouched by this change', () => {
    expect(panelSource).toMatch(/`\/search\?q=\$\{encodeURIComponent\(country\.name\)\}`/);
  });
});

describe('C. analysisApi sends optional story context correctly', () => {
  it('analyzeNews accepts an optional third storyContext parameter, defaulting every pre-#51 caller to unaffected behavior', () => {
    expect(analysisApiSource).toMatch(/storyContext\?: StoryContext/);
  });

  it('the POST body conditionally includes storyContext only when present \u2014 never sends an undefined/null field for ordinary requests', () => {
    expect(analysisApiSource).toMatch(
      /body: JSON\.stringify\(storyContext \? \{ query, requestedLanguage, storyContext \} : \{ query, requestedLanguage \}\)/,
    );
  });
});

describe('C/D. In-flight dedup uses a stable story identity (articleId), not countryCode alone', () => {
  it('the dedup key prefers storyContext.articleId over countryCode, so two different stories in the same country never share one in-flight request', () => {
    expect(analysisApiSource).toMatch(/storyContext\?\.articleId\s*\n\s*\? `:story:\$\{storyContext\.articleId\}`/);
  });

  it('falls back to countryCode when articleId is absent, and to an empty suffix when storyContext is absent entirely', () => {
    expect(analysisApiSource).toMatch(/: storyContext\?\.countryCode\s*\n\s*\? `:story:\$\{storyContext\.countryCode\.toLowerCase\(\)\}`\s*\n\s*: ''/);
  });
});

describe('H. Existing language behavior remains intact', () => {
  it('language continues to resolve from the persisted mechanism, not a URL parameter this fix would need to duplicate', () => {
    expect(searchClientSource).toMatch(/resolveInitialLanguage/);
  });

  it('storyContext never carries a language field of its own \u2014 language is a fully separate, already-correct concern', () => {
    expect(searchClientSource).toMatch(/analyzeNews\(query, language, storyContext\)/);
  });
});
