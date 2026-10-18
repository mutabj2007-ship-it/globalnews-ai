import { hostname } from 'node:os';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import type { WireFetch } from '../official-data/official-data-transport.node';
import {
  nodeAddressBoundConnector,
  nodeAddressResolver,
} from '../official-data/safe-wire-fetch.node';
import {
  nextRnpWindow,
  parseRnpCollectorSlot,
  rnpWindowAt,
  type RnpCollectorSlot,
} from './rnp-collection-schedule';
import { RNP_PUBLISHER } from './rnp-listing.parser';
import { RNP_PROVIDER_ID, RnpListingReader, type RnpRead } from './rnp-listing.reader';
import { makeRnpWireFetch, RNP_USER_AGENT } from './rnp-network';
import { RnpPollLease, type RnpLeaseStore } from './rnp-poll-lease';

/*
  CTO R158 §1–§2 — the Rwanda National Police METADATA connector, in the external news-retrieval plane.

  · Off unless `RNP_OFFICIAL_BULLETIN_ENABLED=true` AND `RNP_COLLECTOR_SLOT` is a valid `k/N`. Off makes no request.
  · ONE scheduled collector, never a request-path read: a timer wakes at this environment's own window
    (rnp-collection-schedule.ts), claims the window in the database (rnp-poll-lease.ts), and only the winner reads.
    Ask and every other caller read the last snapshot; no caller can cause a request to police.gov.rw.
  · The snapshot carries ONLY: source name, original link, source-stated date, checked-at time, and the event
    country (ISO3) or null for unknown. It is not a NewsArticle; it has no headline, summary or page text, and nothing
    in it reaches a reader response as prose or an AI prompt.
*/
export const RNP_WIRE = Symbol('RNP_WIRE');
export const RNP_LEASE_STORE = Symbol('RNP_LEASE_STORE');

export interface OfficialBulletinItem {
  readonly url: string;
  /** Source-stated publication date, `YYYY-MM-DD`. */
  readonly publishedOn: string;
  /** ISO3 when the listing places the event in a country (RNP-GEO-R1); null = unknown. Never the publisher's country. */
  readonly eventCountry: string | null;
}

export type OfficialBulletinLaneState = 'OFF' | 'MISCONFIGURED' | 'PENDING' | RnpRead['state'];

export interface OfficialBulletinSnapshot {
  readonly sourceId: typeof RNP_PROVIDER_ID;
  readonly sourceName: typeof RNP_PUBLISHER;
  readonly state: OfficialBulletinLaneState;
  /** A closed code, never upstream text. */
  readonly reason: string | null;
  /** When the listing was actually read. Null until a read succeeds. */
  readonly checkedAt: string | null;
  readonly items: readonly OfficialBulletinItem[];
}

/** Keeps only the permitted fields; the slug and the title hash stay inside the reader. */
export function toOfficialBulletinItems(read: RnpRead): OfficialBulletinItem[] {
  return read.items.map((item) => ({
    url: item.url,
    publishedOn: item.publishedOn,
    eventCountry: item.geography.iso3,
  }));
}

const START_JITTER_MS = 60 * 1000;

@Injectable()
export class OfficialBulletinCollector implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OfficialBulletinCollector.name);
  private readonly slot: RnpCollectorSlot | null;
  private readonly enabled: boolean;
  private reader: RnpListingReader | null = null;
  private lease: RnpPollLease | null = null;
  private timer: NodeJS.Timeout | null = null;
  private snapshot: OfficialBulletinSnapshot;

  /** Clock and jitter; replaced only by specs. */
  now: () => number = Date.now;
  jitter: () => number = () => Math.floor(Math.random() * START_JITTER_MS);

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() @Inject(RNP_WIRE) private readonly wireOverride?: WireFetch,
    @Optional() @Inject(RNP_LEASE_STORE) private readonly leaseOverride?: RnpLeaseStore,
  ) {
    this.enabled = config.get<string>('RNP_OFFICIAL_BULLETIN_ENABLED') === 'true';
    this.slot = parseRnpCollectorSlot(config.get<string>('RNP_COLLECTOR_SLOT'));
    this.snapshot = this.empty(
      !this.enabled ? 'OFF' : this.slot === null ? 'MISCONFIGURED' : 'PENDING',
      !this.enabled
        ? 'LANE_DISABLED'
        : this.slot === null
          ? 'COLLECTOR_SLOT_INVALID'
          : 'FIRST_READ_NOT_DUE',
    );
  }

  onModuleInit(): void {
    if (!this.enabled || this.slot === null) return;
    const store =
      this.leaseOverride ??
      (this.prisma?.marketIngestLease as unknown as RnpLeaseStore | undefined);
    if (store === undefined) {
      this.snapshot = this.empty('MISCONFIGURED', 'LEASE_STORE_UNAVAILABLE');
      return;
    }
    this.lease = new RnpPollLease(
      store,
      `${process.env.RAILWAY_REPLICA_ID ?? hostname()}:${process.pid}`,
    );
    this.reader = new RnpListingReader(this.wire(), () => this.now());
    this.arm();
  }

  onModuleDestroy(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  /** The last collected metadata. Never reads the network. */
  current(): OfficialBulletinSnapshot {
    return this.snapshot;
  }

  /** One collection attempt at `now()`. Public for specs; production calls it from the timer only. */
  async tick(): Promise<void> {
    const slot = this.slot;
    if (this.reader === null || this.lease === null || slot === null) return;
    const window = rnpWindowAt(slot, this.now());
    if (window === null || !this.reader.due()) return;
    if (!(await this.lease.claim(window))) return;
    const read = await this.reader.read();
    if (read.state === 'SEARCHED') {
      this.snapshot = {
        ...this.base(),
        state: 'SEARCHED',
        reason: null,
        checkedAt: read.retrievedAt,
        items: toOfficialBulletinItems(read),
      };
    } else {
      /* A failed read keeps the last good items visible with their own checked-at time; the state says it failed. */
      this.snapshot = { ...this.snapshot, state: read.state, reason: read.reason };
      this.logger.warn(`RNP official bulletin read: ${read.state} ${read.reason ?? ''}`);
    }
  }

  /** Wakes once per own window: the current one only at start-up, otherwise always the NEXT one. */
  private arm(startUp = true): void {
    if (this.slot === null) return;
    const t = this.now();
    const inside = startUp ? rnpWindowAt(this.slot, t) : null;
    const delay = inside !== null ? 0 : nextRnpWindow(this.slot, t + 1).start - t + this.jitter();
    this.timer = setTimeout(() => {
      void this.tick()
        .catch(() => this.logger.warn('RNP official bulletin tick failed'))
        .finally(() => this.arm(false));
    }, delay);
    this.timer.unref?.();
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

  private base() {
    return { sourceId: RNP_PROVIDER_ID, sourceName: RNP_PUBLISHER } as const;
  }

  private empty(state: OfficialBulletinLaneState, reason: string): OfficialBulletinSnapshot {
    return { ...this.base(), state, reason, checkedAt: null, items: [] };
  }
}
