import { UnprocessableEntityException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { UsersService } from './users.service';
import type { PrismaService } from '../../database/prisma.service';
import type { TelemetryService } from '../telemetry/telemetry.service';

/**
 * REASON TO RETURN R1 · §7 / G6 — the reader's saved name is the ONLY source of a display name.
 */
describe('REASON TO RETURN R1 · G6 — saved display name', () => {
  const noTelemetry = { recordAccountEvent: () => Promise.resolve() } as unknown as TelemetryService;
  const setup = () => {
    const update = jest.fn().mockImplementation(async ({ data }) => ({
      id: 'u1',
      email: 'anna.k@example.com',
      displayName: data.displayName,
      createdAt: new Date(0),
    }));
    const prisma = { user: { update } } as unknown as PrismaService;
    return { update, service: new UsersService(prisma, noTelemetry) };
  };

  it('stores the normalised name for exactly the signed-in user', async () => {
    const { update, service } = setup();
    const out = await service.updateDisplayName('u1', '  Anna   Kowalska ');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: { displayName: 'Anna Kowalska' } }),
    );
    expect(out.displayName).toBe('Anna Kowalska');
  });

  it('empty or null clears it (neutral fallback)', async () => {
    const { update, service } = setup();
    await service.updateDisplayName('u1', '   ');
    await service.updateDisplayName('u1', null);
    expect(update.mock.calls.map((c) => c[0].data.displayName)).toEqual([null, null]);
  });

  it('refuses an email or markup with a coded 422 and writes nothing', async () => {
    const { update, service } = setup();
    for (const bad of ['anna@example.com', '<script>x</script>']) {
      await expect(service.updateDisplayName('u1', bad)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    }
    expect(update).not.toHaveBeenCalled();
  });

  it('sign-in never writes displayName and nothing derives a name from the email', () => {
    const auth = readFileSync(join(__dirname, '..', 'auth', 'auth.service.ts'), 'utf8');
    expect(auth).not.toMatch(/displayName\s*:/);
    expect(auth).not.toMatch(/email\.split\(['"]@['"]\)/);
  });
});
