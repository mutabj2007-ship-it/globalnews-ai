import type { OfficialDataTransportRequest } from '@globalnews-ai/shared';
import type { ConfigService } from '@nestjs/config';
import type { WireResponse } from '../official-data/official-data-transport.node';
import { EvidenceDiscoveryService } from '../news/evidence/evidence-discovery.service';
import { OfficialBulletinCollector } from './official-bulletin.collector';
import {
  nextRnpWindow,
  parseRnpCollectorSlot,
  RNP_SLOT_MS,
  RNP_WINDOW_MS,
  rnpWindowAt,
} from './rnp-collection-schedule';
import { RNP_LISTING_URL, RNP_POLL_INTERVAL_MS, RNP_ROBOTS_URL } from './rnp-listing.reader';
import { RNP_LEASE_RUN_KEY, RnpPollLease, type RnpLeaseStore } from './rnp-poll-lease';

/* CTO R158 §1–§2 — one source-wide budget, single collector, metadata only. Fake wire and fake table: no network. */

const MIN = 60 * 1000;

/** The MarketIngestLease row semantics the lease relies on: unique runKey, conditional UPDATE. */
function fakeTable(): RnpLeaseStore & { rows: Map<string, { owner: string; acquiredAt: Date }> } {
  const rows = new Map<string, { owner: string; acquiredAt: Date }>();
  return {
    rows,
    async updateMany({ where, data }) {
      const row = rows.get(where.runKey);
      if (row === undefined || !(row.acquiredAt < where.acquiredAt.lt)) return { count: 0 };
      rows.set(where.runKey, { owner: data.owner, acquiredAt: data.acquiredAt });
      return { count: 1 };
    },
    async create({ data }) {
      if (rows.has(data.runKey)) throw Object.assign(new Error('unique'), { code: 'P2002' });
      rows.set(data.runKey, { owner: data.owner, acquiredAt: data.acquiredAt });
      return {};
    },
  };
}

/* Seven synthetic items with the measured live geography: 1 South Sudan, 6 unknown, 0 Rwanda.
   (One reads "from Rwanda" — an origin, not a location.) Sentinel titles only; no real headline. */
const TITLES = [
  'ZZ-SENTINEL-1 officers deployed in South Sudan',
  'ZZ-SENTINEL-2 officers return from Rwanda training',
  'ZZ-SENTINEL-3 community policing week',
  'ZZ-SENTINEL-4 road safety campaign',
  'ZZ-SENTINEL-5 Rwanda National Police partners',
  'ZZ-SENTINEL-6 passing-out ceremony',
  'ZZ-SENTINEL-7 anti-drug drive',
];
const LISTING = `<html><head><base href="https://police.gov.rw/"></head><body><div class="news-default">${TITLES.map(
  (
    title,
    i,
  ) => `<div class="single-news"><a href="media/news-detail/news/slug-${i}/?cHash=${i}"></a>
  <time itemprop="datePublished" datetime="2026-10-1${i}">x</time>
  <h3 class="news-title"><a href="media/news-detail/news/slug-${i}/?cHash=${i}">${title}</a></h3></div>`,
).join('')}</div></body></html>`;

const reply = (body: string): WireResponse => ({
  status: 200,
  finalUrl: '',
  headers: {},
  wireBytes: new TextEncoder().encode(body),
  redirectChain: [],
});

function config(values: Record<string, string>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

/** Many processes, one shared table, one shared clock; every request any of them makes is recorded. */
function world(start = Date.parse('2026-10-18T09:00:00Z')) {
  let t = start;
  const requests: { at: number; url: string; env: string }[] = [];
  const tables = new Map<string, ReturnType<typeof fakeTable>>();
  const spawn = (env: string, slot: string) => {
    if (!tables.has(env)) tables.set(env, fakeTable());
    const wire = async (request: OfficialDataTransportRequest) => {
      requests.push({ at: t, url: request.url, env });
      return reply(request.url === RNP_ROBOTS_URL ? '' : LISTING);
    };
    const collector = new OfficialBulletinCollector(
      config({ RNP_OFFICIAL_BULLETIN_ENABLED: 'true', RNP_COLLECTOR_SLOT: slot }),
      undefined,
      wire,
      tables.get(env),
    );
    collector.now = () => t;
    collector.jitter = () => 0;
    collector.onModuleInit();
    collector.onModuleDestroy(); /* specs drive tick() by hand; no live timers */
    return collector;
  };
  return {
    spawn,
    requests,
    tables,
    now: () => t,
    set: (v: number) => (t = v),
    advance: (ms: number) => (t += ms),
  };
}

const listingReads = <R extends { at: number; url: string }>(requests: R[]): R[] =>
  requests.filter((r) => r.url === RNP_LISTING_URL);
const minSpacing = (ats: number[]) =>
  ats
    .slice()
    .sort((a, b) => a - b)
    .reduce((m, a, i, all) => (i === 0 ? m : Math.min(m, a - all[i - 1]!)), Infinity);

describe('RNP collection schedule (source-wide budget)', () => {
  it('accepts only an explicit k/N; no default, so two environments cannot both fall back to one slot', () => {
    expect(parseRnpCollectorSlot('0/1')).toEqual({ index: 0, of: 1 });
    expect(parseRnpCollectorSlot(' 1 / 2 ')).toEqual({ index: 1, of: 2 });
    for (const bad of [undefined, '', '1', '2/2', '0/0', '0/5', 'a/b', '-1/2'])
      expect(parseRnpCollectorSlot(bad)).toBeNull();
  });

  it.each([1, 2, 3, 4])(
    'any two windows across all %i slots open ≥ 30 min apart, end to start',
    (n) => {
      const t0 = Date.parse('2026-10-18T00:00:00Z');
      const windows = Array.from({ length: n }, (_, k) => k).flatMap((k) => {
        const out = [];
        let w = nextRnpWindow({ index: k, of: n }, t0);
        for (let i = 0; i < 20; i++) {
          out.push(w);
          w = nextRnpWindow({ index: k, of: n }, w.start + 1);
        }
        return out;
      });
      windows.sort((a, b) => a.start - b.start);
      for (let i = 1; i < windows.length; i++)
        expect(windows[i]!.start - windows[i - 1]!.end).toBeGreaterThanOrEqual(30 * MIN);
    },
  );

  it('a slot is inside its window only for the first 5 minutes of its own 35-minute slot', () => {
    const slot = { index: 1, of: 2 };
    const w = nextRnpWindow(slot, Date.parse('2026-10-18T00:00:00Z'));
    expect(rnpWindowAt(slot, w.start)).toEqual(w);
    expect(rnpWindowAt(slot, w.start + RNP_WINDOW_MS - 1)).toEqual(w);
    expect(rnpWindowAt(slot, w.start + RNP_WINDOW_MS)).toBeNull();
    expect(rnpWindowAt({ index: 0, of: 2 }, w.start)).toBeNull();
    expect(RNP_SLOT_MS - RNP_WINDOW_MS).toBe(30 * MIN);
  });
});

describe('RNP poll lease (single collector per environment)', () => {
  it('one winner per window; a later window can be won again; an erroring table refuses', async () => {
    const table = fakeTable();
    const a = new RnpPollLease(table, 'a');
    const b = new RnpPollLease(table, 'b');
    const w1 = { start: 1_000_000, end: 1_300_000 };
    expect(await a.claim(w1)).toBe(true);
    expect(await b.claim(w1)).toBe(false);
    expect(await a.claim(w1)).toBe(false);
    expect(await b.claim({ start: 3_100_000, end: 3_400_000 })).toBe(true);
    expect(table.rows.get(RNP_LEASE_RUN_KEY)?.owner).toBe('b');
    const broken: RnpLeaseStore = {
      updateMany: async () => {
        throw new Error('db down');
      },
      create: async () => ({}),
    };
    expect(await new RnpPollLease(broken, 'c').claim(w1)).toBe(false);
  });
});

describe('Official-bulletin collector', () => {
  it('is off without the flag, and misconfigured without a valid slot; neither makes a request', async () => {
    const wire = jest.fn();
    const off = new OfficialBulletinCollector(config({}), undefined, wire, fakeTable());
    const noSlot = new OfficialBulletinCollector(
      config({ RNP_OFFICIAL_BULLETIN_ENABLED: 'true' }),
      undefined,
      wire,
      fakeTable(),
    );
    for (const c of [off, noSlot]) {
      c.onModuleInit();
      await c.tick();
      c.onModuleDestroy();
    }
    expect(off.current()).toMatchObject({ state: 'OFF', reason: 'LANE_DISABLED', items: [] });
    expect(noSlot.current()).toMatchObject({
      state: 'MISCONFIGURED',
      reason: 'COLLECTOR_SLOT_INVALID',
    });
    expect(wire).not.toHaveBeenCalled();
  });

  it('reads nothing on boot, then once in its window: metadata only, measured geography SSD 1 / unknown 6 / RWA 0', async () => {
    const w = world();
    const c = w.spawn('alpha', '0/1');
    await c.tick();
    expect(w.requests).toHaveLength(0);
    expect(c.current().state).toBe('PENDING');
    w.set(nextRnpWindow({ index: 0, of: 1 }, w.now() + RNP_POLL_INTERVAL_MS).start);
    await c.tick();
    await c.tick();
    expect(w.requests.map((r) => r.url)).toEqual([RNP_ROBOTS_URL, RNP_LISTING_URL]);
    const snap = c.current();
    expect(snap).toMatchObject({
      sourceId: 'rnp',
      sourceName: 'Rwanda National Police',
      state: 'SEARCHED',
      checkedAt: new Date(w.now()).toISOString(),
    });
    expect(snap.items).toHaveLength(7);
    expect(
      snap.items.every((i) => Object.keys(i).sort().join() === 'eventCountry,publishedOn,url'),
    ).toBe(true);
    expect(snap.items.filter((i) => i.eventCountry === 'SSD')).toHaveLength(1);
    expect(snap.items.filter((i) => i.eventCountry === null)).toHaveLength(6);
    expect(snap.items.filter((i) => i.eventCountry === 'RWA')).toHaveLength(0);
    /* no headline, no title hash: nothing a reader response or a prompt could carry as text */
    expect(JSON.stringify(snap)).not.toMatch(/ZZ-SENTINEL|titleKey|"slug"/);
  });

  it('replicas, restarts and an overlapping deployment in one environment: one listing read per window, ≥ 30 min apart', async () => {
    const w = world();
    const slot = '0/1';
    let fleet = [w.spawn('alpha', slot), w.spawn('alpha', slot)];
    w.advance(RNP_POLL_INTERVAL_MS);
    for (let step = 0; step < 24 * 12; step++) {
      /* every 5 minutes: each live process ticks at three moments inside any window */
      for (const offset of [0, 1 * MIN, 4 * MIN]) {
        const at = w.now();
        w.set(at + offset);
        for (const c of fleet) await c.tick();
        w.set(at);
      }
      if (step % 17 === 0)
        fleet = [
          ...fleet.slice(1),
          w.spawn('alpha', slot),
        ]; /* rolling restart: new + old overlap */
      if (step % 29 === 0) fleet.push(w.spawn('alpha', slot)); /* scale-out */
      w.advance(5 * MIN);
    }
    const reads = listingReads(w.requests).map((r) => r.at);
    expect(reads.length).toBeGreaterThan(20);
    expect(minSpacing(reads)).toBeGreaterThanOrEqual(30 * MIN);
  });

  it('Alpha and Production with separate databases (slots 0/2 and 1/2): never doubled — all reads ≥ 30 min apart', async () => {
    const w = world();
    const alpha = [w.spawn('alpha', '0/2'), w.spawn('alpha', '0/2')];
    const prod = [w.spawn('prod', '1/2'), w.spawn('prod', '1/2')];
    w.advance(RNP_POLL_INTERVAL_MS);
    for (let step = 0; step < 24 * 60; step++) {
      for (const c of [...alpha, ...prod]) await c.tick();
      w.advance(MIN);
    }
    const reads = listingReads(w.requests);
    expect(new Set(reads.map((r) => r.env))).toEqual(new Set(['alpha', 'prod']));
    expect(minSpacing(reads.map((r) => r.at))).toBeGreaterThanOrEqual(30 * MIN);
    /* 24 h / 35 min ⇒ at most 42 reads in total, shared by both environments */
    expect(reads.length).toBeLessThanOrEqual(42);
  });

  it('the news plane returns only placed items for the asked country; unknowns are a count, not coverage', async () => {
    const w = world();
    const c = w.spawn('alpha', '0/1');
    const discovery = new EvidenceDiscoveryService([], undefined, c);
    expect(discovery.officialBulletins(['RWA'])).toMatchObject({
      state: 'NOT_SEARCHED_NOT_DUE',
      items: [],
    });
    w.set(nextRnpWindow({ index: 0, of: 1 }, w.now() + RNP_POLL_INTERVAL_MS).start);
    await c.tick();
    const rwanda = discovery.officialBulletins(['RWA']);
    expect(rwanda).toMatchObject({
      sourceName: 'Rwanda National Police',
      state: 'SEARCHED_NO_MATCH',
      items: [],
      unknownCountryCount: 6,
    });
    const ssd = discovery.officialBulletins(['SSD']);
    expect(ssd.state).toBe('SEARCHED_MATCH');
    expect(ssd.items).toEqual([
      {
        url: expect.stringMatching(/^https:\/\/police\.gov\.rw\//),
        publishedOn: '2026-10-10',
        eventCountry: 'SSD',
      },
    ]);
    expect(ssd.checkedAt).toBe(new Date(w.now()).toISOString());
    expect(new EvidenceDiscoveryService([], undefined).officialBulletins(['RWA']).state).toBe(
      'NOT_SEARCHED_LANE_OFF',
    );
  });
});
