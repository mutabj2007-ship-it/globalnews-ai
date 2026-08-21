import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import tailwindConfig from '../../../tailwind.config';

/**
 * M66.1 — THE CLAUDE DESIGN FOUNDATION CONTRACT.
 *
 * Before this milestone, NOTHING in this repository tested `tailwind.config.ts`
 * or `globals.css`: the entire styling foundation was unverified. This file is
 * that coverage, and it is deliberately built the opposite way round from the
 * presentation-lock specs this codebase accumulated earlier.
 *
 * It IMPORTS the real Tailwind config and asserts real values, so the
 * assertions survive reformatting, reordering, renaming of local variables and
 * any change of code style. Source text is read only where there is no
 * alternative — CSS has no module interface, and a "this file contains no
 * fetch()" contract can only be expressed against source. Even then the
 * assertion targets a CONTRACT, never a class list or a pixel value.
 *
 * Two halves, and the second matters as much as the first:
 *   1. every `cd-*` token equals its released GN-CD value verbatim;
 *   2. every PRE-EXISTING token is byte-for-byte unchanged.
 *
 * (2) is what makes the additive strategy enforceable rather than a promise.
 * `ink-tertiary` has 24 consumers outside the homepage and `font-mono` has 27;
 * six routes with no released design (/search, /map, /history, /workspace,
 * /privacy, /terms) render entirely on the legacy tokens. If a future change
 * repoints one of them to gain Claude Design fidelity on the homepage, these
 * tests fail loudly instead of those six screens changing quietly.
 *
 * Authority throughout: GN-CD-300 → GN-CD-307, released 2026-08-18.
 * GN-CD-300 §V sets the acceptance contract — exact match, no rounding of
 * alpha. Assertions below are written to that standard.
 */

// ---------------------------------------------------------------------------
// Typed access to the config. Tailwind's own `Config` type describes theme
// values as deeply resolvable unions, which is correct for Tailwind and useless
// for assertions. One narrow local shape, one documented cast, no `any`.
// ---------------------------------------------------------------------------

type ColorGroup = Record<string, string>;

interface FoundationTheme {
  colors: {
    void: string;
    surface: ColorGroup;
    border: ColorGroup;
    signal: ColorGroup;
    ice: string;
    ink: ColorGroup;
    cd: Record<string, string | ColorGroup>;
  };
  fontFamily: Record<string, string[]>;
  fontSize: Record<string, unknown>;
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  maxWidth: Record<string, string>;
  minHeight: Record<string, string>;
  backgroundImage: Record<string, string>;
  backgroundSize: Record<string, string>;
  boxShadow: Record<string, string>;
  keyframes: Record<string, Record<string, Record<string, string>>>;
  animation: Record<string, string>;
}

const theme = (tailwindConfig.theme?.extend ?? {}) as unknown as FoundationTheme;
const cd = theme.colors.cd;

function cdColor(key: string): string {
  const value = cd[key];
  if (typeof value !== 'string') throw new Error(`cd.${key} is not a colour string`);
  return value;
}

function cdGroup(key: string): ColorGroup {
  const value = cd[key];
  if (typeof value === 'string' || value === undefined) throw new Error(`cd.${key} is not a colour group`);
  return value;
}

const globalsCss = readFileSync(join(__dirname, '../../app/globals.css'), 'utf-8');
const layoutSource = readFileSync(join(__dirname, '../../app/layout.tsx'), 'utf-8');
const pageSource = readFileSync(join(__dirname, '../../app/page.tsx'), 'utf-8');
const pageCanvasSource = readFileSync(join(__dirname, 'PageCanvas.tsx'), 'utf-8');
const navBarSource = readFileSync(join(__dirname, '../navigation/NavBar.tsx'), 'utf-8');
/* M66.11 — the header language control moved out of NavBar's markup and into
   its own component, so the GN-CD-306 §W assertion below reads it there. */
const languageSelectorSource = readFileSync(
  join(__dirname, '../search/LanguageSelector.tsx'),
  'utf-8',
);
const tailwindConfigSource = readFileSync(join(__dirname, '../../../tailwind.config.ts'), 'utf-8');

/**
 * Normalises a CSS colour so `rgba(34, 211, 238, 0.7)` and
 * `rgba(34,211,238,0.70)` compare equal. Needed because the same released
 * value is authored once in CSS (spaced, per Prettier) and once in the Tailwind
 * config (compact) — they must MEAN the same thing, not look the same.
 */
function normalizeColor(value: string): string {
  const parsed = /^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/.exec(value.replace(/\s+/g, ''));
  if (parsed === null) return value.trim().toLowerCase();
  const alpha = parsed[4] === undefined ? 1 : Number(parsed[4]);
  return `rgba(${parsed[1]},${parsed[2]},${parsed[3]},${alpha})`;
}

/** Strips comments so a doc-comment mentioning a value can never satisfy — or break — an assertion. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Every source file under src/, for whole-tree prohibitions. */
function allSourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) allSourceFiles(full, found);
    else if (/\.(ts|tsx|css)$/.test(entry)) found.push(full);
  }
  return found;
}

const SRC_ROOT = join(__dirname, '../..');
const CONFIG_PATH = join(__dirname, '../../../tailwind.config.ts');

/**
 * A file's CODE, with comments removed.
 *
 * Both whole-tree prohibitions below scan for a literal that this milestone's
 * own documentation necessarily quotes — `#fcd34d` is named in the config
 * comment that explains why it is absent, and `1360` is named in the comment
 * that explains why it is not reproduced. Scanning raw text would fail on the
 * prose while the code is correct, which is a guard that punishes documentation.
 * These scans therefore look at code only, and skip this spec file, which
 * quotes both strings by necessity.
 */
function codeOf(file: string): string {
  return stripComments(readFileSync(file, 'utf-8'));
}

// ---------------------------------------------------------------------------
// WCAG 2.1 contrast, computed rather than asserted from a table.
// ---------------------------------------------------------------------------

type Rgb = [number, number, number];

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

/** Composite a translucent foreground over an opaque background. */
function composite(foreground: Rgb, alpha: number, background: Rgb): Rgb {
  return foreground.map((channel, index) => Math.round(alpha * channel + (1 - alpha) * background[index])) as Rgb;
}

describe('M66.1 — the pre-existing production token system is UNTOUCHED', () => {
  it('every legacy colour token still holds its exact pre-M66.1 value', () => {
    expect(theme.colors.void).toBe('#080b12');
    expect(theme.colors.surface.DEFAULT).toBe('#0f1420');
    expect(theme.colors.surface.hover).toBe('#141b2b');
    expect(theme.colors.surface.raised).toBe('#161d2c');
    expect(theme.colors.border.DEFAULT).toBe('#1e2636');
    expect(theme.colors.border.strong).toBe('#2a3548');
    expect(theme.colors.signal.DEFAULT).toBe('#3d6fff');
    expect(theme.colors.signal.bright).toBe('#6c93ff');
    expect(theme.colors.signal.dim).toBe('#1e3a8a');
    expect(theme.colors.ice).toBe('#a8c5ff');
    expect(theme.colors.ink.primary).toBe('#edeff5');
    expect(theme.colors.ink.secondary).toBe('#93a0b8');
    expect(theme.colors.ink.tertiary).toBe('#5c6780');
  });

  it('the legacy font stacks are unchanged — `font-body` is still Inter, so no undesigned route changes typeface', () => {
    expect(theme.fontFamily.display).toEqual(['var(--font-display)', 'sans-serif']);
    expect(theme.fontFamily.body).toEqual(['var(--font-body)', 'sans-serif']);
    expect(theme.fontFamily.mono).toEqual(['var(--font-mono)', 'monospace']);
    // The body variable must still be fed by Inter, not repointed (CTO D3).
    expect(stripComments(layoutSource)).toMatch(/Inter\(\{[\s\S]*?variable: '--font-body'/);
  });

  it('the four legacy animations are unchanged, emblem timings included', () => {
    expect(theme.animation['ring-pulse']).toBe('ring-pulse 3.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite');
    expect(theme.animation['fade-slide-in']).toBe('fade-slide-in 0.4s ease-out forwards');
    expect(theme.animation['fade-slide-out']).toBe('fade-slide-out 0.4s ease-in forwards');
    expect(theme.animation['emblem-scan']).toBe('emblem-scan 14s linear infinite');
  });

  it('the pre-existing globals.css foundation survives verbatim', () => {
    // The global focus fallback the prototype never had. It serves the six
    // undesigned routes and must not be repointed to the Claude Design cyan.
    expect(globalsCss).toMatch(/:focus-visible \{\s*outline: 2px solid #6c93ff;\s*outline-offset: 2px;/);
    // The universal reduced-motion block. Broader than GN-CD-305's attribute
    // selector, because it also reaches Tailwind `animate-*` utilities.
    expect(globalsCss).toMatch(/\*,\s*\*::before,\s*\*::after \{\s*animation-duration: 0\.01ms !important;/);
    expect(globalsCss).toMatch(/animation-iteration-count: 1 !important;/);
    expect(globalsCss).toMatch(/transition-duration: 0\.01ms !important;/);
    expect(globalsCss).toMatch(/::selection \{\s*background-color: rgba\(61, 111, 255, 0\.35\);/);
  });

  it('the document body still renders on the legacy tokens — the canvas is opt-in per page', () => {
    expect(layoutSource).toMatch(/<body className="bg-void font-body text-ink-primary antialiased">/);
  });
});

describe('M66.1 — GN-CD-300 colour tokens, exact', () => {
  it('the page base is the released #04060c (§F.1)', () => {
    expect(cdColor('void')).toBe('#04060c');
    // And it is genuinely a NEW token, not a repointing of the legacy base.
    expect(theme.colors.void).not.toBe(cdColor('void'));
  });

  it('the composite page background reproduces both released radial layers, stops included (§F.2)', () => {
    const pageBackground = theme.backgroundImage['cd-page'];
    expect(pageBackground).toContain('radial-gradient(1100px 600px at 62% -10%, rgba(14,55,110,.55), transparent 70%)');
    expect(pageBackground).toContain('radial-gradient(700px 500px at 8% 30%, rgba(20,90,150,.22), transparent 70%)');
  });

  it('all 26 typography colour tokens are present at their released values (§I)', () => {
    const ink = cdGroup('ink');
    expect(Object.keys(ink)).toHaveLength(26);
    expect(ink.primary).toBe('#e8f1ff');
    expect(ink.secondary).toBe('#a7c0d8');
    expect(ink.tertiary).toBe('#9fbdd8');
    expect(ink.label).toBe('#7dd3fc');
    expect(ink.meta).toBe('#5b7fa6');
    expect(ink['core-sub']).toBe('#5b9fd0');
    expect(ink.live).toBe('#6ee7b7');
    expect(ink.critical).toBe('#fca5a5');
    expect(ink.link).toBe('#22d3ee');
  });

  it('the cyan/blue accent ladder is complete — all 10 values (§J.1)', () => {
    const accent = cdGroup('accent');
    expect(Object.values(accent).sort()).toEqual(
      ['#22d3ee', '#38bdf8', '#67e8f9', '#7dd3fc', '#a5f3fc', '#60a5fa', '#8ab4ff', '#2563eb', '#1d4ed8', '#0e7490'].sort(),
    );
  });

  it('the semantic bindings carry their released values (§J.2, GN-CD-307 §J)', () => {
    expect(cdColor('live')).toBe('#34d399');
    expect(cdColor('live-text')).toBe('#6ee7b7');
    expect(cdColor('amber')).toBe('#fbbf24');
    expect(cdColor('amber-text')).toBe('#fde68a');
    expect(cdColor('red')).toBe('#f87171');
    expect(cdColor('red-text')).toBe('#fca5a5');
    expect(cdColor('violet')).toBe('#a78bfa');
    expect(cdColor('violet-light')).toBe('#c4b5fd');
    expect(cdColor('orange')).toBe('#fb923c');
  });

  it('the border and glow roles are exact (§H)', () => {
    expect(cdColor('edge-structural')).toBe('rgba(56,189,248,0.12)');
    expect(cdColor('edge-card')).toBe('rgba(56,189,248,0.14)');
    expect(cdColor('edge-section')).toBe('rgba(56,189,248,0.16)');
    expect(cdColor('edge-header')).toBe('rgba(56,189,248,0.18)');
    expect(cdColor('edge-divider')).toBe('rgba(56,189,248,0.08)');
    expect(cdColor('edge-focus')).toBe('rgba(34,211,238,0.70)');
    expect(cdColor('edge-focus-strong')).toBe('rgba(34,211,238,0.80)');
    expect(cdColor('edge-focus-halo')).toBe('rgba(34,211,238,0.35)');
  });

  it('ALPHA PRECISION: the four grid alphas are four distinct tokens, never collapsed (§W.2)', () => {
    const alphas = ['rule-page', 'rule-hero', 'rule-engine', 'rule-map'].map(cdColor);
    expect(alphas).toEqual([
      'rgba(56,189,248,0.045)',
      'rgba(56,189,248,0.035)',
      'rgba(56,189,248,0.03)',
      'rgba(56,189,248,0.05)',
    ]);
    // .045 and .05 are different tokens. Rounding one into the other is the
    // exact failure §W.2 exists to prevent.
    expect(new Set(alphas).size).toBe(4);
  });

  it('NON-NEGOTIABLE (§W.1): the HUD construction stroke ladder never exceeds alpha .22', () => {
    const hud = Object.entries(cd).filter(([key]) => key.startsWith('hud-'));
    expect(hud.length).toBeGreaterThanOrEqual(16);
    for (const [key, value] of hud) {
      const alpha = /rgba\(\d+,\d+,\d+,(0?\.\d+)\)/.exec(String(value));
      expect(alpha).not.toBeNull();
      expect(Number(alpha?.[1])).toBeLessThanOrEqual(0.22);
      expect(key).toMatch(/^hud-(sky|cyan)-\d{2}$/);
    }
  });

  it('NON-NEGOTIABLE (§W.4): #fcd34d "does not exist and must not appear" — anywhere in the tree', () => {
    const offenders = allSourceFiles(SRC_ROOT)
      .concat([CONFIG_PATH])
      .filter((file) => file !== __filename)
      .filter((file) => /#fcd34d/i.test(codeOf(file)));
    expect(offenders).toEqual([]);
  });
});

describe('M66.1 — GN-CD-301 typography capability', () => {
  it('the Claude Design stacks are exactly as authored, with no extra fallback (§I.1)', () => {
    expect(theme.fontFamily['cd-display']).toEqual(['var(--font-cd-display)', 'sans-serif']);
    expect(theme.fontFamily['cd-body']).toEqual(['var(--font-cd-body)', 'system-ui', 'sans-serif']);
    expect(theme.fontFamily['cd-mono']).toEqual(['var(--font-cd-mono)', 'monospace']);
  });

  it('every released weight is loaded, on the Claude Design variables (§I.1)', () => {
    const code = stripComments(layoutSource);
    expect(code).toMatch(/weight: \['400', '500', '600', '700'\],\s*variable: '--font-cd-display'/);
    expect(code).toMatch(/weight: \['400', '500', '600'\],\s*variable: '--font-cd-body'/);
    expect(code).toMatch(/weight: \['400', '500', '600'\],\s*variable: '--font-cd-mono'/);
    expect(code).toMatch(/IBM_Plex_Sans/);
  });

  it('the released weights are NOT added to the legacy variables — 7 files outside the homepage would have restyled', () => {
    // `font-mono font-semibold` (600) is used by map/CountryContextShelf,
    // map/CoverageMetrics, map/MapTooltip, search/AnalysisModeBadge,
    // search/RetrievalContextStatus, search/TrustBadge and ui/DataModeLabel.
    // IBM Plex Mono is loaded at 400/500 on `--font-mono`, so all seven fall
    // back today. Loading 600 there would change how /map and /search render.
    const code = stripComments(layoutSource);
    expect(code).toMatch(/weight: \['500', '700'\],\s*variable: '--font-display'/);
    expect(code).toMatch(/weight: \['400', '500'\],\s*variable: '--font-mono'/);
    expect(code).toMatch(/weight: \['400', '500', '600'\],\s*variable: '--font-body'/);
  });

  it('the Claude Design faces are not preloaded, so undesigned routes fetch nothing extra', () => {
    const code = stripComments(layoutSource);
    expect((code.match(/preload: false/g) ?? []).length).toBe(3);
  });

  it('the three role scales are available, so later milestones consume tokens instead of re-deriving px (§I.2–I.4)', () => {
    const sizes = Object.keys(theme.fontSize);
    // Every token in this file belongs to the Claude Design namespace.
    expect(sizes.every((key) => key.startsWith('cd-'))).toBe(true);
    expect(sizes).toContain('cd-hero');
    expect(sizes).toContain('cd-lockup');
    expect(sizes).toContain('cd-module-desc');
    expect(sizes).toContain('cd-mono-core-sub');
    expect(sizes.filter((key) => key.startsWith('cd-mono-')).length).toBeGreaterThanOrEqual(28);
  });

  it('the hero headline keeps its released fluid clamp and negative tracking (§I.2)', () => {
    expect(JSON.stringify(theme.fontSize['cd-hero'])).toContain('clamp(34px,3.5vw,54px)');
    expect(JSON.stringify(theme.fontSize['cd-hero'])).toContain('-0.026em');
  });
});

describe('M66.1 — GN-CD-302 spacing, radius and hit targets', () => {
  it('the 18px section rhythm exists as a token — NON-NEGOTIABLE (§E.1, §W)', () => {
    expect(theme.spacing['cd-18']).toBe('18px');
  });

  it('the released spacing ladder is present and every value is px-exact (§E.1)', () => {
    for (const [key, value] of Object.entries(theme.spacing)) {
      expect(key).toMatch(/^cd-\d+$/);
      expect(value).toBe(`${key.replace('cd-', '')}px`);
    }
    for (const px of [2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 22, 26, 28, 36]) {
      expect(theme.spacing[`cd-${px}`]).toBe(`${px}px`);
    }
  });

  it('the released radius scale is present and px-exact (§E.2)', () => {
    for (const px of [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 16, 18]) {
      expect(theme.borderRadius[`cd-${px}`]).toBe(`${px}px`);
    }
    expect(theme.borderRadius['cd-pill']).toBe('999px');
  });

  it('the 44px mobile hit-target floor is available as a token (§E.3, §O, §W)', () => {
    expect(theme.minHeight['cd-touch']).toBe('44px');
  });

  it('the desktop presentation boundary is the released 1500px (§E.1)', () => {
    expect(theme.maxWidth['cd-page']).toBe('1500px');
  });
});

describe('M66.1 — GN-CD-300 §G page grid', () => {
  it('the grid renders at the released colour and the released 56px spacing', () => {
    expect(theme.backgroundImage['cd-grid-page']).toContain('rgba(56,189,248,0.045)');
    expect(theme.backgroundSize['cd-grid-56']).toBe('56px 56px');
  });

  it('all four released grid spacings are kept distinct', () => {
    expect(theme.backgroundSize['cd-grid-56']).toBe('56px 56px');
    expect(theme.backgroundSize['cd-grid-44']).toBe('44px 44px');
    expect(theme.backgroundSize['cd-grid-38']).toBe('38px 38px');
    expect(theme.backgroundSize['cd-grid-30']).toBe('30px 30px');
  });

  it('no `bg-` prefixed key collides across colors, backgroundImage and backgroundSize', () => {
    // Tailwind emits all three namespaces under `bg-`. A duplicate name makes
    // one of the two utilities unreachable, which a build will not report.
    const flatten = (source: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(source).flatMap(([key, value]) =>
        value !== null && typeof value === 'object' && !Array.isArray(value)
          ? flatten(value as Record<string, unknown>, prefix ? `${prefix}-${key}` : key)
          : [(prefix ? `${prefix}-${key}` : key).replace(/-DEFAULT$/, '')],
      );
    const names = [
      ...flatten(theme.colors as unknown as Record<string, unknown>),
      ...flatten(theme.backgroundImage as unknown as Record<string, unknown>),
      ...flatten(theme.backgroundSize as unknown as Record<string, unknown>),
    ];
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('M66.1 — GN-CD-304 motion tokens', () => {
  it('the released keyframe set is present, and the three unreferenced definitions are pruned (§L.1)', () => {
    const names = Object.keys(theme.keyframes).filter((key) => key.startsWith('cd-'));
    for (const required of ['cd-pulse', 'cd-ring', 'cd-spin', 'cd-fade', 'cd-dash', 'cd-breath', 'cd-field']) {
      expect(names).toContain(required);
    }
    // §L.1 records gnShimmer, gnRowNew and gnAmber as defined-but-unreferenced
    // with "no visual obligation". Pruned rather than added as dead config.
    expect(names).not.toContain('cd-shimmer');
    expect(names).not.toContain('cd-row-new');
    expect(names).not.toContain('cd-amber');
  });

  it('the released durations and easings are exact (§L.2)', () => {
    expect(theme.animation['cd-live-dot']).toBe('cd-pulse 1.8s infinite');
    expect(theme.animation['cd-engine-orbit']).toBe('cd-spin 90s linear infinite');
    expect(theme.animation['cd-engine-radar']).toBe('cd-spin 34s linear infinite');
    expect(theme.animation['cd-engine-breath']).toBe('cd-breath 7.5s ease-in-out infinite');
    expect(theme.animation['cd-engine-dashed']).toBe('cd-spin 44s linear infinite reverse');
    expect(theme.animation['cd-hud-sweep-engine']).toBe('cd-spin 120s linear infinite');
    expect(theme.animation['cd-caret']).toBe('cd-caret 1.25s steps(1, end) infinite');
  });

  /**
   * M66.2 — this contract was inverted, not deleted.
   *
   * M66.1 added the released emblem timings as tokens and DEFERRED wiring them,
   * because retiming a shared emblem would have changed six routes with no
   * released design. This assertion recorded that deferral and was written to
   * fail loudly if anyone consumed the tokens without authorization — which is
   * exactly what it did when M66.2 landed.
   *
   * GN-CD-020..027 released the emblem (GN-CD-022) and CTO decision D5
   * authorized the wiring, so the deferral is closed. The three token-value
   * assertions are M66.1 token protection and are untouched; only the two lines
   * that asserted the tokens were UNUSED now assert that they are used.
   */
  it('the released emblem timings are wired into Logo.tsx (M66.2 closed the M66.1 deferral)', () => {
    expect(theme.animation['cd-emb-ring']).toBe('cd-emb-ring 4.6s ease-out infinite');
    expect(theme.animation['cd-emb-core']).toBe('cd-emb-core 3.4s ease-in-out infinite');
    expect(theme.animation['cd-emb-scan']).toBe('cd-emb-scan 14s linear infinite');

    const logo = readFileSync(join(__dirname, '../ui/Logo.tsx'), 'utf-8');
    const logoCode = stripComments(logo);
    // The propagating ring and the core now carry the released GN-CD-304 §L.1
    // declarations. The scan spoke keeps `animate-emblem-scan`, which was
    // already exact at 14s linear and needed no correction.
    expect(logoCode).toMatch(/animate-cd-emb-ring/);
    expect(logoCode).toMatch(/animate-cd-emb-core/);
    expect(logoCode).toMatch(/animate-emblem-scan/);
    // The superseded approximations are gone from the emblem.
    expect(logoCode).not.toMatch(/animate-ring-pulse/);
    expect(logoCode).not.toMatch(/animate-pulse\b/);
    // ...but the legacy tokens themselves survive untouched: other components
    // still consume them, and the M66.1 rule is ADD, NEVER REDEFINE.
    expect(theme.animation['ring-pulse']).toBe('ring-pulse 3.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite');
  });

  it('GN-CD-304 §V: the generated stagger formulas are NOT tokenised as per-item constants', () => {
    // The feed-row, connector-pulse and map-ring staggers must be implemented
    // as formulas so the pattern survives list changes. A token per index would
    // freeze the list length.
    const names = Object.keys(theme.animation);
    expect(names.filter((key) => /-\d+$/.test(key) && key.startsWith('cd-'))).toEqual([]);
  });
});

describe('M66.1 — GN-CD-305 reduced-motion foundation', () => {
  it('the released rule is added, and the broader pre-existing rule is retained', () => {
    expect(globalsCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\[style\*='animation'\][\s\S]*?animation: none !important/);
    // Both survive: the universal selector catches Tailwind `animate-*`
    // utilities the design's attribute selector cannot see.
    expect((globalsCss.match(/@media \(prefers-reduced-motion: reduce\)/g) ?? []).length).toBe(2);
  });

  it('a decorative travelling pulse is REMOVED from the render tree, not merely slowed (§L.1)', () => {
    // A zero-duration animation parks the element at its start position.
    // GN-CD-305 §L.1 requires display:none.
    expect(globalsCss).toMatch(/\.cd-motion-pulse \{\s*display: none !important;/);
  });
});

describe('M66.1 — GN-CD-306 focus-visible foundation', () => {
  it('the released focus stroke applies to Claude Design surfaces', () => {
    expect(globalsCss).toMatch(/\.cd-canvas :focus-visible \{\s*outline: 2px solid var\(--cd-edge-focus\);\s*outline-offset: 2px;/);
    expect(globalsCss).toMatch(/--cd-edge-focus: rgba\(34, 211, 238, 0\.7\);/);
  });

  it('it is SCOPED, so the six undesigned routes keep their existing focus treatment', () => {
    // The Claude Design rule must never be written unscoped: /search, /map,
    // /history, /workspace, /privacy and /terms all rely on the global rule.
    const claudeDesignFocusRules = globalsCss.match(/^\s*[^@\s][^{]*:focus-visible[^{]*\{/gm) ?? [];
    for (const rule of claudeDesignFocusRules) {
      if (rule.includes('34, 211, 238') || rule.includes('cd-edge-focus') || rule.includes('cd-canvas')) {
        expect(rule).toContain('.cd-canvas');
      }
    }
  });

  it('GN-CD-306 §W: the header language control has an explicit replacement indicator', () => {
    // The original defect: `outline:none` with nothing put back — no visible
    // keyboard focus at all on the desktop language control.
    //
    // M66.11 — RE-AIMED, NOT REMOVED. The rule is a DESIGN-SYSTEM rule, not a
    // fact about a <select>: outline suppression is permitted only alongside an
    // explicit replacement indicator. M66.11 replaced the native control with a
    // <button role="combobox">, so the same rule is now asserted on the element
    // that actually carries it. The colour token and the 2px offset are
    // unchanged; the released outline WIDTH moved from M66.1's 2px to
    // GN-CD-M66.11 §9's 1px, which is a design-authorized value change and is
    // recorded in the M66.11 known limitations rather than silently absorbed.
    const trigger =
      /const triggerBase = isMobile[\s\S]*?';\r?\n/.exec(languageSelectorSource)?.[0] ?? '';
    expect(trigger).not.toBe('');
    expect(trigger).toContain('focus:outline-none');
    expect(trigger).toMatch(/focus-visible:outline(\s|-)/);
    expect(trigger).toContain('focus-visible:outline-cd-edge-focus');
    expect(trigger).toContain('focus-visible:outline-offset-2');
    // And NavBar no longer suppresses an outline anywhere without a replacement.
    expect(stripComments(navBarSource)).not.toMatch(/focus:outline-none/);
  });

  it('CONTRAST, computed: the released focus stroke clears WCAG 2.1 SC 1.4.11 (3:1) on the released surfaces', () => {
    const pageBase = hexToRgb(cdColor('void'));
    const darkestPanel = composite(hexToRgb('#040810'), 0.9, pageBase); // rgba(4,8,16,.9)
    const stroke = hexToRgb('#22d3ee');

    expect(contrastRatio(composite(stroke, 0.7, pageBase), pageBase)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(composite(stroke, 0.7, darkestPanel), darkestPanel)).toBeGreaterThanOrEqual(3);
    // Measured at 5.77:1 and 5.72:1. The floor is asserted, not the figure, so
    // the test survives a legitimate design change but fails a regression.
  });

  it('CONTRAST, computed: the smallest mono tier clears WCAG 2.1 SC 1.4.3 (4.5:1) — so it must NOT be lightened', () => {
    // GN-CD-300 §O left this unmeasured and warned against "fixing" it by
    // lightening the token, which would flatten the text hierarchy. Measured:
    // it already passes AA, so there is nothing to fix.
    const pageBase = hexToRgb(cdColor('void'));
    const card = composite(hexToRgb('#070d1a'), 0.85, pageBase); // rgba(7,13,26,.85)
    const ink = cdGroup('ink');

    expect(contrastRatio(hexToRgb(ink.meta), card)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hexToRgb(ink.meta), pageBase)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hexToRgb(ink.tertiary), pageBase)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hexToRgb(ink.secondary), pageBase)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hexToRgb(ink.primary), pageBase)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hexToRgb(ink['core-sub']), composite(hexToRgb('#0d2d56'), 0.98, pageBase))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('M66.1 — PageCanvas is presentation infrastructure, and nothing else', () => {
  it('it fetches nothing, holds no state, runs no timer, and knows nothing about routing or auth', () => {
    const code = stripComments(pageCanvasSource);
    expect(code).not.toMatch(/\bfetch\(/);
    expect(code).not.toMatch(/@\/lib\/api\//);
    expect(code).not.toMatch(/useState|useReducer|useEffect|useRef/);
    expect(code).not.toMatch(/setInterval|setTimeout|requestAnimationFrame/);
    expect(code).not.toMatch(/useRouter|usePathname|next\/navigation|next\/link/);
    expect(code).not.toMatch(/cookies\(|useAccount|auth/i);
    expect(code).not.toMatch(/process\.env/);
  });

  it('it is a Server Component — the foundation needs no client JavaScript', () => {
    expect(pageCanvasSource.trimStart().startsWith("'use client'")).toBe(false);
  });

  it('it accepts children and nothing else — no data prop can smuggle content in', () => {
    const code = stripComments(pageCanvasSource);
    const propsBlock = /interface PageCanvasProps \{([\s\S]*?)\}/.exec(code)?.[1] ?? '';
    expect(propsBlock).toMatch(/children/);
    expect(propsBlock.split(';').filter((line) => line.trim().length > 0)).toHaveLength(1);
  });

  it('every decorative layer is aria-hidden and non-focusable (GN-CD-306 §O)', () => {
    const decorativeLayers = pageCanvasSource.match(/<div aria-hidden="true"[^>]*>/g) ?? [];
    expect(decorativeLayers.length).toBeGreaterThanOrEqual(2);
    for (const layer of decorativeLayers) {
      expect(layer).toContain('pointer-events-none');
    }
    expect(stripComments(pageCanvasSource)).not.toMatch(/tabIndex/);
  });

  it('it renders the released canvas, background, grid and boundary through TOKENS, not literals', () => {
    const code = stripComments(pageCanvasSource);
    expect(code).toContain('bg-cd-void');
    expect(code).toContain('bg-cd-page');
    expect(code).toContain('bg-cd-grid-page');
    expect(code).toContain('bg-cd-grid-56');
    expect(code).toContain('max-w-cd-page');
    expect(code).toContain('cd-canvas');
    // No raw colour literal may leak into the component: the token set is the
    // single source of truth and GN-CD-300 §V requires exact values.
    expect(code).not.toMatch(/#[0-9a-fA-F]{6}/);
    expect(code).not.toMatch(/rgba\(/);
  });

  it('it applies the released page padding and the 18px desktop rhythm (GN-CD-302 §E.1)', () => {
    const code = stripComments(pageCanvasSource);
    // Mobile 12px 14px 22px.
    expect(code).toContain('px-cd-14');
    expect(code).toContain('pt-cd-12');
    expect(code).toContain('pb-cd-22');
    // Desktop 20px 26px 60px.
    expect(code).toContain('lg:px-cd-26');
    expect(code).toContain('lg:pt-cd-20');
    expect(code).toContain('lg:pb-cd-60');
    expect(code).toContain('lg:gap-cd-18');
  });

  it('it renders the Claude Design body face and text colour, scoped (GN-CD-301 §E)', () => {
    const code = stripComments(pageCanvasSource);
    expect(code).toContain('font-cd-body');
    expect(code).toContain('text-cd-ink-primary');
  });
});

describe('M66.1 — the authorized 1360px divergence, locked (CTO decision D4)', () => {
  it('the canvas is bounded by a MAXIMUM and constrained by no minimum', () => {
    const code = stripComments(pageCanvasSource);
    expect(code).toContain('max-w-cd-page');
    expect(code).not.toMatch(/min-w-/);
    expect(code).not.toMatch(/minWidth/);
  });

  it('1360px appears nowhere in the foundation — reproducing it would fail WCAG 2.1 SC 1.4.10 Reflow', () => {
    // GN-CD-302 §E.1 authors `min-width:1360px`; §M records that the prototype
    // scrolls horizontally below it and flags the behaviour [UNRESOLVED].
    // The production canvas reflows instead. This assertion exists so the
    // divergence cannot be silently "corrected" back into a defect.
    for (const source of [pageCanvasSource, tailwindConfigSource, globalsCss, pageSource]) {
      expect(stripComments(source)).not.toMatch(/1360/);
    }
  });

  it('the foundation itself can never introduce a horizontal scrollbar', () => {
    expect(stripComments(pageCanvasSource)).toContain('overflow-x-hidden');
  });
});

describe('M66.1 — the homepage receives the canvas without being reconstructed', () => {
  it('the homepage sections render inside PageCanvas', () => {
    // M66.8c — five sections, not six: HomepageSituationMap is retired from
    // this render path. Which sections the canvas PARENTS is this test's
    // subject; the canvas itself, its tokens and its geometry are untouched
    // by that milestone and every other assertion in this file is unchanged.
    const code = stripComments(pageSource);
    expect(code).toMatch(/<PageCanvas>/);
    expect(code).toMatch(/<\/PageCanvas>/);
    const canvasBlock = code.slice(code.indexOf('<PageCanvas>'), code.indexOf('</PageCanvas>'));
    for (const section of [
      '<Hero',
      '<GlobalDevelopments',
      '<IntelligenceEngineSection',
      '<HowItWorks',
      '<TrustSection',
    ]) {
      expect(canvasBlock).toContain(section);
    }
    expect(canvasBlock).not.toContain('<HomepageSituationMap');
    // Chrome stays outside the canvas: the header and footer have their own
    // GN-CD milestones and must not be re-bounded by this one.
    expect(canvasBlock).not.toContain('<NavBar');
    expect(canvasBlock).not.toContain('<Footer');
    expect(canvasBlock).not.toContain('<MobileBottomNav');
    expect(canvasBlock).not.toContain('<LiveStatusStrip');
  });

  it('<main> keeps its exact bottom spacing, so the fixed bottom nav still cannot cover content', () => {
    expect(pageSource).toMatch(/<main className="pb-16 lg:pb-0">/);
  });

  it('the section order is unchanged apart from the M66.8c retirement', () => {
    const order = [
      '<NavBar',
      '<LiveStatusStrip',
      '<Hero',
      '<GlobalDevelopments',
      // M66.8c — '<HomepageSituationMap' stood here. Removed, not reordered:
      // every remaining marker keeps its relative position.
      '<IntelligenceEngineSection',
      '<HowItWorks',
      '<TrustSection',
      '<Footer',
      '<MobileBottomNav',
    ];
    let lastIndex = -1;
    for (const marker of order) {
      const index = pageSource.indexOf(marker);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it('CTO decision D5: no section width was rewritten — the canvas is the OUTER boundary only', () => {
    const code = stripComments(pageSource);
    expect(code).not.toMatch(/max-w-/);
    // The single homepage request and its data paths are untouched.
    expect((code.match(/getHomeFeed\(/g) ?? []).length).toBe(1);
    expect(code).not.toMatch(/\bfetch\(/);
  });

  it('the functional donor logic page.tsx owns is unchanged', () => {
    expect(pageSource).toMatch(/LANGUAGE_COOKIE_NAME/);
    expect(pageSource).toMatch(/isActiveLanguageCode/);
    expect(pageSource).toMatch(/const updatedAt = new Date\(\)\.toISOString\(\);/);
    expect(pageSource).toMatch(/<Hero latestArticles=\{feed\.latestUpdates\}/);
    expect(pageSource).toMatch(/<IntelligenceEngineSection language=\{language\} \/>/);
  });
});

describe('M66.1 — the two token systems cannot drift apart', () => {
  it('every --cd-* custom property in globals.css equals its tailwind.config.ts counterpart', () => {
    const pairs: Array<[string, string]> = [
      ['--cd-void', 'void'],
      ['--cd-rule-page', 'rule-page'],
      ['--cd-rule-hero', 'rule-hero'],
      ['--cd-rule-engine', 'rule-engine'],
      ['--cd-rule-map', 'rule-map'],
      ['--cd-edge-structural', 'edge-structural'],
      ['--cd-edge-focus', 'edge-focus'],
    ];
    for (const [property, tokenKey] of pairs) {
      const declared = new RegExp(`${property}: ([^;]+);`).exec(globalsCss)?.[1] ?? '';
      expect(declared.length).toBeGreaterThan(0);
      expect(normalizeColor(declared)).toBe(normalizeColor(cdColor(tokenKey)));
    }
  });

  it('the Claude Design namespace is genuinely parallel — no cd-* token reuses a legacy value it was meant to replace', () => {
    expect(cdColor('void')).not.toBe(theme.colors.void);
    expect(cdGroup('ink').primary).not.toBe(theme.colors.ink.primary);
    expect(cdGroup('ink').secondary).not.toBe(theme.colors.ink.secondary);
    expect(cdGroup('ink').tertiary).not.toBe(theme.colors.ink.tertiary);
  });
});
