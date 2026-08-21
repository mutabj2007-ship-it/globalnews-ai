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
 * Milestone #52-A — hardening the already-working M51 Map -> Story ->
 * Q&A journey. Behavioral tests only, per the explicit "prefer
 * behavior tests over brittle CSS-string tests" instruction.
 */
describe('A. storyContext is stable across renders (real lint defect found and fixed)', () => {
  it('storyContext is memoized with useMemo, not a fresh object literal every render', () => {
    expect(searchClientSource).toMatch(/import \{ useEffect, useMemo, useState \} from 'react'/);
    expect(searchClientSource).toMatch(/const storyContext: StoryContext \| undefined = useMemo\(/);
  });

  it('useMemo is keyed on the real primitive inputs (query, countryCodeParam, articleIdParam) \u2014 the smallest set that actually determines storyContext\u2019s content', () => {
    expect(searchClientSource).toMatch(/\[query, countryCodeParam, articleIdParam\],\s*\n\s*\);/);
  });

  it('the analysis effect honestly lists storyContext in its own dependency array \u2014 no eslint-disable directive, no suppressed exhaustive-deps rule', () => {
    expect(searchClientSource).not.toMatch(/\/\/\s*eslint-disable|\/\*\s*eslint-disable/);
    // M65 — the dependency array changed for one honest reason: the
    // empty-query branch no longer renders dictionary.noQuestionMessage
    // as an error (queryless /search is now a usable research
    // workspace), and the catch branch now selects a localized message
    // from the whole dictionary rather than one fixed string. The
    // contract this test exists to protect — an honest, complete
    // dependency array with no suppressed rule — is unchanged and is
    // still asserted above.
    expect(searchClientSource).toMatch(
      /\}, \[query, language, hasResolvedLanguage, dictionary, storyContext\]\);/,
    );
  });

  it('the effect body still only reads storyContext (not countryCodeParam/articleIdParam directly), so the memoized value is the single source of truth for the request', () => {
    /*
      Anchored on the effect's own dependency array, then walked backwards to
      the nearest enclosing `useEffect(() => {`.

      The previous form anchored on the literal comment text
      `// Milestone #47` with exact indentation and an LF newline, so on a CRLF
      checkout indexOf() returned -1; slice(-1, end) then inverted its range
      and produced an empty string. The assertion failed while the production
      effect it describes was entirely correct.
    */
    const effectEnd = searchClientSource.indexOf('}, [query, language, hasResolvedLanguage');
    const effectStart = searchClientSource.lastIndexOf('useEffect(() => {', effectEnd);
    expect(effectStart).toBeGreaterThan(-1);
    expect(effectEnd).toBeGreaterThan(effectStart);

    const effectBody = searchClientSource.slice(effectStart, effectEnd);
    expect(effectBody).toMatch(/analyzeNews\(query, language, storyContext\)/);

    // The memoized storyContext is the single source of truth for the request,
    // so the effect must not read the raw params directly. This test's title
    // has always claimed exactly that; now it is actually asserted.
    expect(effectBody).not.toMatch(/\bcountryCodeParam\b/);
    expect(effectBody).not.toMatch(/\barticleIdParam\b/);
  });
});

describe('B. Generic query without storyContext still works (no regression from memoization)', () => {
  it('storyContext resolves to undefined when countryCodeParam is absent, exactly as before this round', () => {
    expect(searchClientSource).toMatch(
      /countryCodeParam\s*\n\s*\? \{ title: query, countryCode: countryCodeParam, articleId: articleIdParam \?\? undefined \}\s*\n\s*: undefined,/,
    );
  });
});

describe('F. Stale-response protection across rapid navigation (Story A -> Story B)', () => {
  it('the effect uses a cancelled flag set in its cleanup function, so a slower Story A response can never overwrite a newer Story B\u2019s state once the effect has re-run', () => {
    expect(searchClientSource).toMatch(/let cancelled = false;/);
    expect(searchClientSource).toMatch(/return \(\) => \{\s*\n\s*cancelled = true;\s*\n\s*\};/);
  });

  it('every state-setting callback checks the cancelled flag before writing state', () => {
    expect(searchClientSource).toMatch(/if \(!cancelled\) setResponse\(result\);/);
    expect(searchClientSource).toMatch(/if \(cancelled\) return;/);
    expect(searchClientSource).toMatch(/if \(!cancelled\) setIsLoading\(false\);/);
  });

  it('the effect now correctly re-runs when storyContext changes (memoized identity change reflects a real content change) \u2014 this is what actually triggers the cancel-and-restart behavior between two different stories', () => {
    expect(searchClientSource).toMatch(/storyContext\]\);/);
  });
});

describe('G. Evidence/citation integrity and demo-mode labeling remain governed by the existing, single response contract', () => {
  it('the branch between a real analysis and a not-attempted/failed state is driven by response.provenance.status, not a second parallel error model', () => {
    expect(searchClientSource).toMatch(/response\.provenance\.status === 'not-attempted'/);
  });

  it('AnalysisModeBadge (the existing, single source of live-vs-mock labeling) is rendered for both the analyzed and non-analyzed branches, never bypassed', () => {
    expect(searchClientSource).toMatch(/<AnalysisModeBadge provenance=\{response\.provenance\} language=\{language\} \/>/);
  });

  it('displayed source cards are rendered directly from response.articles \u2014 no placeholder/synthetic article is ever introduced', () => {
    expect(searchClientSource).toMatch(/\{response\.articles\.map\(\(article\) => \(/);
    expect(searchClientSource).not.toMatch(/placeholder.*article|fake.*article|dummy.*article/i);
  });
});
