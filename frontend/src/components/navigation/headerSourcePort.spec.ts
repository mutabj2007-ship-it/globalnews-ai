import { readFileSync } from 'fs';
import { join } from 'path';

import tailwindConfig from '../../../tailwind.config';

const navBarSource = readFileSync(join(__dirname, 'NavBar.tsx'), 'utf-8');
const languageSelectorSource = readFileSync(join(__dirname, '../search/LanguageSelector.tsx'), 'utf-8');
const logoSource = readFileSync(join(__dirname, '../ui/Logo.tsx'), 'utf-8');

/**
 * M66.2 — released values are asserted against the REAL Tailwind config
 * wherever they now live in a token, rather than string-matched out of a class
 * attribute. "The wordmark is 19px / 700 / -0.01em" then stays true through any
 * refactor of how the class is written, and fails if the token drifts.
 */
type FoundationTheme = {
  colors: { cd: Record<string, string | Record<string, string>> };
  fontSize: Record<string, unknown>;
  screens: Record<string, string>;
  maxWidth: Record<string, string>;
  animation: Record<string, string>;
};
const theme = (tailwindConfig.theme?.extend ?? {}) as unknown as FoundationTheme;

function cdColor(key: string): string {
  const value = theme.colors.cd[key];
  if (typeof value !== 'string') throw new Error(`cd.${key} is not a colour string`);
  return value;
}

function cdGroup(key: string): Record<string, string> {
  const value = theme.colors.cd[key];
  if (typeof value === 'string' || value === undefined) throw new Error(`cd.${key} is not a colour group`);
  return value;
}

/**
 * Strips comments before asserting. Every negative assertion in this file needs
 * it: this milestone's own documentation necessarily quotes the values it
 * removed (`animate-pulse`, `font-mono`, `max-w-[1600px]`), and a guard that
 * fails on the explanation while the code is correct is a guard that punishes
 * documentation.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * M65 — header + navigation, ported from the approved Claude Design
 * (GlobalNews AI.dc.html: desktop header ~L20-73, mobile header/menu
 * ~L708-751) onto the current production logic.
 *
 * This file protects two things at once: the exact ported design values,
 * and the real behaviour underneath them — especially the language model,
 * which the recovered archive got wrong and this implementation
 * deliberately corrects.
 */

describe('M65 — desktop header, exact approved-design geometry', () => {
  it('62px height, and the design’s exact background, border and blur', () => {
    expect(navBarSource).toMatch(/h-\[62px\]/);
    expect(navBarSource).toMatch(/border-\[rgba\(56,189,248,0\.18\)\]/);
    expect(navBarSource).toMatch(/bg-\[rgba\(4,7,14,0\.92\)\]/);
    expect(navBarSource).toMatch(/backdrop-blur-\[10px\]/);
  });

  /**
   * M66.2 — the two inline `color:` assertions this test used to make were
   * retired here, not weakened. GN-CD-024 releases a hover state, and an inline
   * style beats every class, so the colours had to move to classes for the
   * released hover to be reachable at all. Their exact values are asserted
   * against the released tokens in "the released active values survive the
   * carrier change" below. The inset marker and the negative pseudo-element
   * guard are unaffected and stay here.
   */
  it('the active nav treatment is the design’s inset cyan edge, not the earlier underline pseudo-element', () => {
    expect(navBarSource).toMatch(/boxShadow: 'inset 0 -2px 0 #38bdf8'/);
    expect(codeOnly(navBarSource)).not.toMatch(/after:absolute after:-bottom-1/);
  });

  it('nav item geometry matches the design exactly (padding 8px 12px, radius 8px)', () => {
    expect(navBarSource).toMatch(/rounded-lg px-3 py-2/);
  });

  /**
   * M66.2 — replaces the M65 lock on `font-mono text-[13.5px]`. ERRATUM-009 in
   * GN-CD-020..027 releases the desktop nav item as 13.5px / 400 in the
   * INHERITED body family; `font-mono` was a C2.1 assumption the released
   * family disproves. The size is still asserted, now through its token.
   */
  it('M66.2 — the nav item uses the released body treatment at 13.5px / 400, never mono', () => {
    expect(navBarSource).toMatch(/font-cd-body text-cd-nav-item/);
    expect(codeOnly(navBarSource)).not.toMatch(/font-mono text-\[13\.5px\]/);
    const navItemRole = JSON.stringify(theme.fontSize['cd-nav-item']);
    expect(navItemRole).toContain('13.5px');
    expect(navItemRole).toContain('"fontWeight":"400"');
  });

  it('M66.2 — the released hover state exists: colour AND background, never colour alone', () => {
    expect(navBarSource).toMatch(/hover:bg-cd-nav-hover/);
    expect(navBarSource).toMatch(/hover:text-cd-ink-primary/);
    expect(cdColor('nav-hover')).toBe('rgba(56,189,248,0.08)');
    expect(cdGroup('ink').primary).toBe('#e8f1ff');
    expect(codeOnly(navBarSource)).not.toMatch(/style=\{isActive \? \{ color: '#7dd3fc'/);
  });

  it('M66.2 — the released active and default colours survive the carrier change', () => {
    expect(navBarSource).toMatch(/text-cd-ink-label/);
    expect(navBarSource).toMatch(/text-cd-ink-secondary/);
    expect(cdGroup('ink').label).toBe('#7dd3fc');
    expect(cdGroup('ink').secondary).toBe('#a7c0d8');
  });

  it('M66.2 — nav labels cannot wrap inside the fixed 62px band (MLR-08)', () => {
    expect(navBarSource).toMatch(/whitespace-nowrap/);
  });

  it('M66.2 — the desktop header content aligns to the accepted 1500px boundary, not the old 1600px cap', () => {
    expect(navBarSource).toMatch(/max-w-cd-page/);
    expect(codeOnly(navBarSource)).not.toMatch(/max-w-\[1600px\]/);
    expect(theme.maxWidth['cd-page']).toBe('1500px');
  });

  it('M66.2 — the released header renders only where its own geometry fits (CTO decision D1)', () => {
    expect(theme.screens['cd-header']).toBe('1400px');
    expect(navBarSource).toMatch(/cd-header:flex/);
    expect(codeOnly(navBarSource)).not.toMatch(/lg:flex/);
  });

  it('M66.2 — the GN-CD-306 focus treatment is scoped to the desktop header, not to the mobile chrome', () => {
    expect(navBarSource).toMatch(/cd-canvas/);
    const desktopRow = navBarSource.slice(navBarSource.indexOf('cd-canvas'), navBarSource.indexOf('Mobile header'));
    expect(desktopRow).toContain('cd-header:flex');
    expect(codeOnly(navBarSource)).not.toMatch(/<header className="[^"]*cd-canvas/);
  });

  it('the search control is the design’s own CSS-drawn geometry, not an icon-library glyph', () => {
    expect(navBarSource).toMatch(/h-\[12px\] w-\[12px\]/);
    expect(navBarSource).toMatch(/border-\[1\.5px\] border-\[#9fc6e8\]/);
    expect(navBarSource).toMatch(/w-\[7px\] bg-\[#9fc6e8\]/);
    expect(navBarSource).toMatch(/translate\(5px,4px\) rotate\(45deg\)/);
    expect(navBarSource).not.toMatch(/from 'lucide-react'/);
  });

  /**
   * M66.2 — replaces the M65 lock on the C2.1 scan-line rail. GN-CD-020's layer
   * table lists "Scan line ❌ none" and describes the header as "four
   * declarations deep: fill, blur, border, nothing else". The rail had no
   * authority in the released family, so its ABSENCE is now the contract. The
   * second half of the original test — that the C2.1 Logo component is reused
   * rather than rebuilt — is still valid and is kept.
   */
  it('M66.2 — the header carries no scan-line rail, and the C2.1 Logo component is still reused', () => {
    expect(codeOnly(navBarSource)).not.toMatch(/bg-gradient-to-r from-transparent via-cyan-400\/50 to-transparent/);
    expect(navBarSource).toMatch(/import \{ Logo \} from '@\/components\/ui\/Logo'/);
  });

  it('M66.2 — the header is exactly fill, blur, border and nothing else', () => {
    const headerTag = /<header className="([^"]*)"/.exec(navBarSource)?.[1] ?? '';
    expect(headerTag).toContain('sticky top-0');
    expect(headerTag).toContain('z-50');
    expect(headerTag).toContain('bg-[rgba(4,7,14,0.92)]');
    expect(headerTag).toContain('backdrop-blur-[10px]');
    expect(headerTag).toContain('border-b border-[rgba(56,189,248,0.18)]');
    expect(headerTag).not.toMatch(/shadow-/);
    expect(headerTag).not.toMatch(/\brelative\b/);
  });
});

describe('M65 — mobile header and full-screen menu, exact approved-design geometry', () => {
  it('52px header, a 44x44 hamburger target, and the design’s three-bar construction', () => {
    expect(navBarSource).toMatch(/h-\[52px\]/);
    expect(navBarSource).toMatch(/h-11 w-11 flex-col justify-center gap-\[5px\]/);
    const barCount = (navBarSource.match(/h-\[2px\] rounded-sm bg-\[#dbeafe\]/g) ?? []).length;
    expect(barCount).toBe(3);
  });

  it('the hamburger opens the design’s full-screen overlay, with its SECTIONS heading and 52px rows', () => {
    expect(navBarSource).toMatch(/isMobileMenuOpen &&/);
    expect(navBarSource).toMatch(/rgba\(3,6,12,0\.97\)/);
    expect(navBarSource).toMatch(/SECTIONS/);
    expect(navBarSource).toMatch(/min-h-\[52px\]/);
  });

  it('desktop and mobile render from the SAME NAV_MODEL — exactly two usages, never two maintained lists', () => {
    const usages = (navBarSource.match(/NAV_MODEL\.map/g) ?? []).length;
    expect(usages).toBe(2);
  });

  it('the full-screen overlay can be dismissed from the keyboard, not by pointer alone', () => {
    expect(navBarSource).toMatch(/event\.key === 'Escape'/);
    expect(navBarSource).toMatch(/aria-expanded=\{isMobileMenuOpen\}/);
  });
});

describe('M65 — every search-looking control performs a real action', () => {
  it('both header search controls are real links to the real /search workspace, never inert buttons', () => {
    const searchLinks = (navBarSource.match(/href="\/search"/g) ?? []).length;
    expect(searchLinks).toBe(2);
    // The pre-M65 defect: <button type="button"> with an aria-label and
    // no handler of any kind. No button in this file may exist without
    // either an onClick or a type="submit".
    const buttons = navBarSource.match(/<button[\s\S]*?>/g) ?? [];
    for (const button of buttons) {
      expect(/onClick=|type="submit"/.test(button)).toBe(true);
    }
  });
});

describe('M65 — ONE language model, corrected relative to the recovered archive', () => {
  it('the language comes from the Server Component as a prop — never read from localStorage during render', () => {
    expect(navBarSource).toMatch(/language = 'en' \}: NavBarProps/);
    expect(navBarSource).not.toMatch(/resolveInitialLanguage\(\)/);
    expect(navBarSource).not.toMatch(/typeof window !== 'undefined'/);
  });

  it('changing the language persists it AND refreshes the Server Components, so real data follows the selection', () => {
    expect(navBarSource).toMatch(/persistLanguageSelection\(next\)/);
    expect(navBarSource).toMatch(/router\.refresh\(\)/);
  });

  it('desktop and mobile use the SAME shared LanguageSelector — no second hand-rolled <select> anywhere in the header', () => {
    const usages = (navBarSource.match(/<LanguageSelector/g) ?? []).length;
    expect(usages).toBe(2);
    const navCodeOnly = navBarSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(navCodeOnly).not.toMatch(/<select/);
  });

  it('the shared selector still offers only the production-active languages and still leaves persistence to its caller', () => {
    expect(languageSelectorSource).toMatch(/ACTIVE_LANGUAGES\.map/);
    const selectorCodeOnly = languageSelectorSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(selectorCodeOnly).not.toMatch(/persistLanguageSelection/);
  });

  it('the mobile control still carries an accessible name, now composed rather than sr-only text', () => {
    // M66.11 — RE-AIMED, NOT REMOVED. The rule this protects is "the mobile
    // control has an accessible name even though nothing visible spells it
    // out". Its mechanism changed: there is no <select>, no wrapping <label>
    // and no sr-only span, because a <button> cannot be labelled by a wrapping
    // <label>. GN-CD-M66.11 §7 prescribes a composed aria-label instead, built
    // from localized strings and the shared endonym. The name still exists,
    // still localizes, and is now asserted on the element that actually has it.
    expect(languageSelectorSource).toMatch(/aria-label=\{triggerName\}/);
    expect(languageSelectorSource).toMatch(
      /const triggerName = `\$\{label\}: \$\{LANGUAGE_NATIVE_LABELS\[value\]\}\. \$\{actionLabel\}`/,
    );
    expect(navBarSource).toMatch(/actionLabel=\{t\.languageSelectorAction\}/);
    // The obsolete props went with the element they served.
    expect(codeOnly(languageSelectorSource)).not.toMatch(/hideLabelText|sr-only/);
    expect(codeOnly(navBarSource)).not.toMatch(/hideLabelText/);
  });
});

describe('M65 — navigation truthfulness', () => {
  it('the header contains no fabricated category route', () => {
    for (const fakeRoute of ['/world', '/politics', '/business', '/technology', '/science', '/health', '/about']) {
      expect(navBarSource).not.toContain(`href="${fakeRoute}"`);
      expect(navBarSource).not.toContain(`href='${fakeRoute}'`);
    }
  });

  it('the unavailable entry is genuinely non-interactive and says so accessibly', () => {
    expect(navBarSource).toMatch(/aria-disabled="true"/);
    expect(navBarSource).toMatch(/t\.editorialUnavailableLabel/);
  });

  it('every rendered label goes through the dictionary, never a raw English literal from the model', () => {
    expect(navBarSource).toMatch(/t\.navItemLabels\[entry\.labelKey\]/);
    expect(navBarSource).toMatch(/\{labelFor\(entry\)\}/);
  });
});

/**
 * M66.2 — GN-CD-021/022/023 brand identity, and the accessibility fixes that
 * must survive a visual pass on a shared emblem.
 */
describe('M66.2 — brand lockup and emblem, GN-CD-021/022/023', () => {
  it('the desktop header asks for the released 30px emblem box and 11px lockup gap', () => {
    expect(navBarSource).toMatch(/<Logo size=\{30\} gapPx=\{11\} \/>/);
  });

  it('every other call site keeps its pre-M66.2 size and gap — the mobile chrome and footer do not move', () => {
    // GN-CD-022 is "one identity, four sizes", and only the desktop header size
    // is released here. Defaults must therefore stay at the shipped values so
    // the footer (GN-CD-201) and mobile header (GN-CD-221), both unreleased,
    // are untouched. Authorization §12.
    expect(logoSource).toMatch(/size = 28/);
    expect(logoSource).toMatch(/gapPx = 10/);
    const mobileBlock = navBarSource.slice(navBarSource.indexOf('Mobile header'));
    expect(mobileBlock).toMatch(/<Logo \/>/);
    expect(codeOnly(mobileBlock)).not.toMatch(/<Logo size=/);
  });

  it('the wordmark is the released Space Grotesk 19px / 700 / -0.01em', () => {
    expect(logoSource).toMatch(/font-cd-display text-cd-wordmark/);
    const wordmark = JSON.stringify(theme.fontSize['cd-wordmark']);
    expect(wordmark).toContain('19px');
    expect(wordmark).toContain('"fontWeight":"700"');
    expect(wordmark).toContain('"letterSpacing":"-0.01em"');
    expect(codeOnly(logoSource)).not.toMatch(/text-lg font-medium tracking-tight/);
  });

  it('"AI" is the released #38bdf8, not the previous #22d3ee', () => {
    expect(logoSource).toMatch(/text-cd-ink-wordmark/);
    expect(cdGroup('ink').wordmark).toBe('#38bdf8');
    expect(codeOnly(logoSource)).not.toMatch(/text-cyan-400/);
  });

  it('the SVG declares overflow-visible — GN-CD-022 says it is required', () => {
    // The cardinal ticks sit inside the viewBox, but the blurred core's filter
    // region extends beyond it.
    expect(logoSource).toMatch(/className="shrink-0 overflow-visible"/);
  });

  it('the emblem uses the released gnEmbRing / gnEmbCore / gnEmbScan timings', () => {
    expect(logoSource).toMatch(/animate-cd-emb-ring/);
    expect(logoSource).toMatch(/animate-cd-emb-core/);
    expect(logoSource).toMatch(/animate-emblem-scan/);
    expect(theme.animation['cd-emb-ring']).toBe('cd-emb-ring 4.6s ease-out infinite');
    expect(theme.animation['cd-emb-core']).toBe('cd-emb-core 3.4s ease-in-out infinite');
    expect(theme.animation['emblem-scan']).toBe('emblem-scan 14s linear infinite');
  });

  it('the superseded ring/core animations are gone from the emblem, and the legacy tokens are untouched', () => {
    expect(codeOnly(logoSource)).not.toMatch(/animate-ring-pulse/);
    expect(codeOnly(logoSource)).not.toMatch(/animate-pulse\b/);
    // The tokens themselves stay: other files still use them, and M66.1's
    // foundation contract asserts their values.
    expect(theme.animation['ring-pulse']).toBe('ring-pulse 3.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite');
  });

  it('DEFECT-022 stays fixed: instance-unique SVG ids via useId()', () => {
    expect(logoSource).toMatch(/useId/);
    expect(logoSource).toMatch(/gnEmbGlow-\$\{uid\}/);
    expect(logoSource).toMatch(/gnEmbBlur-\$\{uid\}/);
    expect(logoSource).not.toMatch(/id="gnEmbGlow"/);
    expect(logoSource).not.toMatch(/id="gnEmbBlur"/);
  });

  it('DEFECT-023 stays fixed: the decorative emblem is aria-hidden', () => {
    expect(logoSource).toMatch(/aria-hidden="true"/);
  });

  it('every released emblem radius, dash array and stroke width is still exact', () => {
    for (const radius of ['r="19"', 'r="18"', 'r="13.5"', 'r="9"', 'r="7"', 'r="4.6"']) {
      expect(logoSource).toContain(radius);
    }
    expect(logoSource).toContain('strokeDasharray="15 98"');
    expect(logoSource).toContain('strokeDasharray="3 5"');
    for (const stroke of ['strokeWidth="1.3"', 'strokeWidth="1.2"', 'strokeWidth="1.1"', 'strokeWidth="1"']) {
      expect(logoSource).toContain(stroke);
    }
    // The scan group still needs BOTH declarations, or the spoke rotates about
    // the SVG origin instead of the emblem centre (GN-CD-022).
    expect(logoSource).toMatch(/origin-center animate-emblem-scan/);
    expect(logoSource).toMatch(/transformBox: 'fill-box'/);
  });
});

/**
 * M66.2 — GN-CD-026. The released label is a plain 13px body text node; the
 * shared LanguageSelector's own <label> was leaking mono, uppercase and wide
 * tracking into it by inheritance.
 */
describe('M66.2 — GN-CD-026 language control', () => {
  it('the released container geometry is unchanged and exact — now hosted on the button', () => {
    // M66.11 — RE-AIMED, NOT REMOVED. Every released GN-CD-026 value is still
    // asserted to the pixel; the element carrying them moved from a <div>
    // wrapping a <select> to the <button role="combobox"> that replaced both.
    // The geometry did not change, which is what makes "the header cannot
    // reflow when the popup opens" true by construction.
    const selectorSource = languageSelectorSource;
    expect(selectorSource).toMatch(/rounded-\[9px\] border px-\[13px\] py-\[7px\]/);
    expect(selectorSource).toMatch(/border-cd-edge-control/);
    expect(selectorSource).toMatch(/h-\[13px\] w-\[13px\] rounded-full border border-cd-ink-label/);
    // The chevron is now 9px, the released GN-CD-M66.11 §2 value, replacing the
    // 10px the pill used to carry. Same colour role, same token.
    expect(selectorSource).toMatch(/text-\[9px\]/);
    expect(selectorSource).toMatch(/text-cd-ink-meta/);
    expect(cdColor('edge-control')).toBe('rgba(56,189,248,0.20)');
    expect(cdGroup('ink').meta).toBe('#5b7fa6');
    // NavBar no longer draws any of it — the pill is not duplicated anywhere.
    expect(codeOnly(navBarSource)).not.toMatch(/rounded-\[9px\] border border-cd-edge-control/);
  });

  it('the label renders as a plain body text node, not mono / uppercase / tracked', () => {
    // M66.11 — RE-AIMED, NOT REMOVED. M66.2 needed font-cd-body / normal-case /
    // tracking-normal because a <select> INHERITED the shared component's own
    // mono, uppercase, wide-tracked <label>. That <label> no longer exists, so
    // the corrections are no longer needed — but the RULE still is: the trigger
    // label must render as a plain 13px body text node. It is now asserted
    // positively (the released cd-action role is applied) and negatively (none
    // of the mono/uppercase/tracked treatment leaked back in).
    const trigger = /const triggerBase = isMobile[\s\S]*?';\r?\n/.exec(languageSelectorSource)?.[0] ?? '';
    expect(trigger).toContain('text-cd-action');
    expect(trigger).not.toContain('font-mono');
    expect(trigger).not.toContain('uppercase');
    expect(trigger).not.toContain('tracking-widest');
    expect(codeOnly(languageSelectorSource)).not.toMatch(/font-mono text-xs uppercase tracking-widest/);
  });

  it('the control keeps its real EN/PL behaviour and its M66.1 focus indicator', () => {
    // M66.11 — RE-AIMED, NOT REMOVED. The focus indicator moved from the
    // <select>'s selectClassName onto the <button>. The released outline WIDTH
    // changed from M66.1's 2px to GN-CD-M66.11 §9's 1px — a design-authorized
    // value change, recorded in the milestone's known limitations — but the
    // colour token, the 2px offset and the :focus-visible gating are identical.
    const trigger = /const triggerBase = isMobile[\s\S]*?';\r?\n/.exec(languageSelectorSource)?.[0] ?? '';
    expect(trigger).toContain('focus-visible:outline-cd-edge-focus');
    expect(trigger).toContain('focus-visible:outline-offset-2');
    expect(cdColor('edge-focus')).toBe('rgba(34,211,238,0.70)');
    // The real behaviour underneath is untouched.
    expect(navBarSource).toMatch(/persistLanguageSelection\(next\)/);
    expect(navBarSource).toMatch(/router\.refresh\(\)/);
  });

  it('the shared selector still derives everything from the language model, and still persists nothing', () => {
    // M66.11 — RE-AIMED, NOT REMOVED. M66.2's framing ("context-only, untouched")
    // is no longer true: M66.11 rebuilt this component under CTO authorization.
    // What this test was really protecting — the model is the source, and the
    // component owns no persistence — is unchanged and is asserted here against
    // the new implementation.
    expect(languageSelectorSource).toMatch(/ACTIVE_LANGUAGES\.map/);
    expect(languageSelectorSource).toMatch(/LANGUAGE_NATIVE_LABELS\[code\]/);
    expect(codeOnly(languageSelectorSource)).not.toMatch(/persistLanguageSelection/);
    expect(codeOnly(languageSelectorSource)).not.toMatch(/'English'|'Polski'/);
  });
});

/**
 * M66.2 — GN-CD-027. Every released value was already exact; only the
 * explicitly re-declared body family changed. The real auth behaviour is out of
 * scope and must be provably untouched (CTO decision D4).
 */
describe('M66.2 — GN-CD-027 Sign In', () => {
  it('the released geometry, gradient, border and glow are unchanged', () => {
    const signIn = /signInClassName="rounded-\[9px\][^"]*"/.exec(navBarSource)?.[0] ?? '';
    expect(signIn).toContain('px-5 py-[9px]');
    expect(signIn).toContain('from-[rgba(37,99,235,0.95)]');
    expect(signIn).toContain('to-[rgba(29,78,216,0.95)]');
    expect(signIn).toContain('shadow-[0_0_22px_rgba(37,99,235,0.35)]');
    expect(signIn).toContain('border-cd-edge-emphasis-50');
    expect(cdColor('edge-emphasis-50')).toBe('rgba(56,189,248,0.50)');
  });

  it('the label is 13px / 600 in the explicitly re-declared body family (ERRATUM-009)', () => {
    const signIn = /signInClassName="rounded-\[9px\][^"]*"/.exec(navBarSource)?.[0] ?? '';
    expect(signIn).toContain('font-cd-body');
    expect(signIn).toContain('text-cd-signin');
    expect(signIn).toContain('text-cd-ink-signin');
    const role = JSON.stringify(theme.fontSize['cd-signin']);
    expect(role).toContain('13px');
    expect(role).toContain('"fontWeight":"600"');
    expect(cdGroup('ink').signin).toBe('#eaf6ff');
  });

  it('AccountControl still receives every one of its real behaviours by prop, unmodified', () => {
    for (const prop of [
      'signInLabel',
      'signInClassName',
      'historyLabel',
      'signOutLabel',
      'deleteAccountLabel',
      'deleteAccountConfirmLabel',
    ]) {
      expect(navBarSource).toContain(prop);
    }
    expect((navBarSource.match(/<AccountControl/g) ?? []).length).toBe(2);
  });
});

/**
 * M66.2 — the mobile chrome must be visually and functionally unchanged at
 * 390x844. The handoff breakpoint is the ONLY authorized responsive change
 * (authorization §12), so every mobile value is re-asserted here.
 */
describe('M66.2 — mobile chrome is untouched except for the handoff breakpoint', () => {
  it('the mobile header keeps its exact 52px geometry, fill and blur', () => {
    expect(navBarSource).toMatch(/h-\[52px\] items-center gap-3 bg-\[rgba\(5,7,13,0\.96\)\] px-4 backdrop-blur-\[8px\]/);
  });

  it('the 44x44 hamburger, its three bars and its accessible state are unchanged', () => {
    expect(navBarSource).toMatch(/h-11 w-11 flex-col justify-center gap-\[5px\]/);
    expect((navBarSource.match(/h-\[2px\] rounded-sm bg-\[#dbeafe\]/g) ?? []).length).toBe(3);
    expect(navBarSource).toMatch(/aria-expanded=\{isMobileMenuOpen\}/);
  });

  it('the full-screen overlay keeps its fill, heading, row height and keyboard exit', () => {
    expect(navBarSource).toMatch(/rgba\(3,6,12,0\.97\)/);
    expect(navBarSource).toMatch(/SECTIONS/);
    expect(navBarSource).toMatch(/min-h-\[52px\]/);
    expect(navBarSource).toMatch(/event\.key === 'Escape'/);
  });

  it('the mobile search and language controls keep their own geometry', () => {
    expect(navBarSource).toMatch(/h-\[15px\] w-\[15px\]/);
    expect(navBarSource).toMatch(/border-\[1\.8px\] border-\[#cfe3f5\]/);
    expect(navBarSource).toMatch(/translate\(9px,7px\) rotate\(45deg\)/);
    // M66.11 — RE-AIMED, NOT REMOVED. The mobile language control used to be an
    // INVISIBLE opacity-0 <select> laid over a globe and an EN code that NavBar
    // drew itself. That overlay is gone: the same globe and code are now inside a
    // real button, so the decoration and the control are one element. The
    // released GN-CD-227 geometry it protected is unchanged and is asserted on
    // the component that now owns it.
    const trigger = /const triggerBase = isMobile[\s\S]*?';\r?\n/.exec(languageSelectorSource)?.[0] ?? '';
    expect(trigger).toContain('min-h-11'); // the 44px touch floor
    expect(trigger).toContain('gap-1.5'); // 6px
    expect(trigger).toContain('px-1'); // 4px
    expect(languageSelectorSource).toMatch(
      /h-\[18px\] w-\[18px\] rounded-full border-\[1\.8px\] border-cd-ink-glyph-header/,
    );
    expect(cdGroup('ink')['glyph-header']).toBe('#cfe3f5');
    // And the invisible overlay is genuinely gone, not merely moved.
    expect(codeOnly(navBarSource)).not.toMatch(/opacity-0/);
    expect(codeOnly(languageSelectorSource)).not.toMatch(/opacity-0/);
  });

  it('desktop and mobile chrome hand over at the SAME breakpoint, so neither doubles up nor disappears', () => {
    expect(navBarSource).toMatch(/cd-header:flex/);
    expect((navBarSource.match(/cd-header:hidden/g) ?? []).length).toBe(2);
    expect(codeOnly(navBarSource)).not.toMatch(/lg:hidden/);
  });
});

/**
 * M66.2 — GN-CD's header data-claim inventory is ZERO: no live indicator, count,
 * timestamp, latency figure or badge. Cheap to lock, and it keeps a clean
 * property clean.
 */
describe('M66.2 — the header makes no data or status claim', () => {
  it('no live indicator, count, timestamp, latency figure or notification badge', () => {
    const code = codeOnly(navBarSource);
    for (const claim of [/\bLIVE\b/, /notification/i, /\bbadge\b/i, /\bUTC\b/, /ACTIVE SIGNALS/i]) {
      expect(code).not.toMatch(claim);
    }
  });

  it('the header issues no request and imports no API client', () => {
    const code = codeOnly(navBarSource);
    expect(code).not.toMatch(/\bfetch\(/);
    expect(code).not.toMatch(/@\/lib\/api\//);
  });
});
