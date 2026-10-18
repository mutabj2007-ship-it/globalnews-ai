import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OfficialDataTransportFailure } from '@globalnews-ai/shared';
import type { WireFetch } from '../../official-data/official-data-transport.node';
import {
  nodeAddressBoundConnector,
  nodeAddressResolver,
} from '../../official-data/safe-wire-fetch.node';
import { makeRnpWireFetch, RNP_USER_AGENT } from '../../official-bulletin/rnp-network';
import { RNP_PROVIDER_ID, RNP_ROBOTS_URL } from '../../official-bulletin/rnp-listing.reader';

/*
  CTO R157 decision D — the ONE measurement that source cannot give: does the ACTUAL backend process on this
  deployment reach police.gov.rw? (egress-declaration.ts: runtimeNetworkProbe is NOT_RUN until measured.)

  · Opt-in: `RNP_EGRESS_DIAGNOSTIC_ENABLED=true`, otherwise the route does not exist (404). Removed/disabled after
    the test. Admin-only (AdminGuard + provider.configure) on the controller.
  · Fixed target: robots.txt on police.gov.rw only — never the news listing (it does not count against the listing's
    30-minute ceiling) and never a caller-supplied host. Through the same one-host network gate the lane uses.
  · Reports transport facts only: status, declared length, byte COUNT, duration, failure kind. Never the body.
  · At most one probe per 10 minutes per process.
*/
export const RNP_EGRESS_DIAGNOSTIC_COOLDOWN_MS = 10 * 60 * 1000;

export interface RnpEgressProbe {
  readonly probedAt: string;
  readonly target: typeof RNP_ROBOTS_URL;
  readonly outcome: 'REACHED' | 'TRANSPORT_FAILURE' | 'COOLDOWN';
  readonly httpStatus: number | null;
  readonly declaredContentLength: string | null;
  readonly bodyByteCount: number | null;
  readonly redirectCount: number | null;
  readonly durationMs: number | null;
  readonly failureKind: string | null;
}

export const RNP_EGRESS_WIRE = Symbol('RNP_EGRESS_WIRE');

@Injectable()
export class RnpEgressDiagnosticService {
  private lastProbeAt: number | null = null;
  /** The clock; replaced only by specs. */
  now: () => number = Date.now;

  constructor(
    private readonly config: ConfigService,
    @Optional() @Inject(RNP_EGRESS_WIRE) private readonly wireOverride?: WireFetch,
  ) {}

  enabled(): boolean {
    return this.config.get<string>('RNP_EGRESS_DIAGNOSTIC_ENABLED') === 'true';
  }

  async probe(): Promise<RnpEgressProbe> {
    if (!this.enabled()) throw new NotFoundException();
    const t = this.now();
    const base = { probedAt: new Date(t).toISOString(), target: RNP_ROBOTS_URL } as const;
    if (this.lastProbeAt !== null && t - this.lastProbeAt < RNP_EGRESS_DIAGNOSTIC_COOLDOWN_MS) {
      return {
        ...base,
        outcome: 'COOLDOWN',
        httpStatus: null,
        declaredContentLength: null,
        bodyByteCount: null,
        redirectCount: null,
        durationMs: null,
        failureKind: null,
      };
    }
    this.lastProbeAt = t;
    const started = this.now();
    try {
      const response = await this.wire()(
        {
          providerId: RNP_PROVIDER_ID,
          endpointId: 'robots',
          url: RNP_ROBOTS_URL,
          accept: 'text/plain',
          query: {},
        },
        AbortSignal.timeout(10_000),
      );
      return {
        ...base,
        outcome: 'REACHED',
        httpStatus: response.status,
        declaredContentLength: response.headers['content-length'] ?? null,
        bodyByteCount: response.wireBytes.byteLength,
        redirectCount: response.redirectChain.length,
        durationMs: this.now() - started,
        failureKind: null,
      };
    } catch (error) {
      return {
        ...base,
        outcome: 'TRANSPORT_FAILURE',
        httpStatus: null,
        declaredContentLength: null,
        bodyByteCount: null,
        redirectCount: null,
        durationMs: this.now() - started,
        failureKind: error instanceof OfficialDataTransportFailure ? error.kind : 'UNCLASSIFIED',
      };
    }
  }

  private wire(): WireFetch {
    if (this.wireOverride !== undefined) return this.wireOverride;
    const ownOrigins = ['FRONTEND_ORIGIN', 'PUBLIC_BACKEND_ORIGIN']
      .map((key) => this.config.get<string>(key))
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '');
    return makeRnpWireFetch({
      resolver: nodeAddressResolver,
      connector: nodeAddressBoundConnector,
      ownOrigins,
      userAgent: RNP_USER_AGENT,
    });
  }
}
