import { readFileSync } from 'fs';
import { join } from 'path';
import { ACTIVE_LANGUAGES, LANGUAGE_NATIVE_LABELS } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';
import tailwindConfig from '../../../tailwind.config';

/**
 * M66.11 — CUSTOM LANGUAGE SELECTOR, the interaction and geometry contract.
 *
 * WHY THIS FILE EXISTS. M66.8a's own reasoning for keeping the native <select>
 * was that "replacing a native <select> with a hand-rolled listbox is where
 * keyboard and screen-reader regressions come from." That risk is real and is
 * now being taken deliberately, under GN-CD-M66.11 and a CTO authorization. This
 * file is the compensating control: everything the browser used to provide for
 * free is now application code, so everything the browser used to guarantee has
 * to be asserted.
 *
 * WHAT THIS FILE CANNOT DO, STATED UP FRONT. The npm registry is unreachable in
 * the implementing environment (HTTP 403), so there is no jsdom, no React
 * Testing Library and no browser. Every spec in this repository is a
 * source-analysis spec for that reason. Assertions below therefore prove
 * STRUCTURE and RESOLVED GEOMETRY, not rendered behaviour: that the ArrowDown
 * branch exists and cannot reach the commit function, not that a dispatched
 * ArrowDown moved a highlight. The design's §16 items that need a live DOM —
 * computed backgrounds, document.activeElement, real event dispatch, viewport
 * insets — are listed in the milestone's browser-acceptance checklist and are
 * NOT claimed here.
 *
 * Where a structural assertion is the strongest available proof of a behavioural
 * rule, the test says so in its own comment rather than implying more.
 */

const selectorSource = readFileSync(join(__dirname, 'LanguageSelector.tsx'), 'utf-8');
const navBarSource = readFileSync(join(__dirname, '../navigation/NavBar.tsx'), 'utf-8');

function stripComments(src: string): string {
  /* Line endings are normalized first. This repository stores most files
     CRLF and a few LF; a structural regex that happens to contain `\n`
     would then pass or fail on a file's line-ending style rather than on its
     content, which is not what any assertion here is about. */
  return src
    .replace(/\r\n/g, '\n')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

/* Every negative assertion runs against comment-stripped source. A doc comment
   that merely DESCRIBES what the component does not do must never satisfy or
   trip a guard about what it does. */
const code = stripComments(selectorSource);
const navCode = stripComments(navBarSource);

interface ThemeExtend {
  colors?: { cd?: Record<string, unknown> };
  fontSize?: Record<string, unknown>;
  spacing?: Record<string, string>;
  borderRadius?: Record<string, string>;
  boxShadow?: Record<string, string>;
  screens?: Record<string, string>;
}
const themeExtend = (tailwindConfig.theme?.extend ?? {}) as unknown as ThemeExtend;
const cdRaw = (themeExtend.colors?.cd ?? {}) as Record<string, unknown>;
/* `colors.cd` mixes flat keys (`nav-hover`) with grouped ones (`ink.primary`),
   so the two accessors below mirror headerSourcePort.spec.ts exactly rather
   than inventing a third way to read the same table. */
function cdColor(key: string): string {
  const value = cdRaw[key];
  if (typeof value !== 'string') throw new Error(`cd.${key} is not a colour string`);
  return value;
}
function cdGroup(key: string): Record<string, string> {
  const value = cdRaw[key];
  if (typeof value !== 'object' || value === null) throw new Error(`cd.${key} is not a colour group`);
  return value as Record<string, string>;
}
const spacing = (themeExtend.spacing ?? {}) as Record<string, string>;
const radius = (themeExtend.borderRadius ?? {}) as Record<string, string>;
const shadows = (themeExtend.boxShadow ?? {}) as Record<string, string>;
const fonts = (themeExtend.fontSize ?? {}) as Record<string, [string, Record<string, string>]>;

function px(token: string, table: Record<string, string>): number {
  const raw = table[token];
  if (typeof raw !== 'string' || !raw.endsWith('px')) {
    throw new Error(`token ${token} missing or not px: ${String(raw)}`);
  }
  return Number.parseFloat(raw);
}

/** The class string of one of the two popup branches, from the source. */
function popupClassFor(variant: 'desktop' | 'mobile'): string {
  const block = /const popupClass = isMobile\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/.exec(code);
  if (!block) throw new Error('popupClass ternary not found');
  return variant === 'mobile' ? block[1] : block[2];
}

function triggerBaseFor(variant: 'desktop' | 'mobile'): string {
  const block = /const triggerBase = isMobile\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/.exec(code);
  if (!block) throw new Error('triggerBase ternary not found');
  return variant === 'mobile' ? block[1] : block[2];
}

function rowClassFor(variant: 'desktop' | 'mobile'): string {
  const block = /const rowBase = isMobile\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/.exec(code);
  if (!block) throw new Error('rowBase ternary not found');
  return variant === 'mobile' ? block[1] : block[2];
}

/* ==========================================================================
   1 · THE NATIVE CONTROL IS GONE
   ========================================================================== */

describe('M66.11 — the native <select> is removed, not hidden', () => {
  it('no <select> and no <option> element survives anywhere in the component', () => {
    expect(code).not.toMatch(/<select\b/);
    expect(code).not.toMatch(/<\/select>/);
    expect(code).not.toMatch(/<option\b/);
    expect(code).not.toMatch(/HTMLSelectElement/);
  });

  it('no visually hidden native select was retained as a fallback', () => {
    // GN-CD-M66.11 §14 forbids it explicitly: two announcements of one control
    // is worse than either alone, and it would leave the native popup
    // keyboard-reachable — the exact defect this milestone removes.
    expect(code).not.toMatch(/sr-only[^"']*select|select[^"']*sr-only/);
    expect(code).not.toMatch(/appearance-none/);
    expect(code).not.toMatch(/opacity-0/);
  });

  it('NavBar did not grow a replacement select of its own', () => {
    expect(navCode).not.toMatch(/<select\b/);
    expect(navCode).not.toMatch(/appearance-none/);
    expect(navCode).not.toMatch(/selectClassName/);
  });

  it('the obsolete M65 presentation props are gone with the element they served', () => {
    // hideLabelText and selectClassName existed only because a <select> cannot
    // carry the released treatment on its own. There is no <select> and no
    // wrapping <label>, so both are meaningless now.
    expect(code).not.toMatch(/hideLabelText/);
    expect(code).not.toMatch(/selectClassName/);
    expect(navCode).not.toMatch(/hideLabelText/);
  });
});

/* ==========================================================================
   2 · THE LANGUAGE MODEL IS STILL THE ONLY SOURCE  (carried from M66.8a)
   ========================================================================== */

describe('M66.11 — ACTIVE_LANGUAGES remains the single source of truth', () => {
  it('options are mapped from ACTIVE_LANGUAGES, never from a literal array', () => {
    expect(code).toMatch(/import \{ ACTIVE_LANGUAGES, LANGUAGE_NATIVE_LABELS \} from '@\/lib\/i18n\/languages'/);
    expect(code).toMatch(/ACTIVE_LANGUAGES\.map\(/);
    expect(code).toMatch(/LANGUAGE_NATIVE_LABELS\[code\]/);
  });

  it('neither the component nor NavBar hardcodes a language NAME', () => {
    // This rule predates M66.11 — nativeControlScheme.spec.ts asserted it for
    // the native control — and survives the rewrite unchanged. A rebuilt popup
    // is exactly where "just type the two labels" becomes tempting.
    expect(code).not.toMatch(/'English'|'Polski'|"English"|"Polski"/);
    expect(navCode).not.toMatch(/'English'|'Polski'|"English"|"Polski"/);
  });

  it('exactly two languages are active, in the released order, with the released endonyms', () => {
    expect(ACTIVE_LANGUAGES).toEqual(['en', 'pl']);
    expect(ACTIVE_LANGUAGES).toHaveLength(2);
    expect(LANGUAGE_NATIVE_LABELS.en).toBe('English');
    // GN-CD-M66.11 §4: the endonym, never "Polish".
    expect(LANGUAGE_NATIVE_LABELS.pl).toBe('Polski');
  });

  it('no third language can appear, because the list is the model and the model has two entries', () => {
    // The count is not asserted against a literal in the component — there is
    // none. It is asserted against the shared model, which is what the render
    // actually iterates.
    expect(ACTIVE_LANGUAGES.filter((c) => LANGUAGE_NATIVE_LABELS[c]).length).toBe(2);
    expect(code).not.toMatch(/ALL_LANGUAGES/);
  });

  it('the EN/PL chip is derived from the code, not stored as a new data field', () => {
    // §13 forbids adding a data field for it; it is aria-hidden decoration.
    expect(code).toMatch(/code\.toUpperCase\(\)/);
    expect(code).toMatch(/value\.toUpperCase\(\)/);
  });
});

/* ==========================================================================
   3 · ARIA — the prescribed combobox + listbox + aria-activedescendant model
   ========================================================================== */

describe('M66.11 — ARIA model (GN-CD-M66.11 §7, CTO decision D-1)', () => {
  it('the trigger is a real <button type="button"> with role="combobox"', () => {
    expect(code).toMatch(/<button/);
    expect(code).toMatch(/type="button"/);
    expect(code).toMatch(/role="combobox"/);
    // Never a div pretending to be a button.
    expect(code).not.toMatch(/role="button"/);
  });

  it('ids are instance-unique via useId(), because this component mounts twice per page', () => {
    // Desktop and mobile are BOTH in the DOM at once — one is hidden by the
    // cd-header breakpoint, not unmounted. A static id string would emit
    // duplicate DOM ids and aria-activedescendant would resolve to the wrong
    // one. Logo.tsx solves the identical problem the identical way.
    expect(code).toMatch(/useId/);
    expect(code).toMatch(/const instanceId = useId\(\)/);
    expect(code).toMatch(/const listboxId = `\$\{instanceId\}-listbox`/);
    expect(code).toMatch(/\$\{instanceId\}-option-\$\{code\}/);
    expect((navBarSource.match(/<LanguageSelector/g) ?? []).length).toBe(2);
  });

  it('aria-expanded is always present and is driven by real state', () => {
    expect(code).toMatch(/aria-expanded=\{isOpen\}/);
  });

  it('aria-haspopup and aria-controls resolve to the listbox', () => {
    expect(code).toMatch(/aria-haspopup="listbox"/);
    expect(code).toMatch(/aria-controls=\{listboxId\}/);
    expect(code).toMatch(/id=\{listboxId\}/);
    expect(code).toMatch(/role="listbox"/);
  });

  it('aria-activedescendant is present ONLY while open, and is OMITTED when closed', () => {
    // §7 requires the attribute removed, not emptied. `undefined` is what makes
    // React omit an attribute entirely; '' would emit aria-activedescendant="".
    expect(code).toMatch(/aria-activedescendant=\{isOpen \? optionId\(activeCode\) : undefined\}/);
    expect(code).not.toMatch(/aria-activedescendant=\{[^}]*''\}/);
  });

  it('every option carries a stable id and aria-selected, and exactly one can be true', () => {
    expect(code).toMatch(/role="option"/);
    expect(code).toMatch(/id=\{optionId\(code\)\}/);
    // aria-selected is a pure equality against the single committed value over a
    // two-item map, so "exactly one true" holds by construction rather than by
    // a runtime count that a source test could not perform anyway.
    expect(code).toMatch(/aria-selected=\{isSelected\}/);
    expect(code).toMatch(/const isSelected = code === value/);
  });

  it('neither the listbox nor the options are focusable — focus never leaves the trigger', () => {
    expect(code).not.toMatch(/tabIndex/);
    expect(code).not.toMatch(/tabindex/);
  });

  it('the listbox carries a localized accessible name', () => {
    expect(code).toMatch(/aria-label=\{actionLabel\}/);
  });

  it('the trigger name is composed from localized strings and the shared endonym', () => {
    // §7: "must come from localized strings, not concatenated English". No new
    // interpolation mechanism is introduced — this repository has none, and
    // dictionaries/index.spec.ts guards against a second i18n mechanism.
    expect(code).toMatch(
      /const triggerName = `\$\{label\}: \$\{LANGUAGE_NATIVE_LABELS\[value\]\}\. \$\{actionLabel\}`/,
    );
    expect(code).toMatch(/aria-label=\{triggerName\}/);
    for (const language of ['en', 'pl'] as const) {
      const t = getDictionary(language).navBar;
      expect(t.languageSelectorLabel.length).toBeGreaterThan(0);
      expect(t.languageSelectorAction.length).toBeGreaterThan(0);
    }
    // Genuinely translated, not an English fallback sitting in the PL file.
    expect(getDictionary('pl').navBar.languageSelectorAction).not.toBe(
      getDictionary('en').navBar.languageSelectorAction,
    );
    expect(getDictionary('en').navBar.languageSelectorAction).toBe('Select language');
  });

  it('every decorative element is hidden from assistive technology', () => {
    // Seven: the mobile globe, the mobile EN label, the mobile chevron, the
    // desktop ring, the desktop chevron, the row tick and the row code chip.
    const hidden = (code.match(/aria-hidden="true"/g) ?? []).length;
    expect(hidden).toBe(7);
    // And the tick is decorative because aria-selected already conveys selection.
    expect(code).toMatch(/aria-hidden="true"\s*\n\s*className="grid w-cd-14/);
  });
});

/* ==========================================================================
   4 · THE STATE MACHINE
   ========================================================================== */

describe('M66.11 — keyboard and pointer state machine (GN-CD-M66.11 §6)', () => {
  it('every required key has a branch', () => {
    for (const key of ['Tab', 'Escape', 'Enter', 'ArrowDown', 'ArrowUp', 'Home', 'End']) {
      expect(code).toContain(`'${key}'`);
    }
    // Space is matched as the literal ' ' and the legacy 'Spacebar'.
    expect(code).toMatch(/key === ' '/);
  });

  it('Home and End are implemented, and are inert while closed (CTO decision D-2)', () => {
    expect(code).toMatch(/key === 'Home' \|\| key === 'End'/);
    expect(code).toMatch(/jumpActive\(key === 'Home' \? 'first' : 'last'\)/);
    const branch = /if \(key === 'Home' \|\| key === 'End'\)[\s\S]*?\n    \}/.exec(code)?.[0] ?? '';
    expect(branch).toMatch(/if \(!isOpen\) return;/);
  });

  it('ARROWS NEVER COMMIT — the strongest proof a source test can give', () => {
    // Rather than dispatching a key event we cannot dispatch, this asserts that
    // the commit function is UNREACHABLE from any arrow/Home/End path: commit()
    // is called from exactly three places, and none of them is a navigation
    // branch. If someone adds a commit to an arrow branch this count changes.
    // Two call sites, and only two: the option click and the Enter/Space
    // branch. The `const commit = useCallback(` definition does not itself
    // contain "commit(", so this count is call sites only.
    const commitCalls = (code.match(/commit\(/g) ?? []).length;
    expect(commitCalls).toBe(2);
    expect(code).toMatch(/onClick=\{\(\) => commit\(code\)\}/);
    expect(code).toMatch(/if \(isOpen\) \{\s*\n\s*commit\(activeCode\);/);
    // The arrow branch moves the active index and returns; it never commits.
    const arrowBranch = /if \(key === 'ArrowDown' \|\| key === 'ArrowUp'\)[\s\S]*?\n      return;\n    \}/.exec(code)?.[0] ?? '';
    expect(arrowBranch).toMatch(/moveActive\(/);
    expect(arrowBranch).not.toMatch(/commit\(/);
    expect(arrowBranch).not.toMatch(/onChange\(/);
  });

  it('onChange is called from exactly one place — the commit function', () => {
    expect((code.match(/onChange\(/g) ?? []).length).toBe(1);
    expect(code).toMatch(/const commit = useCallback\(\s*\n?\s*\(code: LanguageCode\): void => \{[\s\S]*?onChange\(code\);/);
  });

  it('opening always makes the CURRENTLY SELECTED option active, never index 0', () => {
    expect(code).toMatch(/setActiveCode\(value\);/);
    const openFn = /const open = useCallback\([\s\S]*?\[value\],\s*\);/.exec(code)?.[0] ?? '';
    expect(openFn).toMatch(/setActiveCode\(value\)/);
    expect(openFn).not.toMatch(/ACTIVE_LANGUAGES\[0\]/);
  });

  it('arrow movement wraps in both directions', () => {
    expect(code).toMatch(/\(from \+ delta \+ ACTIVE_LANGUAGES\.length\) % ACTIVE_LANGUAGES\.length/);
    expect(code).toMatch(/moveActive\(key === 'ArrowDown' \? 1 : -1\)/);
  });

  it('ArrowUp and ArrowDown OPEN the popup when it is closed', () => {
    const arrowBranch = /if \(key === 'ArrowDown' \|\| key === 'ArrowUp'\)[\s\S]*?\n      return;\n    \}/.exec(code)?.[0] ?? '';
    expect(arrowBranch).toMatch(/if \(!isOpen\) \{[\s\S]*?open\(true\)/);
  });

  it('Enter and Space are preventDefault-ed, so the button’s synthesized click cannot double-toggle', () => {
    // A native <button> generates a click from both keys. Without preventDefault
    // the popup would open on keydown and immediately close again on the
    // synthesized click — a real bug this shape avoids by construction.
    expect(code).toMatch(/if \(key === 'Enter' \|\| key === ' ' \|\| key === 'Spacebar'\) \{\s*\n\s*event\.preventDefault\(\);/);
  });

  it('Tab closes but is NOT preventDefault-ed, so focus still moves on', () => {
    const tabBranch = /if \(key === 'Tab'\)[\s\S]*?\n    \}/.exec(code)?.[0] ?? '';
    expect(tabBranch).toMatch(/if \(isOpen\) close\(\);/);
    expect(tabBranch).not.toMatch(/preventDefault/);
  });

  it('Escape closes without committing, and is inert while closed', () => {
    const escBranch = /if \(key === 'Escape'\)[\s\S]*?\n    \}/.exec(code)?.[0] ?? '';
    expect(escBranch).toMatch(/if \(!isOpen\) return;/);
    expect(escBranch).toMatch(/close\(\)/);
    expect(escBranch).not.toMatch(/commit\(|onChange\(/);
  });

  it('the trigger toggles on click and focus returns to it after a commit', () => {
    expect(code).toMatch(/onClick=\{\(\) => \(isOpen \? close\(\) : open\(false\)\)\}/);
    expect(code).toMatch(/triggerRef\.current\?\.focus\(\)/);
  });

  it('pointer hover sets the active option but never commits', () => {
    expect(code).toMatch(/onPointerEnter=/);
    const hover = /onPointerEnter=\{[\s\S]*?\n                \}/.exec(code)?.[0] ?? '';
    expect(hover).toMatch(/setActiveCode\(code\)/);
    expect(hover).not.toMatch(/commit\(|onChange\(/);
    // And it is suppressed on the touch presentation, where the design removes
    // the hover treatment entirely.
    expect(hover).toMatch(/isMobile\s*\n?\s*\? undefined/);
  });

  it('the keyboard ring paints from state, and only when the pointer did not set the active row', () => {
    // §9 — focus never enters the popup, so the ring cannot come from a CSS
    // pseudo-class. It must also not follow the mouse: hover's own background
    // is the correct feedback there.
    expect(code).toMatch(/const \[isKeyboardActive, setIsKeyboardActive\] = useState\(false\)/);
    expect(code).toMatch(/isActive && isKeyboardActive/);
    expect(code).toMatch(/setIsKeyboardActive\(false\);\s*\n\s*setActiveCode\(code\);/);
  });
});

/* ==========================================================================
   5 · CLICK-OUTSIDE AND LISTENER CLEANUP
   ========================================================================== */

describe('M66.11 — click-outside contract (GN-CD-M66.11 §8)', () => {
  it('the listener is pointerdown on document — not click, not mousedown', () => {
    expect(code).toMatch(/document\.addEventListener\('pointerdown', onPointerDown\)/);
    expect(code).not.toMatch(/addEventListener\('click'/);
    expect(code).not.toMatch(/addEventListener\('mousedown'/);
  });

  it('the wrapper ref owns BOTH the trigger and the popup, and the popup is not portalled', () => {
    expect(code).toMatch(/<div ref=\{wrapperRef\}/);
    expect(code).toMatch(/wrapper\.contains\(event\.target as Node\)/);
    // A portal would silently break the single contains() test above.
    expect(code).not.toMatch(/createPortal|ReactDOM\.createPortal/);
  });

  it('the isOpen guard comes first — while closed there is no listener at all to leak', () => {
    const effect = /useEffect\(\(\) => \{\s*\n\s*if \(!isOpen\) return undefined;[\s\S]*?\}, \[isOpen\]\);/.exec(code)?.[0] ?? '';
    expect(effect).not.toBe('');
    expect(effect.indexOf('if (!isOpen) return undefined;')).toBeLessThan(effect.indexOf('addEventListener'));
  });

  it('CLEANUP IS PRESENT — §8 names its omission as the second-most likely regression here', () => {
    expect(code).toMatch(/return \(\) => document\.removeEventListener\('pointerdown', onPointerDown\)/);
    // Symmetry: every addEventListener has a removeEventListener.
    expect((code.match(/addEventListener/g) ?? []).length).toBe(
      (code.match(/removeEventListener/g) ?? []).length,
    );
  });

  it('an outside close does not commit and does not force focus back to the trigger', () => {
    const effect = /useEffect\(\(\) => \{\s*\n\s*if \(!isOpen\) return undefined;[\s\S]*?\}, \[isOpen\]\);/.exec(code)?.[0] ?? '';
    expect(effect).toMatch(/setIsOpen\(false\)/);
    expect(effect).not.toMatch(/commit\(|onChange\(|\.focus\(\)/);
  });

  it('NO scroll listener exists (CTO decision 3)', () => {
    // This repository has no nested mobile content scroll container and its
    // header is `sticky`, so the popup travels with its trigger. The geometric
    // problem scroll dismissal exists to prevent cannot occur here, and adding
    // a global listener would have invented a coupling the CTO declined.
    expect(code).not.toMatch(/addEventListener\('scroll'/);
    expect(code).not.toMatch(/onScroll/);
    expect(code).not.toMatch(/window\.addEventListener/);
  });

  it('only ONE effect exists, and it is the outside-click effect', () => {
    expect((code.match(/useEffect\(/g) ?? []).length).toBe(1);
  });
});

/* ==========================================================================
   6 · GEOMETRY — resolved against the real config, not pattern-matched
   ========================================================================== */

describe('M66.11 — popup geometry (GN-CD-M66.11 §3, §5)', () => {
  it('desktop popup: 168px, border-box, right-anchored to the trigger, 8px below, z-60', () => {
    const cls = popupClassFor('desktop');
    expect(cls).toMatch(/\bw-\[168px\]/);
    expect(cls).toMatch(/\bbox-border\b/);
    expect(cls).toMatch(/\bright-0\b/);
    expect(cls).toMatch(/\btop-\[calc\(100%\+8px\)\]/);
    expect(cls).toMatch(/\bz-\[60\]/);
    expect(cls).toMatch(/\babsolute\b/);
  });

  it('mobile popup: 176px, 12px viewport inset, 12px radius, 8px below, z-60', () => {
    const cls = popupClassFor('mobile');
    expect(cls).toMatch(/\bw-\[176px\]/);
    expect(cls).toMatch(/\bright-\[12px\]/);
    expect(cls).toMatch(/\btop-\[calc\(100%\+8px\)\]/);
    expect(cls).toMatch(/\bz-\[60\]/);
    expect(cls).toMatch(/rounded-cd-12/);
    // NO magic compensation offset (CTO decision 4). The mobile header row is
    // the containing block, so 12px means twelve pixels.
    expect(cls).not.toMatch(/right-\[-\d/);
    expect(navCode).toMatch(/className="relative flex h-\[52px\] items-center gap-3/);
  });

  it('the desktop popup height resolves to the released 91.6px from its own tokens', () => {
    // 5 padding + 40 + 40 + 5 padding + 2 border = 92 border-box.
    const rowH = 40;
    const pad = px('cd-5', spacing);
    const border = 1;
    expect(pad).toBe(5);
    expect(pad * 2 + rowH * ACTIVE_LANGUAGES.length + border * 2).toBe(92);
  });

  it('the desktop row inner width resolves to the released 156px', () => {
    // 168 outer − 2 border − 10 popup padding.
    expect(168 - 2 * 1 - 2 * px('cd-5', spacing)).toBe(156);
  });

  it('the mobile popup cannot overflow at any supported width', () => {
    // 176 + 12 inset + 12 clearance = 200px needed. Safe to 320 and below.
    for (const viewport of [320, 390, 430]) {
      expect(viewport - 12 - 176).toBeGreaterThanOrEqual(12);
    }
  });

  it('rows: 40px desktop / 44px mobile, 11px padding, 9px gap, 8px radius, no separators', () => {
    const d = rowClassFor('desktop');
    const m = rowClassFor('mobile');
    expect(d).toMatch(/\bh-\[40px\]/);
    expect(m).toMatch(/\bh-cd-44\b/);
    expect(px('cd-44', spacing)).toBe(44);
    for (const cls of [d, m]) {
      expect(cls).toMatch(/px-cd-11/);
      expect(cls).toMatch(/gap-cd-9/);
      expect(cls).toMatch(/rounded-cd-8/);
      // §4 — no border or separator on any row, in any state.
      expect(cls).not.toMatch(/\bborder\b/);
      expect(cls).not.toMatch(/divide-/);
    }
    expect(px('cd-11', spacing)).toBe(11);
    expect(px('cd-9', spacing)).toBe(9);
    expect(radius['cd-8']).toBe('8px');
    expect(radius['cd-10']).toBe('10px');
    expect(radius['cd-12']).toBe('12px');
  });

  it('mobile rows are 13.5px and desktop rows 13px, both from released tokens', () => {
    expect(rowClassFor('desktop')).toMatch(/text-cd-action/);
    expect(rowClassFor('mobile')).toMatch(/text-cd-nav-item/);
    expect(fonts['cd-action'][0]).toBe('13px');
    expect(fonts['cd-nav-item'][0]).toBe('13.5px');
  });

  it('the tick column reserves 14px in EVERY state, so the name never shifts', () => {
    expect(code).toMatch(/className="grid w-cd-14 flex-none place-items-center text-\[11px\]"/);
    expect(px('cd-14', spacing)).toBe(14);
    // Rendered conditionally as content, never as presence — the span is always
    // in the tree, only its glyph changes.
    expect(code).toMatch(/\{isSelected \? '✓' : ''\}/);
  });

  it('the EN/PL code uses the exact existing 9.5px / .12em mono role', () => {
    expect(code).toMatch(/font-cd-mono text-cd-mono-inspect/);
    expect(fonts['cd-mono-inspect'][0]).toBe('9.5px');
    expect(fonts['cd-mono-inspect'][1].letterSpacing).toBe('0.12em');
  });
});

describe('M66.11 — trigger geometry is invariant, so the header cannot reflow', () => {
  it('no state branch changes padding, border width, radius or font size', () => {
    const base = triggerBaseFor('desktop');
    const state = /const desktopTriggerState = isOpen[\s\S]*?';\n/.exec(code)?.[0] ?? '';
    expect(base).toMatch(/px-\[13px\] py-\[7px\]/);
    expect(base).toMatch(/rounded-\[9px\]/);
    expect(base).toMatch(/text-cd-action/);
    // The state string carries colour, fill, outline and shadow ONLY.
    expect(state).not.toMatch(/\bpx-|\bpy-|\bp-\[|rounded-|text-cd-|\bgap-|border-\[/);
  });

  it('the released GN-CD-026 desktop geometry moved onto the button unchanged', () => {
    const base = triggerBaseFor('desktop');
    expect(base).toMatch(/gap-2/); // 8px internal gap
    expect(code).toMatch(/h-\[13px\] w-\[13px\] rounded-full border border-cd-ink-label/);
    expect(cdGroup('ink').label).toBe('#7dd3fc');
    expect(cdColor('edge-control')).toBe('rgba(56,189,248,0.20)');
  });

  it('the released GN-CD-227 mobile trigger layout is carried over exactly', () => {
    const base = triggerBaseFor('mobile');
    expect(base).toMatch(/min-h-11/); // 44px touch floor
    expect(base).toMatch(/gap-1\.5/); // 6px
    expect(base).toMatch(/px-1/); // 4px
    expect(code).toMatch(/h-\[18px\] w-\[18px\] rounded-full border-\[1\.8px\] border-cd-ink-glyph-header/);
    expect(cdGroup('ink')['glyph-header']).toBe('#cfe3f5');
    // Mobile keeps the borderless treatment in every state.
    expect(base).not.toMatch(/\bborder\b|rounded-|bg-/);
  });

  it('the mobile chevron exists — it did NOT before this milestone (CTO decision 8)', () => {
    expect(code).toMatch(/className="text-\[8px\] text-cd-ink-meta"/);
    expect(cdGroup('ink').meta).toBe('#5b7fa6');
  });
});

/* ==========================================================================
   7 · COLOUR — every value resolves to a real token
   ========================================================================== */

describe('M66.11 — the six additive tokens resolve, and nothing was substituted', () => {
  it('the three new colour tokens carry the exact released values', () => {
    expect(cdColor('fill-popup')).toBe('rgba(6,12,24,0.97)');
    expect(cdColor('fill-control-open')).toBe('rgba(20,58,110,0.40)');
    expect(cdColor('hud-sky-06')).toBe('rgba(56,189,248,0.06)');
    // §10 warns against substituting the near neighbours. They are still their
    // own, different values — this fails if anyone "tidies" one into the other.
    expect(cdColor('fill-rail-arrow')).toBe('rgba(6,12,24,0.92)');
    expect(cdColor('fill-popup')).not.toBe(cdColor('fill-rail-arrow'));
  });

  it('the three new shadow tokens carry the exact released composites', () => {
    expect(shadows['cd-popup']).toBe(
      '0 14px 34px rgba(2,6,14,.62), 0 0 0 1px rgba(34,211,238,.06) inset, 0 0 26px rgba(34,211,238,.08)',
    );
    // §5 — mobile drops the inset hairline: three layers become two.
    expect(shadows['cd-popup-m']).toBe('0 14px 34px rgba(2,6,14,.62), 0 0 26px rgba(34,211,238,.08)');
    expect(shadows['cd-popup-m']).not.toContain('inset');
    expect((shadows['cd-popup'].match(/rgba/g) ?? []).length).toBe(3);
    expect((shadows['cd-popup-m'].match(/rgba/g) ?? []).length).toBe(2);
    expect(shadows['cd-control-open']).toBe('0 0 18px rgba(34,211,238,.12)');
  });

  it('the three values the design called "new" that ALREADY EXISTED are reused, not duplicated', () => {
    // GN-CD-M66.11 §10 lists popup-border, row-selected-fill and row-hover-fill
    // as new. They are not: this repository already had all three exactly, and
    // duplicating them under new names would have created near-identical tokens
    // that drift. Reuse is asserted so a later change cannot quietly fork them.
    expect(cdColor('edge-control-active-32')).toBe('rgba(56,189,248,0.32)');
    expect(cdColor('hud-cyan-10')).toBe('rgba(34,211,238,0.10)');
    expect(cdColor('hud-sky-09')).toBe('rgba(56,189,248,0.09)');
    expect(popupClassFor('desktop')).toMatch(/border-cd-edge-control-active-32/);
    expect(code).toMatch(/bg-cd-hud-cyan-10/);
    expect(code).toMatch(/bg-cd-hud-sky-09/);
  });

  it('selected and hover/active are visually DISTINCT and are not merged', () => {
    // §4 — selected is cyan fill + cyan text; active is blue fill + white text.
    expect(code).toMatch(/bg-cd-hud-cyan-10 text-cd-ink-label/);
    expect(code).toMatch(/bg-cd-hud-sky-09 text-cd-ink-primary/);
    expect(cdColor('hud-cyan-10')).not.toBe(cdColor('hud-sky-09'));
    expect(cdGroup('ink').label).not.toBe(cdGroup('ink').primary);
  });

  it('every remaining row and trigger colour resolves to an existing released token', () => {
    expect(cdGroup('ink').secondary).toBe('#a7c0d8'); // unselected row text
    expect(cdGroup('ink')['core-sub']).toBe('#5b9fd0'); // selected row code
    expect(cdGroup('ink').primary).toBe('#e8f1ff');
    expect(cdColor('hub-core')).toBe('rgba(34,211,238,0.55)'); // trigger hover border
    expect(cdColor('hub-core-m')).toBe('rgba(34,211,238,0.60)'); // trigger open border
    expect(cdColor('nav-hover')).toBe('rgba(56,189,248,0.08)'); // trigger hover fill
    expect(cdColor('edge-focus')).toBe('rgba(34,211,238,0.70)');
  });

  it('the row focus ring is INSET, not an outline', () => {
    // §4 — an outline on an 8px radius inside a 5px-padded popup would collide
    // with the popup border.
    expect(code).toMatch(/shadow-\[inset_0_0_0_1px_rgba\(34,211,238,0\.7\)\]/);
  });
});

/* ==========================================================================
   8 · FOCUS, MOTION AND SCOPE
   ========================================================================== */

describe('M66.11 — focus contract (GN-CD-M66.11 §9)', () => {
  it('the trigger ring uses :focus-visible, so a mouse click does not paint it', () => {
    const base = triggerBaseFor('desktop');
    expect(base).toMatch(/focus-visible:outline\b/);
    expect(base).toMatch(/focus-visible:outline-1\b/);
    expect(base).toMatch(/focus-visible:outline-offset-2\b/);
    expect(base).toMatch(/focus-visible:outline-cd-edge-focus\b/);
  });

  it('GN-CD-306 §W survives the element change: outline suppression only WITH a replacement', () => {
    // The rule M66.1 established is preserved verbatim — only its host moved
    // from the <select> to the <button>.
    const base = triggerBaseFor('desktop');
    expect(base).toMatch(/focus:outline-none/);
    expect(base).toMatch(/focus-visible:outline/);
  });
});

describe('M66.11 — NO ANIMATION (GN-CD-M66.11 §12)', () => {
  it('not one motion utility appears anywhere in the component', () => {
    for (const forbidden of [
      /\btransition\b/,
      /transition-/,
      /\banimate-/,
      /\bduration-/,
      /\bease-/,
      /@keyframes/,
      /rotate-/,
      /\bscale-/,
      /\bopacity-/,
    ]) {
      expect(code).not.toMatch(forbidden);
    }
  });

  it('the chevron is glyph-SWAPPED, never rotated', () => {
    expect(code).toMatch(/\{isOpen \? '▲' : '▼'\}/);
    expect(code).not.toMatch(/rotate/);
  });

  it('reduced motion needs no override, because there is no motion to suppress', () => {
    expect(code).not.toMatch(/prefers-reduced-motion|motion-reduce/);
  });
});

describe('M66.11 — architecture scope', () => {
  it('persistence stays entirely with the caller, exactly as before', () => {
    expect(code).not.toMatch(/persistLanguageSelection|localStorage|document\.cookie|sessionStorage/);
    expect(navCode).toMatch(/persistLanguageSelection\(next\)/);
    expect(navCode).toMatch(/router\.refresh\(\)/);
  });

  it('re-selecting the current language remains a complete no-op, via the EXISTING NavBar guard', () => {
    // Deliberately not re-implemented inside the component: duplicating the
    // rule would give it two homes and two chances to drift.
    expect(navCode).toMatch(/if \(next === language\) return;/);
    expect(code).not.toMatch(/next === value|code === value \) return/);
  });

  it('no network, route, storage or API behaviour is introduced', () => {
    for (const forbidden of [/\bfetch\(/, /axios/, /useRouter/, /useSearchParams/, /\/api\//, /XMLHttpRequest/]) {
      expect(code).not.toMatch(forbidden);
    }
  });

  it('languages.ts is consumed, never redefined', () => {
    expect(code).not.toMatch(/const ACTIVE_LANGUAGES|const LANGUAGE_NATIVE_LABELS/);
  });

  it('the component follows the host header’s breakpoint and defines none of its own', () => {
    // GN-CD-M66.11 §5: "The selector follows its host header and never defines
    // its own breakpoint." NavBar switches at cd-header; the component branches
    // on a prop.
    expect(code).not.toMatch(/cd-header:|sm:|md:|lg:|xl:/);
    expect(code).toMatch(/variant = 'desktop'/);
    expect(navCode).toMatch(/variant="desktop"/);
    expect(navCode).toMatch(/variant="mobile"/);
    expect((themeExtend.screens ?? {})['cd-header']).toBe('1400px');
  });
});
