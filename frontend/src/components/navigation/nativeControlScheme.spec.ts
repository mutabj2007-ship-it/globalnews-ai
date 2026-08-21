import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * M66.8a — NATIVE CONTROL DARK COLOUR SCHEME.
 * **SUPERSEDED BY M66.11 — CUSTOM LANGUAGE SELECTOR (2026-08-20).**
 *
 * WHAT M66.8a DID, AND WHY IT IS RECORDED RATHER THAN ERASED.
 *
 * M66.8a added ONE declaration — `color-scheme: dark` on `:root` — because the
 * header language control was a native <select> whose dropped list the browser
 * paints outside the page's compositing tree, where no class can reach it. On
 * Windows/Chrome that surface rendered white on a dark application.
 *
 * That mitigation was integrated and then FAILED visual acceptance in the CTO's
 * own browser. That failure is what authorized M66.11 to remove the native
 * control entirely and author the popup instead. The milestone was not wrong —
 * it was the correct move given the design contract that existed at the time,
 * and it produced the evidence that a rebuild was necessary.
 *
 * This file therefore keeps M66.8a's history rather than deleting it, in three
 * parts:
 *
 *   1. WHAT M66.8a BUILT AND M66.11 KEEPS — the `color-scheme` declaration
 *      itself, asserted exactly as before. CTO decision 2 retains it: it was
 *      never select-specific. It targets `:root` and governs UA-owned
 *      scrollbars, the canvas backdrop and the four OTHER native controls in
 *      this application (the Hero textarea, the search-workspace input, the
 *      country search box, the workspace input). GN-CD-M66.11 §14's "delete the
 *      mitigation" instruction is right about the <select> and over-broad about
 *      a document-root declaration: deleting it would return the document
 *      scrollbar and the over-scroll backdrop to the light UA palette on a
 *      `bg-void` application — a regression on the exact platform this work
 *      exists to fix.
 *
 *   2. WHAT M66.11 REVERSED — the "the native control was retained" guards are
 *      gone, because the premise is gone. They are NOT merely deleted: each has
 *      a positive M66.11 counterpart in languageSelector.spec.ts, named below.
 *
 *   3. THE CONTRACTS THAT SURVIVED THE REVERSAL — the rules M66.8a was actually
 *      protecting, which were never about the <select> at all, re-asserted
 *      against the new architecture.
 *
 * WHAT THIS FILE STILL CANNOT PROVE. The same limit M66.8a recorded, for the
 * same reason: what a browser paints is not assertable from source. M66.8a
 * could not prove the native popup went dark; M66.11 cannot prove the authored
 * popup renders correctly on Windows/Chrome. Both are real-browser acceptance
 * items for the CTO, and both are recorded as such.
 */

const globalsCss = readFileSync(join(__dirname, '../../app/globals.css'), 'utf-8');
const selectorSource = readFileSync(join(__dirname, '../search/LanguageSelector.tsx'), 'utf-8');
const navBarSource = readFileSync(join(__dirname, 'NavBar.tsx'), 'utf-8');
const languagesSource = readFileSync(join(__dirname, '../../lib/i18n/languages.ts'), 'utf-8');

/**
 * Every negative guard in this file runs against comment-stripped source.
 * This milestone's own doc comments discuss listboxes, comboboxes and
 * `<select>` by name in order to explain why they are absent; a guard that
 * read raw source would trip on the explanation rather than on an
 * implementation. Established discipline — M66.6 and M66.7 both hit exactly
 * this trap.
 */
function stripJs(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function stripCss(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

const selectorCode = stripJs(selectorSource);
const navBarCode = stripJs(navBarSource);
const globalsCode = stripCss(globalsCss);

describe('M66.8a — the declaration itself', () => {
  it('globals.css declares color-scheme: dark exactly once, outside any comment', () => {
    const matches = globalsCode.match(/color-scheme\s*:\s*dark\s*;/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('it is the plain `dark` keyword — not `only dark`, not a light/dark pair', () => {
    const declaration = /color-scheme\s*:\s*([^;]+);/.exec(globalsCode)?.[1]?.trim();
    expect(declaration).toBe('dark');
  });

  it('the declaration is part of the base application styling, not a scoped or component layer', () => {
    // It must live inside an `@layer base` block. Anything else would make it
    // a component/utility-layer rule that could lose to Tailwind's own
    // preflight ordering, or scope it to a surface rather than the document.
    const declarationIndex = globalsCode.search(/color-scheme\s*:\s*dark\s*;/);
    expect(declarationIndex).toBeGreaterThan(-1);

    const openLayers = (globalsCode.slice(0, declarationIndex).match(/@layer base \{/g) ?? []).length;
    const closedBefore = (globalsCode.slice(0, declarationIndex).match(/^\}/gm) ?? []).length;
    expect(openLayers).toBeGreaterThan(closedBefore);
  });

  it('it targets the document root, so every route and every native control inherits it', () => {
    // `:root` is the document element. Scoping this to `.cd-canvas` would fix
    // the homepage and leave the six undesigned routes — /search, /map,
    // /history, /workspace, /privacy, /terms — with the light popup, and the
    // search page renders this same selector.
    const rootBlock = /:root\s*\{[^}]*color-scheme\s*:\s*dark\s*;[^}]*\}/.exec(globalsCode);
    expect(rootBlock).not.toBeNull();
    expect(globalsCode).not.toMatch(/\.cd-canvas[^{]*\{[^}]*color-scheme/);
  });

  it('it is additive — the pre-existing foundation rules are all still present', () => {
    // The same four rules M66.1 pinned. If this milestone had rewritten the
    // base layer rather than appending to it, one of these would be gone.
    expect(globalsCss).toMatch(/:focus-visible \{\s*outline: 2px solid #6c93ff;\s*outline-offset: 2px;/);
    expect(globalsCss).toMatch(/::selection \{\s*background-color: rgba\(61, 111, 255, 0\.35\);/);
    expect(globalsCss).toMatch(/\*,\s*\*::before,\s*\*::after \{\s*animation-duration: 0\.01ms !important;/);
    expect(globalsCss).toMatch(/html \{\s*scroll-behavior: smooth;/);
    // And the M66.1 Claude Design foundation below it is untouched.
    expect(globalsCss).toMatch(/--cd-edge-focus: rgba\(34, 211, 238, 0\.7\);/);
    expect(globalsCss).toMatch(/\.cd-canvas :focus-visible \{\s*outline: 2px solid var\(--cd-edge-focus\);/);
  });

  it('no other colour-scheme mechanism was introduced — the CSS declaration is the whole change', () => {
    // A <meta name="color-scheme">, a Next.js `colorScheme` metadata field or
    // a `colorScheme` prop on <html> would be a second, competing source of
    // truth for the same thing.
    const layoutSource = readFileSync(join(__dirname, '../../app/layout.tsx'), 'utf-8');
    expect(layoutSource).not.toMatch(/colorScheme/);
    expect(layoutSource).not.toMatch(/color-scheme/);
    expect(layoutSource).toMatch(/<html lang=\{language\} className=\{fontVariables\}>/);
  });
});

describe('M66.11 — what M66.8a asserted, and what replaced it', () => {
  it('the native <select> and its <option> children are GONE — M66.8a\'s retention guard is reversed', () => {
    // M66.8a asserted `selectorCode` matched /<select\b/ and /<option\b/, because
    // retaining the native control WAS the milestone. M66.11 removes it under
    // GN-CD-M66.11 §14. The positive form of this assertion — the button,
    // listbox and option roles that replaced it — lives in
    // src/components/search/languageSelector.spec.ts.
    expect(selectorCode).not.toMatch(/<select\b/);
    expect(selectorCode).not.toMatch(/<option\b/);
    expect(navBarCode).not.toMatch(/<select\b/);
  });

  it('the custom combobox/listbox M66.8a forbade is now REQUIRED and present', () => {
    // M66.8a's forbidden-pattern loop existed because GN-CD-026 authored the
    // closed trigger and nothing else — "the dropdown does not exist" — so
    // there was no design contract to build a popup against. GN-CD-M66.11 is
    // that contract, and it prescribes exactly one pattern.
    expect(selectorCode).toMatch(/role="combobox"/);
    expect(selectorCode).toMatch(/role="listbox"/);
    expect(selectorCode).toMatch(/role="option"/);
    expect(selectorCode).toMatch(/aria-expanded/);
    expect(selectorCode).toMatch(/aria-activedescendant/);
  });

  it('the popup state and outside-click machinery M66.8a forbade are present, and cleaned up', () => {
    // M66.8a asserted the selector had NO useState/useRef/useEffect. All three
    // are now required by the state machine, and the listener they carry has
    // the mandatory teardown.
    expect(selectorCode).toMatch(/useState/);
    expect(selectorCode).toMatch(/useRef/);
    expect(selectorCode).toMatch(/useEffect/);
    expect(selectorCode).toMatch(/document\.addEventListener\('pointerdown'/);
    expect(selectorCode).toMatch(/document\.removeEventListener\('pointerdown'/);
  });

  it('the accessible name survived the element change — it is composed now, not a bare label', () => {
    // M66.8a asserted `aria-label={label}` on the <select> plus a wrapping
    // <label>. A <button> cannot be labelled by a wrapping <label>, so
    // GN-CD-M66.11 §7 prescribes a composed name instead. The control is still
    // named, and still named from localized strings.
    expect(selectorCode).toMatch(/aria-label=\{triggerName\}/);
    expect(selectorCode).toMatch(/const triggerName = /);
    expect(selectorCode).not.toMatch(/<label /);
  });

  it('the M66.1 / GN-CD-306 §W focus contract moved to the button and was not dropped', () => {
    // M66.8a asserted the focus-visible treatment on NavBar's selectClassName.
    // That string is gone with the <select>; the RULE — outline suppression is
    // permitted only alongside an explicit replacement indicator — is intact,
    // now declared on the trigger itself.
    expect(selectorCode).toMatch(/focus:outline-none/);
    expect(selectorCode).toMatch(/focus-visible:outline-cd-edge-focus/);
  });
});

describe('M66.11 — the M66.8a contracts that survive unchanged', () => {
  it('SURVIVES — ACTIVE_LANGUAGES remains the single source of the available languages', () => {
    expect(selectorCode).toMatch(
      /import \{ ACTIVE_LANGUAGES, LANGUAGE_NATIVE_LABELS \} from '@\/lib\/i18n\/languages'/,
    );
    expect(selectorCode).toMatch(/ACTIVE_LANGUAGES\.map\(/);
    expect(selectorCode).toMatch(/LANGUAGE_NATIVE_LABELS\[code\]/);
    // languages.ts is untouched by M66.11 and is still the only definition.
    expect(languagesSource).toMatch(/export const ACTIVE_LANGUAGES: LanguageCode\[\] = \['en', 'pl'\];/);
    expect(languagesSource).toMatch(/en: 'English',/);
    expect(languagesSource).toMatch(/pl: 'Polski',/);
    // And neither file hardcodes a language NAME — the guard that most needed to
    // survive a rebuild, because a hand-authored popup is exactly where "just
    // type the two labels" becomes tempting.
    expect(selectorCode).not.toMatch(/'English'|'Polski'/);
    expect(navBarCode).not.toMatch(/'English'|'Polski'/);
  });

  it('SURVIVES — persistence and the server refresh still run, and still belong to the caller', () => {
    expect(navBarCode).toMatch(/function handleLanguageChange\(next: LanguageCode\): void \{/);
    expect(navBarCode).toMatch(/if \(next === language\) return;/);
    expect(navBarCode).toMatch(/persistLanguageSelection\(next\);/);
    expect(navBarCode).toMatch(/router\.refresh\(\);/);
    // The control still owns none of it.
    expect(selectorCode).not.toMatch(/persistLanguageSelection|localStorage|document\.cookie/);
  });

  it('SURVIVES — desktop and mobile still share ONE selector implementation', () => {
    const mounts = navBarSource.match(/<LanguageSelector/g) ?? [];
    expect(mounts).toHaveLength(2);
    expect(navBarCode).toMatch(
      /import \{ LanguageSelector \} from '@\/components\/search\/LanguageSelector'/,
    );
    // Two presentations of one component, switched by a prop — never a second
    // implementation. This is the rule M66.11 was most able to break and did not.
    expect(navBarCode).toMatch(/variant="desktop"/);
    expect(navBarCode).toMatch(/variant="mobile"/);
    expect(navBarCode).not.toMatch(/<select\b/);
  });

  it('SURVIVES — color-scheme: dark is still declared, and M66.11 did not remove it', () => {
    // CTO decision 2. Asserted here as well as in the first describe above,
    // because the reason it survives is now a M66.11 decision rather than a
    // M66.8a one, and a future reader needs to find that reason from either end.
    expect(globalsCode).toMatch(/color-scheme\s*:\s*dark\s*;/);
    expect(globalsCode.match(/color-scheme\s*:\s*dark\s*;/g) ?? []).toHaveLength(1);
  });
});

describe('M66.8a — scope discipline', () => {
  it('this milestone touched nothing outside the language-popup problem', () => {
    // Guards against scope creep into the seven items the authorization
    // explicitly reserves for later milestones. If a future edit widens
    // M66.8a, one of these fails.
    expect(globalsCode).not.toMatch(/HomepageSituationMap|HowItWorks|VIEW ALL/);
    // The footer alignment (M66.7-DEFERRED-001) is M66.8b, not this one.
    expect(globalsCode).not.toMatch(/max-w-cd-page/);
    // No Claude Design token was added or repointed by this milestone.
    const cdProperties = globalsCss.match(/--cd-[a-z-]+:/g) ?? [];
    expect(cdProperties).toHaveLength(7);
  });
});
