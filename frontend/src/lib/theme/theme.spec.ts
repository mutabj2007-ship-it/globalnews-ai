import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_THEME_SCHEDULE,
  THEME_COOKIE_NAME,
  parseThemePreference,
  parseThemeSchedule,
  scheduleIsLightAt,
  readThemeCookie,
  resolveTheme,
  themeCookieString,
} from './theme';
import { SCHEDULE_BOOT_SCRIPT, msUntilNextBoundary } from './themeSchedule';

/**
 * HOME R1 · DUAL THEME — Light / Dark / System (CTO product amendment).
 */
const SRC = join(__dirname, '..', '..');
const read = (...p: string[]): string => readFileSync(join(SRC, ...p), 'utf8');
const code = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('preference model', () => {
  it('defaults to System for missing / unknown values', () => {
    for (const v of [undefined, null, '', 'auto', 'night', 'LIGHT'])
      expect(parseThemePreference(v)).toBe('system');
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
    expect(themeCookieString('dark')).toBe(
      `${THEME_COOKIE_NAME}=dark; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
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
    for (const file of [
      ['lib', 'theme', 'themeStore.ts'],
      ['components', 'platform', 'ThemeControl.tsx'],
      ['lib', 'theme', 'theme.ts'],
    ]) {
      expect(code(read(...file))).not.toMatch(
        /fetch\(|askV2Api|analyzeNews|accountFetch|useRouter|router\.|location\.|localStorage|sessionStorage|heldStories|clearAskSelection/,
      );
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
    expect(css).toMatch(
      /\[data-gna-theme='light'\],\s*\[data-gna-theme='system'\] \{\s*color-scheme: light;/,
    );
    /* Dark scopes inherit the document's single `color-scheme: dark` (M66.8a pins it to one). */
    expect(css).toMatch(
      /@media \(prefers-color-scheme: dark\) \{\s*html:not\(\[data-gna-schedule\]\) \[data-gna-theme='scheduled'\],\s*\[data-gna-theme='system'\] \{\s*color-scheme: inherit;/,
    );
    expect(css).toMatch(/\[data-gna-theme='dark'\] \{\s*\/\*/);
    expect(css.match(/color-scheme\s*:\s*dark\s*;/g) ?? []).toHaveLength(1);
  });

  it('both token sets carry the same names (one tree, two sets) and keep semantic colours', () => {
    const css = read('app', 'globals.css');
    const names = (block: string) => [...block.matchAll(/--gt-([a-zA-Z0-9]+):/g)].map((m) => m[1]);
    const light = css.slice(
      css.indexOf("[data-gna-theme='light'],"),
      css.indexOf("[data-gna-theme='dark'] {"),
    );
    const dark = css.slice(
      css.indexOf("[data-gna-theme='dark'] {"),
      css.indexOf('@media (prefers-color-scheme: dark)', css.indexOf("[data-gna-theme='dark'] {")),
    );
    expect(names(dark)).toEqual(names(light));
    for (const semantic of ['mint', 'violet', 'sandBg', 'sandBd', 'amberBd', 'amberInk'])
      expect(names(light)).toContain(semantic);
  });

  it('the Home R1 components carry no hard-coded colour — only the shared tokens', () => {
    for (const f of [
      'HomeR1Chrome.tsx',
      'HomeR1Hero.tsx',
      'HomeR1Stories.tsx',
      'HomeR1World60.tsx',
      'HomeR1Sections.tsx',
      'HomeR1Compare.tsx',
      'StoryCardActions.tsx',
    ]) {
      expect(
        `${f}: ${(code(read('components', 'home', 'r1', f)).match(/#[0-9a-fA-F]{6}\b/g) ?? []).join(',')}`,
      ).toBe(`${f}: `);
    }
  });

  /* TRUST & CONVERSATIONAL EXPERIENCE R1 (PO): the Standalone Ask now takes the SAME theme — one
     scope (AskThemedPage) shared by /ask and the standalone root, server-rendered from the cookie. */
  it('the Standalone /ask and root render ONE theme scope from the cookie (no flash)', () => {
    const themed = read('components', 'ask-nav', 'AskThemedPage.tsx');
    expect(themed).toMatch(/<ThemeScope[\s\S]*initial=\{theme\}[\s\S]*data-ask-standalone=""/);
    expect(read('components', 'ask-nav', 'AskStandaloneRoot.tsx')).toMatch(/<AskThemedPage/);
    const askPage = read('app', 'ask', 'page.tsx');
    expect(askPage).toMatch(/<AskThemedPage/);
    expect(askPage).toContain('parseThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)');
    /* the answer components themselves stay unforked: no theme logic inside the frame */
    expect(read('components', 'ask-frame', 'AskFrameScreen.tsx')).not.toMatch(
      /data-gna-theme|ThemeScope|useThemePreference/,
    );
    /* Convergence: the dock is R2's; it takes the reader's theme only where the platform Home R1 is
       released (GNA_HOME_R1) and never on the Map. */
    const dock = read('components', 'ask', 'AskAiDock.tsx');
    expect(dock).toMatch(
      /data-gna-theme=\{themed && mapLayout === null \? themePreference : undefined\}/,
    );
    expect(dock).toMatch(/const themed = usePlatformGates\(\)\.homeR1;/);
  });
});

describe('TRUST R1 — Scheduled day/night (device clock, no geolocation)', () => {
  it('parses and serialises the schedule in the one cookie', () => {
    expect(parseThemePreference('scheduled')).toBe('scheduled');
    expect(parseThemePreference('scheduled.0630-2015')).toBe('scheduled');
    expect(parseThemePreference('scheduled.2500-0100')).toBe('system');
    expect(parseThemeSchedule('scheduled.0630-2015')).toEqual({
      lightFrom: '06:30',
      darkFrom: '20:15',
    });
    expect(parseThemeSchedule('scheduled')).toEqual(DEFAULT_THEME_SCHEDULE);
    expect(parseThemeSchedule('scheduled.0700-0700')).toEqual(DEFAULT_THEME_SCHEDULE);
    expect(themeCookieString('scheduled', { lightFrom: '06:30', darkFrom: '20:15' })).toBe(
      `${THEME_COOKIE_NAME}=scheduled.0630-2015; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
  });

  it('light hours, including a schedule that wraps midnight', () => {
    const day = { lightFrom: '07:00', darkFrom: '19:00' };
    expect(scheduleIsLightAt(day, 6 * 60 + 59)).toBe(false);
    expect(scheduleIsLightAt(day, 7 * 60)).toBe(true);
    expect(scheduleIsLightAt(day, 18 * 60 + 59)).toBe(true);
    expect(scheduleIsLightAt(day, 19 * 60)).toBe(false);
    const night = { lightFrom: '22:00', darkFrom: '06:00' };
    expect(scheduleIsLightAt(night, 23 * 60)).toBe(true);
    expect(scheduleIsLightAt(night, 12 * 60)).toBe(false);
  });

  it('the pre-paint boot script agrees with the pure rule at every quarter hour (local clock)', () => {
    const sched = { lightFrom: '06:30', darkFrom: '20:15' };
    for (let m = 0; m < 1440; m += 15) {
      const attrs: Record<string, string> = {};
      class FakeDate extends Date {
        getHours(): number {
          return Math.floor(m / 60);
        }
        getMinutes(): number {
          return m % 60;
        }
      }
      new Function('document', 'Date', SCHEDULE_BOOT_SCRIPT)(
        {
          cookie: `x=1; ${THEME_COOKIE_NAME}=scheduled.0630-2015`,
          documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
        },
        FakeDate,
      );
      expect(attrs['data-gna-schedule']).toBe(scheduleIsLightAt(sched, m) ? 'light' : 'dark');
    }
  });

  it('the boot script does nothing for any other preference and requests nothing', () => {
    const attrs: Record<string, string> = {};
    new Function('document', SCHEDULE_BOOT_SCRIPT)({
      cookie: `${THEME_COOKIE_NAME}=dark`,
      documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
    });
    expect(attrs).toEqual({});
    expect(SCHEDULE_BOOT_SCRIPT).not.toMatch(
      /fetch|XMLHttpRequest|geolocation|sendBeacon|localStorage/,
    );
  });

  it('the next boundary is never in the past and at most a day away', () => {
    const sched = { lightFrom: '07:00', darkFrom: '19:00' };
    expect(msUntilNextBoundary(sched, new Date(2026, 9, 2, 18, 59, 30))).toBe(30_000);
    expect(msUntilNextBoundary(sched, new Date(2026, 9, 2, 19, 0, 0))).toBe(12 * 3_600_000);
  });

  it('only themeSchedule.ts reads the clock; the root layout injects its boot script in <head>', () => {
    expect(code(read('lib', 'theme', 'theme.ts'))).not.toMatch(/getHours|new Date|Date\.now/);
    expect(read('app', 'layout.tsx')).toMatch(
      /<head>[\s\S]*__html: SCHEDULE_BOOT_SCRIPT[\s\S]*<\/head>/,
    );
  });
});
