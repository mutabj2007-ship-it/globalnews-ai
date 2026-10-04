import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ACTIVE_LANGUAGES } from './languages';

/**
 * T2 · ONE AUTHORITY. No route, layout or component decides the display locale with the EN/PL
 * source-language gate any more; every Server Component reads it through
 * `displayLocale.server.ts` and the effective-locale rule.
 *
 * The only remaining readers of the old gate are route files T2 is forbidden to edit
 * (HUMANITARIAN-protected / H+R4). They are listed here by name so the list can only shrink:
 * a new importer fails this suite.
 */
const SRC = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(name) && !/\.spec\.ts$/.test(name)) out.push(path);
  }
  return out;
}

const FILES = sourceFiles(SRC).map((path) => ({
  path: relative(SRC, path).replace(/\\/g, '/'),
  code: readFileSync(path, 'utf8'),
}));

/** Protected files T2 may not modify (protected-files.tsv) that still read the old gate. */
const PROTECTED_GATE_READERS = ['app/humanitarian/compact/page.tsx', 'app/humanitarian/page.tsx', 'app/page.tsx'];

/** Protected H+R4 route that still reads the cookie itself (resolveAskLocale — all seven, no clamp). */
const PROTECTED_COOKIE_READERS = [...PROTECTED_GATE_READERS, 'app/account/settings/page.tsx'];

describe('T2 · no display path imports the EN/PL gate', () => {
  it('isActiveLanguageCode is imported only by the protected route files (and defined in languages.ts)', () => {
    const importers = FILES.filter(
      (f) => f.path !== 'lib/i18n/languages.ts' && /\bisActiveLanguageCode\b/.test(f.code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')),
    ).map((f) => f.path);
    expect(importers.sort()).toEqual([...PROTECTED_GATE_READERS].sort());
  });

  it('no route reads the language cookie directly — they ask the display-locale authority', () => {
    const readers = FILES.filter((f) =>
      /cookies\(\)\.get\(LANGUAGE_COOKIE_NAME\)/.test(f.code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')),
    ).map((f) => f.path);
    expect(readers.sort()).toEqual([...PROTECTED_COOKIE_READERS].sort());
  });

  it('the retired en/pl client readers are gone from the codebase', () => {
    for (const f of FILES) {
      const code = f.code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/^\s*\*.*$/gm, '');
      expect([f.path, /\breadLanguageCookie\s*\(|\bdetectBrowserLanguage\s*\(/.test(code)]).toEqual([f.path, false]);
    }
  });

  it('LanguageSync and Hero reconcile through the authority (stored choice wins), never resolveInitialLanguage', () => {
    for (const path of ['components/i18n/LanguageSync.tsx', 'components/home/Hero.tsx']) {
      const code = readFileSync(join(SRC, path), 'utf8');
      expect(code).toContain('reconcileStoredDisplayLocale()');
      expect(code).not.toMatch(/resolveInitialLanguage\(\)/);
      expect(code).not.toMatch(/persistLanguageSelection\(resolved\)/);
    }
  });

  it('every non-protected route that used the gate now calls surfaceLocale(...) for its own surface', () => {
    const migrated: Record<string, string> = {
      'app/admin/layout.tsx': 'admin',
      'app/conflict/page.tsx': 'conflict',
      'app/cookies/page.tsx': 'cookies',
      'app/delivery-visual-preview/page.tsx': 'delivery',
      'app/delivery-visual-preview/compact/page.tsx': 'delivery',
      'app/economy-visual-preview/page.tsx': 'economy',
      'app/economy-visual-preview/compact/page.tsx': 'economy',
      'app/election-visual-preview/page.tsx': 'election',
      'app/election-visual-preview/compact/page.tsx': 'election',
      'app/energy/page.tsx': 'energy',
      'app/history/layout.tsx': 'history',
      'app/history/page.tsx': 'history',
      'app/imihigo/page.tsx': 'imihigo',
      'app/map/page.tsx': 'map',
      'app/market/page.tsx': 'market',
      'app/market/compact/page.tsx': 'market',
      'app/my-intelligence/layout.tsx': 'myIntelligence',
      'app/my-intelligence/page.tsx': 'myIntelligence',
      'app/not-found.tsx': 'failure',
      'app/politics-visual-preview/page.tsx': 'politics',
      'app/politics-visual-preview/compact/page.tsx': 'politics',
      'app/privacy/page.tsx': 'privacy',
      'app/search/page.tsx': 'search',
      'app/security-visual-preview/page.tsx': 'security',
      'app/security-visual-preview/compact/page.tsx': 'security',
      'app/source-policy/page.tsx': 'sourcePolicy',
      'app/support/page.tsx': 'support',
      'app/terms/page.tsx': 'terms',
      'app/third-party-notices/page.tsx': 'thirdPartyNotices',
      'app/workspace/page.tsx': 'workspace',
      'app/account/layout.tsx': 'accountSettings',
      'app/ask/page.tsx': 'askStandalone',
      'app/ask/recent/page.tsx': 'askRecent',
      'app/saved/page.tsx': 'saved',
      'app/saved/briefing/page.tsx': 'saved',
    };
    for (const [path, surface] of Object.entries(migrated)) {
      const code = readFileSync(join(SRC, path), 'utf8');
      expect([path, code.includes(`surfaceLocale('${surface}')`)]).toEqual([path, true]);
    }
  });

  it('every non-Ask language control shows the REQUESTED locale, so a declared fallback never hides or locks the choice', () => {
    for (const path of [
      'components/navigation/NavBar.tsx',
      'components/home/HomeLanguageControl.tsx',
      'components/map/shell/MapLanguageControl.tsx',
      'components/my-intelligence/workspace/WorkspaceNav.tsx',
    ]) {
      const code = readFileSync(join(SRC, path), 'utf8');
      expect([path, code.includes('useRequestedDisplayLocale(')]).toEqual([path, true]);
      expect([path, /if \(next === language\) return;|if \(code === value\) return;/.test(code)]).toEqual([path, false]);
    }
  });

  it('ACTIVE_LANGUAGES keeps its SOURCE meaning and is not the display registry', () => {
    expect(ACTIVE_LANGUAGES).toEqual(['en', 'pl']);
  });

  it('/history no longer hard-codes English', () => {
    const client = readFileSync(join(SRC, 'components', 'history', 'HistoryClient.tsx'), 'utf8');
    expect(client).not.toMatch(/>History</);
    expect(client).not.toMatch(/Sign in to see your saved question history\./);
    expect(client).toContain('<NavBar language={language} />');
    expect(client).toContain('<Footer language={language} />');
  });

  it('no product file imports the qualification tooling (it reads every catalogue to measure them)', () => {
    const importers = FILES.filter((f) => !f.path.startsWith('qualification/') && /from '@\/qualification\//.test(f.code)).map((f) => f.path);
    expect(importers).toEqual([]);
  });
});
