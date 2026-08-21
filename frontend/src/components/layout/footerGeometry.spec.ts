import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { footerLinkGroups } from '@/lib/homeContent';
import { getDictionary } from '@/lib/i18n/dictionaries';
import tailwindConfig from '../../../tailwind.config';

const footerSource = readFileSync(join(__dirname, 'Footer.tsx'), 'utf-8');
const homeContentSource = readFileSync(join(__dirname, '../../lib/homeContent.ts'), 'utf-8');
/* M66.8b — read for comparison only. Neither file is modified by this milestone. */
const pageCanvasSource = readFileSync(join(__dirname, 'PageCanvas.tsx'), 'utf-8');
const homePageSource = readFileSync(join(__dirname, '../../app/page.tsx'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const code = stripComments(footerSource);

interface ThemeExtend {
  colors?: { cd?: Record<string, unknown> };
  fontSize?: Record<string, unknown>;
  backgroundImage?: Record<string, string>;
  boxShadow?: Record<string, string>;
  spacing?: Record<string, string>;
  maxWidth?: Record<string, string>;
}
const themeExtend = (tailwindConfig.theme?.extend ?? {}) as unknown as ThemeExtend;
const cd = (themeExtend.colors?.cd ?? {}) as Record<string, string>;
const fonts = (themeExtend.fontSize ?? {}) as Record<string, [string, Record<string, string>]>;
const spacing = (themeExtend.spacing ?? {}) as Record<string, string>;
const maxWidth = (themeExtend.maxWidth ?? {}) as Record<string, string>;

/**
 * M66.8b — resolve a container's content width from its OWN class string and
 * the evaluated Tailwind config, at a given viewport.
 *
 * Deliberately computed rather than pattern-matched. A test that asserts the
 * class string proves the string; a test that resolves the tokens and does the
 * arithmetic proves the geometry, and it fails if someone repoints `cd-page`
 * or `cd-26` without touching either component. That is the same discipline
 * heroGeometry.spec.ts and engineGeometry.spec.ts already use.
 */
function px(token: string, table: Record<string, string>): number {
  const raw = table[token];
  if (typeof raw !== 'string' || !raw.endsWith('px')) {
    throw new Error(`token ${token} is missing or not a px value: ${String(raw)}`);
  }
  return Number.parseFloat(raw);
}

function contentWidth(classString: string, viewport: number): number {
  const cap = /max-w-cd-page/.test(classString) ? px('cd-page', maxWidth) : Infinity;
  const outer = Math.min(viewport, cap);

  // At and above lg (1024) the lg: padding wins; below it, the base padding.
  const isDesktop = viewport >= 1024;
  const lgPad = /lg:px-cd-(\d+)/.exec(classString)?.[1];
  const basePad = /(?:^|\s)px-cd-(\d+)/.exec(classString)?.[1];
  const token = isDesktop && lgPad ? `cd-${lgPad}` : `cd-${basePad ?? ''}`;
  return outer - 2 * px(token, spacing);
}

const FOOTER_CONTAINER = /<div className="(mx-auto[^"]*max-w-cd-page[^"]*)">/.exec(code)?.[1] ?? '';
const CANVAS_CONTAINER =
  /<div className="(relative mx-auto[^"]*max-w-cd-page[^"]*)">/.exec(stripComments(pageCanvasSource))?.[1] ?? '';

/**
 * M66.7 — GN-CD-200 → GN-CD-204, the released Footer contract.
 *
 * This family is unusual, and the suite is shaped around that: the released
 * design is BEHIND the repository on accessibility and function, so roughly
 * half of what follows protects behaviour the design would have had us remove.
 * GN-CD's own behavioural acceptance items 5 and 6 ask implementers to verify
 * that footer links do nothing and that nothing is keyboard-reachable. CTO
 * decision D-1 A formally records those two as NOT FOLLOWED, and the assertions
 * below are the record.
 */

describe('M66.7 — released outer section (GN-CD-200)', () => {
  it('renders ONE flat bar — the C2.1 band, brackets and second row are gone', () => {
    expect(code).toMatch(/bg-cd-fill-footer/);
    expect(code).toMatch(/rounded-cd-14/);
    expect(code).toMatch(/lg:rounded-cd-16/);
    expect(code).toMatch(/border-cd-edge-structural/);
    expect(code).toMatch(/lg:border-cd-edge-card/);
    expect(code).not.toMatch(/hudCornerBracketClassName|hudPanelGeometry/);
    expect(code).not.toMatch(/border-t border-cyan-500/);
    expect(code).not.toMatch(/bg-surface\/85|bg-void/);
    expect(cd['fill-footer']).toBe('rgba(6,11,22,0.85)');
    expect(cd['edge-card']).toBe('rgba(56,189,248,0.14)');
    expect(cd['edge-structural']).toBe('rgba(56,189,248,0.12)');
  });

  it('carries the released padding and gap on each viewport — mobile padding is ASYMMETRIC, not a scale', () => {
    // Desktop 20px 22px / gap 36. Mobile 6px 18px 6px 10px / gap 12.
    expect(code).toMatch(/lg:px-cd-22/);
    expect(code).toMatch(/lg:py-cd-20/);
    expect(code).toMatch(/lg:gap-cd-36/);
    expect(code).toMatch(/py-cd-6/);
    expect(code).toMatch(/pl-cd-10/);
    expect(code).toMatch(/pr-cd-18/);
    expect(code).toMatch(/gap-cd-12/);
    // The asymmetry is the point: right padding must not equal left padding.
    expect(code).not.toMatch(/(^|\s)px-cd-10|(^|\s)px-cd-18/);
  });

  it('THE LAYER INVENTORY IS A LIST OF ABSENCES — the footer is the terminal surface', () => {
    // GN-CD-200: "the only home section with a flat fill and no technical field
    // of any kind... The page ends by removing every technical layer."
    expect(code).not.toMatch(/gradient/i);
    expect(code).not.toMatch(/bg-cd-grid-|bg-cd-rules-|bg-cd-field-/);
    expect(code).not.toMatch(/shadow-/);
    expect(code).not.toMatch(/backdrop-blur/);
    expect(code).not.toMatch(/clip-path|\[clip-path/);
    expect(code).not.toMatch(/overflow-hidden/);
    expect(code).not.toMatch(/@keyframes|animation:|\banimate-/);
    // ...and this milestone added no gradient or shadow token either.
    const images = (themeExtend.backgroundImage ?? {}) as Record<string, string>;
    const shadows = (themeExtend.boxShadow ?? {}) as Record<string, string>;
    expect(Object.keys(images).some((k) => k.includes('footer'))).toBe(false);
    expect(Object.keys(shadows).some((k) => k.includes('footer'))).toBe(false);
  });

  it('M66.8b — the outer container IS the Claude Design canvas box; M66.7-DEFERRED-001 is closed', () => {
    // GN-CD-200's parent is GN-CD-004: the footer's edges align with the page
    // content box. M66.7 left the legacy 1480/32 wrapper in place under CTO
    // decision D-3 C and deferred the consequence. This is that consequence,
    // resolved — by the container adopting the same box, NOT by moving the
    // Footer (see the wrapper-placement block below).
    expect(code).toMatch(/mx-auto w-full max-w-cd-page px-cd-14 py-6 lg:px-cd-26/);
    // The legacy box is gone in every part of it, not merely renamed.
    expect(code).not.toMatch(/max-w-\[1480px\]/);
    expect(code).not.toMatch(/(^|\s)px-4(\s|\")/);
    expect(code).not.toMatch(/sm:px-6/);
    expect(code).not.toMatch(/lg:px-8/);
    // Vertical rhythm is NOT this milestone's subject: py-6 is retained exactly,
    // and no top margin was invented to fake the released 18px/14px gap.
    expect(code).toMatch(/py-6/);
    expect(code).not.toMatch(/mt-cd-18|mt-cd-14/);
  });
});

describe('M66.7 — released identity block (GN-CD-201)', () => {
  it('the emblem is the released size on each viewport, from ONE instance', () => {
    expect(code).toMatch(/\[&>svg\]:h-\[26px\]/);
    expect(code).toMatch(/\[&>svg\]:w-\[26px\]/);
    expect(code).toMatch(/lg:\[&>svg\]:h-\[28px\]/);
    expect(code).toMatch(/lg:\[&>svg\]:w-\[28px\]/);
    // One <Logo />, not one per breakpoint — the emblem carries three running
    // animations, so a hidden duplicate would run them twice.
    expect((code.match(/<Logo/g) ?? []).length).toBe(1);
    expect(code).toMatch(/gap-cd-11/);
  });

  it('the footer wordmark DROPS the cyan "AI" that both headers carry', () => {
    // GN-CD-201: "footer lockup = one uniform colour. A real divergence in the
    // brand lockup, recorded." Asserted directly, because this is the released
    // detail most likely to be "fixed" back by someone matching the header.
    expect(code).toMatch(/showWordmark=\{false\}/);
    expect(code).toMatch(/GlobalNews AI/);
    expect(code).not.toMatch(/text-cd-ink-wordmark/);
    expect(code).not.toMatch(/#38bdf8/);
    const wordmarkLine = code.slice(code.indexOf('GlobalNews AI') - 260, code.indexOf('GlobalNews AI'));
    expect(wordmarkLine).toMatch(/text-cd-ink-primary/);
  });

  it('the released identity type roles are used at both viewports', () => {
    expect(code).toMatch(/text-cd-footer-ident-m/);
    expect(code).toMatch(/lg:text-cd-lockup/);
    expect(fonts['cd-footer-ident-m']).toEqual(['13px', { fontWeight: '600' }]);
    expect(fonts['cd-lockup']).toEqual(['15px', { lineHeight: '1.35', fontWeight: '600' }]);
    // ERRATUM-013's mono tagline role, including the .1em tracking the released
    // scale did not previously carry at that size.
    expect(fonts['cd-mono-tagline-m']).toEqual(['8.5px', { letterSpacing: '0.1em' }]);
  });

  it('the identity block is NOT a link — unlike both headers', () => {
    const identity = code.slice(code.indexOf('<Logo'), code.indexOf('</nav>'));
    expect(identity).not.toMatch(/<a /);
    expect(identity).not.toMatch(/onClick/);
  });
});

describe('M66.7 — released link row (GN-CD-202) and tagline plate (GN-CD-204)', () => {
  it('links use the released type, colour and gap on each viewport', () => {
    expect(code).toMatch(/text-cd-footer-legal-m/);
    expect(code).toMatch(/lg:text-cd-footer-link/);
    expect(code).toMatch(/text-cd-ink-tertiary/);
    expect(code).toMatch(/lg:text-cd-ink-secondary/);
    expect(code).toMatch(/hover:text-cd-accent-cyan/);
    expect(code).toMatch(/gap-cd-9/);
    expect(code).toMatch(/lg:gap-cd-22/);
    expect(fonts['cd-footer-link']).toEqual(['13px', {}]);
    expect(fonts['cd-footer-legal-m']).toEqual(['10.5px', {}]);
  });

  it('the mobile divider is present, mobile-only, and decorative', () => {
    expect(code).toMatch(/h-\[12px\] w-px bg-cd-edge-control lg:hidden/);
    expect(cd['edge-control']).toBe('rgba(56,189,248,0.20)');
    const divider = code.slice(code.indexOf('h-[12px] w-px') - 160, code.indexOf('h-[12px] w-px'));
    expect(divider).toMatch(/aria-hidden="true"/);
  });

  it('the tagline plate is desktop-only and carries the footer’s strongest border', () => {
    expect(code).toMatch(/border-cd-edge-plate/);
    expect(code).toMatch(/rounded-cd-10/);
    expect(code).toMatch(/px-cd-16/);
    expect(code).toMatch(/py-cd-11/);
    expect(code).toMatch(/text-cd-mono-plate/);
    expect(code).toMatch(/text-right/);
    expect(code).toMatch(/text-cd-ink-label/);
    const plate = code.slice(code.lastIndexOf('border-cd-edge-plate') - 40, code.lastIndexOf('border-cd-edge-plate') + 260);
    expect(plate).toMatch(/hidden/);
    expect(plate).toMatch(/lg:block/);
    // .30 is stronger than the section's own .14 — that is what makes the plate
    // the far-right terminus.
    expect(cd['edge-plate']).toBe('rgba(56,189,248,0.30)');
    expect(Number(cd['edge-plate'].match(/([\d.]+)\)$/)?.[1])).toBeGreaterThan(
      Number(cd['edge-card'].match(/([\d.]+)\)$/)?.[1]),
    );
    // The plate role bakes in line-height 1.7; cd-mono-expand (same size and
    // tracking) does not, and a tuple without one emits none.
    expect(fonts['cd-mono-plate']).toEqual(['10.5px', { letterSpacing: '0.14em', lineHeight: '1.7' }]);
  });

  it('the released flex spacer pushes the plate to the far right on desktop only', () => {
    expect(code).toMatch(/hidden flex-1 lg:block/);
  });
});

describe('M66.7 — ROUTE TRUTH (CTO decision D-6 A)', () => {
  // M66.10B — /source-policy joins the list because the route now EXISTS on
  // disk (src/app/source-policy/page.tsx, shipped in this same change). The
  // route-existence assertion below proves that rather than assuming it, so
  // this array can never drift back into being a list of hopeful strings.
  const REAL_ROUTES = [
    '/',
    '/search',
    '/map',
    '/history',
    '/workspace',
    '/privacy',
    '/terms',
    '/source-policy',
  ];

  it('links derive entirely from footerLinkGroups — this component has no destination list', () => {
    expect(code).toMatch(/footerLinkGroups\.flatMap/);
    expect(code).toMatch(/allLinks\.map/);
    expect(code).toMatch(/href=\{link\.href\}/);
    // Exactly one href expression, and it is the configured one.
    expect((code.match(/href=/g) ?? []).length).toBe(1);
  });

  it('every rendered destination is a real, existing route', () => {
    // M66.10B — three, not two: Privacy Policy, Terms of Service, Source Policy.
    expect(footerLinkGroups.flatMap((group) => group.links)).toHaveLength(3);
    for (const link of footerLinkGroups.flatMap((group) => group.links)) {
      expect(REAL_ROUTES).toContain(link.href);
    }
  });

  it('ROUTE TRUTH IS FILESYSTEM-BACKED — every footer destination has a real page.tsx on disk', () => {
    // M66.10B — this is the assertion that makes the whole family safe. Membership
    // in REAL_ROUTES is a string check and a string check can be edited into a lie;
    // this one cannot pass unless the App Router page file actually exists. Same
    // technique as M66.8c's retire-don't-delete guard.
    //
    // '/' maps to app/page.tsx; every other footer destination maps to
    // app/<segment>/page.tsx. Only footer destinations are checked here — the
    // wider REAL_ROUTES list is the allow-list, this is the proof obligation.
    for (const link of footerLinkGroups.flatMap((group) => group.links)) {
      const segment = link.href === '/' ? '' : link.href.replace(/^\//, '');
      const routeFile = join(__dirname, '../../app', segment, 'page.tsx');
      expect(existsSync(routeFile)).toBe(true);
    }
    // And the new one explicitly, so a future refactor of the loop above cannot
    // silently stop covering it.
    expect(existsSync(join(__dirname, '../../app/source-policy/page.tsx'))).toBe(true);
  });

  it('the three released labels with no route are STILL NOT rendered and NOT faked', () => {
    // GN-CD-202 marks all six "UNRESOLVED — repository reconciliation required".
    //
    // M66.10B — this list was six entries and is now four. `/source-policy` and
    // `Source Policy` were REMOVED FROM IT because the route is now real: leaving
    // them would have left a factually false statement in this suite. Note that
    // neither removal was forced by a failure — Footer.tsx holds no destination
    // list at all, so both assertions passed either way. They are corrected on
    // truthfulness grounds, not repaired on failure grounds.
    //
    // About, Careers and Contact still have no routes and no pages, and `/api`
    // still has neither. Those four stay guarded, here and in footerNavHud.spec.ts.
    for (const fake of ['/about', '/careers', '/contact', '/api', '/sources']) {
      expect(code).not.toContain(fake);
    }
    for (const label of ['About', 'Careers', 'Contact']) {
      expect(code).not.toContain(label);
    }
    // homeContent.ts still holds ONLY real legal routes — the four dead ones are
    // absent from the model, not merely absent from the component.
    expect(homeContentSource).not.toMatch(/'\/about'|'\/careers'|'\/contact'|'\/api'/);
    // And Footer.tsx still has no destination list of its own, which is WHY the
    // component-level assertions above are weak evidence and the model-level and
    // filesystem-level ones are the real contract.
    expect(code).not.toMatch(/href="\//);
  });

  it('the comingSoon guard survives, so a future non-route can never masquerade as available', () => {
    expect(code).toMatch(/link\.comingSoon &&/);
    expect(code).toMatch(/\{t\.comingSoon\}/);
  });

  it('LEGAL TRUTH — /privacy, /source-policy and /terms are real, localized, and need no authentication', () => {
    // M66.10B — the MVP legal destination set, exact and sorted. Adding a fourth
    // link, or dropping one, fails here rather than silently shipping.
    const LEGAL_ROUTES = ['/privacy', '/source-policy', '/terms'];
    const hrefs = footerLinkGroups.flatMap((group) => group.links).map((link) => link.href).sort();
    expect(hrefs).toEqual(LEGAL_ROUTES);
    for (const language of ['en', 'pl'] as const) {
      const labels = getDictionary(language).footer.linkLabels;
      for (const route of LEGAL_ROUTES) {
        expect(labels[route].length).toBeGreaterThan(0);
      }
    }
    // Localized in fact, not merely present as a key.
    for (const route of LEGAL_ROUTES) {
      expect(getDictionary('pl').footer.linkLabels[route]).not.toBe(
        getDictionary('en').footer.linkLabels[route],
      );
    }
    expect(code).not.toMatch(/useAccount|session|isAuthenticated/);
  });
});

describe('M66.7 — BEHAVIOUR PRESERVED (CTO decision D-1 A)', () => {
  it('acceptance item 5 is NOT followed: the links are real anchors that navigate', () => {
    // GN-CD asks implementers to verify "all footer links do nothing when
    // clicked (DEFECT-044 — verify as reported, not fixed)". Recorded as not
    // followed: it contradicts the standing accessibility contract.
    expect(code).toMatch(/<a\b/);
    expect(code).not.toMatch(/<span[^>]*cursor:pointer/);
    expect(code).not.toMatch(/cursor-pointer/);
  });

  it('acceptance item 6 is NOT followed: every link is keyboard-reachable by construction', () => {
    // Native anchors carry href, so they are in the tab order and receive the
    // global :focus-visible treatment. No tabIndex or role is needed or used.
    expect(code).toMatch(/href=\{link\.href\}/);
    expect(code).not.toMatch(/tabIndex=\{-1\}/);
    expect(code).not.toMatch(/role="link"/);
  });

  it('DEFECT-050 is not reproduced: a real <footer> landmark with a labelled <nav>', () => {
    expect(code).toMatch(/<footer/);
    expect(code).toMatch(/<\/footer>/);
    expect(code).toMatch(/<nav aria-label=/);
  });

  it('CTO decision D-4 A — the nav accessible name is a concise EXISTING localized string', () => {
    expect(code).toMatch(/aria-label=\{t\.groupTitles\.Legal\}/);
    expect(code).not.toMatch(/aria-label=\{t\.tagline\}/);
    for (const language of ['en', 'pl'] as const) {
      const label = getDictionary(language).footer.groupTitles.Legal;
      expect(label.length).toBeGreaterThan(0);
      expect(label.length).toBeLessThan(24);
    }
    expect(getDictionary('pl').footer.groupTitles.Legal).not.toBe(
      getDictionary('en').footer.groupTitles.Legal,
    );
  });

  it('DEFECT-049 is not reproduced: the copyright is present, derived and localized', () => {
    expect(code).toMatch(/currentYear/);
    expect(code).toMatch(/new Date\(\)\.getFullYear\(\)/);
    expect(code).toMatch(/\{t\.copyrightSuffix\}/);
    // Derived, never a hardcoded year.
    expect(code).not.toMatch(/\b20\d\d\b/);
    for (const language of ['en', 'pl'] as const) {
      expect(getDictionary(language).footer.copyrightSuffix.length).toBeGreaterThan(0);
    }
  });

  it('DEFECT-022 / DEFECT-023 stay fixed — the emblem is instance-unique and decorative', () => {
    const logoSource = readFileSync(join(__dirname, '../ui/Logo.tsx'), 'utf-8');
    expect(logoSource).toMatch(/useId\(\)/);
    expect(logoSource).toMatch(/aria-hidden/);
    // Logo.tsx is M66.2-accepted and consumed through its existing props only.
    expect(code).toMatch(/showWordmark=\{false\}/);
    expect(code).toMatch(/size=\{28\}/);
  });

  it('DEFECT-047 is not reproduced: mobile targets clear 44px on BOTH axes', () => {
    // GN-CD's own mobile links are 44px tall but label-width-derived — measured
    // at ~42.8px for the English abbreviations.
    expect(code).toMatch(/min-h-\[44px\]/);
    expect(code).toMatch(/min-w-\[44px\]/);
    expect(code).toMatch(/lg:min-h-0/);
    expect(code).toMatch(/lg:min-w-0/);
  });
});

describe('M66.7 — the released absences', () => {
  it('CTO decision D-5 A — GN-CD-203 share controls are omitted, with no infrastructure created', () => {
    expect(code).not.toMatch(/LinkedIn|WhatsApp|ShareControls/i);
    expect(code).not.toMatch(/navigator\.(clipboard|share)/);
    expect(code).not.toMatch(/toast|notify\(/i);
    expect(code).not.toMatch(/x\.com|twitter\.com|linkedin\.com|wa\.me|whatsapp\.com/i);
  });

  it('the footer reads no data and issues no request', () => {
    expect(footerSource).not.toMatch(/fetch\(/);
    expect(footerSource).not.toMatch(/@\/lib\/api\//);
    expect(footerSource).not.toMatch(/useState|useEffect|useRouter/);
    expect(footerSource.trimStart().startsWith("'use client'")).toBe(false);
  });

  it('GN-CD counts ZERO numbers in this family — the copyright year is the one derived value', () => {
    const withoutClasses = code.replace(/className="[^"]*"/g, '').replace(/\[&>svg\][^\s"]*/g, '');
    expect(withoutClasses).not.toMatch(/\d+%/);
    expect(withoutClasses).not.toMatch(/\b\d{2,}\s*(sources|countries|articles|updates)\b/i);
    expect(code).not.toMatch(/LIVE|MONITORING|LATENCY/);
  });
});

describe('M66.7 — responsive gate (CTO decision D-7 A)', () => {
  it('there is EXACTLY ONE gate, and it is lg — no invented third layout', () => {
    const prefixes = new Set(
      (code.match(/\b(sm|md|lg|xl|2xl|cd-header|cd-hero|cd-engine):/g) ?? []).map((p) => p.replace(':', '')),
    );
    // M66.8b: `sm:` is gone. It lived only in the legacy outer container, whose
    // 16/24/32px ladder stepped at a breakpoint PageCanvas does not have. The
    // canvas box is flat 14px then 26px at lg, so this component now has
    // EXACTLY ONE gate — which is what D-7 A asked for and could not have while
    // that container remained.
    expect([...prefixes].sort()).toEqual(['lg']);
    const bar = code.slice(code.indexOf('flex flex-wrap items-center'));
    expect(new Set((bar.match(/\b(sm|md|xl|2xl):/g) ?? []))).toEqual(new Set());
  });

  it('nothing is solved by scaling', () => {
    expect(code).not.toMatch(/scale\(/);
    expect(code).not.toMatch(/\bscale-\d/);
  });
});

describe('M66.7 — copy (CTO decision D-4 A): no dictionary was modified', () => {
  it('the released tagline plate and the mobile identity sub-line carry the SAME existing string', () => {
    // GN-CD-204: "the same words appear as the identity block's mono sub-line".
    expect((code.match(/\{t\.closingTagline\}/g) ?? []).length).toBe(2);
  });

  it('the released two-line desktop description is omitted rather than approximated', () => {
    expect(code).not.toMatch(/\{t\.tagline\}/);
    expect(code).not.toMatch(/AI-powered|Evidence-based|curious minds/);
  });

  it('no hard <br /> survives — which is what removes MLR-18 and MLR-19', () => {
    expect(code).not.toMatch(/<br/);
  });

  it('every visible string is localized in both languages, and none is new', () => {
    for (const language of ['en', 'pl'] as const) {
      const t = getDictionary(language).footer;
      expect(t.closingTagline.length).toBeGreaterThan(0);
      expect(t.copyrightSuffix.length).toBeGreaterThan(0);
      expect(t.groupTitles.Legal.length).toBeGreaterThan(0);
    }
    const en = getDictionary('en').footer;
    const pl = getDictionary('pl').footer;
    expect(pl.closingTagline).not.toBe(en.closingTagline);
    expect(pl.copyrightSuffix).not.toBe(en.copyrightSuffix);
    // The only hardcoded English in the component is the brand name itself.
    expect(code.match(/>[A-Z][a-z]+ [A-Z][a-z]+</g) ?? []).toEqual([]);
  });
});

describe('M66.7 — accessibility and multilingual', () => {
  it('CONTRAST, computed — UNRESOLVED-011 resolved for this family', () => {
    const channel = (value: number): number => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ([r, g, b]: [number, number, number]): number =>
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const ratio = (a: [number, number, number], b: [number, number, number]): number => {
      const la = luminance(a);
      const lb = luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    const hex = (value: string): [number, number, number] => {
      const h = value.replace('#', '');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    };
    const page: [number, number, number] = [4, 6, 12];
    const fill: [number, number, number] = [
      6 * 0.85 + page[0] * 0.15,
      11 * 0.85 + page[1] * 0.15,
      22 * 0.85 + page[2] * 0.15,
    ];
    // Every colour this family puts on the footer fill.
    for (const colour of ['#e8f1ff', '#7f9dbd', '#a7c0d8', '#9fbdd8', '#7dd3fc', '#22d3ee']) {
      expect(ratio(hex(colour), fill)).toBeGreaterThanOrEqual(4.5);
    }
    // The worst case in the family, locked.
    expect(ratio(hex('#7f9dbd'), fill)).toBeGreaterThan(7);
  });

  it('the wrap-not-clip guarantee holds — no nowrap, no clamp, no fixed height', () => {
    expect(code).not.toMatch(/whitespace-nowrap/);
    expect(code).not.toMatch(/line-clamp|text-ellipsis/);
    // The ONLY fixed heights in the family are the released 1px x 12px legal
    // divider and the emblem's two sizings. No text box has one.
    const fixedHeights = (code.match(/(?<!min-)\bh-\[\d+px\]/g) ?? []).sort();
    expect(fixedHeights).toEqual(['h-[12px]', 'h-[26px]', 'h-[28px]']);
    // flex-wrap is the MLR-22 mitigation: Polish legal labels have no short
    // form, so the row must be able to drop rather than clip.
    expect(code).toMatch(/flex-wrap/);
    expect(code).toMatch(/lg:flex-nowrap/);
    expect(code).toMatch(/min-w-0/);
  });

  it('the desktop link row fits its measured budget in both languages', () => {
    // IBM Plex Sans mixed-case averages ~0.50 em; the budget below is derived
    // from GN-CD SS-C: 1388 content - 44 padding - 3x36 gaps - identity - plate.
    const sans = (text: string, px: number): number => text.length * px * 0.5;
    const budget = 1388 - 44 - 3 * 36 - 240 - 158;
    for (const language of ['en', 'pl'] as const) {
      const labels = footerLinkGroups
        .flatMap((group) => group.links)
        .map((link) => getDictionary(language).footer.linkLabels[link.href]);
      const row = labels.reduce((sum, label) => sum + sans(label, 13), 0) + 22 * (labels.length - 1);
      expect(row).toBeLessThan(budget);
    }
  });
});

describe('M66.8b — canvas alignment (resolves M66.7-DEFERRED-001)', () => {
  it('the Footer wrapper and PageCanvas resolve to the SAME box, token for token', () => {
    // Not "both contain max-w-cd-page" — the same cap AND the same padding at
    // both gates. Two containers that agree by coincidence would pass a string
    // match and fail this.
    expect(FOOTER_CONTAINER).not.toBe('');
    expect(CANVAS_CONTAINER).not.toBe('');
    expect(/max-w-cd-page/.test(FOOTER_CONTAINER)).toBe(true);
    expect(/max-w-cd-page/.test(CANVAS_CONTAINER)).toBe(true);
    expect(/(?:^|\s)px-cd-14(?:\s|$)/.test(FOOTER_CONTAINER)).toBe(true);
    expect(/(?:^|\s)px-cd-14(?:\s|$)/.test(CANVAS_CONTAINER)).toBe(true);
    expect(/lg:px-cd-26/.test(FOOTER_CONTAINER)).toBe(true);
    expect(/lg:px-cd-26/.test(CANVAS_CONTAINER)).toBe(true);
    // And the underlying tokens are real, so this cannot pass on a typo.
    expect(maxWidth['cd-page']).toBe('1500px');
    expect(spacing['cd-14']).toBe('14px');
    expect(spacing['cd-26']).toBe('26px');
  });

  it('at 1440px the Footer content box is 1388px — the released GN-CD SS-C width', () => {
    expect(contentWidth(CANVAS_CONTAINER, 1440)).toBe(1388);
    expect(contentWidth(FOOTER_CONTAINER, 1440)).toBe(1388);
    expect(contentWidth(FOOTER_CONTAINER, 1440)).toBe(contentWidth(CANVAS_CONTAINER, 1440));
  });

  it('at 1280px both boxes are 1228px', () => {
    expect(contentWidth(CANVAS_CONTAINER, 1280)).toBe(1228);
    expect(contentWidth(FOOTER_CONTAINER, 1280)).toBe(1228);
  });

  it('the 12px deficit is gone at every desktop viewport, and the 32px one above 1500 with it', () => {
    for (const viewport of [1024, 1280, 1366, 1440, 1500, 1600, 1920, 2560]) {
      expect(contentWidth(FOOTER_CONTAINER, viewport)).toBe(contentWidth(CANVAS_CONTAINER, viewport));
    }
    // The old box, recomputed here so the regression it caused stays on record:
    // min(vw,1480) - 2*32 gave 1376 at 1440 and 1216 at 1280.
    const legacy = (vw: number) => Math.min(vw, 1480) - 64;
    expect(legacy(1440)).toBe(1376);
    expect(contentWidth(FOOTER_CONTAINER, 1440) - legacy(1440)).toBe(12);
    expect(legacy(1280)).toBe(1216);
    expect(contentWidth(FOOTER_CONTAINER, 1280) - legacy(1280)).toBe(12);
  });

  it('the left edge lands at the same x as PageCanvas, which is what is actually visible', () => {
    // Equal widths with unequal caps would still misalign. Both are centred by
    // mx-auto, so left = (vw - min(vw,cap))/2 + padding.
    const leftEdge = (classString: string, vw: number): number => {
      const cap = /max-w-cd-page/.test(classString) ? px('cd-page', maxWidth) : Infinity;
      const outer = Math.min(vw, cap);
      const pad = vw >= 1024 ? px('cd-26', spacing) : px('cd-14', spacing);
      return (vw - outer) / 2 + pad;
    };
    for (const viewport of [1280, 1440, 1600, 1920]) {
      expect(leftEdge(FOOTER_CONTAINER, viewport)).toBe(leftEdge(CANVAS_CONTAINER, viewport));
    }
  });

  it('below lg the Footer follows the canvas too — one ladder, not two', () => {
    // What naturally follows from the approved shared tokens, and no more. The
    // legacy ladder was 16 / 24 at sm / 32 at lg; the canvas is a flat 14 then
    // 26 at lg. At 390px that is +4px of content width, and the sm step that
    // PageCanvas never had is gone. M66.7-R1 mobile COMPOSITION is untouched.
    for (const viewport of [360, 390, 414, 768, 1023]) {
      expect(contentWidth(FOOTER_CONTAINER, viewport)).toBe(contentWidth(CANVAS_CONTAINER, viewport));
    }
    expect(contentWidth(FOOTER_CONTAINER, 390)).toBe(362);
    expect(390 - 2 * 16).toBe(358); // the legacy value, for the record
  });
});

describe('M66.8b — what deliberately did NOT change', () => {
  it('the Footer is still OUTSIDE PageCanvas — it was not moved', () => {
    const page = stripComments(homePageSource);
    const canvasBlock = page.slice(page.indexOf('<PageCanvas>'), page.indexOf('</PageCanvas>'));
    expect(canvasBlock).not.toContain('<Footer');
    // M66.1 asserted this on purpose. Confirmed here, read-only, so M66.8b
    // cannot be mistaken for the wrapper move it deliberately is not.
    expect(page).toMatch(/<\/main>/);
    expect(page.indexOf('<Footer')).toBeGreaterThan(page.indexOf('</PageCanvas>'));
  });

  it('app/page.tsx and PageCanvas.tsx were not modified by this milestone', () => {
    // Read-only assertions on their load-bearing lines. If either were edited
    // to make the Footer fit, one of these would fail.
    expect(homePageSource).toMatch(/<main className="pb-16 lg:pb-0">/);
    expect(homePageSource).toMatch(/<Footer language=\{language\} \/>/);
    expect(pageCanvasSource).toMatch(
      /relative mx-auto w-full max-w-cd-page px-cd-14 pb-cd-22 pt-cd-12 lg:px-cd-26 lg:pb-cd-60 lg:pt-cd-20/,
    );
  });

  it('ONE shared Footer still serves all eight routes — no route-specific variant', () => {
    const routes = [
      ['../../app/page.tsx', 'language={language}'],
      ['../../app/search/page.tsx', 'language={language}'],
      ['../../app/map/page.tsx', 'language={language}'],
      ['../../app/privacy/page.tsx', 'language={language}'],
      ['../../app/terms/page.tsx', 'language={language}'],
      // M66.10B — the eighth route. It passes language={language} like the other
      // two legal pages, NOT like /history and /workspace.
      ['../../app/source-policy/page.tsx', 'language={language}'],
      ['../../app/history/page.tsx', ''],
      ['../../app/workspace/page.tsx', ''],
    ] as const;
    for (const [relative] of routes) {
      const source = stripComments(readFileSync(join(__dirname, relative), 'utf-8'));
      expect(source).toMatch(/<Footer/);
      expect(source).toMatch(/from '@\/components\/layout\/Footer'/);
    }
    // /history and /workspace still pass no language prop. That is
    // M66.7-DEFERRED-004, deliberately NOT fixed here.
    expect(stripComments(readFileSync(join(__dirname, '../../app/history/page.tsx'), 'utf-8'))).toMatch(
      /<Footer \/>/,
    );
  });

  it('no second Footer variant exists anywhere in the component', () => {
    // One <footer> element, one container, no route/pathname branching and no
    // conditional width.
    expect((code.match(/<footer/g) ?? []).length).toBe(1);
    expect((code.match(/max-w-cd-page/g) ?? []).length).toBe(1);
    expect(code).not.toMatch(/usePathname|useRouter|useSearchParams/);
    expect(code).not.toMatch(/pathname/i);
    expect(code).not.toMatch(/variant|isHome|isHomepage/i);
  });

  it('every M66.7 behaviour survives — this milestone touched geometry only', () => {
    // Links, copyright, semantics, EN/PL, and the D-1 A behaviour guarantees.
    expect(code).toMatch(/footerLinkGroups\.flatMap/);
    expect(code).toMatch(/allLinks\.map/);
    expect(code).toMatch(/t\.linkLabels\[link\.href\] \?\? link\.label/);
    expect(code).toMatch(/new Date\(\)\.getFullYear\(\)/);
    expect(code).toMatch(/<footer>/);
    expect(code).toMatch(/<nav aria-label=/);
    expect(code).toMatch(/<a\s+href=\{link\.href\}/);
    expect(code).toMatch(/getDictionary\(language\)\.footer/);
    // M66.10B — exactly the three real routes, still real anchors.
    expect(homeContentSource).toMatch(/'\/privacy'/);
    expect(homeContentSource).toMatch(/'\/terms'/);
    expect(homeContentSource).toMatch(/'\/source-policy'/);
  });

  it('no data, fetch or API behaviour was introduced — the Footer still does none', () => {
    expect(code).not.toMatch(/\bfetch\(/);
    expect(code).not.toMatch(/useEffect|useState|useReducer|useSWR/);
    expect(code).not.toMatch(/'use client'/);
    expect(code).not.toMatch(/api\/|Api\(|axios/);
  });
});
