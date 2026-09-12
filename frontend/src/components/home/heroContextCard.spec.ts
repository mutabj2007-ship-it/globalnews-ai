import { readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';
import tailwindConfig from '../../../tailwind.config';

/*
  STEP 2 — the mirror anchor is proved by EXECUTING the released projection, so
  this spec needs `projectPoint`. Same hermetic arrangement heroGeometry.spec.ts
  established for the same import: the projection helpers are pure, the country
  data they would normally join is irrelevant to a geometry question, and the
  workspace link behind it is not resolvable in every environment.
*/
jest.mock('@/lib/map/countryGeometry', () => ({
  getCountryFeatureCollection: () => ({ type: 'FeatureCollection', features: [] }),
}));

import { projectPoint } from '@/components/home/HeroIntelligenceField';

/**
 * M66.14B — THE INTELLIGENCE CONTEXT CARD.
 *
 * The card is where an untruth would be most expensive: it names a place and a
 * category beside a headline, which is exactly the shape of claim M66.13 was run
 * to repair. These contracts hold it to what the data supports.
 */

const SRC = join(__dirname, '..', '..');
const read = (relative: string): string => readFileSync(join(SRC, relative), 'utf-8');
const codeOnly = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const cardSource = read('components/home/IntelligenceContextCard.tsx');
const card = codeOnly(cardSource);
const hero = codeOnly(read('components/home/Hero.tsx'));
const provider = codeOnly(read('components/home/HeroFocusProvider.tsx'));

describe('M66.14B — the context card renders only what is true', () => {
  it('THE CORE RULE — no source count, in any form', () => {
    expect(card).not.toMatch(/sourcesCount|SOURCES|sources\b/i);
  });

  it('no city, region, coordinate, relationship or invented timestamp', () => {
    expect(card).not.toMatch(/\bcity\b|(?<!-)\bregion\b|latitude|longitude|centroid/i);
    expect(card).not.toMatch(/related|relationship|causal|connectedTo/i);
    expect(card).not.toMatch(/Date\.now|new Date\(\)|toLocaleTimeString/);
  });

  it('the evidence scope MATCHES THE JOIN, and no scope finer than country exists', () => {
    // Both scopes are reachable, and the choice is the resolved flag itself.
    expect(card).toMatch(/resolved \? t\.countryEvidence : t\.articleEvidence/);
    const en = getDictionary('en').heroContext;
    expect(en.countryEvidence).toBe('COUNTRY-LEVEL EVIDENCE');
    /*
      WIDENED DELIBERATELY. `articleEvidence` and `locationUnresolved` are the
      two strings the root-cause fix required. The list is still asserted
      exactly, so a third scope cannot arrive unreviewed, and the guard below
      keeps the original point: nothing FINER than country may ever exist.
      article-level is a LOWER scope, which is why it is admissible.
    */
    expect(Object.keys(en)).toEqual([
      'heading',
      'countryEvidence',
      'articleEvidence',
      'locationUnresolved',
      'dismissLabel',
    ]);
    for (const language of ['en', 'pl'] as const) {
      const values = Object.values(getDictionary(language).heroContext).join(' ');
      expect(values).not.toMatch(/city|region|district|province|miast|region|dzielnic/i);
    }
  });

  /*
    CONVERTED, NOT DELETED. This block used to assert that the card renders
    NOTHING when the focused article resolved to no country. Measured against
    the demo provider's twelve fixtures, resolvePrimaryCountry() resolves ZERO
    of them, so that rule made the card structurally invisible on that dataset
    and intermittently invisible on live data. The contract it protected —
    never claim a place you do not have — is preserved and strengthened below:
    the card now REPORTS the absence in words instead of vanishing, and the
    guards prove no country is invented, defaulted or guessed.
  */
  it('ROOT-CAUSE FIX — the card renders on focus, with or without resolved geography', () => {
    // Visibility is the focus state and nothing else.
    expect(card).toMatch(/if \(focus === null\) \{[\s\S]{0,40}?return null;/);
    expect(card).not.toMatch(/focus\.countryCode === null \|\| focus\.countryName === null/);
    // Resolution is a straight read of what the resolver returned.
    expect(card).toMatch(/const resolved = focus\.countryCode !== null && focus\.countryName !== null;/);
  });

  it('ROOT-CAUSE FIX — the place slot reports absence and NEVER invents a location', () => {
    // The real place renders only on the resolved branch...
    expect(card).toMatch(/\{resolved \? \([\s\S]{0,400}?\{countryLabel\}/);
    // ...and the unresolved branch renders a dictionary string, not a value.
    expect(card).toMatch(/\{t\.locationUnresolved\}/);
    // The display helper is never reachable without a resolved code: no `??`
    // fallback, no default, no placeholder country anywhere in the file.
    // Narrowed on the fields, with NO type assertion — a cast is where a null
    // would later reach the display helper.
    expect(card).toMatch(/getCountryDisplayName\(focus\.countryCode, language, focus\.countryName\)/);
    // Scoped to the DATA fields: the only other `as string` in this file is the
    // CSS custom-property key, which is a legitimate TS/JSX idiom.
    expect(card).not.toMatch(/focus\.country(Code|Name) as /);
    expect(card).not.toMatch(/getCountryDisplayName\([^)]*\?\?/);
    expect(card).not.toMatch(/'Unknown'|'N\/A'|'--'|Global|Worldwide/);
    for (const language of ['en', 'pl'] as const) {
      const text = getDictionary(language).heroContext.locationUnresolved;
      expect(text.length).toBeGreaterThan(0);
      // It must read as a report about missing data, never as a place name.
      expect(text).not.toMatch(/^[A-Z][a-z]+$/);
    }
    expect(getDictionary('pl').heroContext.locationUnresolved).not.toBe(
      getDictionary('en').heroContext.locationUnresolved,
    );
    expect(getDictionary('pl').heroContext.articleEvidence).not.toBe(
      getDictionary('en').heroContext.articleEvidence,
    );
  });

  it('ROOT-CAUSE FIX — the card is still focus-driven and never permanently visible', () => {
    // No default-open, no timer, no state of its own, no effect.
    expect(card).not.toMatch(/useState|useEffect|setInterval|setTimeout|defaultOpen|alwaysVisible/);
    // The ONLY early return is the focus check, so nothing else can hold it open.
    expect((card.match(/return null;/g) ?? [])).toHaveLength(1);
  });

  it('the provider headline is rendered verbatim and never looked up', () => {
    expect(card).toMatch(/\{focus\.headline\}/);
    expect(card).not.toMatch(/\[focus\.headline\]|translate/i);
  });
});

describe('M66.14B — the card reuses the one provenance model', () => {
  it('THE CORE RULE — statusKey comes from the provider and is never re-derived', () => {
    expect(card).toMatch(/const \{ focus, statusKey \} = useHeroFocus\(\)/);
    expect(card).not.toMatch(/resolveLiveStatus|dataMode|isLive/);
  });

  it('every non-live state reuses the SAME wording as the DATA STATUS row', () => {
    for (const key of ['cached', 'mock', 'unavailable', 'reconnecting', 'unknown']) {
      expect(card).toContain(`status.${key}`);
    }
  });

  it('a genuinely live feed carries no provenance qualifier — LIVE stays LIVE', () => {
    expect(card).toMatch(/statusKey === 'live'\r?\n?\s*\? null/);
  });

  it('the provider resolves provenance ONCE, from the same values page.tsx already supplies', () => {
    expect(provider).toMatch(/const \{ statusKey \} = resolveLiveStatus\(isLive, dataMode, language, updatedAt\)/);
    expect((provider.match(/resolveLiveStatus\(/g) ?? [])).toHaveLength(1);
  });
});

describe('M66.14B — the card is localized, and reuses the canonical vocabularies', () => {
  it('every new chrome string exists in BOTH languages and is genuinely different', () => {
    const en = getDictionary('en').heroContext;
    const pl = getDictionary('pl').heroContext;
    for (const key of ['heading', 'countryEvidence', 'dismissLabel'] as const) {
      expect(typeof en[key]).toBe('string');
      expect(en[key].length).toBeGreaterThan(0);
      expect(typeof pl[key]).toBe('string');
      expect(pl[key].length).toBeGreaterThan(0);
      expect(pl[key]).not.toBe(en[key]);
    }
  });

  it('the card hardcodes no user-facing literal — every label comes from the dictionary', () => {
    const literals = [...card.matchAll(/>\s*([A-Za-z][^<>{}\n]{2,80}?)\s*</g)]
      .map((match) => match[1].trim())
      .filter((text) => !/[=;()]/.test(text));
    expect(literals).toEqual([]);
  });

  it('the category label reuses map.categories and the country name the released display helper', () => {
    expect(card).toMatch(/dictionary\.map\.categories\[focus\.category\]/);
    expect(card).toMatch(/getCountryDisplayName\(focus\.countryCode, language, focus\.countryName\)/);
    // No second taxonomy and no second colour table.
    expect(card).toMatch(/categoryChannel\(focus\.category\)/);
    expect(card).not.toMatch(/world:\s*'|politics:\s*'/);
  });
});

describe('M66.14B — placement, replacement and accessibility', () => {
  it('THE CORE RULE — the card is NOT inside the aria-hidden decorative map wrapper', () => {
    const mapWrapper = /aria-hidden="true"[\s\S]*?<\/div>/.exec(hero);
    expect(mapWrapper).not.toBeNull();
    expect(mapWrapper![0]).not.toMatch(/IntelligenceContextCard/);
    expect(hero).toMatch(/<IntelligenceContextCard language=\{language\} \/>/);
  });

  it('announces itself politely, so a keyboard user hears what focusing a row produced', () => {
    expect(card).toMatch(/role="status"/);
    expect(card).toMatch(/aria-live="polite"/);
  });

  it('replaces its content in place — the card element itself is never keyed or remounted', () => {
    expect(card).not.toMatch(/key=\{focus/);
  });

  /*
    CONVERTED IN PHASE 1, NOT WEAKENED. This block used to prove desktop-only by
    requiring `hidden cd-hero:block">` immediately before the card's own mount.
    The card now lives inside COLUMN 2 — the released transparent map overlay —
    which carries that gate itself, so the old literal adjacency no longer holds
    while the contract it protected does. The replacement proves the same thing
    and more: desktop-only, mounted in the map overlay, and no longer anchored to
    the hero panel at a percentage that lands inside the left text column.
  */
  it('B-1 is DESKTOP ONLY, and the card is mounted in the MAP OVERLAY column', () => {
    // The overlay column: transparent, positioned, desktop-gated.
    const overlay = /<div className="pointer-events-none relative hidden cd-hero:block">([\s\S]*?)\n          <\/div>/.exec(hero);
    expect(overlay).not.toBeNull();
    // The card is inside it, and so is the pre-existing EXPAND MAP control.
    expect(overlay![1]).toMatch(/<IntelligenceContextCard language=\{language\} \/>/);
    expect(overlay![1]).toMatch(/href="\/map"/);
    // The mobile field instance is untouched and receives no focus.
    expect(hero).toMatch(/<HeroIntelligenceField compact \/>/);
  });

  it('PHASE 1 — the card is anchored to the map region, not to a percentage inside column 1', () => {
    /*
      The grid is [minmax(0,470px) minmax(0,1fr) 312px] and PageCanvas gives the
      panel min(vw,1500)-52, so the old `left-[22%]` resolved to 261px at the
      cd-hero floor and 319px at 1500+ — both inside column 1's 470px. Anchoring
      in column 2 makes non-overlap a property of the grid instead.
    */
    expect(hero).toMatch(/cd-hero:grid-cols-\[minmax\(0,470px\)_minmax\(0,1fr\)_312px\]/);
    /*
      CONVERTED IN STEP 2, NOT WEAKENED. The mount used to carry one literal
      class string. It now carries `cardAnchor`, which is one of TWO literal
      class strings — so the assertion moves from the mount to the two strings
      themselves, and additionally proves there are exactly two of them.
    */
    const mount = /<div className=\{cardAnchor\}>\s*<IntelligenceContextCard/.exec(hero);
    expect(mount).not.toBeNull();
    expect(hero).toMatch(/'absolute left-cd-6 top-cd-60'/);
    expect(hero).toMatch(/'absolute right-cd-6 top-cd-60'/);
    // The retired anchor is gone, and with it the family's only z-index.
    expect(hero).not.toMatch(/bottom-cd-24 left-\[22%\]/);
    expect(hero).not.toMatch(/z-cd-10/);
  });

  it('PHASE 1 — room is reserved beneath the card for the six-label legend', () => {
    // Frame 428px; card top 60 + max 260 = 320, so >= 100px remains in the same
    // column for the Phase 2 legend. Card above, legend below, both on the map.
    const theme = (tailwindConfig.theme?.extend ?? {}) as unknown as {
      minHeight?: Record<string, string>;
      spacing?: Record<string, string>;
    };
    const frame = Number(String(theme.minHeight?.['cd-hero-frame']).replace('px', ''));
    const top = Number(String(theme.spacing?.['cd-60']).replace('px', ''));
    const maxHeight = Number(/max-h-\[(\d+)px\]/.exec(card)?.[1]);
    expect(frame).toBe(428);
    expect(top).toBe(60);
    expect(frame - (top + maxHeight)).toBeGreaterThanOrEqual(100);
  });

  it('PHASE 1 — the card is bounded: fixed width, truncated place, two-line headline', () => {
    expect(card).toMatch(/w-cd-280/);
    expect(card).not.toMatch(/w-auto|max-w-/);
    // The place line is one line; the headline is at most two.
    expect(card).toMatch(/truncate text-cd-card-head[^"]*">\{countryLabel\}/);
    expect(card).toMatch(/line-clamp-2[^"]*">\{focus\.headline\}/);
    // And a hard backstop, so no future row can grow the card silently.
    expect(card).toMatch(/max-h-\[\d+px\] /);
    expect(card).toMatch(/overflow-hidden/);
  });

  it('PHASE 1 — THE ROOT CAUSE GUARD: every text-cd-* class the card uses is a real fontSize token', () => {
    /*
      The card grew because `text-cd-body` and `text-cd-body-sm` emitted NO CSS:
      `cd-body` is a fontFamily key, not a fontSize one, and `cd-body-sm` was
      never defined at all. Both lines silently inherited 16px/normal. Asserting
      the two dead names are absent would only fix this once; resolving every
      `text-cd-*` the card uses against the real config makes the whole class of
      mistake impossible.
    */
    const theme = (tailwindConfig.theme?.extend ?? {}) as unknown as {
      fontSize?: Record<string, unknown>;
      colors?: { cd?: Record<string, unknown> };
    };
    const fontSizes = Object.keys(theme.fontSize ?? {});
    const used = [...card.matchAll(/(?:^|\s)text-(cd-[\w-]+)/g)].map((match) => match[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const token of used) {
      const isFontSize = fontSizes.includes(token);
      // text-* also addresses colour; cd-ink-* are colour roles, not sizes.
      const isColour = token.startsWith('cd-ink-');
      expect({ token, resolves: isFontSize || isColour }).toEqual({ token, resolves: true });
    }
    expect(card).not.toMatch(/text-cd-body\b|text-cd-body-sm\b/);
  });

  it('the card introduces no interaction of its own in B-1', () => {
    expect(card).not.toMatch(/onClick|onKeyDown|onMouseEnter|useState|useEffect/);
  });
});

/* ───────────────────── STEP 2 — THE MIRROR ANCHOR (§15) ────────────────────── */

describe('STEP 2 — the card mirrors between two fixed slots so it never sits on the locator', () => {
  it('THE CORE RULE — the side is a SIGN TEST on the already-resolved point, not a measurement', () => {
    expect(hero).toMatch(
      /const cardAnchor =\s*focusCountryPoint !== null && focusCountryPoint\[0\] < 0/,
    );
    /*
      Everything the §15 "collision-aware / marker-chasing" option would have
      needed, and which this component family forbids. `heroFocusChain.spec.ts`
      already bans DOM measurement across the chain; this pins it to the anchor
      decision specifically, because that is the one place a future change would
      be tempted to measure.
    */
    expect(hero).not.toMatch(/getBoundingClientRect|ResizeObserver|offsetWidth|clientWidth/);
    expect(hero).not.toMatch(/addEventListener\('resize'|window\.innerWidth|matchMedia/);
  });

  it('EXACTLY TWO fixed class sets, both literal, differing only in which edge they hug', () => {
    const anchors = [...hero.matchAll(/'absolute (left|right)-cd-6 top-cd-60'/g)].map((m) => m[0]);
    expect(anchors).toHaveLength(2);
    expect(new Set(anchors).size).toBe(2);
    /*
      Literal strings, because Tailwind's JIT scanner reads source text: an
      interpolated `absolute ${side}-cd-6` would emit no CSS and the card would
      collapse into the flow. Same class of defect as the two dead type tokens
      the Phase 1 root-cause guard above exists to catch.
    */
    expect(hero).not.toMatch(/absolute \$\{/);
    // The vertical constant is shared, so EXPAND MAP clearance and the band
    // reserved for the Phase 2 legend are identical in both slots.
    expect((hero.match(/top-cd-60/g) ?? [])).toHaveLength(2);
  });

  it('THE DEFAULT IS THE RELEASED LEFT SLOT — the card never moves for a location that never resolved', () => {
    /*
      `focusCountryPoint` is null with no focus AND with a focused article whose
      country did not resolve. In both cases there is no locator to avoid, so the
      card must stay exactly where Phase 1 put it rather than picking a side from
      nothing. The false branch of the ternary is that released anchor.
    */
    expect(hero).toMatch(/\? 'absolute right-cd-6 top-cd-60'\s*:\s*'absolute left-cd-6 top-cd-60'/);
  });

  it('STEP 1 IS PRESERVED EXACTLY — the anchor is a second reader of the point, never a second writer', () => {
    // fieldFocus is untouched: same shape, same source, still null-gated.
    expect(hero).toMatch(
      /const fieldFocus = focusCountryPoint\s*\r?\n?\s*\? \{ lon: focusCountryPoint\[0\], lat: focusCountryPoint\[1\] \}/,
    );
    // The anchor derives from the same value and writes nothing back.
    expect(hero).not.toMatch(/setFocus\b|useState<HeroFocus/);
    expect(hero).not.toMatch(/cardAnchor =[\s\S]{0,200}setFocus/);
  });

  /*
    THE GEOMETRY PROOF — EXECUTED, NOT PATTERN-MATCHED.

    This suite's neighbours in `heroGeometry.spec.ts` run the real projection
    rather than asserting class names, and the mirror rule is worth the same
    treatment: it is a spatial claim, so it should be checked spatially, over
    the real country set, at real widths.

    The model below is the released layout contract, every number of it already
    asserted elsewhere in this repository:
      - page content box  = min(viewport, 1500) - 2 x 26   (PageCanvas)
      - grid              = [470, 1fr, 312]                (Hero)
      - map host          = left 22%, right 13% of that box, full frame height
      - frame             = min-h-cd-hero-frame = 428
      - SVG               = viewBox 1000x580, xMidYMid meet, h-full w-full
      - card              = 280 wide, top 60, <= 260 tall
  */
  const VB = { width: 1000, height: 580 };
  const CARD_W = 280;
  const contentBox = (viewport: number): number => Math.min(viewport, 1500) - 2 * 26;

  const frame = Number(
    String(
      (
        (tailwindConfig.theme?.extend ?? {}) as unknown as { minHeight?: Record<string, string> }
      ).minHeight?.['cd-hero-frame'],
    ).replace('px', ''),
  );

  /** viewBox point -> CSS px within the hero content box, under `xMidYMid meet`. */
  const toCss = (panel: number, point: [number, number]): [number, number] => {
    const host = { left: 0.22 * panel, width: 0.65 * panel, height: frame };
    const scale = Math.min(host.width / VB.width, host.height / VB.height);
    return [
      host.left + (host.width - VB.width * scale) / 2 + point[0] * scale,
      (host.height - VB.height * scale) / 2 + point[1] * scale,
    ];
  };

  const slots = (panel: number, cardHeight: number) => {
    const column2 = { left: 470, right: panel - 312 };
    return {
      left: { x0: column2.left + 6, x1: column2.left + 6 + CARD_W, y0: 60, y1: 60 + cardHeight },
      right: { x0: column2.right - 6 - CARD_W, x1: column2.right - 6, y0: 60, y1: 60 + cardHeight },
    };
  };
  const covers = (
    slot: { x0: number; x1: number; y0: number; y1: number },
    point: [number, number],
  ): boolean => point[0] >= slot.x0 && point[0] <= slot.x1 && point[1] >= slot.y0 && point[1] <= slot.y1;

  /*
    THE SAMPLE IS THE SPHERE ITSELF, NOT A COUNTRY LIST.

    A country list would be the more concrete evidence, but `countryFocusPoint`
    reaches @globalnews-ai/shared, whose workspace link this test runner cannot
    resolve. Sampling the graticule is the stronger check anyway: every degree
    of the projected sphere is tested, so no locator position can exist that the
    proof did not visit. Country-level counts are reported separately.
  */
  const plotted: Array<{ lon: number; vb: [number, number] }> = [];
  for (let lon = -180; lon <= 180; lon += 1) {
    for (let lat = -90; lat <= 90; lat += 1) {
      plotted.push({ lon, vb: projectPoint([lon, lat]) });
    }
  }

  const obscured = (viewport: number, cardHeight: number, mirror: boolean): number => {
    const panel = contentBox(viewport);
    const slot = slots(panel, cardHeight);
    return plotted.filter((entry) => {
      const chosen = mirror && entry.lon < 0 ? slot.right : slot.left;
      return covers(chosen, toCss(panel, entry.vb));
    }).length;
  };

  it('the harness is real and non-vacuous, and lon < 0 IS the left half of the map', () => {
    expect(plotted.length).toBe(361 * 181);
    // The identity the whole rule rests on, executed rather than asserted.
    expect(projectPoint([0, 0])[0]).toBeCloseTo(VB.width / 2, 6);
    for (const entry of plotted) {
      const west = entry.lon < 0;
      expect({ lon: entry.lon, agrees: west === entry.vb[0] < VB.width / 2 }).toEqual({
        lon: entry.lon,
        agrees: true,
      });
    }
    // Non-vacuous: today's single static anchor really does obscure the map.
    expect(obscured(1440, 181, false)).toBeGreaterThan(0);
  });

  it('AT 1440 AND ABOVE THE MIRROR FULLY SOLVES IT — zero countries are obscured, at both card heights', () => {
    for (const viewport of [1440, 1500, 1920, 2560]) {
      for (const cardHeight of [181, 260]) {
        expect({ viewport, cardHeight, obscured: obscured(viewport, cardHeight, true) }).toEqual({
          viewport,
          cardHeight,
          obscured: 0,
        });
      }
    }
  });

  it('the mirror is a strict improvement on the static anchor at EVERY supported width', () => {
    for (const viewport of [1240, 1280, 1366, 1440, 1500, 1920]) {
      for (const cardHeight of [181, 260]) {
        const before = obscured(viewport, cardHeight, false);
        const after = obscured(viewport, cardHeight, true);
        expect({ viewport, cardHeight, improved: after < before }).toEqual({
          viewport,
          cardHeight,
          improved: true,
        });
      }
    }
  });

  /*
    THE LIMIT, STATED IN CODE SO IT CANNOT BE FORGOTTEN.

    Column 2 is `panel - 782` wide and the card is a fixed 280. Below roughly
    1440 there is no position inside column 2 that clears the map's centre, so
    near-meridian countries stay partly covered whichever slot is chosen. This
    is arithmetic, not tuning, and the mirror still halves the count at 1366.

    If a later milestone fixes this — a narrower card below cd-hero, a third
    slot, a vertical mirror — THIS TEST SHOULD FAIL and be converted. That is
    the intended signal, and the same convention M66.14B L-2 was written under.
  */
  it('KNOWN LIMIT — below 1440 the fixed 280px card cannot clear the meridian inside column 2', () => {
    for (const viewport of [1240, 1366]) {
      const panel = contentBox(viewport);
      const column2Width = panel - 470 - 312;
      const westOfCentre = 0.545 * panel - 470;
      expect({ viewport, fits: westOfCentre >= CARD_W }).toEqual({ viewport, fits: false });
      expect(column2Width).toBeLessThan(CARD_W + 2 * 6 + westOfCentre);
      // So a residue remains, and it is reported rather than implied to be zero.
      expect(obscured(viewport, 181, true)).toBeGreaterThan(0);
    }
  });
});
