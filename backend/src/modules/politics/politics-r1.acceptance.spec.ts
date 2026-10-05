import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { domainObservationKey, type AnalysisApiResponse } from '@globalnews-ai/shared';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AskR2ExecutionAdapter } from '../ask-v2/ask-r2-execution.adapter';
import { askRequestContext } from '../ask-v2/ask-request-context';
import type { AskRequest } from '../ask-v2/ask-compute.contract';
import { conversationOf } from '../ask-v2/ask-v2.service';
import { readConversationalTurn } from '../ask-v2/conversation/conversation-state';
import { validateStoredArtifact, type PriorArtifact } from '../ask-v2/conversation/conversation-artifact';
import { AskSpecialistReadCoordinator } from '../ask-intelligence/ask-specialist-read.coordinator';
import { selectContributors } from '../ask-intelligence/contributor-selection';
import type { AskR2Route } from '../ask-router/ask-r2-route';
import type { AskContribution } from '../ask-intelligence/ask-contribution.contract';
import { politicsArtifactHash, type PoliticsCapture } from './politics.producer';
import { PoliticsObservationRepository } from './politics-observation.repository';

/*
  POLITICS INTEL R1 — END-TO-END ACCEPTANCE THROUGH THE FINAL SHARED R4 MECHANISM (gate G8/G9/G9b).

  Every turn runs through the REAL shared Ask execution path, exactly as R4's own continuity spec drives it
  (ask-r2-execution.earlier-turn-scope.spec.ts): readConversationalTurn → AskR2ExecutionAdapter.prepare/execute →
  the R4 prior-answer resolver + execution contract (inherited scope, EARLIER_TURN) → the REAL
  AskSpecialistReadCoordinator → the REAL PoliticsObservationRepository on disposable local PostgreSQL. A follow-up
  is bound to the earlier answer through the stored artifact, as in production. Only the news provider and the model
  are stubbed (no network, no AI). No Politics-only resolver, memory or search exists to be exercised.

  Rows are SYNTHETIC (Sejm is BLOCKED_RIGHTS): this proves the wiring, never coverage. The spec asserts only invariants
  that must ALWAYS hold; outcomes are scored by the gate's evaluator from POLITICS_ACCEPTANCE_REPORT.
*/
const url = process.env.POLITICS_TEST_DATABASE_URL;
const QUERIES = process.env.POLITICS_ACCEPTANCE_QUERIES;
const REPORT = process.env.POLITICS_ACCEPTANCE_REPORT;
const live = url ? describe : describe.skip;
const schema = `politics_accept_${randomUUID().replace(/-/g, '')}`;
const migrations = join(__dirname, '../../../prisma/migrations');

interface Query { id: string; kind: string; language: 'en' | 'pl'; turns: string[] }
const DEFAULT_QUERIES: Query[] = [
  { id: 'P2-EN', kind: 'POS', language: 'en', turns: ['What did the Sejm decide?'] },
  { id: 'P3-EN', kind: 'POS', language: 'en', turns: ['What did the Sejm decide?', 'Show me the official evidence.'] },
  { id: 'N1-EN', kind: 'NEG', language: 'en', turns: ['What is the weather in Poland?'] },
];

type Call = unknown[];
interface Payload {
  answer: { state: string; basis?: string };
  diagnostics: { job: { job: string | null; discourseReference: string } };
  artifact?: unknown;
  intelligence?: { considered: unknown[]; contributions: AskContribution[] } | null;
}

live('Politics R1 acceptance through the final shared R4 mechanism (synthetic rows, no providers, no AI)', () => {
  let db: Client;
  let prisma: PrismaClient;
  let repository: PoliticsObservationRepository;
  let n = 0;
  const seededQuotations: string[] = [];

  async function retain(text: string) {
    const bytes = new Uint8Array(Buffer.from(text, 'utf8'));
    const hash = politicsArtifactHash(text);
    const retrievalId = `accept-${++n}`;
    const at = new Date(Date.UTC(2026, 9, 2, 12));
    await prisma.snapshotPayload.upsert({ where: { contentAddress: hash }, update: {}, create: { contentAddress: hash, bytes, byteLength: bytes.length, mediaType: 'text/plain' } });
    await prisma.snapshotRetrieval.create({ data: {
      retrievalId, providerId: 'SYNTHETIC_LEGISLATURE', endpointId: 'synthetic-acceptance', requestPath: 'test', parameters: [],
      requestedAt: at, retrievedAt: at, httpStatus: 200, mediaType: 'text/plain', byteLength: bytes.length, contentAddress: hash,
      completeness: 'COMPLETE', contentEncoding: 'identity', wireByteLength: bytes.length, admissibility: 'ADMITTED',
      parserId: 'synthetic', parserVersion: '1', parsedAt: at, rightsGrade: 'E-5', rightsInstrumentRef: 'synthetic-test-only',
      payloadRetentionPermitted: true, editionAnnotations: {},
    } });
    return { snapshotRetrievalId: retrievalId };
  }

  function bill(upstreamId: string, jurisdiction: 'PL' | 'KE', stage: string, ordinal: number, text: string): PoliticsCapture {
    const sha256 = politicsArtifactHash(text);
    const identity = { domainId: 'POLITICS', upstreamAuthority: `synthetic-legislature-${jurisdiction}`, upstreamId };
    const m = String(ordinal).padStart(2, '0');
    const sourceUrl = `https://example.org/${jurisdiction}/bill/${upstreamId}`;
    seededQuotations.push(text);
    return {
      artifact: { origin: 'CAPTURED_SOURCE', text, sha256, sourceUrl, capturedAt: `2026-10-02T12:${m}:00Z`, language: jurisdiction === 'PL' ? 'pl' : 'en' },
      review: {
        reviewer: 'Acceptance reviewer', reviewedAt: `2026-10-02T14:${m}:00Z`, rationale: 'Synthetic acceptance review', rightsBasis: 'synthetic-test-only',
        publicDisplayAuthorized: true, evidenceSufficient: true, activity: 'POLITICAL_PROCESS',
        ownership: { violenceOrProtectivePosture: false, organisedArmedActorParticipates: false },
      },
      observation: {
        observationKey: domainObservationKey(identity), identity, observationKind: 'LEGISLATIVE_STAGE', subjectType: 'LEGISLATIVE_SUBJECT',
        subjectId: `bill-${upstreamId}`, claim: { kind: 'LEGISLATIVE_STAGE', stage: stage as 'PASSED', sourceText: text },
        temporal: { occurredAt: '2026-09-18T10:00:00Z', publisherVintage: '2026-09-18T12:00:00Z', retrievedAt: `2026-10-02T12:${m}:00Z`, temporalBasis: 'OCCURRENCE' },
        publishedAt: '2026-09-18T12:00:00Z', artifactSha256: sha256,
        provenance: { sourceType: 'OFFICIAL_SOURCE', jurisdiction, institution: `Synthetic legislature (${jurisdiction})`, sourceUrl, language: jurisdiction === 'PL' ? 'pl' : 'en', retrievedAt: `2026-10-02T12:${m}:00Z`, evidenceRole: 'PRIMARY_RECORD' },
        sourceReference: { sourceUrl, citation: `Synthetic bill ${upstreamId}` },
        attributeAuthorship: [{ attribute: 'kind', authorship: 'LOCALLY_ASSERTED' }, { attribute: 'stage', authorship: 'LOCALLY_ASSERTED' }, { attribute: 'sourceText', authorship: 'PUBLISHER_STATED' }],
        revision: ordinal === 0
          ? { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: `2026-10-02T13:${m}:00Z` }
          : { revisionOrdinal: ordinal, supersedesRevisionOrdinal: ordinal - 1, revisionKind: 'SOURCE_REVISION', recordedAt: `2026-10-02T13:${m}:00Z` },
      },
    };
  }

  /** The REAL shared execution path; only the news provider and the model are stubs (R4 continuity-spec harness). */
  function harness() {
    const analysis: Call[] = [];
    const background: Array<{ question: string; governed?: { rules: string; data: string } }> = [];
    const reads: AskR2Route[] = [];
    const coordinator = new AskSpecialistReadCoordinator(
      { currentForCountry: async () => [], evidenceDetails: async () => new Map(), currentByKey: async () => null } as never,
      { procurement: async () => [] } as never,
      { readNisrHeadlineCpi: async () => ({ slot: { kind: 'GAP', seriesId: 'x', periodId: 'UNKNOWN', reason: 'NO_PRODUCER' }, publishable: false, retainedState: 'NO_CAPTURE' }) } as never,
      repository,
    );
    const realRead = coordinator.read.bind(coordinator);
    coordinator.read = async (route: AskR2Route, now?: Date) => { reads.push(route); return realRead(route, now); };
    const adapter = new AskR2ExecutionAdapter(
      { analyzeNews: jest.fn(async (...args: unknown[]) => {
        analysis.push(args);
        const k = analysis.length;
        return { analysis: { headline: `Sourced headline ${k}`, summary: 'Summary.', keyFacts: [{ claim: `Sourced claim ${k}a`, sourceArticleIds: [`art-${k}-1`] }] } as never,
          articles: [{ id: `art-${k}-1` } as never], retrievalContext: {} as never } satisfies Partial<AnalysisApiResponse>;
      }) } as never,
      { id: 'openai', displayName: 'OpenAI', isMock: false, analyzeNews: jest.fn() } as never,
      { id: 'openai', displayName: 'OpenAI', isMock: false, answerBackground: jest.fn(async (input: { question: string; governed?: { rules: string; data: string } }) => { background.push(input); return { text: 'Reasoned answer.' }; }) } as never,
      { config: { outputWeight: 4 }, reserve: jest.fn(async () => ({ admitted: true, reservationId: 'r', estimatedUnits: 1 })), settle: jest.fn(async () => true) } as never,
      { permit: jest.fn(async () => ({ allowed: true, trial: false, state: 'CLOSED' })), record: jest.fn(async () => undefined) } as never,
      { isEnabled: jest.fn(async () => true) } as never,
      { get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }) } as never,
      { registeredDomains: () => ['CONFLICT'] } as never,
      { record: jest.fn(async () => true) } as never,
      coordinator as never,
    );
    return { adapter, analysis, background, reads };
  }

  /** One conversation, driven exactly as production: conversational reading + the stored artifact of the earlier answer. */
  function conversation(language: 'en' | 'pl') {
    const h = harness();
    const earlier: string[] = [];
    let prior: PriorArtifact | undefined;
    let op = 0;
    return async function ask(question: string) {
      const conversational = readConversationalTurn(question, language, [...earlier].reverse().map((q) => ({ question: q, language })));
      const composed = conversational?.composition ?? null;
      const request = { question: composed?.effectiveQuestion ?? question, language, intent: 'ask', ...conversationOf(conversational), ...(prior === undefined ? {} : { priorArtifact: prior }) } as AskRequest;
      const before = { a: h.analysis.length, b: h.background.length, r: h.reads.length };
      const priorQuestion = earlier[earlier.length - 1];
      const id = `op-${++op}`;
      const payload = await askRequestContext.run(
        { accountId: 'user-1', ipScope: 'ip:v4:203.0.113.7', ...(priorQuestion === undefined ? {} : { priorQuestion }) } as never,
        async () => { const plan = await h.adapter.prepare(request); return JSON.parse((await h.adapter.execute(request, plan, id)).payloadJson) as Payload; },
      );
      earlier.push(question);
      const stored = validateStoredArtifact(payload.artifact);
      if (stored !== null) prior = { ...stored, sourceOperationId: id };
      const reads = h.reads.slice(before.r);
      const read = reads[reads.length - 1];
      return {
        payload, read,
        analysisCalls: h.analysis.slice(before.a), backgroundCalls: h.background.slice(before.b),
        selected: read === undefined ? [] : selectContributors(read),
      };
    };
  }

  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error('TEST_DATABASE_MUST_BE_LOCAL');
    db = new Client({ connectionString: url });
    await db.connect();
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.query(`SET search_path TO "${schema}"`);
    for (const m of ['20260919030000_add_official_data_snapshot_store', '20260919040000_add_market_scheduled_ingest', '20260919050000_snapshot_admission_r2',
      '20260920140000_snapshot_retrieval_lineage_fields', '20261004120000_politics_observation_store', '20261004130000_politics_reinstatement'])
      await db.query(readFileSync(join(migrations, m, 'migration.sql'), 'utf8'));
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: `-c search_path=${schema}` }, { schema }) });
    repository = new PoliticsObservationRepository(prisma as PrismaService);
    // seedProfile: bill A rev0 PASSED → rev1 SIGNED; bill B rev0 INTRODUCED (single stage: P4b); one KEN control row. No DEU row (P3b).
    for (const c of [
      bill('A', 'PL', 'PASSED', 0, 'Synthetic record A: the bill was passed at third reading.'),
      bill('A', 'PL', 'SIGNED', 1, 'Synthetic record A: the bill was signed.'),
      bill('B', 'PL', 'INTRODUCED', 0, 'Synthetic record B: the bill was introduced.'),
      bill('K', 'KE', 'PASSED', 0, 'Synthetic record K: the bill was passed.'),
    ]) await repository.append(c, await retain(c.artifact.text));
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (db) { await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await db.end(); }
  });

  it('runs every acceptance query through the final shared R4 path and writes the report', async () => {
    const queries: Query[] = QUERIES ? JSON.parse(readFileSync(QUERIES, 'utf8')).queries : DEFAULT_QUERIES;
    const report = [];
    for (const q of queries) {
      const ask = conversation(q.language);
      let last: Awaited<ReturnType<typeof ask>> | undefined;
      for (const turn of q.turns) last = await ask(turn);
      const t = last!;
      const contributions = t.payload.intelligence?.contributions ?? [];
      const politics = contributions.filter((x) => x.contributorId === 'POLITICS');
      const observations = politics.filter((x) => x.status === 'USED').flatMap((x) => x.observations);
      const politicsSelection = t.selected.find((s) => s.contributorId === 'POLITICS');
      const policy = (t.analysisCalls[0]?.[6] ?? {}) as { governed?: { rules: string; data: string } };
      const flat = JSON.stringify(t.payload);
      report.push({
        id: q.id,
        politicsRowsRetrieved: observations.map((o) => o.reference),
        politicsCountries: [...new Set(observations.map((o) => o.geography))],
        eventKinds: [...new Set(observations.map((o) => o.kind.split(':')[0]))],
        revisionOrdinals: Object.fromEntries(observations.map((o) => [o.reference, o.provenance?.revisionOrdinal])),
        subjects: observations.map((o) => ({ reference: o.reference, label: o.label, revision: o.provenance?.revisionOrdinal })),
        citations: observations.map((o) => ({ retrievalKey: o.reference, sourceUrl: o.source.url, artifactSha256: o.provenance?.artifactSha256, sourceType: o.provenance?.sourceType, evidenceRole: o.provenance?.evidenceRole })),
        changeStates: [],
        quotationRendered: seededQuotations.some((text) => flat.includes(text)),
        absence: politics.length === 0 ? 'NOT_CONSIDERED' : politics[0].status === 'USED' ? null : politics[0].status,
        politicsDisclosures: politics.flatMap((x) => x.disclosures),
        answerState: t.payload.answer.state,
        answerBasis: t.payload.answer.basis ?? null,
        discourseReference: t.payload.diagnostics?.job?.discourseReference ?? null,
        inheritedProvenance: t.read?.inheritedScope?.provenance ?? null,
        politicsScopeProvenance: politicsSelection?.scope.provenance ?? null,
        typedGeographyOnFollowUp: t.read?.envelope.geography.candidates.some((g) => g.source === 'TYPED_GEOGRAPHY') ?? false,
        newsCalls: t.analysisCalls.length,
        modelCalls: t.analysisCalls.length + t.backgroundCalls.length,
        retrievalQuestion: t.analysisCalls[0] ? String(t.analysisCalls[0][0]) : null,
        /* the rules that bound THIS turn's one model call: the news call's policy, or the background call's */
        governedRules: [policy.governed?.rules ?? '', ...t.backgroundCalls.map((b) => b.governed?.rules ?? '')].join(' | '),
      });
    }
    if (REPORT) writeFileSync(REPORT, JSON.stringify(report, null, 2));

    // INVARIANTS that must ALWAYS hold, whatever the scored outcome:
    for (const r of report) {
      expect({ id: r.id, quotationRendered: r.quotationRendered }).toEqual({ id: r.id, quotationRendered: false });
      if (queries.find((x) => x.id === r.id)?.kind === 'NEG') expect({ id: r.id, rows: r.politicsRowsRetrieved }).toEqual({ id: r.id, rows: [] });
      if (r.politicsRowsRetrieved.length) expect(r.politicsDisclosures).toContain('RETAINED_NOT_CURRENT');
      expect(new Set(r.politicsRowsRetrieved).size).toBe(r.politicsRowsRetrieved.length);
      // EARLIER_TURN is never relabelled as typed by the reader.
      if (r.politicsScopeProvenance === 'EARLIER_TURN') expect(r.typedGeographyOnFollowUp).toBe(false);
    }
  }, 120_000);
});
