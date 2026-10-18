import { OfficialDataTransportFailure, type OfficialDataTransportRequest } from '@globalnews-ai/shared';
import type { AddressBoundRequest } from '../official-data/official-artifact-safe-fetch';
import { makeRnpWireFetch, RNP_ALLOWED_HOSTS, RNP_WIRE_BYTE_CAP } from './rnp-network';

/*
  E1 ADDENDUM-06 §1 — the allowlist BINDS (C-3): a positive control proves police.gov.rw is reached, and every other
  host, form or hop is REFUSED (an OfficialDataTransportFailure), never a timeout or a swallowed error. No network:
  the resolver and connector are fakes that record what they were asked.
*/
const PUBLIC_ADDRESS = '196.12.150.10';

function rig(responses: { status: number; headers?: Record<string, string> }[] = [{ status: 200 }]) {
  const resolved: string[] = [];
  const connected: AddressBoundRequest[] = [];
  const wire = makeRnpWireFetch({
    resolver: async (hostname) => {
      resolved.push(hostname);
      return [PUBLIC_ADDRESS];
    },
    connector: async (request) => {
      connected.push(request);
      const next = responses.shift() ?? { status: 200 };
      return { status: next.status, headers: next.headers ?? {}, bytes: new Uint8Array(), capHit: false };
    },
    ownOrigins: ['https://globalnews-ai.example'],
    userAgent: 'GlobalNewsAI-OfficialBulletin/1.0 (+https://github.com/mutabj2007-ship-it/globalnews-ai)',
  });
  const go = (url: string, providerId = 'rnp') =>
    wire({ providerId, endpointId: 'listing', url, accept: 'text/html', query: {} } as OfficialDataTransportRequest, AbortSignal.timeout(5_000));
  return { go, resolved, connected };
}

describe('Ask network exception — exactly one host (E1 ADDENDUM-06 §1)', () => {
  it('the allowlist is a frozen code constant naming police.gov.rw only', () => {
    expect(RNP_ALLOWED_HOSTS).toEqual(['police.gov.rw']);
    expect(Object.isFrozen(RNP_ALLOWED_HOSTS)).toBe(true);
  });

  it('positive control: police.gov.rw over https is reached, cookie-less, with the identified UA and the 1 MB cap', async () => {
    const r = rig();
    await expect(r.go('https://police.gov.rw/media/news/')).resolves.toMatchObject({ status: 200 });
    expect(r.resolved).toEqual(['police.gov.rw']);
    expect(r.connected[0]).toMatchObject({ tlsServerName: 'police.gov.rw', path: '/media/news/', byteCap: RNP_WIRE_BYTE_CAP });
    expect(Object.keys(r.connected[0].headers).map((k) => k.toLowerCase()).sort()).toEqual(['accept', 'user-agent']);
  });

  it.each([
    ['another host', 'https://example.org/media/news/'],
    ['a look-alike subdomain', 'https://police.gov.rw.evil.example/'],
    ['the www variant (exact host only)', 'https://www.police.gov.rw/media/news/'],
    ['userinfo hiding the real host', 'https://police.gov.rw@evil.example/'],
    ['userinfo on the real host', 'https://user:pw@police.gov.rw/'],
    ['plain http', 'http://police.gov.rw/media/news/'],
    ['a raw IP literal', `https://${PUBLIC_ADDRESS}/media/news/`],
  ])('%s is REFUSED before any resolution or connection', async (_label, url) => {
    const r = rig();
    await expect(r.go(url)).rejects.toBeInstanceOf(OfficialDataTransportFailure);
    expect(r.resolved).toEqual([]);
    expect(r.connected).toEqual([]);
  });

  it('any provider id other than rnp has no governed host and is refused before the network', async () => {
    const r = rig();
    await expect(r.go('https://police.gov.rw/media/news/', 'gnews')).rejects.toBeInstanceOf(OfficialDataTransportFailure);
    expect(r.connected).toEqual([]);
  });

  it('a redirect off police.gov.rw is a hard refusal, not a follow (every hop is gated)', async () => {
    const r = rig([{ status: 302, headers: { location: 'https://evil.example/landing' } }]);
    await expect(r.go('https://police.gov.rw/media/news/')).rejects.toBeInstanceOf(OfficialDataTransportFailure);
    expect(r.connected).toHaveLength(1);
    expect(r.resolved).toEqual(['police.gov.rw']);
  });
});
