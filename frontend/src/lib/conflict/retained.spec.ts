import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  conflictEventKey,
  validateConflictObservation,
  type ConflictObservation,
} from '@globalnews-ai/shared';
import { reviewedObservations, observationMapRecord, sourceHref } from './retained';
import { ConflictAssessmentRail } from '@/components/map/conflict/ConflictAssessmentRail';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { conflictStrings } from './strings';
const fixture = (): ConflictObservation =>
  JSON.parse(
    readFileSync(join(process.cwd(), '../scripts/tests/conflict-observation.fixture.json'), 'utf8'),
  );
const changed = (id: string, date: string) => {
  const o = fixture();
  return {
    ...o,
    observationKey: conflictEventKey({ ...o.identity, upstreamEventId: id }),
    identity: { ...o.identity, upstreamEventId: id },
    temporal: { ...o.temporal, eventStartedAt: date },
  };
};
describe('Plan B retained Conflict read boundary', () => {
  it('validates the TEST ONLY fixture with the persistence validator', () => {
    expect(validateConflictObservation(fixture()).owner).toBe('CONFLICT');
  });
  it('empty input means no reviewed records, not no conflicts', () => {
    expect(reviewedObservations([])).toEqual([]);
    for (const lang of ['en', 'pl'] as const)
      expect(conflictStrings[lang].empty).not.toMatch(
        /0 conflicts|nothing happened|nic się nie wydarzyło/i,
      );
  });
  it('withholds unadmitted captures and other owners', () => {
    const o = fixture();
    expect(
      reviewedObservations([
        {
          ...o,
          acquisition: { ...o.acquisition, snapshotRetrievalId: null, snapshotAdmissibility: null },
        },
        { ...o, owner: 'SECURITY' },
      ]),
    ).toEqual([]);
  });
  it('fails the entire response closed for malformed data', () => {
    expect(() => reviewedObservations([fixture(), {}])).toThrow();
    expect(() => reviewedObservations({})).toThrow();
  });
  it('orders only by event time descending and lexical key at ties', () => {
    const a = changed('A', '2026-09-20'),
      b = changed('B', '2026-09-20'),
      c = changed('C', '2026-09-21');
    expect(reviewedObservations([b, a, c]).map((o) => o.identity.upstreamEventId)).toEqual([
      'C',
      'A',
      'B',
    ]);
    expect(reviewedObservations([b, a, c]).every((o) => !('attentionRank' in o))).toBe(true);
  });
  it('latest revision wins; retraction remains readable without an active marker', () => {
    const o = fixture();
    const revision = {
      ...o,
      revision: {
        revisionOrdinal: 1,
        supersedesRevisionOrdinal: 0,
        revisionKind: 'RETRACTION' as const,
        recordedAt: '2026-09-23T00:00:00Z',
      },
    };
    const held = reviewedObservations([revision, o]);
    expect(held).toEqual([revision]);
    expect(observationMapRecord(held[0])).toBeNull();
  });
  it('preserves point, precision and provenance without upgrading coarse evidence', () => {
    const o = fixture();
    const record = observationMapRecord(o)!;
    expect(record.geography.point).toEqual([29, -1]);
    expect(record.precision).toBe('EXACT');
    expect(record.provenance).toBe('STATED');
    expect(
      observationMapRecord({ ...o, geography: { ...o.geography, precision: 'COUNTRY' } }),
    ).toBeNull();
    expect(
      observationMapRecord({
        ...o,
        geography: { ...o.geography, denotation: 'SOURCE_REPORTED_CENTROID' },
      }),
    ).toBeNull();
  });
  it('never collapses polygon, bbox or line to a point', () => {
    for (const geometryKind of ['POLYGON', 'BBOX', 'LINE'] as const) {
      const o = fixture();
      expect(
        observationMapRecord({ ...o, geography: { ...o.geography, geometryKind } }),
      ).toBeNull();
    }
  });
  it('never links citation prose or executable URLs', () => {
    expect(sourceHref('Radio, 2026-09-20')).toBeNull();
    expect(sourceHref('javascript:alert(1)')).toBeNull();
    expect(sourceHref('https://example.invalid/source')).toBe('https://example.invalid/source');
  });
  for (const lang of ['en', 'pl'] as const)
    it('renders recovered selection/evidence slots in ' + lang, () => {
      const labels = getDictionary(lang).map.spatial.conflict;
      const html = renderToStaticMarkup(
        createElement(ConflictAssessmentRail, {
          subjectLabel: 'TEST ONLY observation',
          severity: 'HIGH',
          changeStateLabel: null,
          assessment: null,
          confidenceLabel: null,
          geographyLabel: null,
          participants: [],
          indicators: null,
          readings: null,
          evidenceLine: 'TEST ONLY citation',
          evidenceDetails: createElement('time', null, '2026-09-20'),
          region: null,
          nowMs: 0,
          labels: { ...labels, roleLabels: labels.roles },
        }),
      );
      expect(html).toContain('data-gn="conflict-evidence"');
      expect(html).toContain('2026-09-20');
      expect(html).toContain(labels.noService);
      expect(html).toContain('data-gn-severity-rung="HIGH"');
      expect(html).not.toContain('conflict-change');
    });
});
