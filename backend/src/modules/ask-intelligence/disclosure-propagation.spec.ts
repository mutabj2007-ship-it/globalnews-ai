import type { AskContribution, AskContributorSelection } from './ask-contribution.contract';
import type { AskContributionSet } from './ask-specialist-read.coordinator';
import { governedPrompt } from './governed-answer';

/*
  SHARED-ASK-DISCLOSURE-PROPAGATION-R1 — what a contribution says about time and availability must
  survive to the ONE model call. Contributor-neutral: nothing here renders a domain-specific disclosure.
  CTO ruling: a retained record must never appear current because Ask retrieved it today.
*/
const sel = (contributorId: AskContribution['contributorId']): AskContributorSelection => ({
  contributorId, domain: 'x', applicability: 'SUPPLEMENTARY', scope: { countryIso3: 'POL', district: null, place: null },
});
const contribution = (over: Partial<AskContribution> & Pick<AskContribution, 'contributorId' | 'status'>): AskContribution => ({
  domain: 'x', applicability: 'SUPPLEMENTARY', observations: [], temporalBasis: 'NONE', geographyBasis: 'POL',
  disclosures: [], degradationReason: null, ...over,
});
const set = (...cs: AskContribution[]): AskContributionSet => ({ considered: cs.map((c) => sel(c.contributorId)), contributions: cs });

const politicsRecord = {
  reference: 'k1', kind: 'LEGISLATIVE_STAGE:SIGNED', label: 'Synthetic bill A', value: null, unit: null,
  period: '2026-09-18', geography: 'POL', source: { name: 'Synthetic legislature', url: 'https://example.org/a', licence: null },
  retainedAt: '2026-10-02T12:01:00Z',
  provenance: {
    sourceType: 'OFFICIAL_SOURCE', evidenceRole: 'PRIMARY_RECORD', effectiveAt: '2026-09-18T10:00:00Z', temporalBasis: 'OCCURRENCE',
    publishedAt: '2026-09-18T12:00:00Z', sourceUpdatedAt: null, revisionOrdinal: 1, artifactSha256: 'a'.repeat(64), language: 'pl',
  },
};

describe('SHARED-ASK-DISCLOSURE-PROPAGATION-R1', () => {
  it('a retained official record reaches the prompt with its OWN date, never the retrieval time', () => {
    const g = governedPrompt(set(contribution({
      contributorId: 'POLITICS', status: 'USED', temporalBasis: 'RETAINED_OFFICIAL_RECORD', observations: [politicsRecord],
      disclosures: ['RETAINED_NOT_CURRENT', 'NO_RECENT_RETAINED_RECORD'],
    })));
    expect(g.rules).toMatch(/retained, not current/);
    expect(g.rules).toMatch(/the day it was retrieved is not the day it happened/);
    expect(g.rules).toMatch(/more than a week old/);
    // Source-derived dates stay in the delimited DATA, never in the trusted rules (injection safety).
    expect(g.rules).not.toContain('2026-09-18');
    expect(g.data).toContain('"newestPeriod": "2026-09-18"');
    expect(g.rules).toMatch(/no newer admitted record was found/);
    expect(g.data).toContain('"period": "2026-09-18"');
    expect(g.data).toContain('"dateBasis": "OCCURRENCE"');
    expect(g.data).toContain('"officialPrimaryRecord": true');
    expect(g.data).not.toContain('2026-10-02'); // retrieval/retention time never reaches the model
    expect(g.data).not.toContain('a'.repeat(64)); // the artifact hash is a citation anchor, not model data
  });

  it('degraded, refused, no-match and not-assessed states each reach the prompt', () => {
    const g = governedPrompt(set(
      contribution({ contributorId: 'POLITICS', status: 'DEGRADED', degradationReason: 'TIMEOUT' }),
      contribution({ contributorId: 'IMIHIGO', status: 'REFUSED', disclosures: ['RETAINED_ARTIFACT_NOT_DISPLAYABLE'] }),
      contribution({ contributorId: 'CONFLICT', status: 'NO_MATCH' }),
      contribution({ contributorId: 'HUMANITARIAN', status: 'NOT_ASSESSED', disclosures: ['HUMANITARIAN_NOT_ASSESSED'] }),
    ));
    expect(g.rules).toMatch(/Retained official Politics records could not be read for this answer/);
    expect(g.rules).toMatch(/Retained NISR Imihigo evaluation could not be read/);
    expect(g.rules).toMatch(/cannot be read under its governed rules/);
    expect(g.rules).toMatch(/found no governed record for this scope: that is not evidence that nothing happened/);
    expect(g.rules).toMatch(/Humanitarian Intelligence was not assessed/);
  });

  it('a contributor without the provenance block keeps exactly its previous record fields (byte-stable data)', () => {
    const g = governedPrompt(set(contribution({
      contributorId: 'CONFLICT', status: 'USED', temporalBasis: 'RETAINED_EVENT_RECORD',
      observations: [{ ...politicsRecord, provenance: undefined, kind: 'ARMED_CLASH' }], disclosures: ['RETAINED_NOT_CURRENT'],
    })));
    const record = JSON.parse(g.data.split('\n').slice(1, -1).join('\n'))[0].records[0];
    expect(Object.keys(record).sort()).toEqual(['kind', 'label', 'parties', 'period', 'place', 'unit', 'value']);
  });

  it('nothing considered → the prompt is unchanged (empty)', () => {
    expect(governedPrompt({ considered: [], contributions: [] })).toEqual({ rules: '', data: '' });
  });
});
