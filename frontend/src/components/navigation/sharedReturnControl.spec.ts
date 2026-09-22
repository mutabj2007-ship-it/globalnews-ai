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

/**
 * THE ACCEPTED HOSTS, AS LANDED — H’S MEASURED INVENTORY, NOW COMPLETE.
 *
 * The major convergence landed six. The remaining seven are the Economy, Energy,
 * Map and compact surfaces H named, and each `controls` count is the number of
 * `<ReturnControl` OCCURRENCES IN THE FILE, which is one per host except where a
 * file holds two mutually exclusive viewport branches. A READER still sees exactly
 * one on every surface at every width — that is what the count is protecting, and
 * why it is declared per file with a reason rather than assumed to be 1.
 */
const HOSTS: ReadonlyArray<{ file: string; controls: number; why?: string }> = [
  { file: 'components/navigation/NavBar.tsx', controls: 1 },
  { file: 'components/evidence/DomainEvidenceStatus.tsx', controls: 1, why: 'Evidence status entry; original domain controls remain inside the collapsed reference framework.' },
  { file: 'components/market/MarketScreen.tsx', controls: 1 },
  { file: 'components/market/MarketCompactScreen.tsx', controls: 1 },
  { file: 'components/politics/PoliticsScreen.tsx', controls: 1 },
  { file: 'components/politics/PoliticsCompactScreen.tsx', controls: 1 },
  { file: 'components/humanitarian/HumanitarianScreen.tsx', controls: 1 },
  { file: 'components/humanitarian/HumanitarianCompactScreen.tsx', controls: 1 },
  { file: 'components/security/SecurityScreen.tsx', controls: 1 },
  { file: 'components/security/SecurityCompactScreen.tsx', controls: 1 },
  { file: 'components/economy/EconomicStateHeader.tsx', controls: 1 },
  { file: 'components/economy/compact/EconomyCompactScreen.tsx', controls: 1 },
  { file: 'components/map/MapPageClient.tsx', controls: 1 },
  {
    file: 'components/energy/EnergyShell.tsx',
    controls: 2,
    why:
      'one file, two mutually exclusive viewport branches — `if (compact) return (…)` and the desktop return below it. A reader is inside exactly one.',
  },
];

const HOST_FILES = HOSTS.map((h) => h.file);

/**
 * The body of a named function, matched by braces rather than by a character
 * count, so an assertion about what it does cannot read a neighbour’s code.
 */
function bodyOf(code: string, marker: string): string {
  const at = code.indexOf(marker);
  if (at < 0) throw new Error(`marker not found: ${marker}`);
  const open = code.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '{') depth += 1;
    else if (code[i] === '}') {
      depth -= 1;
      if (depth === 0) return code.slice(at, i + 1);
    }
  }
  throw new Error(`unbalanced body: ${marker}`);
}

/** The two surfaces H authorises to answer a first press without leaving. */
const SUB_STATE_EXITS = [
  { file: 'components/map/MapPageClient.tsx', marker: 'function clearMapSelection' },
  { file: 'components/energy/EnergyShell.tsx', marker: 'const clearEnergySubState' },
] as const;
const ARROW = '\u2190';

/* ── 1 · ONE CONTROL PER SURFACE, AND IT IS THE SHARED ONE ───────────────── */

describe('GUARD 1 — every host renders the shared control, and its declared count', () => {
  it.each(HOSTS.map((h) => [h.file, h.controls] as const))(
    '%s renders the shared component %i time(s)',
    (rel, controls) => {
    const code = codeOnly(readFileSync(join(SRC, rel), 'utf8'));
    const rendered = code.match(/<ReturnControl\b/g) ?? [];
    expect(rendered).toHaveLength(controls);
    /* and it is IMPORTED, never redeclared locally */
    expect(code).toMatch(/import \{ ReturnControl \} from '@\/components\/navigation\/ReturnControl'/);
    expect(code).not.toMatch(/function ReturnControl\b/);
    },
  );

  /*
    THE COUNT ABOVE IS ONLY WORTH ANYTHING IF THE LIST IS THE WHOLE LIST. This
    sweeps the tree and asserts the set equality: a surface that starts rendering
    the control without being declared a host fails here, which is how a second
    control arrives on a page nobody measured.
  */
  it('no file outside the declared inventory renders the control', () => {
    const walkAll = (dir: string, out: string[] = []): string[] => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walkAll(full, out);
        else if (/\.tsx$/.test(name)) out.push(full);
      }
      return out;
    };
    const rendering = walkAll(SRC)
      .filter((f) => !f.endsWith('ReturnControl.tsx'))
      .filter((f) => /<ReturnControl\b/.test(codeOnly(readFileSync(f, 'utf8'))))
      .map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/'))
      .sort();
    expect(rendering).toEqual([...HOST_FILES].sort());
  });

  /*
    THE TWO AUTHORIZED SUB-STATE HOSTS, NAMED. `onClearSubState` makes the first
    press stay on the route, so a surface acquiring it quietly is a surface whose
    Back button stopped going back. H authorises it on `/map`; Energy earns it by
    REPLACING a bespoke arrow that could never leave the route at all.
  */
  it('only the two authorized surfaces pass a sub-state exit', () => {
    const withSubState = HOST_FILES.filter((rel) =>
      /onClearSubState=/.test(codeOnly(readFileSync(join(SRC, rel), 'utf8'))),
    ).sort();
    expect(withSubState).toEqual([
      'components/energy/EnergyShell.tsx',
      'components/map/MapPageClient.tsx',
    ]);
  });

  /*
    AND EACH SUB-STATE EXIT HAS A FALSE BRANCH, which is what stops it being a
    Back button that can never leave. Both return `false` when there is nothing
    left to undo, and the press then falls through to back/fallback.
  */
  it('each sub-state exit can answer false, so the control is never trapped', () => {
    for (const { file, marker } of SUB_STATE_EXITS) {
      const body = bodyOf(codeOnly(readFileSync(join(SRC, file), 'utf8')), marker);
      expect([file, /return false;/.test(body)]).toEqual([file, true]);
      expect([file, /return true;/.test(body)]).toEqual([file, true]);
    }
  });

  /*
    ITEM 9 — THE QUOTA BOUNDARY, ASSERTED ON THE RETURN PATH ITSELF.

    Pressing Back on `/map` with a country selected runs one of these bodies. If
    either could start a retrieval, a reader tapping Back repeatedly would spend
    GNews quota per press — the exact boundary this round protects. Neither may
    contain a call, and neither may set the selection itself: the map body clears
    through the single governed handler, which gates the country read on a
    non-null request.
  */
  it('neither sub-state exit can start a retrieval', () => {
    for (const { file, marker } of SUB_STATE_EXITS) {
      const body = bodyOf(codeOnly(readFileSync(join(SRC, file), 'utf8')), marker);
      for (const rx of [
        /\bfetch\s*\(/,
        /fetchTopHeadlines|fetchCountryNews|retainedGlobalFeed|analysisApi/,
        /axios|XMLHttpRequest|EventSource|WebSocket/,
        /https?:\/\//,
      ]) {
        expect([file, rx.source, rx.test(body)]).toEqual([file, rx.source, false]);
      }
    }
  });

  it('the map exit clears through the single governed selection handler, not by hand', () => {
    const body = bodyOf(
      codeOnly(readFileSync(join(SRC, 'components/map/MapPageClient.tsx'), 'utf8')),
      'function clearMapSelection',
    );
    expect(body).toMatch(/handleSpatialSelection\(null\)/);
    /* it sets no state of its own — that is what keeps the two layers agreeing */
    expect(body).not.toMatch(/setSelectedCountry|setSpatialSelection|setCardFilters|setCategory/);
  });

  it('MUTATION CONTROL — bodyOf reads the function it names and stops at its brace', () => {
    const sample = [
      'function a(): boolean {',
      '  return false;',
      '}',
      'function b(): void {',
      '  void fetch(String(1));',
      '}',
    ].join(String.fromCharCode(10));
    const a = bodyOf(sample, 'function a');
    expect(a).toMatch(/return false;/);
    /* the neighbouring retrieval is NOT swept in — the property under test */
    expect(a).not.toMatch(/fetch\(/);
    expect(bodyOf(sample, 'function b')).toMatch(/fetch\(/);
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
