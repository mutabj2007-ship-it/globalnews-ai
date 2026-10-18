import { OfficialDataTransportFailure } from '@globalnews-ai/shared';
import type { OfficialDataTransportRequest } from '@globalnews-ai/shared';
import type { WireResponse } from '../official-data/official-data-transport.node';
import { RNP_LISTING_URL, RNP_POLL_INTERVAL_MS, RNP_ROBOTS_RECHECK_MS, RNP_ROBOTS_URL, RnpListingReader } from './rnp-listing.reader';

/* E1 ADDENDUM-02 §3 / ADDENDUM-04 — the read discipline, against a fake wire (no network). */
const LISTING = `<html><head><base href="https://police.gov.rw/"></head><body><div class="news-default">
  <div class="single-news"><a href="media/news-detail/news/a-slug/?cHash=1"></a><time datetime="2026-10-17">x</time>
  <h3 class="news-title"><a href="media/news-detail/news/a-slug/?cHash=1">ZZ-SENTINEL in South Sudan</a></h3></div></div></body></html>`;
const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const response = (status: number, body = ''): WireResponse => ({
  status,
  finalUrl: '',
  headers: status === 200 ? { 'set-cookie': 'cookiesession1=abc' } : {},
  wireBytes: bytes(body),
  redirectChain: [],
});

function harness(script: Record<string, (() => WireResponse)[]>) {
  const calls: OfficialDataTransportRequest[] = [];
  let t = Date.parse('2026-10-18T08:00:00Z');
  const wire = jest.fn(async (request: OfficialDataTransportRequest) => {
    calls.push(request);
    const next = script[request.url]?.shift();
    if (next === undefined) throw new Error(`unexpected ${request.url}`);
    return next();
  });
  const reader = new RnpListingReader(wire, () => t);
  return { reader, calls, advance: (ms: number) => (t += ms) };
}
const robotsEmpty = () => response(200, '');
const listing = () => response(200, LISTING);

describe('RNP listing reader', () => {
  it('reads robots.txt first, then the listing once; permitted fields only; the title never escapes', async () => {
    const h = harness({ [RNP_ROBOTS_URL]: [robotsEmpty], [RNP_LISTING_URL]: [listing] });
    const read = await h.reader.read();
    expect(h.calls.map((c) => c.url)).toEqual([RNP_ROBOTS_URL, RNP_LISTING_URL]);
    expect(h.calls.every((c) => c.providerId === 'rnp' && Object.keys(c.query).length === 0)).toBe(true);
    expect(read.state).toBe('SEARCHED');
    expect(read.items.map((i) => [i.slug, i.publishedOn, i.geography.iso3])).toEqual([['a-slug', '2026-10-17', 'SSD']]);
    expect(JSON.stringify(read)).not.toMatch(/ZZ-SENTINEL|cookiesession/);
  });

  it('at most one poll per 30 minutes; concurrent readers share one read', async () => {
    const h = harness({ [RNP_ROBOTS_URL]: [robotsEmpty], [RNP_LISTING_URL]: [listing, listing] });
    await Promise.all([h.reader.read(), h.reader.read(), h.reader.read()]);
    h.advance(RNP_POLL_INTERVAL_MS - 1);
    await h.reader.read();
    expect(h.calls.filter((c) => c.url === RNP_LISTING_URL)).toHaveLength(1);
    h.advance(1);
    await h.reader.read();
    expect(h.calls.filter((c) => c.url === RNP_LISTING_URL)).toHaveLength(2);
    expect(h.calls.filter((c) => c.url === RNP_ROBOTS_URL)).toHaveLength(1);
  });

  it('a failure is cached too — no retry inside the 30 minutes', async () => {
    const h = harness({ [RNP_ROBOTS_URL]: [robotsEmpty], [RNP_LISTING_URL]: [() => response(503)] });
    expect((await h.reader.read()).reason).toBe('LISTING_HTTP_503');
    expect((await h.reader.read()).state).toBe('UPSTREAM_FAILED');
    expect(h.calls.filter((c) => c.url === RNP_LISTING_URL)).toHaveLength(1);
  });

  it.each([429, 404, 410, 403])('HTTP %i opens the circuit: no further request for the life of the process', async (status) => {
    const h = harness({ [RNP_ROBOTS_URL]: [robotsEmpty], [RNP_LISTING_URL]: [() => response(status)] });
    expect(await h.reader.read()).toMatchObject({ state: 'UPSTREAM_FAILED', reason: `LISTING_HTTP_${status}` });
    h.advance(RNP_POLL_INTERVAL_MS * 10);
    expect(await h.reader.read()).toMatchObject({ state: 'UPSTREAM_FAILED', reason: `LISTING_HTTP_${status}` });
    expect(h.calls).toHaveLength(2);
  });

  it('robots.txt with directives, or unreadable, stops the lane before any listing read (RIGHTS_NOT_ADMITTED)', async () => {
    const changed = harness({ [RNP_ROBOTS_URL]: [() => response(200, 'User-agent: *\nDisallow: /')] });
    expect((await changed.reader.read()).state).toBe('RIGHTS_NOT_ADMITTED');
    const unreadable = harness({ [RNP_ROBOTS_URL]: [() => response(403)] });
    expect(await unreadable.reader.read()).toMatchObject({ state: 'RIGHTS_NOT_ADMITTED', reason: 'ROBOTS_HTTP_403' });
    for (const h of [changed, unreadable]) expect(h.calls.map((c) => c.url)).toEqual([RNP_ROBOTS_URL]);
  });

  it('robots.txt is re-read every 30 days', async () => {
    const h = harness({ [RNP_ROBOTS_URL]: [robotsEmpty, robotsEmpty], [RNP_LISTING_URL]: [listing, listing] });
    await h.reader.read();
    h.advance(RNP_ROBOTS_RECHECK_MS);
    await h.reader.read();
    expect(h.calls.map((c) => c.url)).toEqual([RNP_ROBOTS_URL, RNP_LISTING_URL, RNP_ROBOTS_URL, RNP_LISTING_URL]);
  });

  it('a transport refusal is UPSTREAM_FAILED; an off-host redirect opens the circuit', async () => {
    const fail = (kind: 'TIMEOUT' | 'REDIRECT_REFUSED') => () => {
      throw new OfficialDataTransportFailure(kind, 'rnp', 'x');
    };
    const slow = harness({ [RNP_ROBOTS_URL]: [robotsEmpty], [RNP_LISTING_URL]: [fail('TIMEOUT')] });
    expect(await slow.reader.read()).toMatchObject({ state: 'UPSTREAM_FAILED', reason: 'LISTING_TIMEOUT' });
    const offHost = harness({ [RNP_ROBOTS_URL]: [robotsEmpty], [RNP_LISTING_URL]: [fail('REDIRECT_REFUSED')] });
    await offHost.reader.read();
    offHost.advance(RNP_POLL_INTERVAL_MS * 2);
    expect(await offHost.reader.read()).toMatchObject({ reason: 'LISTING_REDIRECT_REFUSED' });
    expect(offHost.calls).toHaveLength(2);
  });

  it('a page without the listing markup is UPSTREAM_FAILED, never an empty "no news" result', async () => {
    const h = harness({ [RNP_ROBOTS_URL]: [robotsEmpty], [RNP_LISTING_URL]: [() => response(200, '<html>maintenance</html>')] });
    expect(await h.reader.read()).toMatchObject({ state: 'UPSTREAM_FAILED', reason: 'LISTING_UNPARSEABLE', items: [] });
  });
});
