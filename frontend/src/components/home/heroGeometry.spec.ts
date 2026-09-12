import { readFileSync } from 'fs';
import { join } from 'path';
import tailwindConfig from '../../../tailwind.config';

/**
 * `theme` on a Tailwind `Config` is optional and loosely typed, so released
 * values are read through the same narrowed view M66.2's headerSourcePort.spec
 * established rather than by indexing an optional chain.
 */
type ThemeExtend = Record<string, Record<string, unknown>>;
const themeExtend = (tailwindConfig.theme?.extend ?? {}) as unknown as ThemeExtend;

// The projection helpers are pure and exported; the country data they would
// normally join is irrelevant to the geometry under test, so it is mocked away
// to keep this spec hermetic and fast.
jest.mock('@/lib/map/countryGeometry', () => ({
  getCountryFeatureCollection: () => ({ type: 'FeatureCollection', features: [] }),
}));

import {
  SPHERE_HALF_X,
  SPHERE_HALF_Y,
  fitScale,
  projectPoint,
  sphereBoundaryPathD,
} from '@/components/home/HeroIntelligenceField';

const heroSource = readFileSync(join(__dirname, 'Hero.tsx'), 'utf-8');
const hudSource = readFileSync(join(__dirname, 'HeroHud.tsx'), 'utf-8');
const fieldSource = readFileSync(join(__dirname, 'HeroIntelligenceField.tsx'), 'utf-8');
const feedSource = readFileSync(join(__dirname, 'HeroLiveFeedPanel.tsx'), 'utf-8');

const cd = themeExtend.colors.cd as Record<string, unknown>;

/** M66.2's helper: every negative guard runs against comment-stripped source. */
const codeOnly = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * M66.3 — the GN-CD-040 → GN-CD-076 geometry and token contract.
 *
 * This file exists because the defects M66.3 corrects were invisible to every
 * class-string assertion the repository already had. The Hero's map was 19%
 * out of aspect and its map track 104px narrower than the released composition,
 * and both passed every test. The assertions below are therefore behavioural
 * wherever they can be: the projection is EXECUTED, the width chain is
 * COMPUTED, the token layer is READ, and only the verbatim HUD path data is
 * matched as text — because for that data, the text IS the specification.
 */

/* ─────────────────────────── 1. the width chain ─────────────────────────── */

describe('M66.3 geometry — the released composition width chain', () => {
  /**
   * GN-CD-302 §E.1, implemented by PageCanvas (M66.1, protected): the page
   * content box is min(viewport, 1500) - 2 x 26. GN-CD-040's Hero surface IS
   * that box, so the map track is whatever the two fixed tracks leave.
   */
  const contentBox = (viewport: number): number => Math.min(viewport, 1500) - 2 * 26;
  const mapTrack = (viewport: number): number => contentBox(viewport) - 470 - 312;

  it('reproduces GN-CD’s own 1388px section content width at the native 1440px viewport', () => {
    expect(contentBox(1440)).toBe(1388);
  });

  it('yields the released 606px map track at 1440 — the figure the pre-M66.3 Hero-local padding and gap cut to 502px', () => {
    expect(mapTrack(1440)).toBe(606);
  });

  it('holds the composition at every viewport at or above the cd-hero handoff, and would not have at lg', () => {
    const breakpoint = Number((themeExtend.screens as unknown as Record<string, string>)['cd-hero'].replace('px', ''));
    expect(breakpoint).toBe(1240);
    expect(mapTrack(breakpoint)).toBeGreaterThanOrEqual(350);
    expect(mapTrack(1280)).toBeGreaterThanOrEqual(390);
    // The gate this replaces: at 1024px the map track was a 138px sliver.
    expect(mapTrack(1024)).toBeLessThan(200);
  });

  it('never produces a negative track, so the composition can never overflow the page and force a horizontal scrollbar', () => {
    for (const viewport of [1240, 1280, 1366, 1440, 1500, 1600, 1920, 2560]) {
      expect(mapTrack(viewport)).toBeGreaterThan(0);
    }
  });

  it('forbids the three Hero-local constraints that caused the narrow runtime Hero (CTO decision L-9)', () => {
    const code = codeOnly(heroSource);
    expect(code).not.toMatch(/max-w-\[1600px\]/);
    expect(code).not.toMatch(/lg:px-8/);
    expect(code).not.toMatch(/lg:gap-5/);
    expect(code).not.toMatch(/\bgap-5\b/);
    expect(heroSource).toMatch(/cd-hero:p-0/);
  });

  it('leaves PageCanvas’s own boundary untouched — the 1500px foundation stays authoritative', () => {
    expect((themeExtend.maxWidth as unknown as Record<string, string>)['cd-page']).toBe('1500px');
    expect((themeExtend.spacing as unknown as Record<string, string>)['cd-26']).toBe('26px');
    expect(codeOnly(heroSource)).not.toMatch(/max-w-cd-page/);
  });
});

/* ───────────────────── 2. the projection, executed ───────────────────── */

describe('M66.3 geometry — GN-CD-043 projection, executed rather than asserted', () => {
  const TRUE_ASPECT = SPHERE_HALF_X / SPHERE_HALF_Y;

  it('computes Natural Earth 1’s real half-extents from the polynomial', () => {
    expect(SPHERE_HALF_X).toBeCloseTo(2.735385, 5);
    expect(SPHERE_HALF_Y).toBeCloseTo(1.422391, 5);
  });

  it('renders the sphere at the projection’s own aspect — the M65 implementation rendered 1.613 against a true 1.9231, stretching every landmass ~19% vertically', () => {
    expect(TRUE_ASPECT).toBeCloseTo(1.9231, 3);
    const east = projectPoint([180, 0]);
    const west = projectPoint([-180, 0]);
    const north = projectPoint([0, 90]);
    const south = projectPoint([0, -90]);
    const renderedWidth = east[0] - west[0];
    const renderedHeight = south[1] - north[1];
    expect(renderedWidth / renderedHeight).toBeCloseTo(TRUE_ASPECT, 3);
  });

  it('centres the sphere in its box, as fitExtent with symmetric insets does', () => {
    const east = projectPoint([180, 0]);
    const west = projectPoint([-180, 0]);
    const north = projectPoint([0, 90]);
    const south = projectPoint([0, -90]);
    expect((east[0] + west[0]) / 2).toBeCloseTo(500, 3);
    expect((north[1] + south[1]) / 2).toBeCloseTo(290, 3);
  });

  it('produces Natural Earth 1’s flat pole line at 55.0% of the equator width — the property that makes an ellipse the wrong primitive', () => {
    const poleEast = projectPoint([180, 90]);
    const poleWest = projectPoint([-180, 90]);
    const equator = projectPoint([180, 0])[0] - projectPoint([-180, 0])[0];
    const poleLine = poleEast[0] - poleWest[0];
    expect(poleLine / equator).toBeCloseTo(0.55, 3);
  });

  it('reproduces d3’s fitExtent output at the released desktop mount and mobile bleed, within GN-CD §V’s ±1px tolerance', () => {
    const east = projectPoint([180, 0]);
    const west = projectPoint([-180, 0]);
    const north = projectPoint([0, 90]);
    const south = projectPoint([0, -90]);
    const viewBoxWidth = east[0] - west[0];
    const viewBoxHeight = south[1] - north[1];

    // What d3.geoNaturalEarth1().fitExtent([[w*.02,h*.07],[w*.98,h*.93]], Sphere)
    // would produce for a given host box.
    const fitExtentSphere = (w: number, h: number): [number, number] => {
      const k = fitScale(w, h);
      return [2 * SPHERE_HALF_X * k, 2 * SPHERE_HALF_Y * k];
    };
    // What a fixed viewBox plus preserveAspectRatio="xMidYMid meet" produces.
    const renderedSphere = (w: number, h: number): [number, number] => {
      const s = Math.min(w / 1000, h / 580);
      return [viewBoxWidth * s, viewBoxHeight * s];
    };

    // The released desktop mount: left:22% right:13% of a 1388px Hero, over a
    // frame at and above the 428px floor. And the released mobile bleed.
    const hosts: Array<[number, number]> = [
      [902.2, 428],
      [902.2, 470],
      [902.2, 560],
      [238, 198],
    ];
    for (const [w, h] of hosts) {
      const [fw, fh] = fitExtentSphere(w, h);
      const [rw, rh] = renderedSphere(w, h);
      expect(Math.abs(rw - fw)).toBeLessThan(1);
      expect(Math.abs(rh - fh)).toBeLessThan(1);
    }
  });

  it('emits a closed sphere boundary path, not an approximation primitive', () => {
    const d = sphereBoundaryPathD();
    expect(d.startsWith('M ')).toBe(true);
    expect(d.trim().endsWith('Z')).toBe(true);
    expect(d.length).toBeGreaterThan(500);
  });
});

/* ───────────────────────── 3. released placements ───────────────────────── */

describe('M66.3 geometry — GN-CD-040/041/043/053/054 placements', () => {
  it('keeps GN-CD-040’s frame values at both viewports', () => {
    expect(heroSource).toMatch(/cd-hero:grid-cols-\[minmax\(0,470px\)_minmax\(0,1fr\)_312px\]/);
    expect(heroSource).toMatch(/cd-hero:min-h-cd-hero-frame/);
    expect((themeExtend.minHeight as unknown as Record<string, string>)['cd-hero-frame']).toBe('428px');
    expect((themeExtend.borderRadius as unknown as Record<string, string>)['cd-18']).toBe('18px');
    expect((themeExtend.borderRadius as unknown as Record<string, string>)['cd-16']).toBe('16px');
    expect(cd['edge-card']).toBe('rgba(56,189,248,0.14)');
    expect(cd['edge-section']).toBe('rgba(56,189,248,0.16)');
    expect((themeExtend.backgroundImage as unknown as Record<string, string>)['cd-hero']).toBe(
      'radial-gradient(1200px 620px at 58% 40%, rgba(11,52,100,.5), rgba(4,7,14,.97) 72%)',
    );
    expect((themeExtend.backgroundImage as unknown as Record<string, string>)['cd-hero-m']).toBe(
      'radial-gradient(320px 260px at 92% 6%, rgba(13,58,112,.75), rgba(6,10,20,.96) 72%)',
    );
  });

  it('mounts the map at exactly 22% / 13%, with no floor that would delete the underlap', () => {
    expect(heroSource).toMatch(/left: '22%', right: '13%'/);
    // `minmax(` in the track definition legitimately contains "max(", so the
    // guard names the floor it is actually forbidding.
    expect(codeOnly(heroSource)).not.toMatch(/max\(22%/);
    expect(codeOnly(heroSource)).not.toMatch(/Math\.max/);
  });

  it('anchors the scrims to the hero surface, at their released percentages', () => {
    expect(heroSource).toMatch(/left-\[20%\] hidden w-\[16%\] bg-cd-scrim-l/);
    expect(heroSource).toMatch(/right-\[12%\] hidden w-\[12%\] bg-cd-scrim-r/);
    // GN-CD-053's own risk note: a scrim that ever received pointer events would
    // block the map beneath it in the 20-36% and 88-100% bands.
    const leftScrim = heroSource.slice(heroSource.indexOf('bg-cd-scrim-l') - 400, heroSource.indexOf('bg-cd-scrim-l'));
    expect(leftScrim).toContain('pointer-events-none');
    expect(leftScrim).toContain('aria-hidden');
  });

  it('keeps the map mount, both scrims and the mobile bleed out of the accessibility tree', () => {
    for (const marker of ['bg-cd-grid-hero', 'bg-cd-scrim-l', 'bg-cd-scrim-r', 'bg-cd-map-scrim-a']) {
      const before = heroSource.slice(Math.max(0, heroSource.indexOf(marker) - 500), heroSource.indexOf(marker));
      expect(before).toContain('aria-hidden');
    }
  });
});

/* ──────────────────────── 4. the HUD, verbatim ──────────────────────── */

describe('M66.3 geometry — GN-CD-042 / 042b HUD', () => {
  it('uses the released viewBoxes and slice fitting at both viewports', () => {
    expect(hudSource).toMatch(/viewBox="0 0 1500 430"/);
    expect(hudSource).toMatch(/viewBox="0 0 340 300"/);
    // Counts run on executable source: the doc comment legitimately quotes the
    // same attribute while explaining the off-centre crosshair.
    expect((codeOnly(hudSource).match(/preserveAspectRatio="xMidYMid slice"/g) ?? []).length).toBe(2);
  });

  it('carries every desktop sub-layer, at its exact geometry', () => {
    for (const fragment of [
      'cx="900" cy="200" r="560"',
      'cx="900" cy="200" r="420"',
      'cx="1320" cy="470" r="330"',
      'M120 400 C 420 250 760 120 1420 60',
      'M-40 120 C 380 200 700 330 1500 300',
      'M900 200 L 470 30',
      'M900 200 L 1500 420',
      'M900 200 L 300 400',
      'M900 200 L 1460 40',
      'M872 200 h18',
      'M910 200 h18',
      'M900 172 v18',
      'M900 210 v18',
      'M60 418 v-7',
      'M120 418 v-11',
      'M180 418 v-7',
      'M240 418 v-7',
      'M300 418 v-11',
      'M360 418 v-7',
      'M1140 14 h-7',
      'M1140 34 h-11',
      'M1140 54 h-7',
      'strokeDasharray="70 620"',
      'r="250"',
    ]) {
      expect(hudSource).toContain(fragment);
    }
  });

  it('carries every mobile sub-layer, and NO sweep — GN-CD-042b is a recomposition, not a scale', () => {
    for (const fragment of [
      'cx="250" cy="80" r="180"',
      'cx="250" cy="80" r="120"',
      'M-20 240 C 90 190 190 120 360 70',
      'M234 80 h12',
      'M254 80 h12',
      'M250 64 v12',
      'M250 84 v12',
      'M20 292 v-6',
      'M50 292 v-9',
      'M80 292 v-6',
      'M110 292 v-6',
    ]) {
      expect(hudSource).toContain(fragment);
    }
    const mobileBlock = hudSource.slice(hudSource.indexOf('viewBox="0 0 340 300"'));
    expect(mobileBlock).not.toContain('animate-cd-hud-sweep-hero');
  });

  it('never exceeds GN-CD-300 §W.1’s .22 HUD stroke ceiling on either channel', () => {
    const alphas = [...hudSource.matchAll(/rgba\((?:56,189,248|34,211,238),(\.\d+|0\.\d+)\)/g)].map((m) =>
      Number(m[1].startsWith('.') ? `0${m[1]}` : m[1]),
    );
    expect(alphas.length).toBeGreaterThan(5);
    for (const a of alphas) expect(a).toBeLessThanOrEqual(0.22);
  });

  it('is decorative and inert', () => {
    const hudCode = codeOnly(hudSource);
    expect((hudCode.match(/aria-hidden="true"/g) ?? []).length).toBe(2);
    expect((hudCode.match(/pointer-events-none/g) ?? []).length).toBe(2);
    expect(hudCode).not.toMatch(/onClick|tabIndex|role=/);
  });
});

/* ─────────────────────── 5. token-layer integrity ─────────────────────── */

describe('M66.3 tokens — additive only, and collision-free', () => {
  it('introduces zero collisions in the bg- namespace, which Tailwind shares between colors, backgroundImage and backgroundSize', () => {
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
    expect(seen.size).toBeGreaterThan(120);
  });

  it('leaves every legacy token untouched', () => {
    const colors = themeExtend.colors;
    // The LEGACY `void` (#080b12) and the released `cd.void` (#04060c) are
    // different values with different meanings; M66.1 kept them separate on
    // purpose and M66.3 must not converge them.
    expect(colors.void).toBe('#080b12');
    expect(cd.void).toBe('#04060c');
    for (const legacy of ['void', 'surface', 'border', 'signal', 'ice', 'ink']) {
      expect(Object.keys(colors)).toContain(legacy);
    }
    const fontFamily = themeExtend.fontFamily as unknown as Record<string, string[]>;
    expect(fontFamily.display).toEqual(['var(--font-display)', 'sans-serif']);
    expect(fontFamily.body).toEqual(['var(--font-body)', 'sans-serif']);
    expect(fontFamily.mono).toEqual(['var(--font-mono)', 'monospace']);
  });

  it('leaves every previously approved cd-* token untouched', () => {
    expect(cd.void).toBe('#04060c');
    expect((cd.ink as Record<string, string>).primary).toBe('#e8f1ff');
    expect((cd.ink as Record<string, string>).meta).toBe('#5b7fa6');
    expect(cd['rule-hero']).toBe('rgba(56,189,248,0.035)');
    expect(cd['nav-hover']).toBe('rgba(56,189,248,0.08)');
    expect((themeExtend.maxWidth as unknown as Record<string, string>)['cd-page']).toBe('1500px');
    expect((themeExtend.screens as unknown as Record<string, string>)['cd-header']).toBe('1400px');
    expect((themeExtend.fontSize as unknown as Record<string, [string, Record<string, string>]>)['cd-hero'][0]).toBe(
      'clamp(34px,3.5vw,54px)',
    );
  });

  it('releases the GN-CD-040→76 values M66.1 did not cover, at their exact alphas', () => {
    expect(cd['hud-sky-22']).toBe('rgba(56,189,248,0.22)');
    expect(cd['fill-feed']).toBe('rgba(4,8,16,0.90)');
    expect(cd['fill-ask']).toBe('rgba(6,13,26,0.90)');
    expect(cd['fill-ask-m']).toBe('rgba(5,11,22,0.94)');
    expect(cd['fill-action']).toBe('rgba(6,12,24,0.72)');
    expect(cd['fill-badge']).toBe('rgba(8,44,70,0.50)');
    expect(cd['fill-live']).toBe('rgba(16,72,55,0.50)');
    expect(cd['edge-live']).toBe('rgba(52,211,153,0.45)');
    expect(cd['fill-country']).toBe('rgba(13,48,88,0.62)');
    expect(cd['edge-country']).toBe('rgba(56,189,248,0.42)');
    expect(cd['rule-graticule']).toBe('rgba(56,189,248,0.085)');
    expect(cd['link-decor']).toBe('rgba(96,165,250,0.30)');
    expect((themeExtend.backgroundImage as unknown as Record<string, string>)['cd-sweep']).toBe(
      'conic-gradient(from 0deg, transparent 0 80%, rgba(251,191,36,.95) 90%, transparent 96%)',
    );
    expect((themeExtend.boxShadow as unknown as Record<string, string>)['cd-sweep-glow']).toBe('0 0 26px rgba(251,191,36,.14) inset');
  });
});

/* ──────────────────── 6. motion, contrast, honesty ──────────────────── */

describe('M66.3 — reduced motion', () => {
  const sources = [heroSource, hudSource, feedSource];

  it('uses only released cd-* animation tokens or inline styles, both of which the M66.1 globals.css layer neutralises', () => {
    const animations = Object.keys(themeExtend.animation as unknown as Record<string, string>);
    for (const source of sources) {
      for (const cls of source.match(/animate-[a-z0-9-]+/g) ?? []) {
        const name = cls.replace('animate-', '');
        if (name === 'none') continue;
        expect(animations).toContain(name);
      }
    }
  });

  /*
    M66.14C — THIS TEST USED TO CODIFY THE DEFECT.

    It asserted that cd-row-amber was deliberately NOT in themeExtend.animation,
    reasoning that GN-CD-304 §V's formula stagger meant the animation could not
    be tokenised. That inference was wrong, and it is what made the scan
    invisible: Tailwind emits an @keyframes block only when it generates an
    animation utility referencing it, so with no animation entry and no
    `animate-` class the keyframe never reached the built CSS at all. Browser
    acceptance watched a full 13-second cycle and saw nothing.

    Tokenising the animation and computing the stagger by formula were never in
    conflict. The utility now supplies name, duration, easing and iteration; the
    per-row delay is still a formula on an inline style. Both halves of §V hold,
    and the keyframe is emitted.
  */
  it('emits the GN-CD-074 row scan as a released utility plus a FORMULA stagger, so it survives a change in list length', () => {
    expect(feedSource).toMatch(/animate-cd-row-amber/);
    expect(feedSource).toMatch(/style=\{\{ animationDelay: `\$\{\(index \* 2\.1\)\.toFixed\(1\)\}s` \}\}/);
    expect(Object.keys(themeExtend.keyframes as unknown as Record<string, unknown>)).toContain('cd-row-amber');
  });

  it('THE REGRESSION THAT WOULD HAVE CAUGHT THIS — the keyframe is actually reachable by the browser', () => {
    /*
      Tailwind emits @keyframes ONLY for a keyframes entry that some generated
      animation utility references. A keyframes entry with no animation entry is
      dead configuration: it type-checks, it reads correctly, and it produces no
      CSS. Every previous test asserted the source string and the keyframes
      block; none asserted the link between them, which is why a green suite sat
      on top of an invisible animation.
    */
    const animation = themeExtend.animation as unknown as Record<string, string>;
    const keyframes = themeExtend.keyframes as unknown as Record<string, unknown>;

    expect(Object.keys(animation)).toContain('cd-row-amber');
    // The utility names the keyframe, carries the 13s period and repeats.
    expect(animation['cd-row-amber']).toBe('cd-row-amber 13s ease-out infinite');
    expect(keyframes['cd-row-amber']).toBeDefined();

    // Generalised: EVERY animate-* class used by these sources must resolve to
    // an animation entry whose keyframe exists, or it emits nothing at runtime.
    for (const source of sources) {
      for (const cls of source.match(/animate-cd-[a-z0-9-]+/g) ?? []) {
        const name = cls.replace('animate-', '');
        const declaration = animation[name];
        expect({ cls, hasAnimation: typeof declaration === 'string' }).toEqual({ cls, hasAnimation: true });
        expect({ cls, hasKeyframe: keyframes[declaration.split(' ')[0]] !== undefined }).toEqual({
          cls,
          hasKeyframe: true,
        });
      }
    }
  });

  it('never hides a layer under reduced motion, so nothing can shift', () => {
    for (const source of sources) {
      expect(codeOnly(source)).not.toMatch(/cd-motion-pulse/);
    }
  });
});

describe('M66.3 — contrast (GN-CD UNRESOLVED-011, measured)', () => {
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

  // The two extremes of GN-CD-040's radial: its lit core, and its outer stop.
  const litCore = over(rgb('#0b3464'), 0.5, rgb('#04060c'));
  const darkEdge = over(rgb('#04070e'), 0.97, rgb('#04060c'));
  const feedPanel = over(rgb('#040810'), 0.9, darkEdge);

  it('passes WCAG 2.1 SC 1.4.3 for every text role this family renders, measured against the LIT core, not just the darkest bed', () => {
    const ink = cd.ink as Record<string, string>;
    const textRoles = [ink.primary, ink.secondary, ink.tertiary, ink.muted, ink.label, ink.attention, ink.live, ink.critical];
    for (const hex of textRoles) {
      expect(ratio(luminance(rgb(hex)), luminance(litCore))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('records the one released token that does NOT clear 4.5:1 over the lit core, so no future element places it there unbacked', () => {
    const meta = (cd.ink as Record<string, string>).meta;
    expect(ratio(luminance(rgb(meta)), luminance(litCore))).toBeLessThan(4.5);
    // It is used only over the feed panel and the ask field, where it passes.
    expect(ratio(luminance(rgb(meta)), luminance(feedPanel))).toBeGreaterThanOrEqual(4.5);
    expect(codeOnly(heroSource)).not.toMatch(/cd-hero:.*text-cd-ink-meta.*absolute/);
  });

  it('passes SC 1.4.11 for the non-text roles the family relies on', () => {
    for (const hex of ['#38bdf8', '#22d3ee', '#fbbf24', '#34d399']) {
      expect(ratio(luminance(rgb(hex)), luminance(darkEdge))).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('M66.3 — no fabricated intelligence anywhere in the family (CTO decision L-8)', () => {
  const sources = { heroSource, hudSource, fieldSource, feedSource };

  it('renders no prototype signal table, count, scope or relationship', () => {
    for (const [name, source] of Object.entries(sources)) {
      const code = codeOnly(source);
      for (const forbidden of ['118', 'ACTIVE SIGNALS', 'SCOPE_R', 'RELATED', 'gn-signal', 'focusSpot', 'spotCount']) {
        expect(`${name}:${code.includes(forbidden)}`).toBe(`${name}:false`);
      }
    }
  });

  it('renders no source count, evidence-scope string or critical flag in the feed', () => {
    const code = codeOnly(feedSource);
    expect(code).not.toMatch(/SOURCES|EVIDENCE|crit\b|critical/i);
    expect(code).not.toMatch(/titleColor/);
  });

  it('keeps the feed on the single already-fetched array — no fetch, no client, no second path', () => {
    expect(codeOnly(feedSource)).not.toMatch(/fetch\(|useEffect|useState|axios|swr/i);
    expect(codeOnly(heroSource)).not.toMatch(/fetch\(/);
  });
});
