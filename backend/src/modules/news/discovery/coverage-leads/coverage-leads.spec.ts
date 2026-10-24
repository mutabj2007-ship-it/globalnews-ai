import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { deriveLeadKeywords, LEAD_TOPICS } from '../gdelt-lead/lead-keywords';
import {
  LeadCallGate,
  LeadQueryCache,
  LEAD_CALLS_PER_HOUR,
  LEAD_COOLDOWN_AFTER_REFUSAL_MS,
  LEAD_MIN_SPACING_MS,
  LEAD_WINDOW_MS,
  type LeadBudgetStore,
  type LeadBudgetTx,
} from '../gdelt-lead/lead-call-gate';
import type { GdeltLeadUseRecord } from '../gdelt-lead/gdelt-lead.types';
import {
  coverageLeadsFor,
  MAX_LEADS_SHOWN,
  type CoverageLeadsDeps,
  type CoverageLeadView,
} from './coverage-leads.service';
import {
  fetchGdeltLeads,
  gdeltDocUrl,
  GdeltDocLeadSource,
  GDELT_DOC_API,
  type FetchLike,
} from './gdelt-doc-lead.source';

/* Synthetic only: every fetch is a fake, the budget store is an in-memory twin, no clock is real. */

/*
  The in-memory twin of the database budget store: ONE shared record of calls and refusals (what the
  ComputeMeter rows are), a lock that serialises every withLock exactly as pg_advisory_xact_lock does,
  and a clock the test drives. A "restart" or a "replica" is a NEW LeadCallGate on the SAME store.
*/
class BudgetTwin implements LeadBudgetStore {
  readonly calls: number[] = [];
  readonly refusals: number[] = [];
  unavailable = false;
  inside = 0;
  maxInside = 0;
  private chain: Promise<unknown> = Promise.resolve();
  constructor(readonly clock: { t: number }) {}
  withLock<T>(fn: (tx: LeadBudgetTx) => Promise<T>): Promise<T> {
    if (this.unavailable) return Promise.reject(new Error('database unreachable'));
    const run = this.chain.then(async () => {
      this.inside += 1;
      this.maxInside = Math.max(this.maxInside, this.inside);
      try {
        return await fn(this.tx);
      } finally {
        this.inside -= 1;
      }
    });
    this.chain = run.catch(() => undefined);
    return run;
  }
  private readonly tx: LeadBudgetTx = {
    now: async () => this.clock.t,
    callsSince: async (since) => this.calls.filter((c) => c > since).length,
    lastCallAt: async () => (this.calls.length === 0 ? null : Math.max(...this.calls)),
    lastRefusalAt: async () => (this.refusals.length === 0 ? null : Math.max(...this.refusals)),
    recordCall: async (at) => {
      this.calls.push(at);
    },
    recordRefusal: async (at) => {
      this.refusals.push(at);
    },
  };
}

/** every rolling hour holds at most LEAD_CALLS_PER_HOUR calls and every two calls are at least 5 s apart */
function assertWithinBudget(calls: readonly number[]): void {
  const sorted = [...calls].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(LEAD_MIN_SPACING_MS);
    const inWindow = sorted.filter((c) => c > sorted[i] - LEAD_WINDOW_MS && c <= sorted[i]).length;
    expect(inWindow).toBeLessThanOrEqual(LEAD_CALLS_PER_HOUR);
  }
}

const USE_RECORD: GdeltLeadUseRecord = {
  termsUrl: 'https://www.gdeltproject.org/about.html',
  termsSha256: 'b'.repeat(64),
  termsReadAt: '2026-10-24T06:00:00Z',
  e1VerdictRef: 'SYNTHETIC-TEST-ONLY',
  e1Wording: 'synthetic',
};
const ON = { GDELT_LEAD_DISCOVERY_ENABLED: 'true' };

const article = (i: number, over: Record<string, unknown> = {}) => ({
  url: `https://outlet${i}.example.org/business/story-${i}`,
  title: 'PUBLISHER HEADLINE MUST NEVER PASS',
  socialimage: 'https://img.example.org/x.jpg',
  seendate: '20261024T061500Z',
  domain: `outlet${i}.example.org`,
  language: 'English',
  sourcecountry: 'Kenya',
  ...over,
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function deps(
  fetchImpl: FetchLike,
  over: Partial<CoverageLeadsDeps> = {},
  clock = { t: 1_000_000 },
): CoverageLeadsDeps {
  return {
    env: ON,
    useRecord: USE_RECORD,
    source: new GdeltDocLeadSource(fetchImpl),
    gate: new LeadCallGate(new BudgetTwin(clock)),
    cache: new LeadQueryCache<readonly CoverageLeadView[]>(15 * 60_000, 200, () => clock.t),
    ...over,
  };
}

describe('coverage leads · privacy: only closed vocabularies leave the server (CTO R168)', () => {
  it('a Kenya economy question becomes a gazetteer place plus a listed topic', () => {
    expect(deriveLeadKeywords("What's happening with Kenya's economy this week?")).toEqual({
      kind: 'QUERY',
      place: 'Kenya',
      topics: ['economy'],
      gdeltQuery: '"kenya" "economy"',
    });
  });

  it('two topics are ORed; the place is always required', () => {
    expect(deriveLeadKeywords('Floods and cholera in Mozambique?')).toMatchObject({
      kind: 'QUERY',
      gdeltQuery: '"mozambique" ("floods" OR "cholera")',
    });
  });

  it.each([
    'What is inflation?',
    'Explain how central banks set interest rates',
    'Tell us about elections',
  ])('no gazetteer place → NO_PLACE, nothing looked up: %p', (question) => {
    expect(deriveLeadKeywords(question)).toEqual({ kind: 'NO_PLACE' });
  });

  it.each(['Latest news from Congo', 'What is going on in Georgia?'])(
    'an ambiguous place name is never sent (COD/COG, GEO/US state): %p',
    (question) => {
      expect(deriveLeadKeywords(question)).toEqual({ kind: 'NO_PLACE' });
    },
  );

  it.each([
    'Republic of the Congo floods',
    'News from Congo-Brazzaville',
    'Congo Brazzaville economy',
    'What happened in Sudan this week?',
    'Guinea election news',
    'Georgia protests today',
    'Oil spill in the Niger Delta',
    'New Mexico wildfires',
    'Northern Ireland protests',
    'New Jersey election',
  ])('EA R168 P1/(A) · an ambiguous or contained place is never looked up: %p', (question) => {
    expect(deriveLeadKeywords(question)).toEqual({ kind: 'NO_PLACE' });
  });

  it.each([
    ['South Sudan floods', 'south sudan'],
    ['Papua New Guinea election', 'papua new guinea'],
    ['Nigeria inflation', 'nigeria'],
    ['Kinshasa protests', 'kinshasa'],
    ['Goma fighting in DR Congo', 'dr congo'],
  ])('EA R168 · the unambiguous place still works: %p', (question, place) => {
    const k = deriveLeadKeywords(question);
    expect(k.kind === 'QUERY' ? k.place.toLowerCase() : k.kind).toBe(place);
  });

  it.each([
    'How does the war in Ukraine affect food prices in Kenya?',
    'Rwanda and DR Congo talks',
    'Nairobi and Kampala protests',
  ])(
    'EA R168 (C) · two different countries named → MULTI_PLACE, nothing looked up: %p',
    (question) => {
      expect(deriveLeadKeywords(question)).toEqual({ kind: 'MULTI_PLACE' });
    },
  );

  it.each([
    "Is Ethiopia's dam affecting Sudan?",
    'Refugees crossing from Sudan into Chad',
    'Rwanda and the Republic of the Congo',
    'Kenya and Congo trade',
    'Nigeria border with Niger',
    'South Sudan oil through Sudan',
    'Kinshasa and Congo',
    'Michael Jordan visits Israel',
  ])(
    'EA R168 P2-1 · an ambiguous or uncued place still counts as a second place → MULTI_PLACE: %p',
    (question) => {
      expect(deriveLeadKeywords(question)).toEqual({ kind: 'MULTI_PLACE' });
    },
  );

  it.each([
    'Cyclone in American Samoa',
    'Michael Jordan retirement news',
    'Turkey prices before the holidays',
    'Chad Smith concert',
  ])(
    'EA R168 P2-2/P3 · a contained place or an uncued common word is never looked up alone: %p',
    (question) => {
      expect(deriveLeadKeywords(question)).toEqual({ kind: 'NO_PLACE' });
    },
  );

  it.each([
    ['Floods in Jordan', 'jordan'],
    ['Inflation in Turkey', 'turkey'],
    ['Refugees arriving from Chad', 'chad'],
  ])('EA R168 P3 · a cued country that is also a common word is sent: %p', (question, place) => {
    const k = deriveLeadKeywords(question);
    expect(k.kind === 'QUERY' ? k.place.toLowerCase() : k.kind).toBe(place);
  });

  it('EA R168 · no query ever sends a bare "congo", "sudan", "guinea", "georgia", "niger" or "mexico"', () => {
    for (const q of [
      'Congo',
      'Republic of Congo',
      'Sudan',
      'Guinea',
      'Georgia',
      'Congo Brazzaville',
      'Niger',
      'Mexico',
      'Ireland',
    ]) {
      const k = deriveLeadKeywords(q);
      if (k.kind === 'QUERY')
        expect(k.gdeltQuery).not.toMatch(
          /^"(congo|sudan|guinea|georgia|niger|mexico|ireland|republic of the congo)"/,
        );
    }
  });

  it('the long DR Congo name is one place, sent in the gazetteer spelling', () => {
    const k = deriveLeadKeywords('Floods in the Democratic Republic of the Congo');
    expect(k.kind).toBe('QUERY');
    expect(k.kind === 'QUERY' ? k.place : '').toMatch(/congo/i);
    expect(k.kind === 'QUERY' ? k.place : '').not.toBe('Congo');
  });

  it.each([
    'Email me at reader@example.com about Kenya inflation',
    'Kenya news, call me on +254 712 345 678',
    'See https://example.com/kenya and tell me about the economy',
    'My diagnosis came back, what is the health situation in Kenya?',
    'Kenya passport number renewal news',
  ])(
    'a private or sensitive question is SUPPRESSED, even though none of its words would be sent: %p',
    (question) => {
      expect(deriveLeadKeywords(question)).toEqual({ kind: 'SUPPRESSED' });
    },
  );

  it('property: every word sent is a gazetteer place word or a listed topic keyword, never the reader’s other words', () => {
    const topicWords = new Set(Object.values(LEAD_TOPICS).flatMap((t) => t.split(' ')));
    for (const question of [
      'My neighbour Wanjiku asked about Kenya economy and maize prices near Eldoret farm 7',
      'Is the Rwanda budget hurting teachers like my sister Aline?',
      'nairobi protests today what does Ruto say',
    ]) {
      const k = deriveLeadKeywords(question);
      expect(k.kind).toBe('QUERY');
      if (k.kind !== 'QUERY') continue;
      const placeWords = new Set(k.place.toLowerCase().split(/\s+/));
      const sent = k.gdeltQuery
        .replace(/[()"]/g, ' ')
        .split(/\s+/)
        .filter((w) => w !== '' && w !== 'OR');
      for (const word of sent) expect(placeWords.has(word) || topicWords.has(word)).toBe(true);
      expect(k.gdeltQuery).not.toMatch(
        /wanjiku|aline|sister|neighbour|teachers|ruto|farm|eldoret|7/i,
      );
    }
  });

  it('prototype names are not topics ("constructor" is a word, not a vocabulary entry)', () => {
    expect(deriveLeadKeywords('Kenya constructor toString news')).toMatchObject({ topics: [] });
  });
});

describe('coverage leads · durable environment-wide budget (CTO R169 ≤60, E1 V5 30 per rolling hour, ≥5 s, no fail-open)', () => {
  it('cap exhaustion: 60 calls in an hour, the 61st refused; the window rolls, it never resets', async () => {
    const store = new BudgetTwin({ t: 0 });
    const gate = new LeadCallGate(store);
    for (let i = 0; i < LEAD_CALLS_PER_HOUR; i++) {
      expect(await gate.reserve()).toEqual({ granted: true });
      store.clock.t += LEAD_MIN_SPACING_MS;
    }
    expect(await gate.reserve()).toEqual({ granted: false, reason: 'HOURLY_CAP' });
    store.clock.t = LEAD_WINDOW_MS - 1; // the first call is still inside the hour
    expect(await gate.reserve()).toEqual({ granted: false, reason: 'HOURLY_CAP' });
    store.clock.t = LEAD_WINDOW_MS; // now it has left: exactly one slot frees
    expect(await gate.reserve()).toEqual({ granted: true });
    assertWithinBudget(store.calls);
  });

  it('spacing: a call inside 5 s of the last one is refused', async () => {
    const store = new BudgetTwin({ t: 0 });
    const gate = new LeadCallGate(store);
    expect(await gate.reserve()).toEqual({ granted: true });
    store.clock.t = LEAD_MIN_SPACING_MS - 1;
    expect(await gate.reserve()).toEqual({ granted: false, reason: 'SPACING' });
    store.clock.t = LEAD_MIN_SPACING_MS;
    expect(await gate.reserve()).toEqual({ granted: true });
  });

  it.each([3, 5, 12])(
    '%i restarts inside one hour never exceed the cap: every new process reads the shared count',
    async (restarts) => {
      const store = new BudgetTwin({ t: 0 });
      const perProcess = Math.ceil(LEAD_WINDOW_MS / LEAD_MIN_SPACING_MS / (restarts + 1));
      let granted = 0;
      for (let r = 0; r <= restarts; r++) {
        const gate = new LeadCallGate(store); // a fresh process: no memory of its own
        for (let i = 0; i < perProcess && store.clock.t < LEAD_WINDOW_MS; i++) {
          if ((await gate.reserve()).granted) granted += 1;
          store.clock.t += LEAD_MIN_SPACING_MS;
        }
      }
      expect(granted).toBe(LEAD_CALLS_PER_HOUR); // the cap is reached, and not passed, across all restarts
      assertWithinBudget(store.calls);
    },
  );

  it('concurrent replicas: 4 replicas × 50 simultaneous requests → exactly one call, lock never shared', async () => {
    const store = new BudgetTwin({ t: 0 });
    const replicas = Array.from({ length: 4 }, () => new LeadCallGate(store));
    const results = await Promise.all(
      replicas.flatMap((gate) => Array.from({ length: 50 }, () => gate.reserve())),
    );
    expect(results.filter((r) => r.granted)).toHaveLength(1);
    expect(store.maxInside).toBe(1);
  });

  it('property: replicas, restarts and bursts over six simulated hours stay within every rolling hour', async () => {
    const store = new BudgetTwin({ t: 0 });
    let replicas = Array.from({ length: 3 }, () => new LeadCallGate(store));
    let seed = 7;
    const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    while (store.clock.t < 6 * LEAD_WINDOW_MS) {
      if (rand() < 0.01) replicas = replicas.map(() => new LeadCallGate(store)); // everyone restarts
      await Promise.all(
        replicas.map((gate) => (rand() < 0.8 ? gate.reserve() : Promise.resolve(null))),
      );
      store.clock.t += Math.floor(rand() * 4_000);
    }
    expect(store.calls.length).toBeGreaterThan(LEAD_CALLS_PER_HOUR * 5); // the cap was actually reached
    assertWithinBudget(store.calls);
  });

  it('lost lock / database unreachable: nothing is called (BUDGET_UNREADABLE), the service shows CAPACITY', async () => {
    const store = new BudgetTwin({ t: 0 });
    store.unavailable = true;
    expect(await new LeadCallGate(store).reserve()).toEqual({
      granted: false,
      reason: 'BUDGET_UNREADABLE',
    });
    const fetchImpl = jest.fn();
    const out = await coverageLeadsFor(
      'Kenya economy',
      deps(fetchImpl, { gate: new LeadCallGate(store) }),
    );
    expect(out.state).toBe('CAPACITY');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('a crash inside the locked section releases the lock and records nothing', async () => {
    const store = new BudgetTwin({ t: 0 });
    await expect(
      store.withLock(async () => {
        throw new Error('process died mid-transaction');
      }),
    ).rejects.toThrow();
    expect(await new LeadCallGate(store).reserve()).toEqual({ granted: true });
    expect(store.calls).toHaveLength(1);
  });

  it('a GDELT refusal shuts EVERY instance for 15 minutes, across a restart; nothing is retried', async () => {
    const store = new BudgetTwin({ t: 0 });
    await new LeadCallGate(store).reserve();
    await new LeadCallGate(store).refused();
    const afterRestart = new LeadCallGate(store);
    store.clock.t = LEAD_COOLDOWN_AFTER_REFUSAL_MS - 1;
    expect(await afterRestart.reserve()).toEqual({ granted: false, reason: 'COOLDOWN' });
    store.clock.t = LEAD_COOLDOWN_AFTER_REFUSAL_MS;
    expect(await afterRestart.reserve()).toEqual({ granted: true });
  });

  it('the shipped gate is 30 per rolling hour (E1 V5), inside the CTO 60 ceiling, and at least 5 s apart', () => {
    expect(LEAD_CALLS_PER_HOUR).toBe(30);
    expect(LEAD_CALLS_PER_HOUR).toBeLessThanOrEqual(60);
    expect(LEAD_MIN_SPACING_MS).toBe(5_000);
    expect(LEAD_WINDOW_MS).toBe(3_600_000);
  });
});

describe('coverage leads · service (fail-closed order, one lead per outlet, never content)', () => {
  it('default env answers OFF and makes no call', async () => {
    const fetchImpl = jest.fn();
    const out = await coverageLeadsFor('Kenya economy', deps(fetchImpl, { env: {} }));
    expect(out.state).toBe('OFF');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('switch on without the governed E1 record answers NOT_AUTHORIZED and makes no call', async () => {
    const fetchImpl = jest.fn();
    const out = await coverageLeadsFor('Kenya economy', deps(fetchImpl, { useRecord: null }));
    expect(out.state).toBe('NOT_AUTHORIZED');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('suppressed and place-less questions make no call', async () => {
    const fetchImpl = jest.fn();
    expect((await coverageLeadsFor('reader@example.com Kenya', deps(fetchImpl))).state).toBe(
      'SUPPRESSED',
    );
    expect((await coverageLeadsFor('What is inflation?', deps(fetchImpl))).state).toBe('NO_PLACE');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('LEADS: at most five, one per outlet, fields only; no title, image or count; GDELT credit attached', async () => {
    const articles = [
      ...Array.from({ length: 8 }, (_, i) => article(i)),
      article(1, { url: 'https://outlet1.example.org/business/dup' }),
    ];
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ articles }));
    const out = await coverageLeadsFor('Kenya economy news', deps(fetchImpl));
    expect(out.state).toBe('LEADS');
    expect(out.leads).toHaveLength(MAX_LEADS_SHOWN);
    expect(new Set(out.leads.map((l) => l.outlet)).size).toBe(MAX_LEADS_SHOWN);
    expect(Object.keys(out.leads[0]).sort()).toEqual([
      'language',
      'outlet',
      'outletCountry',
      'seenByGdeltAt',
      'url',
    ]);
    expect(JSON.stringify(out)).not.toMatch(
      /PUBLISHER HEADLINE|img\.example|publishedAt|sourcesSearched|citations|articles/,
    );
    expect(out.attribution).toEqual({
      citation: 'The GDELT Project',
      link: 'https://www.gdeltproject.org/',
    });
    expect(out.lookedUp).toEqual({ place: 'Kenya', topics: ['economy'] });
  });

  it('an identical keyword query within 15 minutes is served from cache: one GDELT call', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ articles: [article(1)] }));
    const d = deps(fetchImpl);
    await coverageLeadsFor('Kenya economy', d);
    const again = await coverageLeadsFor('How is the Kenya economy doing?', d);
    expect(again.state).toBe('LEADS');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('a 429 answers UNAVAILABLE, shuts the gate, and the next new query is CAPACITY with no call', async () => {
    const clock = { t: 1_000_000 };
    const fetchImpl = jest.fn().mockResolvedValue(new Response('slow down', { status: 429 }));
    const d = deps(fetchImpl, {}, clock);
    expect((await coverageLeadsFor('Kenya economy', d)).state).toBe('UNAVAILABLE');
    clock.t += 10_000;
    expect((await coverageLeadsFor('Uganda floods', d)).state).toBe('CAPACITY');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('a found-nothing answer is NONE, not an error, and is cached', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}));
    const d = deps(fetchImpl);
    expect((await coverageLeadsFor('Kenya economy', d)).state).toBe('NONE');
    expect((await coverageLeadsFor('Kenya economy', d)).state).toBe('NONE');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('an unsafe lead URL is never shown', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        articles: [
          article(1, { url: 'http://outlet1.example.org/a' }),
          article(2, { url: 'https://10.0.0.1/a' }),
        ],
      }),
    );
    const out = await coverageLeadsFor('Kenya economy', deps(fetchImpl));
    expect(out.leads).toEqual([]);
  });
});

describe('coverage leads · the one network file', () => {
  it('reaches only the fixed GDELT DOC 2.0 origin; only the keyword query varies', () => {
    const url = new URL(gdeltDocUrl('"kenya" "economy"'));
    expect(`${url.origin}${url.pathname}`).toBe(GDELT_DOC_API);
    expect(url.origin).toBe('https://api.gdeltproject.org');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      query: '"kenya" "economy"',
      mode: 'ArtList',
      format: 'json',
      maxrecords: '25',
      timespan: '3d',
      sort: 'DateDesc',
    });
  });

  it('sends no credentials, follows no redirect, sets a timeout', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ articles: [] }));
    await fetchGdeltLeads('"kenya"', fetchImpl);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init).toMatchObject({ method: 'GET', redirect: 'error', credentials: 'omit' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(Object.keys(init.headers as Record<string, string>)).toEqual(['accept']);
  });

  it.each([
    [new Response('bad query text', { status: 200 }), { kind: 'FAILED', reason: 'NOT_JSON' }],
    [new Response('x', { status: 503 }), { kind: 'REFUSED_BY_GDELT', status: 503 }],
    [new Response('x', { status: 404 }), { kind: 'FAILED', reason: 'HTTP_404' }],
    [
      new Response('x'.repeat(1_000_001), { status: 200 }),
      { kind: 'FAILED', reason: 'BODY_TOO_LARGE' },
    ],
  ])('a bad answer is no leads (%#)', async (response, expected) => {
    expect(await fetchGdeltLeads('"kenya"', jest.fn().mockResolvedValue(response))).toEqual(
      expected,
    );
  });

  it('a network error or timeout is no leads, never a throw to the reader path', async () => {
    const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' });
    expect(await fetchGdeltLeads('"kenya"', jest.fn().mockRejectedValue(timeout))).toEqual({
      kind: 'FAILED',
      reason: 'TimeoutError',
    });
  });
});

describe('coverage leads · structure', () => {
  const backendSrc = resolve(__dirname, '../../../..');

  it('the module is registered once, in app.module, and nothing else imports this folder', () => {
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === 'generated' || name === 'node_modules') continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (path !== resolve(__dirname)) walk(path);
        } else if (
          name.endsWith('.ts') &&
          /discovery\/coverage-leads/.test(readFileSync(path, 'utf8'))
        ) {
          importers.push(
            path
              .slice(backendSrc.length + 1)
              .split('\\')
              .join('/'),
          );
        }
      }
    };
    walk(backendSrc);
    expect(importers).toEqual(['app.module.ts']);
  });

  it('the only route is POST /news/coverage-leads (the question never rides in a URL)', () => {
    const source = readFileSync(join(__dirname, 'coverage-leads.controller.ts'), 'utf8');
    expect(source).toMatch(/@Post\('coverage-leads'\)/);
    expect(source).not.toMatch(/@Get\(/);
  });

  it('the service never logs the question', () => {
    const source = readFileSync(join(__dirname, 'coverage-leads.service.ts'), 'utf8');
    for (const line of source.split('\n').filter((l) => /logger\.(log|warn|error|debug)/.test(l))) {
      expect(line).not.toMatch(/question/);
    }
  });
});
