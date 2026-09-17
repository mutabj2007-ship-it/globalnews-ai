import { readFileSync } from 'fs';
import { join } from 'path';

import { ACTIVE_LANGUAGES, LANGUAGE_NATIVE_LABELS } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT F — SPATIAL GLOBAL UX
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MAP-GLOBAL-LANGUAGE-CONTROL-1 · MAP-GLOBAL-NAVIGATION-ESCAPE-1 ·
 * SPATIAL-BRAND-MARK-1 (review only).
 *
 * ─── THE CAUSE BOTH ITEMS SHARE ───────────────────────────────────────────
 *
 * The Spatial shell mounts NO product NavBar at any width. C-O ruled that a
 * second bar above a full-screen composition duplicates the brand and costs the
 * map a tenth of the screen, which is right — and the NavBar was also the only
 * language control AND the only route off the page. Removing it correctly
 * removed two things it was not meant to take with it.
 *
 * ─── MAP-GLOBAL-NAVIGATION-ESCAPE-1 · ALREADY CORRECTED ───────────────────
 *
 * The brand mark is already an anchor to the homepage, on both the desktop HUD
 * and the mobile shell, with the exit stated in its accessible name. Guarded
 * here so it cannot silently revert to a `<div>` and strand the surface again.
 *
 * PREVIOUS VIEW IS NOT TOUCHED. The ruling is explicit — *"Do not repurpose
 * PREVIOUS VIEW; it is map-history navigation"* — so the escape is the brand
 * mark, and the two remain different affordances answering different questions:
 * one leaves the product surface, the other steps back through the map's own
 * history.
 *
 * ─── MAP-GLOBAL-LANGUAGE-CONTROL-1 · CORRECTED HERE ───────────────────────
 *
 * There was no EN/PL control anywhere on the map. The route RESOLVES the
 * language server-side from the cookie and a reader could never CHANGE it: a
 * bilingual product with one page you cannot switch.
 *
 * WHY NOT THE RELEASED LanguageSelector. It is Claude Design chrome
 * (GN-CD-M66.11) with two accepted variants built from `cd-*` tokens — a 9 px
 * pill, a 13 px label, a 168 px popup, 40 px rows. The HUD is a 44 px mono bar
 * in `sp-*` tokens. Hosting it would need a THIRD variant of a released
 * component, which is inventing chrome.
 *
 * WHAT WAS DONE INSTEAD. The ruling permits *"improve information hierarchy
 * using accepted semantic grammar only"*. The period chips in this same bar are
 * already a segmented radiogroup — one hairline border, 1 px gaps, 9.5 px mono,
 * the ACTIVE and AVAILABLE bands. Language is the same kind of choice, so it
 * takes the same form. No token, radius, size or colour is introduced.
 *
 * ─── SPATIAL-BRAND-MARK-1 · REVIEWED, NOT CHANGED ─────────────────────────
 *
 * *"Do not invent new branding without inspecting accepted Claude H / Claude
 * Design contracts."* The mark is the prototype's own `● GLOBALNEWS AI ·
 * SPATIAL INTELLIGENCE` in its own position, and nothing here alters its dot,
 * its words, its spacing or its colours. The only change it has ever taken is
 * becoming an anchor, which is what a brand mark in a product header does.
 */

const stripComments = (src: string): string =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const shellSrc = (name: string): string =>
  stripComments(readFileSync(join(__dirname, 'shell', name), 'utf-8'));

const topBar = shellSrc('MapHudTopBar.tsx');
const control = shellSrc('MapLanguageControl.tsx');
const globalShell = stripComments(
  readFileSync(join(__dirname, 'shell', 'GlobalMapShell.tsx'), 'utf-8'),
);
const mapRoute = stripComments(
  readFileSync(join(__dirname, '..', '..', 'app', 'map', 'page.tsx'), 'utf-8'),
);

describe('F — MAP-GLOBAL-NAVIGATION-ESCAPE-1, already corrected and now guarded', () => {
  it('the brand mark is a link to the product home, not a div', () => {
    expect(topBar).toContain('data-gn="hud-brand"');
    expect(topBar).toContain('href="/"');
  });

  it('and it says where it goes, rather than relying on a logo being obvious', () => {
    expect(topBar).toContain('aria-label={`${labels.brand} — ${labels.brandHome}`}');
    expect(getDictionary('en').map.spatial.topBar.brandHome.length).toBeGreaterThan(0);
    expect(getDictionary('pl').map.spatial.topBar.brandHome.length).toBeGreaterThan(0);
  });

  it('the route really does withhold the NavBar, which is why the escape matters', () => {
    /* If this stopped being true the brand-mark exit would be redundant rather than load-bearing. */
    expect(mapRoute).toContain('{spatial ? null : <NavBar language={language} />}');
  });

  it('PREVIOUS VIEW is not repurposed as the product escape', () => {
    /*
      CTO: "Do not repurpose PREVIOUS VIEW; it is map-history navigation." The
      escape lives on the brand mark, and nothing routes off the product from
      the camera controls.
    */
    expect(topBar).not.toContain('previousView');
  });
});

describe('F — MAP-GLOBAL-LANGUAGE-CONTROL-1, the map can change language', () => {
  describe('THE CONTROL EXISTS AND IS WIRED', () => {
    it('the bar takes a language slot', () => {
      expect(topBar).toContain('readonly languageSlot?: ReactNode;');
      expect(topBar).toContain('data-gn="hud-language-slot"');
    });

    it('and the shell fills it with the map language control', () => {
      expect(globalShell).toContain('<MapLanguageControl');
      expect(globalShell).toContain('value={language}');
    });

    it('it offers exactly the product’s active languages', () => {
      expect(control).toContain('ACTIVE_LANGUAGES.map((code)');
      expect([...ACTIVE_LANGUAGES]).toEqual(['en', 'pl']);
    });
  });

  describe('ONE PERSISTENCE PATH, NOT A SECOND ONE', () => {
    it('the shell writes through the same helper the NavBar uses', () => {
      expect(globalShell).toContain('persistLanguageSelection(next);');
      expect(globalShell).toContain('router.refresh();');
    });

    it('and the control itself holds no cookie, storage, router or fetch', () => {
      /*
        The released LanguageSelector keeps persistence entirely in its caller.
        This follows that rule, so the product has ONE place where a language
        selection is written.
      */
      expect(control).not.toContain('document.cookie');
      expect(control).not.toContain('localStorage');
      expect(control).not.toContain('useRouter');
      expect(control).not.toMatch(/\bfetch\(/);
      expect(control).not.toContain('persistLanguageSelection');
    });

    it('re-selecting the current language is a no-op', () => {
      /* Otherwise every click would write a cookie and refresh the route. */
      expect(control).toContain('if (code === value) return;');
    });

    it('the map holds no language state of its own — the cookie stays the truth', () => {
      expect(globalShell).not.toContain('useState<LanguageCode>');
    });
  });

  describe('ACCEPTED GRAMMAR ONLY — NOTHING NEW IS DRAWN', () => {
    it('it is a segmented radiogroup, exactly like the period chips beside it', () => {
      expect(control).toContain('role="radiogroup"');
      expect(control).toContain('role="radio"');
      expect(control).toContain('aria-checked={active}');
    });

    it('and carries the period chips’ own class string, unchanged', () => {
      const chipClasses =
        'shrink-0 border-transparent px-[9px] py-[6px] font-gn-mono text-[9.5px] tracking-[0.1em]';

      expect(topBar).toContain(chipClasses);
      expect(control).toContain(chipClasses);
    });

    it('it reuses the shared control bands rather than naming colours', () => {
      expect(control).toContain('BAND_ACTIVE');
      expect(control).toContain('BAND_AVAILABLE');
      expect(control).not.toMatch(/#[0-9a-fA-F]{6}/);
    });

    it('and introduces no third variant of the released selector', () => {
      expect(control).not.toContain('LanguageSelector');
      expect(control).not.toMatch(/\bcd-/);
    });
  });

  describe('THE LABELS COME FROM THE LANGUAGE MODEL, NEVER FROM LITERALS', () => {
    it('no endonym is written out in the component', () => {
      /* The same rule the released selector keeps. */
      expect(control).not.toContain("'English'");
      expect(control).not.toContain("'Polski'");
      expect(control).toContain('LANGUAGE_NATIVE_LABELS[code]');
    });

    it('the chip shows the code and the accessible name carries the endonym', () => {
      /*
        A 44 px bar has room for "EN"; nobody should have to know that EN means
        English to use it.
      */
      expect(control).toContain('{code.toUpperCase()}');
      expect(control).toContain('aria-label={LANGUAGE_NATIVE_LABELS[code]}');
      expect(LANGUAGE_NATIVE_LABELS.pl).toBe('Polski');
    });

    it('the group is named in both languages', () => {
      expect(getDictionary('en').map.spatial.topBar.languageGroup).toBe('Language');
      expect(getDictionary('pl').map.spatial.topBar.languageGroup).toBe('Język');
    });
  });
});

describe('F — SPATIAL-BRAND-MARK-1, reviewed and deliberately unchanged', () => {
  it('the mark is still the prototype’s dot, words and sub-label', () => {
    expect(topBar).toContain('{labels.brand}');
    expect(topBar).toContain('{labels.brandSub}');
    expect(getDictionary('en').map.spatial.topBar.brand).toBe('GlobalNews AI');
  });

  it('no new brand string was invented for the map', () => {
    /*
      CTO: "Do not invent new branding without inspecting accepted Claude H /
      Claude Design contracts." Every word here comes from the dictionary the
      accepted composition already declares.
    */
    expect(topBar).not.toMatch(/>[^<{]*GlobalNews[^<}]*</);
  });

  it('and the language control did not add a second mark', () => {
    expect(control).not.toContain('brand');
  });
});
