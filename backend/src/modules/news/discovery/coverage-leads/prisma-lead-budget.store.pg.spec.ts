import { PrismaService } from '../../../../database/prisma.service';
import { LeadCallGate, LEAD_CALLS_PER_HOUR } from '../gdelt-lead/lead-call-gate';
import {
  LEAD_CALL_SCOPE,
  LEAD_REFUSAL_SCOPE,
  prismaLeadBudgetStore,
} from './prisma-lead-budget.store';

/*
  CTO R169 — the durable budget against a REAL PostgreSQL (the migrated schema of this SHA). Runs only
  when LEAD_BUDGET_PG_URL names a throwaway database; skipped otherwise, so the default suite needs no
  database. Each "replica" or "restart" is a separate PrismaService (its own connection pool).
*/
const url = process.env.LEAD_BUDGET_PG_URL;
const describePg = url ? describe : describe.skip;

describePg(
  'coverage leads · durable budget on real PostgreSQL (ComputeMeter, advisory xact lock)',
  () => {
    const clients: PrismaService[] = [];
    const replica = (): { gate: LeadCallGate; db: PrismaService } => {
      process.env.DATABASE_URL = url;
      const db = new PrismaService();
      clients.push(db);
      return { gate: new LeadCallGate(prismaLeadBudgetStore(db)), db };
    };
    const clear = (db: PrismaService) =>
      db.$executeRaw`DELETE FROM "ComputeMeter" WHERE "scope" IN (${LEAD_CALL_SCOPE}, ${LEAD_REFUSAL_SCOPE})`;
    const callRows = async (db: PrismaService) =>
      Number(
        (
          await db.$queryRaw<{ n: bigint }[]>`
          SELECT COALESCE(SUM("units"), 0)::bigint AS "n" FROM "ComputeMeter" WHERE "scope" = ${LEAD_CALL_SCOPE}`
        )[0].n,
      );

    beforeEach(async () => {
      await clear(replica().db);
    });
    afterAll(async () => {
      await clear(clients[0]);
      await Promise.all(clients.map((c) => c.$disconnect()));
    });

    it('3 replicas × 20 simultaneous reservations → exactly one call recorded (lock + spacing)', async () => {
      const replicas = [replica(), replica(), replica()];
      const results = await Promise.all(
        replicas.flatMap(({ gate }) => Array.from({ length: 20 }, () => gate.reserve())),
      );
      expect(results.filter((r) => r.granted)).toHaveLength(1);
      expect(results.filter((r) => !r.granted && r.reason === 'SPACING')).toHaveLength(59);
      expect(await callRows(replicas[0].db)).toBe(1);
    });

    it('a full hour recorded in the table refuses every new process (restart ×3), until a call ages out', async () => {
      const { db } = replica();
      for (let i = 0; i < LEAD_CALLS_PER_HOUR; i++) {
        await db.$executeRaw`
        INSERT INTO "ComputeMeter" ("scope", "bucketStart", "units")
        VALUES (${LEAD_CALL_SCOPE}, clock_timestamp() - make_interval(secs => ${10 + i * 55}), 1)`;
      }
      for (let restart = 0; restart < 3; restart++) {
        expect(await replica().gate.reserve()).toEqual({ granted: false, reason: 'HOURLY_CAP' });
      }
      await db.$executeRaw`
      UPDATE "ComputeMeter" SET "bucketStart" = clock_timestamp() - interval '61 minutes'
      WHERE "scope" = ${LEAD_CALL_SCOPE}
        AND "bucketStart" = (SELECT MIN("bucketStart") FROM "ComputeMeter" WHERE "scope" = ${LEAD_CALL_SCOPE})`;
      expect(await replica().gate.reserve()).toEqual({ granted: true });
      expect(await replica().gate.reserve()).toEqual({ granted: false, reason: 'HOURLY_CAP' });
    });

    it('a refusal recorded by one process shuts another for 15 minutes', async () => {
      const a = replica();
      expect(await a.gate.reserve()).toEqual({ granted: true });
      await a.gate.refused();
      await a.db.$executeRaw`
      UPDATE "ComputeMeter" SET "bucketStart" = clock_timestamp() - interval '1 minute' WHERE "scope" = ${LEAD_CALL_SCOPE}`;
      expect(await replica().gate.reserve()).toEqual({ granted: false, reason: 'COOLDOWN' });
    });

    it('an unreachable database refuses (BUDGET_UNREADABLE), never calls', async () => {
      process.env.DATABASE_URL = 'postgresql://nobody@127.0.0.1:9/none';
      const dead = new PrismaService();
      clients.push(dead);
      expect(await new LeadCallGate(prismaLeadBudgetStore(dead)).reserve()).toEqual({
        granted: false,
        reason: 'BUDGET_UNREADABLE',
      });
    });
  },
);
