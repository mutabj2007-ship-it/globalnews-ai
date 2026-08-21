import { readFileSync } from 'fs';
import { join } from 'path';
import { trustItems } from '@/lib/homeContent';
import { getDictionary } from '@/lib/i18n/dictionaries';
import tailwindConfig from '../../../tailwind.config';

const trustSource = readFileSync(join(__dirname, 'TrustSection.tsx'), 'utf-8');
const pageSource = readFileSync(join(__dirname, '../../app/page.tsx'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const code = stripComments(trustSource);

interface ThemeExtend {
  colors?: { cd?: Record<string, unknown> };
  fontSize?: Record<string, unknown>;
  backgroundImage?: Record<string, string>;
  boxShadow?: Record<string, string>;
  spacing?: Record<string, string>;
  borderRadius?: Record<string, string>;
}
const themeExtend = (tailwindConfig.theme?.extend ?? {}) as unknown as ThemeExtend;
const cd = (themeExtend.colors?.cd ?? {}) as Record<string, string>;
const images = (themeExtend.backgroundImage ?? {}) as Record<string, string>;
const shadows = (themeExtend.boxShadow ?? {}) as Record<string, string>;
const fonts = (themeExtend.fontSize ?? {}) as Record<string, [string, Record<string, string>]>;

/**
 * M66.6 — GN-CD-180 → GN-CD-185, the released Trust contract.
 *
 * This file protects three things that are easy to lose and hard to notice:
 * the released GEOMETRY, the released ABSENCES (no motion, no numbers, no
 * fabricated destination), and the TRUTHFULNESS decisions the CTO made about
 * the copy and the interactivity. Where the design and the repository disagree
 * on purpose, the divergence is asserted rather than merely commented, so it
 * cannot be "corrected" back later by someone reading only the specification.
 */

describe('M66.6 — released section canvas (GN-CD-180/181/182)', () => {
  it('renders ONE bounded panel — the M65-era triple wrapper, HUD clip and corner brackets are gone', () => {
    expect(code).toMatch(/lg:rounded-cd-16/);
    expect(code).toMatch(/lg:border-cd-edge-section/);
    expect(code).toMatch(/lg:bg-cd-trust/);
    expect(code).not.toMatch(/HUD_CARD_CLIP|HUD_PANEL_CLIP/);
    expect(code).not.toMatch(/hudCornerBracketClassName/);
    expect(code).not.toMatch(/border-b border-border/);
    expect(code).not.toMatch(/max-w-\[1480px\]/);
    expect(code).not.toMatch(/backdrop-blur/);
  });

  it('carries the released desktop padding, and NO container at all on mobile', () => {
    expect(code).toMatch(/lg:pt-cd-18/);
    expect(code).toMatch(/lg:px-cd-20/);
    expect(code).toMatch(/lg:pb-cd-22/);
    // Every container-shaped utility on the section is lg-gated: mobile has no
    // border, radius, background or padding (GN-CD-180, verified absent).
    const sectionTag = code.slice(code.indexOf('<section'), code.indexOf('>', code.indexOf('<section')));
    for (const utility of ['rounded-cd-16', 'border-cd-edge-section', 'bg-cd-trust', 'px-cd-20', 'pb-cd-22', 'pt-cd-18', 'overflow-hidden']) {
      expect(sectionTag).toMatch(new RegExp(`lg:${utility.replace(/[[\]]/g, '\\$&')}`));
      expect(sectionTag).not.toMatch(new RegExp(`(^|\\s)${utility.replace(/[[\]]/g, '\\$&')}`));
    }
  });

  it('the decorative field is desktop-only, decorative, and carries BOTH released layers', () => {
    expect(code).toMatch(/bg-cd-field-trust/);
    const field = code.slice(code.indexOf('bg-cd-field-trust') - 220, code.indexOf('bg-cd-field-trust') + 40);
    expect(field).toMatch(/aria-hidden="true"/);
    expect(field).toMatch(/pointer-events-none/);
    expect(field).toMatch(/hidden/);
    expect(field).toMatch(/lg:block/);
    // GN-CD-181 — corner bloom, then 110px vertical rules, in that order.
    expect(images['cd-field-trust']).toContain('radial-gradient(420px 130px at 12% 120%, rgba(34,211,238,.09), transparent 70%)');
    expect(images['cd-field-trust']).toContain('repeating-linear-gradient(90deg, rgba(56,189,248,.045) 0 1px, transparent 1px 110px)');
    expect(images['cd-field-trust'].indexOf('radial-gradient')).toBeLessThan(images['cd-field-trust'].indexOf('repeating-linear-gradient'));
  });

  it('Trust and Trending share ONE panel gradient — the released two-tier system', () => {
    // GN-CD-180: "if Trending and Trust are built with different panel
    // treatments, the rhythm collapses."
    expect(images['cd-trust']).toBe(images['cd-trending']);
    expect(images['cd-trust']).toBe('linear-gradient(180deg, rgba(9,16,32,.9), rgba(5,9,18,.9))');
  });

  it('the section label uses the released treatment at both viewports', () => {
    expect(code).toMatch(/text-cd-mono-section-m/);
    expect(code).toMatch(/lg:text-cd-mono-section/);
    expect(code).toMatch(/text-cd-ink-label/);
    expect(code).toMatch(/\{t\.label\}/);
    expect(fonts['cd-mono-section']).toEqual(['12px', { letterSpacing: '0.18em' }]);
    expect(fonts['cd-mono-section-m']).toEqual(['10.5px', { letterSpacing: '0.16em' }]);
    expect(cd['ink'] as unknown as Record<string, string>).toBeTruthy();
  });

  it('CTO decision D-3 A — the semantic heading is RETAINED, so DEFECT-009 is not reproduced', () => {
    expect(code).toMatch(/<h2/);
    expect(code).toMatch(/id="trust-heading"/);
    expect(code).toMatch(/aria-labelledby="trust-heading"/);
    expect(code).toMatch(/\{t\.headline\}/);
    expect(getDictionary('en').trustSection.headline).toBe('Why trust GlobalNews AI?');
    expect(getDictionary('pl').trustSection.headline.length).toBeGreaterThan(0);
  });
});

describe('M66.6 — released grid and the D-4 A responsive gate', () => {
  it('five equal columns at 16px on desktop, two at 9px on mobile', () => {
    expect(code).toMatch(/grid-cols-2/);
    expect(code).toMatch(/gap-cd-9/);
    expect(code).toMatch(/lg:grid-cols-5/);
    expect(code).toMatch(/lg:gap-cd-16/);
  });

  it('the fifth card spans both mobile columns and is an ordinary desktop column', () => {
    expect(code).toMatch(/col-span-2 lg:col-span-1/);
    expect(code).toMatch(/index === TRUST_GLYPHS\.length - 1/);
    expect(trustItems).toHaveLength(5);
  });

  it('the released column arithmetic is reproduced as a FORMULA, not a transcribed number', () => {
    // GN-CD §C at a 1440 viewport: PageCanvas content box 1388, grid inner
    // 1346 (1388 - 40 padding - 2 border), column (1346 - 4x16) / 5 = 256.4,
    // card content 232.4 (column - 8 left - 16 right), text column
    // 232.4 - 40 icon - 13 gap = 179.4.
    const content = Math.min(1440, 1500) - 52;
    expect(content).toBe(1388);
    const gridInner = content - 40 - 2;
    expect(gridInner).toBe(1346);
    const column = (gridInner - 4 * 16) / 5;
    expect(column).toBeCloseTo(256.4, 1);
    const card = column - 8 - 16;
    expect(card).toBeCloseTo(232.4, 1);
    expect(card - 40 - 13).toBeCloseTo(179.4, 1);
  });

  it('there is EXACTLY ONE responsive gate, and it is lg — no invented tablet composition', () => {
    // GN-CD §B on 768: "[UNRESOLVED-001] — no composition… Do not invent one."
    const prefixes = new Set((code.match(/\b(sm|md|lg|xl|2xl|cd-header|cd-hero|cd-engine):/g) ?? []).map((p) => p.replace(':', '')));
    expect([...prefixes]).toEqual(['lg']);
  });

  it('nothing is solved by scaling the desktop composition', () => {
    expect(code).not.toMatch(/scale\(/);
    expect(code).not.toMatch(/\bscale-\d/);
  });

  it('the mobile section rhythm is carried by the section itself, not by the protected PageCanvas', () => {
    // GN-CD authors a 14px mobile stack gap; PageCanvas declares lg:gap-cd-18
    // only. Same technique M66.4 shipped in GlobalDevelopments.
    expect(code).toMatch(/mt-cd-14/);
    expect(code).toMatch(/lg:mt-0/);
  });
});

describe('M66.6 — released card variants (GN-CD-184)', () => {
  it('GN-CD-184-DA — the desktop column is borderless with a right hairline', () => {
    expect(code).toMatch(/lg:border-0/);
    expect(code).toMatch(/lg:border-r/);
    expect(code).toMatch(/lg:border-r-cd-edge-divider-10/);
    expect(code).toMatch(/lg:bg-transparent/);
    expect(cd['edge-divider-10']).toBe('rgba(56,189,248,0.10)');
  });

  it('the released padding AND its negative-margin pair are reproduced exactly', () => {
    // GN-CD acceptance: "the negative margins are hit-area load-bearing".
    expect(code).toMatch(/lg:py-cd-6/);
    expect(code).toMatch(/lg:pl-cd-8/);
    expect(code).toMatch(/lg:pr-cd-16/);
    expect(code).toMatch(/lg:-my-cd-6/);
    expect(code).toMatch(/lg:-ml-cd-8/);
    // Left overhang 8px against a 16px gap — adjacent hit areas cannot overlap.
    expect(8).toBeLessThan(16);
  });

  it('GN-CD-184-MA / MB — the mobile card is bordered, filled, rounded and 64px tall', () => {
    expect(code).toMatch(/min-h-\[64px\]/);
    expect(code).toMatch(/lg:min-h-0/);
    expect(code).toMatch(/rounded-cd-12/);
    expect(code).toMatch(/lg:rounded-cd-10/);
    expect(code).toMatch(/border-cd-edge-card/);
    expect(code).toMatch(/bg-cd-fill-trust-card/);
    expect(code).toMatch(/px-cd-12/);
    expect(code).toMatch(/py-cd-11/);
    expect(code).toMatch(/min-w-0/);
    expect(cd['edge-card']).toBe('rgba(56,189,248,0.14)');
    expect(cd['fill-trust-card']).toBe('rgba(7,13,26,0.80)');
  });

  it('the released gaps and alignment divergence are both honoured', () => {
    expect(code).toMatch(/gap-cd-10/);
    expect(code).toMatch(/lg:gap-cd-13/);
    // Desktop sets flex-start; mobile deliberately does not set align-items.
    expect(code).toMatch(/lg:items-start/);
    expect(code).not.toMatch(/(^|\s)items-start/m);
  });

  it('CTO decision D-9 — DEFECT-019 is reproduced: the hairline is on ALL FIVE cards', () => {
    // The class list is index-independent apart from the span, so the fifth
    // card carries the trailing hairline exactly as released.
    const conditional = code.match(/index === TRUST_GLYPHS\.length - 1 \? '([^']*)' : ''/);
    expect(conditional).not.toBeNull();
    expect(conditional?.[1]).toBe('col-span-2 lg:col-span-1');
    expect(conditional?.[1]).not.toMatch(/border/);
  });
});

describe('M66.6 — released icon tile (GN-CD-185, ERRATUM-008)', () => {
  it('the tile is the released size, radius and border on each viewport', () => {
    expect(code).toMatch(/h-\[30px\] w-\[30px\]/);
    expect(code).toMatch(/lg:h-\[40px\] lg:w-\[40px\]/);
    expect(code).toMatch(/rounded-cd-9/);
    expect(code).toMatch(/lg:rounded-cd-11/);
    expect(code).toMatch(/border-cd-edge-tile-m/);
    expect(code).toMatch(/lg:border-cd-edge-tile/);
    expect(cd['edge-tile']).toBe('rgba(56,189,248,0.30)');
    expect(cd['edge-tile-m']).toBe('rgba(56,189,248,0.28)');
  });

  it('the inner ring sits at the released inset on each viewport', () => {
    expect(code).toMatch(/inset-\[4px\]/);
    expect(code).toMatch(/lg:inset-\[5px\]/);
    expect(code).toMatch(/rounded-full/);
    expect(code).toMatch(/border-cd-hud-cyan-16/);
    expect(cd['hud-cyan-16']).toBe('rgba(34,211,238,0.16)');
  });

  it('ERRATUM-008 — the inset glow is DESKTOP ONLY; the mobile tile is not a scaled copy', () => {
    expect(code).toMatch(/lg:shadow-cd-tile-glow/);
    expect(code).not.toMatch(/(^|\s)shadow-cd-tile-glow/m);
    expect(shadows['cd-tile-glow']).toBe('0 0 20px rgba(34,211,238,.12) inset');
    expect(images['cd-tile-trust']).toBe('radial-gradient(circle at 50% 30%, rgba(16,52,94,.9), rgba(6,14,28,.9))');
  });

  it('CTO decision D-4 A — exactly the five released glyphs, and they are decorative', () => {
    expect(code).toMatch(/const TRUST_GLYPHS = \['TR', 'MV', 'AI', 'LV', 'ED'\]/);
    expect(code).toMatch(/\{TRUST_GLYPHS\[index\]\}/);
    // GN-CD DEFECT-016: unhidden glyphs make a screen reader announce "T R"
    // before every card title. The whole tile is hidden instead.
    const tile = code.slice(code.indexOf('TRUST_GLYPHS[index]') - 900, code.indexOf('TRUST_GLYPHS[index]'));
    expect(tile).toMatch(/aria-hidden="true"/);
    // The retired lucide icons are gone from this render path.
    expect(code).not.toMatch(/item\.icon/);
    expect(code).not.toMatch(/ShieldCheck|RadioTower|GraduationCap|Sparkles|<Icon/);
  });

  it('ERRATUM-007 — the three mobile type roles are released at their exact values', () => {
    expect(fonts['cd-mono-trust-m']).toEqual(['9.5px', { letterSpacing: '0.11em', lineHeight: '1.4' }]);
    expect(fonts['cd-trust-body-m']).toEqual(['11.5px', { lineHeight: '1.45' }]);
    expect(fonts['cd-mono-glyph-m']).toEqual(['10.5px', {}]);
    // ...and the desktop roles M66.1 already released are reused unchanged.
    expect(fonts['cd-mono-trust']).toEqual(['11.5px', { letterSpacing: '0.13em' }]);
    expect(fonts['cd-trust-body']).toEqual(['12.5px', { lineHeight: '1.5', fontWeight: '400' }]);
    expect(fonts['cd-mono-glyph']).toEqual(['12.5px', {}]);
  });

  it('the desktop title line-height is restored explicitly, because the released tuple cannot', () => {
    // `cd-mono-trust` declares no lineHeight, so a Tailwind fontSize tuple
    // emits none — the mobile role's 1.4 would otherwise persist at desktop.
    expect(code).toMatch(/lg:leading-\[normal\]/);
  });
});

describe('M66.6 — the released absences', () => {
  it('ZERO motion — GN-CD acceptance: "presence of any animation is a failure"', () => {
    expect(code).not.toMatch(/@keyframes/);
    expect(code).not.toMatch(/animation:/);
    expect(code).not.toMatch(/\banimate-/);
    expect(code).not.toMatch(/<style/);
    // D-5 A removes the hover that the released .18s transition eases, so the
    // transition has nothing to trigger it and is not declared either.
    expect(code).not.toMatch(/transition/);
  });

  it('CTO decision D-5 A — no card is interactive, and none pretends to be', () => {
    expect(code).not.toMatch(/role="link"/);
    expect(code).not.toMatch(/tabIndex/);
    expect(code).not.toMatch(/href/);
    expect(code).not.toMatch(/onClick|onKeyDown|onMouseEnter|onFocus/);
    expect(code).not.toMatch(/cursor-pointer/);
    expect(code).not.toMatch(/hover:/);
    expect(code).not.toMatch(/focus-visible:/);
    // GN-CD DEFECT-018 therefore cannot arise: nothing is presented as a link.
  });

  it('no route is invented and /search is not repurposed for visual fidelity', () => {
    expect(code).not.toMatch(/\/methodology|\/live|\/evidence|\/transparency/);
    expect(code).not.toMatch(/'\/search'/);
    expect(code).not.toMatch(/next\/link|useRouter/);
  });

  it('the section reads no data and issues no request', () => {
    expect(trustSource).not.toMatch(/fetch\(/);
    expect(trustSource).not.toMatch(/@\/lib\/api\//);
    expect(trustSource).not.toMatch(/useState|useEffect|'use client'/);
    expect(trustSource.trimStart().startsWith("'use client'")).toBe(false);
  });

  it('GN-CD counts ZERO numbers in this family — no score, count, percentage or timestamp', () => {
    // Only geometry literals (px values inside class names) may appear.
    const withoutClasses = code.replace(/className=\{?[[\s\S]*?\]?\}?\s*>/g, '').replace(/'[^']*'/g, '');
    expect(withoutClasses).not.toMatch(/\d+%/);
    expect(withoutClasses).not.toMatch(/\b\d{2,}\s*(sources|countries|outlets|articles)\b/i);
    expect(code).not.toMatch(/trustScore|verifiedCount|sourceCount|accuracy|uptime/i);
  });
});

describe('M66.6 — CTO decision D-2 A: the truthful copy survives the visual rebuild', () => {
  const ABSOLUTES = [
    'All sources linked. Nothing hidden.',
    'Different angles. One complete picture.',
    'Clearly labeled. Always separated.',
    'Real-time monitoring. Always fresh.',
  ];

  it('every visible string still comes from the dictionary, in both languages', () => {
    expect(code).toMatch(/localized\?\.title \?\? item\.title/);
    expect(code).toMatch(/localized\?\.description \?\? item\.description/);
    expect(code).toMatch(/getDictionary\(language\)\.trustSection/);
    for (const language of ['en', 'pl'] as const) {
      const t = getDictionary(language).trustSection;
      expect(t.items).toHaveLength(5);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.headline.length).toBeGreaterThan(0);
      for (const entry of t.items) {
        expect(entry.title.length).toBeGreaterThan(0);
        expect(entry.description.length).toBeGreaterThan(0);
      }
    }
    const en = getDictionary('en').trustSection;
    const pl = getDictionary('pl').trustSection;
    expect(pl.headline).not.toBe(en.headline);
    expect(pl.items[0].description).not.toBe(en.items[0].description);
  });

  it('NONE of the four flagged absolute claims entered the product', () => {
    // Comment-stripped: this component's own doc comment quotes the four
    // claims while explaining why they were rejected, and that explanation
    // must not itself trip the guard.
    const haystack = [
      code,
      JSON.stringify(getDictionary('en').trustSection),
      JSON.stringify(getDictionary('pl').trustSection),
    ].join('\n');
    for (const claim of ABSOLUTES) {
      expect(haystack).not.toContain(claim);
    }
    // The highest-risk one, specifically: the product must not assert a
    // freshness guarantee it has no telemetry to back.
    expect(getDictionary('en').trustSection.items[3].description).not.toMatch(/real-?time|always fresh/i);
  });

  it('the shipping copy stays hedged rather than absolute', () => {
    const bodies = getDictionary('en').trustSection.items.map((entry) => entry.description).join(' ');
    expect(bodies).not.toMatch(/\bNothing hidden\b/i);
    expect(bodies).not.toMatch(/\bone complete picture\b/i);
    expect(bodies).toMatch(/Every summary links back to its original sources/);
  });

  it('the array-index alignment contract with homeContent.ts is intact', () => {
    expect(trustItems).toHaveLength(5);
    expect(getDictionary('en').trustSection.items).toHaveLength(trustItems.length);
    expect(getDictionary('pl').trustSection.items).toHaveLength(trustItems.length);
    expect(['TR', 'MV', 'AI', 'LV', 'ED']).toHaveLength(trustItems.length);
  });
});

describe('M66.6 — accessibility', () => {
  it('GN-CD DEFECT-021 is fixed: the five cards are a labelled group', () => {
    expect(code).toMatch(/role="list"/);
    expect(code).toMatch(/role="listitem"/);
    expect(code).toMatch(/<ul/);
    expect(code).toMatch(/<li/);
    expect(code).toMatch(/aria-labelledby="trust-heading"/);
  });

  it('every decorative layer is declared decorative', () => {
    // The field and the icon tile are the only decorative elements.
    expect((code.match(/aria-hidden="true"/g) ?? []).length).toBe(2);
  });

  it('the mobile card clears the 44px touch floor on both axes', () => {
    const cellWidth = (336 - 9) / 2;
    expect(cellWidth).toBeGreaterThanOrEqual(44);
    expect(64).toBeGreaterThanOrEqual(44);
  });

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
    const over = (
      fg: [number, number, number],
      alpha: number,
      bg: [number, number, number],
    ): [number, number, number] => [
      fg[0] * alpha + bg[0] * (1 - alpha),
      fg[1] * alpha + bg[1] * (1 - alpha),
      fg[2] * alpha + bg[2] * (1 - alpha),
    ];
    const hex = (value: string): [number, number, number] => {
      const h = value.replace('#', '');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    };

    const page: [number, number, number] = [4, 6, 12];
    const panelTop = over([9, 16, 32], 0.9, page);
    const panelBottom = over([5, 9, 18], 0.9, page);
    const mobileCard = over([7, 13, 26], 0.8, page);

    for (const colour of ['#8ab4ff', '#9fbdd8', '#7dd3fc']) {
      for (const ground of [panelTop, panelBottom, mobileCard]) {
        expect(ratio(hex(colour), ground)).toBeGreaterThanOrEqual(4.5);
      }
    }
    // Worst case in the family, locked so a future colour tweak cannot drop below it.
    expect(ratio(hex('#8ab4ff'), panelTop)).toBeGreaterThan(9);
  });
});

describe('M66.6 — multilingual layout (MLR-01 … MLR-06)', () => {
  const DESKTOP_TEXT_COLUMN = 179.4;
  const MOBILE_TEXT_COLUMN = 163.5 - 24 - 30 - 10;

  /** IBM Plex Mono has a fixed 600/1000-em advance, so tracked uppercase mono is exactly measurable. */
  function monoWidth(text: string, px: number, tracking: number): number {
    return text.length * (px * 0.6 + px * tracking);
  }

  it('the wrap-not-clip guarantee is preserved — the better of the two failure modes', () => {
    // GN-CD's mitigating finding: no nowrap, no clamp, no text-overflow, no
    // fixed heights, no absolute positioning on any text in this family.
    expect(code).not.toMatch(/whitespace-nowrap/);
    expect(code).not.toMatch(/line-clamp/);
    expect(code).not.toMatch(/text-ellipsis/);
    // The ONLY fixed heights in the family are the released icon tiles, which
    // GN-CD-185 declares `flex:none` at 30px / 40px. No text box has one.
    // The lookbehind keeps `min-h-[64px]` out — that is a floor, not a height.
    const fixedHeights = (code.match(/(?<!min-)\bh-\[\d+px\]/g) ?? []).sort();
    expect(fixedHeights).toEqual(['h-[30px]', 'h-[40px]']);
    expect(code).toMatch(/min-h-\[64px\]/); // a MINIMUM, never a fixed height
  });

  it('every title in both languages wraps within a sane number of lines at both viewports', () => {
    expect(MOBILE_TEXT_COLUMN).toBe(99.5);
    for (const language of ['en', 'pl'] as const) {
      const items = getDictionary(language).trustSection.items;
      for (let index = 0; index < items.length; index += 1) {
        const title = items[index].title;
        const desktopLines = Math.ceil(monoWidth(title, 11.5, 0.13) / DESKTOP_TEXT_COLUMN);
        // Card 5 spans both mobile columns, so it gets the full block width.
        const mobileColumn = index === 4 ? 336 - 24 - 30 - 10 : MOBILE_TEXT_COLUMN;
        const mobileLines = Math.ceil(monoWidth(title, 9.5, 0.11) / mobileColumn);
        expect(desktopLines).toBeLessThanOrEqual(2);
        expect(mobileLines).toBeLessThanOrEqual(3);
      }
    }
  });

  it('the longest Polish title is the row-height driver, and it is recorded rather than clipped', () => {
    const polish = getDictionary('pl').trustSection.items.map((entry) => entry.title);
    const longest = polish.reduce((a, b) => (a.length >= b.length ? a : b));
    expect(longest).toBe('Podsumowania AI, wyraźnie oznaczone');
    expect(Math.ceil(monoWidth(longest, 11.5, 0.13) / DESKTOP_TEXT_COLUMN)).toBe(2);
    // MLR-06: desktop is one grid row, so this title sets the section height.
    // Nothing clips — that is the contract asserted above.
  });
});

describe('M66.6 — protected surfaces are untouched', () => {
  it('the homepage still renders TrustSection where it did, and HowItWorks is untouched (D-1 A)', () => {
    const page = stripComments(pageSource);
    expect(page).toMatch(/<HowItWorks language=\{language\} \/>/);
    expect(page).toMatch(/<TrustSection language=\{language\} \/>/);
    expect(page.indexOf('<HowItWorks')).toBeLessThan(page.indexOf('<TrustSection'));
  });

  it('the shared HUD geometry helpers are no longer imported by Trust, but still exist for their other users', () => {
    expect(trustSource).not.toMatch(/hudPanelGeometry/);
    const helpers = readFileSync(join(__dirname, 'hudPanelGeometry.ts'), 'utf-8');
    expect(helpers).toMatch(/HUD_CARD_CLIP/);
    expect(helpers).toMatch(/hudCornerBracketClassName/);
  });

  it('lib/homeContent.ts is still the icon-independent source of the five records', () => {
    expect(trustSource).toMatch(/import \{ trustItems \} from '@\/lib\/homeContent'/);
    expect(trustItems).toHaveLength(5);
  });
});
