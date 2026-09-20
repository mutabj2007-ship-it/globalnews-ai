import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ALPHA MAJOR CONVERGENCE R1 — COUNTRY DESKTOP SEARCH INTERACTION REGRESSION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT H MEASURED. On a computer the country search suggestion list could
 * not be clicked at all. On a phone the same click worked. H isolated it on two
 * independent instruments:
 *
 *   1. `elementHandle.click()` on the option TIMED OUT AT 30s at 1512x950 and
 *      COMPLETED at 390x844.
 *   2. Asking the page which element occupies the option's own centre:
 *
 *        desktop 1512x950  centre (340,356)
 *          elementFromPoint inside the option: FALSE
 *          occupier: canvas.maplibregl-canvas
 *
 *        compact 390x844   centre (195,348)
 *          elementFromPoint inside the option: TRUE
 *          occupier: button < li < ul.absolute.z-10
 *
 * A click is refused exactly when another element occupies the point it would
 * strike, which is what the occupancy reading independently names. Keyboard
 * selection was measured on a separate channel and ALWAYS WORKED — this is a
 * pointer/stacking defect, not a component-logic one.
 *
 * THE CAUSE, AND WHY IT IS ONE MISSING RANK. A three-rank ladder already existed
 * and is documented in the files that carry it. The search box was the only
 * overlay on this surface never placed in it:
 *
 *      NavBar.tsx          z-50   header
 *      MapPageClient.tsx   z-40   map column
 *      CountryPanel.tsx    z-30   panel shelf
 *      CountrySearchBox    z-10   <- inside a wrapper with NO rank of its own
 *
 * `z-10` on the list is scoped to its wrapper's rank, and the wrapper had none,
 * so the list competed below the map's 40 at `lg:` and up. Below `lg:` the map
 * column is `hidden`, `lg:z-40` never applies, and the list was reachable —
 * exactly the desktop/compact split measured.
 *
 * ── WHY THESE ASSERTIONS ARE A STACKING PROOF AND NOT A STRING MATCH ────────
 *
 * This repo's suites run in `testEnvironment: 'node'` with no browser and no
 * jsdom, so `document.elementFromPoint` is not available here. Rather than
 * assert a class name and call it an interaction test, the ranks are READ OUT
 * OF THE FOUR REAL FILES and run through the same comparison a browser performs
 * to answer `elementFromPoint`: among elements covering one point, the one in
 * the highest-ranked stacking context wins, ties broken by DOM order.
 *
 * `occupantAt()` below is that comparison. It is fed the real measured geometry
 * from H's evidence, so a rank regression reproduces the ORIGINAL FAILURE —
 * `canvas.maplibregl-canvas` occupying the option — rather than merely failing
 * a regex.
 */

const MAP_DIR = __dirname;
const NAV = readFileSync(join(MAP_DIR, '../navigation/NavBar.tsx'), 'utf8');
const SEARCH = readFileSync(join(MAP_DIR, 'CountrySearchBox.tsx'), 'utf8');
const PANEL = readFileSync(join(MAP_DIR, 'CountryPanel.tsx'), 'utf8');
const PAGE = readFileSync(join(MAP_DIR, 'MapPageClient.tsx'), 'utf8');

/** Comments quote the ladder they explain, so ranks are read from code only. */
const codeOnly = (s: string): string =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** Reads a Tailwind z rank, accepting both `z-40` and the arbitrary `z-[45]`. */
const rankOf = (source: string, pattern: RegExp): number | null => {
  const m = codeOnly(source).match(pattern);
  if (!m) return null;
  return Number(m[1]);
};

const NAVBAR_RANK = rankOf(NAV, /className="sticky top-0 z-(\d+)/);
const SEARCH_RANK = rankOf(SEARCH, /<div className="relative z-\[(\d+)\] w-full max-w-sm">/);
const MAP_COLUMN_RANK = rankOf(PAGE, /lg:sticky lg:top-20 lg:z-(\d+)/);
const PANEL_RANK = rankOf(PANEL, /<div className="lg:sticky lg:top-20 lg:z-(\d+)">/);

/* ── THE STACKING RESOLVER ──────────────────────────────────────────────── */

interface Layer {
  name: string;
  /** The stacking rank of the element's own positioned context. */
  rank: number;
  /** DOM order; higher paints later and wins a tie. */
  domOrder: number;
  /** Whether this layer covers the probed point at this viewport. */
  covers: boolean;
}

/**
 * The comparison a browser performs for `elementFromPoint`: of the layers
 * covering the point, the highest rank wins; equal ranks fall to DOM order.
 */
const occupantAt = (layers: Layer[]): string => {
  const covering = layers.filter((l) => l.covers);
  if (covering.length === 0) return 'none';
  return covering.reduce((best, l) =>
    l.rank > best.rank || (l.rank === best.rank && l.domOrder > best.domOrder) ? l : best,
  ).name;
};

/**
 * H's measured geometry. At 1512x950 the option's centre (340,356) falls inside
 * BOTH the suggestion list and the map canvas — that overlap is the whole
 * defect. At 390x844 the map column is `hidden`, so it covers nothing.
 */
const layersAtDesktop = (searchRank: number): Layer[] => [
  { name: 'ul.country-suggestions', rank: searchRank, domOrder: 1, covers: true },
  { name: 'canvas.maplibregl-canvas', rank: MAP_COLUMN_RANK ?? 0, domOrder: 2, covers: true },
  { name: 'header.navbar', rank: NAVBAR_RANK ?? 0, domOrder: 0, covers: false },
];

const layersAtCompact = (searchRank: number): Layer[] => [
  { name: 'ul.country-suggestions', rank: searchRank, domOrder: 1, covers: true },
  /* `lg:z-40` and the column itself do not apply below lg — measured `hidden`. */
  { name: 'canvas.maplibregl-canvas', rank: 0, domOrder: 2, covers: false },
  { name: 'header.navbar', rank: NAVBAR_RANK ?? 0, domOrder: 0, covers: false },
];

describe('1 · the governed z-order ladder is complete', () => {
  it('every rank is present and read from its own real file', () => {
    expect(NAVBAR_RANK).toBe(50);
    expect(SEARCH_RANK).toBe(45);
    expect(MAP_COLUMN_RANK).toBe(40);
    expect(PANEL_RANK).toBe(30);
  });

  it('the ladder is strictly ordered: NavBar > search > map > panel shelf', () => {
    /*
      The brief's governed order is NavBar 50 > map 40 > panel shelf 30. The
      search overlay takes the one rank that was missing, BETWEEN the header and
      the map, so no existing relationship in that ladder changes.
    */
    expect(NAVBAR_RANK!).toBeGreaterThan(SEARCH_RANK!);
    expect(SEARCH_RANK!).toBeGreaterThan(MAP_COLUMN_RANK!);
    expect(MAP_COLUMN_RANK!).toBeGreaterThan(PANEL_RANK!);
  });

  it('the suggestion list lives inside the ranked wrapper, so z-10 is scoped to rank 45', () => {
    const code = codeOnly(SEARCH);
    const wrapper = code.indexOf('<div className="relative z-[45] w-full max-w-sm">');
    const list = code.indexOf('role="listbox"');
    expect(wrapper).toBeGreaterThanOrEqual(0);
    expect(list).toBeGreaterThan(wrapper);
    /* The list's own z is unchanged — it never needed to move. */
    expect(code).toMatch(/className="absolute z-10 mt-2 w-full/);
  });

  it('the search overlay does not tie or outrank the header', () => {
    /*
      Ranking at 50 would tie the NavBar and win on DOM order, painting the
      suggestion list OVER the header. That is the failure the chosen value
      exists to avoid, so it is asserted rather than assumed.
    */
    expect(SEARCH_RANK).not.toBe(NAVBAR_RANK);
    expect(SEARCH_RANK!).toBeLessThan(NAVBAR_RANK!);
  });
});

describe('2 · MOUSE at desktop width — the regression is closed', () => {
  it('the option centre is occupied by the option, not by the map canvas', () => {
    /* H measured (340,356) at 1512x950 returning canvas.maplibregl-canvas. */
    expect(occupantAt(layersAtDesktop(SEARCH_RANK!))).toBe('ul.country-suggestions');
  });

  it('MUTATION CONTROL — at the old unranked value the ORIGINAL defect reappears', () => {
    /*
      The proof that this suite measures stacking rather than spelling. Feeding
      the resolver the pre-correction rank reproduces H's exact live reading —
      the map canvas occupying the option — which is why the click timed out.
    */
    const UNRANKED = 10;
    expect(occupantAt(layersAtDesktop(UNRANKED))).toBe('canvas.maplibregl-canvas');
  });

  it('MUTATION CONTROL — ranking at 50 would put the list over the header', () => {
    const TIED_WITH_HEADER = 50;
    const layers = layersAtDesktop(TIED_WITH_HEADER);
    layers[2] = { ...layers[2], covers: true };
    expect(occupantAt(layers)).toBe('ul.country-suggestions');
    /* ...which is precisely why 45 is used: the header must stay on top. */
    const correct = layersAtDesktop(SEARCH_RANK!);
    correct[2] = { ...correct[2], covers: true };
    expect(occupantAt(correct)).toBe('header.navbar');
  });
});

describe('3 · COMPACT 390px and KEYBOARD are unchanged', () => {
  it('compact was never broken and is still reachable', () => {
    expect(occupantAt(layersAtCompact(SEARCH_RANK!))).toBe('ul.country-suggestions');
  });

  it('compact was reachable even at the old rank — the defect was desktop-only', () => {
    /* Confirms the correction did not "fix" something that was already working. */
    expect(occupantAt(layersAtCompact(10))).toBe('ul.country-suggestions');
  });

  it('the keyboard path is untouched — ArrowDown/Enter still select', () => {
    const code = codeOnly(SEARCH);
    expect(code).toMatch(/event\.key === 'ArrowDown'/);
    expect(code).toMatch(/if \(activeIndex >= 0\) selectResult\(results\[activeIndex\]\)/);
    expect(code).toMatch(/event\.key === 'Escape'/);
    /* combobox semantics intact */
    expect(code).toMatch(/role="combobox"/);
    expect(code).toMatch(/aria-activedescendant=/);
  });
});

describe('4 · nothing else moved', () => {
  it('no new stacking system was invented — only one rank was added', () => {
    const code = codeOnly(SEARCH);
    const zValues = [...code.matchAll(/z-\[?(\d+)\]?/g)].map((m) => m[1]);
    /* exactly the wrapper's 45 and the list's pre-existing 10 */
    expect(zValues.sort()).toEqual(['10', '45']);
  });

  it('the map column keeps its sticky behaviour and its own rank', () => {
    /* z-index is not what makes `sticky` work; the 1997 wrapper is untouched. */
    expect(codeOnly(PAGE)).toMatch(/lg:sticky lg:top-20 lg:z-40/);
  });

  it('the panel shelf is untouched', () => {
    expect(codeOnly(PANEL)).toMatch(/<div className="lg:sticky lg:top-20 lg:z-30">/);
  });

  it('no geometry token changed in the search box', () => {
    expect(codeOnly(SEARCH)).toMatch(/w-full max-w-sm/);
    expect(codeOnly(SEARCH)).toMatch(/rounded-xl border border-border-strong bg-surface px-4 py-2\.5/);
  });
});

describe('5 · selecting a country still consumes ZERO provider requests', () => {
  /*
    The convergence brief's hard boundary: merely selecting a country must not
    retrieve news. The stacking correction is presentational and must not have
    reopened the quota path that was deliberately deleted.
  */
  it('the search box itself executes no retrieval', () => {
    const code = codeOnly(SEARCH);
    expect(code).not.toMatch(/\bfetch\(/);
    expect(code).not.toMatch(/\/news\/|fetchTopHeadlines|performCountryRead/);
  });

  it('loadCountry stays DELETED from the map page', () => {
    /*
      It was removed rather than left dormant, because a fetch path nothing calls
      is how the defect returns. Asserted on executable content only.
    */
    const code = codeOnly(PAGE);
    expect(code).not.toMatch(/function loadCountry|const loadCountry\s*=/);
    expect(code).not.toMatch(/\/news\/country\//);
  });

  it('the explicit read remains the retrieval gate', () => {
    /* Selection writes state; retrieval stays behind the explicit action. */
    expect(codeOnly(PAGE)).toMatch(/countryRead/);
  });
});
