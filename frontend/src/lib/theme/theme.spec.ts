import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  THEME_COOKIE_NAME,
  parseThemePreference,
  readThemeCookie,
  resolveTheme,
  themeCookieString,
} from './theme';

/**
 * HOME R1 · DUAL THEME — Light / Dark / System (CTO product amendment).
 */
const SRC = join(__dirname, '..', '..');
const read = (...p: string[]): string => readFileSync(join(SRC, ...p), 'utf8');
const code = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('preference model', () => {
  it('defaults to System for missing / unknown values', () => {
    for (const v of [undefined, null, '', 'auto', 'night', 'LIGHT']) expect(parseThemePreference(v)).toBe('system');
    expect(parseThemePreference('dark')).toBe('dark');
  });

  it('System follows prefers-color-scheme; an explicit choice overrides it (no clock)', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(code(read('lib', 'theme', 'theme.ts'))).not.toMatch(/getHours|new Date|Date\.now/);
  });

  it('persists as ONE first-party, server-readable cookie (not httpOnly, Lax, one year)', () => {
    expect(themeCookieString('dark')).toBe(`${THEME_COOKIE_NAME}=dark; Path=/; Max-Age=31536000; SameSite=Lax`);
    expect(readThemeCookie(`a=1; ${THEME_COOKIE_NAME}=light; b=2`)).toBe('light');
    expect(readThemeCookie('a=1')).toBe('system');
  });
});

describe('switching is presentation only — zero network, zero AI, nothing reset', () => {
  const scopes = [{ dataset: { gnaTheme: 'system' } }, { dataset: { gnaTheme: 'system' } }];
  let cookieWrites: string[];
  const fetchSpy = jest.fn();
  beforeAll(() => {
    cookieWrites = [];
    (globalThis as unknown as { document: unknown }).document = {
      get cookie() {
        return cookieWrites.length === 0 ? '' : cookieWrites[cookieWrites.length - 1].split(';')[0];
      },
      set cookie(value: string) {
        cookieWrites.push(value);
      },
      querySelectorAll: () => scopes,
    };
    (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;
  });

  it('setting a theme writes the cookie, re-labels every scope in place, and fetches nothing', async () => {
    const { setThemePreference, resetThemeStoreForTest } = await import('./themeStore');
    resetThemeStoreForTest();
    setThemePreference('dark');
    expect(cookieWrites[cookieWrites.length - 1]).toBe(themeCookieString('dark'));
    expect(scopes.map((s) => s.dataset.gnaTheme)).toEqual(['dark', 'dark']);
    setThemePreference('system');
    expect(scopes.map((s) => s.dataset.gnaTheme)).toEqual(['system', 'system']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('structurally: the store and the control reach no API, analysis, Ask, router or storage', () => {
    for (const file of [['lib', 'theme', 'themeStore.ts'], ['components', 'platform', 'ThemeControl.tsx'], ['lib', 'theme', 'theme.ts']]) {
      expect(code(read(...file))).not.toMatch(/fetch\(|askV2Api|analyzeNews|accountFetch|useRouter|router\.|location\.|localStorage|sessionStorage|heldStories|clearAskSelection/);
    }
  });
});

describe('no theme flash — the first frame is already the reader’s theme', () => {
  it('the server reads the cookie and renders the scope with it', () => {
    const page = read('app', 'page.tsx');
    expect(page).toContain('theme={parseThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)}');
    const chrome = read('components', 'home', 'r1', 'HomeR1Chrome.tsx');
    expect(chrome).toMatch(/<ThemeScope initial=\{theme\} data-home-r1=""/);
    const scope = read('components', 'platform', 'ThemeControl.tsx');
    expect(scope).toMatch(/useThemePreference\(initial\)/);
  });

  it('System is resolved in CSS (prefers-color-scheme), so no script runs before paint', () => {
    const css = read('app', 'globals.css');
    expect(css).toMatch(/\[data-gna-theme='light'\],\s*\[data-gna-theme='system'\] \{\s*color-scheme: light;/);
    /* Dark scopes inherit the document's single `color-scheme: dark` (M66.8a pins it to one). */
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\) \{\s*\[data-gna-theme='system'\] \{\s*color-scheme: inherit;/);
    expect(css).toMatch(/\[data-gna-theme='dark'\] \{\s*\/\*/);
    expect(css.match(/color-scheme\s*:\s*dark\s*;/g) ?? []).toHaveLength(1);
  });

  it('both token sets carry the same names (one tree, two sets) and keep semantic colours', () => {
    const css = read('app', 'globals.css');
    const names = (block: string) => [...block.matchAll(/--gt-([a-zA-Z0-9]+):/g)].map((m) => m[1]);
    const light = css.slice(css.indexOf("[data-gna-theme='light'],"), css.indexOf("[data-gna-theme='dark'] {"));
    const dark = css.slice(css.indexOf("[data-gna-theme='dark'] {"), css.indexOf('@media (prefers-color-scheme: dark)', css.indexOf("[data-gna-theme='dark'] {")));
    expect(names(dark)).toEqual(names(light));
    for (const semantic of ['mint', 'violet', 'sandBg', 'sandBd', 'amberBd', 'amberInk']) expect(names(light)).toContain(semantic);
  });

  it('the Home R1 components carry no hard-coded colour — only the shared tokens', () => {
    for (const f of ['HomeR1Chrome.tsx', 'HomeR1Hero.tsx', 'HomeR1Stories.tsx', 'HomeR1World60.tsx', 'HomeR1Sections.tsx', 'HomeR1Compare.tsx', 'StoryCardActions.tsx']) {
      expect(`${f}: ${(code(read('components', 'home', 'r1', f)).match(/#[0-9a-fA-F]{6}\b/g) ?? []).join(',')}`).toBe(`${f}: `);
    }
  });

  it('the Standalone /ask carries no theme scope (its surface is unchanged by this tranche)', () => {
    for (const f of [['components', 'ask-frame', 'AskFrameScreen.tsx'], ['components', 'ask-nav', 'AskStandaloneRoot.tsx']]) {
      expect(read(...f)).not.toMatch(/data-gna-theme|ThemeScope|useThemePreference/);
    }
    /* Convergence: the dock is R2's; it takes the reader's theme only where the platform Home R1 is
       released (GNA_HOME_R1) and never on the Map. */
    const dock = read('components', 'ask', 'AskAiDock.tsx');
    expect(dock).toMatch(/data-gna-theme=\{themed && mapLayout === null \? themePreference : undefined\}/);
    expect(dock).toMatch(/const themed = usePlatformGates\(\)\.homeR1;/);
  });
});
