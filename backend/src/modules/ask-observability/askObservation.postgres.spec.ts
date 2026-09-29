import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { AskObservationService } from './ask-observation.service';
import { AskObservationRetentionService } from './ask-observation-retention.service';
import { newAskObservationDraft } from './ask-observation.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R1 — THE MIGRATION AND THE STORE, AGAINST A REAL POSTGRESQL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The migration in this branch was HAND-AUTHORED, because `prisma migrate diff` needs a
 * schema engine and the host that serves it is refused by this session's egress policy.
 * A hand-authored migration that nobody executes is a text file with SQL in it, so this
 * suite is the proof that replaces the generator: the migrations are applied in order to a
 * real server, the resulting catalog is asserted column by column against the model, and
 * the generated Prisma client then reads and writes the tables through that catalog.
 *
 * NEVER FALLS BACK TO `DATABASE_URL`. Only a dedicated loopback database is accepted, the
 * same rule the landed Ask V2 live suite applies — a live test that can silently point at
 * a real deployment is a hazard, not a test.
 */
const url = process.env.ASK_OBSERVATION_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/[a-z_]+@127\.0\.0\.1:\d+\/[a-z0-9_]+$/.test(url)) {
  throw new Error('Ask observation live tests require a dedicated loopback test database');
}
jest.setTimeout(30000);
const live = url ? describe : describe.skip;

live('R1 — the Ask observation store on PostgreSQL', () => {
  let db: PrismaClient;
  let service: AskObservationService;
  let retention: AskObservationRetentionService;

  beforeAll(() => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    retention = new AskObservationRetentionService(db as unknown as PrismaService);
    service = new AskObservationService(db as unknown as PrismaService, retention);
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  const input = (operationId: string, over: Record<string, unknown> = {}) => ({
    operationId,
    ...newAskObservationDraft('ask-r2-adapter/1', 'en'),
    ...over,
  });

  describe('the migration produced the catalog the model declares', () => {
    type Column = {
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    };

    const columnsOf = async (table: string): Promise<Map<string, Column>> => {
      const rows = await db.$queryRawUnsafe<Column[]>(
        `select column_name, data_type, is_nullable, column_default
           from information_schema.columns
          where table_schema = 'public' and table_name = $1`,
        table,
      );
      return new Map(rows.map((row) => [row.column_name, row]));
    };

    it('AskObservation exists with every declared column', async () => {
      const columns = await columnsOf('AskObservation');
      expect(columns.size).toBe(53);

      /* The three that carry the privacy contract's shape. */
      expect(columns.get('operationId')?.is_nullable).toBe('NO');
      expect(columns.get('topicPresent')?.data_type).toBe('boolean');
      expect(columns.get('statedPeriodPresent')?.data_type).toBe('boolean');

      /* Nullable BY DESIGN: an absent measurement must be storable as absent. */
      [
        'promptTokens',
        'completionTokens',
        'latencyMs',
        'reportingItemCount',
        'contributorItemCount',
      ].forEach((name) => {
        expect({ name, nullable: columns.get(name)?.is_nullable }).toEqual({
          name,
          nullable: 'YES',
        });
      });

      /* Nullable because "not read" is not "off". */
      ['askR2Enabled', 'askPublicComputeEnabled'].forEach((name) => {
        expect({ name, nullable: columns.get(name)?.is_nullable }).toEqual({
          name,
          nullable: 'YES',
        });
      });

      /* The list-valued columns really are arrays, not delimited strings. */
      [
        'refusalCodes',
        'domains',
        'geographyCodes',
        'evidenceRolesRequested',
        'contributorsConsidered',
        'contributorsUsed',
        'contributorsDegraded',
      ].forEach((name) => {
        expect({ name, type: columns.get(name)?.data_type }).toEqual({ name, type: 'ARRAY' });
      });
    });

    it('AskObservation carries NO column a question could occupy', async () => {
      const columns = [...(await columnsOf('AskObservation')).keys()].map((name) =>
        name.toLowerCase(),
      );
      ['question', 'prompt', 'query', 'userid', 'email', 'fingerprint', 'ipaddress'].forEach(
        (forbidden) => {
          expect({ forbidden, present: columns.includes(forbidden) }).toEqual({
            forbidden,
            present: false,
          });
        },
      );
    });

    it('POSITIVE CONTROL — the same catalog read DOES find the question column on AskTurn', async () => {
      const columns = [...(await columnsOf('AskTurn')).keys()];
      expect(columns).toContain('question');
    });

    it('the unique and lookup indexes the model declares are really there', async () => {
      const indexes = await db.$queryRawUnsafe<{ indexname: string }[]>(
        `select indexname from pg_indexes where schemaname = 'public' and tablename = $1`,
        'AskObservation',
      );
      const names = indexes.map((row) => row.indexname).sort();
      expect(names).toEqual(
        [
          'AskObservation_answerState_occurredAt_idx',
          'AskObservation_occurredAt_idx',
          'AskObservation_operationId_key',
          'AskObservation_pkey',
          'AskObservation_questionClass_occurredAt_idx',
          'AskObservation_routePath_occurredAt_idx',
        ].sort(),
      );
    });

    it('AskAccessCounter is keyed by (event, hour) and holds nothing else', async () => {
      const columns = await columnsOf('AskAccessCounter');
      expect([...columns.keys()].sort()).toEqual(['bucketStart', 'count', 'event']);
    });

    it('the migration added no foreign key, so nothing can cascade into or out of it', async () => {
      const constraints = await db.$queryRawUnsafe<{ constraint_type: string }[]>(
        `select tc.constraint_type
           from information_schema.table_constraints tc
          where tc.table_schema = 'public'
            and tc.table_name in ('AskObservation', 'AskAccessCounter')`,
      );
      expect(constraints.map((row) => row.constraint_type)).not.toContain('FOREIGN KEY');
    });
  });

  describe('one explicit Ask, at most one observation', () => {
    it('the first record is written and the second for the same operation is refused', async () => {
      const operationId = randomUUID();
      await expect(service.record(input(operationId))).resolves.toBe(true);
      await expect(
        service.record(input(operationId, { answerState: 'INSUFFICIENT' })),
      ).resolves.toBe(false);

      const rows = await db.askObservation.findMany({ where: { operationId } });
      expect(rows).toHaveLength(1);
      /* The FIRST observation stands. A duplicate cannot overwrite what happened. */
      expect(rows[0].answerState).toBe('UNROUTED');
    });

    it('a refused geography value is dropped at the boundary and counted in the row', async () => {
      const operationId = randomUUID();
      await service.record(
        input(operationId, { geographyCodes: ['KEN', 'the road outside my house'] }),
      );
      const row = await db.askObservation.findUniqueOrThrow({ where: { operationId } });
      expect(row.geographyCodes).toEqual(['KEN']);
      expect(row.geographyCodesDropped).toBe(1);
      expect(JSON.stringify(row)).not.toContain('house');
    });

    it('an unmeasured token count is stored as NULL, so no average can silently include a zero', async () => {
      const operationId = randomUUID();
      await service.record(input(operationId));
      const row = await db.askObservation.findUniqueOrThrow({ where: { operationId } });
      expect(row.promptTokens).toBeNull();
      expect(row.tokensMeasured).toBe(false);

      const aggregate = await db.askObservation.aggregate({
        where: { operationId },
        _count: { promptTokens: true },
      });
      expect(aggregate._count.promptTokens).toBe(0);
    });
  });

  describe('the access counter', () => {
    it('increments its hour rather than adding a row per attempt', async () => {
      const at = new Date('2027-01-01T05:20:00.000Z');
      const bucketStart = new Date('2027-01-01T05:00:00.000Z');
      await db.askAccessCounter.deleteMany({ where: { bucketStart } });

      await service.countAccess('SIGNED_OUT_ATTEMPT', at);
      await service.countAccess('SIGNED_OUT_ATTEMPT', new Date('2027-01-01T05:59:59.000Z'));

      const rows = await db.askAccessCounter.findMany({ where: { bucketStart } });
      expect(rows).toHaveLength(1);
      expect(rows[0].count).toBe(2);

      await db.askAccessCounter.deleteMany({ where: { bucketStart } });
    });
  });

  describe('retention is ENFORCED, and bounded to the horizon', () => {
    it('removes a row past the horizon and leaves a row inside it untouched', async () => {
      const now = new Date();
      const inside = randomUUID();
      const outside = randomUUID();
      const cutoff = retention.cutoff(now);

      await service.record(input(inside));
      await service.record(input(outside));
      /* Backdate one row PAST the horizon. The sweep's only predicate is age, so this is
         the whole difference between the two. */
      await db.askObservation.update({
        where: { operationId: outside },
        data: { occurredAt: new Date(cutoff.getTime() - 60_000) },
      });

      const removed = await retention.sweep(now);
      expect(removed).toBeGreaterThanOrEqual(1);

      expect(await db.askObservation.findUnique({ where: { operationId: outside } })).toBeNull();
      /* POSITIVE CONTROL for the other direction: a sweep that removed everything would
         satisfy the assertion above and be catastrophically wrong. */
      expect(await db.askObservation.findUnique({ where: { operationId: inside } })).not.toBeNull();

      await db.askObservation.deleteMany({ where: { operationId: { in: [inside, outside] } } });
    });

    it('sweeps at most once per interval per process, so a busy path pays one clock read', async () => {
      const now = new Date();
      const first = await retention.sweepIfDue(now);
      expect(typeof first).toBe('number');
      /* A second offer inside the interval does no work at all. */
      expect(await retention.sweepIfDue(new Date(now.getTime() + 1_000))).toBe(0);
    });

    it('removes counter buckets past the horizon and keeps the current one', async () => {
      const now = new Date();
      const cutoff = retention.cutoff(now);
      const oldBucket = new Date(cutoff.getTime() - 24 * 60 * 60 * 1000);

      await service.countAccess('SIGNED_OUT_ATTEMPT', oldBucket);
      await service.countAccess('SIGNED_OUT_ATTEMPT', now);
      await retention.sweep(now);

      const remaining = await db.askAccessCounter.findMany({
        where: { bucketStart: { lt: cutoff } },
      });
      expect(remaining).toEqual([]);
      expect(
        await db.askAccessCounter.findMany({ where: { bucketStart: { gte: cutoff } } }),
      ).not.toEqual([]);
    });
  });
});
