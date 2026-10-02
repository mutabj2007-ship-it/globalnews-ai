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
import type { AskContributorSelection } from './ask-contribution.contract';
import { governedPrompt } from './governed-answer';
import {
  HUMANITARIAN_SPECIALIST_BINDING,
  humanitarianContribution,
  humanitarianSpecialistMayBind,
} from './humanitarian-specialist.adapter';

/**
 * HUMANITARIAN CONVERGENCE — C-H3 (CTO ruling). The Ask path is a disclosure surface:
 *   retained evidence → model context → generated answer → durable Ask result.
 * Proven here end to end over the two artefacts that leave the adapter: the governed PROMPT the
 * model receives (`governedPrompt`) and the CONTRIBUTION SET persisted in the stored Ask result.
 *
 * Counterfactual pair (so a permanently refusing adapter cannot pass): the same record that is
 * refused while protected is USED, verbatim, once it is reader-admissible.
 */

const AT = '2026-10-01T00:00:00.000Z';
const PROTECTED_TITLE = 'PROTECTED-SHELTER-LOCATION-7f3a';
const OPEN_TITLE = 'Flood in the lower basin';

function observation(
  id: string,
  title: string,
  geometryRecordKey?: string,
): HumanitarianObservation {
  const identity = humanitarianIdentity('GDACS', id);
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
      ...(geometryRecordKey === undefined ? {} : { geometryRecordKey }),
    },
    temporal: { publisherVintage: AT, retrievedAt: AT, temporalBasis: 'PUBLISHER_VINTAGE' },
    provenance: {
      sourceType: 'PUBLIC_DATA',
      providerId: 'GDACS',
      institution: 'Global Disaster Alert and Coordination System, GDACS',
      retrievedAt: AT,
      evidenceRole: 'PRIMARY_RECORD',
    },
    sourceReference: { sourceUrl: `https://www.gdacs.org/report.aspx?eventid=${id}` },
    attributeAuthorship: [{ attribute: 'hazardType', authorship: 'PUBLISHER_STATED' }],
    revision: { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: AT },
  } as HumanitarianObservation;
}
const row = (id: string, title: string, geom?: string): HumanitarianRetainedRecord => ({
  captureKey: `capture-${id}`,
  publisherReleasedAt: AT,
  observation: observation(id, title, geom),
});
const selection: AskContributorSelection = {
  contributorId: 'HUMANITARIAN',
  domain: 'humanitarian',
  applicability: 'SUPPLEMENTARY',
  scope: { countryIso3: 'RWA', district: null, place: null },
};
/** Reader admission: only the open record's capture is reader-authorized. */
const admitOpenOnly = (r: HumanitarianRetainedRecord) => r.captureKey === 'capture-open';

/** Everything that leaves the adapter: the model's governed prompt and the stored result. */
function surfaces(read: HumanitarianRetainedRead, admit = admitOpenOnly) {
  const contribution = humanitarianContribution(read, selection, admit);
  const set = { considered: [selection], contributions: [contribution] };
  const prompt = governedPrompt(set);
  return {
    contribution,
    modelContext: `${prompt.rules}\n${prompt.data}`,
    stored: JSON.stringify(set),
  };
}

describe('C-H3 — only reader-admissible Humanitarian evidence reaches the model or the stored result', () => {
  it('COUNTERFACTUAL (open): an admissible record is USED and reaches the model verbatim', () => {
    const read = humanitarianRetainedRead([row('open', OPEN_TITLE)], admitOpenOnly);
    const { contribution, modelContext, stored } = surfaces(read);
    expect(contribution.status).toBe('USED');
    expect(contribution.observations).toHaveLength(1);
    expect(modelContext).toContain(OPEN_TITLE);
    expect(stored).toContain(OPEN_TITLE);
  });

  it('COUNTERFACTUAL (protected): a forged read carrying a protected row leaks nothing', () => {
    /* A read built WITHOUT the constructor (the bypass the adapter must not trust). */
    const forged: HumanitarianRetainedRead = {
      kind: 'RETAINED',
      observations: [row('open', OPEN_TITLE), row('secret', PROTECTED_TITLE)],
    };
    const { contribution, modelContext, stored } = surfaces(forged);
    expect(contribution.status).toBe('REFUSED');
    expect(contribution.observations).toEqual([]);
    for (const surface of [modelContext, stored]) {
      expect(surface).not.toContain(PROTECTED_TITLE);
      expect(surface).not.toContain(observation('secret', PROTECTED_TITLE).observationKey);
      /* the whole contribution is refused: the open sibling is not silently kept either */
      expect(surface).not.toContain(OPEN_TITLE);
    }
  });

  it('the read constructor refuses the protected row before any adapter is reached', () => {
    expect(() => humanitarianRetainedRead([row('secret', PROTECTED_TITLE)], admitOpenOnly)).toThrow(
      /HUM-READ-5/,
    );
  });

  it('governed geometry never reaches the model or the result (C-3), even when "admitted"', () => {
    const forged: HumanitarianRetainedRead = {
      kind: 'RETAINED',
      observations: [row('open', OPEN_TITLE, 'geom:copernicus:EMSR777')],
    };
    const { contribution, modelContext, stored } = surfaces(forged, () => true);
    expect(contribution.status).toBe('REFUSED');
    for (const surface of [modelContext, stored]) expect(surface).not.toContain('EMSR777');
  });

  it('a USED contribution carries no coordinates, geometry key, capture key or source severity', () => {
    const read = humanitarianRetainedRead([row('open', OPEN_TITLE)], admitOpenOnly);
    const { modelContext, stored } = surfaces(read);
    for (const surface of [modelContext, stored]) {
      expect(surface).not.toMatch(/coordinates|geometryRecordKey|capture-open|rawBase64/);
      /* GDACS's own alert level is not ours to restate (E1) and is not passed to the model */
      expect(surface).not.toMatch(/"Red"|sourceSeverityStated/);
    }
  });

  it('absences stay absences: none can be read as "nothing happened"', () => {
    const cases: [HumanitarianRetainedRead, string][] = [
      [humanitarianReadAbsence('NOT_ASSESSED'), 'NOT_ASSESSED'],
      [humanitarianReadAbsence('SOURCE_NOT_CONNECTED'), 'DEGRADED'],
      [humanitarianRetainedRead([], admitOpenOnly), 'NO_DATA'],
    ];
    for (const [read, status] of cases) {
      const { contribution, modelContext, stored } = surfaces(read);
      expect(contribution.status).toBe(status);
      expect(contribution.observations).toEqual([]);
      /* lossy: no source topology reaches the model or the stored result */
      for (const surface of [modelContext, stored]) {
        expect(surface).not.toMatch(/SOURCE_NOT_CONNECTED|SOURCE_TEMPORARILY_UNAVAILABLE/);
      }
      if (status !== 'DEGRADED') expect(modelContext).toMatch(/not|never/i);
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

describe('BINDING GATE — CLEARED_FOR_DEV_CAPTURE never binds the Humanitarian specialist (lane C rule)', () => {
  it('E1 R1 as ruled today: the specialist may not bind', () => {
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
