import { readFileSync } from 'fs';
import { join } from 'path';
import tailwindConfig from '../../../tailwind.config';

const sectionSource = readFileSync(join(__dirname, 'GlobalDevelopments.tsx'), 'utf-8');
const cardSource = readFileSync(join(__dirname, 'TrendingCard.tsx'), 'utf-8');

type ThemeExtend = Record<string, Record<string, unknown>>;
const themeExtend = (tailwindConfig.theme?.extend ?? {}) as unknown as ThemeExtend;
const cd = themeExtend.colors.cd as Record<string, unknown>;

/** M66.2's helper: every negative guard runs against comment-stripped source. */
const codeOnly = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * M66.4 — the GN-CD-100 -> GN-CD-115 geometry and token contract.
 *
 * The rail's arithmetic is COMPUTED rather than asserted as a string, because
 * the properties that matter are relational: how many cards fit, and at what
 * point the rail stops overflowing so its arrows would have nothing to do.
 * Neither is visible in a class name.
 */

/* ─────────────────────── 1. the rail arithmetic ─────────────────────── */

describe('M66.4 geometry — released rail arithmetic', () => {
  const CARD_D = 280;
  const CARD_M = 246;
  const GAP_D = 12;
  const SECTION_PADDING = 18;
  const SECTION_BORDER = 1;

  /** GN-CD-302 SS-E.1, implemented by the protected PageCanvas. */
  const contentBox = (viewport: number): number => Math.min(viewport, 1500) - 2 * 26;
  const railInner = (viewport: number): number =>
    contentBox(viewport) - 2 * SECTION_PADDING - 2 * SECTION_BORDER;
  const cardsVisible = (viewport: number): number => (railInner(viewport) + GAP_D) / (CARD_D + GAP_D);
  const scrollWidth = (cards: number): number => cards * CARD_D + (cards - 1) * GAP_D;

  it('reproduces GN-CD-100 SS-C exactly at the native desktop viewport', () => {
    expect(contentBox(1440)).toBe(1388);
    expect(railInner(1440)).toBe(1350);
    expect(scrollWidth(6)).toBe(1740);
    /*
      GN-CD-100 SS-C states "Cards visible 4.62" and gives its own derivation as
      `(1350 + 12) / 292`. That expression evaluates to 4.664, not 4.62 — an
      arithmetic slip in the released document, of the same kind as the mobile
      rail-width figure (stated 1531, derivation `6x246 + 5x11 + 28` = 1559).
      The FORMULA is authoritative and is what this asserts; the discrepancy is
      recorded in the M66.4 known limitations rather than silently rounded away.
    */
    expect(cardsVisible(1440)).toBeCloseTo(4.664, 3);
  });

  it('holds the composition at every viewport from the handoff upward', () => {
    const breakpoint = Number((themeExtend.screens as unknown as Record<string, string>)['cd-hero'].replace('px', ''));
    expect(breakpoint).toBe(1240);
    for (const viewport of [1240, 1280, 1366, 1440, 1500, 1920]) {
      expect(cardsVisible(viewport)).toBeGreaterThan(3.9);
      expect(railInner(viewport)).toBeGreaterThan(CARD_D);
    }
  });

  it('overflows — and therefore needs its arrows — only from the fifth card onward', () => {
    // GN-CD records that a rail shorter than its viewport leaves the arrows
    // with nothing to scroll, "appearing broken". This is why the arrows are
    // gated on a real measurement rather than on items.length.
    expect(scrollWidth(4)).toBeLessThan(railInner(1440));
    expect(scrollWidth(5)).toBeGreaterThan(railInner(1440));
    expect(sectionSource).toMatch(/el\.scrollWidth > el\.clientWidth \+ 1/);
  });

  it('keeps the desktop arrows inside the section border rather than clipped by it', () => {
    // GN-CD-100: `overflow:hidden` plus arrows at -19px inside 18px of padding
    // puts them 1px inside the padding box. Reducing the padding below 19 would
    // clip them.
    expect(SECTION_PADDING - 19).toBe(-1);
    expect(sectionSource).toMatch(/cd-hero:px-cd-18/);
    expect(sectionSource).toMatch(/left-\[-19px\]/);
    expect(sectionSource).toMatch(/right-\[-19px\]/);
  });

  it('uses the released mobile card width and gap', () => {
    const spacing = themeExtend.spacing as unknown as Record<string, string>;
    expect(spacing['cd-246']).toBe(`${CARD_M}px`);
    expect(spacing['cd-280']).toBe(`${CARD_D}px`);
    expect(cardSource).toMatch(/w-cd-246 /);
    expect(cardSource).toMatch(/cd-hero:w-cd-280/);
  });
});

/* ─────────────────── 2. the step and pause algorithms ─────────────────── */

describe('M66.4 geometry — GN-CD-105/108 rail mechanics', () => {
  /** The released step algorithm, extracted so it can be exercised rather than pattern-matched. */
  const railTarget = (
    scrollLeft: number,
    scrollWidth: number,
    clientWidth: number,
    cardWidth: number,
    direction: 1 | -1,
  ): number => {
    const step = cardWidth + 12;
    const max = Math.max(0, scrollWidth - clientWidth);
    let target = scrollLeft + direction * step;
    if (target > max - 4) target = direction > 0 ? 0 : max;
    if (target < 0) target = max;
    return target;
  };

  it('steps by exactly one card plus the released gap constant', () => {
    expect(sectionSource).toMatch(/const RAIL_STEP_GAP = 12/);
    expect(sectionSource).toMatch(/const RAIL_STEP_FALLBACK = 220/);
    expect(sectionSource).toMatch(/card\.offsetWidth \+ RAIL_STEP_GAP : RAIL_STEP_FALLBACK/);
    expect(railTarget(0, 1740, 1350, 280, 1)).toBe(292);
  });

  it('wraps forward to the start and backward to the end', () => {
    // Forward, from the last reachable position.
    expect(railTarget(380, 1740, 1350, 280, 1)).toBe(0);
    // Backward, from the start.
    expect(railTarget(0, 1740, 1350, 280, -1)).toBe(390);
    expect(sectionSource).toMatch(/if \(target > max - 4\) target = direction > 0 \? 0 : max;/);
    expect(sectionSource).toMatch(/if \(target < 0\) target = max;/);
  });

  it('measures the step from exactly one element per story', () => {
    // GN-CD SS-NON-NEGOTIABLE 11: data-rail-card is the step measurement's only
    // anchor. Two per story — one hidden — would measure a zero-width element.
    expect(sectionSource).toMatch(/querySelector<HTMLElement>\('\[data-rail-card\]'\)/);
    expect((cardSource.match(/data-rail-card/g) ?? []).length).toBe(1);
  });

  it('implements the two independent pause flags and the 9s re-arm', () => {
    expect(sectionSource).toMatch(/const AUTO_ADVANCE_INTERVAL_MS = 6000/);
    expect(sectionSource).toMatch(/const MANUAL_REARM_MS = 9000/);
    expect(sectionSource).toMatch(/const holdRef = useRef\(false\)/);
    expect(sectionSource).toMatch(/const pausedRef = useRef\(false\)/);
    // The merged flag GN-CD-108 says was tried and failed must not reappear.
    expect(codeOnly(sectionSource)).not.toMatch(/setIsPaused|const \[isPaused/);
  });

  it('clears the re-arm timer on unmount, so a late timer cannot resume a dead rail', () => {
    expect(sectionSource).toMatch(/if \(rearmRef\.current !== null\) window\.clearTimeout\(rearmRef\.current\)/);
  });
});

/* ───────────────────────── 3. token integrity ───────────────────────── */

describe('M66.4 tokens — additive only, and collision-free', () => {
  it('introduces zero collisions in the bg- namespace', () => {
    const seen = new Map<string, string[]>();
    const walk = (obj: Record<string, unknown>, ns: string, prefix: string): void => {
      for (const key of Object.keys(obj)) {
        const value = obj[key];
        const name = prefix ? `${prefix}-${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          walk(value as Record<string, unknown>, ns, name);
        } else {
          seen.set(name, [...(seen.get(name) ?? []), ns]);
        }
      }
    };
    walk(themeExtend.colors, 'colors', '');
    walk(themeExtend.backgroundImage as unknown as Record<string, unknown>, 'backgroundImage', '');
    walk(themeExtend.backgroundSize as unknown as Record<string, unknown>, 'backgroundSize', '');
    const collisions = [...seen.entries()].filter(([, namespaces]) => namespaces.length > 1);
    expect(collisions).toEqual([]);
    expect(seen.size).toBeGreaterThan(130);
  });

  it('keeps the Trending rule COLOUR and the rule IMAGE under different keys', () => {
    // Tailwind emits colors, backgroundImage and backgroundSize all under the
    // `bg-` prefix, so an identical key in two of them silently makes one
    // unreachable. `rule-trending` is the colour; `cd-rules-trending` is the
    // image that consumes it.
    expect(cd['rule-trending']).toBe('rgba(56,189,248,0.05)');
    expect((themeExtend.backgroundImage as unknown as Record<string, string>)['cd-rules-trending']).toContain(
      'rgba(56,189,248,.05)',
    );
    expect((themeExtend.backgroundImage as unknown as Record<string, string>)['cd-rule-trending']).toBeUndefined();
  });

  it('leaves every legacy token untouched', () => {
    const colors = themeExtend.colors as Record<string, unknown>;
    expect(colors.void).toBe('#080b12');
    for (const legacy of ['void', 'surface', 'border', 'signal', 'ice', 'ink']) {
      expect(Object.keys(colors)).toContain(legacy);
    }
    const fontFamily = themeExtend.fontFamily as unknown as Record<string, string[]>;
    expect(fontFamily.display).toEqual(['var(--font-display)', 'sans-serif']);
    expect(fontFamily.mono).toEqual(['var(--font-mono)', 'monospace']);
  });

  it('leaves every previously released cd-* token untouched', () => {
    expect(cd.void).toBe('#04060c');
    expect((cd.ink as Record<string, string>).primary).toBe('#e8f1ff');
    expect((cd.ink as Record<string, string>).meta).toBe('#5b7fa6');
    expect(cd['edge-card']).toBe('rgba(56,189,248,0.14)');
    expect(cd['edge-card-mobile']).toBe('rgba(56,189,248,0.15)');
    expect(cd['edge-section']).toBe('rgba(56,189,248,0.16)');
    expect(cd['edge-structural']).toBe('rgba(56,189,248,0.12)');
    expect((themeExtend.screens as unknown as Record<string, string>)['cd-hero']).toBe('1240px');
    expect((themeExtend.screens as unknown as Record<string, string>)['cd-header']).toBe('1400px');
    expect((themeExtend.maxWidth as unknown as Record<string, string>)['cd-page']).toBe('1500px');
  });

  it('releases the GN-CD-100→115 values M66.1 did not cover, at their exact alphas', () => {
    expect(cd['fill-trend-card']).toBe('rgba(7,13,26,0.70)');
    expect(cd['fill-trend-card-m']).toBe('rgba(7,13,26,0.85)');
    expect(cd['fill-trend-body-m']).toBe('rgba(7,13,26,0.92)');
    expect(cd['fill-trend-hover']).toBe('rgba(12,24,44,0.80)');
    expect(cd['fill-chip-m']).toBe('rgba(4,8,16,0.72)');
    expect(cd['fill-rail-arrow']).toBe('rgba(6,12,24,0.92)');
    expect((themeExtend.boxShadow as unknown as Record<string, string>)['cd-trend-hover']).toBe(
      '0 8px 24px rgba(4,10,22,.6)',
    );
    const spacing = themeExtend.spacing as unknown as Record<string, string>;
    for (const [key, value] of [['cd-19', '19px'], ['cd-34', '34px'], ['cd-74', '74px'], ['cd-78', '78px'], ['cd-112', '112px']]) {
      expect(spacing[key]).toBe(value);
    }
  });

  it('adds no animation — every treatment this family could animate is unavailable', () => {
    // GN-CD-114/115's breaking and top-story treatments are the family's only
    // animated elements, and both are unbuildable. M66.1 already released
    // their tokens; they stay unused rather than being applied to invented
    // state.
    const animations = themeExtend.animation as unknown as Record<string, string>;
    expect(animations['cd-breaking-card']).toBe('cd-urgent 4.4s ease-in-out infinite');
    expect(animations['cd-topstory-sweep']).toBe('cd-spin 7s linear infinite');
    for (const text of [sectionSource, cardSource]) {
      expect(codeOnly(text)).not.toMatch(/animate-cd-breaking|animate-cd-topstory/);
    }
  });
});

/* ─────────────────────── 4. contrast, measured ─────────────────────── */

describe('M66.4 — contrast against the real Trending beds (GN-CD UNRESOLVED-011)', () => {
  const channel = (v: number): number => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const rgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const luminance = (c: [number, number, number]): number =>
    0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
  const over = (fg: [number, number, number], alpha: number, bg: [number, number, number]): [number, number, number] =>
    [0, 1, 2].map((i) => alpha * fg[i] + (1 - alpha) * bg[i]) as [number, number, number];
  const ratio = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

  // The page radial's lit core, then the section's own top stop over it, then
  // the card fill over that — the lightest bed any of this text ever sits on.
  const pageLit = over(rgb('#0e376e'), 0.55, rgb('#04060c'));
  const sectionLit = over(rgb('#091020'), 0.9, pageLit);
  const cardDesktop = over(rgb('#070d1a'), 0.7, sectionLit);
  const bodyMobile = over(rgb('#070d1a'), 0.92, sectionLit);

  it('passes SC 1.4.3 for every text role the rail renders, on the card beds where they actually sit', () => {
    const ink = cd.ink as Record<string, string>;
    for (const bed of [cardDesktop, bodyMobile]) {
      for (const hex of [ink.primary, ink.meta, ink.label, ink['link-quiet'], ink.glyph]) {
        expect(ratio(luminance(rgb(hex)), luminance(bed))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('passes SC 1.4.3 for every category colour used as label text', () => {
    // Every released category colour plus the neutral, at 9-10px.
    for (const hex of ['#60a5fa', '#a78bfa', '#22d3ee', '#34d399', '#fb923c', '#38bdf8']) {
      expect(ratio(luminance(rgb(hex)), luminance(cardDesktop))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(luminance(rgb(hex)), luminance(bodyMobile))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('records that the metadata token is marginal on the bare section, which is why it only ever renders inside a card', () => {
    const meta = (cd.ink as Record<string, string>).meta;
    expect(ratio(luminance(rgb(meta)), luminance(sectionLit))).toBeLessThan(4.5);
    expect(ratio(luminance(rgb(meta)), luminance(cardDesktop))).toBeGreaterThanOrEqual(4.5);
  });
});

/* ─────────────────── 5. honesty guards across both files ─────────────────── */

describe('M66.4 — no fabricated ranking, urgency or significance (CTO rules 2-5)', () => {
  it('renders no BREAKING state', () => {
    for (const text of [sectionSource, cardSource]) {
      const code = codeOnly(text);
      expect(code).not.toContain('BREAKING');
      expect(code).not.toMatch(/urgent/i);
      expect(code).not.toMatch(/gnUrgent|cd-urgent/);
    }
  });

  it('renders no positional top-story state', () => {
    for (const text of [sectionSource, cardSource]) {
      const code = codeOnly(text);
      expect(code).not.toMatch(/isTop|topStory|top-story/i);
      expect(code).not.toMatch(/index === 1|i === 1/);
      expect(code).not.toMatch(/conic-gradient/);
    }
  });

  it('renders no rank, score, popularity or engagement signal', () => {
    for (const text of [sectionSource, cardSource]) {
      const code = codeOnly(text);
      expect(code).not.toMatch(/\brank\b|ranking|score|engagement|views|readCount/i);
    }
  });

  it('ships no placeholder subject caption', () => {
    // GN-CD-110's SUBJECT map is scaffolding for an image brief, never
    // production copy, and DEFECT-015 records that screen readers announce it
    // with no context.
    for (const term of ['SUBJECT', 'DIPLOMACY', 'SUMMIT', 'MARKETS', 'AI LAB', 'WEATHER', 'FIELD']) {
      expect(codeOnly(cardSource)).not.toContain(term);
    }
  });

  it('drives no hero map focus, because no article-to-signal contract exists', () => {
    for (const text of [sectionSource, cardSource]) {
      expect(codeOnly(text)).not.toMatch(/focusMap|spotForArticle|focusSpot/);
    }
  });

  it('keeps every out-of-scope regression spec satisfiable — no line pairs "placeholder" with "headline"', () => {
    // emptyPanelEvidenceFixes.spec.ts (out of scope) asserts
    // /fake|dummy|placeholder.*headline/i against RAW source. JavaScript's `.`
    // does not cross newlines, so the constraint is per-line.
    for (const text of [sectionSource, cardSource]) {
      for (const line of text.split('\n')) {
        expect(line).not.toMatch(/placeholder.*headline/i);
        expect(line).not.toMatch(/\bfake\b|\bdummy\b/i);
      }
    }
  });
});
