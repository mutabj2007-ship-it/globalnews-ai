import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  domainObservationKey,
  humanitarianIdentity,
  humanitarianReadAbsence,
  type HumanitarianObservation,
  type HumanitarianRetainedRead,
  type HumanitarianRetainedRecord,
} from '@globalnews-ai/shared';
import * as readerClearance from '../humanitarian/reader-clearance.ruling';
import {
  HUMANITARIAN_REQUIRED_DISCLOSURES,
  assertDisclosuresRecognised,
} from '../humanitarian/reader-clearance.ruling';
import { buildHumanitarianReaderRead } from '../humanitarian/humanitarian-reader-read';
import { AskR2ExecutionAdapter } from '../ask-v2/ask-r2-execution.adapter';
import { askRequestContext } from '../ask-v2/ask-request-context';
import type { AskRequest } from '../ask-v2/ask-compute.contract';
import type { AskContribution, AskContributorSelection } from './ask-contribution.contract';
import { GOVERNED_PROMPT_DISCLOSURE_CODES, governedPrompt } from './governed-answer';
import { humanitarianContribution } from './humanitarian-specialist.adapter';

/**
 * E1 HUMANITARIAN READER CLEARANCE R2 — the disclosure chain, closed by convergence:
 *   B1 the six required codes are recognised by the canonical prompt, with Humanitarian wording;
 *   B2 a closed registry: every code the adapter can emit is recognised; a new one fails here;
 *   B3 attribution and retention time reach the model (Humanitarian only; others byte-unchanged);
 *   B5 the codes survive into the DURABLE stored Ask result (hop 4); Saved/Recent reopen that
 *      stored payload display-only (hop 5);
 *   C1 production code builds reader reads only through the ruling-bound wrapper.
 */

jest.mock('../humanitarian/reader-clearance.ruling', () => {
  const actual = jest.requireActual('../humanitarian/reader-clearance.ruling');
  return { ...actual, readerAdmissionFromRuling: jest.fn(actual.readerAdmissionFromRuling) };
});
const admissionMock = readerClearance.readerAdmissionFromRuling as jest.Mock;
const actualAdmission = jest.requireActual('../humanitarian/reader-clearance.ruling')
  .readerAdmissionFromRuling as typeof readerClearance.readerAdmissionFromRuling;
const clearGdacs = () =>
  admissionMock.mockImplementation(
    () => (r: { observation?: { identity?: { upstreamAuthority?: unknown } } }) =>
      r?.observation?.identity?.upstreamAuthority === 'GDACS',
  );
beforeEach(() => admissionMock.mockImplementation(actualAdmission));

const AT_NO_TZ = '2026-09-29T15:00:00';
const AT = '2026-10-01T00:00:00.000Z';
function gdacsRow(id: string, countryIso3: string[] = ['RWA']): HumanitarianRetainedRecord {
  const identity = humanitarianIdentity('GDACS', `FL:${id}`);
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
      sourceTitle: `Flood ${id}`,
      eventStatus: 'ONGOING',
      countryIso3,
      originatingAgency: 'GLOFAS',
    },
    temporal: { publisherVintage: AT_NO_TZ, retrievedAt: AT, temporalBasis: 'PUBLISHER_VINTAGE' },
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
  } as unknown as HumanitarianObservation;
  return { captureKey: `capture-${id}`, publisherReleasedAt: AT, observation };
}
const selection: AskContributorSelection = {
  contributorId: 'HUMANITARIAN',
  domain: 'humanitarian',
  applicability: 'SUPPLEMENTARY',
  scope: { countryIso3: 'RWA', district: null, place: null },
};
const used = (): AskContribution => {
  clearGdacs();
  const read: HumanitarianRetainedRead = {
    kind: 'RETAINED',
    observations: [gdacsRow('1'), gdacsRow('2', [])],
  };
  return humanitarianContribution(read, selection);
};

describe('B1 — the six required codes are recognised, with Humanitarian wording', () => {
  it('assertDisclosuresRecognised(HUMANITARIAN_REQUIRED_DISCLOSURES, recognised) no longer throws', () => {
    expect(() =>
      assertDisclosuresRecognised(
        HUMANITARIAN_REQUIRED_DISCLOSURES,
        GOVERNED_PROMPT_DISCLOSURE_CODES,
      ),
    ).not.toThrow();
  });

  it('a USED Humanitarian contribution carries all six, derived from its rows', () => {
    expect([...used().disclosures].sort()).toEqual([...HUMANITARIAN_REQUIRED_DISCLOSURES].sort());
  });

  it('SEVERITY_NOT_ASSESSED is worded for humanitarian records — never "retained conflict records"', () => {
    const rules = governedPrompt({ considered: [selection], contributions: [used()] }).rules;
    expect(rules).toMatch(/humanitarian records/);
    expect(rules).not.toMatch(/retained conflict records/);
    for (const phrase of [
      'impact on people was NOT assessed',
      'not current observations',
      'no time zone',
      'centroid',
    ]) {
      expect(rules).toContain(phrase);
    }
  });

  it('the Conflict wording is unchanged for Conflict (no live behaviour change elsewhere)', () => {
    const conflict: AskContribution = {
      contributorId: 'CONFLICT',
      domain: 'security',
      applicability: 'SUPPLEMENTARY',
      status: 'USED',
      observations: [],
      temporalBasis: 'RETAINED_EVENT_RECORD',
      geographyBasis: 'COD',
      disclosures: ['SEVERITY_NOT_ASSESSED'],
      degradationReason: null,
    };
    const rules = governedPrompt({
      considered: [{ ...selection, contributorId: 'CONFLICT', domain: 'security' }],
      contributions: [conflict],
    }).rules;
    expect(rules).toContain('retained conflict records');
    expect(rules).not.toContain('humanitarian');
  });
});

describe('B2 — a closed disclosure registry', () => {
  it('a code no consumer recognises fails instead of vanishing', () => {
    expect(() =>
      assertDisclosuresRecognised(['BRAND_NEW_CODE'], GOVERNED_PROMPT_DISCLOSURE_CODES),
    ).toThrow(/HUMANITARIAN_DISCLOSURE_NOT_RECOGNISED/);
  });

  it('every code the adapter emits, in every state, is recognised', () => {
    const contributions: AskContribution[] = [
      humanitarianContribution(humanitarianReadAbsence('NOT_ASSESSED'), selection),
      humanitarianContribution(
        humanitarianReadAbsence('SOURCE_TEMPORARILY_UNAVAILABLE'),
        selection,
      ),
      humanitarianContribution({ kind: 'NO_RETAINED_EVIDENCE', observations: [] }, selection),
      humanitarianContribution({ kind: 'RETAINED', observations: [gdacsRow('x')] }, selection), // refused (real ruling)
      used(),
    ];
    for (const c of contributions) {
      expect(c.disclosures).toContain('IMPACT_NOT_ASSESSED'); // B4: on every contribution
      for (const code of c.disclosures) expect(GOVERNED_PROMPT_DISCLOSURE_CODES).toContain(code);
    }
  });
});

describe('B3 — attribution and retention time reach the model (Humanitarian only)', () => {
  it('the governed data carries the verbatim acknowledgement, the originating agency and retainedAt', () => {
    const data = governedPrompt({ considered: [selection], contributions: [used()] }).data;
    expect(data).toContain('Global Disaster Alert and Coordination System, GDACS');
    expect(data).toContain('"originatingAgency": "GLOFAS"');
    expect(data).toContain('"retainedAt"');
  });
});

describe('B5 — the codes survive into the DURABLE stored Ask result', () => {
  it('a real adapter execution persists the Humanitarian contribution with every disclosure', async () => {
    const contribution = used();
    const adapter = new AskR2ExecutionAdapter(
      {
        analyzeNews: jest.fn(async () => ({
          analysis: {},
          articles: [{}, {}],
          retrievalContext: {},
        })),
      } as never,
      { id: 'openai', displayName: 'OpenAI', isMock: false } as never,
      { id: 'openai', answerBackground: jest.fn(async () => ({ text: 'Background.' })) } as never,
      {
        config: { outputWeight: 4 },
        reserve: jest.fn(async () => ({ admitted: true, reservationId: 'r', estimatedUnits: 1 })),
        settle: jest.fn(async () => true),
      } as never,
      {
        permit: jest.fn(async () => ({ allowed: true, trial: false, state: 'CLOSED' })),
        record: jest.fn(async () => undefined),
      } as never,
      { isEnabled: jest.fn(async () => true) } as never,
      {
        get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }),
      } as never,
      { registeredDomains: () => ['CONFLICT'] } as never,
      { record: jest.fn(async () => true) } as never,
      {
        boundSpecialistDomains: () => ['CONFLICT'],
        read: jest.fn(async () => ({ considered: [selection], contributions: [contribution] })),
      } as never,
    );
    const request: AskRequest = {
      question: 'What is the latest news about floods in Rwanda?',
      language: 'en',
      intent: 'ask',
    };
    const who = { accountId: 'u', ipScope: 'ip:v4:192.0.2.9' };
    const plan = await askRequestContext.run(who, () => adapter.prepare(request));
    const out = await askRequestContext.run(who, () => adapter.execute(request, plan, 'op'));
    const payload = JSON.parse(out.payloadJson) as {
      intelligence: { contributions: AskContribution[] } | null;
    };
    const stored = payload.intelligence?.contributions.find(
      (c) => c.contributorId === 'HUMANITARIAN',
    );
    expect(stored).toBeDefined();
    expect([...stored!.disclosures].sort()).toEqual([...HUMANITARIAN_REQUIRED_DISCLOSURES].sort());
    expect(stored!.observations[0]!.source.licence).toBe(
      'Global Disaster Alert and Coordination System, GDACS',
    );
    expect(stored!.observations[0]!.source.originatingAgency).toBe('GLOFAS');
  });
});

describe('C1 — reader reads are built only through the ruling-bound wrapper', () => {
  const ROOT = join(__dirname, '..', '..', '..', '..');
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      if (name === 'node_modules' || name === 'dist' || name === '.next' || name === 'generated')
        return [];
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });

  it('no production file calls the raw constructor except the wrapper (shared defines it)', () => {
    const offenders = ['backend/src', 'frontend/src']
      .flatMap((d) => walk(join(ROOT, d)))
      .filter((p) => /\.(ts|tsx)$/.test(p) && !/\.spec\.tsx?$/.test(p))
      .filter((p) => /\bhumanitarianRetainedRead\(/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(ROOT, p).split(sep).join('/'));
    expect(offenders).toEqual(['backend/src/modules/humanitarian/humanitarian-reader-read.ts']);
  });

  it('the wrapper refuses every record today (no reader-cleared source); an empty store is NO_RETAINED_EVIDENCE', () => {
    expect(() => buildHumanitarianReaderRead([gdacsRow('1')])).toThrow(/HUM-READ-5/);
    expect(buildHumanitarianReaderRead([])).toEqual({
      kind: 'NO_RETAINED_EVIDENCE',
      observations: [],
    });
    expect(buildHumanitarianReaderRead.length).toBe(1);
  });
});
