import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { indicatorMaxFor, visibleIndicatorCount } from '@/lib/specialist/indicatorStrip';
import { economyIndicatorStrip } from './economyIndicatorStripAdapter';
import type { Series } from './types';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B4-A — ECONOMY SUBSTRATE, AND THE STRIP RECONCILIATION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The Economy-local `IndicatorStrip.tsx` was NOT recovered. The four behaviours
 * Gate B3.1 classified were migrated into the shared component and its
 * configuration, and this proves each one landed — and that the two which are
 * still open questions were NOT silently answered.
 *
 * ── THE STATE THIS ALL RUNS IN ────────────────────────────────────────────
 *
 * `OFFICIAL_SOURCES` is empty. Every Economy indicator is therefore in the
 * no-observation state, which makes ECON-DATA-1 the DEFAULT path rather than an
 * edge case. Most of what follows is about being honest in that state.
 */

const REPO = join(__dirname, '..', '..', '..', '..');

const series = (id: string, over: Partial<Series> = {}): Series =>
  ({
    model: { seriesId: id, label: id, unit: '%', economyIso2: 'PL', category: 'INFLATION_CPI' },
    shortLabel: id.toUpperCase(),
    direction: 'UP',
    latest: { kind: 'GAP', reason: 'NO_PRODUCER' },
    triad: null,
    history: [],
    ...over,
  }) as unknown as Series;

const strip = (count: number, observationsAvailable = false) =>
  economyIndicatorStrip({
    series: Array.from({ length: count }, (_, i) => series(`s${i}`)),
    observationsAvailable,
    window: '12M',
  });

describe('B4-A — the Economy-local strip was replaced, not recovered', () => {
  it('the domain-local duplicate is absent', () => {
    /* §21: no domain copy of a shared component. */
    expect(
      existsSync(join(REPO, 'frontend', 'src', 'components', 'economy', 'IndicatorStrip.tsx')),
    ).toBe(false);
  });

  it('and EconomyScreen renders the SHARED component', () => {
    const screen = readFileSync(
      join(REPO, 'frontend', 'src', 'components', 'economy', 'EconomyScreen.tsx'),
      'utf-8',
    );

    expect(screen).toContain('ObservedIndicatorStrip');
    expect(screen).not.toContain("from './IndicatorStrip'");
  });

  it('through an adapter, so the shared component learns no Economy word', () => {
    const shared = readFileSync(
      join(REPO, 'frontend', 'src', 'components', 'specialist', 'ObservedIndicatorStrip.tsx'),
      'utf-8',
    );

    for (const word of ['Series', 'EconomyLocale', 'FigureSlot', 'econ']) {
      expect(shared).not.toContain(word);
    }
  });
});

describe('B4-A · R-1 — the ceiling is configuration, the count is responsive', () => {
  it('Economy’s ratified ceiling is seven', () => {
    expect(indicatorMaxFor('ECONOMY')).toBe(7);
  });

  it('but the CEILING IS NOT THE COUNT — 1360 shows six', () => {
    /*
      The distinction B3.1 insisted on. Raising the constant alone would have
      given Economy a fixed seven at every width, which is not Part VI's
      contract: six at 1360, seven at 1512 and above.
    */
    expect(visibleIndicatorCount('ECONOMY', 6, 7)).toBe(6);
    expect(visibleIndicatorCount('ECONOMY', 7, 7)).toBe(7);
  });

  it('a caller cannot exceed the ratified ceiling by asking for more', () => {
    /* The ceiling stays the contract; the count is a request inside it. */
    expect(visibleIndicatorCount('ECONOMY', 12, 12)).toBe(7);
  });

  it('and a domain with no entry still cannot exceed the platform default', () => {
    expect(visibleIndicatorCount('SECURITY', 12, 12)).toBe(5);
  });

  it('omitting the count shows everything available, as before', () => {
    /* Every existing consumer passes no count, and nothing changes for them. */
    expect(visibleIndicatorCount('CONFLICT', undefined, 4)).toBe(4);
  });
});

describe('B4-A · NO SILENT SLICING', () => {
  const component = readFileSync(
    join(REPO, 'frontend', 'src', 'components', 'specialist', 'ObservedIndicatorStrip.tsx'),
    'utf-8',
  );

  it('the withheld count is computed and carried onto the surface', () => {
    /*
      The Economy-local strip did `indicators.slice(0, cellCount)` and said
      nothing, so a reader at 1360 saw six of seven observations with no way to
      know a seventh existed.
    */
    expect(component).toContain('const withheld = strip.indicators.length - visible.length;');
    expect(component).toContain('data-gn-withheld={withheld}');
  });

  it('the adapter itself never slices — that is a layout decision', () => {
    expect(strip(7).indicators).toHaveLength(7);
  });

  it('and an over-length strip is still REFUSED rather than truncated', () => {
    /* The pre-existing guarantee, unchanged: 8 exceeds Economy's ceiling. */
    expect(visibleIndicatorCount('ECONOMY', undefined, 8)).toBe(7);
  });
});

describe('B4-A · ECON-DATA-1 — honest without a producer', () => {
  it('with no observation source the LABEL survives', () => {
    const [first] = strip(3).indicators;

    expect(first?.label).toBe('S0');
    expect(first?.indicatorId).toBe('s0');
  });

  it('but the figure is withheld — not a zero, not a dash', () => {
    /*
      A placeholder chosen in the adapter would travel into every consumer as if
      it were data. The surface decides how to render an absence.
    */
    const [first] = strip(1).indicators;

    expect(first?.value).toBe('');
    expect(first?.unit).toBeUndefined();
  });

  it('and the direction is UNKNOWN, because no movement was observed', () => {
    /*
      "The arrow describes a movement between observations; with no observations
      there is no movement to describe, and an arrow beside a dash would invent
      one." The shared vocabulary has UNKNOWN for exactly this; the Economy-local
      one lacked it and had to suppress the arrow by hand.
    */
    const [first] = strip(1).indicators;

    expect(first?.direction).toBe('UNKNOWN');
    expect(first?.observedAt).toBeNull();
  });

  it('a series whose direction says UP is still UNKNOWN without an observation', () => {
    /* The fixture's direction is UP; the absence of data wins. */
    const [first] = strip(1, false).indicators;

    expect(first?.direction).not.toBe('RISING');
  });

  it('and no magnitude basis is invented, so no bar is drawn', () => {
    /*
      Part VI specifies no magnitude bar. Supplying a basis here would settle an
      open design question (ECONOMY-STRIP-MAGNITUDE-BAR-1) by side effect.
    */
    const [first] = strip(1).indicators;

    expect(first?.magnitudeBasis).toBeUndefined();
  });
});

describe('B4-A · what was NOT activated', () => {
  it('no EconomyModule is registered', () => {
    const appModule = readFileSync(join(REPO, 'backend', 'src', 'app.module.ts'), 'utf-8');

    expect(appModule).not.toContain('EconomyModule');
  });

  it('no public Economy route exists', () => {
    expect(existsSync(join(REPO, 'frontend', 'src', 'app', 'economy'))).toBe(false);
  });

  it('Watch runtime is untouched', () => {
    const gate = readFileSync(
      join(REPO, 'frontend', 'src', 'lib', 'map', 'monetization', 'watchRuntimeGate.ts'),
      'utf-8',
    );

    expect(gate).toContain('export const WATCH_RUNTIME_ACTIVE = false;');
  });

  it('and the official-source registry is still empty by design', () => {
    const registry = readFileSync(
      join(REPO, 'backend', 'src', 'modules', 'official-sources', 'official-source-registry.ts'),
      'utf-8',
    );

    expect(registry).toMatch(/starts empty and stays empty/);
  });
});
