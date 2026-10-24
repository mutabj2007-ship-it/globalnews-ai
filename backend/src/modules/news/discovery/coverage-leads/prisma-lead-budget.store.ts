import type { PrismaService } from '../../../../database/prisma.service';
import type { LeadBudgetStore, LeadBudgetTx } from '../gdelt-lead/lead-call-gate';

/*
  CTO R169 — the durable, environment-wide GDELT call budget, on ALREADY-APPROVED storage with no
  migration: the existing `ComputeMeter` table (scope, bucketStart, units), which other controls
  already use as a cross-replica meter. This feature owns two scopes and nothing else:
    gdelt-lead:call      one row per reserved call, bucketStart = the database time of the reservation
    gdelt-lead:refused   one row per GDELT refusal (429 / 5xx / timeout)
  Every existing reader filters on its own exact scope, so these rows change no other meter; the
  data-retention sweep removes them with the other usage meters once they are days old.

  Each reservation runs in ONE transaction that first takes pg_advisory_xact_lock(key): replicas are
  serialised, the lock is released at commit or rollback (a crash cannot strand it), and the count
  is read from the table, so a restart starts from the true count. clock_timestamp() — not now(),
  which is frozen at transaction start — is the one clock every replica shares.
*/
export const LEAD_CALL_SCOPE = 'gdelt-lead:call';
export const LEAD_REFUSAL_SCOPE = 'gdelt-lead:refused';
/** a fixed, arbitrary advisory-lock key owned by this feature alone */
export const LEAD_BUDGET_LOCK_KEY = 4_744_454_001n;
const LOCK_TIMEOUT_MS = 5_000;

type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

const toDate = (ms: number) => new Date(ms);

function txView(tx: Tx): LeadBudgetTx {
  const latest = async (scope: string): Promise<number | null> => {
    const rows = await tx.$queryRaw<{ at: Date | null }[]>`
      SELECT MAX("bucketStart") AS "at" FROM "ComputeMeter" WHERE "scope" = ${scope}`;
    const at = rows[0]?.at ?? null;
    return at === null ? null : at.getTime();
  };
  const record = async (scope: string, atMs: number): Promise<void> => {
    await tx.$executeRaw`
      INSERT INTO "ComputeMeter" ("scope", "bucketStart", "units") VALUES (${scope}, ${toDate(atMs)}, 1)
      ON CONFLICT ("scope", "bucketStart") DO UPDATE SET "units" = "ComputeMeter"."units" + 1`;
  };
  return {
    now: async () => {
      const rows = await tx.$queryRaw<{ at: Date }[]>`SELECT clock_timestamp() AS "at"`;
      return rows[0]!.at.getTime();
    },
    callsSince: async (sinceMs) => {
      const rows = await tx.$queryRaw<{ used: bigint | null }[]>`
        SELECT SUM("units") AS "used" FROM "ComputeMeter"
        WHERE "scope" = ${LEAD_CALL_SCOPE} AND "bucketStart" > ${toDate(sinceMs)}`;
      return Number(rows[0]?.used ?? 0);
    },
    lastCallAt: () => latest(LEAD_CALL_SCOPE),
    lastRefusalAt: () => latest(LEAD_REFUSAL_SCOPE),
    recordCall: (atMs) => record(LEAD_CALL_SCOPE, atMs),
    recordRefusal: (atMs) => record(LEAD_REFUSAL_SCOPE, atMs),
  };
}

export function prismaLeadBudgetStore(prisma: PrismaService): LeadBudgetStore {
  return {
    withLock: (fn) =>
      prisma.$transaction(
        async (tx) => {
          /* ::text — Prisma cannot deserialize the function's `void` result (found on real PostgreSQL) */
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(${LEAD_BUDGET_LOCK_KEY})::text AS "locked"`;
          return fn(txView(tx));
        },
        { maxWait: LOCK_TIMEOUT_MS, timeout: LOCK_TIMEOUT_MS },
      ),
  };
}
