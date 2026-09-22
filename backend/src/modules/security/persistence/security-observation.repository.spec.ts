import { SecurityObservationRepository } from './security-observation.repository';
import { PrismaService } from '../../../database/prisma.service';
function harness(run: unknown = null) {
  const findFirst = jest.fn().mockResolvedValue(run);
  const prisma = {
    securityProjectionRun: { findFirst, create: jest.fn() },
    $transaction: jest.fn(),
  };
  return {
    prisma,
    findFirst,
    repo: new SecurityObservationRepository(prisma as unknown as PrismaService),
  };
}
const emptyRun = {
  id: 2,
  geographyId: 'RW',
  maxAgeMinutes: 1440,
  startedAt: new Date(),
  completion: { status: 'NO_RESULTS' },
  members: [],
};
describe('R2 retained read', () => {
  test('no production is unavailable, never NO_RESULTS', async () => {
    const h = harness();
    expect((await h.repo.findByGeography({ geographyId: 'RW' })).succeeded).toBe(false);
  });
  test('unfinished latest attempt does not fall back to an earlier success', async () => {
    const h = harness({ ...emptyRun, completion: null });
    expect((await h.repo.findByGeography({ geographyId: 'RW' })).succeeded).toBe(false);
    expect(h.findFirst).toHaveBeenCalledTimes(1);
  });
  test('failed latest attempt does not fall back', async () => {
    const h = harness({ ...emptyRun, completion: { status: 'SOURCE_UNAVAILABLE' } });
    expect((await h.repo.findByGeography({ geographyId: 'RW' })).succeeded).toBe(false);
  });
  test('only a completed empty projection is NO_RESULTS', async () => {
    const h = harness(emptyRun);
    expect(await h.repo.findByGeography({ geographyId: 'RW' })).toEqual({
      succeeded: true,
      status: 'NO_RESULTS',
      observations: [],
    });
  });
  test('expired projection cannot establish present coverage', async () => {
    const h = harness({ ...emptyRun, startedAt: new Date(0) });
    expect((await h.repo.findByGeography({ geographyId: 'RW' })).succeeded).toBe(false);
  });
  test('narrow projection cannot answer a broader age window', async () => {
    const h = harness(emptyRun);
    expect(
      (await h.repo.findByGeography({ geographyId: 'RW', maxAgeMinutes: 43200 })).succeeded,
    ).toBe(false);
  });
  test('database rejection remains unavailable', async () => {
    const h = harness();
    h.findFirst.mockRejectedValue(new Error('offline'));
    expect((await h.repo.findByGeography({ geographyId: 'RW' })).succeeded).toBe(false);
  });
  test('read never invokes transaction or create', async () => {
    const h = harness(emptyRun);
    await h.repo.findByGeography({ geographyId: 'RW' });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.prisma.securityProjectionRun.create).not.toHaveBeenCalled();
  });
  test('read selects the newest attempt, not newest successful attempt', async () => {
    const h = harness(emptyRun);
    await h.repo.findByGeography({ geographyId: 'rw' });
    expect(h.findFirst.mock.calls[0][0].where).toEqual({ geographyId: 'RW' });
    expect(h.findFirst.mock.calls[0][0].orderBy).toEqual({ id: 'desc' });
  });
  test('malformed persisted evidence cannot reach a consumer', async () => {
    const h = harness({
      ...emptyRun,
      completion: { status: 'OK' },
      members: [{ observation: { payload: {} } }],
    });
    expect((await h.repo.findByGeography({ geographyId: 'RW' })).succeeded).toBe(false);
  });
  test('failed transaction is not success', async () => {
    const h = harness();
    h.prisma.$transaction.mockRejectedValue(new Error('write failed'));
    expect(
      await h.repo.completeRun({ id: 1, geographyId: 'RW', maxAgeMinutes: 1440 }, [], 'NO_RESULTS'),
    ).toBe(false);
  });
  test('OK with no observations is rejected before any write', async () => {
    const h = harness();
    expect(
      await h.repo.completeRun({ id: 1, geographyId: 'RW', maxAgeMinutes: 1440 }, [], 'OK'),
    ).toBe(false);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });
});
