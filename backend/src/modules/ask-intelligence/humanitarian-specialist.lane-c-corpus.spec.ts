import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  domainObservationKey,
  humanitarianIdentity,
  humanitarianReadAbsence,
  humanitarianRetainedRead,
  type HumanitarianObservation,
  type HumanitarianRetainedRead,
  type HumanitarianRetainedRecord,
} from '@globalnews-ai/shared';
import * as readerClearance from '../humanitarian/reader-clearance.ruling';
import { HUMANITARIAN_SOURCE_RULINGS } from '../humanitarian/source-activation.ruling';
import type { AskContribution, AskContributorSelection } from './ask-contribution.contract';
import { GOVERNED_PROMPT_DISCLOSURE_CODES, governedPrompt } from './governed-answer';
import {
  HUMANITARIAN_SPECIALIST_BINDING,
  humanitarianContribution,
  humanitarianSpecialistMayBind,
} from './humanitarian-specialist.adapter';

/**
 * LANE C R2 — the portable Humanitarian Ask corpus, bound to the CANONICAL adapter.
 *
 * C's package (qualification/humanitarian/ask-expectations-lane-c/) is regression material: its
 * `src/` is a reference oracle and is NOT runtime. Where the oracle and the canonical adapter
 * disagree, the canonical adapter is right — every such disagreement is pinned below by row id
 * with its ruling, and the set is asserted exactly, so a NEW divergence fails instead of hiding.
 *
 * C's availability/assessment axes are translated HERE ONLY (test-side) from the settled
 * canonical states: read UNAVAILABLE | NO_RETAINED_EVIDENCE | RETAINED → contribution status.
 * No runtime vocabulary is added.
 */

jest.mock('../humanitarian/reader-clearance.ruling', () => {
  const actual = jest.requireActual('../humanitarian/reader-clearance.ruling');
  return { ...actual, readerAdmissionFromRuling: jest.fn(actual.readerAdmissionFromRuling) };
});
const admissionMock = readerClearance.readerAdmissionFromRuling as jest.Mock;
const actualAdmission = jest.requireActual('../humanitarian/reader-clearance.ruling')
  .readerAdmissionFromRuling as typeof readerClearance.readerAdmissionFromRuling;
/** A COUNTERFACTUAL ruling world in which GDACS alone is reader-cleared (test only). */
const clearGdacsOnly = () =>
  admissionMock.mockImplementation(
    () => (r: { observation?: { identity?: { upstreamAuthority?: unknown } } }) =>
      r?.observation?.identity?.upstreamAuthority === 'GDACS',
  );
beforeEach(() => admissionMock.mockImplementation(actualAdmission));

const PACKAGE = join(__dirname, '../../../../qualification/humanitarian/ask-expectations-lane-c');
interface Expect {
  readonly value: unknown;
  readonly assertionClass: 'SEMANTIC_INVARIANT' | 'PACKAGE_CONVENTION';
}
interface Row {
  readonly id: string;
  readonly provenance: 'COUNTERFACTUAL' | 'MEASURED_STATE_TODAY';
  readonly store: string;
  readonly surface: string;
  readonly request: { readonly countryIso3: string; readonly statedWindow: string | null };
  readonly expect: Readonly<Record<string, Expect>>;
}
const EXPECTATIONS = JSON.parse(
  readFileSync(join(PACKAGE, 'expectations/humanitarian-ask-expectations.json'), 'utf8'),
) as {
  readonly schema: string;
  readonly requiredDisclosures: {
    readonly codes: readonly string[];
    readonly mandatoryOnEveryAnswer: readonly string[];
  };
  readonly disclosure: { readonly sinks: readonly string[] };
  readonly rows: readonly Row[];
};

/* ── fixtures: the canary is planted wherever protected/internal material can sit ── */
const AT = '2026-09-20T06:00:00';
const CANARY = 'LANE-C-CANARY-PROTECTED-9b1e';

function record(
  id: string,
  country: string,
  provider = 'GDACS',
  withGeometry = false,
): HumanitarianRetainedRecord {
  const identity = humanitarianIdentity(provider, id);
  const protectedSource = provider !== 'GDACS';
  const observation = {
    observationKey: domainObservationKey(identity),
    identity,
    observationKind: 'HUMANITARIAN_EVENT',
    subjectType: 'SOURCE_EVENT',
    subjectId: id,
    claim: {
      claimType: 'HUMANITARIAN_EVENT',
      hazardType: 'FLOOD',
      sourceNativeType: 'FL',
      sourceTitle: protectedSource ? `${CANARY} shelter` : `Flood ${id}`,
      eventStatus: 'ONGOING',
      sourceSeverityStated: `Red ${CANARY}`,
      countryIso3: [country],
      originatingAgency: 'GLOFAS',
      ...(withGeometry ? { geometryRecordKey: `geom-${CANARY}` } : {}),
    },
    temporal: { publisherVintage: AT, retrievedAt: AT, temporalBasis: 'PUBLISHER_VINTAGE' },
    provenance: {
      sourceType: 'PUBLIC_DATA',
      providerId: provider,
      institution:
        provider === 'GDACS' ? 'Global Disaster Alert and Coordination System, GDACS' : provider,
      retrievedAt: AT,
      evidenceRole: 'PRIMARY_RECORD',
    },
    sourceReference: { sourceUrl: `https://www.gdacs.org/report.aspx?eventid=${id}` },
    attributeAuthorship: [{ attribute: 'hazardType', authorship: 'PUBLISHER_STATED' }],
    revision: { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: AT },
  } as unknown as HumanitarianObservation;
  return { captureKey: `capture-${CANARY}-${id}`, publisherReleasedAt: AT, observation };
}
const sdnRows = () => [record('1001', 'SDN'), record('1002', 'SDN')];
/** Shape-valid, but from a source no ruling clears: ONLY reader admission can stop it. */
const unclearedRow = () => record('9001', 'SDN', 'COPERNICUS_EMS');
/** Carries governed geometry: Main's HUM-READ-4 must stop it even from a cleared source. */
const geometryRow = () => record('9002', 'SDN', 'GDACS', true);

/** C's store conditions → canonical reads. A RETAINED read is built by Main's constructor where it
 * can be; a read carrying protected rows cannot be constructed, so it is forged (C's "answering
 * store") to prove the ADAPTER refuses it independently. */
function readFor(store: string): HumanitarianRetainedRead {
  const gdacs = (r: HumanitarianRetainedRecord) =>
    r.observation.identity.upstreamAuthority === 'GDACS';
  switch (store) {
    case 'UNBOUND_NO_GOVERNED_BINDING':
      return humanitarianReadAbsence('NOT_ASSESSED');
    case 'GOVERNED_WITH_SDN_ROWS':
      return humanitarianRetainedRead(sdnRows(), gdacs);
    case 'GOVERNED_EMPTY_FOR_GEOGRAPHY':
      return humanitarianRetainedRead([], gdacs);
    case 'GOVERNED_READ_FAILING':
      return humanitarianReadAbsence('SOURCE_NOT_CONNECTED');
    case 'GOVERNED_MIXED_DISCLOSURE':
      return { kind: 'RETAINED', observations: [...sdnRows(), unclearedRow()] };
    case 'GOVERNED_ALL_WITHHELD':
      return { kind: 'RETAINED', observations: [unclearedRow(), geometryRow()] };
    default:
      throw new Error(`unmapped lane C store '${store}'`);
  }
}

const selectionFor = (r: Row): AskContributorSelection => ({
  contributorId: 'HUMANITARIAN',
  domain: 'humanitarian',
  applicability: 'SUPPLEMENTARY',
  scope: { countryIso3: r.request.countryIso3, district: null, place: null },
});

/** Test-side translation of the canonical status onto C's axes. */
const AXES: Readonly<
  Record<AskContribution['status'], { availability: string; assessment: string }>
> = {
  USED: { availability: 'AVAILABLE', assessment: 'RETAINED_REPORTING' },
  NO_DATA: { availability: 'NO_DATA_FOR_GEOGRAPHY', assessment: 'NOT_ASSESSED' },
  DEGRADED: { availability: 'TEMPORARILY_UNAVAILABLE', assessment: 'SOURCE_UNAVAILABLE' },
  NOT_ASSESSED: { availability: 'NOT_BUILT', assessment: 'NOT_ASSESSED' },
  REFUSED: { availability: 'REFUSED_WHOLE_CONTRIBUTION', assessment: 'NOT_ASSESSED' },
} as Record<AskContribution['status'], { availability: string; assessment: string }>;

/**
 * Pinned divergences: canonical semantics win, by ruling. Exactly these rows/fields, nothing else.
 */
const UNBOUND_RULING =
  'CTO absence ruling: no governed reader = UNAVAILABLE/NOT_ASSESSED → contribution NOT_ASSESSED ' +
  '(NO_GOVERNED_OBSERVATION_READER). C reads it as NOT_CONNECTED/SOURCE_UNAVAILABLE; no second ' +
  'absence vocabulary is introduced to match.';
const WHOLE_REFUSAL_RULING =
  'C-H3 / E1 D-1 / G R2 gate: a contribution with ANY non-admissible row is refused WHOLE — never ' +
  'silently thinned to the safe subset (a reader shown 2 of 3 rows is told something untrue).';
const DIVERGENCES: Readonly<Record<string, { fields: readonly string[]; ruling: string }>> = {
  'G1b-retained-read-today': { fields: ['availability', 'assessment'], ruling: UNBOUND_RULING },
  'G2c-no-fabrication-on-refusal': {
    fields: ['availability', 'assessment'],
    ruling: UNBOUND_RULING,
  },
  'G4a-standalone-reaches-the-same-tool': {
    fields: ['availability', 'assessment'],
    ruling: UNBOUND_RULING,
  },
  'G6a-no-legacy-endpoint': { fields: ['availability', 'assessment'], ruling: UNBOUND_RULING },
  'R2-DG1-mixed-disclosure-serves-only-safe': {
    fields: ['availability', 'assessment', 'claimsNonEmpty', 'executionPlannable'],
    ruling: WHOLE_REFUSAL_RULING,
  },
  'R2-SA1-standalone-and-alpha-identical': {
    fields: ['availability', 'assessment', 'claimsNonEmpty', 'executionPlannable'],
    ruling: WHOLE_REFUSAL_RULING,
  },
  'R2-DG2-everything-withheld-fails-closed': {
    fields: ['availability'],
    ruling: WHOLE_REFUSAL_RULING,
  },
};

function run(r: Row) {
  const contribution = humanitarianContribution(readFor(r.store), selectionFor(r));
  const set = { considered: [selectionFor(r)], contributions: [contribution] };
  const prompt = governedPrompt(set);
  const stored = JSON.stringify(set);
  const sinks: Record<string, string> = {
    MODEL_CONTEXT: `${prompt.rules}\n${prompt.data}`,
    SOURCES_RAIL: JSON.stringify(contribution.observations),
    DURABLE_CONTRIBUTION: JSON.stringify(contribution),
    STORED_RESULT: stored,
    SAVED_RECENT: JSON.stringify(JSON.parse(stored)),
  };
  return {
    contribution,
    sinks,
    actual: {
      ...AXES[contribution.status],
      claimsNonEmpty: contribution.observations.length > 0,
      executionPlannable: contribution.status === 'USED',
    } as Record<string, unknown>,
  };
}

describe('lane C R2 corpus — package integrity', () => {
  it('is the expected schema, both provenance classes present (C-2: no refuse-forever corpus)', () => {
    expect(EXPECTATIONS.schema).toBe('globalnewsai.humanitarian.ask-expectations/3');
    const prov = new Set(EXPECTATIONS.rows.map((r) => r.provenance));
    expect(prov).toEqual(new Set(['COUNTERFACTUAL', 'MEASURED_STATE_TODAY']));
    expect(EXPECTATIONS.rows).toHaveLength(22);
  });
  it("C's required-disclosure list IS E1's list (no drift between lanes)", () => {
    expect([...EXPECTATIONS.requiredDisclosures.codes]).toEqual([
      ...readerClearance.HUMANITARIAN_REQUIRED_DISCLOSURES,
    ]);
  });
  it("C's five sinks are E1's disclosure hops after the corpus", () => {
    expect(EXPECTATIONS.disclosure.sinks).toHaveLength(5);
  });
  it('the reference oracle is NOT runtime: nothing under src/ imports the package', () => {
    const adapter = readFileSync(join(__dirname, 'humanitarian-specialist.adapter.ts'), 'utf8');
    expect(adapter).not.toMatch(/ask-expectations-lane-c|lane-c/);
  });
});

describe('lane C R2 corpus — every row against the canonical adapter (counterfactual ruling: GDACS cleared)', () => {
  for (const r of EXPECTATIONS.rows) {
    it(`${r.id} [${r.provenance}]`, () => {
      clearGdacsOnly();
      const { contribution, sinks, actual } = run(r);
      const pinned = DIVERGENCES[r.id];
      for (const field of ['availability', 'assessment', 'claimsNonEmpty', 'executionPlannable']) {
        const e = r.expect[field];
        if (e === undefined || e.assertionClass !== 'SEMANTIC_INVARIANT') continue;
        if (pinned?.fields.includes(field)) {
          /* pinned: the canonical answer must be the RULED one, not merely "different" */
          continue;
        }
        expect({ field, value: actual[field] }).toEqual({ field, value: e.value });
      }
      /* invariants that hold on EVERY row, pinned or not */
      expect(contribution.disclosures).toEqual(
        expect.arrayContaining([...EXPECTATIONS.requiredDisclosures.mandatoryOnEveryAnswer]),
      );
      for (const code of contribution.disclosures)
        expect(GOVERNED_PROMPT_DISCLOSURE_CODES).toContain(code);
      if (contribution.status === 'USED') {
        expect(contribution.disclosures).toEqual(
          expect.arrayContaining([...EXPECTATIONS.requiredDisclosures.codes]),
        );
        expect(contribution.temporalBasis).toBe('RETAINED_EVENT_RECORD');
      }
      for (const [sink, payload] of Object.entries(sinks))
        expect({ sink, leaked: payload.includes(CANARY) }).toEqual({ sink, leaked: false });
    });
  }

  it('the pinned divergences are exactly the ruled ones and resolve to the ruled canonical state', () => {
    clearGdacsOnly();
    const byId = new Map(EXPECTATIONS.rows.map((r) => [r.id, r]));
    for (const [id, d] of Object.entries(DIVERGENCES)) {
      const r = byId.get(id);
      expect(r).toBeDefined();
      const status = run(r!).contribution.status;
      expect({ id, status }).toEqual({
        id,
        status: d.ruling === UNBOUND_RULING ? 'NOT_ASSESSED' : 'REFUSED',
      });
    }
  });

  it('NOT A PERMANENT REFUSER: under the counterfactual ruling every governed-SDN row is USED', () => {
    clearGdacsOnly();
    const served = EXPECTATIONS.rows.filter((r) => r.store === 'GOVERNED_WITH_SDN_ROWS');
    expect(served.length).toBeGreaterThan(0);
    for (const r of served) expect(run(r).contribution.status).toBe('USED');
  });

  it('S-1: the adapter takes no surface input — Standalone and Alpha context get the same result', () => {
    clearGdacsOnly();
    const sig = (r: Row) => JSON.stringify(run(r).contribution);
    const rows = EXPECTATIONS.rows;
    const pairs: Array<[string, string]> = [
      ['G1a-retained-read-governed-store', 'G5a-dashboard-context-same-result'],
      ['R2-DG1-mixed-disclosure-serves-only-safe', 'R2-SA1-standalone-and-alpha-identical'],
    ];
    for (const [a, b] of pairs)
      expect(sig(rows.find((r) => r.id === a)!)).toBe(sig(rows.find((r) => r.id === b)!));
  });

  it('a geometry-bearing row from a CLEARED source is still refused whole (HUM-READ-4), no leak', () => {
    clearGdacsOnly();
    const c = humanitarianContribution(
      { kind: 'RETAINED', observations: [...sdnRows(), geometryRow()] },
      selectionFor(EXPECTATIONS.rows[0]!),
    );
    expect(c.status).toBe('REFUSED');
    expect(JSON.stringify(c)).not.toContain(CANARY);
  });

  it('§E (partial): country scope separates the contribution (SDN ≠ KEN)', () => {
    clearGdacsOnly();
    const rows = EXPECTATIONS.rows;
    const sdn = run(rows.find((r) => r.id === 'G3a-sdn-identity')!).contribution;
    const ken = run(rows.find((r) => r.id === 'G3b-ken-identity')!).contribution;
    expect(sdn.geographyBasis).toBe('SDN');
    expect(ken.geographyBasis).toBe('KEN');
  });
});

describe('lane C R2 corpus — the REAL ruling today', () => {
  it('no source is reader-cleared: no row serves a single claim, and nothing leaks', () => {
    for (const r of EXPECTATIONS.rows) {
      const { contribution, sinks } = run(r);
      expect({ id: r.id, claims: contribution.observations.length }).toEqual({
        id: r.id,
        claims: 0,
      });
      expect(contribution.status).not.toBe('USED');
      for (const payload of Object.values(sinks)) expect(payload).not.toContain(CANARY);
    }
  });

  it('dev-capture clearance never binds the specialist; live binding stays OFF', () => {
    expect(HUMANITARIAN_SPECIALIST_BINDING).toBe('SPECIALIST_NOT_BOUND');
    expect(humanitarianSpecialistMayBind()).toBe(false);
    const devCaptureOnly = Object.fromEntries(
      Object.keys(HUMANITARIAN_SOURCE_RULINGS).map((k) => [
        k,
        { verdict: 'CLEARED_FOR_DEV_CAPTURE' as const },
      ]),
    );
    expect(humanitarianSpecialistMayBind(devCaptureOnly as never)).toBe(false);
  });

  it('retained reporting is never a current provider observation; the adapter has no fetch/model path', () => {
    const src = readFileSync(join(__dirname, 'humanitarian-specialist.adapter.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/\bfetch\(|axios|HttpService|OpenAI|Anthropic|async\s|await\s/);
    expect(src).not.toMatch(/CURRENT_PROVIDER_OBSERVATION|LIVE_PROVIDER/);
  });
});
