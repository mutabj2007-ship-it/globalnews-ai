import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASK_LIGHT_PAGE, ASK_NAVY_PAGE, askThemeColor, parseAskThemePreference } from './askTheme';

/** ASK DESIGN AUTHORITY R3 — CTO THEME RULING. */
describe('standalone Ask theme: Light by default, a saved preference still wins', () => {
  it('no stored preference opens the Light Design (not the OS scheme)', () => {
    expect(parseAskThemePreference(undefined)).toBe('light');
    expect(parseAskThemePreference(null)).toBe('light');
    expect(parseAskThemePreference('')).toBe('light');
  });

  it('a malformed cookie is not a preference: Light', () => {
    expect(parseAskThemePreference('purple')).toBe('light');
  });

  it('every explicitly saved preference wins — Dark stays the supported alternate', () => {
    expect(parseAskThemePreference('dark')).toBe('dark');
    expect(parseAskThemePreference('light')).toBe('light');
    expect(parseAskThemePreference('system')).toBe('system');
    expect(parseAskThemePreference('scheduled.0700-1900')).toBe('scheduled');
  });

  it('the browser chrome colour matches the treatment', () => {
    expect(askThemeColor('light')).toBe(ASK_LIGHT_PAGE);
    expect(askThemeColor('dark')).toBe(ASK_NAVY_PAGE);
    expect(askThemeColor('system')).toEqual([
      { media: '(prefers-color-scheme: light)', color: ASK_LIGHT_PAGE },
      { media: '(prefers-color-scheme: dark)', color: ASK_NAVY_PAGE },
    ]);
  });

  it('every Ask-shell page and the standalone root read it; the platform Home does not', () => {
    const app = join(__dirname, '..', '..', 'app');
    for (const page of ['ask', 'ask/recent', 'account/settings', 'cookies', 'privacy', 'saved', 'saved/briefing', 'support']) {
      const source = readFileSync(join(app, page, 'page.tsx'), 'utf8');
      expect(source).toContain('parseAskThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)');
      expect(source).toMatch(/export function generateViewport\(\): Viewport/);
    }
    const root = readFileSync(join(app, 'page.tsx'), 'utf8');
    expect(root).toContain('const askTheme = parseAskThemePreference(');
    expect(root).toMatch(/if \(!standaloneAskRoot\(\)\) return \{\};/);
    /* the platform Home R1 keeps the platform parser */
    expect(root).toContain('theme={parseThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)}');
  });
});
