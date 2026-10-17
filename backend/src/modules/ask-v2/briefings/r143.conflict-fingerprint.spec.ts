import type { AskContributionObservation } from '../../ask-intelligence/ask-contribution.contract';
import { structuredFingerprint } from './structured-change';

/*
  R143 / E1-CONF-1 — a Conflict record no longer carries the recorded source headline and cites
  outlet NAMES only. Saved briefing baselines still hold the earlier shape. Withholding those fields
  is not a change in the record: the fingerprint of the old and the new shape must be equal.
  Synthetic strings; no real headline is copied here.
*/
const before: AskContributionObservation = {
  reference: 'cfl:1:8:UCDP_GED:6:1',
  kind: 'ARMED_CLASH',
  label: 'Synthetic recorded headline',
  value: null,
  unit: null,
  period: '2026-08-31',
  geography: 'COD',
  source: { name: 'UCDP — Uppsala Conflict Data Program', url: 'https://ucdp.uu.se/', licence: null },
  retainedAt: '2026-09-01T00:00:00Z',
  detail: {
    place: 'North Kivu',
    parties: ['Side A', 'Side B'],
    headline: 'Synthetic recorded headline',
    citedOutlets: ['Radio Example,2026-08-31,"Synthetic recorded headline"', 'Wire Two,2026-09-01,Other'],
  },
};
const after: AskContributionObservation = {
  ...before,
  label: null,
  source: { ...before.source, licence: 'CC BY 4.0' },
  detail: { ...before.detail!, headline: null, citedOutlets: ['Radio Example', 'Wire Two'] },
};

describe('R143 · briefing fingerprint across the Conflict headline containment', () => {
  it('a saved baseline (headline shape) and a new read (names only) fingerprint EQUAL', () => {
    expect(structuredFingerprint(after)).toBe(structuredFingerprint(before));
  });
  it('a real content change in a Conflict record still changes the fingerprint', () => {
    expect(structuredFingerprint({ ...after, period: '2026-09-01' })).not.toBe(structuredFingerprint(before));
    expect(structuredFingerprint({ ...after, detail: { ...after.detail!, parties: ['Side C'] } })).not.toBe(
      structuredFingerprint(before),
    );
    expect(structuredFingerprint({ ...after, detail: { ...after.detail!, citedOutlets: ['Other Outlet'] } })).not.toBe(
      structuredFingerprint(before),
    );
  });
  it('control: non-Conflict records keep their label in the fingerprint', () => {
    const cpi = { ...before, reference: 'eco:1:cpi', label: 'CPI, year on year' };
    expect(structuredFingerprint({ ...cpi, label: 'CPI, month on month' })).not.toBe(structuredFingerprint(cpi));
  });
});
