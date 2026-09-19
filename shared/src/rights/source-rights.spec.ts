/**
 * ════════════════════════════════════════════════════════════════════════════
 * ECON-RIGHTS-BINDING-1 — E4B IS DERIVED, NOT ASSERTED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The four axes are independent, every refusal is reachable, and the evaluator cannot
 * see a transport fact even if a caller wanted it to. The last of those is asserted
 * structurally, because "do not infer rights from successful HTTP access" is only a rule
 * if nothing is able to break it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  GRADES_PERMITTING_ACTIVATION,
  RIGHTS_REFUSAL_CODES,
  SOURCE_LIFECYCLE_AXES,
  evaluateSourceRights,
  type SourceActivationEvidence,
  type SourceRightsRecord,
} from './source-rights';

const EUROSTAT_RECORD: SourceRightsRecord = {
  rightsRecordKey: 'EUROSTAT',
  rightsClass: 'E-5',
  instrument:
    'Commission Decision 2011/833/EU on the reuse of Commission documents, as applied by ' +
    'the Eurostat copyright/licence policy notice. Recorded in G-ECONOMY-RIGHTS-TRANSPORT-R7.',
  productConditions: [],
  publisherRetainsHistory: false,
};

const FULLY_PROVEN: SourceActivationEvidence = {
  sourceId: 'eurostat',
  registered: true,
  binding: { rightsAuthorityId: 'ECONOMY_ACQUISITION_RIGHTS', rightsRecordKey: 'EUROSTAT' },
  resolvedRecord: EUROSTAT_RECORD,
  enabled: true,
  ingestionMethod: 'api',
};

describe('the fully-bound case, so every failure below is a real difference', () => {
  it('all four axes hold and there are no refusals', () => {
    const v = evaluateSourceRights(FULLY_PROVEN);
    expect(v.refusals).toEqual([]);
    expect([...v.axesSatisfied].sort()).toEqual([...SOURCE_LIFECYCLE_AXES].sort());
    expect(v.activatedWithRights).toBe(true);
  });
});

describe('each axis fails ALONE, and each failure blocks E4B', () => {
  const cases: ReadonlyArray<readonly [string, SourceActivationEvidence, string]> = [
    ['not registered', { ...FULLY_PROVEN, registered: false }, 'RIGHTS-NOT-REGISTERED'],
    ['no binding', { ...FULLY_PROVEN, binding: null }, 'RIGHTS-NO-BINDING'],
    ['record unresolved', { ...FULLY_PROVEN, resolvedRecord: null }, 'RIGHTS-RECORD-UNRESOLVED'],
    ['not enabled', { ...FULLY_PROVEN, enabled: false }, 'RIGHTS-NOT-ENABLED'],
    ['no ingestion method', { ...FULLY_PROVEN, ingestionMethod: 'none' }, 'RIGHTS-NO-INGESTION-METHOD'],
    [
      'empty instrument even at E-5',
      { ...FULLY_PROVEN, resolvedRecord: { ...EUROSTAT_RECORD, instrument: '' } },
      'RIGHTS-NO-INSTRUMENT',
    ],
    [
      'non-permitting grade even with a full instrument',
      { ...FULLY_PROVEN, resolvedRecord: { ...EUROSTAT_RECORD, rightsClass: 'E-4' } },
      'RIGHTS-GRADE-NOT-PERMITTING',
    ],
    [
      'record resolved under a DIFFERENT key',
      { ...FULLY_PROVEN, resolvedRecord: { ...EUROSTAT_RECORD, rightsRecordKey: 'SOMETHING_ELSE' } },
      'RIGHTS-RECORD-UNRESOLVED',
    ],
  ];

  it.each(cases)('%s → E4B false, and names %s', (_label, evidence, code) => {
    const v = evaluateSourceRights(evidence);
    expect(v.activatedWithRights).toBe(false);
    expect(v.refusals).toContain(code);
  });

  it('enabled:true with NO binding is still false — enabling is not permission', () => {
    const v = evaluateSourceRights({ ...FULLY_PROVEN, binding: null, resolvedRecord: null });
    expect(v.activatedWithRights).toBe(false);
    expect(v.refusals).toContain('RIGHTS-NO-BINDING');
  });

  it('E-1 … E-4 all refuse, so only the permitting set activates', () => {
    for (const grade of ['E-1', 'E-2a', 'E-2b', 'E-3', 'E-4'] as const) {
      const v = evaluateSourceRights({
        ...FULLY_PROVEN,
        resolvedRecord: { ...EUROSTAT_RECORD, rightsClass: grade },
      });
      expect(`${grade}: ${v.activatedWithRights}`).toBe(`${grade}: false`);
    }
    expect([...GRADES_PERMITTING_ACTIVATION]).toEqual(['E-5']);
  });
});

describe('every declared refusal code is reachable', () => {
  it('no code is decorative', () => {
    const seen = new Set<string>();
    const shapes: SourceActivationEvidence[] = [
      { ...FULLY_PROVEN, registered: false },
      { ...FULLY_PROVEN, binding: null },
      { ...FULLY_PROVEN, resolvedRecord: null },
      { ...FULLY_PROVEN, resolvedRecord: { ...EUROSTAT_RECORD, instrument: '' } },
      { ...FULLY_PROVEN, resolvedRecord: { ...EUROSTAT_RECORD, rightsClass: 'E-4' } },
      { ...FULLY_PROVEN, enabled: false },
      { ...FULLY_PROVEN, ingestionMethod: 'none' },
    ];
    for (const s of shapes) for (const r of evaluateSourceRights(s).refusals) seen.add(r);
    expect([...RIGHTS_REFUSAL_CODES].filter((c) => !seen.has(c))).toEqual([]);
  });

  it('a source failing everything reports EVERY blocker at once, not just the first', () => {
    const v = evaluateSourceRights({
      sourceId: 'x', registered: false, binding: null, resolvedRecord: null,
      enabled: false, ingestionMethod: 'none',
    });
    expect(v.refusals.length).toBeGreaterThanOrEqual(4);
    expect(v.axesSatisfied).toEqual([]);
  });
});

describe('THE STRUCTURAL GUARANTEE — the evaluator cannot see a fetch', () => {
  it('SourceActivationEvidence carries no transport field', () => {
    const src = readFileSync(join(__dirname, 'source-rights.ts'), 'utf-8');
    const iface = src.slice(src.indexOf('interface SourceActivationEvidence'));
    const body = iface.slice(0, iface.indexOf('\n}'));
    const forbidden = [
      'httpStatus', 'response', 'lastFetchSucceeded', 'reachable', 'statusCode',
      'fetched', 'transport', 'lastSeenAt', 'responseBytes',
    ];
    expect(forbidden.filter((f) => new RegExp(`\\b${f}\\b`).test(body))).toEqual([]);
  });

  it('POSITIVE CONTROL · the scan can find a field that IS there', () => {
    const src = readFileSync(join(__dirname, 'source-rights.ts'), 'utf-8');
    const iface = src.slice(src.indexOf('interface SourceActivationEvidence'));
    const body = iface.slice(0, iface.indexOf('\n}'));
    for (const present of ['sourceId', 'registered', 'binding', 'resolvedRecord', 'enabled']) {
      expect(`${present}: ${new RegExp(`\\b${present}\\b`).test(body)}`).toBe(`${present}: true`);
    }
  });

  it('rights approval does not imply transport success — the implication is UNSTATABLE', () => {
    /*
      There is no field to express "this fetch worked", so there is no branch the evaluator
      could take on it and none that could be added without widening the type in public.
      A fully-proven source says nothing at all about whether a request would succeed.
    */
    expect(evaluateSourceRights(FULLY_PROVEN).activatedWithRights).toBe(true);
  });

  it('transport success does not imply rights approval — a real capture proves nothing here', () => {
    /* The four Eurostat captures returned HTTP 200 and were admitted and retained. A
       source with no rights record is still refused, and that refusal is correct. */
    const noRecord = { ...FULLY_PROVEN, resolvedRecord: null };
    expect(evaluateSourceRights(noRecord).activatedWithRights).toBe(false);
  });
});
