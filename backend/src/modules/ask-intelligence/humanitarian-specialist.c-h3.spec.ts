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
import type { AskContributorSelection } from './ask-contribution.contract';
import { governedPrompt } from './governed-answer';
import {
  HUMANITARIAN_SPECIALIST_BINDING,
  humanitarianContribution,
  humanitarianSpecialistMayBind,
} from './humanitarian-specialist.adapter';

/**
 * HUMANITARIAN CONVERGENCE — C-H3 (CTO ruling), with E1 R2 · C1 applied. The Ask path is a
 * disclosure surface: retained evidence → model context → generated answer → durable Ask result.
 * Proven over the two artefacts that leave the adapter: the governed PROMPT the model receives
 * and the CONTRIBUTION SET persisted in the stored Ask result.
 *
 * Reader admission is NOT a parameter (C1): the adapter binds E1's `readerAdmissionFromRuling()`.
 * The counterfactual pair therefore changes the RULING, not a caller predicate — a mocked ruling
 * that clears GDACS only — so a permanently refusing adapter still cannot pass, and the real
 * ruling (no source reader-cleared) is asserted to refuse every row.
 */

jest.mock('../humanitarian/reader-clearance.ruling', () => {
  const actual = jest.requireActual('../humanitarian/reader-clearance.ruling');
  return { ...actual, readerAdmissionFromRuling: jest.fn(actual.readerAdmissionFromRuling) };
});
const admissionMock = readerClearance.readerAdmissionFromRuling as jest.Mock;
const actualAdmission = jest.requireActual('../humanitarian/reader-clearance.ruling')
  .readerAdmissionFromRuling as typeof readerClearance.readerAdmissionFromRuling;
/** A ruling world in which exactly one source is reader-cleared. */
const clearOnly = (source: string) =>
  admissionMock.mockImplementation(
    () => (r: { observation?: { identity?: { upstreamAuthority?: unknown } } }) =>
      r?.observation?.identity?.upstreamAuthority === source,
  );
beforeEach(() => admissionMock.mockImplementation(actualAdmission));

const AT = '2026-10-01T00:00:00.000Z';
const PROTECTED_TITLE = 'PROTECTED-SHELTER-LOCATION-7f3a';
const OPEN_TITLE = 'Flood in the lower basin';

function observation(
  id: string,
  title: string,
  geometryRecordKey?: string,
  provider = 'GDACS',
): HumanitarianObservation {
  const identity = humanitarianIdentity(provider, id);
  return {
    observationKey: domainObservationKey(identity),
    identity,
    observationKind: 'HUMANITARIAN_EVENT',
    subjectType: 'SOURCE_EVENT',
    subjectId: id,
    claim: {
      claimType: 'HUMANITARIAN_EVENT',
      hazardType: 'FLOOD',
      sourceNativeType: 'FL',
      sourceTitle: title,
      eventStatus: 'ONGOING',
      sourceSeverityStated: 'Red',
      countryIso3: ['RWA'],
      originatingAgency: 'GLOFAS',
      ...(geometryRecordKey === undefined ? {} : { geometryRecordKey }),
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
  } as HumanitarianObservation;
}
const row = (
  id: string,
  title: string,
  geom?: string,
  provider = 'GDACS',
): HumanitarianRetainedRecord => ({
  captureKey: `capture-${id}`,
  publisherReleasedAt: AT,
  observation: observation(id, title, geom, provider),
});
/** The protected record comes from a source no ruling clears. */
const protectedRow = () => row('secret', PROTECTED_TITLE, undefined, 'COPERNICUS_EMS');
const selection: AskContributorSelection = {
  contributorId: 'HUMANITARIAN',
  domain: 'humanitarian',
  applicability: 'SUPPLEMENTARY',
  scope: { countryIso3: 'RWA', district: null, place: null },
};
/** Shared-contract constructor predicate for building fixtures (the contract itself is tested). */
const admitGdacs = (r: HumanitarianRetainedRecord) =>
  r.observation.identity.upstreamAuthority === 'GDACS';

/** Everything that leaves the adapter: the model's governed prompt and the stored result. */
function surfaces(read: HumanitarianRetainedRead) {
  const contribution = humanitarianContribution(read, selection);
  const set = { considered: [selection], contributions: [contribution] };
  const prompt = governedPrompt(set);
  return {
    contribution,
    modelContext: `${prompt.rules}\n${prompt.data}`,
    /* the record DATA the model receives (rule wording may name what is forbidden) */
    modelData: prompt.data,
    stored: JSON.stringify(set),
  };
}

describe('C1 — reader admission is ruling-derived, never a caller predicate', () => {
  it('the adapter takes no admission parameter', () => {
    expect(humanitarianContribution.length).toBe(2);
    const src = readFileSync(join(__dirname, 'humanitarian-specialist.adapter.ts'), 'utf8');
    expect(src).toContain('readerAdmissionFromRuling()');
    expect(src).not.toMatch(/HumanitarianReaderAdmission/);
  });

  it('REAL RULING (no source reader-cleared): every retained row is refused today', () => {
    const forged: HumanitarianRetainedRead = {
      kind: 'RETAINED',
      observations: [row('open', OPEN_TITLE)],
    };
    const { contribution, modelContext, stored } = surfaces(forged);
    expect(contribution.status).toBe('REFUSED');
    for (const surface of [modelContext, stored]) expect(surface).not.toContain(OPEN_TITLE);
  });
});

describe('C-H3 — only reader-admissible Humanitarian evidence reaches the model or the stored result', () => {
  it('COUNTERFACTUAL (open): a ruling that clears the source makes the record USED, verbatim, with attribution', () => {
    clearOnly('GDACS');
    const read = humanitarianRetainedRead([row('open', OPEN_TITLE)], admitGdacs);
    const { contribution, modelContext, stored } = surfaces(read);
    expect(contribution.status).toBe('USED');
    expect(contribution.observations).toHaveLength(1);
    expect(modelContext).toContain(OPEN_TITLE);
    expect(stored).toContain(OPEN_TITLE);
    /* E1 R2 B3/B4: both names and the retention time reach the model and the stored result */
    for (const surface of [modelContext, stored]) {
      expect(surface).toContain('Global Disaster Alert and Coordination System, GDACS');
      expect(surface).toContain('GLOFAS');
    }
    expect(modelContext).toContain('retainedAt');
  });

  it('COUNTERFACTUAL (protected): a forged read carrying a non-cleared source leaks nothing', () => {
    clearOnly('GDACS');
    const forged: HumanitarianRetainedRead = {
      kind: 'RETAINED',
      observations: [row('open', OPEN_TITLE), protectedRow()],
    };
    const { contribution, modelContext, stored } = surfaces(forged);
    expect(contribution.status).toBe('REFUSED');
    expect(contribution.observations).toEqual([]);
    for (const surface of [modelContext, stored]) {
      expect(surface).not.toContain(PROTECTED_TITLE);
      expect(surface).not.toContain(protectedRow().observation.observationKey);
      /* the whole contribution is refused: the open sibling is not silently kept either */
      expect(surface).not.toContain(OPEN_TITLE);
    }
  });

  it('the read constructor refuses the protected row before any adapter is reached', () => {
    expect(() => humanitarianRetainedRead([protectedRow()], admitGdacs)).toThrow(/HUM-READ-5/);
  });

  it('a GDACS row without its originating agency does not travel (attribution or nothing)', () => {
    clearOnly('GDACS');
    const r = row('open', OPEN_TITLE);
    const claim = { ...(r.observation.claim as unknown as Record<string, unknown>) };
    delete claim.originatingAgency;
    const bare = {
      ...r,
      observation: { ...r.observation, claim },
    } as unknown as HumanitarianRetainedRecord;
    const { contribution } = surfaces({ kind: 'RETAINED', observations: [bare] });
    expect(contribution.status).toBe('REFUSED');
  });

  it('governed geometry never reaches the model or the result (C-3), even from a cleared source', () => {
    clearOnly('GDACS');
    const forged: HumanitarianRetainedRead = {
      kind: 'RETAINED',
      observations: [row('open', OPEN_TITLE, 'geom:copernicus:EMSR777')],
    };
    const { contribution, modelContext, stored } = surfaces(forged);
    expect(contribution.status).toBe('REFUSED');
    for (const surface of [modelContext, stored]) expect(surface).not.toContain('EMSR777');
  });

  it('a USED contribution carries no coordinates, geometry key, capture key or source severity', () => {
    clearOnly('GDACS');
    const read = humanitarianRetainedRead([row('open', OPEN_TITLE)], admitGdacs);
    const { modelData, stored } = surfaces(read);
    for (const surface of [modelData, stored]) {
      expect(surface).not.toMatch(/coordinates|geometryRecordKey|capture-open|rawBase64/);
      /* GDACS's own alert level is not ours to restate (E1) and is not passed to the model */
      expect(surface).not.toMatch(/"Red"|sourceSeverityStated/);
    }
  });

  it('absences stay absences: none can be read as "nothing happened"', () => {
    const cases: [HumanitarianRetainedRead, string][] = [
      [humanitarianReadAbsence('NOT_ASSESSED'), 'NOT_ASSESSED'],
      [humanitarianReadAbsence('SOURCE_NOT_CONNECTED'), 'DEGRADED'],
      [humanitarianRetainedRead([], admitGdacs), 'NO_DATA'],
    ];
    for (const [read, status] of cases) {
      const { contribution, modelContext, stored } = surfaces(read);
      expect(contribution.status).toBe(status);
      expect(contribution.observations).toEqual([]);
      /* lossy: no source topology reaches the model or the stored result */
      for (const surface of [modelContext, stored]) {
        expect(surface).not.toMatch(/SOURCE_NOT_CONNECTED|SOURCE_TEMPORARILY_UNAVAILABLE/);
      }
      expect(modelContext).toMatch(/not|never/i);
      expect(contribution.disclosures).toContain('IMPACT_NOT_ASSESSED');
    }
  });
});

describe('LIVE: Humanitarian stays SPECIALIST_NOT_BOUND / CAPABILITY_UNAVAILABLE', () => {
  const src = (f: string) => readFileSync(join(__dirname, f), 'utf8');

  it('the adapter declares itself unbound', () => {
    expect(HUMANITARIAN_SPECIALIST_BINDING).toBe('SPECIALIST_NOT_BOUND');
  });

  it('nothing in the live path imports the adapter', () => {
    for (const f of [
      'ask-specialist-read.coordinator.ts',
      'ask-intelligence.module.ts',
      'contributor-selection.ts',
    ]) {
      expect(src(f)).not.toContain('humanitarian-specialist.adapter');
    }
  });

  it('the live coordinator still answers NOT_ASSESSED, and only CONFLICT is a bound specialist', () => {
    const coordinator = src('ask-specialist-read.coordinator.ts');
    expect(coordinator).toContain("case 'HUMANITARIAN':");
    expect(coordinator).toContain("degradationReason: 'NO_GOVERNED_OBSERVATION_READER'");
    expect(coordinator).toMatch(
      /boundSpecialistDomains\(\): readonly string\[\] \{\s*return \['CONFLICT'\];/,
    );
  });

  it('the frozen router keeps CAPABILITY_UNAVAILABLE (not replaced by PLAN_NOT_SATISFIABLE)', () => {
    /* Read-only: frozen C is never edited. */
    const frozen = join(__dirname, '..', 'ask-router', 'frozen-c', 'src');
    const all = ['planner.ts', 'ports.ts']
      .map((f) => readFileSync(join(frozen, f), 'utf8'))
      .join('\n');
    expect(all).toContain('CAPABILITY_UNAVAILABLE');
    expect(all).not.toContain('PLAN_NOT_SATISFIABLE');
  });
});

describe('BINDING GATE — dev capture never binds the Humanitarian specialist (lane C rule)', () => {
  it('E1 R2 as ruled today (GDACS rights-blocked): the specialist may not bind', () => {
    expect(humanitarianSpecialistMayBind()).toBe(false);
  });

  it('dev-capture alone never binds, whatever else is not cleared', () => {
    expect(
      humanitarianSpecialistMayBind({
        GDACS: { verdict: 'CLEARED_FOR_DEV_CAPTURE' },
        RELIEFWEB: { verdict: 'CREDENTIAL_REQUIRED' },
        COPERNICUS_EMS: { verdict: 'PROTECTION_AUTHORITY_REQUIRED' },
      }),
    ).toBe(false);
  });

  it('POSITIVE COUNTERFACTUAL: a runtime-cleared source does make it bindable (the gate is not a constant false)', () => {
    expect(
      humanitarianSpecialistMayBind({
        GDACS: { verdict: 'CLEARED_FOR_ALPHA_RUNTIME' },
        RELIEFWEB: { verdict: 'CREDENTIAL_REQUIRED' },
      }),
    ).toBe(true);
  });
});
