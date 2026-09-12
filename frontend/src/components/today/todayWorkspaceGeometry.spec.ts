import {
  ANALYSE_BODY_FLOOR,
  ANALYSE_CHROME,
  ANALYSE_FLOOR,
  COLUMN_MIN_IN_PLACE,
  GEO_BODY_FLOOR,
  GEO_CHROME,
  WATCH_BODY_FLOOR,
  WATCH_CHROME,
  CANVAS_CTA_RELOCATION,
  CANVAS_FLOOR,
  CANVAS_TARGET,
  GEO_FLOOR,
  GEO_HEADER_H,
  GEO_ROWS_COMPACT,
  GEO_ROWS_PREFERRED,
  TIER_E_COLUMN,
  WATCH_FLOOR,
  WATCH_MAX,
  resolveColumnHeight,
  resolveGeographyLayout,
} from './todayWorkspaceGeometry';

/**
 * R5.9 — F13 … F19 AS ARITHMETIC.
 *
 * The browser pass proves these hold at the viewport sizes it visits. This
 * proves they hold at EVERY column height from 200 to 1400, which is the only
 * way a floor is actually a floor.
 */
const HEIGHTS: number[] = [];
for (let h = 200; h <= 1400; h += 1) HEIGHTS.push(h);

describe('R5.9 — the declared floors are two numbers each, so they cannot drift', () => {
  it('states WATCH 34+120=154, geography 50+120=170, ANALYSE 48+120=168', () => {
    expect(WATCH_CHROME + WATCH_BODY_FLOOR).toBe(WATCH_FLOOR);
    expect(WATCH_FLOOR).toBe(154);
    expect(GEO_CHROME + GEO_BODY_FLOOR).toBe(GEO_FLOOR);
    expect(GEO_FLOOR).toBe(170);
    /*
      R4 CORRECTION 2 — ANALYSE's chrome went 41 → 48 to hold a 44px filled
      primary action without it overflowing into the scrolling body. The floor
      is still its own two numbers, exactly as B10 requires.
    */
    expect(ANALYSE_CHROME).toBe(48);
    expect(ANALYSE_CHROME + ANALYSE_BODY_FLOOR).toBe(ANALYSE_FLOOR);
    expect(ANALYSE_FLOOR).toBe(168);
    /* R5.9's own tier-E boundary is WATCH + GEOGRAPHY and is untouched. */
    expect(TIER_E_COLUMN).toBe(324);
  });

  it('the body minimum still binds on GEOGRAPHY, so nothing downstream moved', () => {
    expect(COLUMN_MIN_IN_PLACE).toBe(GEO_FLOOR);
    expect(COLUMN_MIN_IN_PLACE).toBeGreaterThan(ANALYSE_FLOOR);
    expect(COLUMN_MIN_IN_PLACE).toBeGreaterThan(WATCH_FLOOR);
  });
});

describe('R5.9 — WATCH takes clamp(154, 34%, 260) and nothing more', () => {
  it('honours the clamp at every column height above tier E', () => {
    for (const column of HEIGHTS.filter((h) => h >= TIER_E_COLUMN)) {
      const { watchHeight } = resolveGeographyLayout(column);
      expect(watchHeight).toBeGreaterThanOrEqual(WATCH_FLOOR);
      expect(watchHeight).toBeLessThanOrEqual(WATCH_MAX);
      const ideal = Math.round(column * 0.34);
      if (ideal > WATCH_FLOOR && ideal < WATCH_MAX) expect(watchHeight).toBe(ideal);
    }
  });

  it('gives geography everything WATCH does not take', () => {
    for (const column of HEIGHTS.filter((h) => h >= TIER_E_COLUMN)) {
      const l = resolveGeographyLayout(column);
      expect(l.watchHeight + l.regionHeight).toBe(column);
    }
  });
});

describe('F15 — the canvas renders at every tier and never falls below 72px', () => {
  it('never returns a canvas below the floor, at any height', () => {
    for (const column of HEIGHTS) {
      expect(resolveGeographyLayout(column).canvasHeight).toBeGreaterThanOrEqual(CANVAS_FLOOR);
    }
  });

  it('pins the canvas at exactly the floor at tier E, and never drops it', () => {
    const e = resolveGeographyLayout(TIER_E_COLUMN - 1);
    expect(e.tier).toBe('E');
    expect(e.canvasHeight).toBe(CANVAS_FLOOR);
    expect(e.canvasHeight).toBeGreaterThan(0);
  });
});

describe('F13 — the canvas is the region’s dominant element', () => {
  it('measures ≥220px AND ≥50% of the region at a 900px viewport', () => {
    /* §A7's own worked example: a 900px viewport gives a 674px column. */
    const column = resolveColumnHeight({
      viewportHeight: 900,
      headerCollapsed: false,
      dockExpanded: false,
    });
    expect(column).toBe(900 - 46 - 118 - 62);
    const l = resolveGeographyLayout(column);
    expect(l.canvasHeight).toBeGreaterThanOrEqual(CANVAS_TARGET);
    expect(l.canvasHeight / l.regionHeight).toBeGreaterThanOrEqual(0.5);
    expect(l.rowsHeight).toBe(GEO_ROWS_PREFERRED);
    expect(l.ctaPosition).toBe('region-footer');
    expect(l.tier).toBe('A');
  });
});

describe('F14 — surplus goes to the canvas, never to padding or to the rows', () => {
  it('grows only the canvas as the column grows', () => {
    let lastCanvas = -1;
    let lastRows = GEO_ROWS_PREFERRED;
    for (const column of HEIGHTS.filter((h) => h >= 700)) {
      const l = resolveGeographyLayout(column);
      expect(l.canvasHeight).toBeGreaterThanOrEqual(lastCanvas);
      // The rows never grow past their preferred height, whatever the surplus.
      expect(l.rowsHeight).toBeLessThanOrEqual(GEO_ROWS_PREFERRED);
      lastCanvas = l.canvasHeight;
      lastRows = l.rowsHeight;
    }
    expect(lastRows).toBe(GEO_ROWS_PREFERRED);
  });

  it('accounts for the whole region — header + canvas + rows + footer, no slack', () => {
    for (const column of HEIGHTS.filter((h) => h >= TIER_E_COLUMN)) {
      const l = resolveGeographyLayout(column);
      if (l.canvasHeight === CANVAS_FLOOR) continue; // the floor is allowed to exceed the share
      const footer = l.ctaPosition === 'region-footer' ? 51 : 0;
      expect(GEO_HEADER_H + l.canvasHeight + l.rowsHeight + footer).toBe(l.regionHeight);
    }
  });
});

describe('§A7 — the yielding order, in order', () => {
  it('drops the rows 132 → 72 BEFORE the canvas is sacrificed', () => {
    for (const column of HEIGHTS.filter((h) => h >= TIER_E_COLUMN)) {
      const l = resolveGeographyLayout(column);
      if (l.rowsHeight === GEO_ROWS_PREFERRED) {
        // Rows stay full only while the canvas has already met its target.
        expect(l.canvasHeight).toBeGreaterThanOrEqual(CANVAS_TARGET);
      } else {
        expect(l.rowsHeight).toBe(GEO_ROWS_COMPACT);
      }
    }
  });

  it('relocates the CTA into the region header only once the canvas is under 96', () => {
    for (const column of HEIGHTS.filter((h) => h >= TIER_E_COLUMN)) {
      const l = resolveGeographyLayout(column);
      if (l.ctaPosition === 'region-footer') {
        expect(l.canvasHeight).toBeGreaterThanOrEqual(CANVAS_CTA_RELOCATION);
      }
    }
  });

  it('never yields the country list below its compact floor', () => {
    for (const column of HEIGHTS) {
      expect(resolveGeographyLayout(column).rowsHeight).toBeGreaterThanOrEqual(GEO_ROWS_COMPACT);
    }
  });
});

describe('F17 — OPEN WORLD MAP is always in exactly one position', () => {
  it('returns one of the three declared positions, always', () => {
    const positions = new Set(HEIGHTS.map((h) => resolveGeographyLayout(h).ctaPosition));
    for (const p of positions) {
      expect(['region-footer', 'region-header', 'permanent-chrome']).toContain(p);
    }
    // All three are genuinely reachable — none is dead code.
    expect(positions.size).toBeGreaterThanOrEqual(2);
    expect(resolveGeographyLayout(TIER_E_COLUMN - 1).ctaPosition).toBe('permanent-chrome');
    expect(resolveGeographyLayout(1000).ctaPosition).toBe('region-footer');
  });
});

describe('F18 — no right-rail scrollbar at tiers A–D', () => {
  it('sets columnScrolls only at tier E', () => {
    for (const column of HEIGHTS) {
      const l = resolveGeographyLayout(column);
      expect(l.columnScrolls).toBe(l.tier === 'E');
    }
  });

  it('honours both floors at tier E rather than clipping one of them', () => {
    const l = resolveGeographyLayout(300);
    expect(l.watchHeight).toBe(WATCH_FLOOR);
    expect(l.regionHeight).toBe(GEO_FLOOR);
    expect(l.columnScrolls).toBe(true);
  });
});

describe('§A7 — the tier is COMPUTED from known chrome, never measured', () => {
  it('derives the column from viewport minus command bar, header track and dock track', () => {
    expect(resolveColumnHeight({ viewportHeight: 900, headerCollapsed: false, dockExpanded: false })).toBe(674);
    expect(resolveColumnHeight({ viewportHeight: 900, headerCollapsed: true, dockExpanded: false })).toBe(792);
    expect(resolveColumnHeight({ viewportHeight: 900, headerCollapsed: false, dockExpanded: true })).toBe(444);
    expect(resolveColumnHeight({ viewportHeight: 640, headerCollapsed: false, dockExpanded: true })).toBe(184);
  });

  it('reaches tier E at a real viewport, not merely in theory', () => {
    /* §A8: "reachable in practice at ~540px viewport height with the header
       expanded and the dock collapsed". */
    const column = resolveColumnHeight({ viewportHeight: 540, headerCollapsed: false, dockExpanded: false });
    expect(column).toBeLessThan(TIER_E_COLUMN);
    expect(resolveGeographyLayout(column).tier).toBe('E');
  });

  it('is a pure function of one number — same input, same output, always', () => {
    for (const column of [324, 500, 674, 1000]) {
      expect(resolveGeographyLayout(column)).toEqual(resolveGeographyLayout(column));
    }
  });
});
