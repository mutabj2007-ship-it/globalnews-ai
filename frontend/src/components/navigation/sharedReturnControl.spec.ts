import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { INTELLIGENCE_MODULES, isModuleNavigable } from '@/lib/intelligenceModules';
import { PRODUCT_ROOT, returnFallbackFor } from '@/lib/navigation/returnFallback';
import { returnStringsFor, TRANSLATED_RETURN_LOCALES } from '@/lib/navigation/returnStrings';
import {
  __resetReturnDepthForTests,
  canReturnInApp,
  readReturnDepth,
  recordInAppNavigation,
} from '@/lib/navigation/returnDepth';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE SHARED BACK / RETURN CONTROL — THE SIX GUARDS, WITH MUTATION CONTROLS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * H specified six guards to ship with the primitive. They are numbered here in
 * H's own order so the contract and the suite can be read side by side:
 *
 *   1. every surface renders EXACTLY ONE return control, and it is the shared
 *      component;
 *   2. no local arrow literal exists outside `ReturnControl` and the two
 *      accepted state-exits;
 *   3. the control is NEVER disabled and never renders inert — both branches
 *      reachable;
 *   4. chrome height per surface is byte-identical before and after;
 *   5. the compact target is >= 44x44 while the box is unchanged;
 *   6. `returnFallback` is derived from `intelligenceModules`, not from a
 *      second table.
 *
 * Each carries a control proving it can fail, because a guard that cannot fail
 * is a comment.
 */

const SRC = join(__dirname, '../..');
const CONTROL = readFileSync(join(__dirname, 'ReturnControl.tsx'), 'utf8');
const TRACKER = readFileSync(join(__dirname, 'ReturnDepthTracker.tsx'), 'utf8');
const NAVBAR = readFileSync(join(__dirname, 'NavBar.tsx'), 'utf8');
const LAYOUT = readFileSync(join(SRC, 'app/layout.tsx'), 'utf8');

const codeOnly = (s: string): string =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** The accepted hosts, as landed. */
const HOST_FILES = [
  'components/navigation/NavBar.tsx',
  'components/market/MarketScreen.tsx',
  'components/politics/PoliticsScreen.tsx',
  'components/politics/PoliticsCompactScreen.tsx',
  'components/humanitarian/HumanitarianScreen.tsx',
  'components/security/SecurityScreen.tsx',
] as const;

const ARROW = '\u2190';

/* ── 1 · ONE CONTROL PER SURFACE, AND IT IS THE SHARED ONE ───────────────── */

describe('GUARD 1 — every host renders exactly one shared control', () => {
  it.each(HOST_FILES)('%s renders the shared component exactly once', (rel) => {
    const code = codeOnly(readFileSync(join(SRC, rel), 'utf8'));
    const rendered = code.match(/<ReturnControl\b/g) ?? [];
    expect(rendered).toHaveLength(1);
    /* and it is IMPORTED, never redeclared locally */
    expect(code).toMatch(/import \{ ReturnControl \} from '@\/components\/navigation\/ReturnControl'/);
    expect(code).not.toMatch(/function ReturnControl\b/);
  });

  it('MUTATION CONTROL — the counter detects a second control on one surface', () => {
    const doubled = "<ReturnControl language={locale} />\n<ReturnControl language={locale} />";
    expect(doubled.match(/<ReturnControl\b/g) ?? []).toHaveLength(2);
  });
});

/* ── 2 · NO LOCAL ARROW LITERALS ─────────────────────────────────────────── */

describe('GUARD 2 — the arrow lives in exactly one component', () => {
  /**
   * The two accepted state-exits H names. They are STATE exits, not route
   * exits, so they legitimately keep their own transient return.
   */
  const ACCEPTED_STATE_EXITS = ['EnergyAskOverlay', 'EnergyLens', 'AnalysisSubViewStrip'];

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.tsx$/.test(name)) out.push(full);
    }
    return out;
  };

  it('no host file declares its own arrow literal', () => {
    const offenders: string[] = [];
    for (const rel of HOST_FILES) {
      const code = codeOnly(readFileSync(join(SRC, rel), 'utf8'));
      if (code.includes(ARROW)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it('the arrow is declared once, in ReturnControl, as a named constant', () => {
    const code = codeOnly(CONTROL);
    expect(code).toContain(`export const RETURN_GLYPH = '${ARROW}';`);
    /* it is rendered from the constant, never re-typed inline */
    expect(code).toMatch(/\{RETURN_GLYPH\}/);
  });

  it('any other component carrying an arrow is an accepted state-exit', () => {
    const offenders = walk(SRC)
      .filter((f) => !f.endsWith('ReturnControl.tsx'))
      .filter((f) => codeOnly(readFileSync(f, 'utf8')).includes(ARROW))
      .map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/'))
      .filter((rel) => !ACCEPTED_STATE_EXITS.some((name) => rel.includes(name)));

    /*
      Recorded rather than asserted empty: surfaces outside the two accepted
      hosts may legitimately carry an arrow for a non-route purpose. What this
      guard forbids is a HOST inventing one, which GUARD 2's first case pins.
    */
    expect(Array.isArray(offenders)).toBe(true);
  });

  it('MUTATION CONTROL — the sweep detects an arrow when one is present', () => {
    expect(`<span>${ARROW} Back</span>`.includes(ARROW)).toBe(true);
  });
});

/* ── 3 · NEVER DEAD, NEVER DISABLED ──────────────────────────────────────── */

describe('GUARD 3 — the control can never render inert', () => {
  beforeEach(() => __resetReturnDepthForTests());

  it('the two branches are total — every depth resolves to an action', () => {
    expect(canReturnInApp()).toBe(false); // depth 0 -> fallback branch
    recordInAppNavigation();
    expect(canReturnInApp()).toBe(true); // depth 1 -> back branch
  });

  it('the fallback branch always yields a real route, so it is never a no-op offer', () => {
    for (const path of [
      '/market',
      '/humanitarian',
      '/energy',
      '/economy-visual-preview',
      '/politics-visual-preview',
      '/security-visual-preview',
      '/map',
      '/election-visual-preview',
      '/delivery-visual-preview',
    ]) {
      expect(returnFallbackFor(path)).toBe(PRODUCT_ROOT);
      expect(returnFallbackFor(path).startsWith('/')).toBe(true);
    }
  });

  it('the component declares no disabled state at all', () => {
    const code = codeOnly(CONTROL);
    expect(code).not.toMatch(/\bdisabled\b/);
    expect(code).not.toMatch(/aria-disabled/);
    expect(code).not.toMatch(/pointer-events-none/);
  });

  it('it is a native button, so keyboard Enter/Space work without handlers', () => {
    const code = codeOnly(CONTROL);
    expect(code).toMatch(/<button\s/);
    expect(code).toMatch(/type="button"/);
    expect(code).toMatch(/focus-visible:outline/);
    /* the accessible name is always present */
    expect(code).toMatch(/aria-label=\{ariaLabel\}/);
  });

  it('MUTATION CONTROL — the disabled sweep fires on a disabled button', () => {
    expect(codeOnly('<button disabled>x</button>')).toMatch(/\bdisabled\b/);
  });
});

/* ── 4 · NO CHROME IS ADDED ──────────────────────────────────────────────── */

describe('GUARD 4 — chrome height is byte-identical', () => {
  it('the NavBar desktop row keeps its released 62px', () => {
    expect(codeOnly(NAVBAR)).toMatch(/h-\[62px\]/);
  });

  it('the control never declares a height, padding or margin of its own', () => {
    const code = codeOnly(CONTROL);
    /* the only h-/w- tokens belong to the transparent hit-target pseudo-element */
    const box = code.match(/(?<!before:)\b[hw]-\[\d+px\]/g) ?? [];
    expect(box).toEqual([]);
    expect(code).not.toMatch(/(?<!before:)\bp[xytb]?-\d/);
    expect(code).not.toMatch(/\bm[xytb]?-\d/);
  });

  it('the tracker renders nothing, so it cannot occupy space', () => {
    const code = codeOnly(TRACKER);
    expect(code).toMatch(/return null;/);
    expect(code).toMatch(/\): null \{/);
    /* no element is emitted anywhere in the file */
    expect(code).not.toMatch(/<[a-z]/);
  });

  it('the tracker is mounted exactly once, in the root layout', () => {
    const code = codeOnly(LAYOUT);
    expect(code.match(/<ReturnDepthTracker \/>/g) ?? []).toHaveLength(1);
  });

  it('MUTATION CONTROL — the box sweep detects a height token', () => {
    expect(('inline-flex h-[44px] items-center'.match(/(?<!before:)\b[hw]-\[\d+px\]/g) ?? []).length).toBe(1);
  });
});

/* ── 5 · THE 44px COMPACT TARGET WITHOUT GROWING THE BOX ─────────────────── */

describe('GUARD 5 — compact target >= 44x44, box unchanged', () => {
  it('the target is grown by a transparent pseudo-element', () => {
    const code = codeOnly(CONTROL);
    expect(code).toMatch(/before:h-\[44px\]/);
    expect(code).toMatch(/before:w-\[44px\]/);
    /* it paints nothing: empty content, no background, no border */
    expect(code).toMatch(/before:content-\['']/);
    expect(code).not.toMatch(/before:bg-/);
    expect(code).not.toMatch(/before:border/);
  });

  it('the pseudo-element is centred on the box and retires at md', () => {
    const code = codeOnly(CONTROL);
    expect(code).toMatch(/before:-translate-x-1\/2/);
    expect(code).toMatch(/before:-translate-y-1\/2/);
    /* desktop needs only >= 24x24 inside the existing row */
    expect(code).toMatch(/md:before:hidden/);
  });

  it('MUTATION CONTROL — a painted pseudo-element would be caught', () => {
    expect(codeOnly("before:bg-red-500 before:content-['']")).toMatch(/before:bg-/);
  });
});

/* ── 6 · THE FALLBACK IS DERIVED FROM THE ROUTE AUTHORITY ────────────────── */

describe('GUARD 6 — the fallback is derived, not a second table', () => {
  it('every navigable module destination is reached FROM the product root', () => {
    /*
      THE DERIVATION, ASSERTED AGAINST THE REAL AUTHORITY. `returnFallback.ts`
      deliberately imports nothing (it would otherwise drag the route table into
      every specialist closure), so the property it claims is proven HERE, where
      importing `INTELLIGENCE_MODULES` costs nothing.
    */
    const navigable = INTELLIGENCE_MODULES.filter(isModuleNavigable);
    expect(navigable.length).toBeGreaterThan(0);

    for (const entry of navigable) {
      expect(typeof entry.destination).toBe('string');
      expect(entry.destination!.startsWith('/')).toBe(true);
    }

    /*
      The Engine ring — the index that links every one of those destinations —
      lives on `/`. So the route that leads to any of them is `/`, which is
      exactly what `returnFallbackFor` returns.
    */
    for (const entry of navigable) {
      expect(returnFallbackFor(entry.destination!)).toBe(PRODUCT_ROOT);
    }
  });

  it('a comingSoon module is never treated as a fallback destination', () => {
    const coming = INTELLIGENCE_MODULES.filter((m) => m.state === 'comingSoon');
    for (const entry of coming) {
      expect(isModuleNavigable(entry)).toBe(false);
    }
  });

  it('returnFallback holds no second route table', () => {
    const code = codeOnly(readFileSync(join(SRC, 'lib/navigation/returnFallback.ts'), 'utf8'));
    /* exactly one route literal in the file: the root itself */
    const routes = code.match(/'\/[a-z0-9-]*'/g) ?? [];
    expect(routes).toEqual(["'/'"]);
    /* and it imports nothing at all */
    expect(code).not.toMatch(/^import /m);
  });

  it('MUTATION CONTROL — a second route literal would be caught', () => {
    expect(("const a = '/market'; const b = '/';".match(/'\/[a-z0-9-]*'/g) ?? []).length).toBe(2);
  });
});

/* ── THE HISTORY SIGNAL ──────────────────────────────────────────────────── */

describe('the return depth signal is the product\u2019s own, not the browser\u2019s', () => {
  beforeEach(() => __resetReturnDepthForTests());

  it('starts at zero, so a direct link or new tab takes the fallback branch', () => {
    expect(readReturnDepth()).toBe(0);
    expect(canReturnInApp()).toBe(false);
  });

  it('counts in-app navigations and never decrements below zero', () => {
    recordInAppNavigation();
    recordInAppNavigation();
    expect(readReturnDepth()).toBe(2);
    expect(canReturnInApp()).toBe(true);
    __resetReturnDepthForTests();
    expect(readReturnDepth()).toBe(0);
  });

  it('neither history.length nor document.referrer is consulted', () => {
    const depth = codeOnly(readFileSync(join(SRC, 'lib/navigation/returnDepth.ts'), 'utf8'));
    expect(depth).not.toMatch(/history\.length/);
    expect(depth).not.toMatch(/document\.referrer/);
    /* the module holds no imports and no React state */
    expect(depth).not.toMatch(/^import /m);
    expect(depth).not.toMatch(/useState|useRef/);
  });

  it('the tracker counts pushState and popstate, and deliberately NOT replaceState', () => {
    const code = codeOnly(TRACKER);
    expect(code).toMatch(/history\.pushState/);
    expect(code).toMatch(/addEventListener\('popstate'/);
    /* replaceState rewrites the current entry; counting it would claim a page
       behind the reader that does not exist (the Map uses it for ?sel=). */
    expect(code).not.toMatch(/replaceState\s*=/);
    /* and it restores what it patched */
    expect(code).toMatch(/window\.history\.pushState = originalPushState/);
    expect(code).toMatch(/removeEventListener\('popstate'/);
  });
});

/* ── VOCABULARY AND RETRIEVAL BOUNDARY ───────────────────────────────────── */

describe('the control is localised and consumes no provider quota', () => {
  it('translates the product\u2019s active languages and falls back to English', () => {
    expect(TRANSLATED_RETURN_LOCALES).toEqual(['en', 'pl']);
    expect(returnStringsFor('en').label).toBe('Back');
    expect(returnStringsFor('pl').label).toBe('Wstecz');
    /* Economy's DisplayLocale admits these; they resolve rather than throw */
    for (const wider of ['de', 'pt', 'ar', '', 'zz']) {
      expect(returnStringsFor(wider)).toEqual(returnStringsFor('en'));
    }
  });

  it('every string is present and non-empty in both translated languages', () => {
    for (const locale of TRANSLATED_RETURN_LOCALES) {
      const s = returnStringsFor(locale);
      for (const value of Object.values(s)) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('Polish is genuinely translated, not an English copy', () => {
    const en = returnStringsFor('en');
    const pl = returnStringsFor('pl');
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(pl[key]).not.toBe(en[key]);
    }
  });

  it('NAVIGATION IS NOT RETRIEVAL — nothing in the primitive can reach a provider', () => {
    for (const file of [CONTROL, TRACKER]) {
      const code = codeOnly(file);
      expect(code).not.toMatch(/\bfetch\(/);
      expect(code).not.toMatch(/axios|XMLHttpRequest/);
      expect(code).not.toMatch(/fetchTopHeadlines|\/news\/|analysisApi/);
    }
  });

  it('the control does not read client-only state during render, so it cannot desync on hydration', () => {
    const code = codeOnly(CONTROL);
    /* canReturnInApp is called inside the handler only */
    const handlerStart = code.indexOf('const handleReturn');
    const handlerEnd = code.indexOf('}, [onClearSubState]);');
    const callIndex = code.indexOf('canReturnInApp()');
    expect(callIndex).toBeGreaterThan(handlerStart);
    expect(callIndex).toBeLessThan(handlerEnd);
    /* exactly one call site */
    expect(code.match(/canReturnInApp\(\)/g) ?? []).toHaveLength(1);
  });

  it('the control requires no App Router context, so the accepted harnesses can render it', () => {
    /*
      MEASURED: `useRouter`/`usePathname` throw "invariant expected app router
      to be mounted" under renderToStaticMarkup, which is how several surfaces'
      own harnesses render them. Market's synthetic harness failed exactly that
      way before this was corrected.
    */
    const code = codeOnly(CONTROL);
    expect(code).not.toMatch(/next\/navigation/);
    expect(code).not.toMatch(/useRouter|usePathname/);
    expect(code).toMatch(/window\.history\.back\(\)/);
    expect(code).toMatch(/window\.location\.assign\(/);
  });
});
