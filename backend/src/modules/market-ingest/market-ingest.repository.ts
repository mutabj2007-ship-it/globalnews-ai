import type { RunOutcome } from './market-acquisition-declarations';
import type {
  IngestTrigger,
  LeaseStore,
  MarketObservationDraft,
  ObservationStore,
  RunStore,
} from './market-ingest.scheduler';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MKT-PLAT-2 — THE PERSISTENCE ADAPTER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Implements the three store seams the scheduler declares, over the three Prisma
 * models. The scheduler knows none of this; it knows `LeaseStore`, `RunStore` and
 * `ObservationStore`, which is what makes its guarantees testable against a fake.
 *
 * ── THE LEASE IS THE INTERESTING ONE ──────────────────────────────────────
 *
 * SI-6.3 requires that a crashed run's lease expires rather than needing manual
 * clearing. That is one query, and the whole property lives in it:
 *
 *     acquire IF no row exists
 *          OR the existing row is released
 *          OR the existing row has expired
 *
 * Expressed as read-then-write, two workers both read "expired" and both write, and
 * the mutual exclusion is gone at exactly the moment it was needed. So it is expressed
 * as a CONDITIONAL WRITE against the unique `runKey`: the database decides, once.
 */

/* ───────────────────────────────────────────────────────────────────────────
 * THE DELEGATE SURFACE — hand-declared, for the reasons the Situation and
 * snapshot ports already record: the generated client is a build artefact, the
 * logic must be testable without a database, and a client missing the new models
 * should fail loudly at construction rather than inside a write.
 * ─────────────────────────────────────────────────────────────────────────── */

export interface MarketIngestRunRow {
  id: string;
  runKey: string;
  providerId: string;
  subjectClass: string;
  cadenceWindow: string;
  triggerKind: string;
  authorisedBy: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  outcome: string | null;
  attempts: number;
  observationsWritten: number;
  detail: string | null;
}

export interface MarketIngestLeaseRow {
  id: string;
  runKey: string;
  owner: string;
  acquiredAt: Date;
  expiresAt: Date;
  releasedAt: Date | null;
}

export interface MarketObservationRow {
  id: string;
  observationKey: string;
  vintageProvenance: string;
  publisherChangedAt: Date | null;
}

export interface MarketIngestRunDelegate {
  findUnique(args: { where: { runKey: string } }): Promise<MarketIngestRunRow | null>;
  create(args: {
    data: {
      runKey: string;
      providerId: string;
      subjectClass: string;
      cadenceWindow: string;
      triggerKind: string;
      authorisedBy: string | null;
      startedAt: Date;
    };
  }): Promise<MarketIngestRunRow>;
  /** The run's terminal write. There is no path that edits a finished run's identity. */
  update(args: {
    where: { id: string };
    data: {
      outcome: string;
      finishedAt: Date;
      observationsWritten: number;
      detail: string | null;
    };
  }): Promise<MarketIngestRunRow>;
}

export interface MarketIngestLeaseDelegate {
  findUnique(args: { where: { runKey: string } }): Promise<MarketIngestLeaseRow | null>;
  create(args: {
    data: { runKey: string; owner: string; acquiredAt: Date; expiresAt: Date };
  }): Promise<MarketIngestLeaseRow>;
  /**
   * THE CONDITIONAL TAKEOVER. `where` carries the expiry predicate, so the database
   * decides whether this caller may steal a dead lease — not the caller.
   */
  updateMany(args: {
    where: {
      runKey: string;
      OR: Array<{ releasedAt: { not: null } } | { expiresAt: { lt: Date } }>;
    };
    data: { owner: string; acquiredAt: Date; expiresAt: Date; releasedAt: null };
  }): Promise<{ count: number }>;
  update(args: {
    where: { id: string };
    data: { expiresAt?: Date; releasedAt?: Date };
  }): Promise<MarketIngestLeaseRow>;
}

export interface MarketObservationDelegate {
  upsert(args: {
    where: {
      observationKey_vintageProvenance_publisherChangedAt: {
        observationKey: string;
        vintageProvenance: string;
        publisherChangedAt: Date | null;
      };
    };
    create: Record<string, unknown>;
    update: Record<string, never>;
  }): Promise<MarketObservationRow>;
}

export interface MarketIngestPrismaPort {
  marketIngestRun: MarketIngestRunDelegate;
  marketIngestLease: MarketIngestLeaseDelegate;
  marketObservation: MarketObservationDelegate;
}

export class MarketIngestClientShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketIngestClientShapeError';
  }
}

const REQUIRED_SURFACE: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['marketIngestRun', ['findUnique', 'create', 'update']],
  ['marketIngestLease', ['findUnique', 'create', 'updateMany', 'update']],
  ['marketObservation', ['upsert']],
] as const;

export function asMarketIngestPrismaPort(client: unknown): MarketIngestPrismaPort {
  if (client === null || typeof client !== 'object') {
    throw new MarketIngestClientShapeError(
      'A Prisma client is required for the Market ingest store; received ' +
        (client === null ? 'null' : typeof client) +
        '.',
    );
  }

  const candidate = client as Record<string, unknown>;

  for (const [model, methods] of REQUIRED_SURFACE) {
    const delegate = candidate[model] as Record<string, unknown> | undefined;

    if (delegate === undefined || delegate === null || typeof delegate !== 'object') {
      throw new MarketIngestClientShapeError(
        `The Prisma client has no "${model}" delegate. Run \`prisma generate\` against a ` +
          'schema that includes the Market ingest models (migration ' +
          '20260919040000_add_market_scheduled_ingest).',
      );
    }

    for (const method of methods) {
      if (typeof delegate[method] !== 'function') {
        throw new MarketIngestClientShapeError(
          `The Prisma client's "${model}" delegate has no ${method}().`,
        );
      }
    }
  }

  return client as MarketIngestPrismaPort;
}

/* ───────────────────────────────────────────────────────────────────────────
 * THE REPOSITORY
 * ─────────────────────────────────────────────────────────────────────────── */

export class MarketIngestRepository implements LeaseStore, RunStore, ObservationStore {
  private readonly db: MarketIngestPrismaPort;

  constructor(client: unknown) {
    this.db = asMarketIngestPrismaPort(client);
  }

  /* ── LeaseStore ────────────────────────────────────────────────────────── */

  async acquire(input: {
    runKey: string;
    owner: string;
    nowMs: number;
    leaseMs: number;
  }): Promise<{ leaseId: string; expiresAtMs: number } | null> {
    const now = new Date(input.nowMs);
    const expiresAt = new Date(input.nowMs + input.leaseMs);

    const existing = await this.db.marketIngestLease.findUnique({
      where: { runKey: input.runKey },
    });

    if (existing === null) {
      try {
        const created = await this.db.marketIngestLease.create({
          data: { runKey: input.runKey, owner: input.owner, acquiredAt: now, expiresAt },
        });

        return { leaseId: created.id, expiresAtMs: created.expiresAt.getTime() };
      } catch {
        /*
          ANOTHER WORKER WON THE INSERT RACE. The unique index on runKey is what
          decided it, which is the point: two workers that both saw "no lease" cannot
          both create one. Losing this race is an ordinary DEFERRED, not an error.
        */
        return null;
      }
    }

    /*
      A LEASE EXISTS. It may be taken over ONLY if it was released or has expired, and
      that decision is made by the database in the `where` clause — never by reading
      the row here and deciding in TypeScript, which is how two workers both conclude
      "it expired" and both proceed.
    */
    const takenOver = await this.db.marketIngestLease.updateMany({
      where: {
        runKey: input.runKey,
        OR: [{ releasedAt: { not: null } }, { expiresAt: { lt: now } }],
      },
      data: { owner: input.owner, acquiredAt: now, expiresAt, releasedAt: null },
    });

    if (takenOver.count === 0) return null;

    return { leaseId: existing.id, expiresAtMs: expiresAt.getTime() };
  }

  async release(leaseId: string): Promise<void> {
    await this.db.marketIngestLease.update({
      where: { id: leaseId },
      data: { releasedAt: new Date() },
    });
  }

  async heartbeat(leaseId: string, nowMs: number, leaseMs: number): Promise<boolean> {
    await this.db.marketIngestLease.update({
      where: { id: leaseId },
      data: { expiresAt: new Date(nowMs + leaseMs) },
    });

    return true;
  }

  /* ── RunStore ──────────────────────────────────────────────────────────── */

  async findByRunKey(runKey: string): Promise<{ runId: string; outcome: RunOutcome } | null> {
    const row = await this.db.marketIngestRun.findUnique({ where: { runKey } });

    // SI-6.2 — a run that has not FINISHED is not a completed window. Treating an
    // in-flight run as "already done" would turn a crash into permanent silence.
    if (row === null || row.outcome === null) return null;

    return { runId: row.id, outcome: row.outcome as RunOutcome };
  }

  async begin(input: {
    runKey: string;
    trigger: IngestTrigger;
    startedAtMs: number;
  }): Promise<{ runId: string }> {
    const row = await this.db.marketIngestRun.create({
      data: {
        runKey: input.runKey,
        providerId: input.trigger.providerId,
        subjectClass: input.trigger.subjectClass,
        cadenceWindow: input.trigger.cadenceWindow,
        triggerKind: input.trigger.kind,
        authorisedBy: input.trigger.authorisedBy ?? null,
        startedAt: new Date(input.startedAtMs),
      },
    });

    return { runId: row.id };
  }

  async finish(input: {
    runId: string;
    outcome: RunOutcome;
    finishedAtMs: number;
    observationsWritten: number;
    detail: string | null;
  }): Promise<void> {
    await this.db.marketIngestRun.update({
      where: { id: input.runId },
      data: {
        outcome: input.outcome,
        finishedAt: new Date(input.finishedAtMs),
        observationsWritten: input.observationsWritten,
        detail: input.detail,
      },
    });
  }

  /* ── ObservationStore ──────────────────────────────────────────────────── */

  async upsertMany(input: {
    runId: string;
    providerId: string;
    subjectClass: string;
    snapshotContentAddress: string | null;
    observations: readonly MarketObservationDraft[];
    ingestedAtMs: number;
  }): Promise<{ written: number }> {
    let written = 0;

    for (const draft of input.observations) {
      /*
        SI-9.2 — THE VINTAGE CLAIM MUST BE BACKED, AND IT IS CHECKED HERE AS WELL AS
        BY THE DATABASE. The CHECK constraint is the guarantee; this is the error
        message. A row rejected by a constraint says which constraint; this says which
        observation and why, which is what an operator actually needs.
      */
      if (draft.vintageProvenance === 'PUBLISHER_VINTAGE' && draft.publisherVintage === null) {
        throw new Error(
          `M-1: observation '${draft.observationKey}' claims PUBLISHER_VINTAGE and carries no ` +
            `publisher vintage. A vintage axis that can be claimed without evidence is a label.`,
        );
      }

      if (draft.vintageProvenance === 'PUBLISHER_CHANGED_AT' && draft.publisherChangedAt === null) {
        throw new Error(
          `M-1: observation '${draft.observationKey}' claims PUBLISHER_CHANGED_AT and carries no ` +
            `publisher change timestamp.`,
        );
      }

      const publisherChangedAt =
        draft.publisherChangedAt === null ? null : new Date(draft.publisherChangedAt);

      await this.db.marketObservation.upsert({
        where: {
          observationKey_vintageProvenance_publisherChangedAt: {
            observationKey: draft.observationKey,
            vintageProvenance: draft.vintageProvenance,
            publisherChangedAt,
          },
        },
        create: {
          observationKey: draft.observationKey,
          seriesId: draft.seriesId,
          periodId: draft.periodId,
          providerId: input.providerId,
          subjectClass: input.subjectClass,
          value: draft.value,
          unit: draft.unit,
          publisherVintage:
            draft.publisherVintage === null ? null : new Date(draft.publisherVintage),
          publisherChangedAt,
          ingestedAt: new Date(input.ingestedAtMs),
          vintageProvenance: draft.vintageProvenance,
          releaseStatus: draft.releaseStatus,
          snapshotContentAddress: input.snapshotContentAddress,
          runId: input.runId,
        },
        // EMPTY — SI-6.2. Re-running a window must not create a second observation,
        // and must not silently rewrite the first one either.
        update: {},
      });

      written += 1;
    }

    return { written };
  }
}
