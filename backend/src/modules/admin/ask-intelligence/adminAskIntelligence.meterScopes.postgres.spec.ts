import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../../generated/prisma/client';
import type { PrismaService } from '../../../database/prisma.service';
import type { OperationalSwitchService } from '../../compute-controls/operational-switch.service';
import { resolveComputeControlsConfig } from '../../compute-controls/compute-controls.config';
import {
  dayBucket,
  GLOBAL_DAY_SCOPE,
  GLOBAL_HOUR_SCOPE,
  GLOBAL_SCOPE,
  hourBucket,
} from '../../compute-controls/compute-scopes';
import { AdminAskIntelligenceService } from './admin-ask-intelligence.service';

/**
 * STANDALONE PUBLIC BETA CONVERGENCE R1 — F × METER P1. Admin budget saturation reads the
 * split meter keys: the hourly alert from `global:hour`, the daily alert from `global:day`.
 * A legacy shared 'global' row (what F read before P1) is present as a decoy with a huge
 * value, at the SAME bucket, inside the old 00:xx collision window: if either alert read it,
 * the ratio would be enormous. It must not move either figure.
 */
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('Admin Ask Intelligence live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

live('F × Meter P1 — Admin hour/day saturation reads global:hour / global:day', () => {
  let db: PrismaClient;
  let reader: AdminAskIntelligenceService;
  const NOW = new Date('2031-01-01T00:30:00Z'); // hourBucket === dayBucket here
  const HOUR_UNITS = 1234;
  const DAY_UNITS = 5678;
  const knobs = resolveComputeControlsConfig(() => undefined);
  const scopes = [GLOBAL_HOUR_SCOPE, GLOBAL_DAY_SCOPE, GLOBAL_SCOPE];

  const switches = {
    state: jest.fn(async (name: string) => ({
      name,
      deploymentValueIsLiteralTrue: true,
      row: { enabled: true, setBy: 'operator', setAt: new Date(), reason: null },
      effective: true,
      readable: true,
    })),
  } as unknown as OperationalSwitchService;
  const alert = async (id: string) =>
    (await reader.askIntelligence(NOW)).alerts?.alerts.find((a) => a.id === id);

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    reader = new AdminAskIntelligenceService(db as unknown as PrismaService, switches, {
      get: () => undefined,
    } as unknown as ConfigService);
  });
  beforeEach(async () => {
    await db.computeMeter.deleteMany({ where: { scope: { in: scopes } } });
  });
  afterAll(async () => {
    await db.computeMeter.deleteMany({ where: { scope: { in: scopes } } });
    await db.$disconnect();
  });

  it('non-zero hour and day saturation come from the new keys, and the legacy row is ignored', async () => {
    expect(hourBucket(NOW).getTime()).toBe(dayBucket(NOW).getTime());
    await db.computeMeter.createMany({
      data: [
        { scope: GLOBAL_HOUR_SCOPE, bucketStart: hourBucket(NOW), units: BigInt(HOUR_UNITS) },
        { scope: GLOBAL_DAY_SCOPE, bucketStart: dayBucket(NOW), units: BigInt(DAY_UNITS) },
        { scope: GLOBAL_SCOPE, bucketStart: hourBucket(NOW), units: 999_999_999n }, // decoy
      ],
    });
    const hour = await alert('BUDGET_SATURATION_HOUR');
    const day = await alert('BUDGET_SATURATION_DAY');
    expect(hour?.observed).toBeCloseTo(HOUR_UNITS / knobs.globalUnitsPerHour, 10);
    expect(day?.observed).toBeCloseTo(DAY_UNITS / knobs.globalUnitsPerDay, 10);
    expect(hour?.observed).toBeGreaterThan(0);
    expect(day?.observed).toBeGreaterThan(0);
  });

  it('with ONLY a legacy "global" row present, Admin saturation is zero — it does not depend on the legacy key', async () => {
    await db.computeMeter.create({
      data: { scope: GLOBAL_SCOPE, bucketStart: hourBucket(NOW), units: 999_999_999n },
    });
    expect((await alert('BUDGET_SATURATION_HOUR'))?.observed).toBe(0);
    expect((await alert('BUDGET_SATURATION_DAY'))?.observed).toBe(0);
  });
});
