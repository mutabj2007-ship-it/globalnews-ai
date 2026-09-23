import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import https = require('node:https');
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { of, lastValueFrom } from 'rxjs';
import { Logger, type ExecutionContext } from '@nestjs/common';
import { ADMITTED_BUNDLE_SHA256 } from './election-admitted';
import { ELECTION_DERIVATION_RULES } from './election-evidence';
import { validateBundle, sha256 } from './election-validation';
import { admitElectionBundle } from './election-admit.cli';
import { ElectionReadModule } from './election-read.module';
import { ElectionReadService, electionReadView } from './election-read.service';
import { LoggingInterceptor } from '../../observability/logging.interceptor';

const bytes = readFileSync(join(__dirname, 'data', `${ADMITTED_BUNDLE_SHA256}.json`));
const fixture = () => JSON.parse(bytes.toString('utf8'));
const base = () => {
  const r = fixture().records[0];
  for (const key of ['publisherStatus', 'declaredAt', 'declaredPerson', 'votesAsPublished'])
    delete r[key];
  return r;
};
function bundleWith(record: unknown) {
  const b = fixture();
  b.records = [record];
  b.admission.permittedKinds = [
    'FORM_AVAILABLE',
    'FORM_REPORTED',
    'TALLY_OBSERVATION',
    'OFFICIAL_DECLARATION',
  ];
  return b;
}
const form = { publisherIdentity: 'test-only-form', formType: '35A', serial: null };

describe('Kenya bounded official evidence', () => {
  it('reads actual retained bytes, verified PDF lineage and one explicit declaration', () => {
    expect(sha256(bytes)).toBe(ADMITTED_BUNDLE_SHA256);
    const b = validateBundle(fixture());
    expect(b.artifacts).toHaveLength(1);
    expect(Buffer.from(b.artifacts[0].bodyBase64, 'base64').subarray(0, 5).toString()).toBe(
      '%PDF-',
    );
    expect(b.records[0].kind).toBe('OFFICIAL_DECLARATION');
    expect(b.records[0].election.cycle).toBeNull();
    expect(b.records[0].election.reportingGeography).toBeNull();
    expect(b.records[0].form).toBeNull();
  });
  it.each(['bodyBase64', 'sha256', 'finalUrl', 'capturedAt'])(
    'rejects tampered source %s',
    (key) => {
      const b = fixture();
      b.artifacts[0][key] += 'x';
      expect(() => validateBundle(b)).toThrow();
    },
  );
  it.each([
    'forecast',
    'winnerPrediction',
    'electabilityScore',
    'candidateRank',
    'partyRank',
    'swingEstimate',
    'sentimentScore',
    'recommendation',
  ])('refuses injected %s at admission', (field) => {
    const b = fixture();
    b.records[0][field] = 1;
    expect(() => validateBundle(b)).toThrow(/unknown or missing/);
  });
  it('enforces no derivations, with an added-rule mutation', () => {
    const check = (rules: readonly unknown[]) => {
      if (rules.length) throw new Error('derivations forbidden');
    };
    expect(() => check(ELECTION_DERIVATION_RULES)).not.toThrow();
    expect(() => check(['predict'])).toThrow();
    expect(Object.isFrozen(ELECTION_DERIVATION_RULES)).toBe(true);
  });
  it('100% FORM_REPORTED remains form reporting, never a tally or declaration', () => {
    const b = validateBundle(
      bundleWith({
        ...base(),
        kind: 'FORM_REPORTED',
        form,
        publisherStatus: '1 of 1 (100%)',
        reported: 1,
        total: 1,
        unitLabel: 'forms',
      }),
    );
    const view = electionReadView(b, 'en', Date.now());
    expect(view.records[0].kind).toBe('FORM_REPORTED');
    expect(view.records[0]).not.toHaveProperty('declaredPerson');
    expect(view.records[0]).not.toHaveProperty('qualifiedReading');
  });
  it('a downloadable blank form is only FORM_AVAILABLE', () => {
    const b = validateBundle(
      bundleWith({
        ...base(),
        kind: 'FORM_AVAILABLE',
        form,
        availability: 'AVAILABLE',
        documentRole: 'BLANK_TEMPLATE',
      }),
    );
    expect(electionReadView(b, 'en', Date.now()).records[0].kind).toBe('FORM_AVAILABLE');
  });
  it('rejects a kind promotion without the explicit declaration payload', () => {
    const r = {
      ...base(),
      kind: 'OFFICIAL_DECLARATION',
      reported: 1,
      total: 1,
      unitLabel: 'forms',
      publisherStatus: '100%',
    };
    expect(() => validateBundle(bundleWith(r))).toThrow();
  });
  it('rejects invented declaration wording, missing citation, dossier fields and broken revision', () => {
    for (const mutate of [
      (b: ReturnType<typeof fixture>) => (b.records[0].citation.statement = '100% complete'),
      (b: ReturnType<typeof fixture>) => (b.records[0].citation.artifactSha256 = 'f'.repeat(64)),
      (b: ReturnType<typeof fixture>) => (b.records[0].declaredPerson.nationalId = 'private'),
      (b: ReturnType<typeof fixture>) => (b.records[0].revision.supersedes = 'missing'),
    ]) {
      const b = fixture();
      mutate(b);
      expect(() => validateBundle(b)).toThrow();
    }
  });
  it('keeps zero votes distinct from absence, expires provisional tallies, rejects impossible totals', () => {
    const r = {
      ...base(),
      election: {
        ...base().election,
        electionDate: '2026-01-01',
        reportingGeography: {
          kind: 'POLLING_STATION',
          label: 'Synthetic unit',
          officialCode: 'TEST',
          citation: base().citation,
        },
      },
      kind: 'TALLY_OBSERVATION',
      form,
      publisherStatus: 'Provisional test fixture',
      publisherStatedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-01-01T06:00:00Z',
      scope: { reported: 1, total: 2, unitLabel: 'stations' },
      votes: [
        {
          candidateBallotName: 'Synthetic test subject',
          authorityCandidateCode: null,
          partyAsPublished: null,
          votesAsPublished: '0',
          citation: base().citation,
        },
      ],
      registeredVoters: 10,
    };
    const b = validateBundle(bundleWith(r));
    expect(JSON.stringify(electionReadView(b, 'en', Date.parse(r.publisherStatedAt)))).toContain(
      'TALLY OBSERVATION · Provisional test fixture · 0',
    );
    expect(electionReadView(b, 'en', Date.parse(r.expiresAt) + 1).state).toBe('COVERAGE_GAP');
    r.votes[0].votesAsPublished = '11';
    expect(() => validateBundle(bundleWith(r))).toThrow(/registration/);
    r.votes[0].votesAsPublished = '0';
    r.scope.total = 0;
    expect(() => validateBundle(bundleWith(r))).toThrow(/denominator/);
  });
  it('separates source English from product Polish and always qualifies the declared vote', () => {
    const view = electionReadView(validateBundle(fixture()), 'pl', Date.now());
    expect(view.records[0].sourceLanguage).toBe('en');
    expect(view.records[0].label).toBe('OFICJALNE OGŁOSZENIE');
    expect(JSON.stringify(view)).toContain('OFICJALNE OGŁOSZENIE · 35,440');
    expect(view.records[0]).not.toHaveProperty('votesAsPublished');
    expect(JSON.stringify(view)).not.toContain('bodyBase64');
  });
  it('admission is append-only and binds the reviewed bundle and TLS identity', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ke-admission-'));
    try {
      const b = fixture();
      const pin = b.artifacts[0].tlsPeerFingerprint256;
      expect(() => admitElectionBundle(b, dir, ADMITTED_BUNDLE_SHA256, 'wrong')).toThrow();
      const modified = fixture();
      modified.records[0].publisherStatus = 'modified';
      expect(() => admitElectionBundle(modified, dir, ADMITTED_BUNDLE_SHA256, pin)).toThrow();
      expect(admitElectionBundle(b, dir, ADMITTED_BUNDLE_SHA256, pin)).toBe(
        `${ADMITTED_BUNDLE_SHA256}.json`,
      );
      expect(() => admitElectionBundle(b, dir, ADMITTED_BUNDLE_SHA256, pin)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('public GET has zero provider calls, replays retained evidence, and stop control closes it', async () => {
    const saved = process.env.ELECTION_EVIDENCE_READ_ENABLED;
    const getSpy = jest.spyOn(https, 'get').mockImplementation(() => {
      throw new Error('provider forbidden');
    });
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('provider forbidden'));
    const module = await Test.createTestingModule({ imports: [ElectionReadModule] }).compile();
    const app = module.createNestApplication();
    await app.init();
    try {
      delete process.env.ELECTION_EVIDENCE_READ_ENABLED;
      expect(new ElectionReadService().read('en')).toMatchObject({ state: 'COVERAGE_GAP', reason: 'READER_DISABLED', records: [] });
      expect(
        (await request(app.getHttpServer()).get('/election/evidence/ke').expect(200)).body.state,
      ).toBe('COVERAGE_GAP');
      process.env.ELECTION_EVIDENCE_READ_ENABLED = 'true';
      for (const locale of ['en', 'pl']) {
        const res = await request(app.getHttpServer())
          .get(`/election/evidence/ke?locale=${locale}`)
          .expect(200);
        expect(res.body.records).toHaveLength(1);
        expect(res.body.records[0].kind).toBe('OFFICIAL_DECLARATION');
        expect(res.headers['cache-control']).toBe('no-store');
      }
      process.env.ELECTION_EVIDENCE_READ_ENABLED = 'false';
      expect(new ElectionReadService().read('en').records).toEqual([]);
      expect(getSpy).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      await app.close();
      getSpy.mockRestore();
      fetchSpy.mockRestore();
      if (saved === undefined) delete process.env.ELECTION_EVIDENCE_READ_ENABLED;
      else process.env.ELECTION_EVIDENCE_READ_ENABLED = saved;
    }
  });
  it('does not emit correlated reader access logs', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', originalUrl: '/election/evidence/ke?locale=pl' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;
    try {
      await lastValueFrom(new LoggingInterceptor().intercept(context, { handle: () => of({}) }));
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
