import { readFileSync } from 'fs';
import { join } from 'path';
import type { LanguageCode, StoryContext } from '@globalnews-ai/shared';

/**
 * ARTICLE-ANCHOR PARITY — the EN/PL Analysis Workspace defect.
 *
 * THE DEFECT. `SearchPageClient` built its `storyContext` only when the URL
 * carried a `countryCode`, and discarded `articleId` whenever it did not.
 * With the anchor stripped, `analysisApi` omits `storyContext` from the
 * request body entirely and the backend falls back to a generic search on
 * the question text — a path that IS language-dependent. The same Russia
 * story therefore populated in Polish and came back empty in English.
 *
 * WHY THIS FILE TESTS TWO LAYERS. The rule itself is a `useMemo` inside a
 * client component, and this repository's frontend suite has no jsdom or
 * React Testing Library — so the rule is extracted here as the same pure
 * expression and exercised directly, while a source assertion proves the
 * component actually contains that expression rather than a drifted copy.
 * Neither half is sufficient alone: the first could pass against a rule the
 * component no longer uses, the second could pass against a rule that is
 * wrong. Together they pin behaviour AND its presence.
 */

const SOURCE = readFileSync(join(__dirname, 'SearchPageClient.tsx'), 'utf-8').replace(
  /\r\n/g,
  '\n',
);

/**
 * The production rule, transcribed. Kept deliberately literal — including
 * the conditional spreads — so a reader can compare it to the component
 * line by line.
 */
function buildStoryContext(
  query: string,
  articleIdParam: string | null,
  countryCodeParam: string | null,
): StoryContext | undefined {
  return articleIdParam !== null || countryCodeParam !== null
    ? {
        title: query,
        ...(articleIdParam !== null ? { articleId: articleIdParam } : {}),
        ...(countryCodeParam !== null ? { countryCode: countryCodeParam } : {}),
      }
    : undefined;
}

/** What `analysisApi.ts` puts on the wire for a given context. */
function requestBody(
  query: string,
  requestedLanguage: LanguageCode,
  storyContext: StoryContext | undefined,
): Record<string, unknown> {
  return storyContext ? { query, requestedLanguage, storyContext } : { query, requestedLanguage };
}

const QUESTION = 'What is happening with the Russia grain corridor?';
const ARTICLE_ID = 'article-russia-7f3a';
const COUNTRY = 'RUS';

/*
 * ASK AI REV A §4.2 RETARGET — the dep list gained `storyTitle`.
 *
 * The INVARIANT this file pins is unchanged and is the reason the
 * assertion is written against the dep list at all: the memo is keyed on
 * URL-derived PRIMITIVES ONLY and never on `language`. Rev A adds one
 * more URL primitive — `storyTitle`, the transport that stops the
 * follow-up from becoming the story title — so the correct expression of
 * the same rule now names four params, not three. Nothing about
 * language-independence is relaxed; `not.toMatch(/\blanguage\b/)` below
 * still carries it.
 */
describe('article anchor — articleId alone is a valid story context', () => {
  it('an articleId with NO countryCode still produces an anchored context', () => {
    const ctx = buildStoryContext(QUESTION, ARTICLE_ID, null);
    expect(ctx).toEqual({ title: QUESTION, articleId: ARTICLE_ID });
  });

  it('the anchor actually reaches the request body', () => {
    const body = requestBody(QUESTION, 'en', buildStoryContext(QUESTION, ARTICLE_ID, null));
    expect(body.storyContext).toEqual({ title: QUESTION, articleId: ARTICLE_ID });
  });

  it('no countryCode key is invented when the URL has none', () => {
    /* Sending `countryCode: undefined` would be a different bug: the
       backend's cache key and its location branch both test for the
       field's presence. */
    const ctx = buildStoryContext(QUESTION, ARTICLE_ID, null);
    expect(Object.keys(ctx ?? {}).sort()).toEqual(['articleId', 'title']);
    expect('countryCode' in (ctx ?? {})).toBe(false);
  });
});

describe('article anchor — countryCode alone still works, unchanged', () => {
  it('a countryCode with no articleId produces a context, as before', () => {
    const ctx = buildStoryContext(QUESTION, null, COUNTRY);
    expect(ctx).toEqual({ title: QUESTION, countryCode: COUNTRY });
  });

  it('no articleId key is invented when the URL has none', () => {
    const ctx = buildStoryContext(QUESTION, null, COUNTRY);
    expect('articleId' in (ctx ?? {})).toBe(false);
  });

  it('both present keeps both', () => {
    expect(buildStoryContext(QUESTION, ARTICLE_ID, COUNTRY)).toEqual({
      title: QUESTION,
      articleId: ARTICLE_ID,
      countryCode: COUNTRY,
    });
  });
});

describe('article anchor — neither identifier leaves the generic analysis untouched', () => {
  it('no anchor is produced', () => {
    expect(buildStoryContext(QUESTION, null, null)).toBeUndefined();
  });

  it('the request body omits storyContext entirely, exactly as before', () => {
    const body = requestBody(QUESTION, 'en', buildStoryContext(QUESTION, null, null));
    expect(body).toEqual({ query: QUESTION, requestedLanguage: 'en' });
    expect('storyContext' in body).toBe(false);
  });
});

describe('article anchor — EN and PL anchor to the SAME article', () => {
  /*
   * The acceptance criterion. The anchor is derived from URL parameters,
   * which a language switch does not touch (`NavBar.handleLanguageChange`
   * persists a cookie and calls `router.refresh()`; it performs no
   * navigation). So the same story context must be produced for both
   * languages, and only `requestedLanguage` may differ on the wire.
   */
  const ctx = buildStoryContext(QUESTION, ARTICLE_ID, null);

  it('an identical articleId survives in both languages', () => {
    const en = requestBody(QUESTION, 'en', ctx).storyContext as StoryContext;
    const pl = requestBody(QUESTION, 'pl', ctx).storyContext as StoryContext;
    expect(en.articleId).toBe(ARTICLE_ID);
    expect(pl.articleId).toBe(en.articleId);
  });

  it('the two request bodies differ ONLY in requestedLanguage', () => {
    const en = requestBody(QUESTION, 'en', ctx);
    const pl = requestBody(QUESTION, 'pl', ctx);
    expect({ ...en, requestedLanguage: null }).toEqual({ ...pl, requestedLanguage: null });
    expect(en.requestedLanguage).toBe('en');
    expect(pl.requestedLanguage).toBe('pl');
  });

  it('the anchor does not depend on language at all', () => {
    /*
     * The rule takes no language argument, and the memo that builds it
     * must not reference one. Asserted on the memo's own CODE with
     * comments stripped — an earlier version of this test matched the
     * word "language" inside the explanatory comment above the memo and
     * failed for a reason that had nothing to do with behaviour.
     */
    expect(buildStoryContext.length).toBe(3);

    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    const start = code.indexOf('const storyContext');
    const memo = code.slice(start, code.indexOf('[query, storyTitleParam, countryCodeParam, articleIdParam],', start));
    expect(start).toBeGreaterThan(-1);
    expect(memo).not.toMatch(/\blanguage\b/);
  });
});

describe('article anchor — a language switch reissues with the same context', () => {
  it('the analysis effect re-runs on language and keeps storyContext in its deps', () => {
    const deps = /\}, \[query, language, hasResolvedLanguage, dictionary, storyContext\]\);/;
    expect(SOURCE).toMatch(deps);
  });

  it('the memo is keyed on the URL params only — not on language', () => {
    expect(SOURCE).toMatch(/\[query, storyTitleParam, countryCodeParam, articleIdParam\],/);
  });

  it('the request is reissued rather than served from a result cache', () => {
    /* `analysisApi` keeps an IN-FLIGHT map only, deleted on settle, so a
       switch genuinely re-asks in the new language with the same anchor.
       If a result cache were ever added, a stale-language response could
       be returned for the new language. */
    const api = readFileSync(join(__dirname, '..', '..', 'lib', 'api', 'analysisApi.ts'), 'utf-8');
    expect(api).toMatch(/inFlightAnalysisRequests\.delete\(key\)/);
  });
});

describe('article anchor — the component really contains this rule', () => {
  it('the gate is on EITHER identifier, not on countryCode alone', () => {
    expect(SOURCE).toMatch(/articleIdParam !== null \|\| countryCodeParam !== null/);
  });

  it('the old countryCode-only gate is gone', () => {
    /* The exact expression that discarded the anchor. */
    expect(SOURCE).not.toMatch(/countryCodeParam\s*\n?\s*\?\s*\{\s*title: query, countryCode/);
    expect(SOURCE).not.toMatch(/articleId: articleIdParam \?\? undefined/);
  });

  it('each field is conditionally spread, so neither is ever sent as undefined', () => {
    expect(SOURCE).toMatch(/\.\.\.\(articleIdParam !== null \? \{ articleId: articleIdParam \} : \{\}\)/);
    expect(SOURCE).toMatch(/\.\.\.\(countryCodeParam !== null \? \{ countryCode: countryCodeParam \} : \{\}\)/);
  });

  it('there is still exactly one analysis request path', () => {
    expect((SOURCE.match(/analyzeNews\(/g) ?? []).length).toBe(1);
  });
});
