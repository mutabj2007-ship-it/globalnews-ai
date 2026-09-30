import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { AuthModule } from '../../auth/auth.module';
import { AuthService } from '../../auth/auth.service';
import { GuestCoreModule } from './guest-core.module';

/**
 * ASK GUEST TRIAL R3 — AuthModule is byte-identical to the release and does NOT import the
 * guest core. When the app loads Ask V2 (which imports the GLOBAL GuestCoreModule), AuthService
 * receives the guest services through @Optional(); in an isolated auth/admin module it gets
 * none and behaves exactly as landed (no real Prisma client is pulled in).
 */
const stubPrisma = {} as PrismaService;

/* As in the app, PrismaService comes from a GLOBAL module (here a stub, as in admin.guard.spec). */
@Global()
@Module({ providers: [{ provide: PrismaService, useValue: stubPrisma }], exports: [PrismaService] })
class StubPrismaModule {}

describe('ASK GUEST TRIAL R3 — guest core wiring', () => {
  it('with Ask V2 loaded, AuthService can transfer a claimed guest conversation', async () => {
    const ref = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true }), GuestCoreModule, AuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue(stubPrisma)
      .compile();
    const auth = ref.get(AuthService) as unknown as {
      guestClaims?: unknown;
      guestSessions?: unknown;
    };
    expect(auth.guestClaims).toBeDefined();
    expect(auth.guestSessions).toBeDefined();
  });

  it('in isolation, AuthModule pulls in no guest service and no extra module', async () => {
    const ref = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true }), StubPrismaModule, AuthModule],
    }).compile();
    const auth = ref.get(AuthService) as unknown as { guestClaims?: unknown };
    expect(auth.guestClaims).toBeUndefined();
  });
});
