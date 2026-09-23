import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ElectionPreviewScreen } from '@/components/election/ElectionPreviewScreen';
import { bindElection } from './electionBinding';
import type { ElectionReadResponse, ElectionRecord } from '@/lib/election/electionRead';

const raw = JSON.parse(readFileSync(resolve(__dirname, '../../../../backend/src/modules/election/data/6de1471074dc8162b038b949c0283fca029dea571a6ef6ee0564b89371cbe5fd.json'), 'utf8')).records[0];
const record = (locale: 'en' | 'pl'): ElectionRecord => ({ ...raw,
  label: locale === 'en' ? 'OFFICIAL DECLARATION' : 'OFICJALNE OGŁOSZENIE',
  qualifiedReading: (locale === 'en' ? 'OFFICIAL DECLARATION' : 'OFICJALNE OGŁOSZENIE') + ' · ' + raw.votesAsPublished,
});
const response = (records: ElectionRecord[], locale: 'en' | 'pl' = 'en'): ElectionReadResponse =>
  ({ domain: 'ELECTION', state: 'EVIDENCE', locale, records });
describe('Plan B retained declaration in accepted list', () => {
  it.each(['en', 'pl'] as const)('binds the actual retained declaration with provenance in %s', locale => {
    const binding = bindElection({ status: 'READ', data: response([record(locale)], locale) });
    expect(binding.list.rows).toEqual([{ id: raw.id, label: raw.declaredPerson.ballotName }]);
    expect(binding.list.orderReason).toBe('LEXICAL');
    for (const compact of [false, true]) {
      const html = renderToStaticMarkup(createElement(ElectionPreviewScreen, { locale, compact, binding }));
      for (const value of [raw.declaredPerson.ballotName, raw.declaredPerson.partyAsPublished, '35,440', raw.capturedAt, raw.declaredAt, raw.election.eventId, raw.source.url, raw.citation.locator, 'Ol Kalou', record(locale).label]) expect(html).toContain(value);
      expect(html.match(/data-eln="contestant"/g)).toHaveLength(1);
      expect(html.match(/data-eln="region"/g)).toHaveLength(4);
      expect(html).not.toMatch(/FINAL_CERTIFIED|NATIONAL RESULT|Placeholder contestant|data-eln="chip"|aria-busy="true"/);
    }
  });
  it.each(['READER_DISABLED', 'VALIDATION_FAILED', 'NO_CURRENT_RECORDS'] as const)('renders absence without people or fake values for %s', reason => {
    const binding = bindElection({ status: 'READ', data: { ...response([]), state: 'COVERAGE_GAP', reason } });
    expect(binding.list.rows).toEqual([]);
    const html = renderToStaticMarkup(createElement(ElectionPreviewScreen, { locale: 'en', compact: true, binding }));
    expect(html).not.toMatch(/Waweru|35,440|Placeholder contestant|data-eln="contestant"|data-eln-treatment="VALUE"/);
    expect(html).toContain('data-eln-treatment="ABSENCE"');
  });
  it('keeps unavailable distinct from empty and refuses promotion of other evidence states', () => {
    expect(bindElection({ status: 'UNAVAILABLE' }).state).toBe('UNAVAILABLE');
    for (const kind of ['FORM_AVAILABLE', 'FORM_REPORTED', 'TALLY_OBSERVATION'] as const) {
      const binding = bindElection({ status: 'READ', data: response([{ ...record('en'), kind }]) });
      expect(binding.state).toBe('WITHHELD');
      expect(binding.list.rows).toEqual([]);
      expect(binding.withheldKinds).toEqual([kind]);
    }
  });
  it('orders by label alone, independent of vote reading and input sequence', () => {
    const a = { ...record('en'), id: 'a', declaredPerson: { ballotName: 'A', partyAsPublished: null }, qualifiedReading: 'OFFICIAL DECLARATION · 1' };
    const z = { ...record('en'), id: 'z', declaredPerson: { ballotName: 'Z', partyAsPublished: null }, qualifiedReading: 'OFFICIAL DECLARATION · 999' };
    expect(bindElection({ status: 'READ', data: response([z, a]) }).list.rows.map(r => r.id)).toEqual(['a', 'z']);
  });
});
