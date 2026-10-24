import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import {
  candidatesFromLeads,
  discoverLeads,
  NoLiveLeadSource,
  type LeadSource,
} from './gdelt-lead.discovery';
import { parseGdeltLeads } from './gdelt-lead.parser';
import {
  GDELT_LEAD_KEYS,
  GDELT_LEAD_USE_RECORD,
  type GdeltLeadUseRecord,
  type ResourceAdmitter,
} from './gdelt-lead.types';
import { admitResource, checkLeadUrl, evaluateRedirectChain } from './lead-url-guard';

/* Synthetic fixtures only. No network: every source is a jest.fn and no test resolves a name. */

const record = (over: Record<string, unknown> = {}) => ({
  url: 'https://news.example.org/world/kenya-roads-2026',
  url_mobile: 'https://m.news.example.org/world/kenya-roads-2026',
  title: 'PUBLISHER HEADLINE MUST NEVER PASS',
  seendate: '20261024T074500Z',
  socialimage: 'https://img.example.org/a.jpg',
  domain: 'news.example.org',
  language: 'English',
  sourcecountry: 'United Kingdom',
  tone: -2.1,
  ...over,
});

const USE_RECORD: GdeltLeadUseRecord = {
  termsUrl: 'https://www.gdeltproject.org/about.html#termsofuse',
  termsSha256: 'a'.repeat(64),
  termsReadAt: '2026-10-24T06:00:00Z',
  e1VerdictRef: 'SYNTHETIC-TEST-ONLY',
  e1Wording: 'synthetic',
};

const ON = { GDELT_LEAD_DISCOVERY_ENABLED: 'true' };

const spySource = (): LeadSource & { fetchLeads: jest.Mock } => ({
  fetchLeads: jest.fn().mockResolvedValue(parseGdeltLeads({ articles: [record()] })),
});

/** admits exactly one resource: GET https://news.example.org/world/… with robots ALLOWED */
const admitWorld: ResourceAdmitter = ({ host }) =>
  host === 'news.example.org'
    ? {
        admitted: true,
        host,
        pathPrefix: '/world',
        method: 'GET',
        robots: 'ALLOWED',
        e1PerUseRef: 'E1-SYN-1',
      }
    : { admitted: false, reason: 'HOST_NOT_CLEARED' };

describe('GDELT lead-only discovery · fail-closed state machine (spec §3)', () => {
  it('T1 · default env is OFF and the source is never called', async () => {
    const source = spySource();
    const out = await discoverLeads('kenya', { env: {}, useRecord: USE_RECORD, source });
    expect(out).toEqual({ state: 'OFF', leads: [] });
    expect(source.fetchLeads).not.toHaveBeenCalled();
  });

  it.each(['1', 'TRUE', 'on', ' true'])(
    'T1 · only the exact string "true" turns it on (%p stays OFF)',
    async (value) => {
      const source = spySource();
      const out = await discoverLeads('kenya', {
        env: { GDELT_LEAD_DISCOVERY_ENABLED: value },
        useRecord: USE_RECORD,
        source,
      });
      expect(out.state).toBe('OFF');
      expect(source.fetchLeads).not.toHaveBeenCalled();
    },
  );

  it('T2 · flag on without a governed use record is NOT_AUTHORIZED with zero calls', async () => {
    const source = spySource();
    expect(await discoverLeads('kenya', { env: ON, useRecord: null, source })).toEqual({
      state: 'NOT_AUTHORIZED',
      leads: [],
    });
    expect(source.fetchLeads).not.toHaveBeenCalled();
  });

  it.each([
    ['placeholder hash', { termsSha256: '<pinned at activation>' }],
    ['empty E1 wording', { e1Wording: ' ' }],
    ['http terms URL', { termsUrl: 'http://www.gdeltproject.org/' }],
    ['unparseable read time', { termsReadAt: 'today' }],
  ])('T2 · an incomplete record (%s) is NOT_AUTHORIZED', async (_label, over) => {
    const source = spySource();
    const out = await discoverLeads('kenya', {
      env: ON,
      useRecord: { ...USE_RECORD, ...over },
      source,
    });
    expect(out.state).toBe('NOT_AUTHORIZED');
    expect(source.fetchLeads).not.toHaveBeenCalled();
  });

  it('the shipped governed record is E1’s (ADDENDUM-22) over a real hash, never a placeholder', () => {
    const record = GDELT_LEAD_USE_RECORD;
    expect(record).not.toBeNull();
    expect(record!.termsUrl).toBe('https://gdeltproject.org/about.html');
    expect(record!.termsSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set(record!.termsSha256).size).toBeGreaterThan(4); // not 'a'.repeat(64)
    expect(record!.e1VerdictRef).toContain('ADDENDUM-22');
    for (const clause of [
      'a citation to The GDELT Project and a link to its website',
      'never presented as a publication date',
      "must never render, store or model a publisher's title, snippet or image",
      "must never fetch anything from a publisher's host on the strength of this licence",
    ]) {
      expect(record!.e1Wording).toContain(clause);
    }
  });

  it('a filled record alone switches nothing on: without the flag discovery stays OFF', async () => {
    const source = spySource();
    expect(
      (await discoverLeads('kenya', { env: {}, useRecord: GDELT_LEAD_USE_RECORD, source })).state,
    ).toBe('OFF');
    expect(source.fetchLeads).not.toHaveBeenCalled();
  });

  it('the shipped source is NoLiveLeadSource: LIVE_WIRING_ABSENT, and it refuses if ever called', async () => {
    const source = new NoLiveLeadSource();
    expect(await discoverLeads('kenya', { env: ON, useRecord: USE_RECORD, source })).toEqual({
      state: 'LIVE_WIRING_ABSENT',
      leads: [],
    });
    await expect(source.fetchLeads()).rejects.toThrow('LIVE_WIRING_NOT_AUTHORIZED');
  });
});

describe('GDELT lead parser · five fields on the type (E1 C-G4, spec §2)', () => {
  const [lead] = parseGdeltLeads({ articles: [record()] });

  it('T3 · a lead has exactly the six allowed keys; title, image, mobile URL and unknown fields are absent', () => {
    expect(Object.keys(lead).sort()).toEqual([...GDELT_LEAD_KEYS].sort());
    expect(JSON.stringify(lead)).not.toContain('PUBLISHER HEADLINE');
    expect(JSON.stringify(lead)).not.toContain('img.example.org');
    expect(JSON.stringify(lead)).not.toContain('m.news.example.org');
    expect(lead).not.toHaveProperty('tone');
  });

  it('T4 · seendate becomes observedAt; no publishedAt key exists', () => {
    expect(lead.observedAt).toBe('2026-10-24T07:45:00.000Z');
    expect(lead).not.toHaveProperty('publishedAt');
  });

  it.each(['2026-10-24', '20261324T074500Z', '20261032T074500Z', ''])(
    'T4 · an unprovable seendate (%p) drops the record whole',
    (seendate) => {
      expect(parseGdeltLeads({ articles: [record({ seendate })] })).toEqual([]);
    },
  );

  it('attribution travels with every lead (E1 C-G1)', () => {
    expect(lead.attribution).toEqual({
      citation: 'The GDELT Project',
      link: 'https://www.gdeltproject.org/',
    });
  });

  it.each([
    'http://news.example.org/world/a',
    'https://127.0.0.1/world/a',
    'https://user:pw@news.example.org/world/a',
    'javascript:alert(1)',
  ])('an untrusted URL (%p) never becomes a lead', (url) => {
    expect(parseGdeltLeads({ articles: [record({ url })] })).toEqual([]);
  });

  it.each([null, undefined, 'x', 42, { articles: 'no' }, { articles: [null, 7, 'x'] }])(
    'malformed payload %p yields no leads',
    (raw) => {
      expect(parseGdeltLeads(raw)).toEqual([]);
    },
  );
});

describe('GDELT lead · provider country stays verbatim (E1 §2.2)', () => {
  it('T6 · "Kenya" on an unrelated story and "United Kingdom" on a Kenya story are kept as sent; no ISO-3, no relevance', () => {
    const [unrelated, kenyaStory] = parseGdeltLeads({
      articles: [
        record({ url: 'https://news.example.org/world/football', sourcecountry: 'Kenya' }),
        record({
          url: 'https://news.example.org/world/nairobi-floods',
          sourcecountry: 'United Kingdom',
        }),
      ],
    });
    expect(unrelated.providerCountry).toBe('Kenya');
    expect(kenyaStory.providerCountry).toBe('United Kingdom');
    for (const lead of [unrelated, kenyaStory]) {
      expect(JSON.stringify(lead)).not.toMatch(/"(KEN|GBR|iso3|country|countryCode)"/);
    }
  });

  it('T8 · "Congo" and "Democratic Republic of the Congo" are never resolved to COG/COD here', () => {
    const leads = parseGdeltLeads({
      articles: [
        record({ url: 'https://news.example.org/world/a', sourcecountry: 'Congo' }),
        record({
          url: 'https://news.example.org/world/b',
          sourcecountry: 'Democratic Republic of the Congo',
        }),
      ],
    });
    expect(leads.map((l) => l.providerCountry)).toEqual([
      'Congo',
      'Democratic Republic of the Congo',
    ]);
    expect(JSON.stringify(leads)).not.toMatch(/COD|COG/);
  });
});

describe('GDELT lead → candidate · per-resource admission, never host-as-licence (E1 C-G2, CTO R165 §1)', () => {
  const leads = parseGdeltLeads({
    articles: [
      record({ url: 'https://news.example.org/world/a' }),
      record({ url: 'https://uncleared.example.net/world/a', domain: 'uncleared.example.net' }),
    ],
  });

  it('T5 · an uncleared host is dropped HOST_NOT_CLEARED, not queued', () => {
    const out = candidatesFromLeads(leads, admitWorld);
    expect(out.fetchable.map((c) => c.url)).toEqual(['https://news.example.org/world/a']);
    expect(out.dropped).toEqual([
      { url: 'https://uncleared.example.net/world/a', reason: 'HOST_NOT_CLEARED' },
    ]);
  });

  it('a cleared HOST does not license an uncovered PATH ("/world" never covers "/worldwide" or "/opinion")', () => {
    const paths = parseGdeltLeads({
      articles: [
        record({ url: 'https://news.example.org/worldwide/a' }),
        record({ url: 'https://news.example.org/opinion/a' }),
      ],
    });
    const out = candidatesFromLeads(paths, admitWorld);
    expect(out.fetchable).toEqual([]);
    expect(out.dropped.map((d) => d.reason)).toEqual([
      'RESOURCE_NOT_COVERED',
      'RESOURCE_NOT_COVERED',
    ]);
  });

  it.each([
    ['host-wide answer for another host', { host: 'other.example.org' }],
    ['robots not ALLOWED', { robots: 'DISALLOWED' }],
    ['no E1 per-use reference', { e1PerUseRef: '' }],
    ['relative path prefix', { pathPrefix: 'world' }],
  ])('a positive answer that does not cover the request refuses: %s', (_label, over) => {
    const sloppy: ResourceAdmitter = () =>
      ({
        admitted: true,
        host: 'news.example.org',
        pathPrefix: '/world',
        method: 'GET',
        robots: 'ALLOWED',
        e1PerUseRef: 'E1-SYN-1',
        ...over,
      }) as never;
    expect(admitResource(sloppy, 'news.example.org', '/world/a')).toEqual({
      admitted: false,
      reason: 'RESOURCE_NOT_COVERED',
    });
  });

  it('a robots refusal from the admitter stays a drop', () => {
    const out = candidatesFromLeads(leads.slice(0, 1), () => ({
      admitted: false,
      reason: 'ROBOTS_DISALLOWED',
    }));
    expect(out.dropped).toEqual([
      { url: 'https://news.example.org/world/a', reason: 'ROBOTS_DISALLOWED' },
    ]);
  });

  it('T7 · one story syndicated on 3 hosts, 1 cleared: 1 candidate, 2 drops, never "3 sources"', () => {
    const syndicated = parseGdeltLeads({
      articles: ['news.example.org', 'mirror-a.example.com', 'mirror-b.example.com'].map((host) =>
        record({ url: `https://${host}/world/same-story`, domain: host }),
      ),
    });
    const out = candidatesFromLeads([...syndicated, syndicated[0]], admitWorld);
    expect(out.fetchable).toHaveLength(1);
    expect(out.dropped).toHaveLength(2);
    expect(Object.keys(out).sort()).toEqual(['dropped', 'fetchable']);
  });

  it('T10 · mutation binding: flipping the admission flips candidate ↔ dropped', () => {
    const one = leads.slice(0, 1);
    expect(candidatesFromLeads(one, admitWorld).fetchable).toHaveLength(1);
    expect(
      candidatesFromLeads(one, () => ({ admitted: false, reason: 'NO_RECORDED_RIGHT' })).fetchable,
    ).toHaveLength(0);
  });

  it('T10 · mutation binding: flipping the flag flips OFF ↔ NOT_AUTHORIZED', async () => {
    const source = spySource();
    expect((await discoverLeads('q', { env: {}, useRecord: null, source })).state).toBe('OFF');
    expect((await discoverLeads('q', { env: ON, useRecord: null, source })).state).toBe(
      'NOT_AUTHORIZED',
    );
  });
});

describe('GDELT lead URLs are untrusted input · SSRF negatives (CTO R165 §2)', () => {
  it.each([
    ['ftp://news.example.org/x', 'SCHEME_NOT_ADMITTED'],
    ['file:///etc/passwd', 'SCHEME_NOT_ADMITTED'],
    ['gopher://news.example.org/x', 'SCHEME_NOT_ADMITTED'],
    ['https://169.254.169.254/latest/meta-data', 'LITERAL_IPV4_HOST'],
    ['https://2130706433/', 'LITERAL_IPV4_HOST'],
    ['https://0x7f.1/', 'LITERAL_IPV4_HOST'],
    ['https://[::1]/', 'LITERAL_IPV6_HOST'],
    ['https://[::ffff:10.0.0.1]/', 'LITERAL_IPV6_HOST'],
    ['https://localhost/', 'HOST_DENIED_BY_NAME'],
    ['https://backend.railway.internal/', 'HOST_DENIED_BY_NAME'],
    ['https://printer.local/', 'HOST_DENIED_BY_NAME'],
    ['https://intranet/', 'HOST_NOT_QUALIFIED'],
    ['https://news.example.org:8443/world/a', 'PORT_NOT_ADMITTED'],
    ['https://news.example.org@evil.example/world/a', 'USERINFO_PRESENT'],
  ])('%p is refused (%s)', (url, reason) => {
    const verdict = checkLeadUrl(url);
    expect(verdict.admitted).toBe(false);
    expect(verdict.admitted ? '' : verdict.reason).toContain(reason);
  });

  it('canonicalises: lowercase host, trailing dot, default port and fragment removed', () => {
    expect(checkLeadUrl('https://NEWS.Example.org.:443/world/a#frag')).toEqual({
      admitted: true,
      url: 'https://news.example.org/world/a',
      host: 'news.example.org',
      path: '/world/a',
    });
  });

  const hop = (url: string, ...resolvedAddresses: string[]) => ({ url, resolvedAddresses });

  it('a clean single hop to a covered resource on a public address is admitted', () => {
    expect(
      evaluateRedirectChain([hop('https://news.example.org/world/a', '93.184.216.34')], admitWorld),
    ).toEqual({
      admitted: true,
      finalUrl: 'https://news.example.org/world/a',
      e1PerUseRef: 'E1-SYN-1',
    });
  });

  it.each([
    [
      'DNS rebinding: same host later resolves to loopback',
      [
        hop('https://news.example.org/world/a', '93.184.216.34'),
        hop('https://news.example.org/world/b', '127.0.0.1'),
      ],
      1,
    ],
    [
      'one private address among public ones',
      [hop('https://news.example.org/world/a', '93.184.216.34', '10.0.0.5')],
      0,
    ],
    [
      'redirect to cloud metadata by name resolution',
      [
        hop('https://news.example.org/world/a', '93.184.216.34'),
        hop('https://news.example.org/world/c', '169.254.169.254'),
      ],
      1,
    ],
    [
      'redirect to an IPv4-mapped IPv6 private address',
      [
        hop('https://news.example.org/world/a', '93.184.216.34'),
        hop('https://news.example.org/world/d', '::ffff:192.168.1.1'),
      ],
      1,
    ],
    [
      'redirect to an uncleared host',
      [
        hop('https://news.example.org/world/a', '93.184.216.34'),
        hop('https://uncleared.example.net/world/a', '93.184.216.35'),
      ],
      1,
    ],
    [
      'redirect to an uncovered path on the cleared host',
      [
        hop('https://news.example.org/world/a', '93.184.216.34'),
        hop('https://news.example.org/login', '93.184.216.34'),
      ],
      1,
    ],
    [
      'redirect downgrade to http',
      [
        hop('https://news.example.org/world/a', '93.184.216.34'),
        hop('http://news.example.org/world/a', '93.184.216.34'),
      ],
      1,
    ],
    ['a name that resolves to nothing', [hop('https://news.example.org/world/a')], 0],
  ])('the redirect chain is refused: %s', (_label, hops, failingHop) => {
    const verdict = evaluateRedirectChain(hops, admitWorld);
    expect(verdict.admitted).toBe(false);
    expect(verdict.admitted ? -1 : verdict.hop).toBe(failingHop);
  });

  it('more than three redirects is refused', () => {
    const hops = Array.from({ length: 5 }, (_, i) =>
      hop(`https://news.example.org/world/${i}`, '93.184.216.34'),
    );
    expect(evaluateRedirectChain(hops, admitWorld)).toMatchObject({
      admitted: false,
      reason: 'HOP_LIMIT_EXCEEDED',
    });
  });
});

describe('GDELT lead · counting and isolation (spec §5, T9, T11)', () => {
  it('T9 · the discovery result has no count-shaped field', async () => {
    const out = await discoverLeads('kenya', {
      env: {},
      useRecord: null,
      source: new NoLiveLeadSource(),
    });
    expect(Object.keys(out).sort()).toEqual(['leads', 'state']);
  });

  /* CTO R168 — the ONE permitted importer is the coverage-leads feature folder (its own spec proves
     that only app.module imports IT); no answer/telemetry builder, other module or the frontend. */
  it('T11 · nothing outside this folder imports it except coverage-leads: no builder, other backend file or the frontend', () => {
    const repo = resolve(__dirname, '../../../../../..');
    const own = resolve(__dirname);
    const permitted = resolve(__dirname, '../coverage-leads');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === 'generated' || name.startsWith('.')) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (path !== own && path !== permitted) walk(path);
        } else if (
          /\.(ts|tsx|js|mjs|cjs)$/.test(name) &&
          /gdelt-lead/.test(readFileSync(path, 'utf8'))
        ) {
          offenders.push(path);
        }
      }
    };
    for (const root of ['backend/src', 'frontend/src', 'shared/src']) walk(join(repo, root));
    expect(offenders).toEqual([]);
  });

  it('T11 · the folder never logs, imports a model client, Prisma, HTTP or Nest', () => {
    const own = resolve(__dirname);
    for (const name of readdirSync(own).filter(
      (n) => n.endsWith('.ts') && !n.endsWith('.spec.ts'),
    )) {
      const source = readFileSync(join(own, name), 'utf8');
      expect(source).not.toMatch(
        /console\.|Logger|@nestjs|prisma|openai|anthropic|fetch\(|https?\.request|from 'axios'|from 'dns'|from 'net'/i,
      );
    }
  });
});
