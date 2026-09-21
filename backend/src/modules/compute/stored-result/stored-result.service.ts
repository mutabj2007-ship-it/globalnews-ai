import { Injectable, Logger } from '@nestjs/common';
import type { StoredResultIdentity } from '@globalnews-ai/shared';
import { PrismaService } from '../../../database/prisma.service';
import { buildStoredResultFingerprint } from '../identity/stored-result-fingerprint.util';

/**
 * BETA-SIMPLE-ASK-SAND-1 §6 — STORED RESULT FIRST.
 *
 * §6: "Before expensive AI execution, check whether an adequate stored
 * result already exists." And: "Do not regenerate just because the
 * user revisited a route."
 *
 * This service is the durable half of that rule. The fast half —
 * AnalysisService's process-local TTL Map — is untouched and still
 * runs first. The two are complementary, not competing:
 *
 *   request → in-memory TTL cache (microseconds, per-replica, volatile)
 *           → StoredResultService  (milliseconds, shared, durable)
 *           → actual AI execution  (seconds, costs real money)
 *
 * WHAT "ADEQUATE" MEANS HERE, and why it is not just "present":
 * a row is adequate when its fingerprint matches (which already folds
 * in evidence revision, geography, language, time window and analysis
 * type — see stored-result-fingerprint.util.ts) AND it has not
 * expired. Evidence revision is doing the important work: without it,
 * "reuse the stored answer" degrades into "serve a stale answer
 * forever", which would satisfy the cost rule while breaking the
 * product.
 */

export interface StoredResultRecord<T = unknown> {
  id: string;
  fingerprint: string;
  kind: string;
  computeClass: string;
  payload: T;
  evidenceRevision: string;
  createdAt: Date;
  reuseCount: number;
}

@Injectable()
export class StoredResultService {
  private readonly logger = new Logger(StoredResultService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Looks up an adequate stored result, or null.
   *
   * NEVER THROWS. A stored-result lookup is an optimization, and an
   * optimization that can take down the request it was meant to speed
   * up is a liability. If the database is unreachable or the row is
   * corrupt, this logs and returns null, and the caller proceeds to
   * compute the answer — degraded cost, correct behavior. This is the
   * same fail-open discipline the existing in-memory cache has by
   * construction (a Map miss is just a miss).
   *
   * The inverse — failing the request because the CACHE is down —
   * would be a self-inflicted outage.
   */
  async find<T>(identity: StoredResultIdentity): Promise<StoredResultRecord<T> | null> {
    const fingerprint = buildStoredResultFingerprint(identity);

    try {
      const row = await this.prisma.storedResult.findUnique({ where: { fingerprint } });
      if (!row) return null;

      // Expiry is checked in application code rather than in the WHERE
      // clause so an expired row can be distinguished from an absent
      // one in telemetry — "we had it but it aged out" and "we never
      // had it" are different cost stories, and §31 asks for a real
      // cache-hit rate.
      if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
        this.logger.debug('Stored result found but expired.');
        return null;
      }

      return {
        id: row.id,
        fingerprint: row.fingerprint,
        kind: row.kind,
        computeClass: row.computeClass,
        payload: row.payload as T,
        evidenceRevision: row.evidenceRevision,
        createdAt: row.createdAt,
        reuseCount: row.reuseCount,
      };
    } catch (error) {
      this.logger.warn(
        `Stored-result lookup failed; proceeding without reuse. ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    }
  }

  /**
   * Records that a stored result was reused. §31 cache-hit measurement.
   *
   * Deliberately fire-and-forget-shaped (awaited, but never allowed to
   * fail the request): a reuse counter is bookkeeping, and failing to
   * increment it must not turn a successful zero-cost replay into an
   * error for the user.
   */
  async recordReuse(id: string): Promise<void> {
    try {
      await this.prisma.storedResult.update({
        where: { id },
        data: { reuseCount: { increment: 1 }, lastReusedAt: new Date() },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record stored-result reuse. ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  /**
   * Stores a freshly-computed result so the next identical request
   * costs nothing.
   *
   * Uses upsert rather than create because two replicas can legitimately
   * finish the same computation at nearly the same moment (the
   * in-flight collapse is per-process, so it cannot prevent that
   * across replicas). Without upsert, the loser of that race throws a
   * unique-constraint violation on `fingerprint` and a successful,
   * already-paid-for computation would be reported to the user as a
   * failure. With upsert, the loser harmlessly overwrites an
   * equivalent row.
   *
   * Returns the stored row's id, or null when persistence failed —
   * again fail-open: the caller already HAS the answer, and the user
   * must receive it whether or not we managed to cache it.
   */
  async store(input: {
    identity: StoredResultIdentity;
    computeClass: string;
    payload: unknown;
    ttlSeconds?: number;
  }): Promise<string | null> {
    const fingerprint = buildStoredResultFingerprint(input.identity);

    /**
     * An OMITTED ttlSeconds means "no clock-based expiry" — the row
     * stays reusable until its evidence revision moves on, which is
     * the §6 mechanism that should normally govern freshness.
     *
     * A PROVIDED ttlSeconds is always honored, including zero and
     * negative values, which yield an already-past instant. The
     * earlier form (`ttlSeconds && ttlSeconds > 0`) quietly collapsed
     * a negative TTL into "never expires" — the exact opposite of
     * what the caller asked for, and a silent one. A caller passing a
     * non-positive TTL is saying "this is not reusable", and the
     * least surprising thing to do is agree with them.
     */
    const expiresAt =
      input.ttlSeconds === undefined ? null : new Date(Date.now() + input.ttlSeconds * 1000);

    const data = {
      fingerprint,
      kind: input.identity.kind,
      computeClass: input.computeClass,
      payload: input.payload as never,
      evidenceRevision: input.identity.evidenceRevision,
      language: input.identity.language,
      countryCode: input.identity.countryCode ?? null,
      expiresAt,
    };

    try {
      const row = await this.prisma.storedResult.upsert({
        where: { fingerprint },
        create: data,
        // reuseCount and lastReusedAt are deliberately NOT reset on
        // update: they describe how valuable this identity has been
        // over its life, which is exactly the §31 signal we want, and
        // a re-store is a refresh of the same logical result, not a
        // new one.
        update: {
          payload: data.payload,
          computeClass: data.computeClass,
          evidenceRevision: data.evidenceRevision,
          expiresAt: data.expiresAt,
        },
        select: { id: true },
      });
      return row.id;
    } catch (error) {
      this.logger.warn(
        `Failed to store result; the answer is still being returned. ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    }
  }

  /**
   * Fetches a stored result directly by its id — the §30 acceptance
   * path "reopening stored result triggers no new expensive
   * execution". A caller holding a resultId is reopening something
   * that already exists, so no identity needs to be recomputed and no
   * classification needs to run.
   */
  async findById<T>(id: string): Promise<StoredResultRecord<T> | null> {
    try {
      const row = await this.prisma.storedResult.findUnique({ where: { id } });
      if (!row) return null;

      return {
        id: row.id,
        fingerprint: row.fingerprint,
        kind: row.kind,
        computeClass: row.computeClass,
        payload: row.payload as T,
        evidenceRevision: row.evidenceRevision,
        createdAt: row.createdAt,
        reuseCount: row.reuseCount,
      };
    } catch (error) {
      this.logger.warn(
        `Stored-result fetch by id failed. ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    }
  }
}
