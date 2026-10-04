import type { AskContribution, AskR2Payload } from '@/lib/api/askV2Api';
import { askIntelligenceView } from './askIntelligenceView';

/*
  SHARED-ASK-DISCLOSURE-PROPAGATION-R1 (reader side) — a contribution read from a retained official
  record reaches the reader through the SHARED "Based on" projection as: retained, not current, its own
  date, and (where applicable) no recent admitted record. No contributor-specific rendering: the time
  basis and contributor name come from the shared catalogue.
*/
const QUOTE = 'Synthetic record A: the bill was signed.';
const politics = (disclosures: string[]): AskContribution =>
  ({
    contributorId: 'POLITICS',
    domain: 'political',
    status: 'USED',
    applicability: 'SUPPLEMENTARY',
    temporalBasis: 'RETAINED_OFFICIAL_RECORD',
    geographyBasis: 'POL',
    disclosures,
    degradationReason: null,
    observations: [
      {
        reference: 'k1',
        kind: 'LEGISLATIVE_STAGE:SIGNED',
        label: 'Synthetic bill A',
        value: null,
        unit: null,
        period: '2026-09-18',
        geography: 'POL',
        source: { name: 'Synthetic legislature', url: 'https://example.org/a', licence: null },
        retainedAt: '2026-10-02T12:01:00Z',
      },
    ],
  }) as unknown as AskContribution;
const payload = (c: AskContribution): AskR2Payload =>
  ({ schema: 'ask-r2-result/1', intelligence: { considered: [c.contributorId], contributions: [c] } }) as unknown as AskR2Payload;

describe('askIntelligenceView — a retained official record, read through the shared projection', () => {
  it.each(['en', 'pl'] as const)('%s: retained + not current + own date + no-recent caveat', (locale) => {
    const view = askIntelligenceView(payload(politics(['RETAINED_NOT_CURRENT', 'NO_RECENT_RETAINED_RECORD'])), locale, 0)!;
    const section = view.sections[0]!;
    expect(section.title).not.toBe('POLITICS'); // catalogue name, never the raw id
    expect(section.note).toMatch(locale === 'en' ? /Retained official records.*not current/ : /Zachowane rekordy oficjalne.*nie są bieżące/);
    expect(section.caveats.join(' ')).toMatch(locale === 'en' ? /No retained record from the last 7 days/ : /Brak zachowanego rekordu z ostatnich 7 dni/);
    expect(section.rows[0]!.period).toBe('2026-09-18'); // the record's own date, not the retrieval time
    expect(JSON.stringify(view)).not.toContain('2026-10-02');
    expect(JSON.stringify(view)).not.toContain(QUOTE); // the verbatim quotation never reaches a reader
  });

  it('a recent record carries no no-recent caveat, but is still marked retained and not current', () => {
    const section = askIntelligenceView(payload(politics(['RETAINED_NOT_CURRENT'])), 'en', 0)!.sections[0]!;
    expect(section.caveats).toEqual([]);
    expect(section.note).toMatch(/not current/);
  });
});
