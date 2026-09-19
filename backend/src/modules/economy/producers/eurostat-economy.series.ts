import type {
  EconomyCadence,
  EconomyCategory,
  EconomyPinnedDimensions,
} from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE FIRST ALPHA SERIES MATRIX — POLAND
 * ════════════════════════════════════════════════════════════════════════════
 *
 * G-ECONOMY-ALPHA-PRODUCER-CONVERGENCE-R2.
 *
 * Every tuple here was VERIFIED BY REQUEST in
 * `G-ECONOMY-OFFICIAL-SERIES-RECONCILIATION-R1`, each series read at least twice. None
 * was guessed from a label, and a dataset code plus a description is not an identifier —
 * the register carries the full dimension tuple actually sent, and so does this table.
 *
 * ── WHAT `alphaState` MEANS ───────────────────────────────────────────────
 *
 * `ELIGIBLE` means the semantics are settled and this producer would emit it the moment
 * admitted bytes exist. It does NOT mean a figure is available: no series in this table
 * has captured bytes behind it, which is why the lane verdict is HOLD.
 *
 * `BLOCKED` means something is unresolved that no amount of retrieval would fix, and the
 * blocker is named rather than summarised. A blocked cell is a `GAP` on the surface with
 * its reason shown — never a zero, never an em-dash with no explanation, and never
 * another series wearing its label.
 */

export type AlphaSeriesState = 'ELIGIBLE' | 'BLOCKED';

export interface AlphaSeriesDeclaration {
  readonly seriesId: string;
  readonly label: string;
  readonly category: EconomyCategory;
  /** ISO 3166-1 alpha-2 of the ECONOMY measured. Never inferred from the source. */
  readonly economyIso2: string;
  /** The publisher's dataset code, verbatim. Never a URL and never a title. */
  readonly datasetCode: string;
  /**
   * EVERY dimension the dataset declares — the list the contract checks pinning against.
   * Obtained from the publisher's own response, not from a local guess.
   */
  readonly declaredDimensionKeys: readonly string[];
  /** The pinned tuple, publisher spellings on both sides. */
  readonly dimensions: EconomyPinnedDimensions;
  readonly unit: string;
  /** The publisher's own adjustment statement, or `NOT_DECLARED` when the dataset has no such dimension. */
  readonly adjustment: string;
  /** The OBSERVATION frequency. NOT a cadence — see `cadence`. */
  readonly frequency: 'M' | 'Q' | 'A';
  /**
   * THE PUBLISHER'S STATED RELEASE CADENCE — `undefined` for every row, deliberately.
   *
   * Eurostat states none. The only scheduling field seen anywhere in the reconciliation
   * was `DISSEMINATION_TIMESTAMP_PLANNED` on one closed dataset, equal to its own
   * `UPDATE_DATA`. FREQUENCY IS NOT CADENCE: a quarterly GDP series does not acquire a
   * monthly release schedule by sitting next to a monthly one, and a guessed cadence
   * turns `UNDETERMINED` freshness into a confident `STALE` that nobody can defend.
   */
  readonly cadence?: EconomyCadence;
  readonly alphaState: AlphaSeriesState;
  /** Required when BLOCKED. A named blocker, never a summary. */
  readonly blockedBy?: string;
  /** What a surface must NOT call this. Carried so the UI cannot relabel it by accident. */
  readonly mustNotBeLabelled?: readonly string[];
}

const PL = 'PL';

export const ALPHA_SERIES: readonly AlphaSeriesDeclaration[] = Object.freeze([
  {
    seriesId: 'eurostat:prc_hicp_minr:PL:RCH_A:TOTAL',
    label: 'Poland HICP, annual rate of change',
    category: 'INFLATION_CPI',
    economyIso2: PL,
    datasetCode: 'prc_hicp_minr',
    declaredDimensionKeys: ['freq', 'unit', 'coicop18', 'geo', 'time'],
    dimensions: Object.freeze([
      { key: 'freq', value: 'M' },
      { key: 'unit', value: 'RCH_A' },
      { key: 'coicop18', value: 'TOTAL' },
      { key: 'geo', value: 'PL' },
    ]),
    unit: 'PERCENT_CHANGE_YOY',
    adjustment: 'NOT_DECLARED',
    frequency: 'M',
    alphaState: 'ELIGIBLE',
    /*
      THE SUCCESSOR, EXPLICITLY ENCODED. `prc_hicp_midx` and `prc_hicp_manr` both closed
      at 2025-12; `prc_hicp_minr` (ECOICOP ver.2) is the live successor carrying both.
      The dimension is `coicop18`, NOT `coicop` — the wrong name answers 413 — and the
      all-items code is `TOTAL`, NOT `CP00` — the wrong code answers 200 with an empty
      `value`, which is a fabricated absence rather than an error.
    */
    mustNotBeLabelled: Object.freeze(['CPI', 'GUS CPI', 'national CPI']),
  },
  {
    seriesId: 'eurostat:namq_10_gdp:PL:CLV_PCH_PRE:B1GQ:SCA',
    label: 'Poland GDP, chain-linked volumes, % change on previous quarter',
    category: 'GROWTH_GDP',
    economyIso2: PL,
    datasetCode: 'namq_10_gdp',
    declaredDimensionKeys: ['freq', 'unit', 's_adj', 'na_item', 'geo', 'time'],
    dimensions: Object.freeze([
      { key: 'freq', value: 'Q' },
      { key: 'unit', value: 'CLV_PCH_PRE' },
      { key: 's_adj', value: 'SCA' },
      { key: 'na_item', value: 'B1GQ' },
      { key: 'geo', value: 'PL' },
    ]),
    unit: 'PERCENT_CHANGE_QOQ',
    adjustment: 'SCA',
    frequency: 'Q',
    alphaState: 'ELIGIBLE',
  },
  {
    seriesId: 'eurostat:une_rt_m:PL:PC_ACT:TOTAL:T:SA',
    label: 'Poland unemployment rate, % of active population',
    category: 'EMPLOYMENT',
    economyIso2: PL,
    datasetCode: 'une_rt_m',
    declaredDimensionKeys: ['freq', 's_adj', 'age', 'unit', 'sex', 'geo', 'time'],
    dimensions: Object.freeze([
      { key: 'freq', value: 'M' },
      { key: 's_adj', value: 'SA' },
      { key: 'age', value: 'TOTAL' },
      { key: 'unit', value: 'PC_ACT' },
      { key: 'sex', value: 'T' },
      { key: 'geo', value: 'PL' },
    ]),
    unit: 'PERCENT_OF_ACTIVE_POPULATION',
    adjustment: 'SA',
    frequency: 'M',
    alphaState: 'ELIGIBLE',
  },
  {
    seriesId: 'eurostat:gov_10q_ggdebt:PL:PC_GDP:GD:S13',
    label: 'Poland general government gross debt, % of GDP',
    category: 'PUBLIC_DEBT_FISCAL',
    economyIso2: PL,
    datasetCode: 'gov_10q_ggdebt',
    declaredDimensionKeys: ['freq', 'unit', 'sector', 'na_item', 'geo', 'time'],
    dimensions: Object.freeze([
      { key: 'freq', value: 'Q' },
      { key: 'unit', value: 'PC_GDP' },
      { key: 'sector', value: 'S13' },
      { key: 'na_item', value: 'GD' },
      { key: 'geo', value: 'PL' },
    ]),
    unit: 'PERCENT_OF_GDP',
    adjustment: 'NOT_DECLARED',
    frequency: 'Q',
    alphaState: 'ELIGIBLE',
  },
  {
    seriesId: 'eurostat:irt_lt_mcby_m:PL:MCBY',
    label: 'Poland long-term government bond yield (Maastricht criterion)',
    /*
      IT IS NOT A POLICY RATE, AND THERE IS NO CATEGORY FOR IT.

      The accepted `ECONOMY_CATEGORIES` has `POLICY_RATE` and no financing-condition
      member. A long-term market yield placed in `POLICY_RATE` would be the exact
      relabelling the lane forbids, and inventing an eighth category is a contract change
      this lane may not make. The row is therefore declared and BLOCKED, so the gap is
      visible rather than filled by the nearest available number.
    */
    category: 'POLICY_RATE',
    economyIso2: PL,
    datasetCode: 'irt_lt_mcby_m',
    declaredDimensionKeys: ['freq', 'int_rt', 'geo', 'time'],
    dimensions: Object.freeze([
      { key: 'freq', value: 'M' },
      { key: 'int_rt', value: 'MCBY' },
      { key: 'geo', value: 'PL' },
    ]),
    /** C-8 · this dataset has NO `unit` dimension. The unit is locally asserted, and says so. */
    unit: 'PERCENT_PER_ANNUM_LOCALLY_ASSERTED',
    adjustment: 'NOT_DECLARED',
    frequency: 'M',
    alphaState: 'BLOCKED',
    blockedBy:
      'ECON-BLOCK-YIELD-CATEGORY: a long-term bond yield is a financing condition, not a ' +
      'policy rate, and the accepted category set has no financing-condition member. D-4 ' +
      '(the Economy/Market boundary over this same identifier) is also unresolved: the same ' +
      'upstream series is claimed by both domains and no ruling has assigned it.',
    mustNotBeLabelled: Object.freeze(['policy rate', 'NBP rate', 'reference rate', 'interest rate decision']),
  },
  {
    seriesId: 'eurostat:ert_bil_eur_m:PLN:AVG:NAC',
    label: 'PLN per EUR, monthly average',
    category: 'FX_CONDITIONS',
    economyIso2: PL,
    datasetCode: 'ert_bil_eur_m',
    /** C-9 · this dataset has NO `geo` dimension. Poland is `currency=PLN`. */
    declaredDimensionKeys: ['freq', 'unit', 'statinfo', 'currency', 'time'],
    dimensions: Object.freeze([
      { key: 'freq', value: 'M' },
      { key: 'unit', value: 'NAC' },
      { key: 'statinfo', value: 'AVG' },
      { key: 'currency', value: 'PLN' },
    ]),
    unit: 'NATIONAL_CURRENCY_PER_EUR_DIRECTION_UNCONFIRMED',
    adjustment: 'NOT_DECLARED',
    frequency: 'M',
    alphaState: 'BLOCKED',
    blockedBy:
      'ECON-BLOCK-FX-DIRECTION: C-10 — "National currency" does not state the quote ' +
      'direction, and a rate printed the wrong way round is not a smaller error than no ' +
      'rate. D-5 (one ESMS read) closes it; it has not been performed.',
  },
]);

/**
 * DATASETS THIS PRODUCER REFUSES, BY NAME.
 *
 * Both closed on 2026-02-06 with a final period of 2025-12, and both ANNOUNCE THEIR OWN
 * CLOSURE IN THEIR TITLE rather than in a timestamp (C-11). They still answer HTTP 200
 * with a plausible number, which is precisely why the refusal is a list rather than a
 * judgement: a stale-but-valid reading is the hardest kind of wrong number to notice.
 */
export const CLOSED_DATASETS: Readonly<Record<string, string>> = Object.freeze({
  prc_hicp_midx:
    'CLOSED 2026-02-06, final period 2025-12. Superseded by prc_hicp_minr (ECOICOP ver.2, ' +
    'dimension coicop18, all-items TOTAL). Splicing it into the successor is forbidden.',
  prc_hicp_manr:
    'CLOSED 2026-02-06, final period 2025-12. Superseded by prc_hicp_minr. Still answers 200 ' +
    'with a value, which is why it is refused by name rather than by freshness.',
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ECON-CL-1 · RESOLVED — AND THE SUBTRACTION IS THE CONTRACT'S, NOT OURS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R2 reported it and pinned it: Eurostat declares `time` among its dimensions, and pinning
 * it would make the series identity change every month — which does not merely churn the
 * key, it makes the accepted revision semantics inexpressible, because "two observations
 * sharing (seriesId, periodId) and differing in vintage are BOTH TRUE" requires one series
 * to span many periods.
 *
 * `MAIN-ECONOMY-LINEAGE-PROMOTION-CL1-R1` ruled it. The axis list now lives in the
 * contract as `ECONOMY_OBSERVATION_AXIS_KEYS`, `assertDimensionsArePinned` REFUSES a ref
 * that pins an axis key, and this module's local list is DELETED rather than moved.
 *
 * The reason it is deleted and not moved is worth keeping: an adapter that filters its own
 * declared list can filter one key too many and nothing throws. `declaredDimensionKeys` on
 * every row below therefore still carries `time` — it is the publisher's list and it stays
 * true to the publisher — and it is passed to the contract VERBATIM.
 */

export function alphaSeries(seriesId: string): AlphaSeriesDeclaration {
  const found = ALPHA_SERIES.find((s) => s.seriesId === seriesId);
  if (found === undefined) {
    throw new Error(`ECON-ALPHA-SERIES-UNDECLARED: '${seriesId}' is not in the Alpha matrix.`);
  }
  return found;
}

/** The rows a surface may attempt. Blocked rows are rendered as gaps with their reason. */
export const ALPHA_ELIGIBLE_SERIES: readonly AlphaSeriesDeclaration[] = Object.freeze(
  ALPHA_SERIES.filter((s) => s.alphaState === 'ELIGIBLE'),
);
