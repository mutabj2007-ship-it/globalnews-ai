import type {
  AttentionRow, CompetingReadingSet, Corridor, EconomySubject, FigureSlot, LifecycleEvent,
  Series, TimelineEntry, TransmissionLink,
} from './types';
import type { SourceProvenance } from '@globalnews-ai/shared';
import {
  economyFigure, economyGap, legacyFreshness, legacyGapReason, legacyReleaseStatus, legacyValueKind,
} from './economyAdapters';

/**
 * ECON-UI-1 — DETERMINISTIC FIXTURES FOR VALIDATION AND DEMO ONLY.
 *
 * EVERY FIGURE HERE IS ILLUSTRATIVE AND MUST NOT BE TREATED AS A PRODUCTION FACT.
 * DESIGN-ECON-1 states it on every board footer: "Figures illustrative — do not quote."
 * The Rwanda, Kenya and Poland numbers are structurally plausible and nothing more. They
 * exist so the fourteen desktop states and nine compact states are reachable and testable
 * without a backend, and for no other reason.
 *
 * `attentionRank` is FIXTURE INPUT, supplied explicitly. A9 forbids the UI computing,
 * normalizing, approximating or re-sorting it; supplying it here is how a fixture stands
 * in for the shared assessment service, not a local ranking.
 */

/**
 * ECON-UI-CONTRACT-ADAPT-1 — the fixture builder now produces a SLOT.
 *
 * Fixture literals below were authored against the pre-contract UI vocabulary ('PRELIM',
 * 'OBSERVED', 'CURRENT', …). Rather than hand-rewrite every literal — which would be me
 * re-deciding the mapping — this builder lifts them through the CONTRACT'S OWN
 * `ECONOMY_LEGACY_UI_*` tables. The mapping is Main's; this is only its application.
 *
 * `value: null` no longer produces an observation carrying a null. It produces a GAP, and a
 * GAP cannot be built without a reason — so a fixture that wants an absent figure must say why
 * it is absent, exactly as production data must.
 */
type LegacyAxes = {
  readonly releaseStatus: 'PRELIM' | 'REVISED' | 'FINAL' | null;
  readonly valueKind: 'OBSERVED' | 'FORECAST' | 'ESTIMATED';
  readonly freshness: 'CURRENT' | 'STALE' | 'DELAYED';
  readonly revisionOrdinal?: number;
};

/** Fixture provenance. Illustrative like every other value in this module. */
const FIXTURE_PROVENANCE: SourceProvenance = { sourceType: 'PUBLIC_DATA' };

const obs = (
  id: string, seriesId: string, periodLabel: string, vintage: string,
  value: number | null, unit: string,
  legacy: LegacyAxes, publishedAt: string,
  absentBecause: 'NOT_COLLECTED' | 'WITHHELD' | 'DISCONTINUED' = 'NOT_COLLECTED',
): FigureSlot => {
  const periodId = `${seriesId}:${periodLabel}`;
  if (value === null) {
    // Absence is structural, and it must state its reason.
    return economyGap(seriesId, periodId, legacyGapReason[absentBecause]);
  }
  return economyFigure({
    seriesId,
    periodId,
    vintage,
    value,
    unit,
    semantics: {
      releaseStatus: legacy.releaseStatus === null ? null : legacyReleaseStatus[legacy.releaseStatus],
      valueKind: legacyValueKind[legacy.valueKind],
      freshness: legacyFreshness[legacy.freshness],
      ...(legacy.revisionOrdinal !== undefined ? { revisionOrdinal: legacy.revisionOrdinal } : {}),
    },
    provenance: FIXTURE_PROVENANCE,
  });
};


/* ---- Rwanda headline CPI — the primary walkthrough subject ---- */

const rwCpiHistory: readonly FigureSlot[] = [
  /*
    ILLUSTRATIVE. Twenty-four monthly points, not twelve, so the breakpoint table's window
    ruling is MEASURABLE: 12 bars at 1360, 18 at 1512, 24 at 1920 — more of the SAME
    object at a wider frame, never a second chart. With only twelve points every width
    rendered twelve bars and the ruling could not be proved either way.
  */
  obs('o-rw-cpi-a1', 's-rw-cpi', 'SEP 2024', 'FINAL', 3.1, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2024-10-08'),
  obs('o-rw-cpi-a2', 's-rw-cpi', 'OCT 2024', 'FINAL', 3.3, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2024-11-07'),
  obs('o-rw-cpi-a3', 's-rw-cpi', 'NOV 2024', 'FINAL', 3.4, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2024-12-06'),
  obs('o-rw-cpi-a4', 's-rw-cpi', 'DEC 2024', 'FINAL', 3.2, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2025-01-08'),
  obs('o-rw-cpi-a5', 's-rw-cpi', 'JAN 2025', 'FINAL', 3.0, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2025-02-06'),
  obs('o-rw-cpi-a6', 's-rw-cpi', 'FEB 2025', 'FINAL', 3.2, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2025-03-06'),
  obs('o-rw-cpi-a7', 's-rw-cpi', 'MAR 2025', 'FINAL', 3.5, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2025-04-08'),
  obs('o-rw-cpi-a8', 's-rw-cpi', 'APR 2025', 'FINAL', 3.6, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2025-05-07'),
  obs('o-rw-cpi-a9', 's-rw-cpi', 'MAY 2025', 'FINAL', 3.7, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2025-06-06'),
  obs('o-rw-cpi-a10', 's-rw-cpi', 'JUN 2025', 'FINAL', 3.8, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2025-07-08'),
  obs('o-rw-cpi-a11', 's-rw-cpi', 'JUL 2025', 'FINAL', 3.8, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2025-08-07'),
  obs('o-rw-cpi-a12', 's-rw-cpi', 'AUG 2025', 'FINAL', 3.9, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2025-09-05'),
  obs('o-rw-cpi-1', 's-rw-cpi', 'SEP 2025', 'FINAL', 3.9, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2025-10-08'),
  obs('o-rw-cpi-2', 's-rw-cpi', 'OCT 2025', 'FINAL', 4.0, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2025-11-07'),
  obs('o-rw-cpi-3', 's-rw-cpi', 'NOV 2025', 'FINAL', 4.1, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2025-12-08'),
  obs('o-rw-cpi-4', 's-rw-cpi', 'DEC 2025', 'FINAL', 4.0, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2026-01-08'),
  obs('o-rw-cpi-5', 's-rw-cpi', 'JAN 2026', 'FINAL', 3.8, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2026-02-06'),
  obs('o-rw-cpi-6', 's-rw-cpi', 'FEB 2026', 'FINAL', 3.9, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2026-03-06'),
  obs('o-rw-cpi-7', 's-rw-cpi', 'MAR 2026', 'FINAL', 4.1, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2026-04-08'),
  obs('o-rw-cpi-8', 's-rw-cpi', 'APR 2026', 'FINAL', 4.3, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2026-05-07'),
  obs('o-rw-cpi-9', 's-rw-cpi', 'MAY 2026', 'FINAL', 4.4, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2026-06-08'),
  obs('o-rw-cpi-10', 's-rw-cpi', 'JUN 2026', 'FINAL', 4.5, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2026-07-07'),
  obs('o-rw-cpi-11', 's-rw-cpi', 'JUL 2026', 'FINAL', 4.6, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2026-08-07'),
  obs('o-rw-cpi-12', 's-rw-cpi', 'AUG 2026', 'ORIGINAL', 5.2, '%', { releaseStatus: 'PRELIM', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2026-09-05'),
];

export const RW_CPI: Series = {
  model: {
    seriesId: 's-rw-cpi', label: 'Rwanda headline CPI', economyIso2: 'RW',
    unit: '%', category: 'INFLATION_CPI', cadence: 'MONTHLY', geographyId: 'RWA',
  },
  shortLabel: 'CPI y/y', direction: 'UP',
  latest: rwCpiHistory[23]!,
  triad: {
    actual: rwCpiHistory[23]!,
    expected: {
      seriesId: 's-rw-cpi', periodId: 's-rw-cpi:AUG 2026', value: 4.8, unit: '%',
      aggregationMethod: 'MEDIAN', contributorCount: 7, collectionCutoff: '2026-09-05',
      contributingForecastRefs: ['f-1', 'f-2', 'f-3', 'f-4', 'f-5', 'f-6', 'f-7'], valueKind: 'DERIVED',
    },
    previous: rwCpiHistory[22]!,
    surprise: 0.4, surpriseUnit: 'pp',
  },
  history: rwCpiHistory,
};

const RW_POLICY_RATE: Series = {
  model: {
    seriesId: 's-rw-rate', label: 'Rwanda policy rate', economyIso2: 'RW',
    unit: '%', category: 'POLICY_RATE', cadence: 'QUARTERLY', geographyId: 'RWA',
  },
  shortLabel: 'Policy rate', direction: 'FLAT',
  latest: obs('o-rw-rate-1', 's-rw-rate', 'Q3 2026', 'FINAL', 7.5, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2026-08-20'),
  triad: null, history: [],
};

const RW_FX: Series = {
  model: {
    seriesId: 's-rw-fx', label: 'RWF / USD', economyIso2: 'RW',
    unit: '', category: 'FX_CONDITIONS', cadence: 'DAILY', geographyId: 'RWA',
  },
  shortLabel: 'RWF/USD', direction: 'DOWN',
  latest: obs('o-rw-fx-1', 's-rw-fx', '05 SEP', 'FINAL', 1312, '', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2026-09-05'),
  triad: null, history: [],
};

const RW_FUEL: Series = {
  model: {
    seriesId: 's-rw-fuel', label: 'Fuel landed cost', economyIso2: 'RW',
    unit: '%', category: 'INFLATION_CPI', cadence: 'MONTHLY', geographyId: 'RWA',
  },
  shortLabel: 'Fuel cost', direction: 'UP',
  latest: obs('o-rw-fuel-1', 's-rw-fuel', 'AUG 2026', 'ORIGINAL', 9.1, '%', { releaseStatus: 'PRELIM', valueKind: 'ESTIMATED', freshness: 'CURRENT' }, '2026-09-02'),
  triad: null, history: [],
};

const RW_TRADE: Series = {
  model: {
    seriesId: 's-rw-trade', label: 'Trade balance', economyIso2: 'RW',
    unit: '%', category: 'TRADE_EXTERNAL_BALANCE', cadence: 'QUARTERLY', geographyId: 'RWA',
  },
  shortLabel: 'Trade bal.', direction: 'DOWN',
  latest: obs('o-rw-trade-1', 's-rw-trade', 'Q2 2026', 'FINAL', -12.4, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'STALE' }, '2026-07-30'),
  triad: null, history: [],
};

/** The deliberately DELAYED cell the first viewport shows: em-dash, reason stated. */
const RW_GDP: Series = {
  model: {
    seriesId: 's-rw-gdp', label: 'Real GDP growth', economyIso2: 'RW',
    unit: '%', category: 'GROWTH_GDP', cadence: 'QUARTERLY', geographyId: 'RWA',
  },
  shortLabel: 'GDP y/y', direction: 'FLAT',
  latest: obs('o-rw-gdp-1', 's-rw-gdp', 'Q2 2026', 'ORIGINAL', null, '%',
    { releaseStatus: null, valueKind: 'OBSERVED', freshness: 'DELAYED' }, '2026-09-05'),
  triad: null, history: [],
};

/** The seventh cell, resident only from 1512 upward. */
const RW_FISCAL: Series = {
  model: {
    seriesId: 's-rw-fiscal', label: 'Fiscal balance', economyIso2: 'RW',
    unit: '%', category: 'PUBLIC_DEBT_FISCAL', cadence: 'ANNUAL', geographyId: 'RWA',
  },
  shortLabel: 'Fiscal bal.', direction: 'DOWN',
  latest: obs('o-rw-fiscal-1', 's-rw-fiscal', 'FY 2025', 'FINAL', -5.8, '%', { releaseStatus: 'FINAL', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2026-03-14'),
  triad: null, history: [],
};

/** attentionRank supplied as fixture input — never computed here. */
export const RW_ATTENTION: readonly AttentionRow[] = [
  { id: 'a1', subjectId: 's-rw-cpi', headline: 'Inflation exceeded expectations and accelerated for a third consecutive release.', changeState: 'SIGNIFICANT_CHANGE', attentionRank: 0.94, ageLabel: 'TODAY', provenance: 'CPI · 5.2% VS [4.8] · 6 SOURCES' },
  { id: 'a2', subjectId: 's-rw-fuel', headline: 'Fuel landed cost continues to rise on corridor routing pressure.', changeState: 'DEVELOPING', attentionRank: 0.81, ageLabel: '1D AGO', provenance: 'FUEL · EST 9.1% · 4 SOURCES' },
  { id: 'a3', subjectId: 'c-mombasa-kigali', headline: 'Mombasa dwell time lengthened for a second week.', changeState: 'NEW_EVIDENCE', attentionRank: 0.67, ageLabel: '3D AGO', provenance: 'CORRIDOR · 5 SOURCES' },
  { id: 'a4', subjectId: 's-rw-rate', headline: 'Expected policy easing did not arrive; rate direction held flat.', changeState: 'SIGNIFICANT_CHANGE', attentionRank: 0.55, ageLabel: '2W AGO', provenance: 'POLICY RATE · 7.5% · 3 SOURCES' },
  { id: 'a5', subjectId: 's-rw-trade', headline: 'Trade balance already assessed as widening; no change to the standing view.', changeState: 'NO_MATERIAL_CHANGE', attentionRank: 0.31, ageLabel: '1M AGO', provenance: 'TRADE · −12.4% · 2 SOURCES' },
];

const RW_POLICY_LANE: readonly LifecycleEvent[] = [
  { id: 'e1', kind: 'POLICY_HOLD', label: 'MPC held the policy rate; an easing had been expected', occurredAt: '2026-08-20', subjectId: 'p-rw-rate' },
  { id: 'e2', kind: 'NEW_RELEASE', label: 'CPI August release published', occurredAt: '2026-09-05', subjectId: 's-rw-cpi' },
];

export const MOMBASA_KIGALI: Corridor = {
  corridorId: 'c-mombasa-kigali',
  label: 'Mombasa → Kigali',
  /* ECON-DATA-1 measured ENDPOINT_ONLY; the canonical spelling of the degraded mode. */
  capability: 'ENDPOINT_ONLY',
  endpoints: [
    { role: 'Mombasa', geographyId: 'MBA', renderable: true },
    { role: 'Kigali', geographyId: 'KGL', renderable: true },
  ],
  chain: [],
};

export const TRANSMISSION_CHAIN: readonly TransmissionLink[] = [
  { id: 't1', title: 'Red Sea routing disruption', relation: 'ORIGIN_OF', relationDetail: 'the observed cost movement', evidenceCount: 9, confidence: 'HIGH', supported: true, crossDomain: 'CONFLICT' },
  { id: 't2', title: 'Container and bunker costs, East Africa lanes', relation: 'ASSOCIATED_WITH', evidenceCount: 5, confidence: 'HIGH', supported: true },
  { id: 't3', title: 'Mombasa throughput and dwell time', relation: 'CONTRIBUTES_TO', evidenceCount: 4, confidence: 'MODERATE', supported: true },
  { id: 't4', title: 'Rwanda fuel landed cost', relation: 'EXPOSURE_THROUGH', relationDetail: 'single-corridor dependence', evidenceCount: 3, confidence: 'MODERATE', supported: true },
  { id: 't5', title: 'Domestic transport tariffs', relation: 'POTENTIAL_TRANSMISSION_CHANNEL', evidenceCount: 2, confidence: 'LOW', supported: false },
  { id: 't6', title: 'Headline inflation, Rwanda', relation: 'POTENTIAL_TRANSMISSION_CHANNEL', relationDetail: 'not yet isolated in the CPI basket', evidenceCount: 1, confidence: 'LOW', supported: false },
];

/* ---- Poland — revisions, competing readings, policy ---- */

export const PL_GDP_VINTAGES: readonly FigureSlot[] = [
  obs('o-pl-gdp-1', 's-pl-gdp', 'Q2 2026', 'ORIGINAL', 2.1, '%', { releaseStatus: 'PRELIM', valueKind: 'OBSERVED', freshness: 'CURRENT' }, '2026-08-14'),
  obs('o-pl-gdp-2', 's-pl-gdp', 'Q2 2026', 'REVISED 1', 1.6, '%', { releaseStatus: 'REVISED', valueKind: 'OBSERVED', freshness: 'CURRENT', revisionOrdinal: 1 }, '2026-09-02'),
];

export const PL_COMPETING: CompetingReadingSet = {
  readings: [
    { id: 'cr-1', source: { id: 'src-mof', publisher: 'Ministry of Finance', title: 'Autumn projection', sourceClass: 'FORECAST_PUBLICATION', publishedAt: '2026-08-28', originalLanguage: 'pl' }, value: 3.4, unit: '%', claim: 'Growth recovers in the second half as public investment accelerates.', evidenceCount: 6, officialStatisticalCount: 2, vintage: 'GUS Q2 REV 1' },
    { id: 'cr-2', source: { id: 'src-imf', publisher: 'IMF', title: 'Article IV consultation', sourceClass: 'FORECAST_PUBLICATION', publishedAt: '2026-07-19', originalLanguage: 'en' }, value: 2.7, unit: '%', claim: 'Public investment execution lags, holding second-half growth below trend.', evidenceCount: 4, officialStatisticalCount: 1, vintage: 'GUS Q2 REV 1' },
  ],
  sharedObservationBase: ['GUS Q2 1.6% REV 1', 'GUS Q1 0.9% FINAL', 'NBP CPI path'],
  assessment: 'Both readings are consistent with published data through Q2; the gap is attributable to differing second-half public-investment assumptions, not to a disputed observation.',
  confidence: 'MODERATE',
  disputedObservationCount: 0,
};

export const PL_TIMELINE: readonly TimelineEntry[] = [
  { id: 'tl1', dateLabel: 'JAN 2026', body: 'Inflation assessed as declining.', meta: '3 sources · stable', isCurrent: false },
  { id: 'tl2', dateLabel: 'APR 2026', body: 'Corridor fuel pressure appears in the evidence base.', meta: 'new evidence', isCurrent: false },
  { id: 'tl3', dateLabel: 'JUN 2026', body: 'Inflation stabilizes; assessment unchanged.', meta: 'no material change', isCurrent: false },
  { id: 'tl4', dateLabel: 'AUG 2026', body: 'Forecast revised upward by two institutions.', meta: 'REV · superseded value retained', isCurrent: false, supersededObservationId: 'o-pl-gdp-1' },
  { id: 'tl5', dateLabel: 'SEP 2026', body: 'Assessment moves to price pressure building.', meta: 'significant change', isCurrent: true },
];

/* ---- The composed subject the overview renders ---- */

export const RWANDA_SUBJECT: EconomySubject = {
  id: 'RWA', kind: 'COUNTRY', name: 'Rwanda',
  scopeLabel: 'National', contextLabel: 'East Africa',
  assessment: {
    id: 'as-rw-1', subjectId: 'RWA',
    /*
      A real assessment, so it carries a real shared model. The vintages are NON-EMPTY, which is
      what entitles it to name a change state at all — `assertAssessmentIsAccountable` is asserted
      against this object in the guards.
    */
    model: {
      seriesId: 's-rw-cpi',
      periodId: 's-rw-cpi:AUG 2026',
      observedVintages: ['2026-09-05', '2026-08-07', '2026-09-02'],
      producedBy: 'fixture:econ-assessment',
      assessedAt: '2026-09-05',
      changeState: 'SIGNIFICANT_CHANGE',
      priorChangeState: 'STABLE',
    },
    statement: 'Inflation exceeded expectations and accelerated for a third consecutive release.',
    confidence: 'MODERATE',
  },
  substrate: 'DATA_DOMINANT',
  primarySeries: RW_CPI,
  corridor: null,
  indicators: [RW_CPI, RW_POLICY_RATE, RW_FX, RW_FUEL, RW_TRADE, RW_GDP, RW_FISCAL],
  attention: RW_ATTENTION,
  watch: {
    id: 'w-rw', label: 'Rwanda economy',
    members: [
      { subjectId: 's-rw-cpi', label: 'Inflation', enabled: true },
      { subjectId: 's-rw-rate', label: 'Policy rate', enabled: true },
      { subjectId: 's-rw-fx', label: 'FX conditions', enabled: true },
      { subjectId: 's-rw-gdp', label: 'Growth', enabled: true },
      { subjectId: 's-rw-fiscal', label: 'Fiscal position', enabled: false },
      { subjectId: 's-rw-trade', label: 'Trade', enabled: false },
    ],
    triggers: ['NEW_RELEASE', 'REVISED', 'SIGNIFICANT_CHANGE', 'NEW_EVIDENCE', 'POLICY_RESPONSE'],
  },
  policyLane: RW_POLICY_LANE,
};

/** Corridor-led entry (desktop 05, compact M9): the substrate switches, the frame does not. */
export const CORRIDOR_SUBJECT: EconomySubject = {
  ...RWANDA_SUBJECT,
  id: 'c-mombasa-kigali', kind: 'CORRIDOR', name: 'Mombasa → Kigali',
  scopeLabel: 'Corridor', contextLabel: 'East Africa',
  substrate: 'MAP_DOMINANT',
  corridor: MOMBASA_KIGALI,
  assessment: {
    ...RWANDA_SUBJECT.assessment,
    id: 'as-cor-1', subjectId: 'c-mombasa-kigali',
    statement: 'Corridor cost pressure is transmitting to landed fuel prices, with dwell time the active constraint.',
    model: {
      seriesId: 'c-mombasa-kigali',
      periodId: 'c-mombasa-kigali:AUG 2026',
      observedVintages: ['2026-09-02', '2026-08-26'],
      producedBy: 'fixture:econ-assessment',
      assessedAt: '2026-09-05',
      changeState: 'DEVELOPING',
      priorChangeState: null,
    },
  },
};
