import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RETURN_VISIT_MIN_INTERVAL_MS, VISIT_ACTIVITY_TOUCH_INTERVAL_MS } from './return-state.constants';
import { TelemetryService } from '../telemetry/telemetry.service';

export interface UserSummary {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: Date;
}

/**
 * Milestone #57 — deleteAccount relies entirely on Prisma's
 * onDelete: Cascade declared on UserIdentity/Session/SearchHistoryEntry's
 * own userId foreign keys (see schema.prisma) — a single delete of the
 * User row removes every account-owned row across all three related
 * tables in one operation. No manual multi-table delete sequence is
 * written here, since that would risk drifting out of sync with the
 * schema's own cascade declarations over time.
 */
/**
 * R1/T2 — what a return-surface visit reports back.
 *
 * `previousSeenAt` is the value as it stood BEFORE this visit, which is
 * the only value a "since your last visit" surface can honestly use.
 * `recorded` says whether this call actually wrote, so a caller can see
 * the throttle working rather than having to infer it.
 */
export interface ReturnStateView {
  /** ISO-8601, or null on a first-ever visit. */
  previousSeenAt: string | null;
  firstVisit: boolean;
  recorded: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telemetry: TelemetryService,
  ) {}

  async getById(userId: string): Promise<UserSummary | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, createdAt: true },
    });
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.prisma.user.delete({ where: { id: userId } });
  }

  /**
   * R1/T2 — record a meaningful return-surface visit and report the
   * PREVIOUS one.
   *
   * READ BEFORE WRITE, AND THE RESPONSE CARRIES THE OLD VALUE. That
   * ordering is the entire contract. A surface asking "what is new since
   * you were last here" needs the timestamp as it stood BEFORE this
   * visit; a surface that read the column after the write would always
   * see "now" and would correctly conclude that nothing is new, forever.
   *
   * NULL MEANS MAKE NO CLAIM. On a first-ever visit `previousSeenAt` is
   * null and `firstVisit` is true. NULL is never treated as "everything
   * is new" — a platform that has never observed someone cannot tell them
   * what changed since a visit it did not see.
   *
   * THE WRITE IS THROTTLED, AND THAT IS A CORRECTNESS CONTROL RATHER THAN
   * AN OPTIMISATION. Updating on every load would make the comparison
   * window collapse to the gap between two page views, so a user who
   * opened the surface twice in a minute would be told that nothing had
   * happened in the interval. Writing at most once per
   * RETURN_VISIT_MIN_INTERVAL_MS keeps the window meaningful AND removes
   * the write amplification: at most two writes an hour, none at all for
   * a refresh.
   *
   * NOTHING HERE DERIVES A TIMESTAMP FROM CONTENT. `lastSeenAt` is set
   * from the server clock at the moment of a visit, and never from an
   * article's `publishedAt` (mutable, provider-reported) or from R0's
   * `firstSeenAt`. The two halves of the comparison are produced
   * independently and stay semantically independent; R0.5 — exposing
   * firstSeenAt on the live path — is E1's and is not solved here.
   */
  /*
   * MY INTELLIGENCE R1 — THE VISIT-BOUNDARY REPAIR.
   *
   * THE DEFECT. Inside the 30-minute window the previous implementation
   * returned lastSeenAt itself as "previousSeenAt" — the start of THIS visit,
   * not the previous one — so a reload moved the boundary; and because it
   * wrote only once per 30 minutes, 30+ minutes of continuous activity was
   * later read as a brand-new return visit.
   *
   * THE RULE. lastSeenAt stays the ONLY activity clock. User.visitBoundaryAt
   * is a snapshot of it, taken once per new visit:
   *   - first-ever visit        → previousSeenAt null; lastSeenAt set.
   *   - gap ≥ 30 min            → new visit: visitBoundaryAt := old lastSeenAt,
   *                               lastSeenAt := now.
   *   - same visit (gap < 30)   → previousSeenAt = visitBoundaryAt, unchanged;
   *                               lastSeenAt touched at most every 5 min.
   *
   * CONCURRENT TABS rotate the boundary EXACTLY ONCE: every write is a
   * compare-and-set on the lastSeenAt value this request read. A request that
   * loses the race re-reads and reports the boundary the winner wrote. No
   * second session mechanism, and no client-side clock.
   */
  async recordSeen(userId: string, now: Date = new Date()): Promise<ReturnStateView> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastSeenAt: true, visitBoundaryAt: true },
    });

    if (!existing) {
      throw new NotFoundException();
    }

    const { lastSeenAt, visitBoundaryAt } = existing;

    if (lastSeenAt === null) {
      const won = await this.compareAndSet(userId, null, { lastSeenAt: now });
      if (!won) return this.reportCurrent(userId);
      await this.telemetry.recordAccountEvent('return_visit', userId);
      return { previousSeenAt: null, firstVisit: true, recorded: true };
    }

    const elapsedMs = now.getTime() - lastSeenAt.getTime();

    if (elapsedMs >= RETURN_VISIT_MIN_INTERVAL_MS) {
      const won = await this.compareAndSet(userId, lastSeenAt, {
        visitBoundaryAt: lastSeenAt,
        lastSeenAt: now,
      });
      if (!won) return this.reportCurrent(userId);
      // One event per distinct visit, never per refresh or per tab.
      await this.telemetry.recordAccountEvent('return_visit', userId);
      return { previousSeenAt: lastSeenAt.toISOString(), firstVisit: false, recorded: true };
    }

    // Same visit: the boundary never moves; activity extends the visit.
    const recorded =
      elapsedMs >= VISIT_ACTIVITY_TOUCH_INTERVAL_MS
        ? await this.compareAndSet(userId, lastSeenAt, { lastSeenAt: now })
        : false;
    return {
      previousSeenAt: visitBoundaryAt ? visitBoundaryAt.toISOString() : null,
      firstVisit: visitBoundaryAt === null,
      recorded,
    };
  }

  /** True when this request's write won; false when another request changed lastSeenAt first. */
  private async compareAndSet(
    userId: string,
    expectedLastSeenAt: Date | null,
    data: { lastSeenAt: Date; visitBoundaryAt?: Date },
  ): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId, lastSeenAt: expectedLastSeenAt },
      data,
    });
    return result.count === 1;
  }

  /** The boundary as it now stands, after another request won the write. */
  private async reportCurrent(userId: string): Promise<ReturnStateView> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { visitBoundaryAt: true },
    });
    const boundary = current?.visitBoundaryAt ?? null;
    return {
      previousSeenAt: boundary ? boundary.toISOString() : null,
      firstVisit: boundary === null,
      recorded: false,
    };
  }
}
