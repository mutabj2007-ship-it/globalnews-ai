import { readFileSync } from 'fs';
import { join } from 'path';
import { PRIVATE_ROUTES, PUBLIC_ROUTES } from '@/lib/seo/routes';

/**
 * ALPHA VISUAL ACCEPTANCE REPAIR R1 — I, J, K and the phone language popup, as source guards.
 * The runtime halves are rendered in askNavShellRuntime.spec.ts and proven in the browser.
 */
const src = join(__dirname, '..', '..');
const read = (...parts: string[]): string => readFileSync(join(src, ...parts), 'utf-8');
const code = (text: string): string =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const supportPage = read('app', 'support', 'page.tsx');
const supportScreen = read('components', 'support', 'SupportScreen.tsx');
const settingsPage = read('app', 'account', 'settings', 'page.tsx');
const settingsBody = read('components', 'account', 'AccountSettingsBody.tsx');
const settingsLayout = read('app', 'account', 'layout.tsx');
const dock = read('components', 'ask', 'AskAiDock.tsx');
const shell = read('components', 'ask-nav', 'AskNavShell.tsx');
const selector = read('components', 'search', 'LanguageSelector.tsx');
const cleanNav = read('lib', 'ask', 'askCleanNavigation.ts');

describe('I — Help & feedback stays inside standalone Ask', () => {
  it('standalone: the Ask shell + the Support body without platform chrome', () => {
    const body = code(supportPage);
    expect(body).toContain('if (standaloneAskRoot()) {');
    expect(body).toMatch(
      /<AskNavProvider>\s*<AskNavShell language=\{language\} \/>\s*<AskContinuityHeader locale=\{language\} surface="help" \/>\s*<AskClearedBoundary>\s*<SupportScreen t=\{resolveSupportDictionary\(\)\} language=\{language\} chrome="standalone" \/>/,
    );
    expect(body).not.toMatch(/NavBar/);
  });

  it('platform mode (GNA_PUBLIC_ROOT=platform) renders exactly as before', () => {
    expect(code(supportPage)).toContain(
      'return <SupportScreen t={resolveSupportDictionary()} language={language} />;',
    );
    expect(supportScreen).toContain("chrome = 'platform',");
    expect(code(supportScreen)).toContain("{chrome === 'platform' && <NavBar />}");
    expect(code(supportScreen)).toContain("{chrome === 'platform' && <Footer />}");
  });

  it('Support keeps its noindex metadata through the one builder', () => {
    expect(supportPage).toContain("path: '/support',");
    const entry = PRIVATE_ROUTES.find((r) => r.path === '/support');
    expect(entry?.indexability).toBe('noindex');
    expect(PUBLIC_ROUTES.some((r) => r.path === '/support')).toBe(false);
  });
});

describe('J — Settings stays inside standalone Ask, in the active language', () => {
  it('a server wrapper decides chrome and language; the client body holds the account logic', () => {
    expect(settingsPage).not.toMatch(/^'use client'/);
    /* R4 · CTO platform-settings rulings — Settings stays inside Ask in BOTH roots (Alpha runs
       GNA_PUBLIC_ROOT=platform): no platform presentation, no NavBar / Footer */
    expect(code(settingsPage)).not.toMatch(/standaloneAskRoot|chrome="platform"|NavBar|Footer/);
    /* R4 · the route no longer clamps. It resolves the reader's own locale once; the
       standalone chrome then reads one disposition. The property this asserted — the SERVER
       wrapper decides the language, not the client body — is unchanged and still asserted. */
    expect(code(settingsPage)).toContain(
      'resolveAskLocale(cookies().get(LANGUAGE_COOKIE_NAME)?.value)',
    );
    expect(code(settingsPage)).toMatch(
      /* R4 · CTO LOCALIZATION CONVERGENCE — the body now reads the reader's DisplayLocale
         (`locale`) through the Ask locale authority, inside the page's own direction scope;
         the legacy crossing that collapsed de / pt to English is gone. */
      /<AskContinuityHeader locale=\{chrome\} surface="settings" \/>\s*<AskClearedBoundary>[\s\S]*?<div className="contents" \{\.\.\.askDirectionProps\(chrome\)\}>\s*<AccountSettingsBody locale=\{chrome\} chrome="standalone" \/>/,
    );
    expect(code(settingsPage)).not.toMatch(/NavBar|Footer/);
  });

  it('the body no longer hard-codes English, and account deletion is unchanged', () => {
    expect(code(settingsBody)).not.toContain("getDictionary('en')");
    expect(code(settingsBody)).toContain('getDictionary(language)');
    expect(code(settingsBody)).toContain('<DeleteAccountDangerZone');
    expect(code(settingsBody)).toContain('onDelete={deleteAccount}');
    expect(code(settingsBody)).toContain('warning: dictionary.navBar.deleteAccountConfirm,');
  });

  it('Settings keeps its noindex metadata (layout untouched)', () => {
    expect(settingsLayout).toContain("path: '/account/settings',");
    expect(PRIVATE_ROUTES.find((r) => r.path === '/account/settings')?.indexability).toBe(
      'noindex',
    );
  });
});

describe('no platform Ask dock on standalone Help / Settings', () => {
  it('unmounts only when the standalone root is active', () => {
    const body = code(dock);
    expect(body).toContain("'/support',");
    expect(body).toContain("'/account/settings',");
    expect(body).toMatch(
      /props\.standaloneRoot === true &&\s*pathname !== null &&\s*ASK_STANDALONE_UTILITY_ROUTES\.has\(pathname\)/,
    );
  });
});

describe('K — the governed signed-out draft is a separate mechanism, untouched', () => {
  it('New question / Sign out never read, write or clear the kept question', () => {
    for (const file of [shell, cleanNav]) {
      expect(code(file)).not.toMatch(
        /ASK_KEPT_QUESTION|keepQuestion|readKeptQuestion|sessionStorage/,
      );
    }
  });
});

describe('H — the drawer language list is anchored to its own control', () => {
  it('the drawer passes anchor="self"; the platform default stays the header anchor', () => {
    expect(code(shell)).toMatch(/variant="mobile"\s*anchor="self"/);
    expect(code(selector)).toContain("anchor = 'header',");
    expect(code(selector)).toContain("const anchoredToSelf = isMobile && anchor === 'self';");
    expect(code(selector)).toContain("popupClass.replace('right-[12px]', 'left-0')");
    expect(code(selector)).toContain(
      "className={isMobile && !anchoredToSelf ? 'flex-none' : 'relative flex-none'}",
    );
  });

  it('Escape with the language list open closes the list, not the drawer', () => {
    expect(code(shell)).toContain("active.getAttribute('aria-expanded') === 'true'");
  });
});
