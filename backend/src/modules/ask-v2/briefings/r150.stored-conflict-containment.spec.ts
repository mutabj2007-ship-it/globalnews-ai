import type { AskContribution, AskContributionObservation } from '../../ask-intelligence/ask-contribution.contract';
import { withheldForSourceRights } from '../source-rights-withholding';
import { compareStructured } from './structured-change';
import type { BriefingIntelligence } from './briefing-snapshot';

/*
  CTO R150 / PD-1 — answers and briefing baselines STORED before the R143 containment still hold a Conflict record's
  recorded headline (label, detail.headline, "outlet,date,headline" citation pieces). The stored rows are not
  rewritten; every READ leaves in the contained shape. Synthetic sentinels only.
*/
const SENTINEL = 'SENTINEL-R150 stored recorded headline';

const oldConflict: AskContributionObservation = {
  reference: 'cfl:1:8:UCDP_GED:6:1',
  kind: 'ARMED_CLASH',
  label: SENTINEL,
  value: null,
  unit: null,
  period: '2026-08-31',
  geography: 'COD',
  source: { name: 'UCDP — Uppsala Conflict Data Program', url: 'https://ucdp.uu.se/', licence: null },
  retainedAt: '2026-09-01T00:00:00Z',
  detail: {
    place: 'North Kivu',
    parties: ['Side A', 'Side B'],
    headline: SENTINEL,
    citedOutlets: [`Radio Example,2026-08-31,"${SENTINEL}"`, '@someone on X,2026-08-31,x', 'Wire Two,2026-09-01,Other'],
  },
};
const economy: AskContributionObservation = {
  ...oldConflict,
  reference: 'eco:1:cpi',
  kind: 'SERIES',
  label: 'CPI, year on year',
  detail: undefined,
};
const contribution = (contributorId: string, observations: AskContributionObservation[]): AskContribution =>
  ({ contributorId, status: 'USED', applicability: 'DIRECT', geographyBasis: 'COD', observations }) as unknown as AskContribution;
const intel = (observations: AskContributionObservation[]): BriefingIntelligence => ({
  considered: ['CONFLICT', 'ECONOMY'],
  contributions: [contribution('CONFLICT', observations.filter((o) => o.reference.startsWith('cfl:'))), contribution('ECONOMY', [economy])],
});

describe('CTO R150 / PD-1 · stored Conflict records are read in the contained shape', () => {
  it('stored answer (reopen / Saved / guest / reuse all pass withheldForSourceRights): no recorded headline', () => {
    const stored = { analysis: { answer: 'x', articles: [] }, intelligence: intel([oldConflict]) };
    const out = withheldForSourceRights(stored) as { intelligence: BriefingIntelligence };
    expect(JSON.stringify(out)).not.toContain(SENTINEL);
    const [o] = out.intelligence.contributions[0].observations;
    expect(o.label).toBeNull();
    expect(o.detail?.headline).toBeNull();
    expect(o.detail?.citedOutlets).toEqual(['Radio Example', 'Wire Two']);
    expect(o.detail?.place).toBe('North Kivu');
    expect(o.detail?.parties).toEqual(['Side A', 'Side B']);
    /* control: a non-Conflict record keeps its label; the stored object itself is not mutated */
    expect(out.intelligence.contributions[1].observations[0].label).toBe('CPI, year on year');
    expect(stored.intelligence.contributions[0].observations[0].label).toBe(SENTINEL);
  });

  it('a payload without intelligence passes through unchanged', () => {
    const stored = { analysis: { answer: 'x', articles: [] } };
    expect(withheldForSourceRights(stored)).toEqual(stored);
  });

  it('briefing check: a content change against an OLD baseline is reported without the recorded headline', () => {
    const changed = { ...oldConflict, label: null, period: '2026-09-02', detail: { ...oldConflict.detail!, headline: null } };
    const result = compareStructured(intel([oldConflict]), intel([changed]), '2026-09-01T00:00:00Z');
    expect(result.contentChanged.length).toBe(1);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
    expect(result.contentChanged[0].label).toBeNull();
  });

  it('briefing check: the old baseline and a contained read of the same record are UNCHANGED (R143 kept)', () => {
    const contained = { ...oldConflict, label: null, detail: { ...oldConflict.detail!, headline: null, citedOutlets: ['Radio Example', 'Wire Two'] } };
    const result = compareStructured(intel([oldConflict]), intel([contained]), '2026-09-01T00:00:00Z');
    expect(result.contentChanged).toEqual([]);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });
});
