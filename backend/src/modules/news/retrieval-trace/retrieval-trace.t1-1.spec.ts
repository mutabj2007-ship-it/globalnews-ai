import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AnalysisApiResponse, NewsArticle } from '@globalnews-ai/shared';
import { NewsService } from '../news.service';
import type { NewsProvider } from '../interfaces';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from '../providers/provider.tokens';
import { ArticlePersistenceService } from '../persistence/article-persistence.service';
import { GNewsProviderError } from '../providers/gnews.provider';
import {
  scoreGenericRelevance,
  scoreRelationalRelevance,
} from '../relevance/generic-relevance.util';
import type { PrismaService } from '../../../database/prisma.service';
import {
  KNOWN_REJECTION_REASONS,
  QUERY_FINGERPRINT_KEY_ENV,
  RetrievalTraceCollector,
  queryFingerprint,
  reasonCode,
  withRetrievalTrace,
} from './retrieval-trace';
import {
  attachRetrievalDiagnostics,
  buildRetrievalDiagnostics,
  finalizeAnalysisDiagnostics,
  type RetrievalDiagnostics,
} from './retrieval-diagnostics';
import {
  RETRIEVAL_DIAGNOSTICS_FIELDS,
  RETRIEVAL_DIAGNOSTICS_MAX_BYTES,
  serializeRetrievalDiagnostics,
} from './retrieval-diagnostics-envelope';
import { retrievalDiagnosticsFor } from '../../ask-v2/ask-r2-execution.adapter';

/*
  RETRIEVAL R1 · T1.1 — PRIVACY CONFORMANCE FIXTURES (E1-03 / E1-08, CTO R2 Decision 2).

  Synthetic text only; no network, no model, no database. Every leak assertion is made on the
  PERSISTED envelope — the bytes retrievalDiagnosticsFor() hands to StoredResult.payload — and
  every fixture also has a positive half, because a trace that stores nothing passes every
  absence test (E1-08 L-8).
*/

const KEY = 'k'.repeat(16) + '-t1.1-fixture-only-not-a-real-key';
const NOW = '2026-10-11T12:00:00.000Z';

function article(overrides: Partial<NewsArticle> & Pick<NewsArticle, 'id' | 'title'>): NewsArticle {
  return {
    summary: '',
    url: `https://synthetic.example/${overrides.id}`,
    sourceId: 'synthetic-wire',
    sourceName: 'Synthetic Wire',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-10-09T10:00:00.000Z',
    publishedAtBasis: 'publisher' as const,
    providerId: 'gnews',
    ...overrides,
  };
}

type Behaviour = { articles?: NewsArticle[]; failWith?: Error };

function stub(id: string, behaviour: Behaviour): NewsProvider & { calls: number } {
  const run = async (): Promise<NewsArticle[]> => {
    provider.calls += 1;
    if (behaviour.failWith) throw behaviour.failWith;
    return (behaviour.articles ?? []).map((a) => ({ ...a, providerId: id }));
  };
  const provider = {
    id,
    displayName: id,
    isMock: false,
    calls: 0,
    search: run,
    topHeadlines: run,
    category: run,
    async health() {
      return { providerId: id, displayName: id, status: 'ok' as const, checkedAt: NOW };
    },
  };
  return provider as NewsProvider & { calls: number };
}

async function build(primary: Record<string, Behaviour>, fallback: Record<string, Behaviour> = {}) {
  const primaries = Object.entries(primary).map(([id, b]) => stub(id, b));
  const fallbacks = Object.entries(fallback).map(([id, b]) => stub(id, b));
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
  };
  const active = [...primaries, ...fallbacks];
  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      { provide: NEWS_PROVIDERS, useValue: active },
      { provide: ALL_NEWS_PROVIDERS, useValue: active },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: fallbacks },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();
  return { service: moduleRef.get(NewsService), providers: active, persistence };
}

type SearchArgs = Parameters<NewsService['search']>;
const generic = { type: 'generic' } as const;

/** One traced search → the envelope exactly as the Ask adapter would persist it. */
async function persistedFor(
  primary: Record<string, Behaviour>,
  args: SearchArgs,
  fallback: Record<string, Behaviour> = {},
) {
  const { service, providers } = await build(primary, fallback);
  const collector = new RetrievalTraceCollector();
  const response = await withRetrievalTrace(collector, () => service.search(...args));
  const diagnostics = finalizeAnalysisDiagnostics(collector.seal(), {
    analysis: null,
    articles: response.articles,
  });
  const analysis = attachRetrievalDiagnostics(
    { articles: response.articles } as unknown as AnalysisApiResponse,
    diagnostics,
  );
  const persisted = retrievalDiagnosticsFor(analysis, routeFor([]));
  return { diagnostics, persisted, response, providers };
}

type RouteArg = Parameters<typeof retrievalDiagnosticsFor>[1];
const routeFor = (countries: string[], extra: Record<string, unknown> = {}): RouteArg =>
  ({
    plan: { terminalState: 'EXECUTABLE' },
    envelope: {
      geography: { candidates: countries.map((value) => ({ value, source: 'QUESTION' })) },
      ...extra,
    },
  }) as unknown as RouteArg;

const text = (value: unknown) => JSON.stringify(value).toLowerCase();
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8');

function withKey<T>(key: string | undefined, work: () => Promise<T>): Promise<T> {
  const prior = process.env[QUERY_FINGERPRINT_KEY_ENV];
  if (key === undefined) delete process.env[QUERY_FINGERPRINT_KEY_ENV];
  else process.env[QUERY_FINGERPRINT_KEY_ENV] = key;
  return work().finally(() => {
    if (prior === undefined) delete process.env[QUERY_FINGERPRINT_KEY_ENV];
    else process.env[QUERY_FINGERPRINT_KEY_ENV] = prior;
  });
}

/* Every key the persisted envelope may contain, from the frozen allowlist (plus its accounting). */
function allowedKeys(): Set<string> {
  const keys = new Set<string>([
    'persisted',
    'maxBytes',
    'bytes',
    'overflowLevel',
    'rejectedValues',
    'droppedListItems',
    'decidedAt',
  ]);
  const walk = (rule: { t: string; fields?: Record<string, unknown>; of?: unknown }) => {
    if (rule.t === 'object') {
      for (const [k, child] of Object.entries(rule.fields ?? {})) {
        keys.add(k);
        walk(child as never);
      }
    }
    if (rule.t === 'list') walk(rule.of as never);
  };
  walk({ t: 'object', fields: RETRIEVAL_DIAGNOSTICS_FIELDS });
  return keys;
}

/* Keys of code→count maps are values, not fields: they are checked against their vocabularies. */
const COUNT_MAPS = new Set([
  'countryTags',
  'relevanceReasons',
  'geoVerdicts',
  'storedRightsDrops',
  'reasons',
]);
function keysOutsideAllowlist(value: unknown, allowed = allowedKeys(), path = ''): string[] {
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value))
    return value.flatMap((item, i) => keysOutsideAllowlist(item, allowed, `${path}[${i}]`));
  return Object.entries(value).flatMap(([k, child]) => {
    if (!allowed.has(k)) return [`${path}.${k}`];
    return COUNT_MAPS.has(k) ? [] : keysOutsideAllowlist(child, allowed, `${path}.${k}`);
  });
}

describe('T1.1 · F-1 sensitive question — keyed fingerprint or none; no fragment anywhere', () => {
  const question = 'Did Marta Kowalska test HIV positive at the Musanze clinic';

  it('with a governed key: 16-hex keyed HMAC, never the unkeyed SHA-256, never a plain HMAC of the key', async () => {
    const { persisted } = await withKey(KEY, () =>
      persistedFor(
        { gnews: { articles: [article({ id: 's1', title: 'Clinic opens new wing' })] } },
        [question, 10, generic],
      ),
    );
    const fingerprint = persisted?.searches[0]?.queryFingerprint;
    expect(fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(fingerprint).not.toBe(
      createHash('sha256').update(question, 'utf8').digest('hex').slice(0, 16),
    );
    /* purpose separation: not even the direct HMAC under the same secret */
    expect(fingerprint).not.toBe(
      createHmac('sha256', KEY).update(question, 'utf8').digest('hex').slice(0, 16),
    );
    expect(fingerprint).toBe(queryFingerprint(question, { [QUERY_FINGERPRINT_KEY_ENV]: KEY }));
    const out = text(persisted);
    for (const token of [
      'marta',
      'kowalska',
      'hiv',
      'musanze',
      'clinic',
      'synthetic.example',
      'synthetic wire',
    ]) {
      expect(out).not.toContain(token);
    }
    /* positive control (L-8): the trace is written and useful */
    expect(persisted?.searches[0]).toMatchObject({
      queryLength: question.length,
      relevanceMode: 'generic',
    });
    expect(persisted?.attempts[0]).toMatchObject({
      providerId: 'gnews',
      outcome: 'SUCCESS',
      rawFetchedCount: 1,
    });
    expect(persisted?.invariants).toEqual({ ok: true, violations: [] });
  });

  it('without a key, or with a short key: the fingerprint is OMITTED (no fallback hash)', async () => {
    for (const key of [undefined, '', 'short-key-under-32-bytes']) {
      const { persisted } = await withKey(key, () =>
        persistedFor({ gnews: { articles: [] } }, [question, 10, generic]),
      );
      expect(persisted?.searches[0]).toBeDefined();
      expect(persisted?.searches[0]).not.toHaveProperty('queryFingerprint');
      expect(text(persisted)).not.toMatch(/[0-9a-f]{16}/);
    }
  });

  it('the key never appears in the envelope and is not hard-coded in the module', async () => {
    const { persisted } = await withKey(KEY, () =>
      persistedFor({ gnews: { articles: [] } }, [question, 10, generic]),
    );
    expect(JSON.stringify(persisted)).not.toContain(KEY);
    const source = readFileSync(join(__dirname, 'retrieval-trace.ts'), 'utf8');
    expect(source).not.toMatch(/randomBytes|OAUTH_FLOW_SECRET|createHash\(/);
  });
});

describe('T1.1 · F-2 malformed provider response — MALFORMED, no body, still written and bounded', () => {
  it('an HTML / truncated-JSON body in the error never reaches the envelope', async () => {
    const body =
      '<html><body>Zanzibarine exclusive paywall body {"articles":[{"title":"Quokkaville';
    const { persisted, response } = await persistedFor(
      {
        gnews: {
          failWith: new GNewsProviderError(
            `unexpected token in ${body}`,
            new SyntaxError(body),
            'malformed',
          ),
        },
      },
      ['Kigali transport budget', 10, generic],
    );
    expect(response.articles).toEqual([]);
    expect(persisted?.attempts[0]).toMatchObject({
      providerId: 'gnews',
      outcome: 'MALFORMED',
      rawFetchedCount: null,
    });
    expect(persisted?.causes.map((c) => c.cause)).toEqual(
      expect.arrayContaining(['PROVIDER_FAILED_MALFORMED', 'INCOMPLETE_CHECK']),
    );
    /* a malformed response is NOT a zero-result answer */
    expect(persisted?.causes.map((c) => c.cause)).not.toContain('PROVIDER_EMPTY');
    const out = text(persisted);
    for (const token of [
      'zanzibarine',
      'paywall',
      'quokkaville',
      '<html',
      'unexpected token',
      'syntaxerror',
    ]) {
      expect(out).not.toContain(token);
    }
    expect(bytes(persisted)).toBeLessThanOrEqual(RETRIEVAL_DIAGNOSTICS_MAX_BYTES);
  });
});

describe('T1.1 · F-5 error carrying a profile value — neither value nor stack stored; the trace adds no log line', () => {
  it('a provider error whose message and stack carry profile values', async () => {
    const error = new Error(
      'lookup failed for marta.kowalska@example.org (display name "Marta K", greet as Marta)',
    );
    error.stack = `Error: ${error.message}\n    at ProfileRepository.findGreeting (/srv/app/profile.ts:42:7)`;
    (error as Error & { kind?: string }).kind = 'unavailable';
    const lines: string[] = [];
    const capture = (...args: unknown[]) => void lines.push(args.map(String).join(' '));
    const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((level) =>
      jest.spyOn(Logger.prototype, level).mockImplementation(capture),
    );
    try {
      /* untraced run (the 129b547 path) and traced run: the trace must add no log line at all */
      const plain = await build({ gnews: { failWith: error } });
      await plain.service.search('Kigali transport budget', 10, generic);
      const untracedLines = [...lines];
      lines.length = 0;
      const { persisted } = await persistedFor({ gnews: { failWith: error } }, [
        'Kigali transport budget',
        10,
        generic,
      ]);
      expect(lines).toEqual(untracedLines);
      expect(lines.join('\n')).not.toMatch(/retrieval-diagnostics|queryFingerprint|rightsUses/);
      expect(persisted?.attempts[0]).toMatchObject({ outcome: 'UNAVAILABLE' });
      const out = text(persisted);
      for (const token of [
        'marta',
        'kowalska',
        'example.org',
        'greet',
        'profilerepository',
        'profile.ts',
        'stack',
      ]) {
        expect(out).not.toContain(token);
      }
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });

  it('the trace and envelope modules contain no logger at all (E1-08 §4.4)', () => {
    for (const file of [
      'retrieval-trace.ts',
      'retrieval-diagnostics.ts',
      'retrieval-diagnostics-envelope.ts',
    ]) {
      expect(readFileSync(join(__dirname, file), 'utf8')).not.toMatch(
        /Logger|console\.|logWithRequestId/,
      );
    }
  });
});

describe('T1.1 · F-7 oversized and hostile input — 8 KiB UTF-8 holds, truncation accounted, nothing zeroed', () => {
  function hostileDiagnostics(): RetrievalDiagnostics {
    const collector = new RetrievalTraceCollector();
    for (let s = 0; s < 25; s += 1) {
      const search = collector.beginSearch({
        capability: 'search',
        queryLength: 120_000,
        requestedLang: 'rw',
        sentLangGnews: 'en',
        window: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-11T00:00:00.000Z' },
        limit: 10,
        relevanceMode: 'generic',
        requestedSource: false,
        allowFallback: true,
      });
      if (search !== undefined) {
        search.stages = {
          builds: 1,
          rawFetched: 2,
          requestedSourceExcluded: 0,
          windowExcluded: 0,
          perProviderDuplicatesCollapsed: 0,
          crossProviderDuplicatesCollapsed: 0,
          cappedOut: 0,
          countryTags: { CG: 1, ['Ünïcødé-tag-ąęś'.repeat(40)]: 1 },
          countryUnresolved: 0,
          relevanceMode: 'generic',
          relevanceRejected: 1,
          relevanceReasons: {
            [reasonCode('generic', 'x'.repeat(50_000))]: 1,
            'generic.marta_kowalska_hiv': 1,
          },
          relevanceReasonsTruncated: 0,
          requestedSourceConstraintExcluded: 0,
          admittedLive: 1,
          persistRequested: 1,
          survivorsWithoutSuccessfulAttempt: 0,
        };
      }
    }
    for (let i = 0; i < 60; i += 1) {
      const attempt = collector.beginAttempt({
        searchOrdinal: (i % 20) + 1,
        providerId: i === 0 ? 'Ż'.repeat(5_000) : 'gnews',
        capability: 'search',
        tier: 'PRIMARY',
        initiatedAt: '2026-10-11T00:00:00.000Z',
        requestedLang: 'rw',
        sentLang: 'en',
      });
      if (attempt !== undefined) {
        attempt.outcome = 'SUCCESS';
        attempt.rawFetchedCount = 2;
      }
    }
    return buildRetrievalDiagnostics(collector.seal(), {
      windowExcludedOutsideWindow: null,
      anchorGate: null,
      rightsAiInputExcluded: null,
      rightsAiInputReasons: null,
      rightsAiInputPendingReview: null,
      finalEvidence: 3,
    });
  }

  it('caps hold in BYTES (multi-byte text), the overflow is explicit and every total survives', () => {
    const diagnostics = hostileDiagnostics();
    const persisted = serializeRetrievalDiagnostics(diagnostics);
    expect(persisted).not.toBeNull();
    expect(bytes(persisted)).toBeLessThanOrEqual(8192);
    expect(persisted?.persisted.bytes).toBe(bytes(persisted));
    expect(persisted?.persisted.overflowLevel).toBeGreaterThan(0);
    expect(persisted?.unobserved).toContain('entries beyond the persisted size bound');
    /* accounted, not silently dropped: rows + truncated = everything the trace saw */
    expect((persisted?.attempts.length ?? 0) + (persisted?.attemptsTruncated ?? 0)).toBe(60);
    expect((persisted?.searches.length ?? 0) + (persisted?.searchesTruncated ?? 0)).toBe(25);
    /* no false zero: the operation totals are exactly the pre-overflow totals */
    expect(persisted?.totals).toEqual(diagnostics.totals);
    expect(persisted?.totals.attempts).toBe(60);
    const out = JSON.stringify(persisted);
    expect(out).not.toContain('Ż');
    expect(out).not.toContain('Ünïcødé');
    expect(out).not.toContain('marta');
    expect(out).not.toContain('x'.repeat(64));
  });

  it('a 10,000-term question persists only its length; the operation does not fail', async () => {
    const huge = Array.from({ length: 10_000 }, (_, i) => `term${i}`).join(' ');
    const { persisted, response } = await persistedFor({ gnews: { articles: [] } }, [
      huge,
      10,
      generic,
    ]);
    expect(response.articles).toEqual([]);
    expect(persisted?.searches[0]?.queryLength).toBe(huge.length);
    expect(JSON.stringify(persisted)).not.toContain('term1 ');
    expect(bytes(persisted)).toBeLessThanOrEqual(8192);
  });
});

describe('T1.1 · write-time allowlist — closed fields, closed codes, fail closed', () => {
  it('the field list is frozen and an injected field never reaches the persisted bytes', () => {
    expect(Object.isFrozen(RETRIEVAL_DIAGNOSTICS_FIELDS)).toBe(true);
    expect(Object.isFrozen((RETRIEVAL_DIAGNOSTICS_FIELDS.attempts as { of: object }).of)).toBe(
      true,
    );
    const diagnostics = buildRetrievalDiagnostics(new RetrievalTraceCollector().seal(), {
      windowExcludedOutsideWindow: null,
      anchorGate: null,
      rightsAiInputExcluded: null,
      rightsAiInputReasons: null,
      rightsAiInputPendingReview: null,
      finalEvidence: 0,
    });
    const tampered = {
      ...diagnostics,
      question: 'Marta Kowalska secret question',
      sentQuery: 'marta kowalska',
      attempts: [
        {
          ...({} as object),
          ordinal: 1,
          providerId: 'gnews',
          errorMessage: 'marta',
          stack: 'at x',
          url: 'https://x.example/?q=marta',
        },
      ],
      analysisStages: { ...diagnostics.analysisStages, title: 'Headline', displayed: 'leak' },
    };
    const persisted = serializeRetrievalDiagnostics(tampered);
    expect(keysOutsideAllowlist(persisted)).toEqual([]);
    expect(text(persisted)).not.toContain('marta');
    expect(text(persisted)).not.toContain('headline');
    expect(persisted?.persisted.rejectedValues).toBeGreaterThan(0);
  });

  it('malformed values fail closed: bad id → null, unknown code → unrecognised (count kept), bad count → null', () => {
    const diagnostics = buildRetrievalDiagnostics(new RetrievalTraceCollector().seal(), {
      windowExcludedOutsideWindow: -4,
      anchorGate: null,
      rightsAiInputExcluded: 2,
      rightsAiInputReasons: { RIGHTS_PROHIBITED: 1, 'Marta Kowalska': 1 },
      rightsAiInputPendingReview: 1.5,
      finalEvidence: 0,
    });
    const persisted = serializeRetrievalDiagnostics({
      ...diagnostics,
      storedRightsDrops: { SOCIAL_RIGHTS_NOT_REVIEWED: 2, '<script>': 3 },
      causes: [
        { cause: 'NOT_A_CAUSE', detail: 'x' },
        { cause: 'PROVIDER_EMPTY', detail: 'marta\nkowalska <b>' },
      ],
    });
    expect(persisted?.analysisStages.windowExcludedOutsideWindow).toBeNull();
    expect(persisted?.analysisStages.rightsAiInput.pendingReview).toBeNull();
    expect(persisted?.analysisStages.rightsAiInput.reasons).toEqual({
      RIGHTS_PROHIBITED: 1,
      unrecognised: 1,
    });
    expect(persisted?.storedRightsDrops).toEqual({
      SOCIAL_RIGHTS_NOT_REVIEWED: 2,
      unrecognised: 3,
    });
    expect(persisted?.causes).toEqual([
      { cause: null, detail: 'x' },
      { cause: 'PROVIDER_EMPTY', detail: null },
    ]);
    expect(text(persisted)).not.toContain('marta');
  });

  it('a hostile provider id is bounded at the collector, before any envelope exists', () => {
    const collector = new RetrievalTraceCollector();
    collector.beginAttempt({
      searchOrdinal: null,
      providerId: 'https://evil.example/?q=Marta',
      capability: 'search',
      tier: 'PRIMARY',
      initiatedAt: null,
      requestedLang: null,
      sentLang: null,
    });
    expect(collector.seal().attempts[0]?.providerId).toBe('unrecognised');
  });
});

describe('T1.1 · closed relevance-reason vocabulary (E1-08 C-2)', () => {
  it('an unknown or delimiter-free reason fails closed; the known set covers what the scorers emit', () => {
    expect(reasonCode('generic', 'marta kowalska appears nowhere')).toBe('generic.unrecognised');
    expect(reasonCode('nonsense-mode', 'X absent')).toBe('other.x_absent');
    expect(reasonCode('generic', 'no whole-phrase match for a multiword query')).toBe(
      'generic.no_whole_phrase_match_for_a_multiword_query',
    );
    /* real scorer rejections map to KNOWN codes (drift guard) */
    const rejected = [
      scoreGenericRelevance(
        article({ id: 'g1', title: 'Unrelated harvest report' }),
        'Musanze market fire',
      ),
      scoreGenericRelevance(article({ id: 'g2', title: 'Fire drill' }), 'fire'),
      scoreRelationalRelevance(article({ id: 'r1', title: 'Rain in Kigali' }), 'Rwanda', 'Congo'),
    ];
    for (const verdict of rejected) {
      expect(verdict.isRelevant).toBe(false);
      for (const reason of verdict.reasons)
        expect(reasonCode('generic', reason)).not.toBe('generic.unrecognised');
    }
  });

  it('every listed reason is still emitted verbatim by a scorer source file', () => {
    const sources = ['generic-relevance.util.ts', 'relational-event.ts', 'governed-institutions.ts']
      .map((f) => readFileSync(join(__dirname, '..', 'relevance', f), 'utf8'))
      .join('\n');
    for (const reason of KNOWN_REJECTION_REASONS) expect(sources).toContain(`'${reason}'`);
  });
});

describe('T1.1 · rights decisions per use — recorded only where a gate executed', () => {
  it('a stored read records AI_INPUT@STORED_READ and E1 use E; every other use is NOT_ASSESSED', async () => {
    const row = (id: string, sourceId: string) => ({
      id,
      title: `Synthetic ${id}`,
      summary: '',
      url: `https://synthetic.example/${id}`,
      imageUrl: null,
      sourceId,
      sourceName: 'Synthetic',
      category: 'world',
      sourcesCount: 1,
      publishedAt: new Date('2026-10-10T00:00:00Z'),
      publishedAtBasis: 'publisher',
      fetchedAt: new Date('2026-10-10T01:00:00Z'),
      confidenceScore: null,
      countryCode: null,
      countryName: null,
    });
    const prisma = {
      article: {
        findMany: jest.fn().mockResolvedValue([row('a', 'synthetic-wire'), row('b', '')]),
      },
    };
    const store = new ArticlePersistenceService(prisma as unknown as PrismaService);
    const collector = new RetrievalTraceCollector();
    const found = await withRetrievalTrace(collector, () => store.findRecent({ limit: 5 }));
    expect(found.map((a) => a.id)).toEqual(['a']);
    const d = buildRetrievalDiagnostics(collector.seal(), {
      windowExcludedOutsideWindow: null,
      anchorGate: null,
      rightsAiInputExcluded: null,
      rightsAiInputReasons: null,
      rightsAiInputPendingReview: null,
      finalEvidence: 1,
    });
    const persisted = serializeRetrievalDiagnostics(d);
    expect(persisted?.rightsDecisions).toEqual({
      'AI_INPUT@STORED_READ': {
        evaluated: 2,
        allowedCleared: null,
        allowedPendingReview: null,
        excluded: 1,
      },
    });
    expect(persisted?.storedRightsDrops).toEqual({ UNKNOWN_PROVENANCE: 1 });
    expect(persisted?.rightsUses).toEqual({
      A: 'NOT_ASSESSED',
      B: 'NOT_ASSESSED',
      C: 'NOT_ASSESSED',
      D: 'NOT_ASSESSED',
      E: { decidedAt: ['AI_INPUT@STORED_READ'] },
      F: 'NOT_ASSESSED',
      G: 'NOT_ASSESSED',
      H: 'NOT_ASSESSED',
      I: 'NOT_ASSESSED',
    });
    /* the same read outside an analysis run records nothing and returns the same rows */
    expect((await store.findRecent({ limit: 5 })).map((a) => a.id)).toEqual(['a']);
  });

  it('no gate executed → no decision recorded and all nine uses NOT_ASSESSED (never cleared)', async () => {
    const { persisted } = await persistedFor({ gnews: { articles: [] } }, [
      'Kigali transport budget',
      10,
      generic,
    ]);
    expect(persisted?.rightsDecisions).toEqual({});
    expect(Object.values(persisted?.rightsUses ?? {})).toEqual(Array(9).fill('NOT_ASSESSED'));
    expect(text(persisted)).not.toMatch(/cleared"|"cleared/);
  });
});

describe('T1.1 · no access / no consent — distinct causes, no profile value', () => {
  it.each([
    ['auth', 'AUTH', 'PROVIDER_FAILED_AUTH'],
    ['quota', 'QUOTA', 'PROVIDER_FAILED_QUOTA'],
    ['rate-limited', 'RATE_LIMIT', 'PROVIDER_FAILED_RATE_LIMIT'],
  ] as const)(
    'no provider access (%s) is a provider failure, never ZERO_RAW, rights or coverage',
    async (kind, outcome, cause) => {
      const { persisted } = await persistedFor(
        { gnews: { failWith: new GNewsProviderError(`synthetic ${kind}`, undefined, kind) } },
        ['Kigali transport budget', 10, generic],
      );
      expect(persisted?.attempts[0]?.outcome).toBe(outcome);
      const causes = persisted?.causes.map((c) => c.cause) ?? [];
      expect(causes).toContain(cause);
      expect(causes).not.toEqual(expect.arrayContaining(['PROVIDER_EMPTY']));
      expect(causes).not.toContain('RIGHTS_WITHHELD');
      expect(causes).not.toContain('NOT_RIGHTS_CLEARED');
    },
  );

  it('a reader without personalization consent: the envelope never reads the personal scope or a profile', () => {
    const route = routeFor(['RWA'], {
      personal: { scope: 'INTERESTS', displayName: 'Marta', interests: ['Kowalska family'] },
    });
    const persisted = retrievalDiagnosticsFor(null, route);
    expect(persisted?.causes[0]).toEqual({
      cause: 'PROVIDER_NOT_ASKED',
      detail: 'route:EXECUTABLE',
    });
    expect(text(persisted)).not.toMatch(/marta|kowalska|interests/);
  });
});

describe('T1.1 · the Ask write path itself enforces the allowlist and the byte bound', () => {
  it('a tampered in-memory envelope is rebuilt from the allowlist by retrievalDiagnosticsFor()', () => {
    const clean = buildRetrievalDiagnostics(new RetrievalTraceCollector().seal(), {
      windowExcludedOutsideWindow: null,
      anchorGate: null,
      rightsAiInputExcluded: null,
      rightsAiInputReasons: null,
      rightsAiInputPendingReview: null,
      finalEvidence: 0,
    });
    const tampered = {
      ...clean,
      question: 'Marta Kowalska secret question',
      causes: [{ cause: 'PROVIDER_EMPTY', detail: 'marta\nkowalska' }],
    } as unknown as RetrievalDiagnostics;
    const analysis = attachRetrievalDiagnostics(
      { articles: [] } as unknown as AnalysisApiResponse,
      tampered,
    );
    const persisted = retrievalDiagnosticsFor(analysis, routeFor([]));
    expect(keysOutsideAllowlist(persisted)).toEqual([]);
    expect(text(persisted)).not.toContain('marta');
    expect(persisted?.persisted.rejectedValues).toBeGreaterThan(0);
    expect(persisted?.persisted.bytes).toBe(bytes(persisted));
    expect(persisted?.persisted.bytes).toBeLessThanOrEqual(RETRIEVAL_DIAGNOSTICS_MAX_BYTES);
  });
});
