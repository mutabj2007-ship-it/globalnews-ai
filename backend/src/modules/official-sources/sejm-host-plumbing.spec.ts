import { OfficialDataTransportFailure, SNAPSHOT_WIRE_BYTE_CAP, evaluateSourceRights } from '@globalnews-ai/shared';
import {
  SAFE_FETCH_DENIED_HOST_SUFFIXES,
  type AddressBoundConnector,
  type AddressBoundRequest,
  type AddressResolver,
  type SafeFetchPolicy,
} from '../official-data/official-artifact-safe-fetch';
import {
  PATH_FAMILY_NOT_ADMITTED,
  PERSON_SURFACE_SEGMENTS,
  PathFamilyConfigurationRefused,
  assertPathIsAdmitted,
  definePathFamilies,
  type PathFamily,
} from '../official-data/official-path-allowlist';
import { makeSafeWireFetch, SafeWireFetchConfigurationRefused } from '../official-data/safe-wire-fetch.node';
import { officialSourceHostResolver } from '../official-data/official-data.boot';
import { OFFICIAL_SOURCES, getEnabledOfficialSources, getOfficialSourceById } from './official-source-registry';
import { OFFICIAL_SOURCE_PATH_POLICIES, credentialFreeHosts, officialSourcePathFamilyResolver } from './official-source-path-policies';

/*
  CTO POLITICS RULING 13 — SEJM SECURITY PLUMBING (E1 SEJM-RIGHTS-AND-HOST-ADMISSION-R1 §B4–§B6).
  Inert host registration + closed path-family allowlist + no credential. Every case runs against
  STUB resolver/connector; no network exists in this spec and none is attempted.
*/
const SEJM = 'api.sejm.gov.pl';
const PUBLIC_IP = '93.184.216.34';
const POLICY: SafeFetchPolicy = Object.freeze({
  wireByteCap: SNAPSHOT_WIRE_BYTE_CAP,
  maxRedirectHops: 3,
  totalDeadlineMs: 60_000,
  perHopDeadlineMs: 30_000,
  admittedScheme: 'https:' as const,
  deniedHostSuffixes: SAFE_FETCH_DENIED_HOST_SUFFIXES,
  ownOrigins: ['api.globalnews.ai'],
});

/** Test-only family: proves the gate admits when configured. NEVER shipped in the policy table. */
const SYNTHETIC_PRINTS: readonly PathFamily[] = definePathFamilies([
  { id: 'test-only-prints', segments: [{ literal: 'sejm' }, { placeholder: 'TERM' }, { literal: 'prints' }], admittedQueryKeys: ['limit'] },
]);

function harness(opts: { families?: readonly PathFamily[] | 'DEFAULT'; responses?: { status: number; location?: string }[] } = {}) {
  const calls: AddressBoundRequest[] = [];
  const resolutions: string[] = [];
  let i = 0;
  const resolver: AddressResolver = async h => { resolutions.push(h); return [PUBLIC_IP]; };
  const connector: AddressBoundConnector = async req => {
    calls.push(req);
    const r = (opts.responses ?? [{ status: 200 }])[Math.min(i++, (opts.responses ?? [{ status: 200 }]).length - 1)]!;
    const headers: Record<string, string> = r.location ? { location: r.location } : { 'content-type': 'application/json' };
    return { status: r.status, headers, bytes: new Uint8Array([1]), capHit: false };
  };
  const families = opts.families ?? 'DEFAULT';
  const fetch = makeSafeWireFetch({
    resolver, connector, policy: POLICY,
    resolveHost: officialSourceHostResolver(),
    ...(families === 'DEFAULT' ? {} : { resolvePathFamilies: (p: string) => (p === 'pl-sejm' ? families : undefined) }),
  });
  return { fetch, calls, resolutions };
}
const req = (path: string) => ({ providerId: 'pl-sejm', endpointId: 'test', url: `https://${SEJM}${path}`, accept: 'application/json', query: {} });
async function outcome(p: Promise<unknown>): Promise<string> {
  try { await p; return 'FETCHED'; } catch (e) {
    if (e instanceof OfficialDataTransportFailure) return `${e.kind} ${e.message}`;
    return `UNEXPECTED ${(e as Error).message}`;
  }
}
const signal = () => new AbortController().signal;

describe('A · the pl-sejm registry entry is inert', () => {
  const entry = getOfficialSourceById('pl-sejm')!;

  it('is registered disabled, rights-null, credential-free, for the exact host', () => {
    expect(entry).toBeDefined();
    expect(entry.enabled).toBe(false);
    expect(entry.rights).toBeNull();
    expect(new URL(entry.baseUrl).hostname).toBe(SEJM);
    expect(JSON.stringify(entry)).not.toMatch(/token|apikey|api_key|authorization|password|secret/i);
    expect(getEnabledOfficialSources().map(s => s.id)).not.toContain('pl-sejm');
  });

  it('the rights evaluator refuses activation from presence alone — and even if someone sets enabled', () => {
    for (const enabled of [false, true]) {
      const v = evaluateSourceRights({ sourceId: entry.id, registered: true, binding: entry.rights, resolvedRecord: null, enabled, ingestionMethod: entry.ingestionMethod });
      expect(v.activatedWithRights).toBe(false);
      expect(v.refusals).toEqual(expect.arrayContaining(['RIGHTS-NO-BINDING', 'RIGHTS-RECORD-UNRESOLVED']));
    }
  });

  it('the path policy names the same host as the registry, ships ZERO families, and is credential-free', () => {
    const policy = OFFICIAL_SOURCE_PATH_POLICIES.find(p => p.providerId === 'pl-sejm')!;
    expect(policy.host).toBe(new URL(entry.baseUrl).hostname);
    expect(policy.families).toEqual([]);
    expect(policy.credential).toBe('NONE');
    expect(credentialFreeHosts()).toContain(SEJM);
    // Every path-gated provider is a registered provider (no orphan policy).
    for (const p of OFFICIAL_SOURCE_PATH_POLICIES) expect(OFFICIAL_SOURCES.map(s => s.id)).toContain(p.providerId);
  });

  it('loading the registry, the path policy and building the safe fetch makes ZERO network calls', () => {
    const http = jest.spyOn(require('node:http'), 'request');
    const https = jest.spyOn(require('node:https'), 'request');
    const dns = require('node:dns');
    const lookup = jest.spyOn(dns, 'lookup');
    const resolve4 = jest.spyOn(dns.promises, 'resolve4');
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('network forbidden'); });
    try {
      jest.isolateModules(() => {
        require('./official-source-registry');
        require('./official-source-path-policies');
        const { makeSafeWireFetch: make } = require('../official-data/safe-wire-fetch.node');
        const { officialSourceHostResolver: hosts } = require('../official-data/official-data.boot');
        make({ resolver: async () => [], connector: async () => { throw new Error('no'); }, policy: POLICY, resolveHost: hosts() });
      });
      for (const spy of [http, https, lookup, resolve4, fetchSpy]) expect(spy).not.toHaveBeenCalled();
    } finally { jest.restoreAllMocks(); }
  });
});

describe('B · default deny: the shipped (empty) allowlist refuses every Sejm path, before DNS', () => {
  it.each([
    '/sejm/term10/processes',
    '/sejm/term10/prints',
    '/sejm/term10/prints/1',
    '/sejm/',
    '/sejm/term10',
    '/',
    '/anything/at/all',
  ])('%s is refused with PATH_FAMILY_NOT_ADMITTED, never resolved, never connected', async path => {
    const { fetch, calls, resolutions } = harness(); // DEFAULT resolver = the registry table
    const out = await outcome(fetch(req(path), signal()));
    expect(out).toMatch(new RegExp(`ADDRESS_REFUSED .*${PATH_FAMILY_NOT_ADMITTED}`));
    expect(resolutions).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('a caller cannot open the host by omitting the path resolver (the default IS the table)', async () => {
    const { fetch, calls } = harness();
    expect(await outcome(fetch(req('/sejm/term10/prints'), signal()))).toMatch(/NO_FAMILY_ADMITTED/);
    expect(calls).toHaveLength(0);
    expect(officialSourcePathFamilyResolver()('pl-sejm')).toEqual([]);
    // Non-gated providers keep host-only behaviour (this table only narrows).
    expect(officialSourcePathFamilyResolver()('rw-nisr')).toBeUndefined();
  });

  it('host refusal and path refusal are distinguishable', async () => {
    const { fetch } = harness();
    const other = await outcome(fetch({ ...req('/x'), url: 'https://www.sejm.gov.pl/sejm/term10/prints' }, signal()));
    expect(other).toMatch(/HOST_NOT_THE_GOVERNED_HOST/);
    expect(other).not.toMatch(PATH_FAMILY_NOT_ADMITTED);
  });
});

describe('B · when a family IS configured (test-only), admission is exact and still closed', () => {
  it('admits exactly the family, nothing deeper, nothing beside it', async () => {
    const { fetch, calls } = harness({ families: SYNTHETIC_PRINTS });
    expect(await outcome(fetch(req('/sejm/term10/prints'), signal()))).toBe('FETCHED');
    expect(calls).toHaveLength(1);
    for (const path of ['/sejm/term10/prints/123', '/sejm/term10/processes', '/sejm/term10/MP', '/sejm/termX/prints', '/sejm/term10/Prints']) {
      const h = harness({ families: SYNTHETIC_PRINTS });
      expect(await outcome(h.fetch(req(path), signal()))).toMatch(PATH_FAMILY_NOT_ADMITTED);
      expect(h.calls).toHaveLength(0);
    }
  });

  it('closed query keys: an unlisted key is refused; an admitted one passes', async () => {
    expect(await outcome(harness({ families: SYNTHETIC_PRINTS }).fetch(req('/sejm/term10/prints?limit=5'), signal()))).toBe('FETCHED');
    expect(await outcome(harness({ families: SYNTHETIC_PRINTS }).fetch(req('/sejm/term10/prints?fields=all'), signal()))).toMatch(/QUERY_KEY_NOT_ADMITTED/);
  });

  it.each(['/sejm/term10/../term10/prints', '/sejm/term10/./prints', '/sejm/term10%2Fprints', '/sejm//term10/prints', '/sejm/term10/prints/', '/sejm/term10/%2e%2e/prints'])(
    'path trick %s is refused', path => {
      expect(assertPathIsAdmitted(`https://${SEJM}${path}`, SYNTHETIC_PRINTS).admitted).toBe(false);
    });
});

describe('B · every redirect hop is re-validated (host AND path)', () => {
  it('a redirect from an admitted path to a person surface is refused before the second request', async () => {
    const { fetch, calls } = harness({ families: SYNTHETIC_PRINTS, responses: [{ status: 302, location: '/sejm/term10/MP' }, { status: 200 }] });
    expect(await outcome(fetch(req('/sejm/term10/prints'), signal()))).toMatch(PATH_FAMILY_NOT_ADMITTED);
    expect(calls).toHaveLength(1);
  });

  it('a redirect off the governed host is refused', async () => {
    const { fetch, calls } = harness({ families: SYNTHETIC_PRINTS, responses: [{ status: 301, location: 'https://evil.example/sejm/term10/prints' }] });
    expect(await outcome(fetch(req('/sejm/term10/prints'), signal()))).toMatch(/REDIRECT_REFUSED .*HOST_NOT_THE_GOVERNED_HOST/);
    expect(calls).toHaveLength(1);
  });

  it('a redirect to another admitted path is followed (the gate is not a blanket block)', async () => {
    const { fetch, calls } = harness({ families: SYNTHETIC_PRINTS, responses: [{ status: 301, location: '/sejm/term9/prints' }, { status: 200 }] });
    expect(await outcome(fetch(req('/sejm/term10/prints'), signal()))).toBe('FETCHED');
    expect(calls.map(c => c.path)).toEqual(['/sejm/term10/prints', '/sejm/term9/prints']);
  });
});

describe('B · person / photo / individual-vote surfaces are structurally inadmissible', () => {
  it.each(['MP', 'photo', 'votings', 'interpellations', 'writtenQuestions', 'statements', 'transcripts', 'videos'])(
    'a family naming %s is refused at configuration', seg => {
      expect(() => definePathFamilies([{ id: 'bad', segments: [{ literal: 'sejm' }, { placeholder: 'TERM' }, { literal: seg }], admittedQueryKeys: [] }]))
        .toThrow(PathFamilyConfigurationRefused);
    });

  it('a BROAD family (/sejm/{term}) cannot admit anything beneath it — there is no prefix match', () => {
    const broad = definePathFamilies([{ id: 'broad', segments: [{ literal: 'sejm' }, { placeholder: 'TERM' }], admittedQueryKeys: [] }]);
    expect(assertPathIsAdmitted(`https://${SEJM}/sejm/term10`, broad).admitted).toBe(true);
    for (const p of ['/sejm/term10/MP', '/sejm/term10/MP/1/photo', '/sejm/term10/votings/1/2', '/sejm/term10/interpellations', '/sejm/term10/writtenQuestions', '/sejm/term10/transcripts']) {
      expect(assertPathIsAdmitted(`https://${SEJM}${p}`, broad).admitted).toBe(false);
    }
  });

  it('a placeholder cannot stand in for a person surface (typed, never free text)', () => {
    const fam = definePathFamilies([{ id: 'ids', segments: [{ literal: 'sejm' }, { placeholder: 'TERM' }, { placeholder: 'NUMERIC_ID' }], admittedQueryKeys: [] }]);
    expect(assertPathIsAdmitted(`https://${SEJM}/sejm/term10/12`, fam).admitted).toBe(true);
    expect(assertPathIsAdmitted(`https://${SEJM}/sejm/term10/MP`, fam).admitted).toBe(false);
  });

  it('MUTATION GUARD — the person list itself covers every surface named by E1 C-2', () => {
    for (const s of ['mp', 'photo', 'votings', 'interpellations', 'writtenquestions', 'statements', 'transcripts']) {
      expect(PERSON_SURFACE_SEGMENTS).toContain(s);
    }
  });
});

describe('SEJM-CRED-1 · no credential travels to the Sejm host', () => {
  it('binding any credential to the Sejm origin is refused at construction', () => {
    expect(() => makeSafeWireFetch({
      resolver: async () => [PUBLIC_IP], connector: async () => { throw new Error('no'); }, policy: POLICY,
      resolveHost: officialSourceHostResolver(),
      credential: { providerId: 'pl-sejm', origin: `https://${SEJM}:443`, headerName: 'Authorization', headerValue: 'x' },
    })).toThrow(SafeWireFetchConfigurationRefused);
  });

  it('an admitted request carries no credential header and no credential in the URL', async () => {
    const { fetch, calls } = harness({ families: SYNTHETIC_PRINTS });
    await fetch(req('/sejm/term10/prints'), signal());
    const headerNames = Object.keys(calls[0]!.headers).map(h => h.toLowerCase());
    for (const h of ['authorization', 'cookie', 'x-api-key', 'proxy-authorization']) expect(headerNames).not.toContain(h);
    expect(calls[0]!.path).not.toMatch(/token|key=|auth/i);
  });

  it.each(['token', 'api_key', 'apikey', 'access_token', 'key', 'signature'])('a credential-shaped query key (%s) is refused even on an admitted path', async k => {
    const { fetch, calls } = harness({ families: SYNTHETIC_PRINTS });
    expect(await outcome(fetch(req(`/sejm/term10/prints?${k}=x`), signal()))).toMatch(/CREDENTIAL_IN_QUERY/);
    expect(calls).toHaveLength(0);
  });

  it('a family cannot admit a credential-shaped query key', () => {
    expect(() => definePathFamilies([{ id: 'q', segments: [{ literal: 'sejm' }], admittedQueryKeys: ['token'] }])).toThrow(PathFamilyConfigurationRefused);
  });
});
