import {
  assessComparability,
  projectIndicatorTable,
  type ComparableSide,
  type EconomyObservation,
  type EconomySeries,
  type SeriesDefinition,
} from '@globalnews-ai/shared';

/**
 * CONVERSATIONAL INTELLIGENCE JOURNEY R3 §10 / §11 / §31 — a multi-country indicator table is
 * built only from comparable governed observations; incompatible definitions are said, never
 * normalised; a missing country is a stated gap, never a zero.
 */
const series = (iso2: string, over: Partial<EconomySeries> = {}): EconomySeries => ({
  seriesId: `${iso2}-gdp`,
  label: `${iso2} real GDP growth`,
  economyIso2: iso2,
  unit: 'percent',
  category: 'GROWTH_GDP',
  cadence: 'ANNUAL',
  ...over,
});
const definition = (iso2: string, over: Partial<SeriesDefinition> = {}): SeriesDefinition => ({
  seriesId: `${iso2}-gdp`,
  indicatorId: 'GDP_GROWTH',
  basis: 'REAL',
  transformation: 'PERCENT_CHANGE_YOY',
  adjustment: 'NOT_SEASONALLY_ADJUSTED',
  scope: 'AGGREGATE',
  publisher: 'national statistics office',
  ...over,
});
const observation = (iso2: string, value: number, over: Partial<EconomyObservation> = {}) =>
  ({
    seriesId: `${iso2}-gdp`,
    periodId: '2025',
    vintage: '2026-04-01T00:00:00Z',
    value,
    unit: 'percent',
    semantics: {} as never,
    provenance: {} as never,
    ...over,
  }) as EconomyObservation;
const side = (
  iso2: string,
  value: number | undefined,
  def: Partial<SeriesDefinition> = {},
  ser: Partial<EconomySeries> = {},
): ComparableSide => ({
  series: series(iso2, ser),
  definition: definition(iso2, def),
  observation: value === undefined ? undefined : observation(iso2, value),
});

describe('assessComparability — the five GDP axes are never silently merged', () => {
  it('same indicator, basis, transformation, adjustment, scope, cadence, unit and period → COMPARABLE', () => {
    expect(assessComparability([side('RW', 7.2), side('KE', 5.0), side('TZ', 5.4)])).toEqual({
      verdict: 'COMPARABLE',
    });
  });

  it.each([
    ['basis', { basis: 'NOMINAL' as const }],
    ['transformation', { transformation: 'PERCENT_CHANGE_QOQ' as const }],
    ['adjustment', { adjustment: 'SEASONALLY_ADJUSTED' as const }],
    ['scope', { scope: 'PER_CAPITA' as const }],
  ])('a different %s → NOT_DIRECTLY_COMPARABLE naming it', (axis, def) => {
    expect(assessComparability([side('RW', 7.2), side('KE', 5.0, def)])).toEqual({
      verdict: 'NOT_DIRECTLY_COMPARABLE',
      differing: [axis],
    });
  });

  it('annual vs quarterly cadence → NOT_DIRECTLY_COMPARABLE', () => {
    expect(
      assessComparability([side('RW', 7.2), side('KE', 1.2, {}, { cadence: 'QUARTERLY' })]),
    ).toMatchObject({ verdict: 'NOT_DIRECTLY_COMPARABLE', differing: ['cadence'] });
  });

  it('an undeclared axis is UNDETERMINED, never assumed equal', () => {
    expect(
      assessComparability([side('RW', 7.2), side('KE', 5.0, { adjustment: undefined })]),
    ).toEqual({
      verdict: 'UNDETERMINED',
      undeclared: ['adjustment'],
    });
  });
});

describe('projectIndicatorTable — governed cells only, omissions disclosed', () => {
  it('a comparable row is shown; a missing country is a GAP (never 0); an incomparable row is omitted and said', () => {
    const table = projectIndicatorTable(
      ['RW', 'KE', 'TZ'],
      [
        {
          indicatorId: 'GDP_GROWTH',
          label: 'Real GDP growth',
          sides: { RW: side('RW', 7.2), KE: side('KE', 5.0), TZ: undefined },
        },
        {
          indicatorId: 'INFLATION',
          label: 'Inflation',
          sides: {
            RW: side('RW', 4.1, { indicatorId: 'INFLATION', transformation: 'PERCENT_CHANGE_YOY' }),
            KE: side('KE', 0.4, { indicatorId: 'INFLATION', transformation: 'PERCENT_CHANGE_QOQ' }),
          },
        },
        { indicatorId: 'DEBT_GDP', label: 'Debt / GDP', sides: {} },
      ],
    );
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].cells.TZ).toEqual({ kind: 'GAP', reason: 'NO_GOVERNED_SERIES' });
    expect(table.rows[0].cells.RW).toMatchObject({ kind: 'OBSERVATION' });
    expect(table.omitted).toEqual([
      expect.objectContaining({ indicatorId: 'INFLATION', reason: 'NOT_DIRECTLY_COMPARABLE' }),
      expect.objectContaining({ indicatorId: 'DEBT_GDP', reason: 'NO_OBSERVATIONS' }),
    ]);
    expect(JSON.stringify(table)).not.toMatch(/"value":0\b/);
  });
});
