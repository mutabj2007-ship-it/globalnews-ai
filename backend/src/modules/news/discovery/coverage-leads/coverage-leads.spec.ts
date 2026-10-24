import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { deriveLeadKeywords, LEAD_TOPICS } from '../gdelt-lead/lead-keywords';
import {
  LeadCallGate,
  LeadQueryCache,
  LEAD_CALLS_PER_HOUR,
  LEAD_MIN_SPACING_MS,
  type InstanceLock,
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

/* Synthetic only: every fetch is a fake, every lock is a fake, no clock is real. */

const USE_RECORD: GdeltLeadUseRecord = {
  termsUrl: 'https://www.gdeltproject.org/about.html',
  termsSha256: 'b'.repeat(64),
  termsReadAt: '2026-10-24T06:00:00Z',
  e1VerdictRef: 'SYNTHETIC-TEST-ONLY',
  e1Wording: 'synthetic',
};
const ON = { GDELT_LEAD_DISCOVERY_ENABLED: 'true' };
const held: InstanceLock = async () => ({ alive: () => true });

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
    gate: new LeadCallGate(held, () => clock.t),
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

describe('coverage leads · capacity gate (≤60/h environment-wide, ≥5 s, no fail-open)', () => {
  it('only the lock holder may call; a refused lock is retried at most once a minute', async () => {
    let attempts = 0;
    const clock = { t: 0 };
    const gate = new LeadCallGate(
      async () => {
        attempts += 1;
        return null;
      },
      () => clock.t,
    );
    expect(await gate.reserve()).toEqual({ granted: false, reason: 'NOT_THE_GATE_INSTANCE' });
    clock.t += 30_000;
    expect(await gate.reserve()).toEqual({ granted: false, reason: 'NOT_THE_GATE_INSTANCE' });
    expect(attempts).toBe(1);
    clock.t += 31_000;
    await gate.reserve();
    expect(attempts).toBe(2);
  });

  it('a lock that throws is treated as not held (fail closed)', async () => {
    const gate = new LeadCallGate(async () => {
      throw new Error('db down');
    });
    expect(await gate.reserve()).toEqual({ granted: false, reason: 'NOT_THE_GATE_INSTANCE' });
  });

  it('enforces ≥5 s spacing and the per-holder hourly cap (half the 60/h ceiling)', async () => {
    const clock = { t: 0 };
    const gate = new LeadCallGate(held, () => clock.t);
    expect(await gate.reserve()).toEqual({ granted: true });
    clock.t += LEAD_MIN_SPACING_MS - 1;
    expect(await gate.reserve()).toEqual({ granted: false, reason: 'SPACING' });
    clock.t += 1;
    expect(await gate.reserve()).toEqual({ granted: true });
    for (let i = 2; i < LEAD_CALLS_PER_HOUR; i++) {
      clock.t += LEAD_MIN_SPACING_MS;
      expect((await gate.reserve()).granted).toBe(true);
    }
    expect(LEAD_CALLS_PER_HOUR).toBe(30);
    clock.t += LEAD_MIN_SPACING_MS;
    expect(await gate.reserve()).toEqual({ granted: false, reason: 'HOURLY_CAP' });
    clock.t += 60 * 60_000;
    expect(await gate.reserve()).toEqual({ granted: true });
  });

  it('a GDELT refusal shuts the gate for 15 minutes; nothing is retried', async () => {
    const clock = { t: 0 };
    const gate = new LeadCallGate(held, () => clock.t);
    await gate.reserve();
    gate.refused();
    clock.t += 14 * 60_000;
    expect(await gate.reserve()).toEqual({ granted: false, reason: 'COOLDOWN' });
    clock.t += 60_000;
    expect(await gate.reserve()).toEqual({ granted: true });
  });

  it('a lost lock re-taken starts a FULL window, never an empty one', async () => {
    const clock = { t: 0 };
    const sessions: { alive: boolean }[] = [];
    const gate = new LeadCallGate(
      async () => {
        const session = { alive: true };
        sessions.push(session);
        return { alive: () => session.alive };
      },
      () => clock.t,
    );
    expect((await gate.reserve()).granted).toBe(true);
    sessions[0].alive = false; // the first session's connection dropped
    clock.t += 61_000;
    expect(await gate.reserve()).toEqual({ granted: false, reason: 'HOURLY_CAP' });
    expect(sessions).toHaveLength(2);
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
