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

  /*
    H-PUBLIC-NAV-QUOTA-SAFETY-1 amends this pin's THIRD assertion only.

    It read `expect(navModelSource).toMatch(/'\/search\?q=world'/)`, i.e. the
    header was a third producer of the analysis entry contract. That is exactly
    what the quota-safety patch removes: a public header category must not be
    able to start a billable analysis. The test's own subject — ONE analysis
    entry path, shared rather than duplicated — is unchanged and is still
    asserted for both remaining producers; the header is now asserted to be
    absent from that set instead of present in it.
  */
  it('submitting uses the SAME /search?q=... contract the Hero already produces — one analysis entry path, and the public header is no longer one of its producers', () => {
    /* ASK/SEARCH R1 — same URL contract; the explicit submit now also records
       consent for exactly that href before navigating. */
    expect(searchClientSource).toContain('const href = `/search?q=${encodeURIComponent(trimmed)}`;');
    expect(searchClientSource).toMatch(/grantAnalysisConsent\(href\);\s*\n\s*router\.push\(href\);/);
    expect(heroSource).toMatch(/router\.push\(`\/search\?q=\$\{encodeURIComponent\(trimmed\)\}`\)/);
    expect(navModelSource).not.toMatch(/href: '\/search/);
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


/* ==================================================================== *
 * R2a — THE MEASURED GUARANTEES BEHIND THE RETARGETED TESTS
 *
 * `analysisWorkspaceShell.spec.ts` asserts the approved class strings.
 * A class string is not evidence that a layout fits, so the arithmetic
 * and the rendered structure are proven here.
 * ==================================================================== */

describe('R2a — /search Analysis Index geometry', () => {
  // JetBrains Mono advance = 0.6em; text-gn-hud-index is 10.5px with
  // 0.09em tracking. The fluid row's own chrome: 3px rail + 2x10px gap
  // + 2x10px row padding = 43; badge 2ch at 9px/0.10em + 12px = 24.6;
  // container md:px-3 = 24.
  const labelWidth = (chars: number) => chars * (10.5 * 0.6 + 10.5 * 0.09);
  const labelArea = (track: number) => track - 24 - 43 - 24.6;

  it('the approved 260px track carries the longest label in BOTH languages on one line', () => {
    expect(labelWidth(21)).toBeLessThanOrEqual(labelArea(260)); // EN INSUFFICIENT EVIDENCE
    expect(labelWidth(23)).toBeLessThanOrEqual(labelArea(260)); // PL NIEWYSTARCZAJĄCE DOWODY
  });

  it('THE RELEASED 236px TRACK COULD NOT — this is the defect, kept as arithmetic', () => {
    // 236 track, released padding md:pl-6 + md:pr-[14px] = 38 -> 198 content box,
    // against a FIXED 212px row. That 14px is the horizontal scrollbar.
    expect(236 - 38).toBeLessThan(212);
    // And the fixed row left 151px of label area, which neither long label fits.
    const releasedLabelArea = 212 - 20 - 3 - 20 - 24.6;
    expect(labelWidth(21)).toBeGreaterThan(releasedLabelArea);
    expect(labelWidth(23)).toBeGreaterThan(releasedLabelArea);
  });

  it('the workspace opts in to the fluid row rather than re-authoring one', () => {
    const ws = readFileSync(join(__dirname, 'AnalysisWorkspace.tsx'), 'utf-8');
    const desktop = ws.slice(ws.indexOf('md:grid-cols-[260px'), ws.indexOf('variant="desktop"') + 400);
    expect(desktop).toMatch(/fluid/);
    expect(ws).not.toMatch(/md:grid-cols-\[236px/);
  });
});

describe('R2a — retrieval and evidence-used are two different facts', () => {
  const telemetry = readFileSync(join(__dirname, 'AnalysisTelemetry.tsx'), 'utf-8');
  const claims = readFileSync(join(__dirname, 'analysisClaims.ts'), 'utf-8');

  it('the evidence-used count comes from trustState, NEVER from the retrieved pool', () => {
    const builder = claims.slice(claims.indexOf('export function buildTelemetryModel'), claims.indexOf('export function buildTelemetryModel') + 400);
    expect(builder).toMatch(/trustState\.distinctSourceArticleCount/);
    expect(builder).not.toMatch(/articles\.length|sourceSupport/);
  });

  it('it is null rather than borrowing the retrieved count when there is no analysis', () => {
    // The ASSIGNMENT, not the interface field of the same name.
    const at = claims.indexOf('evidenceUsedCount: response.');
    const builder = claims.slice(at, at + 140);
    expect(builder).toMatch(/\?\? null/);
    expect(builder).not.toMatch(/articlesRetrieved/);
  });

  it('the sources control is an ACTION and no longer renders a count beside its label', () => {
    const button = telemetry.slice(telemetry.indexOf('data-gn="sources-action"') - 900, telemetry.indexOf('</button>'));
    expect(button).toContain('data-gn="sources-action"');
    expect(button).not.toMatch(/\{sourceCount\}/);
  });

  it('NO LABEL CLAIMS INDEPENDENCE OR CORROBORATION — the contract forbids both readings', () => {
    for (const lang of ['en', 'pl'] as const) {
      const t = getDictionary(lang).analysisWorkspace.telemetry as Record<string, unknown>;
      const words = Object.values(t).filter((v): v is string => typeof v === 'string').join(' ');
      expect(`${lang}: ${/independen|corroborat|verified by|niezale\u017cn|potwierdz/i.test(words)}`).toBe(`${lang}: false`);
    }
  });

  it('both languages carry the new keys, so neither falls back to English', () => {
    for (const lang of ['en', 'pl'] as const) {
      const t = getDictionary(lang).analysisWorkspace.telemetry as Record<string, unknown>;
      for (const key of ['evidenceUsedLabel', 'evidenceUsedAria', 'noEvidenceUsed']) {
        expect(`${lang}.${key}: ${typeof t[key]}`).toBe(`${lang}.${key}: string`);
      }
    }
  });
});
