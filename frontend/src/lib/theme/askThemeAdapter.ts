/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME R1 · DUAL THEME — THE EMBEDDED-ASK TOKEN ADAPTER (generator, pure)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Embedded Ask must show exactly the SAME Ask R2/V2 answer components as the Standalone
 * /ask (answer state, provenance, sources, deeper work) — and those components, which the
 * Standalone Ask owns and must not destabilise, are authored in the accepted DARK
 * intelligence palette. Editing them would touch the Standalone surface and its pinned class
 * strings. So the theme reaches them the other way round:
 *
 *   ONE token set (--gt-*), ONE component tree, and a GENERATED adapter that retargets the
 *   colour utilities those components already use onto the --gt-* tokens — ONLY inside an
 *   embedded-Ask theme scope (`[data-ask-transport="r2"][data-gna-theme]`) and ONLY when that
 *   scope resolves to LIGHT. Dark is the components' native palette. The Standalone /ask
 *   never sets data-gna-theme, so nothing there changes, byte or pixel.
 *
 * The adapter is generated from the components' own source (this module), written into
 * globals.css between markers, and a spec regenerates it to catch drift: a colour utility
 * added to the answer tree without an adapter rule fails the build of the test, not the
 * reader's eyes.
 */

export type ColourProp =
  | 'bg'
  | 'text'
  | 'border'
  | 'ring'
  | 'divide'
  | 'outline'
  | 'placeholder'
  | 'decoration'
  | 'fill'
  | 'stroke';

export interface ColourUtility {
  /** The full class as written, e.g. `hover:bg-[#07304f]`, `!text-white`, `bg-signal/15`. */
  readonly cls: string;
  readonly variants: readonly string[];
  readonly important: boolean;
  readonly prop: ColourProp;
  /** The colour value (hex / rgb / gradient) the class resolves to, or null if unknown. */
  readonly value: string | null;
  readonly alpha: number | null;
}

const PROPS: readonly ColourProp[] = [
  'bg',
  'text',
  'border',
  'ring',
  'divide',
  'outline',
  'placeholder',
  'decoration',
  'fill',
  'stroke',
];
const STATE_VARIANTS = new Set([
  'hover',
  'focus',
  'focus-visible',
  'focus-within',
  'active',
  'disabled',
  'group-hover',
  'placeholder',
]);
const BORDER_SIDES = /^border-(?:[xytrblse]|t|r|b|l)-/;

/** Flatten a resolved Tailwind colour tree to `{ 'ink-primary': '#…' }`. */
export function flattenColours(tree: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const name = key === 'DEFAULT' ? prefix.replace(/-$/, '') : `${prefix}${key}`;
    if (typeof value === 'string') out[name] = value;
    else if (value !== null && typeof value === 'object')
      Object.assign(out, flattenColours(value as Record<string, unknown>, `${name}-`));
  }
  return out;
}

/** Every colour utility written in `source` (class strings and template text alike). */
export function extractColourUtilities(
  source: string,
  colours: Readonly<Record<string, string>>,
): ColourUtility[] {
  const found = new Map<string, ColourUtility>();
  const token =
    /(?:^|[\s'"`{(])(!?(?:[a-z0-9-]+:)*!?(?:bg|text|border(?:-[xytrbl])?|ring|divide|outline|placeholder|decoration|fill|stroke)-(?:\[[^\]\s'"`]+\]|[a-z]+(?:-[a-z0-9]+)*)(?:\/\d{1,3})?)(?=$|[\s'"`})])/g;
  let m: RegExpExecArray | null;
  while ((m = token.exec(source)) !== null) {
    const cls = m[1];
    const parts = cls.split(':');
    let core = parts[parts.length - 1];
    const variants = parts.slice(0, -1).map((v) => v.replace(/^!/, ''));
    const important = cls.startsWith('!') || core.startsWith('!');
    core = core.replace(/^!/, '');
    let alpha: number | null = null;
    const slash = /\/(\d{1,3})$/.exec(core);
    if (slash && !core.endsWith(']')) {
      alpha = Number(slash[1]) / 100;
      core = core.slice(0, -slash[0].length);
    }
    const propMatch =
      /^(bg|text|border(?:-[xytrbl])?|ring|divide|outline|placeholder|decoration|fill|stroke)-(.+)$/.exec(
        core,
      );
    if (!propMatch) continue;
    const prop = (propMatch[1].startsWith('border') ? 'border' : propMatch[1]) as ColourProp;
    const arg = propMatch[2];
    let value: string | null = null;
    if (arg.startsWith('[')) {
      const inner = arg.slice(1, -1).replace(/_/g, ' ');
      if (
        /^#[0-9a-f]{3,8}$/i.test(inner) ||
        /^(rgba?|hsla?)\(/i.test(inner) ||
        /gradient\(/i.test(inner)
      )
        value = inner;
      else if (inner.startsWith('color:')) value = inner.slice(6);
      else continue;
    } else if (colours[arg] !== undefined) {
      /* TRUST R1 — transparent / currentColor / inherit are theme-neutral: no rule needed. */
      if (/^(?:transparent|currentcolor|inherit)$/i.test(colours[arg])) continue;
      value = colours[arg];
    } else {
      continue;
    }
    if (prop === 'text' && /^\d/.test(arg)) continue;
    if (!variants.every((v) => STATE_VARIANTS.has(v) || /^(sm|md|lg|xl|2xl)$/.test(v))) continue;
    if (BORDER_SIDES.test(core) && !/^border-[xytrbl]-/.test(core)) continue;
    found.set(cls, { cls, variants, important, prop, value, alpha });
  }
  return [...found.values()].sort((a, b) => a.cls.localeCompare(b.cls));
}

/* ── colour classification ─────────────────────────────────────────────── */

function parseColour(value: string): { r: number; g: number; b: number } | null {
  const hex = /#([0-9a-f]{3,8})/i.exec(value);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4)
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const rgb = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(value);
  return rgb ? { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) } : null;
}

function hsl(c: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const r = c.r / 255,
    g = c.g / 255,
    b = c.b / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) * 60
      : max === g
        ? ((b - r) / d + 2) * 60
        : ((r - g) / d + 4) * 60;
  return { h, s, l };
}

type Hue = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'violet';
function hueOf(h: { h: number; s: number; l: number }): Hue {
  if (h.s < 0.22) return 'neutral';
  if (h.h >= 75 && h.h < 175) return 'green';
  if (h.h >= 20 && h.h < 75) return 'amber';
  if (h.h >= 245 && h.h < 300) return 'violet';
  if (h.h >= 300 || h.h < 20) return 'red';
  return 'blue';
}

/** A text colour that reads as white on a fill (lightness above 0.9, any hue). */
function isNearWhite(value: string | null): boolean {
  const c = value === null ? null : parseColour(value);
  return c !== null && hsl(c).l > 0.9;
}

/** The LIGHT token a dark-palette colour utility takes. */
export function lightTokenFor(u: ColourUtility): string | null {
  if (u.value === null) return null;
  const c = parseColour(u.value);
  if (c === null) return null;
  const k = hsl(c);
  const hue = hueOf(k);
  switch (u.prop) {
    case 'bg': {
      if (k.l > 0.9) return 'var(--gt-card)';
      if (k.l >= 0.32 && (hue === 'blue' || hue === 'violet')) return 'var(--gt-act)';
      if (hue === 'green') return 'var(--gt-mintBg)';
      if (hue === 'amber') return 'var(--gt-sandBg)';
      if (hue === 'red') return 'color-mix(in srgb, var(--gt-danger) 9%, var(--gt-card))';
      if (hue === 'violet') return 'color-mix(in srgb, var(--gt-violet) 9%, var(--gt-card))';
      if (hue === 'blue' && k.l >= 0.1) return 'var(--gt-actSoft)';
      return k.l < 0.07 ? 'var(--gt-card)' : 'var(--gt-sunk)';
    }
    case 'text':
    case 'decoration':
    case 'fill':
    case 'stroke': {
      if (hue === 'green') return 'var(--gt-mintText)';
      if (hue === 'amber') return 'var(--gt-sandInk)';
      if (hue === 'red') return 'var(--gt-danger)';
      if (hue === 'violet') return 'var(--gt-violetInk)';
      if (hue === 'blue' && k.s > 0.45) return 'var(--gt-link)';
      if (k.l > 0.84) return 'var(--gt-ink)';
      if (k.l > 0.58) return 'var(--gt-ink2)';
      return 'var(--gt-ink3)';
    }
    case 'placeholder':
      return 'var(--gt-ink3)';
    case 'border':
    case 'divide':
    case 'outline':
    case 'ring': {
      if (hue === 'amber') return 'var(--gt-sandBd)';
      if (hue === 'green') return 'var(--gt-mint)';
      if (hue === 'red') return 'var(--gt-danger)';
      if (hue === 'violet') return 'var(--gt-violet)';
      if (hue === 'blue' && k.l >= 0.35) return 'var(--gt-act)';
      return k.l > 0.2 ? 'var(--gt-pgLine2)' : 'var(--gt-line)';
    }
    default:
      return null;
  }
}

/* ── CSS emission ───────────────────────────────────────────────────────── */

export function escapeClass(cls: string): string {
  return cls.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

const SCREENS: Readonly<Record<string, string>> = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};
const PSEUDO: Readonly<Record<string, string>> = {
  hover: ':hover',
  focus: ':focus',
  'focus-visible': ':focus-visible',
  'focus-within': ':focus-within',
  active: ':active',
  disabled: ':disabled',
};

function declaration(u: ColourUtility, token: string): string {
  const value =
    u.alpha === null || u.alpha >= 1
      ? token
      : `color-mix(in srgb, ${token} ${Math.round(u.alpha * 100)}%, transparent)`;
  const imp = u.important ? ' !important' : '';
  switch (u.prop) {
    case 'bg':
      return /gradient\(/i.test(u.value ?? '')
        ? `background-image: none${imp}; background-color: ${value}${imp};`
        : `background-color: ${value}${imp};`;
    case 'text':
      return `color: ${value}${imp};`;
    case 'placeholder':
      return `color: ${value}${imp};`;
    case 'border':
    case 'divide':
      return `border-color: ${value}${imp};`;
    case 'outline':
      return `outline-color: ${value}${imp};`;
    case 'ring':
      return `--tw-ring-color: ${value}${imp};`;
    case 'decoration':
      return `text-decoration-color: ${value}${imp};`;
    case 'fill':
      return `fill: ${value}${imp};`;
    case 'stroke':
      return `stroke: ${value}${imp};`;
    default:
      return '';
  }
}

/*
  TRUST & CONVERSATIONAL EXPERIENCE R1 — the adapter now also serves the STANDALONE Ask scope
  (`[data-ask-standalone]`, set by AskThemedPage) and the Scheduled preference (light half from the
  <html data-gna-schedule> attribute; with no attribute Scheduled follows System).
*/
const ASK_SCOPES = ["[data-ask-transport='r2']", '[data-ask-standalone]'] as const;
const SCOPES = {
  light: ASK_SCOPES.flatMap((a) => [
    `${a}[data-gna-theme='light']`,
    `html[data-gna-schedule='light'] ${a}[data-gna-theme='scheduled']`,
  ]),
  system: ASK_SCOPES.flatMap((a) => [
    `${a}[data-gna-theme='system']`,
    `html:not([data-gna-schedule]) ${a}[data-gna-theme='scheduled']`,
  ]),
};

function rule(
  u: ColourUtility,
  scopes: readonly string[],
  keepWhiteOn: readonly string[],
): string | null {
  const token = lightTokenFor(u);
  if (token === null) return null;
  let target = `.${escapeClass(u.cls)}`;
  for (const v of u.variants) if (PSEUDO[v] !== undefined) target += PSEUDO[v];
  if (u.variants.includes('group-hover')) target = `.group:hover ${target}`;
  if (u.prop === 'placeholder' || u.variants.includes('placeholder')) target += '::placeholder';
  if (u.prop === 'divide') target += ' > :not([hidden]) ~ :not([hidden])';
  /* White text on an action fill stays white: the fill becomes the light action colour.
     R4 closeout — that holds for EVERY near-white text, not only the ones that map to ink: a
     pale-blue near-white (#e6f5ff, the Ask button's label) maps to the accent, so on the
     enabled Ask button (bg-[#0a6bd6] → the accent fill) it was painted accent on accent and
     the label disappeared in Light. */
  if (u.prop === 'text' && (token === 'var(--gt-ink)' || isNearWhite(u.value)))
    target += keepWhiteOn.map((c) => `:not(.${escapeClass(c)})`).join('');
  /* TRUST R1 §16 — near-white text on an element that paints its OWN gradient fill (the
     NavBar Sign In button) keeps its colour: gradient stops are not remapped, so recolouring
     only the text would put blue on blue. */
  if (u.prop === 'text' && isNearWhite(u.value)) target += `:not([class*='bg-gradient-to-'])`;
  const selector = scopes.map((scope) => `${scope} ${target}, ${scope}${target}`).join(', ');
  let css = `${selector} { ${declaration(u, token)} }`;
  const screen = u.variants.find((v) => SCREENS[v] !== undefined);
  if (screen !== undefined) css = `@media (min-width: ${SCREENS[screen]}) { ${css} }`;
  return css;
}

export const ADAPTER_BEGIN =
  '/* @generated ask-theme-adapter:begin — do not edit; regenerate with UPDATE_ASK_THEME_ADAPTER=1 */';
export const ADAPTER_END = '/* @generated ask-theme-adapter:end */';

export function buildAskThemeAdapterCss(utilities: readonly ColourUtility[]): string {
  const keepWhiteOn = utilities
    .filter(
      (u) => u.prop === 'bg' && lightTokenFor(u) === 'var(--gt-act)' && u.variants.length === 0,
    )
    .map((u) => u.cls);
  const light = utilities
    .map((u) => rule(u, SCOPES.light, keepWhiteOn))
    .filter((r): r is string => r !== null);
  const system = utilities
    .map((u) => rule(u, SCOPES.system, keepWhiteOn))
    .filter((r): r is string => r !== null);
  return [
    ADAPTER_BEGIN,
    '/* Light resolution of the embedded-Ask theme scope. Dark = the components’ native palette. */',
    ...light,
    '@media (prefers-color-scheme: light) {',
    ...system.map((r) => `  ${r}`),
    '}',
    ADAPTER_END,
  ].join('\n');
}
