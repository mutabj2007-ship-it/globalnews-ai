/**
 * GATE O — THE MAPLIBRE 5 STYLE ERROR MEASURED ON LIVE ALPHA.
 *
 *     layers.gn-evidence-halo.paint.circle-radius: "zoom" expression may only
 *     be used as input to a top-level "step" or "interpolate" expression.
 *
 * MapLibre 4 accepted `['zoom']` nested inside arithmetic; 5.24 enforces the
 * documented rule. The dependency bump was accepted deliberately, so the style
 * has to meet the newer contract — this suite is what keeps it met.
 *
 * TWO THINGS ARE ASSERTED, AND THE SECOND IS THE POINT:
 *
 *   1. STRUCTURE — `['zoom']` appears only as the direct input of a top-level
 *      `interpolate` / `step`, anywhere in the map style sources. A fix to one
 *      layer that leaves a sibling nested would fail the same gate next build.
 *
 *   2. EQUIVALENCE — the corrected expression computes the SAME radius as the
 *      original formula at every reachable zoom and a spread of latitudes. The
 *      halo is a truth claim about precision ("260 km for a country ceiling"),
 *      so a fix that quietly changed the radius would be worse than the error
 *      it replaced.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_ZOOM, MIN_ZOOM } from '@/lib/map/camera/cameraState';
import { haloRadiusExpression } from '@/lib/map/spatial/evidenceHaloRadius';

const FRONTEND_SRC = join(__dirname, '..', '..', '..');
const EARTH_CIRCUMFERENCE_OVER_TILE = 156543.03392;

/** The original, pre-correction formula. The thing equivalence is measured against. */
function referenceRadius(haloMetres: number, lat: number, zoom: number): number {
  return (haloMetres * 2 ** zoom) / (EARTH_CIRCUMFERENCE_OVER_TILE * Math.cos((lat * Math.PI) / 180));
}

/**
 * A minimal evaluator for exactly the expression shape this file produces:
 * `interpolate` with `['exponential', base]` over `['zoom']`, whose outputs are
 * the arithmetic sub-expressions. Deliberately narrow — it is not a MapLibre
 * implementation, it is a reading of the spec's own interpolation rule.
 */
function evaluate(expr: unknown, ctx: { zoom: number; props: Record<string, number> }): number {
  if (typeof expr === 'number') return expr;
  if (!Array.isArray(expr)) throw new Error(`unsupported literal: ${String(expr)}`);

  const [op, ...rest] = expr as [string, ...unknown[]];

  switch (op) {
    case 'get':
      return ctx.props[rest[0] as string];
    case 'zoom':
      return ctx.zoom;
    case '*':
      return rest.reduce<number>((total, term) => total * evaluate(term, ctx), 1);
    case '/':
      return evaluate(rest[0], ctx) / evaluate(rest[1], ctx);
    case 'cos':
      return Math.cos(evaluate(rest[0], ctx));
    case 'interpolate': {
      const [interpolation, input, ...stops] = rest;
      const base = (interpolation as [string, number])[1];
      const at = evaluate(input, ctx);
      const zs: number[] = [];
      const outs: unknown[] = [];
      for (let i = 0; i < stops.length; i += 2) {
        zs.push(stops[i] as number);
        outs.push(stops[i + 1]);
      }
      if (at <= zs[0]) return evaluate(outs[0], ctx);
      if (at >= zs[zs.length - 1]) return evaluate(outs[outs.length - 1], ctx);
      let i = 0;
      while (i < zs.length - 2 && at > zs[i + 1]) i += 1;
      const [z0, z1] = [zs[i], zs[i + 1]];
      const [o0, o1] = [evaluate(outs[i], ctx), evaluate(outs[i + 1], ctx)];
      const t = (base ** (at - z0) - 1) / (base ** (z1 - z0) - 1);
      return o0 + (o1 - o0) * t;
    }
    default:
      throw new Error(`unsupported operator: ${op}`);
  }
}

describe('EQUIVALENCE — the corrected halo draws the same circle', () => {
  const ZOOMS = [MIN_ZOOM, 1, 1.5, 2, 2.7, 3, 4, 4.5, 5, 5.9, MAX_ZOOM];
  const LATS = [-54, -33.9, -1.9, 0, 6.5, 30, 48.9, 64.1, 71];
  /* Part I §G's own ladder: country 260 km, province 110, district 45, city 14. */
  const HALOS = [260_000, 110_000, 45_000, 14_000];

  it('matches the original formula at every reachable zoom and latitude', () => {
    const expr = haloRadiusExpression();

    for (const haloMetres of HALOS) {
      for (const lat of LATS) {
        for (const zoom of ZOOMS) {
          const expected = referenceRadius(haloMetres, lat, zoom);
          const actual = evaluate(expr, { zoom, props: { haloMetres, lat } });

          expect(Math.abs(actual - expected) / expected).toBeLessThan(1e-12);
        }
      }
    }
  });

  it('still grows with zoom and shrinks toward the poles — the claim it encodes', () => {
    const expr = haloRadiusExpression();
    const at = (zoom: number, lat: number) =>
      evaluate(expr, { zoom, props: { haloMetres: 260_000, lat } });

    expect(at(5, 0)).toBeGreaterThan(at(2, 0));
    expect(at(3, 0)).toBeLessThan(at(3, 60));
  });
});

describe('STRUCTURE — `zoom` only ever feeds a top-level interpolate or step', () => {
  const SOURCES = [
    join(FRONTEND_SRC, 'components', 'map', 'shell', 'EvidenceMapCanvas.tsx'),
    join(FRONTEND_SRC, 'lib', 'map', 'spatial', 'evidenceHaloRadius.ts'),
    join(FRONTEND_SRC, 'lib', 'map', 'spatial', 'spatialCountryPaint.ts'),
    join(FRONTEND_SRC, 'lib', 'map', 'coveragePaint.ts'),
  ];

  it.each(SOURCES)('%s', (file) => {
    const code = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ');

    for (const match of code.matchAll(/\['zoom'\]/g)) {
      const before = code.slice(Math.max(0, (match.index ?? 0) - 220), match.index);
      /*
        The only legal shape is `'interpolate' | 'step'` opening the expression
        and `['zoom']` as its input argument — so one of those keywords must be
        the nearest preceding operator.
      */
      const nearestOperator = before.match(/'(interpolate|step|\*|\/|\+|-|\^|case|match|get|cos)'/g)?.pop();

      expect(`${file.split('/').pop()}: ${nearestOperator}`).toMatch(
        /: '(interpolate|step)'$/,
      );
    }
  });
});
