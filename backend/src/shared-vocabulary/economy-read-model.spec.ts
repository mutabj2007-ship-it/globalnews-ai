import {
  ECONOMY_CATEGORIES,
  ECONOMY_CLAIM_KINDS,
  ECONOMY_CORRIDOR_CAPABILITIES,
  ECONOMY_FIGURE_GAP_REASONS,
  ECONOMY_FRESHNESS_STATES,
  ECONOMY_KEY_ENCODING_VERSION,
  ECONOMY_LEGACY_DATA_CHANGE_STATE,
  ECONOMY_LEGACY_DATA_RELEASE_STATUS,
  ECONOMY_LEGACY_UI_CORRIDOR_CAPABILITY,
  ECONOMY_LEGACY_UI_FRESHNESS,
  ECONOMY_LEGACY_UI_GAP_REASON,
  ECONOMY_LEGACY_UI_RELEASE_STATUS,
  ECONOMY_LEGACY_UI_SOURCE_CLASS,
  ECONOMY_LEGACY_UI_VALUE_KIND,
  ECONOMY_OBSERVATION_AVAILABILITY_STATES,
  ECONOMY_RELEASE_STATUSES,
  ECONOMY_VALUE_KINDS,
  WATCH_CHANGE_STATES,
  assertAssessmentIsAccountable,
  assertConsensusIsNotObservation,
  assertCorridorIsHonest,
  assertReleaseStatusIsApplicable,
  economyEvidenceRoleFor,
  economyHasObservationSource,
  economyObservationKey,
  economyRetainVintages,
  economySeriesPeriodKey,
} from '@globalnews-ai/shared';
import type {
  EconomyAssessment,
  EconomyConsensusBenchmark,
  EconomyCorridor,
  EconomyFigureSlot,
  EconomyObservation,
  EconomyValueSemantics,
} from '@globalnews-ai/shared';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ECON-CONTRACT-1 — CONTRACT TESTS FOR THE SHARED ECONOMY READ MODEL.
 *
 * These run from the BACKEND runner and import `@globalnews-ai/shared`, which resolves to
 * the COMPILED output. `build:shared` must therefore run before them — MAIN-BUILD-2 — and
 * that is deliberate rather than incidental: it means the contract is tested as consumers
 * actually receive it, not as its source reads.
 *
 * A NOTE ON WHERE THIS FILE LIVES. `shared/src/**.spec.ts` is collected by NO runner in
 * this repository — the frontend matches `<rootDir>/src/**` and the backend's rootDir is
 * `backend/src` — so a spec placed beside the contract would never execute.
 * `backend/src/shared-vocabulary/` is the established home for exactly this: testing a
 * shared contract through the compiled package.
 */

const SEMANTICS: EconomyValueSemantics = {
  releaseStatus: 'FINAL',
  valueKind: 'ACTUAL',
  freshness: 'FRESH',
};

const observation = (over: Partial<EconomyObservation> = {}): EconomyObservation => ({
  seriesId: 'rw-cpi-yoy',
  periodId: '2026-Q1',
  vintage: '2026-04-15',
  value: 5.2,
  unit: 'percent',
  semantics: SEMANTICS,
  provenance: { sourceType: 'PUBLIC_DATA' },
  ...over,
});

/* ── 1 · THE THREE AXES STAY THREE ───────────────────────────────────── */

describe('ECON-CONTRACT-1 · the three axes are independent and stay three', () => {
  it('declares release status, value kind and freshness as separate closed vocabularies', () => {
    expect(ECONOMY_RELEASE_STATUSES).toEqual([
      'SCHEDULED',
      'PRELIMINARY',
      'REVISED',
      'FINAL',
      'WITHDRAWN',
    ]);
    expect(ECONOMY_VALUE_KINDS).toEqual(['ACTUAL', 'FORECAST', 'DERIVED', 'TARGET']);
    expect(ECONOMY_FRESHNESS_STATES).toEqual(['FRESH', 'AGEING', 'STALE', 'UNDETERMINED']);
  });

  it('no axis member appears in another axis — they are not one collapsed status list', () => {
    const all = [...ECONOMY_RELEASE_STATUSES, ...ECONOMY_VALUE_KINDS, ...ECONOMY_FRESHNESS_STATES];
    expect(new Set(all).size).toBe(all.length);
  });

  it('AVAILABILITY IS NOT A FRESHNESS — the frontend lane category error is not carried over', () => {
    expect(ECONOMY_FRESHNESS_STATES as readonly string[]).not.toContain('UNAVAILABLE');
    // Absence lives on its own concept, with a required reason.
    expect(ECONOMY_FIGURE_GAP_REASONS).toEqual([
      'NOT_COLLECTED',
      'WITHHELD',
      'DISCONTINUED',
      'NO_PRODUCER',
    ]);
  });

  it('a value with no publication cycle carries NO release status, rather than a sixth status', () => {
    expect(() =>
      assertReleaseStatusIsApplicable({
        releaseStatus: null,
        valueKind: 'FORECAST',
        freshness: 'UNDETERMINED',
      }),
    ).not.toThrow();

    expect(() =>
      assertReleaseStatusIsApplicable({
        releaseStatus: 'FINAL',
        valueKind: 'FORECAST',
        freshness: 'FRESH',
      }),
    ).toThrow(/ECON-AXIS-1/);
  });

  it('a revision ordinal is meaningful only on a REVISED release', () => {
    expect(() =>
      assertReleaseStatusIsApplicable({
        releaseStatus: 'REVISED',
        valueKind: 'ACTUAL',
        freshness: 'FRESH',
        revisionOrdinal: 2,
      }),
    ).not.toThrow();

    expect(() =>
      assertReleaseStatusIsApplicable({ ...SEMANTICS, revisionOrdinal: 2 }),
    ).toThrow(/ECON-AXIS-2/);
  });
});

/* ── 2 · IMMUTABILITY AND VINTAGE ────────────────────────────────────── */

describe('ECON-CONTRACT-1 · an observation is immutable; a revision is a new vintage', () => {
  it('two vintages of one Series + Period are BOTH retained', () => {
    const first = observation({ vintage: '2026-04-15', value: 5.2 });
    const revised = observation({ vintage: '2026-05-20', value: 5.4 });

    const kept = economyRetainVintages([first], revised);

    expect(kept).toHaveLength(2);
    expect(kept.map((o) => o.value)).toEqual([5.2, 5.4]);
    // The prior reading is still reachable, unmodified.
    expect(kept[0]).toBe(first);
  });

  it('they share a slot key and differ in observation key — that IS the revision model', () => {
    const first = observation({ vintage: '2026-04-15' });
    const revised = observation({ vintage: '2026-05-20' });

    expect(economySeriesPeriodKey(first)).toBe(economySeriesPeriodKey(revised));
    expect(economyObservationKey(first)).not.toBe(economyObservationKey(revised));
  });

  it('REFUSES an in-place edit — same key, different value is rejected, never overwritten', () => {
    const first = observation({ value: 5.2 });
    const edited = observation({ value: 9.9 });

    expect(() => economyRetainVintages([first], edited)).toThrow(/ECON-IMMUTABLE-1/);
  });

  it('re-presenting the identical observation is idempotent, not a duplicate', () => {
    const first = observation();
    expect(economyRetainVintages([first], observation())).toHaveLength(1);
  });
});

/* ── 3 · KEYS ARE INJECTIVE, BECAUSE THE PARTS ARE CALLER-SUPPLIED ───── */

describe('ECON-CONTRACT-1 · ledger keys are injective by construction', () => {
  const a = observation({ seriesId: 'RW CPI', periodId: 'Q1', vintage: 'v1' });
  const b = observation({ seriesId: 'RW', periodId: 'CPI Q1', vintage: 'v1' });

  it('THE DEFECT THIS REPLACES: a delimiter-joined key collides on these two observations', () => {
    const naive = (o: EconomyObservation): string => `${o.seriesId} ${o.periodId} ${o.vintage}`;
    expect(naive(a)).toBe(naive(b));
  });

  it('the length-prefixed key does not collide on the same pair', () => {
    expect(economyObservationKey(a)).not.toBe(economyObservationKey(b));
  });

  it('no split of one concatenation can collide — the general property, not one pair', () => {
    /*
      THE CORPUS IS CHOSEN SO THAT RECOMBINATION ACTUALLY OCCURS. An earlier version used
      parts that never recombined under a separator, so a naive delimiter join passed it —
      the test asserted a general property it was not exercising. These parts contain the
      separator itself, the length-prefix punctuation, and pieces that re-split across the
      boundary, which is what makes the exhaustive sweep meaningful.
    */
    const parts = ['', ' ', 'a', 'b', 'a b', 'b a', ':', '1:a', '2:ab'];
    const keys = new Set<string>();
    let n = 0;
    for (const seriesId of parts) {
      for (const periodId of parts) {
        for (const vintage of parts) {
          keys.add(economyObservationKey({ seriesId, periodId, vintage }));
          n += 1;
        }
      }
    }
    expect(keys.size).toBe(n);
  });

  it('carries its encoding version separately from any data version', () => {
    expect(ECONOMY_KEY_ENCODING_VERSION).toBe('eco:1');
    expect(economyObservationKey(a).startsWith('eco:1:')).toBe(true);
  });

  it('is deterministic across repeated calls', () => {
    expect(economyObservationKey(a)).toBe(economyObservationKey(a));
  });
});

/* ── 4 · CONSENSUS IS A DERIVED BENCHMARK ───────────────────────────── */

describe('ECON-CONTRACT-1 · consensus is a derived benchmark, not an observation', () => {
  const benchmark: EconomyConsensusBenchmark = {
    seriesId: 'rw-cpi-yoy',
    periodId: '2026-Q1',
    value: 5.0,
    unit: 'percent',
    aggregationMethod: 'MEDIAN',
    contributorCount: 3,
    collectionCutoff: '2026-04-10',
    contributingForecastRefs: ['f1', 'f2', 'f3'],
    valueKind: 'DERIVED',
  };

  it('accepts a benchmark that names its method, its N and its cutoff', () => {
    expect(() => assertConsensusIsNotObservation(benchmark)).not.toThrow();
  });

  it('REJECTS one that has acquired a release status — it is not a publisher release', () => {
    const pretending = { ...benchmark, releaseStatus: 'FINAL' } as EconomyConsensusBenchmark;
    expect(() => assertConsensusIsNotObservation(pretending)).toThrow(/ECON-CONSENSUS-1/);
  });

  it('REJECTS an N it cannot attribute', () => {
    expect(() =>
      assertConsensusIsNotObservation({ ...benchmark, contributorCount: 40 }),
    ).toThrow(/ECON-CONSENSUS-2/);
  });

  it('REJECTS a benchmark over zero forecasts', () => {
    expect(() =>
      assertConsensusIsNotObservation({
        ...benchmark,
        contributorCount: 0,
        contributingForecastRefs: [],
      }),
    ).toThrow(/ECON-CONSENSUS-3/);
  });

  it('is always DERIVED — it can never be typed as an ACTUAL', () => {
    expect(benchmark.valueKind).toBe('DERIVED');
  });
});

/* ── 5 · ASSESSMENT IS ACCOUNTABLE, AND MAY HONESTLY SAY NOTHING ─────── */

describe('ECON-CONTRACT-1 · assessment', () => {
  const assessment = (over: Partial<EconomyAssessment> = {}): EconomyAssessment => ({
    seriesId: 'rw-cpi-yoy',
    periodId: '2026-Q1',
    observedVintages: ['2026-04-15'],
    producedBy: 'shared-assessment',
    assessedAt: '2026-04-16',
    changeState: 'NO_MATERIAL_CHANGE',
    ...over,
  });

  it('uses the platform CLOSED seven change states and adds none', () => {
    for (const s of WATCH_CHANGE_STATES) {
      expect(() => assertAssessmentIsAccountable(assessment({ changeState: s }))).not.toThrow();
    }
    expect(WATCH_CHANGE_STATES).toHaveLength(7);
  });

  it('REJECTS an assessment that names no observation vintages', () => {
    expect(() => assertAssessmentIsAccountable(assessment({ observedVintages: [] }))).toThrow(
      /ECON-ASSESS-1/,
    );
  });

  it('REJECTS an assessment with no accountable producer', () => {
    expect(() => assertAssessmentIsAccountable(assessment({ producedBy: '  ' }))).toThrow(
      /ECON-ASSESS-2/,
    );
  });

  it('a null change state is permitted, but only with a stated reason', () => {
    expect(() =>
      assertAssessmentIsAccountable(assessment({ changeState: null })),
    ).toThrow(/ECON-ASSESS-3/);

    expect(() =>
      assertAssessmentIsAccountable(
        assessment({ changeState: null, changeStateReason: 'no comparable prior vintage' }),
      ),
    ).not.toThrow();
  });
});

/* ── 6 · CORRIDOR, AND ENDPOINT_ONLY ────────────────────────────────── */

describe('ECON-CONTRACT-1 · corridor capability is part of the contract', () => {
  const corridor = (over: Partial<EconomyCorridor> = {}): EconomyCorridor => ({
    corridorId: 'northern-corridor',
    label: 'Mombasa to Kigali',
    capability: 'ENDPOINT_ONLY',
    endpoints: [
      { role: 'ORIGIN_PORT', geographyId: 'city:mombasa', renderable: true },
      { role: 'DESTINATION', geographyId: 'city:kigali', renderable: true },
    ],
    chain: [
      {
        fromRole: 'ORIGIN_PORT',
        toRole: 'DESTINATION',
        kind: 'GATEWAY_DEPENDENCE',
        evidenceRefs: ['e1'],
      },
    ],
    ...over,
  });

  it('declares capability as a capability question, both members answering it', () => {
    expect(ECONOMY_CORRIDOR_CAPABILITIES).toEqual(['ROUTE_SUPPORTED', 'ENDPOINT_ONLY']);
  });

  it('THE CORRIDOR TYPE HAS NO GEOMETRY FIELD — asserted on the shipped declaration', () => {
    const dts = readFileSync(
      join(__dirname, '../../../shared/dist/economy/index.d.ts'),
      'utf-8',
    );
    const block = dts.slice(
      dts.indexOf('interface EconomyCorridor '),
      dts.indexOf('interface EconomyCorridor ') + 400,
    );
    expect(block).toContain('capability');
    expect(block).not.toMatch(/geometry|coordinates|polyline|LineString|path\b/);
  });

  it('REFUSES to attach geometry under ENDPOINT_ONLY', () => {
    const withGeometry = { ...corridor(), geometry: [[0, 0]] } as unknown as EconomyCorridor;
    expect(() => assertCorridorIsHonest(withGeometry)).toThrow(/ECON-CORRIDOR-4/);
  });

  it('REFUSES a one-ended corridor, a dangling link and an unevidenced link', () => {
    expect(() => assertCorridorIsHonest(corridor({ endpoints: [] }))).toThrow(/ECON-CORRIDOR-1/);
    expect(() =>
      assertCorridorIsHonest(
        corridor({
          chain: [
            { fromRole: 'ORIGIN_PORT', toRole: 'NOWHERE', kind: 'FREIGHT_FLOW', evidenceRefs: ['e'] },
          ],
        }),
      ),
    ).toThrow(/ECON-CORRIDOR-2/);
    expect(() =>
      assertCorridorIsHonest(
        corridor({
          chain: [
            {
              fromRole: 'ORIGIN_PORT',
              toRole: 'DESTINATION',
              kind: 'FREIGHT_FLOW',
              evidenceRefs: [],
            },
          ],
        }),
      ),
    ).toThrow(/ECON-CORRIDOR-3/);
  });

  it('KEEPS an unresolved endpoint rather than silently shortening the chain', () => {
    const partial = corridor({
      endpoints: [
        { role: 'ORIGIN_PORT', renderable: false },
        { role: 'DESTINATION', geographyId: 'city:kigali', renderable: true },
      ],
    });
    expect(() => assertCorridorIsHonest(partial)).not.toThrow();
    expect(partial.endpoints).toHaveLength(2);
    expect(partial.endpoints[0].geographyId).toBeUndefined();
  });
});

/* ── 7 · THE CONTRACT IMPLIES NO DATA ───────────────────────────────── */

describe('ECON-CONTRACT-1 · declaring a vocabulary is not claiming the data', () => {
  it('names the availability states without asserting one', () => {
    expect(ECONOMY_OBSERVATION_AVAILABILITY_STATES).toEqual([
      'OBSERVED',
      'NO_OBSERVATION_SOURCE',
      'FIXTURE',
    ]);
  });

  it('a FIXTURE is never an observation source', () => {
    expect(economyHasObservationSource('OBSERVED')).toBe(true);
    expect(economyHasObservationSource('NO_OBSERVATION_SOURCE')).toBe(false);
    expect(economyHasObservationSource('FIXTURE')).toBe(false);
  });

  it('the shipped module exports NO producer, transport or locale type', () => {
    const js = readFileSync(join(__dirname, '../../../shared/dist/economy/index.js'), 'utf-8');
    const dts = readFileSync(join(__dirname, '../../../shared/dist/economy/index.d.ts'), 'utf-8');

    /*
      COMMENTS ARE STRIPPED FIRST, AND THAT MATTERS. A first version of this guard matched
      the word "provider" inside this contract's own prose explaining that it declares no
      provider — the guard fired on its own documentation. Prose is not behaviour; the test
      is only meaningful against executable code.
    */
    const code = js
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ');

    // Executable transport, environment access or scheduling — none may exist.
    expect(code).not.toMatch(/\bfetch\s*\(|\brequire\s*\(\s*['\"](?:http|https|axios)/);
    expect(code).not.toMatch(/process\.env|setInterval\s*\(|setTimeout\s*\(/);
    // POSITIVE CONTROL: the stripper left the executable body intact.
    expect(code).toContain('ECONOMY_RELEASE_STATUSES');
    expect(code).toContain('economyObservationKey');

    // No locale type is introduced here — A8 belongs to the specialist lane.
    const dtsCode = dts.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    expect(dtsCode).not.toMatch(/DisplayLocale|LanguageCode|EconomyLocale/);
    // A gap must always be able to state a reason.
    expect(dtsCode).toContain('EconomyFigureGapReason');
  });

  it('a gap is a slot with a reason — never a zero and never a null value', () => {
    const gap: EconomyFigureSlot = {
      kind: 'GAP',
      seriesId: 'rw-cpi-yoy',
      periodId: '2026-Q1',
      reason: 'NO_PRODUCER',
    };
    expect(gap.kind).toBe('GAP');
    expect('observation' in gap).toBe(false);
    expect(Object.values(gap)).not.toContain(0);
  });
});

/* ── 8 · PROVENANCE — NO SECOND EVIDENCE SYSTEM ─────────────────────── */

describe('ECON-CONTRACT-1 · provenance reuses the platform model', () => {
  it('classifies the RECORD, not the institution', () => {
    expect(economyEvidenceRoleFor('POLICY_DECISION_RECORD')).toBe('PRIMARY_RECORD');
    expect(economyEvidenceRoleFor('STATISTICAL_RELEASE')).toBe('REFERENCE_DATA');
    expect(economyEvidenceRoleFor('FORECAST_PUBLICATION')).toBe('CONTEXT');
    expect(economyEvidenceRoleFor('REPORTING_ON_ECONOMY')).toBe('REPORTING');
  });

  it('the same institution on the same day yields two different evidence roles', () => {
    expect(economyEvidenceRoleFor('POLICY_DECISION_RECORD')).not.toBe(
      economyEvidenceRoleFor('STATISTICAL_RELEASE'),
    );
  });

  it('an observation carries the platform SourceProvenance, not an Economy vocabulary', () => {
    const o = observation();
    expect(o.provenance.sourceType).toBe('PUBLIC_DATA');
    expect(economyEvidenceRoleFor('STATISTICAL_RELEASE')).toBe('REFERENCE_DATA');
  });

  it('the mapping is total over the claim kinds', () => {
    for (const k of ECONOMY_CLAIM_KINDS) {
      expect(typeof economyEvidenceRoleFor(k)).toBe('string');
    }
    expect(ECONOMY_CLAIM_KINDS).toHaveLength(4);
  });
});

/* ── 9 · THE RECONCILIATION IS MACHINE-CHECKED ──────────────────────── */

describe('ECON-CONTRACT-1 · every legacy vocabulary maps totally onto the contract', () => {
  it('frontend release statuses map, and PRELIM was only a spelling', () => {
    expect(Object.values(ECONOMY_LEGACY_UI_RELEASE_STATUS).every((v) =>
      (ECONOMY_RELEASE_STATUSES as readonly string[]).includes(v),
    )).toBe(true);
    expect(ECONOMY_LEGACY_UI_RELEASE_STATUS.PRELIM).toBe('PRELIMINARY');
  });

  it('frontend value kinds map, and OBSERVED was ACTUAL under another name', () => {
    expect(ECONOMY_LEGACY_UI_VALUE_KIND.OBSERVED).toBe('ACTUAL');
    expect(ECONOMY_LEGACY_UI_VALUE_KIND.ESTIMATED).toBe('DERIVED');
    expect(Object.values(ECONOMY_LEGACY_UI_VALUE_KIND).every((v) =>
      (ECONOMY_VALUE_KINDS as readonly string[]).includes(v),
    )).toBe(true);
  });

  it('frontend freshness maps for the three that ARE freshness states', () => {
    expect(ECONOMY_LEGACY_UI_FRESHNESS.CURRENT).toBe('FRESH');
    expect(ECONOMY_LEGACY_UI_FRESHNESS.DELAYED).toBe('STALE');
    expect(Object.keys(ECONOMY_LEGACY_UI_FRESHNESS)).toHaveLength(3);
  });

  it('and UNAVAILABLE deliberately has NO freshness mapping — the ruling, asserted', () => {
    expect(Object.keys(ECONOMY_LEGACY_UI_FRESHNESS)).not.toContain('UNAVAILABLE');
    // It maps to a gap reason instead, which is where absence belongs.
    expect(Object.keys(ECONOMY_LEGACY_UI_GAP_REASON)).toEqual([
      'NOT_COLLECTED',
      'WITHHELD',
      'DISCONTINUED',
    ]);
  });

  it('frontend source classes map one-to-one onto claim kinds — no presentation loss', () => {
    const mapped = Object.values(ECONOMY_LEGACY_UI_SOURCE_CLASS);
    expect(new Set(mapped).size).toBe(4);
    expect(mapped.every((v) => (ECONOMY_CLAIM_KINDS as readonly string[]).includes(v))).toBe(true);
  });

  it('corridor capability naming reconciles without changing any value', () => {
    expect(ECONOMY_LEGACY_UI_CORRIDOR_CAPABILITY.ROUTE_GEOMETRY).toBe('ROUTE_SUPPORTED');
    expect(ECONOMY_LEGACY_UI_CORRIDOR_CAPABILITY.ENDPOINT_ONLY).toBe('ENDPOINT_ONLY');
  });

  it('backend change states map onto the platform seven, with INSUFFICIENT_EVIDENCE as NULL', () => {
    expect(ECONOMY_LEGACY_DATA_CHANGE_STATE.MATERIAL_CHANGE).toBe('SIGNIFICANT_CHANGE');
    expect(ECONOMY_LEGACY_DATA_CHANGE_STATE.NO_MATERIAL_CHANGE).toBe('NO_MATERIAL_CHANGE');
    expect(ECONOMY_LEGACY_DATA_CHANGE_STATE.INSUFFICIENT_EVIDENCE).toBeNull();
    for (const v of Object.values(ECONOMY_LEGACY_DATA_CHANGE_STATE)) {
      if (v !== null) expect(WATCH_CHANGE_STATES).toContain(v);
    }
  });

  it('backend release statuses are already canonical — the identity map is total', () => {
    for (const s of ECONOMY_RELEASE_STATUSES) {
      expect(ECONOMY_LEGACY_DATA_RELEASE_STATUS[s]).toBe(s);
    }
  });

  it('the seven Economy categories are declared once, here', () => {
    expect(ECONOMY_CATEGORIES).toHaveLength(7);
    expect(new Set(ECONOMY_CATEGORIES).size).toBe(7);
  });
});
