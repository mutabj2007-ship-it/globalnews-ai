import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { CountryFollowListResponse, CountryFollowView } from '@globalnews-ai/shared';
import { PrismaService } from '../../database/prisma.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { FOLLOW_LIST_LIMIT, MAX_COUNTRY_FOLLOWS } from './follows.constants';

/**
 * R1/T3 — the country-follow service.
 *
 * OWNERSHIP IS ENFORCED IN THE QUERY, NEVER AFTER IT. Every read and
 * every write below carries the authenticated `userId` in its `where`
 * clause, so a row that is not the caller's is never loaded, never
 * mapped and never deleted. No method here accepts a user identifier
 * from anywhere except the controller's `@CurrentUser()`.
 *
 * THE COUNTRY CODE HAS ALREADY BEEN VALIDATED against ALL_ISO3_CODES by
 * the DTO before this service is entered, so nothing here re-derives or
 * re-normalises it. One validation point, not two that could disagree.
 *
 * THE CEILING IS A RESOURCE BOUND, NOT AN ENTITLEMENT. No method here
 * consults a plan, a tier or a subscription, because none exists.
 */
/**
 * R1/T3 — the two shapes a PostgreSQL serialization failure takes, and a
 * bounded retry budget.
 *
 * THIS IS NOT SPECULATIVE HARDENING. A live PostgreSQL 16 probe run
 * against this exact schema showed that a count-then-insert at READ
 * COMMITTED — Prisma's default inside `$transaction` — lets two
 * concurrent follows both observe 49 and both commit, reaching 51. The
 * ceiling was exceeded. The same probe at SERIALIZABLE ended at 50 with
 * one transaction aborted by SQLSTATE 40001. A shared transaction is
 * NECESSARY and NOT SUFFICIENT, and the first version of this service
 * had only the shared transaction.
 *
 * WHY THE PREDICATE CHECKS FOUR SHAPES. S2 established, against real
 * PostgreSQL, that the SAME 40001 reaches this code differently
 * depending on WHEN the conflict is detected: mid-statement it arrives
 * as a mapped PrismaClientKnownRequestError with code P2034, and AT
 * COMMIT it arrives as a DriverAdapterError with NO code at all and the
 * message 'TransactionWriteConflict'. The second shape escaped S2's
 * first retry filter and surfaced to users as an unhandled error.
 *
 * DUPLICATION, DISCLOSED. `support.service.ts` carries an equivalent
 * predicate. It is not exported, and extracting a shared helper would
 * add a file beyond this milestone's authorized ceiling, so the logic is
 * repeated here rather than reached for. Recorded as technical debt: the
 * two copies should become one the next time a shared module is
 * authorized, because a security-relevant predicate maintained in two
 * places will eventually be corrected in only one.
 */
const MAX_FOLLOW_ATTEMPTS = 5;
const TRANSACTION_WRITE_CONFLICT = 'P2034';
const SERIALIZATION_FAILURE_SQLSTATE = '40001';
const DRIVER_WRITE_CONFLICT_KIND = 'TransactionWriteConflict';
const DRIVER_ADAPTER_ERROR_NAME = 'DriverAdapterError';

interface DriverConflictCause {
  originalCode?: unknown;
  kind?: unknown;
}

interface PrismaErrorLike {
  code?: unknown;
  name?: unknown;
  message?: unknown;
  meta?: { driverAdapterError?: { cause?: DriverConflictCause } };
  cause?: DriverConflictCause;
}

function isWriteConflict(error: unknown): boolean {
  const candidate = error as PrismaErrorLike;

  if (candidate?.code === TRANSACTION_WRITE_CONFLICT) return true;

  const cause = candidate?.meta?.driverAdapterError?.cause ?? candidate?.cause;
  // SQLSTATE first: it is PostgreSQL's own vocabulary and the one thing
  // here a client or adapter release cannot change.
  if (cause?.originalCode === SERIALIZATION_FAILURE_SQLSTATE) return true;
  if (cause?.kind === DRIVER_WRITE_CONFLICT_KIND) return true;

  return (
    candidate?.name === DRIVER_ADAPTER_ERROR_NAME &&
    candidate?.message === DRIVER_WRITE_CONFLICT_KIND
  );
}

const iso = (value: Date): string => value.toISOString();

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telemetry: TelemetryService,
  ) {}

  /**
   * The caller's own follows, newest first.
   *
   * Scoped by `userId` with no caller-supplied filter and no identifier
   * in the path, so there is no shape in which one account can request
   * another's list. Bounded by an explicit `take` rather than left
   * unbounded — the ceiling already limits how many can exist, so this
   * is a stated bound rather than a hidden truncation.
   */
  async listForUser(userId: string): Promise<CountryFollowListResponse> {
    const rows = await this.prisma.countryFollow.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: FOLLOW_LIST_LIMIT,
      select: { countryCode: true, createdAt: true },
    });

    const follows: CountryFollowView[] = rows.map((row) => ({
      countryCode: row.countryCode,
      createdAt: iso(row.createdAt),
    }));

    return { follows, maxFollows: MAX_COUNTRY_FOLLOWS };
  }

  /**
   * Follow a country. IDEMPOTENT.
   *
   * A REPEAT FOLLOW IS A NO-OP, NOT A 409. The composite unique
   * `@@unique([userId, countryCode])` makes that a property of the
   * database rather than of application politeness: `upsert` matches the
   * existing row and returns it unchanged, so the original `createdAt`
   * survives and a double-clicked button cannot rewrite when the user
   * first followed a country.
   *
   * THE CEILING IS CHECKED INSIDE THE SAME TRANSACTION AS THE INSERT.
   * A count-then-create outside a transaction is not safe: two concurrent
   * requests can both observe one slot remaining and both insert, leaving
   * the account one over the bound. Counting and upserting in one
   * transaction closes that window.
   *
   * The count runs only when the follow does not already exist, so
   * re-following at the ceiling stays a no-op rather than a 409 — being
   * at capacity must not make an existing follow unrepeatable.
   */
  async follow(userId: string, countryCode: string): Promise<CountryFollowView> {
    const { view, created } = await this.attemptFollow(userId, countryCode);

    // Emitted only on a real state change, so a repeat follow does not
    // inflate the count of how many follows were actually created.
    if (created) {
      await this.telemetry.recordAccountEvent('follow_created', userId, {
        countryCode,
      });
    }

    return view;
  }

  /**
   * The follow transaction, at SERIALIZABLE, with a bounded retry.
   *
   * A serialization failure here is not an error condition — it is
   * PostgreSQL correctly refusing to let two concurrent follows both
   * believe there was room. The retry re-reads the real count and either
   * succeeds or refuses honestly. The 409 raised inside the transaction
   * is a DECISION, not a failure: it is neither a P2034 nor a driver
   * conflict, so the filter below never mistakes it for something to
   * retry.
   */
  private async attemptFollow(
    userId: string,
    countryCode: string,
  ): Promise<{ view: CountryFollowView; created: boolean }> {
    for (let attempt = 1; attempt <= MAX_FOLLOW_ATTEMPTS; attempt += 1) {
      try {
        return await this.runFollowTransaction(userId, countryCode);
      } catch (error) {
        if (!isWriteConflict(error) || attempt === MAX_FOLLOW_ATTEMPTS) {
          throw error;
        }
      }
    }

    // Unreachable: the loop either returns or throws. Present so the
    // function cannot fall through to undefined if the bound changes.
    throw new Error('Following a country exhausted its bounded retries.');
  }

  private async runFollowTransaction(
    userId: string,
    countryCode: string,
  ): Promise<{ view: CountryFollowView; created: boolean }> {
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.countryFollow.findUnique({
          where: { userId_countryCode: { userId, countryCode } },
          select: { countryCode: true, createdAt: true },
        });

        if (existing) {
          return {
            view: { countryCode: existing.countryCode, createdAt: iso(existing.createdAt) },
            created: false,
          };
        }

        const count = await tx.countryFollow.count({ where: { userId } });

        if (count >= MAX_COUNTRY_FOLLOWS) {
          // A resource bound, stated as a conflict rather than a payment
          // or permission problem, because that is what it is.
          throw new HttpException(
            'You are already following the maximum number of countries.',
            HttpStatus.CONFLICT,
          );
        }

        const row = await tx.countryFollow.create({
          data: { userId, countryCode },
          select: { countryCode: true, createdAt: true },
        });

        return {
          view: { countryCode: row.countryCode, createdAt: iso(row.createdAt) },
          created: true,
        };
      },
      // THE ISOLATION LEVEL IS THE CONTROL. Without it a shared
      // transaction still lets two concurrent follows both count 49 and
      // both insert — measured, not assumed. See the comment above
      // MAX_FOLLOW_ATTEMPTS.
      { isolationLevel: 'Serializable' },
    );
  }

  /**
   * Unfollow a country.
   *
   * `deleteMany` scoped by `{ userId, countryCode }`: another user's
   * follow is not deleted, and a follow that never existed produces the
   * same empty result as one belonging to somebody else — the two are
   * indistinguishable to the caller, so this route cannot be used to
   * discover what another account follows.
   */
  async unfollow(userId: string, countryCode: string): Promise<void> {
    const { count } = await this.prisma.countryFollow.deleteMany({
      where: { userId, countryCode },
    });

    if (count > 0) {
      await this.telemetry.recordAccountEvent('follow_removed', userId, { countryCode });
    }
  }
}
