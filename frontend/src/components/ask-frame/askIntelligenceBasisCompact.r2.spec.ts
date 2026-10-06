import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AskContributionObservation, AskR2Payload } from '@/lib/api/askV2Api';
import { AskIntelligenceBasis } from './AskIntelligenceBasis';

/**
 * ASK RETRIEVAL / CONVERSATION R2 — retained background is compact on a phone (contract §9, B).
 *
 * Alpha 2026-10-06 06:57 Warsaw: a Rwanda–DR Congo relations answer drew five August UCDP rows
 * inline, each repeating "UCDP — Uppsala Conflict Data Program", with party strings and long
 * concatenated outlet lists, and its "retained, not current" limitation only after them.
 */
const row = (n: number, outlets: string[]): AskContributionObservation => ({
  reference: `ucdp:ged:${1000 + n}`,
  kind: 'STATE_BASED',
  label: null,
  value: null,
  unit: null,
  period: `2026-08-${String(10 + n).padStart(2, '0')}`,
  geography: 'COD',
  source: { name: 'UCDP — Uppsala Conflict Data Program', url: 'https://ucdp.uu.se/', licence: null },
  retainedAt: '2026-09-01T00:00:00Z',
  detail: { place: 'North Kivu', parties: ['Government of DR Congo', 'M23'], headline: `Clash ${n}`, citedOutlets: outlets },
});

const payload = {
  intelligence: {
    considered: ['CONFLICT'],
    contributions: [
      {
        contributorId: 'CONFLICT',
        domain: 'SECURITY',
        status: 'USED',
        applicability: 'SUPPLEMENTARY',
        observations: [1, 2, 3, 4, 5].map((n) => row(n, ['Radio Okapi', 'Reuters', 'AFP', 'Actualite.cd', 'BBC'])),
        temporalBasis: 'RETAINED_EVENT_RECORD',
        geographyBasis: 'COD',
        disclosures: ['SEVERITY_NOT_ASSESSED', 'NO_RECENT_RETAINED_RECORD'],
        degradationReason: null,
      },
    ],
  },
} as unknown as AskR2Payload;

const html = renderToStaticMarkup(
  createElement(AskIntelligenceBasis, { payload, locale: 'en', reportingSourceCount: 0 }),
);

describe('ASK R2 · retained records are dated background, compact and expandable', () => {
  it('the records sit in a collapsed <details> with a count + period summary', () => {
    expect(html).toMatch(/<details data-ask="intelligence-records"[^>]*>/);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toContain('5 · 2026-08-11 – 2026-08-15');
  });

  it('the limitation (not current / no recent record) comes BEFORE the records', () => {
    const records = html.indexOf('data-ask="intelligence-records"');
    const caveats = [...html.matchAll(/font-mono text-\[11px\] text-\[#8fa6c0\]">([^<]+)</g)].map((m) => m.index ?? 0);
    expect(caveats.length).toBeGreaterThan(0);
    expect(Math.min(...caveats)).toBeLessThan(records);
  });

  it('one shared source is linked ONCE, not on every row', () => {
    expect(html.match(/UCDP — Uppsala Conflict Data Program/g)).toHaveLength(1);
  });

  it('cited outlets are capped (first three, then +N)', () => {
    expect(html).toContain('Radio Okapi · Reuters · AFP +2');
    expect(html).not.toContain('Actualite.cd · BBC');
  });
});
