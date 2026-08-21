import { readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';

const searchClientSource = readFileSync(join(__dirname, 'SearchPageClient.tsx'), 'utf-8');
const searchPageSource = readFileSync(join(__dirname, '../../app/search/page.tsx'), 'utf-8');
const analysisApiSource = readFileSync(join(__dirname, '../../lib/api/analysisApi.ts'), 'utf-8');
const heroSource = readFileSync(join(__dirname, '../home/Hero.tsx'), 'utf-8');
const navModelSource = readFileSync(join(__dirname, '../../lib/navModel.ts'), 'utf-8');

/**
 * M65 — /search without a query is a usable research workspace instead of
 * an error-only dead end. Three real destinations depended on this:
 * the ai-research and evidence intelligence modules, and the mobile
 * "Ask" tab. The nine-item header navigation depends on /search too.
 */
describe('M65 — queryless /search is usable', () => {
  it('an absent question is no longer an error condition', () => {
    expect(searchClientSource).toMatch(/M65 — no question is no longer an error condition/);
    expect(searchClientSource).not.toMatch(/setFetchError\(dictionary\.noQuestionMessage\)/);
  });

  it('renders a real question form with a submit control when there is no query', () => {
    expect(searchClientSource).toMatch(/const hasQuery = query\.trim\(\)\.length > 0;/);
    expect(searchClientSource).toMatch(/role="search"/);
    expect(searchClientSource).toMatch(/onSubmit=\{handleWorkspaceSubmit\}/);
    expect(searchClientSource).toMatch(/type="submit"/);
  });

  it('the workspace input has a real accessible name, not a placeholder alone', () => {
    expect(searchClientSource).toMatch(/htmlFor="search-workspace-question"/);
    expect(searchClientSource).toMatch(/id="search-workspace-question"/);
    expect(searchClientSource).toMatch(/aria-label=\{dictionary\.searchWorkspaceAriaLabel\}/);
  });

  it('submitting uses the SAME /search?q=... contract the Hero and the header already produce — one analysis entry path', () => {
    expect(searchClientSource).toMatch(/router\.push\(`\/search\?q=\$\{encodeURIComponent\(trimmed\)\}`\)/);
    expect(heroSource).toMatch(/router\.push\(`\/search\?q=\$\{encodeURIComponent\(trimmed\)\}`\)/);
    expect(navModelSource).toMatch(/'\/search\?q=world'/);
  });

  it('every workspace string is localized', () => {
    for (const language of ['en', 'pl'] as const) {
      const dictionary = getDictionary(language);
      expect(dictionary.searchWorkspaceHeading.length).toBeGreaterThan(0);
      expect(dictionary.searchWorkspaceIntro.length).toBeGreaterThan(0);
      expect(dictionary.searchWorkspacePlaceholder.length).toBeGreaterThan(0);
      expect(dictionary.searchWorkspaceSubmitLabel.length).toBeGreaterThan(0);
      expect(dictionary.searchWorkspaceAriaLabel.length).toBeGreaterThan(0);
    }
    expect(getDictionary('pl').searchWorkspaceHeading).not.toBe(getDictionary('en').searchWorkspaceHeading);
  });
});

describe('M65 — no raw HTTP status ever reaches a user', () => {
  it('analysisApi classifies real statuses into a stable, localizable taxonomy', () => {
    expect(analysisApiSource).toMatch(/export type AnalysisApiErrorCode/);
    expect(analysisApiSource).toMatch(/if \(status === 429\) return 'rate-limited';/);
    expect(analysisApiSource).toMatch(/if \(status === 400 \|\| status === 422\) return 'invalid-query';/);
    expect(analysisApiSource).toMatch(/if \(status >= 500\) return 'server';/);
  });

  it('the underlying HTTP semantics are PRESERVED on the error object, not discarded', () => {
    expect(analysisApiSource).toMatch(/public readonly status\?: number/);
    expect(analysisApiSource).toMatch(/response\.status,\s*\n\s*codeForStatus\(response\.status\)/);
  });

  it('the UI renders a dictionary message chosen by code — never the developer-facing string', () => {
    expect(searchClientSource).toMatch(/function resolveAnalysisErrorMessage/);
    expect(searchClientSource).toMatch(/'rate-limited': dictionary\.analysisErrorRateLimited/);
    expect(searchClientSource).toMatch(/'invalid-query': dictionary\.analysisErrorInvalidQuery/);
    // Comments legitimately quote the old string while documenting why
    // it is gone; what must not exist is a code path that renders it.
    const codeOnly = searchClientSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/error\.message/);
    expect(codeOnly).not.toMatch(/Backend responded with/);
  });

  it('every error message is localized in both production languages', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    for (const key of [
      'analysisErrorTimeout',
      'analysisErrorNetwork',
      'analysisErrorInvalidQuery',
      'analysisErrorRateLimited',
      'analysisErrorServer',
    ] as const) {
      expect(en[key].length).toBeGreaterThan(0);
      expect(pl[key].length).toBeGreaterThan(0);
      expect(pl[key]).not.toBe(en[key]);
      expect(en[key]).not.toMatch(/\d{3}/);
      expect(pl[key]).not.toMatch(/\d{3}/);
    }
  });

  it('the stale-response guard still applies to the localized failure path', () => {
    expect(searchClientSource).toMatch(/if \(cancelled\) return;\s*\n\s*setFetchError\(/);
  });
});

describe('M65 — the search route is language-coherent', () => {
  it('the shell around the results renders in the same language as the results', () => {
    expect(searchPageSource).toMatch(/<NavBar language=\{language\} \/>/);
    expect(searchPageSource).toMatch(/<Footer language=\{language\} \/>/);
  });

  it('document metadata is resolved per request, not fixed to English', () => {
    expect(searchPageSource).toMatch(/export async function generateMetadata/);
    expect(searchPageSource).toMatch(/t\.searchMetaTitle/);
    expect(searchPageSource).not.toMatch(/export const metadata/);
  });

  it('the route reuses the SAME cookie/ACTIVE_LANGUAGES mechanism as the homepage — no second language source', () => {
    expect(searchPageSource).toMatch(/LANGUAGE_COOKIE_NAME/);
    expect(searchPageSource).toMatch(/isActiveLanguageCode/);
  });

  it('the client follows a header language change instead of staying on its mount-time value', () => {
    expect(searchClientSource).toMatch(/initialLanguage\?: LanguageCode/);
    expect(searchClientSource).toMatch(/setLanguage\(initialLanguage\);/);
    expect(searchClientSource).toMatch(/\}, \[initialLanguage\]\);/);
  });

  it('the page no longer patches document.documentElement.lang imperatively — the root layout owns it', () => {
    expect(searchClientSource).not.toMatch(/documentElement\.lang/);
  });
});
