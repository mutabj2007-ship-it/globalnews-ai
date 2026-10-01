import {
  HUMANITARIAN_EVENT_STATUSES,
  HUMANITARIAN_HAZARD_TYPES,
  HUMANITARIAN_IMPACT_MEASURES,
  HUMANITARIAN_OBSERVATION_KINDS,
  HUMANITARIAN_STATUS_MEASURES,
  IMPACT_ASSERTION_BASES,
} from '@globalnews-ai/shared';
import { humanitarianEn } from './humanitarianEn';
import { humanitarianPl } from './humanitarianPl';

/**
 * HUMANITARIAN DATA R1 CONVERGENCE — L's dictionaries label exactly Main's canonical vocabularies:
 * every member, nothing extra, in both languages; source strings are never labelled.
 */
const VOCABS = {
  observationKind: HUMANITARIAN_OBSERVATION_KINDS,
  hazardType: HUMANITARIAN_HAZARD_TYPES,
  eventStatus: HUMANITARIAN_EVENT_STATUSES,
  impactMeasure: HUMANITARIAN_IMPACT_MEASURES,
  statusMeasure: HUMANITARIAN_STATUS_MEASURES,
  impactBasis: IMPACT_ASSERTION_BASES,
} as const;

describe('Main vocabulary ↔ L labels', () => {
  for (const [name, members] of Object.entries(VOCABS)) {
    it.each([
      ['en', humanitarianEn],
      ['pl', humanitarianPl],
    ] as const)(`${name}: %s labels exactly Main's members, none empty`, (_l, dict) => {
      const labels = dict.vocabulary[name as keyof typeof VOCABS] as Record<string, string>;
      expect(Object.keys(labels).sort()).toEqual([...members].sort());
      for (const label of Object.values(labels)) expect(label.trim()).not.toBe('');
    });
  }

  it('Polish is a translation, not a copy of English', () => {
    const en = JSON.stringify(humanitarianEn.vocabulary.hazardType);
    expect(JSON.stringify(humanitarianPl.vocabulary.hazardType)).not.toBe(en);
  });

  it('no label exists for source-verbatim fields (they render as the source wrote them)', () => {
    for (const dict of [humanitarianEn, humanitarianPl]) {
      expect(Object.keys(dict.vocabulary)).not.toEqual(
        expect.arrayContaining(['sourceSeverityStated', 'sourceNativeType', 'sourceFormat']),
      );
    }
  });

  it('the "not stated" status says the SOURCE did not state it (absence is never a value)', () => {
    expect(humanitarianEn.vocabulary.eventStatus.NOT_STATED).toMatch(/source/i);
    expect(humanitarianPl.vocabulary.eventStatus.NOT_STATED).toMatch(/źródło/i);
  });
});
