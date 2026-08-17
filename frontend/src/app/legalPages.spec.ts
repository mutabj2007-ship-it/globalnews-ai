import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * B2 — Public Legal Surfaces. Minimal regression coverage proving
 * /privacy and /terms exist as real Next.js routes and are wired
 * through the existing language-cookie mechanism, matching the
 * established readFileSync structural-test convention already used
 * elsewhere in this codebase (see footerNavHud.spec.ts) rather than
 * introducing a new testing approach.
 */
describe('B2 — /privacy and /terms routes', () => {
  const privacyPagePath = join(__dirname, 'privacy', 'page.tsx');
  const termsPagePath = join(__dirname, 'terms', 'page.tsx');

  it('frontend/src/app/privacy/page.tsx exists', () => {
    expect(existsSync(privacyPagePath)).toBe(true);
  });

  it('frontend/src/app/terms/page.tsx exists', () => {
    expect(existsSync(termsPagePath)).toBe(true);
  });

  it('both pages export a default component', () => {
    const privacySource = readFileSync(privacyPagePath, 'utf-8');
    const termsSource = readFileSync(termsPagePath, 'utf-8');
    expect(privacySource).toMatch(/export default async function PrivacyPage/);
    expect(termsSource).toMatch(/export default async function TermsPage/);
  });

  it('both pages resolve language using the SAME existing homepage server-component pattern (LANGUAGE_COOKIE_NAME + isActiveLanguageCode), not a new mechanism', () => {
    const privacySource = readFileSync(privacyPagePath, 'utf-8');
    const termsSource = readFileSync(termsPagePath, 'utf-8');
    for (const source of [privacySource, termsSource]) {
      expect(source).toMatch(/cookies\(\)\.get\(LANGUAGE_COOKIE_NAME\)/);
      expect(source).toMatch(/isActiveLanguageCode/);
    }
  });

  it('both pages resolve their content via the existing getDictionary() mechanism, not hardcoded English text', () => {
    const privacySource = readFileSync(privacyPagePath, 'utf-8');
    const termsSource = readFileSync(termsPagePath, 'utf-8');
    expect(privacySource).toMatch(/getDictionary\(language\)\.privacyPage/);
    expect(termsSource).toMatch(/getDictionary\(language\)\.termsPage/);
  });

  it('both pages render the existing NavBar and Footer with the resolved language, matching the homepage convention', () => {
    const privacySource = readFileSync(privacyPagePath, 'utf-8');
    const termsSource = readFileSync(termsPagePath, 'utf-8');
    for (const source of [privacySource, termsSource]) {
      expect(source).toMatch(/<NavBar language=\{language\}/);
      expect(source).toMatch(/<Footer language=\{language\}/);
    }
  });

  it('neither page is a client component \u2014 static legal content does not need "use client"', () => {
    const privacySource = readFileSync(privacyPagePath, 'utf-8');
    const termsSource = readFileSync(termsPagePath, 'utf-8');
    expect(privacySource).not.toMatch(/'use client'/);
    expect(termsSource).not.toMatch(/'use client'/);
  });

  it('B2 pre-commit correction (Defect 2) — both pages render a visible "last updated" line immediately below the title, using the existing dictionary fields (lastUpdatedLabel and lastUpdatedDate), not a hardcoded or dynamically-generated date', () => {
    const privacySource = readFileSync(privacyPagePath, 'utf-8');
    const termsSource = readFileSync(termsPagePath, 'utf-8');
    for (const source of [privacySource, termsSource]) {
      expect(source).toMatch(/\{t\.lastUpdatedLabel\}: \{t\.lastUpdatedDate\}/);
      // Never Date.now()/new Date() — the effective date must be
      // static, not dynamically generated at render time.
      expect(source).not.toMatch(/new Date\(\)/);
    }
  });
});
