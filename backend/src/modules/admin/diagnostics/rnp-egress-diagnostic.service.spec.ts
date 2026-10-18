import { NotFoundException } from '@nestjs/common';
import {
  OfficialDataTransportFailure,
  type OfficialDataTransportRequest,
} from '@globalnews-ai/shared';
import type { ConfigService } from '@nestjs/config';
import type { WireResponse } from '../../official-data/official-data-transport.node';
import { RNP_ROBOTS_URL } from '../../official-bulletin/rnp-listing.reader';
import {
  RNP_EGRESS_DIAGNOSTIC_COOLDOWN_MS,
  RnpEgressDiagnosticService,
} from './rnp-egress-diagnostic.service';

/* CTO R157 decision D — opt-in, fixed target, transport facts only (no body), one probe per 10 minutes. */
const config = (enabled: boolean) =>
  ({
    get: (k: string) =>
      k === 'RNP_EGRESS_DIAGNOSTIC_ENABLED' ? (enabled ? 'true' : undefined) : undefined,
  }) as unknown as ConfigService;

function rig(enabled: boolean, reply: () => WireResponse) {
  const calls: OfficialDataTransportRequest[] = [];
  const service = new RnpEgressDiagnosticService(config(enabled), async (request) => {
    calls.push(request);
    return reply();
  });
  let t = Date.parse('2026-10-18T09:00:00Z');
  service.now = () => t;
  return { service, calls, advance: (ms: number) => (t += ms) };
}
const ok = (): WireResponse => ({
  status: 200,
  finalUrl: RNP_ROBOTS_URL,
  headers: { 'content-length': '0', 'set-cookie': 'cookiesession1=x' },
  wireBytes: new TextEncoder().encode('ZZ-SENTINEL-BODY'),
  redirectChain: [],
});

describe('RNP egress diagnostic', () => {
  it('does not exist unless explicitly enabled (404), and makes no request', async () => {
    const r = rig(false, ok);
    await expect(r.service.probe()).rejects.toBeInstanceOf(NotFoundException);
    expect(r.calls).toEqual([]);
  });

  it('probes ONLY robots.txt on police.gov.rw and reports transport facts, never the body', async () => {
    const r = rig(true, ok);
    const probe = await r.service.probe();
    expect(r.calls.map((c) => [c.providerId, c.url])).toEqual([['rnp', RNP_ROBOTS_URL]]);
    expect(probe).toMatchObject({
      outcome: 'REACHED',
      httpStatus: 200,
      declaredContentLength: '0',
      bodyByteCount: 16,
      redirectCount: 0,
      failureKind: null,
    });
    expect(JSON.stringify(probe)).not.toMatch(/ZZ-SENTINEL|cookiesession/);
  });

  it('at most one probe per 10 minutes', async () => {
    const r = rig(true, ok);
    await r.service.probe();
    expect((await r.service.probe()).outcome).toBe('COOLDOWN');
    r.advance(RNP_EGRESS_DIAGNOSTIC_COOLDOWN_MS);
    expect((await r.service.probe()).outcome).toBe('REACHED');
    expect(r.calls).toHaveLength(2);
  });

  it('a transport refusal is reported by kind (e.g. DNS, timeout), not thrown', async () => {
    const r = rig(true, () => {
      throw new OfficialDataTransportFailure('DNS_FAILURE', 'rnp', 'x');
    });
    expect(await r.service.probe()).toMatchObject({
      outcome: 'TRANSPORT_FAILURE',
      failureKind: 'DNS_FAILURE',
      httpStatus: null,
    });
  });
});
