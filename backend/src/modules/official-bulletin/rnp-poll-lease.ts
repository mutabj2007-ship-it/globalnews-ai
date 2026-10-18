import type { RnpWindow } from './rnp-collection-schedule';

/*
  CTO R158 §2 — single-collector protection inside ONE environment, durable across restarts, replicas and
  overlapping deployments (old and new containers share the environment's database).

  No schema change: the existing `MarketIngestLease` table (migration 20260919040000, present on every database)
  is a unique-keyed lease. RNP keeps ONE row under its own run key, which the market lane never reads. Claiming a
  window is a single conditional UPDATE — "take the row only if nobody has claimed a window that opened at or after
  this one" — so the database, not the caller, decides who reads. Any error is a refusal: when the lease cannot be
  proven, nothing is read.
*/
export const RNP_LEASE_RUN_KEY = 'official-bulletin:rnp:listing';

export interface RnpLeaseStore {
  updateMany(args: {
    where: { runKey: string; acquiredAt: { lt: Date } };
    data: { owner: string; acquiredAt: Date; expiresAt: Date; releasedAt: null };
  }): Promise<{ count: number }>;
  create(args: {
    data: { runKey: string; owner: string; acquiredAt: Date; expiresAt: Date };
  }): Promise<unknown>;
}

export class RnpPollLease {
  constructor(
    private readonly store: RnpLeaseStore,
    private readonly owner: string,
  ) {}

  /** True only when THIS process won the window. */
  async claim(window: RnpWindow): Promise<boolean> {
    const data = {
      owner: this.owner,
      acquiredAt: new Date(window.start),
      expiresAt: new Date(window.end),
      releasedAt: null,
    };
    try {
      const taken = await this.store.updateMany({
        where: { runKey: RNP_LEASE_RUN_KEY, acquiredAt: { lt: data.acquiredAt } },
        data,
      });
      if (taken.count === 1) return true;
      /* Zero rows: either the row is missing (first ever claim) or the window is already taken. */
      await this.store.create({
        data: {
          runKey: RNP_LEASE_RUN_KEY,
          owner: data.owner,
          acquiredAt: data.acquiredAt,
          expiresAt: data.expiresAt,
        },
      });
      return true;
    } catch {
      /* P2002 (the row exists: this window is already claimed, or another process created it first) and every other
         error alike: unproven ⇒ no read. */
      return false;
    }
  }
}
