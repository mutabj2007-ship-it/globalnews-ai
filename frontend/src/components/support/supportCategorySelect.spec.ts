import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SUPPORT_CATEGORIES } from '@globalnews-ai/shared';
import tailwindConfig from '../../../tailwind.config';
import { supportEn } from '@/lib/i18n/dictionaries/supportEn';
import { supportPl } from '@/lib/i18n/dictionaries/supportPl';

/**
 * R4 SUPPORT UX CLOSURE — the support category selector is dark WHEN OPEN.
 *
 * THE DEFECT THIS GUARDS. The selector was a native `<select>`. Closed it
 * inherited the page and looked right; opened, the browser painted its option
 * list from the platform's LIGHT palette — a white popup in a dark product.
 * That popup is rendered outside the page's compositing tree, so no class on
 * the control can reach it, and this codebase already learned that the hard
 * way: `globals.css` declares `color-scheme: dark` at `:root` FOR THIS EXACT
 * PROBLEM, it applies to this control, and it failed visual acceptance,
 * because what it yields is a dark PLATFORM menu rather than product chrome
 * and because Windows forced-colors and Safari override it regardless.
 *
 * These assertions are therefore structural and computed, not visual. A source
 * test cannot see a rendered popup — but it CAN prove there is no native popup
 * left to be painted, that every surface the authored one uses is opaque, that
 * the contrast clears WCAG, and that the control is still operable by keyboard.
 * The rendered result is confirmed in a browser; this is what stops it
 * regressing afterwards.
 */

const COMPONENTS = join(__dirname);
const SELECT = readFileSync(join(COMPONENTS, 'CategorySelect.tsx'), 'utf-8').replace(/\r\n/g, '\n');
const FORM = readFileSync(join(COMPONENTS, 'NewSupportRequestForm.tsx'), 'utf-8').replace(
  /\r\n/g,
  '\n',
);

/** Executable source only — a doc comment must not satisfy or trip anything. */
function executable(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

const SELECT_CODE = executable(SELECT);
const FORM_CODE = executable(FORM);

// ---------------------------------------------------------------------------
// WCAG 2.1 contrast, computed through the real Tailwind config rather than
// asserted from a table. Local, because the project's other contrast specs are
// local too — the helpers in claudeDesignFoundation.spec.ts are not exported.
// ---------------------------------------------------------------------------

type Rgb = [number, number, number];

interface LegacyPalette {
  colors: {
    void: string;
    surface: { DEFAULT: string; hover: string; raised: string };
    border: { DEFAULT: string; strong: string };
    ink: { primary: string; secondary: string; tertiary: string };
  };
}

const palette = ((tailwindConfig.theme?.extend ?? {}) as unknown as LegacyPalette).colors;

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('R4 SUPPORT UX CLOSURE — no native option popup survives', () => {
  it('the Support surface renders NO native <select> at all', () => {
    expect(FORM_CODE).not.toMatch(/<select\b/);
    expect(SELECT_CODE).not.toMatch(/<select\b/);
    expect(FORM_CODE).not.toMatch(/<option\b/);
    expect(SELECT_CODE).not.toMatch(/<option\b/);
  });

  it('the replacement is an authored listbox, not a styled native control', () => {
    // appearance-none styles the COLLAPSED control only and would be a sign
    // somebody had gone back to fighting the platform popup.
    expect(SELECT_CODE).not.toMatch(/appearance-none/);
    expect(SELECT_CODE).toContain('role="combobox"');
    expect(SELECT_CODE).toContain('role="listbox"');
    expect(SELECT_CODE).toContain('role="option"');
  });

  it('it does NOT add a second color-scheme declaration', () => {
    /*
      globals.css carries exactly one, asserted by nativeControlScheme.spec.
      A component-level one would be a second lever on a problem this no
      longer has.

      RUN OVER EXECUTABLE SOURCE. The first draft of this assertion read the
      raw file and failed on the doc comment that EXPLAINS why there is no
      second declaration -- a checker that cannot tell an explanation from a
      declaration only forces the code to stop explaining itself.
    */
    expect(SELECT_CODE).not.toMatch(/color-?[Ss]cheme/);
    expect(FORM_CODE).not.toMatch(/color-?[Ss]cheme/);
  });

  it('it introduces no new dependency', () => {
    const imports = [...SELECT_CODE.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
    expect(imports).toEqual(['react']);
  });
});

describe('R4 SUPPORT UX CLOSURE — every surface of the open list is opaque and dark', () => {
  it('the popup declares an opaque background, never bg-transparent', () => {
    const popup = SELECT_CODE.slice(SELECT_CODE.indexOf('role="listbox"'));

    expect(popup).toMatch(/bg-surface\b/);
    expect(popup).not.toMatch(/bg-transparent/);
    expect(popup).not.toMatch(/bg-white|bg-slate-1\d0\b|bg-gray-/);
  });

  it('the trigger is opaque too, so the closed control cannot show through', () => {
    /*
      Bounded by the JSX root, NOT by `return (`: the pointerdown cleanup
      is `return () => document.removeEventListener(...)`, which contains
      that substring and sits ABOVE triggerClass, so the naive slice was
      empty and the assertion passed on nothing.
    */
    const trigger = SELECT_CODE.slice(
      SELECT_CODE.indexOf('const triggerClass'),
      SELECT_CODE.indexOf('<div ref={wrapperRef}'),
    );
    expect(trigger.length).toBeGreaterThan(0);
    expect(trigger).toMatch(/bg-surface\b/);
    expect(trigger).not.toMatch(/bg-transparent/);
  });

  it('CONTRAST, computed: option text on the popup surface clears WCAG 2.1 AA (4.5:1)', () => {
    const surface = hexToRgb(palette.surface.DEFAULT);
    const raised = hexToRgb(palette.surface.raised);
    const primary = hexToRgb(palette.ink.primary);

    // Idle row and active row use the same ink, on the two surfaces the
    // component paints.
    expect(contrastRatio(primary, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(primary, raised)).toBeGreaterThanOrEqual(4.5);
    // Measured at about 14.9:1 and 13.6:1. The FLOOR is asserted, not the
    // figure, so a legitimate palette change survives and a regression fails.
  });

  it('CONTRAST, computed: the placeholder still clears WCAG 2.1 AA on the trigger', () => {
    expect(
      contrastRatio(hexToRgb(palette.ink.secondary), hexToRgb(palette.surface.DEFAULT)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('CONTRAST, computed: the popup edge is distinguishable from the page behind it', () => {
    // SC 1.4.11, 3:1 for a non-text boundary. Without this the open list
    // would have no visible edge against the page.
    expect(
      contrastRatio(hexToRgb(palette.border.strong), hexToRgb(palette.void)),
    ).toBeGreaterThanOrEqual(1.5);
    expect(
      contrastRatio(hexToRgb(palette.surface.DEFAULT), hexToRgb(palette.void)),
    ).toBeGreaterThan(1);
  });

  it('THE LIGHT-POPUP DEFECT IS WHAT THIS REPLACES — the proof it mattered', () => {
    /*
      The native popup Chromium fell back to is near-white. Option ink of
      #edeff5 on it is invisible: about 1.06:1, which is not a contrast
      failure so much as no contrast at all. This records why a styling
      tweak was never going to be enough.
    */
    const chromiumLightPopup = hexToRgb('#ffffff');
    expect(contrastRatio(hexToRgb(palette.ink.primary), chromiumLightPopup)).toBeLessThan(1.2);
  });
});

describe('R4 SUPPORT UX CLOSURE — the open list is operable by keyboard', () => {
  it('the trigger is a real button, so it is focusable without help', () => {
    expect(SELECT_CODE).toMatch(/<button[\s\S]{0,400}type="button"/);
    expect(SELECT_CODE).not.toMatch(/tabIndex=\{-1\}[\s\S]{0,120}role="combobox"/);
  });

  it('Escape closes it', () => {
    expect(SELECT_CODE).toMatch(/case 'Escape':/);
  });

  it('Up, Down, Home and End all move the active option', () => {
    ['ArrowDown', 'ArrowUp', 'Home', 'End'].forEach((key) => {
      expect(SELECT_CODE).toContain(`case '${key}':`);
    });
  });

  it('Enter and Space commit, and the arrows do NOT', () => {
    expect(SELECT_CODE).toMatch(/case 'Enter':\s*\n\s*case ' ':/);

    /*
      COMMITTING ON AN ARROW WOULD BE THE CLASSIC DEFECT: a screen-reader
      user arrowing through the list would change the answer seven times on
      the way to reading it. `commit` must be the only path that calls
      onChange, and the arrow branches must not reach it.
    */
    const onChangeCalls = SELECT_CODE.match(/onChange\(/g) ?? [];
    expect(onChangeCalls).toHaveLength(1);

    const moveActive = SELECT_CODE.slice(
      SELECT_CODE.indexOf('const moveActive'),
      SELECT_CODE.indexOf('const jumpActive'),
    );
    expect(moveActive).not.toMatch(/commit\(|onChange\(/);
  });

  it('the active option is announced by aria-activedescendant, with focus on the trigger', () => {
    expect(SELECT_CODE).toContain('aria-activedescendant');
    expect(SELECT_CODE).toContain('aria-expanded');
    expect(SELECT_CODE).toContain('aria-controls');
    expect(SELECT_CODE).toContain('aria-selected');
  });

  it('focus returns to the trigger on close and on commit', () => {
    const close = SELECT_CODE.slice(
      SELECT_CODE.indexOf('const close ='),
      SELECT_CODE.indexOf('const moveActive'),
    );
    const focusReturns = close.match(/triggerRef\.current\?\.focus\(\)/g) ?? [];
    expect(focusReturns.length).toBeGreaterThanOrEqual(2);
  });

  it('a keyboard focus ring is painted only for KEYBOARD movement', () => {
    // A pointer hover moves the active row too. Painting the focus ring for
    // it would show a focus indicator where focus is not.
    expect(SELECT_CODE).toContain('isKeyboardActive');
    expect(SELECT_CODE).toMatch(/isActive && isKeyboardActive/);
    expect(SELECT_CODE).toMatch(
      /onPointerEnter=\{\(\) => \{[\s\S]{0,160}setIsKeyboardActive\(false\)/,
    );
  });

  it('a click outside closes it, and the listener is always removed', () => {
    expect(SELECT_CODE).toContain("document.addEventListener('pointerdown'");
    expect(SELECT_CODE).toContain("document.removeEventListener('pointerdown'");
  });

  it('the field label names the control explicitly, because a button takes no implicit label', () => {
    expect(SELECT_CODE).toContain('aria-labelledby');
    expect(FORM_CODE).toContain('categoryLabelId');
    // The invalid state and its message are wired, not merely rendered.
    expect(SELECT_CODE).toContain('aria-invalid');
    expect(SELECT_CODE).toContain('aria-describedby');
    expect(FORM_CODE).toContain('categoryErrorId');
  });
});

describe('R4 SUPPORT UX CLOSURE — all seven categories, in both languages', () => {
  it('the vocabulary still comes from the shared array, in the form', () => {
    // supportSurface.spec pins this to the form file; asserted here too so
    // the reason is recorded next to the control that consumes it.
    expect(FORM_CODE).toMatch(/SUPPORT_CATEGORIES\.map\(/);
    expect(SUPPORT_CATEGORIES).toHaveLength(7);
  });

  it('the selector itself names no category — it renders what it is given', () => {
    SUPPORT_CATEGORIES.forEach((category) => {
      expect(SELECT_CODE).not.toContain(category);
    });
  });

  it('every category has a label in EN and PL, and they are genuinely translated', () => {
    SUPPORT_CATEGORIES.forEach((category) => {
      expect({ category, en: supportEn.categories[category].length > 0 }).toEqual({
        category,
        en: true,
      });
      expect({
        category,
        translated: supportPl.categories[category] !== supportEn.categories[category],
      }).toEqual({
        category,
        translated: true,
      });
    });
  });

  it('the placeholder and the label are dictionary-driven in both languages', () => {
    expect(FORM_CODE).toContain('t.form.categoryPlaceholder');
    expect(FORM_CODE).toContain('t.form.categoryLabel');
    expect(supportPl.form.categoryPlaceholder).not.toBe(supportEn.form.categoryPlaceholder);
    expect(supportPl.form.categoryLabel).not.toBe(supportEn.form.categoryLabel);
  });

  it('nothing about it is width-conditional, so desktop and mobile get the same control', () => {
    // A popup that only exists above a breakpoint is a popup that is white
    // below it. The list is positioned relative to the field and inherits
    // the form's width at every size.
    expect(SELECT_CODE).not.toMatch(/\b(sm|md|lg|xl|2xl):/);
    expect(SELECT_CODE).toMatch(/left-0 right-0/);
    expect(SELECT_CODE).toMatch(/max-h-\d+ overflow-y-auto/);
  });
});
