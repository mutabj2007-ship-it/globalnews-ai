import {
  HumanitarianReadRefused,
  domainObservationKey,
  humanitarianIdentity,
  humanitarianReadAbsence,
  humanitarianRetainedRead,
  type HumanitarianObservation,
  type HumanitarianRetainedRead,
  type HumanitarianRetainedRecord,
} from '@globalnews-ai/shared';

import { HUM_PRECISION_MAPPING } from './humAxes';
import {
  HUM_DENSITY_CONTRACTS,
  HUM_PARTIAL_REASONS,
  HUM_READ_VIEW_STATES,
  HUM_RENDERABLE_PRECISION_ALIASES,
  HUM_RETAINED_DISPLAY_STALE_AFTER_DAYS,
  humAskLaunch,
  humDensityFor,
  humFigureViews,
  humFreshnessView,
  humMapOutcome,
  humMaxRevisionOrdinal,
  humNewestRelease,
  humProvenanceView,
  humReadIsAssessment,
  humReadLoadingView,
  humReadView,
  humRowGeography,
  humSurfaceAdmitsPolygon,
} from './humReadPresentation';

/**
 * Lane G · Contract 6 — the nine required cases, plus the guards for the four CTO rulings.
 * Fixtures follow `retained-read.convergence.spec.ts` so a row is valid by the same authority.
 */

const AT = '2026-10-01T00:00:00.000Z';
const NOW = '2026-10-02T00:00:00.000Z';
const admitAll = (): boolean => true;

function observation(
  upstream: string,
  upstreamId: string,
  overrides: Partial<{
    countryIso3: readonly string[];
    geometryRecordKey: string;
    sourceUrl: string;
    publisherVintage: string | undefined;
    occurredAt: string | undefined;
  }> = {},
): HumanitarianObservation {
  const identity = humanitarianIdentity(upstream, upstreamId);
  const temporal: Record<string, unknown> = { retrievedAt: AT, temporalBasis: 'PUBLISHER_VINTAGE' };
  if (overrides.publisherVintage !== undefined)
    temporal.publisherVintage = overrides.publisherVintage;
  else if (!('publisherVintage' in overrides)) temporal.publisherVintage = AT;
  if (overrides.occurredAt !== undefined) temporal.occurredAt = overrides.occurredAt;
  return {
    observationKey: domainObservationKey(identity),
    identity,
    observationKind: 'HUMANITARIAN_EVENT',
    subjectType: 'SOURCE_EVENT',
    subjectId: upstreamId,
    claim: {
      claimType: 'HUMANITARIAN_EVENT',
      hazardType: 'FLOOD',
      sourceNativeType: 'FL',
      sourceTitle: `Flood ${upstreamId}`,
      eventStatus: 'ONGOING',
      countryIso3: overrides.countryIso3 ?? ['RWA'],
      ...(overrides.geometryRecordKey === undefined
        ? {}
        : { geometryRecordKey: overrides.geometryRecordKey }),
    },
    temporal,
    provenance: {
      sourceType: 'PUBLIC_DATA',
      providerId: upstream,
      retrievedAt: AT,
      evidenceRole: 'PRIMARY_RECORD',
    },
    sourceReference: overrides.sourceUrl === undefined ? {} : { sourceUrl: overrides.sourceUrl },
    attributeAuthorship: [{ attribute: 'hazardType', authorship: 'PUBLISHER_STATED' }],
    revision: { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: AT },
  } as unknown as HumanitarianObservation;
}

const row = (
  upstream: string,
  id: string,
  overrides: Parameters<typeof observation>[2] = {},
  releasedAt: string = AT,
): HumanitarianRetainedRecord => ({
  captureKey: `capture-${id}`,
  publisherReleasedAt: releasedAt,
  observation: observation(upstream, id, overrides),
});

const retained = (records: readonly HumanitarianRetainedRecord[]): HumanitarianRetainedRead =>
  humanitarianRetainedRead(records, admitAll);

/* ══ RULING 1 · the retained success contract is consumed ══════════════════ */

describe('view state — six reader states and no seventh', () => {
  it('the registry is closed and ordered', () => {
    expect([...HUM_READ_VIEW_STATES]).toEqual([
      'LOADING',
      'RETAINED',
      'PARTIAL',
      'NO_RETAINED_EVIDENCE',
      'NOT_ASSESSED',
      'COVERAGE_GAP',
    ]);
  });

  it('REQUIRED CASE · country-only event renders as RETAINED', () => {
    const view = humReadView(retained([row('GDACS', 'E1', { sourceUrl: 'https://x/1' })]));
    expect(view.state).toBe('RETAINED');
    expect(view.rowCount).toBe(1);
    expect(view.partialReasons).toEqual([]);
  });

  it('REQUIRED CASE · no data — an empty store is NO_RETAINED_EVIDENCE, never an assessment', () => {
    const view = humReadView(retained([]));
    expect(view.state).toBe('NO_RETAINED_EVIDENCE');
    expect(view.rowCount).toBe(0);
    expect(humReadIsAssessment(view.state)).toBe(false);
  });

  it('REQUIRED CASE · coverage gap', () => {
    const view = humReadView(humanitarianReadAbsence('COVERAGE_GAP'));
    expect(view.state).toBe('COVERAGE_GAP');
    expect(view.rowCount).toBe(0);
  });

  it('NOT_ASSESSED stays distinct from both', () => {
    expect(humReadView(humanitarianReadAbsence('NOT_ASSESSED')).state).toBe('NOT_ASSESSED');
  });

  it('PARTIAL is derived from what the publisher omitted, and names it', () => {
    /* A row with no source reference: structurally admissible, not fully presentable. */
    const view = humReadView(retained([row('GDACS', 'E9')]));
    expect(view.state).toBe('PARTIAL');
    expect(view.partialReasons).toEqual(['ROW_WITHOUT_SOURCE_REFERENCE']);
    /* CONTROL — the same row with a reference is RETAINED, so PARTIAL is the gap biting. */
    expect(humReadView(retained([row('GDACS', 'E9', { sourceUrl: 'https://x/9' })])).state).toBe(
      'RETAINED',
    );
  });

  it('PARTIAL reports every distinct reason once, in declared order', () => {
    const view = humReadView(
      retained([
        row('GDACS', 'A', { countryIso3: [], sourceUrl: 'https://x/a' }),
        row('GDACS', 'B'),
        row('GDACS', 'C', { countryIso3: [] }),
      ]),
    );
    expect(view.state).toBe('PARTIAL');
    expect(view.partialReasons).toEqual([
      'ROW_WITHOUT_COUNTRY_SCOPE',
      'ROW_WITHOUT_SOURCE_REFERENCE',
    ]);
  });

  it('there is no partial reason the contract makes unreachable', () => {
    /*
     * HUM-READ-3 guarantees every reader row carries a parseable `publisherReleasedAt`, so a
     * "no publisher time basis" reason could never fire. It is absent by design, not forgotten.
     */
    expect(HUM_PARTIAL_REASONS as readonly string[]).not.toContain(
      'ROW_WITHOUT_PUBLISHER_TIME_BASIS',
    );
    expect(() =>
      retained([{ ...row('GDACS', 'Z'), publisherReleasedAt: '' } as HumanitarianRetainedRecord]),
    ).toThrow(/HUM-READ-3/);
  });

  it('LOADING exists, is distinct, and can never be derived from a read', () => {
    expect(humReadLoadingView().state).toBe('LOADING');
    const everyRead: readonly HumanitarianRetainedRead[] = [
      humanitarianReadAbsence('NOT_ASSESSED'),
      humanitarianReadAbsence('COVERAGE_GAP'),
      retained([]),
      retained([row('GDACS', 'L', { sourceUrl: 'https://x/l' })]),
    ];
    for (const read of everyRead) expect(humReadView(read).state).not.toBe('LOADING');
  });

  it('no view state is an assessment of a situation — not even RETAINED', () => {
    for (const state of HUM_READ_VIEW_STATES) expect(humReadIsAssessment(state)).toBe(false);
  });
});

/* ══ RULING 2 · public source topology remains lossy ══════════════════════ */

describe('source topology stays lossy — no reader-facing SOURCE_UNAVAILABLE', () => {
  it('the view registry does not contain it', () => {
    expect(HUM_READ_VIEW_STATES as readonly string[]).not.toContain('SOURCE_UNAVAILABLE');
    expect(HUM_READ_VIEW_STATES as readonly string[]).not.toContain('SOURCE_NOT_CONNECTED');
    expect(HUM_READ_VIEW_STATES as readonly string[]).not.toContain(
      'SOURCE_TEMPORARILY_UNAVAILABLE',
    );
  });

  it('every internal topology state arrives as COVERAGE_GAP and nothing finer', () => {
    for (const internal of [
      'SOURCE_NOT_CONNECTED',
      'SOURCE_TEMPORARILY_UNAVAILABLE',
      'EVIDENCE_WITHHELD',
      'NO_QUALIFYING_EVIDENCE',
    ] as const) {
      expect(humReadView(humanitarianReadAbsence(internal)).state).toBe('COVERAGE_GAP');
    }
    /* POSITIVE CONTROL — NOT_ASSESSED is NOT collapsed, so the projection is lossy, not blanket. */
    expect(humReadView(humanitarianReadAbsence('NOT_ASSESSED')).state).toBe('NOT_ASSESSED');
  });
});

/* ══ RULING 3 · no reader-facing polygons in R1 ═══════════════════════════ */

describe('geometry — nothing is drawable from a reader row in R1', () => {
  it('REQUIRED CASE · polygon event — a geometry-bearing row never reaches a reader', () => {
    expect(() => retained([row('GDACS', 'P', { geometryRecordKey: 'geo-1' })])).toThrow(
      HumanitarianReadRefused,
    );
    /* And the refusal is the C-3 rule by name, not a generic validation error. */
    expect(() => retained([row('GDACS', 'P', { geometryRecordKey: 'geo-1' })])).toThrow(
      /HUM-READ-4/,
    );
  });

  it('no reader-facing surface admits a polygon', () => {
    expect(humSurfaceAdmitsPolygon('MAP_ALPHA')).toBe(false);
    expect(humSurfaceAdmitsPolygon('MAP_RICH')).toBe(false);
    /* POSITIVE CONTROL — the internal audit surface does, so the check can distinguish. */
    expect(humSurfaceAdmitsPolygon('INTERNAL_AUDIT')).toBe(true);
  });

  it('REQUIRED CASE · country-only event draws no point marker', () => {
    const outcome = humMapOutcome(row('GDACS', 'C1', { sourceUrl: 'https://x/c' }), 'MAP_ALPHA');
    expect(outcome.drawn).toBe(false);
    expect(outcome.token).toBe('NOT_DRAWABLE_HERE');
    expect(outcome.refusal).toBe('COUNTRY_SCOPE_IS_NOT_A_POINT');
  });

  it('REQUIRED CASE · no geometry — reported as absent, not as a zero location', () => {
    const outcome = humMapOutcome(row('GDACS', 'N1', { countryIso3: [] }), 'MAP_ALPHA');
    expect(outcome.drawn).toBe(false);
    expect(outcome.refusal).toBe('NO_GEOMETRY_ON_RECORD');
    expect(JSON.stringify(outcome)).not.toMatch(/\b0\b/);
  });

  it('the map mints no vocabulary of its own — the token is the existing reader token', () => {
    const outcome = humMapOutcome(row('GDACS', 'T1', { sourceUrl: 'https://x/t' }), 'MAP_ALPHA');
    expect(['NOT_SHOWN', 'NOT_DRAWABLE_HERE']).toContain(outcome.token);
  });
});

/* ══ RULING 4 · render only actually supported precision ══════════════════ */

describe('precision — only what a record establishes', () => {
  it('country scope is COUNTRY; absent scope is UNKNOWN', () => {
    const withCountry = humRowGeography(row('GDACS', 'G1', { sourceUrl: 'https://x/g' }));
    expect(withCountry.alias).toBe('COUNTRY');
    expect(withCountry.canonical).toBe('COUNTRY');
    expect(withCountry.renderable).toBe(true);
    expect(withCountry.countryIso3).toEqual(['RWA']);

    const without = humRowGeography(row('GDACS', 'G2', { countryIso3: [] }));
    expect(without.alias).toBe('UNPLACED');
    expect(without.canonical).toBe('UNKNOWN');
    expect(without.countryIso3).toEqual([]);
  });

  it('no manufactured precision is reachable', () => {
    for (const alias of ['SITE', 'ADMIN2', 'ADMIN3', 'REGIONAL'] as const) {
      expect(HUM_RENDERABLE_PRECISION_ALIASES).not.toContain(alias);
    }
    /* and each of those is non-producible in the authority, which is WHY it is unreachable */
    for (const alias of ['SITE', 'ADMIN2', 'ADMIN3', 'REGIONAL'] as const) {
      expect(HUM_PRECISION_MAPPING.find((m) => m.alias === alias)?.producible).toBe(false);
    }
  });

  it('every offered alias is one the authority marks producible', () => {
    for (const alias of HUM_RENDERABLE_PRECISION_ALIASES) {
      expect(HUM_PRECISION_MAPPING.find((m) => m.alias === alias)?.producible).toBe(true);
    }
    expect(HUM_RENDERABLE_PRECISION_ALIASES.length).toBeGreaterThan(0);
  });
});

/* ══ PROVENANCE, FRESHNESS, FIGURES ══════════════════════════════════════ */

describe('provenance and freshness are visible per row', () => {
  it('REQUIRED CASE · multiple sources — each row keeps its own identity and provenance', () => {
    const read = retained([
      row('GDACS', 'M1', { sourceUrl: 'https://gdacs/1' }),
      row('RELIEFWEB', 'M2', { sourceUrl: 'https://reliefweb/2' }),
    ]);
    const view = humReadView(read);
    expect(view.state).toBe('RETAINED');
    expect(view.rowCount).toBe(2);
    const rows = (read as Extract<HumanitarianRetainedRead, { kind: 'RETAINED' }>).observations;
    const authorities = rows.map((r) => humProvenanceView(r).upstreamAuthority);
    expect(new Set(authorities).size).toBe(2);
    for (const r of rows) {
      const p = humProvenanceView(r);
      expect(p.sourceUrl).not.toBeNull();
      expect(p.captureKey).toMatch(/^capture-/);
      expect(p.retrievedAt).toBe(AT);
    }
  });

  it('an absent optional field is null, never an empty-string or zero default', () => {
    const p = humProvenanceView(row('GDACS', 'D1'));
    expect(p.sourceUrl).toBeNull();
    expect(p.citation).toBeNull();
  });

  it('REQUIRED CASE · old retained data is marked old, with its age and basis', () => {
    const old = humFreshnessView(row('GDACS', 'O1', {}, '2026-08-01T00:00:00.000Z'), NOW);
    expect(old.basis).toBe('PUBLISHER_RELEASED');
    expect(old.ageDays).toBe(62);
    expect(old.old).toBe(true);
    /* CONTROL — a fresh row is not marked old, so the flag is the age biting */
    const fresh = humFreshnessView(row('GDACS', 'O2', {}, '2026-10-01T00:00:00.000Z'), NOW);
    expect(fresh.ageDays).toBe(1);
    expect(fresh.old).toBe(false);
    expect(HUM_RETAINED_DISPLAY_STALE_AFTER_DAYS).toBe(14);
  });

  it('no publisher basis means unknown age — not zero and not fresh', () => {
    /* A raw record, deliberately: the retained contract would refuse this one (HUM-READ-3). */
    const f = humFreshnessView(row('GDACS', 'U1', { publisherVintage: undefined }, ''), NOW);
    expect(f.ageDays).toBeNull();
    expect(f.basis).toBe('NONE');
    expect(f.old).toBe(false);
  });

  it('figures are never combined across rows — contradictory figures both survive', () => {
    /* Two impact assertions for one event with different values: both are carried verbatim. */
    const impact = (id: string, value: number): HumanitarianRetainedRecord => {
      const r = row('RELIEFWEB', id, { sourceUrl: `https://rw/${id}` });
      const o = r.observation as unknown as { observationKind: string; claim: unknown };
      o.observationKind = 'HUMANITARIAN_IMPACT_ASSERTION';
      o.claim = {
        claimType: 'HUMANITARIAN_IMPACT_ASSERTION',
        measure: 'PEOPLE_AFFECTED',
        value,
        unit: 'people',
        basis: 'SOURCE_STATED',
        sourceBasisStatement: `as reported in ${id}`,
        aboutEventKey: 'event-1',
        countryIso3: ['RWA'],
      };
      return r;
    };
    const figures = humFigureViews(retained([impact('F1', 1200), impact('F2', 3400)]));
    expect(figures).toHaveLength(2);
    expect(figures.map((f) => f.value)).toEqual([1200, 3400]);
    expect(figures.every((f) => f.basis === 'SOURCE_STATED')).toBe(true);
    /* no total anywhere */
    expect(figures.map((f) => f.value)).not.toContain(4600);
    expect(humFigureViews(retained([]))).toEqual([]);
  });
});

/* ══ ASK LAUNCHER ════════════════════════════════════════════════════════ */

describe('Ask launcher — armed, never fired', () => {
  it('REQUIRED CASE · no passive Ask execution: the module holds no execution path', () => {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const source: string = require('fs').readFileSync(
      require('path').join(__dirname, 'humReadPresentation.ts'),
      'utf-8',
    );
    /* eslint-enable @typescript-eslint/no-var-requires */
    const code = source
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('//');
      })
      .join('\n');
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toMatch(/askV2|askApi|AnalysisService|openai|OpenAI/i);
    expect(code).not.toMatch(/\bawait\b/);
    /* POSITIVE CONTROL — the scan can see the file at all */
    expect(code).toContain('humAskLaunch');
  });

  it('the launcher is not offered when there is nothing admitted to ask about', () => {
    for (const read of [
      humanitarianReadAbsence('NOT_ASSESSED'),
      humanitarianReadAbsence('COVERAGE_GAP'),
      retained([]),
    ]) {
      const launch = humAskLaunch(read);
      expect(launch.offered).toBe(false);
      expect(launch.observationKeys).toEqual([]);
      expect(launch.rowCount).toBe(0);
    }
  });

  it('with retained rows it carries stable identifiers only — no prose, no question', () => {
    const launch = humAskLaunch(
      retained([
        row('GDACS', 'Q1', { sourceUrl: 'https://x/q1' }),
        row('RELIEFWEB', 'Q2', { countryIso3: ['UGA'], sourceUrl: 'https://x/q2' }),
      ]),
    );
    expect(launch.offered).toBe(true);
    expect(launch.rowCount).toBe(2);
    expect(launch.observationKeys).toHaveLength(2);
    expect(launch.countryIso3).toEqual(['RWA', 'UGA']);
    const serialized = JSON.stringify(launch);
    expect(serialized).not.toMatch(/Flood|\?|prompt|question/i);
  });
});

/* ══ DENSITY ═════════════════════════════════════════════════════════════ */

describe('REQUIRED CASE · phone 360 / 390 / 430 contracts', () => {
  it('each required width has a contract, single column, with a chip budget', () => {
    for (const width of [360, 390, 430]) {
      const c = humDensityFor(width);
      expect(c.singleColumn).toBe(true);
      expect(c.provenanceChips).toBeGreaterThan(0);
      expect(c.rowsBeforeDefer).toBeGreaterThan(0);
      expect(HUM_DENSITY_CONTRACTS.map((d) => d.width)).toContain(width);
    }
  });

  it('density never decreases as the viewport widens', () => {
    const widths = [360, 390, 430, 768, 1024, 1440];
    const chips = widths.map((w) => humDensityFor(w).provenanceChips);
    const rows = widths.map((w) => humDensityFor(w).rowsBeforeDefer);
    expect(chips).toEqual([...chips].sort((a, b) => a - b));
    expect(rows).toEqual([...rows].sort((a, b) => a - b));
  });

  it('360 is the floor — a narrower viewport does not fall off the contract', () => {
    expect(humDensityFor(320)).toEqual(humDensityFor(360));
    expect(humDensityFor(359).provenanceChips).toBe(2);
  });

  it('desktop is not single column', () => {
    expect(humDensityFor(1024).singleColumn).toBe(false);
    expect(humDensityFor(1440).singleColumn).toBe(false);
  });
});

describe('the skeleton slots that were simply wrong once rows exist', () => {
  it('newest release comes from the record, never from our clock', () => {
    const read = retained([
      row('GDACS', 'R1', { sourceUrl: 'https://x/r1' }, '2026-09-20T00:00:00.000Z'),
      row('GDACS', 'R2', { sourceUrl: 'https://x/r2' }, '2026-09-28T00:00:00.000Z'),
    ]);
    expect(humNewestRelease(read)).toBe('2026-09-28T00:00:00.000Z');
    /* not retrievedAt, which is our clock and identical on both rows */
    expect(humNewestRelease(read)).not.toBe(AT);
    expect(humMaxRevisionOrdinal(read)).toBe(0);
  });

  it('absence and an empty store carry no freshness and no revision', () => {
    for (const read of [
      humanitarianReadAbsence('NOT_ASSESSED'),
      humanitarianReadAbsence('COVERAGE_GAP'),
      retained([]),
    ]) {
      expect(humNewestRelease(read)).toBeNull();
      expect(humMaxRevisionOrdinal(read)).toBeNull();
    }
  });
});
