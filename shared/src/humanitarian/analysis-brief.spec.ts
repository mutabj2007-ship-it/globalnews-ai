import { readFileSync } from 'fs';
import { join } from 'path';
import {
  BRIEF_MAX_FIGURES,
  BRIEF_MAX_RECORDS,
  HumanitarianBriefRefused,
  assertBriefIsWellFormed,
  projectHumanitarianBrief,
} from './analysis-brief';
import { projectHumanitarianWorkspace, projectWorkspaceFromRead } from './analysis-workspace';
import {
  humanitarianReadAbsence,
  humanitarianRetainedRead,
  type HumanitarianRetainedRecord,
} from './retained-read';
import {
  hazardFromSourceCode,
  humanitarianIdentity,
  impactAuthorship,
  type HumanitarianClaim,
  type HumanitarianObservation,
} from './observation';
import { domainObservationKey } from '../observation/domain-observation';

const AT = '2026-10-02T00:00:00.000Z';
const admitAll = (): boolean => true;

function humRecord(
  authority: string,
  upstreamId: string,
  claim: HumanitarianClaim,
  retrievedAt = '2026-09-21T00:00:00.000Z',
): HumanitarianRetainedRecord {
  const identity = humanitarianIdentity(authority, upstreamId);
  const observation: HumanitarianObservation = {
    observationKey: domainObservationKey(identity),
    identity,
    observationKind: claim.claimType,
    subjectType: 'SOURCE_EVENT',
    subjectId: upstreamId,
    claim,
    temporal: {
      publisherVintage: '2026-09-20T00:00:00.000Z',
      retrievedAt,
      temporalBasis: 'PUBLISHER_VINTAGE',
    },
    provenance: { sourceType: 'PUBLIC_DATA', providerId: authority, retrievedAt },
    sourceReference: {},
    attributeAuthorship:
      claim.claimType === 'HUMANITARIAN_IMPACT_ASSERTION'
        ? [...impactAuthorship(claim.basis)]
        : [{ attribute: 'sourceTitle', authorship: 'PUBLISHER_STATED' as const }],
    revision: { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: AT },
  };
  return {
    captureKey: `cap-${upstreamId}`,
    publisherReleasedAt: '2026-09-20T00:00:00.000Z',
    observation,
  };
}

function event(id = 'FL-1'): HumanitarianRetainedRecord {
  return humRecord('GDACS', id, {
    claimType: 'HUMANITARIAN_EVENT',
    hazardType: hazardFromSourceCode('GDACS', 'FL'),
    sourceNativeType: 'FL',
    sourceTitle: 'Flood',
    eventStatus: 'ONGOING',
    countryIso3: ['SDN'],
  });
}

const EVENT_KEY = domainObservationKey(humanitarianIdentity('GDACS', 'FL-1'));

function figure(
  id: string,
  measure: string,
  value: number | string,
  basis: 'SOURCE_STATED' | 'SOURCE_ESTIMATED' = 'SOURCE_STATED',
  unit: string | undefined = 'PERSONS',
  retrievedAt?: string,
): HumanitarianRetainedRecord {
  const isStatus = measure.endsWith('_STATUS');
  return humRecord(
    'RELIEFWEB',
    id,
    {
      claimType: 'HUMANITARIAN_IMPACT_ASSERTION',
      measure: measure as never,
      value,
      ...(isStatus ? {} : { unit }),
      basis,
      sourceBasisStatement: 'The report states this figure.',
      aboutEventKey: EVENT_KEY,
      countryIso3: ['SDN'],
    },
    retrievedAt,
  );
}

describe('HUM-BRIEF · zero compute on render', () => {
  const moduleSource = readFileSync(join(__dirname, 'analysis-brief.ts'), 'utf8');
  const code = moduleSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('is synchronous and returns no promise, so a page may call it while rendering', () => {
    const brief = projectHumanitarianBrief(projectHumanitarianWorkspace([event()], AT));
    expect(brief).not.toBeInstanceOf(Promise);
    expect(typeof (brief as unknown as { then?: unknown }).then).toBe('undefined');
  });

  it('contains no await, no fetch, no model and no Ask execution path', () => {
    for (const pattern of [
      /\bawait\b/,
      /\basync\b/,
      /fetch\s*\(/,
      /analyzeNews/,
      /askV2Api/,
      /\b(quote|accept|reserve|execute|release)\s*\(/,
      /prompt/i,
      /openai|anthropic|gemini/i,
    ]) {
      expect(code).not.toMatch(pattern);
    }
  });

  it('reads no clock: the brief repeats the workspace projection time', () => {
    expect(code).not.toMatch(/Date\.now|new Date\(\)/);
    const brief = projectHumanitarianBrief(
      projectHumanitarianWorkspace([event()], '2020-05-05T00:00:00.000Z'),
    );
    expect(brief.projectedAt).toBe('2020-05-05T00:00:00.000Z');
  });

  it('asks the workspace whether Ask has a subject; it never builds one', () => {
    expect(
      projectHumanitarianBrief(projectHumanitarianWorkspace([event()], AT)).askSubjectAvailable,
    ).toBe(true);
    expect(projectHumanitarianBrief(projectHumanitarianWorkspace([], AT)).askSubjectAvailable).toBe(
      false,
    );
  });
});

describe('HUM-BRIEF · bounded', () => {
  const many = [
    event(),
    figure('I1', 'PEOPLE_AFFECTED', 50000),
    figure('I2', 'PEOPLE_IN_NEED', 80000),
    figure('I3', 'FATALITIES', 12),
    figure('I4', 'INJURED', 40),
    figure('I5', 'HOUSES_DAMAGED', 900, 'SOURCE_STATED', 'HOUSES'),
    figure('I6', 'PEOPLE_DISPLACED', 31000),
    figure('I7', 'WATER_STATUS', 'severely constrained', 'SOURCE_STATED', undefined),
  ];

  it('never exceeds the figure bound and says when it truncated', () => {
    const brief = projectHumanitarianBrief(projectHumanitarianWorkspace(many, AT));
    expect(brief.figures).toHaveLength(BRIEF_MAX_FIGURES);
    expect(brief.figuresTruncated).toBe(true);
    expect(() => assertBriefIsWellFormed(brief)).not.toThrow();
  });

  it('never exceeds the record bound', () => {
    const lots = [
      event(),
      ...Array.from({ length: 20 }, (_, i) => figure(`X${String(i)}`, 'FATALITIES', i)),
    ];
    const brief = projectHumanitarianBrief(projectHumanitarianWorkspace(lots, AT));
    expect(brief.records.length).toBeLessThanOrEqual(BRIEF_MAX_RECORDS);
  });

  it('does not truncate when everything fits', () => {
    const brief = projectHumanitarianBrief(
      projectHumanitarianWorkspace([event(), figure('I1', 'PEOPLE_DISPLACED', 31000)], AT),
    );
    expect(brief.figures).toHaveLength(1);
    expect(brief.figuresTruncated).toBe(false);
  });

  it('chooses by the evidence order, never by the size of the number', () => {
    const brief = projectHumanitarianBrief(projectHumanitarianWorkspace(many, AT));
    /* DISPLACEMENT precedes REPORTED_IMPACT in the workspace's reading order, so the displaced
       figure leads — not the 80,000 estimate, which would lead if size decided. */
    expect(brief.figures[0]?.dimension).toBe('REPORTED_IMPACT');
    expect(brief.figures.map((f) => f.measure)).toEqual([...brief.figures].map((f) => f.measure));
    const values = brief.figures.map((f) => f.value);
    expect(values).not.toEqual([...values].sort((a, b) => Number(b) - Number(a)));
  });

  it('is deterministic across arrival order', () => {
    const a = projectHumanitarianBrief(projectHumanitarianWorkspace(many, AT));
    const b = projectHumanitarianBrief(projectHumanitarianWorkspace([...many].reverse(), AT));
    expect(b).toEqual(a);
  });
});

describe('HUM-BRIEF · no prose, and every figure keeps its source', () => {
  it('carries no sentence in any string field', () => {
    const brief = projectHumanitarianBrief(
      projectHumanitarianWorkspace([event(), figure('I1', 'PEOPLE_DISPLACED', 31000)], AT),
    );
    expect(() => assertBriefIsWellFormed(brief)).not.toThrow();
    expect(() =>
      assertBriefIsWellFormed({ ...brief, newestRetainedAt: 'Conditions have worsened.' }),
    ).toThrow(/CARRIES_PROSE/);
  });

  it('every figure names its measure, its class, its unit and its record', () => {
    const brief = projectHumanitarianBrief(
      projectHumanitarianWorkspace(
        [
          event(),
          figure('I1', 'PEOPLE_DISPLACED', 31000),
          figure('I2', 'PEOPLE_IN_NEED', 80000, 'SOURCE_ESTIMATED'),
        ],
        AT,
      ),
    );
    for (const f of brief.figures) {
      expect(f.recordKey.length).toBeGreaterThan(0);
      expect(f.providerId).toBe('RELIEFWEB');
      expect(['SOURCE_ASSERTION', 'ESTIMATE']).toContain(f.claimClass);
    }
    expect(brief.figures.map((f) => f.claimClass).sort()).toEqual(['ESTIMATE', 'SOURCE_ASSERTION']);
  });

  it('keeps a status measure as the source term with no unit', () => {
    const brief = projectHumanitarianBrief(
      projectHumanitarianWorkspace(
        [
          event(),
          figure(
            'I1',
            'HUMANITARIAN_ACCESS_STATUS',
            'severely constrained',
            'SOURCE_STATED',
            undefined,
          ),
        ],
        AT,
      ),
    );
    expect(brief.figures[0]).toMatchObject({
      dimension: 'ACCESS_CONSTRAINTS',
      measure: 'HUMANITARIAN_ACCESS_STATUS',
      value: 'severely constrained',
      unit: null,
    });
  });

  it('refuses a figure that is not a sourced class', () => {
    const brief = projectHumanitarianBrief(
      projectHumanitarianWorkspace(
        [event(), figure('I1', 'FATALITIES', 3, 'SOURCE_STATED', 'PERSONS')],
        AT,
      ),
    );
    expect(() =>
      assertBriefIsWellFormed({
        ...brief,
        figures: brief.figures.map((f) => ({ ...f, claimClass: 'FACT' as never })),
      }),
    ).toThrow(HumanitarianBriefRefused);
  });

  it('reports the newest retained time from the records, never "now"', () => {
    const brief = projectHumanitarianBrief(
      projectHumanitarianWorkspace(
        [
          event(),
          figure('I1', 'FATALITIES', 1, 'SOURCE_STATED', 'PERSONS', '2026-09-10T00:00:00.000Z'),
          figure('I2', 'INJURED', 2, 'SOURCE_STATED', 'PERSONS', '2026-09-30T00:00:00.000Z'),
        ],
        AT,
      ),
    );
    expect(brief.newestRetainedAt).toBe('2026-09-30T00:00:00.000Z');
  });
});

describe('HUM-BRIEF · absence survives the shrink', () => {
  it('an empty store brief says so, and never says NOT_ASSESSED', () => {
    const brief = projectHumanitarianBrief(
      projectWorkspaceFromRead(humanitarianRetainedRead([], admitAll), AT),
    );
    expect(brief).toMatchObject({
      state: 'EMPTY',
      storeState: 'NO_RETAINED_EVIDENCE',
      absence: null,
      figures: [],
      newestRetainedAt: null,
    });
    expect(() => assertBriefIsWellFormed(brief)).not.toThrow();
  });

  it('a NOT_ASSESSED read brief says NOT_ASSESSED, and never the store state', () => {
    const brief = projectHumanitarianBrief(
      projectWorkspaceFromRead(humanitarianReadAbsence('NOT_ASSESSED'), AT),
    );
    expect(brief).toMatchObject({ state: 'EMPTY', absence: 'NOT_ASSESSED', storeState: null });
  });

  it('a COVERAGE_GAP read brief carries the gap', () => {
    const brief = projectHumanitarianBrief(
      projectWorkspaceFromRead(humanitarianReadAbsence('SOURCE_TEMPORARILY_UNAVAILABLE'), AT),
    );
    expect(brief.absence).toBe('COVERAGE_GAP');
  });

  it('carries the full unknown roster even though it carries at most four figures', () => {
    const brief = projectHumanitarianBrief(projectHumanitarianWorkspace([event()], AT));
    expect(brief.dimensionsUnknown).toContain('REPORTED_IMPACT');
    expect(brief.dimensionsUnknown).toContain('DISPLACEMENT');
    expect(brief.dimensionsUnknown).toContain('SECTOR_CLAIMS');
    expect(brief.dimensionsCarried).toContain('WHAT_HAPPENED');
  });

  it('refuses a brief that is empty and names no reason, or names both', () => {
    const brief = projectHumanitarianBrief(projectHumanitarianWorkspace([], AT));
    expect(() => assertBriefIsWellFormed({ ...brief, storeState: null })).toThrow(
      /EMPTY_REASON_AMBIGUOUS/,
    );
    expect(() => assertBriefIsWellFormed({ ...brief, absence: 'NOT_ASSESSED' })).toThrow(
      /EMPTY_REASON_AMBIGUOUS/,
    );
  });

  it('refuses a positive finding and refuses a retained brief that names a reason', () => {
    const empty = projectHumanitarianBrief(projectHumanitarianWorkspace([], AT));
    expect(() =>
      assertBriefIsWellFormed({
        ...empty,
        storeState: null,
        absence: 'ASSESSED_NOTHING_QUALIFIED',
      }),
    ).toThrow(/ABSENCE_REASSURES/);
    const retained = projectHumanitarianBrief(projectHumanitarianWorkspace([event()], AT));
    expect(() => assertBriefIsWellFormed({ ...retained, absence: 'NOT_ASSESSED' })).toThrow(
      /REASON_ON_RETAINED/,
    );
  });

  it('refuses an open field set in either direction', () => {
    const brief = projectHumanitarianBrief(projectHumanitarianWorkspace([event()], AT));
    expect(() => assertBriefIsWellFormed({ ...brief, extra: 1 } as never)).toThrow(
      /FIELD_SET_OPEN/,
    );
  });
});
