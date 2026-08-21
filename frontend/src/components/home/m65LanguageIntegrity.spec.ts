import { readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { ACTIVE_LANGUAGES } from '@/lib/i18n/languages';

const layoutSource = readFileSync(join(__dirname, '../../app/layout.tsx'), 'utf-8');
const pageSource = readFileSync(join(__dirname, '../../app/page.tsx'), 'utf-8');
const heroSource = readFileSync(join(__dirname, 'Hero.tsx'), 'utf-8');
const navBarSource = readFileSync(join(__dirname, '../navigation/NavBar.tsx'), 'utf-8');
const searchClientSource = readFileSync(join(__dirname, '../search/SearchPageClient.tsx'), 'utf-8');
const liveStatusSource = readFileSync(join(__dirname, '../../lib/liveStatus.ts'), 'utf-8');

/**
 * M65 — ONE coherent language model across the shell.
 *
 * The recovered archive contained real regressions here (a language
 * control that persisted but never refreshed the Server Component feed,
 * a render-time localStorage read, and a second hand-rolled control on
 * mobile). These guards exist so those regressions cannot reappear.
 */
describe('M65 — language propagates coherently through the shell', () => {
  it('<html lang> is driven by the real persisted language, not a static literal', () => {
    expect(layoutSource).toMatch(/<html lang=\{language\}/);
    expect(layoutSource).not.toMatch(/<html lang="en"/);
    expect(layoutSource).toMatch(/LANGUAGE_COOKIE_NAME/);
    expect(layoutSource).toMatch(/isActiveLanguageCode/);
  });

  it('the homepage passes ONE resolved language to every shell surface it renders', () => {
    for (const surface of ['NavBar', 'LiveStatusStrip', 'Hero', 'GlobalDevelopments', 'HowItWorks', 'TrustSection', 'Footer', 'MobileBottomNav']) {
      expect(pageSource).toMatch(new RegExp(`<${surface}[\\s\\S]{0,220}language=\\{language\\}`));
    }
  });

  it('changing the language refreshes the Server Components, so real data follows the selection', () => {
    expect(navBarSource).toMatch(/persistLanguageSelection\(next\)/);
    expect(navBarSource).toMatch(/router\.refresh\(\)/);
  });

  it('no shell component reads localStorage during render — that would desync server and client HTML', () => {
    for (const source of [navBarSource, heroSource]) {
      const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      // resolveInitialLanguage reads localStorage; it is legitimate only
      // inside an effect, never in the render path.
      const renderTimeCall = /const\s+\w+\s*=\s*typeof window !== 'undefined'\s*\?\s*resolveInitialLanguage\(\)/;
      expect(codeOnly).not.toMatch(renderTimeCall);
    }
  });

  it('Hero still performs the first-visit browser-language sync, inside an effect, and still refreshes when it diverges', () => {
    expect(heroSource).toMatch(/readLanguageCookie\(\) \?\? 'en'/);
    expect(heroSource).toMatch(/resolveInitialLanguage\(\)/);
    expect(heroSource).toMatch(/persistLanguageSelection\(resolved\)/);
    expect(heroSource).toMatch(/router\.refresh\(\)/);
  });

  it('there is exactly ONE visible language control in the shell — the header', () => {
    expect((navBarSource.match(/<LanguageSelector/g) ?? []).length).toBe(2); // desktop + mobile presentation of the same control
    expect(heroSource).not.toMatch(/<LanguageSelector/);
    expect(searchClientSource).not.toMatch(/<LanguageSelector/);
  });

  it('only the production-active languages are ever selectable', () => {
    expect(ACTIVE_LANGUAGES).toEqual(['en', 'pl']);
  });

  it('both status presentations compute their state from the SAME shared function', () => {
    expect(heroSource).toMatch(/resolveLiveStatus\(/);
    expect(liveStatusSource).toMatch(/export function resolveLiveStatus/);
    expect(readFileSync(join(__dirname, 'LiveStatusStrip.tsx'), 'utf-8')).toMatch(/resolveLiveStatus\(/);
  });

  it('every new M65 string exists and is genuinely translated in both languages', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    const heroKeys = ['credibilityMultiPerspective', 'dataStatusLabel', 'lastUpdatedLabel'] as const;
    for (const key of heroKeys) {
      expect(en.hero[key].length).toBeGreaterThan(0);
      expect(pl.hero[key].length).toBeGreaterThan(0);
      expect(pl.hero[key]).not.toBe(en.hero[key]);
    }
    expect(Object.keys(en.navBar.navItemLabels).sort()).toEqual(Object.keys(pl.navBar.navItemLabels).sort());
    expect(pl.navBar.languageSelectorLabel).not.toBe(en.navBar.languageSelectorLabel);
  });
});
