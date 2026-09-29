import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConflictObservation, ConflictRetainedEvidenceDetail } from '@globalnews-ai/shared';
import { routeAskR2, type AskR2Route } from '../ask-router/ask-r2-route';
import { landedSpecialistRegistryPort } from '../ask-router/specialist-registry.port';
import {
  AskSpecialistReadCoordinator,
  CONFLICT_WINDOW_DAYS,
  READ_TIMEOUT_MS,
} from './ask-specialist-read.coordinator';
import { selectContributors } from './contributor-selection';
import { imihigoContentHash, readRetainedImihigo } from './imihigo-retained.reader';

/**
 * ASK GLOBALNEWSAI INTELLIGENCE BINDING R1 — the focused matrix (contract §14/§15) at the
 * coordinator: REAL routes from the existing router, REAL selection, the REAL Imihigo reader,
 * stubbed repositories that record every call. No network, no model, no database.
 */
const NOW = new Date('2026-09-29T12:00:00.000Z');
const route = (q: string, lang: 'en' | 'pl' = 'en'): AskR2Route =>
  routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lang,
      normalizationLanguage: lang,
      displayLanguage: lang,
      origin: 'ASK',
    },
    { computeConsent: 'GRANTED', requestInstant: NOW.toISOString() },
    { specialistRegistry: landedSpecialistRegistryPort(() => ['CONFLICT'], ['CONFLICT']) },
  );

const conflictRow = (key: string, day: string, iso3 = 'COD'): ConflictObservation =>
  ({
    observationKey: key,
    identity: { authority: 'UCDP_GED', upstreamEventId: key },
    eventType: 'ARMED_CLASH',
    owner: 'CONFLICT',
    actors: [],
    geography: { countryIso3: iso3 },
    temporal: {
      eventStartedAt: `${day}T00:00:00.000Z`,
      ingestedAt: '2026-09-20T00:00:00.000Z',
      temporalProvenance: 'EVENT_DATED_BY_SOURCE',
    },
    severity: { kind: 'UNAVAILABLE' },
    sourceReference: { citation: 'UCDP Candidate Events', sourceUrl: 'https://ucdp.uu.se/' },
    acquisition: { snapshotRetrievalId: null, snapshotAdmissibility: null, runId: 'r' },
    revision: { revisionOrdinal: 0 },
  }) as unknown as ConflictObservation;

function coordinator(
  opts: {
    conflict?: ConflictObservation[] | 'throw' | 'hang';
    /** LIVE ACCEPTANCE REPAIR R1 — source-verbatim detail per observation key. */
    details?: Record<string, ConflictRetainedEvidenceDetail> | 'throw';
    notices?: Array<{ buyerCountryIso3: string; noticeId: string }>;
    /** GAP = nothing captured; HELD_NOT_DISPLAYABLE = the live Alpha state (capture held,
        refused by the governed reader); OBSERVATION_NOT_PUBLISHABLE = a figure the reader
        decoded but did not mark DISPLAYABLE. */
    cpi?: 'OBSERVATION' | 'GAP' | 'HELD_NOT_DISPLAYABLE' | 'OBSERVATION_NOT_PUBLISHABLE';
  } = {},
) {
  const calls = { conflict: [] as unknown[][], market: 0, economy: 0 };
  const conflict = {
    currentForCountry: jest.fn(async (...args: unknown[]) => {
      calls.conflict.push(args);
      if (opts.conflict === 'throw') throw new Error('db down');
      if (opts.conflict === 'hang') return new Promise<never>(() => undefined);
      return opts.conflict ?? [];
    }),
    evidenceDetails: jest.fn(async (keys: readonly string[]) => {
      if (opts.details === 'throw') throw new Error('capture unreadable');
      const out = new Map<string, ConflictRetainedEvidenceDetail>();
      for (const k of keys) if (opts.details?.[k]) out.set(k, opts.details[k]);
      return out;
    }),
  };
  const market = {
    procurement: jest.fn(async () => {
      calls.market += 1;
      return (opts.notices ?? []).map((n) => ({
        portalReference: { portalId: 'TED', noticeId: n.noticeId },
        artifactClass: 'PROCUREMENT_NOTICE',
        publicationDate: '2026-09-24',
        noticeType: 'cn-standard',
        title: { en: `Notice ${n.noticeId}` },
        buyerNames: {},
        buyerCountryIso3: n.buyerCountryIso3,
        cpvCodes: [],
        totalValue: 1000,
        currency: 'PLN',
        deadlineDate: null,
        deadlineTime: null,
        sourceUrl: `https://ted.europa.eu/en/notice/-/detail/${n.noticeId}`,
        providerId: 'TED',
        retainedAt: '2026-09-25T00:00:00.000Z',
        retrievalId: 'rid',
        contentAddress: 'sha256',
        freshnessBasis: 'RETAINED_ONLY',
      }));
    }),
  };
  const economy = {
    readNisrHeadlineCpi: jest.fn(async () => {
      calls.economy += 1;
      if (opts.cpi === 'HELD_NOT_DISPLAYABLE') {
        return {
          slot: {
            kind: 'GAP',
            seriesId: 'rw-nisr:cpi:all-rwanda',
            periodId: 'UNKNOWN',
            reason: 'NO_PRODUCER',
          },
          publishable: false,
          retainedState: 'NOT_DISPLAYABLE',
        };
      }
      if (opts.cpi === 'OBSERVATION_NOT_PUBLISHABLE') {
        return {
          slot: {
            kind: 'OBSERVATION',
            observation: {
              seriesId: 'rw-nisr:cpi:all-rwanda',
              periodId: '2026-08',
              value: 1,
              unit: 'PERCENT',
            },
          },
          publishable: false,
          retainedState: 'NOT_DISPLAYABLE',
          provenance: {
            institution: 'National Institute of Statistics of Rwanda',
            jurisdiction: 'RW',
            licence: 'CC BY 4.0',
            retrievedAt: '2026-09-12T00:00:00.000Z',
            referencePeriod: '2026-08',
          },
        };
      }
      return opts.cpi === 'OBSERVATION'
        ? {
            slot: {
              kind: 'OBSERVATION',
              observation: {
                seriesId: 'rw-nisr:cpi:all-rwanda',
                periodId: '2026-08',
                value: 15.9,
                unit: 'PERCENT',
              },
            },
            publishable: true,
            retainedState: 'DISPLAYABLE',
            provenance: {
              institution: 'National Institute of Statistics of Rwanda',
              jurisdiction: 'RW',
              sourceUrl: 'https://statistics.gov.rw/',
              licence: 'CC BY 4.0',
              retrievedAt: '2026-09-12T00:00:00.000Z',
              referencePeriod: '2026-08',
            },
            seriesLabel: 'Rwanda headline CPI, year on year',
            geographyLabel: 'All Rwanda',
          }
        : {
            slot: { kind: 'GAP', seriesId: 'x', periodId: 'UNKNOWN', reason: 'NO_PRODUCER' },
            publishable: false,
            retainedState: 'NO_CAPTURE',
          };
    }),
  };
  return {
    c: new AskSpecialistReadCoordinator(conflict as never, market as never, economy as never),
    calls,
  };
}
const byId = (set: { contributions: readonly { contributorId: string }[] }, id: string) =>
  set.contributions.find((c) => c.contributorId === id) as
    | (Record<string, unknown> & { status: string; observations: unknown[]; disclosures: string[] })
    | undefined;

describe('1/2 — Conflict: natural selection, security served THROUGH Conflict', () => {
  it('"How serious is the situation in eastern DRC?" consults Conflict without the reader naming it', async () => {
    const { c, calls } = coordinator({
      conflict: [conflictRow('e1', '2026-09-27'), conflictRow('e2', '2026-09-20')],
    });
    const set = await c.read(route('How serious is the situation in eastern DRC?'), NOW);
    expect(set.considered.map((s) => s.contributorId)).toEqual(['CONFLICT']);
    const conflict = byId(set, 'CONFLICT')!;
    expect(conflict.status).toBe('USED');
    expect(conflict.observations).toHaveLength(2);
    /* LIVE ACCEPTANCE REPAIR R1 — SUPERSEDED WITH UPDATED PROOF: "eastern" is disclosed as a
       scope the country-level read did not narrow to (it was silently dropped before). */
    expect(conflict.disclosures).toEqual([
      'RETAINED_NOT_CURRENT',
      'SEVERITY_NOT_ASSESSED',
      'SUBNATIONAL_SCOPE_NOT_APPLIED',
    ]);
    /* scoped to the resolved country and a bounded window */
    expect(calls.conflict[0]?.[0]).toBe('COD');
    expect((calls.conflict[0]?.[1] as Date).toISOString()).toBe(
      new Date(NOW.getTime() - CONFLICT_WINDOW_DAYS * 86_400_000).toISOString(),
    );
  });

  it('no matching retained record → NO_MATCH, never a false contribution', async () => {
    const { c } = coordinator({ conflict: [] });
    const conflict = byId(
      await c.read(route('How serious is the situation in eastern DRC?'), NOW),
      'CONFLICT',
    )!;
    expect(conflict.status).toBe('NO_MATCH');
    expect(conflict.observations).toEqual([]);
  });

  it('old retained records are disclosed as not recent, never presented as today', async () => {
    const { c } = coordinator({ conflict: [conflictRow('e1', '2026-06-01')] });
    const conflict = byId(
      await c.read(route('What is the security situation in Kenya?'), NOW),
      'CONFLICT',
    )!;
    expect(conflict.disclosures).toContain('NO_RECENT_RETAINED_RECORD');
  });

  it.each([
    'What is the security situation in Goma?',
    'Jaka jest sytuacja bezpieczeństwa w Kenii?',
  ])(
    'a security question (%s) selects CONFLICT under the security domain — one specialist, no SECURITY duplicate',
    (q) => {
      const selections = selectContributors(route(q, q.startsWith('Jaka') ? 'pl' : 'en'));
      const specialist = selections.filter((s) => s.contributorId !== 'GEOGRAPHY');
      expect(specialist.map((s) => [s.contributorId, s.domain])).toEqual([
        ['CONFLICT', 'security'],
      ]);
    },
  );

  it('the router now carries a BOUND supplementary Conflict leg for a security question', () => {
    const plan = route('What is the security situation in Goma?').plan;
    expect(plan.specialistLegs.find((l) => l.domain === 'security')).toMatchObject({
      registered: true,
      bound: true,
    });
    expect(plan.evidenceRequests.some((r) => r.evidenceClass === 'SPECIALIST_CLAIM')).toBe(true);
    expect(plan.disclosures).not.toContain('SPECIALIST_INTELLIGENCE_NOT_USED');
  });
});

describe('3/4 — Market: Poland procurement, and no arbitrary rows for unrelated questions', () => {
  it('matching retained TED notices contribute with their publication period and freshness basis', async () => {
    const { c, calls } = coordinator({
      notices: [
        { buyerCountryIso3: 'POL', noticeId: '1' },
        { buyerCountryIso3: 'POL', noticeId: '2' },
      ],
    });
    const set = await c.read(route('What are the important procurement changes in Poland?'), NOW);
    const market = byId(set, 'MARKET_PROCUREMENT')!;
    expect(market.status).toBe('USED');
    expect(market).toMatchObject({ temporalBasis: 'RETAINED_PUBLICATION' });
    expect(market.disclosures).toEqual(['RETAINED_NOT_CURRENT', 'SNAPSHOT_NOT_CHANGE_SERIES']);
    expect(calls.market).toBe(1);
  });

  it('retained notices for another country are NO_MATCH, never injected', async () => {
    const { c } = coordinator({ notices: [{ buyerCountryIso3: 'POL', noticeId: '1' }] });
    const set = await c.read(
      route('What are the latest public procurement tenders in Kenya?'),
      NOW,
    );
    expect(byId(set, 'MARKET_PROCUREMENT')?.status).toBe('NO_MATCH');
  });

  it.each(['What is the economic outlook for Poland?', 'How is the Polish economy doing?'])(
    'an unrelated economic question (%s) consults no Market/Economy reader',
    async (q) => {
      const { c, calls } = coordinator({ notices: [{ buyerCountryIso3: 'POL', noticeId: '1' }] });
      const set = await c.read(route(q), NOW);
      expect(set.considered.map((s) => s.contributorId)).toEqual([]);
      expect(calls.market).toBe(0);
      expect(calls.economy).toBe(0);
    },
  );

  it('Rwanda CPI: the retained NISR observation contributes with period and provenance', async () => {
    const { c } = coordinator({ cpi: 'OBSERVATION' });
    const cpi = byId(
      await c.read(route('What does the retained Rwanda CPI evidence show?'), NOW),
      'ECONOMY_CPI',
    )!;
    expect(cpi.status).toBe('USED');
    expect(cpi.observations[0]).toMatchObject({
      value: '15.9',
      unit: 'PERCENT',
      period: '2026-08',
    });
    expect(cpi.disclosures).toEqual(['RETAINED_NOT_CURRENT']);
  });

  it('GAP REPAIR R1 — the live Alpha state (release held, refused by the governed reader) is NO_DATA / RETAINED_ARTIFACT_NOT_DISPLAYABLE', async () => {
    const { c } = coordinator({ cpi: 'HELD_NOT_DISPLAYABLE' });
    const cpi = byId(
      await c.read(route("What is Rwanda's latest inflation (CPI)?"), NOW),
      'ECONOMY_CPI',
    )!;
    expect(cpi.status).toBe('NO_DATA');
    expect(cpi.observations).toEqual([]);
    expect(cpi.disclosures).toEqual(['RETAINED_ARTIFACT_NOT_DISPLAYABLE']);
  });

  it('GAP REPAIR R1 — nothing captured is a DIFFERENT disclosure: NO_RETAINED_CAPTURE', async () => {
    const { c } = coordinator({ cpi: 'GAP' });
    const cpi = byId(
      await c.read(route("What is Rwanda's latest inflation (CPI)?"), NOW),
      'ECONOMY_CPI',
    )!;
    expect(cpi.status).toBe('NO_DATA');
    expect(cpi.disclosures).toEqual(['NO_RETAINED_CAPTURE']);
  });

  it('GAP REPAIR R1 — a decoded figure the reader did not mark DISPLAYABLE is never used', async () => {
    const { c } = coordinator({ cpi: 'OBSERVATION_NOT_PUBLISHABLE' });
    const cpi = byId(
      await c.read(route("What is Rwanda's latest inflation (CPI)?"), NOW),
      'ECONOMY_CPI',
    )!;
    expect(cpi.status).toBe('NO_DATA');
    expect(cpi.observations).toEqual([]);
    expect(cpi.disclosures).toEqual(['RETAINED_ARTIFACT_NOT_DISPLAYABLE']);
  });

  it('CPI for a country with no governed series is NO_MATCH (never Rwanda’s figure)', async () => {
    const { c, calls } = coordinator({ cpi: 'OBSERVATION' });
    const cpi = byId(
      await c.read(route('What is the inflation rate in Kenya?'), NOW),
      'ECONOMY_CPI',
    )!;
    expect(cpi.status).toBe('NO_MATCH');
    expect(calls.economy).toBe(0);
  });
});

describe('5/6/7 — Imihigo and district geography', () => {
  it('EXACT positive: Ngoma 2024/2025 from the retained NISR record, with period and provenance', async () => {
    const { c } = coordinator();
    const set = await c.read(route("What was Ngoma's 2024/2025 Imihigo result?"), NOW);
    const imihigo = byId(set, 'IMIHIGO')!;
    expect(imihigo.status).toBe('USED');
    expect(imihigo.observations[0]).toMatchObject({
      label: 'Ngoma',
      value: '77.2',
      period: '2024/2025',
      geography: 'nisr:district:56',
    });
    expect((imihigo.observations[0] as { source: { name: string } }).source.name).toContain('NISR');
    expect(imihigo.disclosures).toEqual(['RETAINED_NOT_CURRENT', 'CLOSED_EVALUATION_CYCLE']);
  });

  it('COVERAGE negative: Gasabo does NOT inherit the City of Kigali aggregate', async () => {
    const { c } = coordinator();
    const set = await c.read(route('What was the Imihigo result of Gasabo district?'), NOW);
    const imihigo = byId(set, 'IMIHIGO')!;
    expect(imihigo.status).toBe('NO_MATCH');
    expect(imihigo.observations).toEqual([]);
    expect(imihigo.disclosures).toEqual(['AGGREGATE_NOT_ASSIGNED_TO_DISTRICT']);
  });

  it('district context: Gasabo resolves to its NISR district (City of Kigali, Rwanda) with no external call', async () => {
    const { c, calls } = coordinator();
    const set = await c.read(route('What is happening in Gasabo district?'), NOW);
    const geo = byId(set, 'GEOGRAPHY')!;
    expect(geo.status).toBe('USED');
    expect(geo.observations[0]).toMatchObject({
      reference: 'nisr:district:12',
      kind: 'NISR_DISTRICT',
      label: 'Gasabo',
    });
    expect(geo.disclosures).toEqual(['CONTEXT_NOT_EVIDENCE']);
    expect(set.considered.map((s) => s.contributorId)).toEqual(['GEOGRAPHY']);
    expect(calls).toEqual({ conflict: [], market: 0, economy: 0 });
  });

  it('a district name alone does not authorise an Imihigo score', async () => {
    const { c } = coordinator();
    const set = await c.read(route('What is happening in Ngoma district?'), NOW);
    expect(byId(set, 'IMIHIGO')).toBeUndefined();
  });

  it('the server reader is the SAME governed authority as the frontend (bytes + reviewed content hash)', () => {
    const repo = join(__dirname, '..', '..', '..', '..');
    const pairs = [
      [
        'frontend/src/lib/imihigo/retained.json',
        'backend/src/modules/ask-intelligence/data/imihigo-retained.json',
      ],
      [
        'frontend/src/lib/imihigo/authorities.json',
        'backend/src/modules/ask-intelligence/data/imihigo-authorities.json',
      ],
    ];
    for (const [a, b] of pairs) {
      expect(readFileSync(join(repo, b as string))).toEqual(readFileSync(join(repo, a as string)));
    }
    const view = readRetainedImihigo();
    expect(view.state).toBe('ADMITTED');
    const authority = JSON.parse(readFileSync(join(repo, pairs[1]![1] as string), 'utf-8'))[0];
    const retained = JSON.parse(readFileSync(join(repo, pairs[0]![1] as string), 'utf-8'));
    expect(imihigoContentHash(retained)).toBe(authority.contentHash);
    expect(view.records).toHaveLength(28);
  });
});

describe('8/9 — Humanitarian reality, multi-contributor', () => {
  it('a humanitarian question gets an honest NOT_ASSESSED contribution — never evidence', async () => {
    const { c } = coordinator();
    const hum = byId(
      await c.read(route('Is there a humanitarian crisis in Sudan?'), NOW),
      'HUMANITARIAN',
    )!;
    expect(hum.status).toBe('NOT_ASSESSED');
    expect(hum.observations).toEqual([]);
    expect(hum.disclosures).toEqual(['HUMANITARIAN_NOT_ASSESSED']);
  });

  it('Conflict + Humanitarian coexist; only the real one carries observations', async () => {
    const { c } = coordinator({ conflict: [conflictRow('e1', '2026-09-27')] });
    const set = await c.read(route('What is the humanitarian situation in eastern DRC?'), NOW);
    expect(set.considered.map((s) => s.contributorId)).toEqual(['CONFLICT', 'HUMANITARIAN']);
    expect(
      set.contributions.filter((x) => x.status === 'USED').map((x) => x.contributorId),
    ).toEqual(['CONFLICT']);
  });
});

describe('10/11/12 — no specialist where none applies', () => {
  it.each([
    'What is an induction motor?',
    'What is happening in Kenya?',
    'What are the latest major political developments in Poland today?',
    'Dlaczego artykuł 5 NATO jest ważny?',
  ])('%s → no contributor considered, no read performed', async (q) => {
    const { c, calls } = coordinator();
    const set = await c.read(route(q, q.startsWith('Dlaczego') ? 'pl' : 'en'), NOW);
    expect(set.considered).toEqual([]);
    expect(calls).toEqual({ conflict: [], market: 0, economy: 0 });
  });
});

describe('13 — failure and degradation never take the Ask down', () => {
  it('a failing read is DEGRADED, the others continue', async () => {
    const { c } = coordinator({ conflict: 'throw' });
    const set = await c.read(route('What is the humanitarian situation in eastern DRC?'), NOW);
    expect(byId(set, 'CONFLICT')).toMatchObject({
      status: 'DEGRADED',
      degradationReason: 'READ_FAILED',
    });
    expect(byId(set, 'HUMANITARIAN')?.status).toBe('NOT_ASSESSED');
  });

  it(`a hanging read is bounded (${READ_TIMEOUT_MS} ms) and DEGRADED`, async () => {
    jest.useFakeTimers();
    try {
      const { c } = coordinator({ conflict: 'hang' });
      const pending = c.read(route('How serious is the situation in eastern DRC?'), NOW);
      await jest.advanceTimersByTimeAsync(READ_TIMEOUT_MS + 1);
      expect(byId(await pending, 'CONFLICT')).toMatchObject({
        status: 'DEGRADED',
        degradationReason: 'TIMEOUT',
      });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('§15 — source / quota / security proofs by dependency inspection', () => {
  const src = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf-8');
  const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const READ_PATH = [
    src('ask-intelligence', 'ask-specialist-read.coordinator.ts'),
    src('ask-intelligence', 'contributor-selection.ts'),
    src('ask-intelligence', 'imihigo-retained.reader.ts'),
    src('ask-intelligence', 'ask-intelligence.module.ts'),
    src('conflict-observation', 'conflict-observation.repository.ts'),
    src('market-ingest', 'market-read.repository.ts'),
  ];
  it('no read path can fetch, schedule, acquire, activate a producer or call a model', () => {
    for (const file of READ_PATH.map(code)) {
      expect(file).not.toMatch(
        /\bfetch\(|axios|https?\.request|node:https?|safe-wire-fetch|official-data-transport/,
      );
      expect(file).not.toMatch(
        /Scheduler|Producer\b|ConflictObservationProducer|copernicus|Copernicus/,
      );
      expect(file).not.toMatch(
        /ANALYSIS_PROVIDER|GENERAL_BACKGROUND_PROVIDER|analyzeNews|answerBackground/,
      );
      expect(file).not.toMatch(/process\.env/);
    }
  });
  it('the module provides read repositories only — no controller, no producer, no scheduler', () => {
    const module = code(src('ask-intelligence', 'ask-intelligence.module.ts'));
    expect(module).not.toMatch(/controllers:/);
    expect(module).toMatch(
      /providers: \[ConflictObservationRepository, MarketReadRepository, AskSpecialistReadCoordinator\]/,
    );
  });
  it('Politics/Elections specialists are not executed: no contributor exists for them', () => {
    const selection = code(src('ask-intelligence', 'contributor-selection.ts'));
    expect(selection).not.toMatch(/POLITIC|ELECTION/);
  });
});
