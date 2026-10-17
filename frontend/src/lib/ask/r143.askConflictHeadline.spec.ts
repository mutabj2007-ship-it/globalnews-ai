import type { AskContribution, AskContributionObservation, AskR2Payload } from '@/lib/api/askV2Api';
import { askIntelligenceStrings, askIntelligenceView, citedOutletNames } from './askIntelligenceView';

/*
  R143 · Ask answers built on retained UCDP conflict records. UCDP stores the reporting outlet's
  headline (detail.headline) and its "outlet,date,headline" citation pieces (detail.citedOutlets).
  UCDP's CC BY 4.0 does not license that publisher expression (E1 R135 addendum 02), so the reader
  sees the event type and the outlet NAMES only. Synthetic strings; no real headline is copied here.
*/
const HEADLINE = 'Synthetic recorded headline about an attack';
const obs = (over: Partial<AskContributionObservation['detail']> = {}): AskContributionObservation => ({
  reference: 'cfl:1:8:UCDP_GED:6:1',
  kind: 'ARMED_CLASH',
  label: HEADLINE,
  value: null,
  unit: null,
  period: '2026-08-31',
  geography: 'COD',
  source: { name: 'UCDP — Uppsala Conflict Data Program', url: 'https://ucdp.uu.se/', licence: null },
  retainedAt: '2026-09-01T00:00:00Z',
  detail: {
    place: 'North Kivu',
    parties: ['Side A', 'Side B'],
    headline: HEADLINE,
    citedOutlets: [`Radio Example,2026-08-31,"${HEADLINE}"`, 'Wire Two,2026-09-01,Second headline text', '@someone on X'],
    ...over,
  },
});
const payload = (o: AskContributionObservation): AskR2Payload =>
  ({
    intelligence: {
      considered: ['CONFLICT'],
      contributions: [
        { contributorId: 'CONFLICT', status: 'USED', applicability: 'REQUIRED', temporalBasis: 'RETAINED_RECORD', observations: [o], disclosures: [] } as unknown as AskContribution,
      ],
    },
  }) as unknown as AskR2Payload;

describe('R143 · Ask conflict rows never show the recorded publisher headline', () => {
  for (const locale of ['en', 'pl'] as const) {
    it(`${locale}: the row reads the event type and outlet names; no headline in label or cited`, () => {
      const view = askIntelligenceView(payload(obs()), askIntelligenceStrings(locale), 1);
      const row = view?.sections[0]?.rows[0];
      expect(row).toBeDefined();
      expect(row!.label).toBe(askIntelligenceStrings(locale).eventKind.ARMED_CLASH ?? 'ARMED_CLASH');
      expect(row!.cited).toBe('Radio Example · Wire Two');
      expect(JSON.stringify(view)).not.toContain('headline');
      expect(JSON.stringify(view)).not.toContain('attack');
    });
  }
  it('outlet names: first field only, de-duplicated, handles dropped, null when nothing is left', () => {
    expect(citedOutletNames(['A,2026-01-01,x', 'A,2026-01-02,y', 'B'])).toBe('A · B');
    expect(citedOutletNames(['@handle', 'Someone on X,2026'])).toBeNull();
    expect(citedOutletNames([])).toBeNull();
  });
  it('control: a non-conflict contributor keeps its own application label', () => {
    const o = { ...obs(), label: 'Rwanda headline CPI, year on year', kind: 'CPI' };
    const p = payload(o) as unknown as { intelligence: { contributions: { contributorId: string }[] } };
    p.intelligence.contributions[0].contributorId = 'ECONOMY_CPI';
    const view = askIntelligenceView(p as unknown as AskR2Payload, askIntelligenceStrings('en'), 1);
    expect(view?.sections[0]?.rows[0]?.label).toBe('Rwanda headline CPI, year on year');
  });
});
