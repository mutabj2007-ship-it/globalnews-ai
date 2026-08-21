import { Controller, Get, Global, INestApplication, Module, UseGuards } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { PrismaService } from '../../database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { SESSION_COOKIE_NAME } from '../auth/cookie.util';
import { hashSessionToken } from '../auth/session-token.util';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { CAPABILITIES } from './rbac/capabilities';
import { AdminOnly, RequireCapability } from './rbac/require-capability.decorator';

/**
 * F1.a — capability enforcement, proven end-to-end through the real
 * NestJS container and real HTTP status codes.
 *
 * The controller below is a TEST-ONLY stand-in, the same technique
 * src/security/rate-limit.e2e-spec.ts uses for the throttler. F1.a
 * ships exactly one real admin route (GET /admin/me), so a shipped
 * route per capability would be surface with no purpose. This proves
 * the MECHANISM against real DI without inventing endpoints.
 *
 * `unannotated()` is the important one: it carries AdminGuard and NO
 * capability metadata, standing in for a route where a future
 * contributor forgets the decorator. It must be denied.
 */
@Controller('probe-admin')
@UseGuards(RequireAuthGuard, AdminGuard)
class ProbeAdminController {
  @Get('any')
  @AdminOnly()
  any(): string {
    return 'ok';
  }

  @Get('tax')
  @RequireCapability(CAPABILITIES.TaxSettings)
  tax(): string {
    return 'ok';
  }

  @Get('export')
  @RequireCapability(CAPABILITIES.EvidenceExport)
  exportEvidence(): string {
    return 'ok';
  }

  @Get('support')
  @RequireCapability(CAPABILITIES.SupportHandle)
  support(): string {
    return 'ok';
  }

  @Get('two')
  @RequireCapability(CAPABILITIES.NewsManage, CAPABILITIES.ProviderConfigure)
  two(): string {
    return 'ok';
  }

  @Get('unannotated')
  unannotated(): string {
    return 'ok';
  }
}

const TOKENS: Record<string, string> = {
  SUPER_ADMIN: 'probe-super',
  ADMIN: 'probe-admin',
  SUPPORT: 'probe-support',
  ANALYST: 'probe-analyst',
  NONE: 'probe-none',
};

const USER_IDS: Record<string, string> = {
  SUPER_ADMIN: 'p-super',
  ADMIN: 'p-admin',
  SUPPORT: 'p-support',
  ANALYST: 'p-analyst',
  NONE: 'p-none',
};

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);

const stubPrisma = {
  session: {
    findUnique: ({ where }: { where: { tokenHash: string } }) => {
      const entry = Object.entries(TOKENS).find(
        ([, token]) => hashSessionToken(token) === where.tokenHash,
      );
      return Promise.resolve(
        entry
          ? {
              id: `s-${entry[0]}`,
              tokenHash: where.tokenHash,
              userId: USER_IDS[entry[0]],
              expiresAt: FUTURE,
            }
          : null,
      );
    },
    delete: () => Promise.resolve(undefined),
    deleteMany: () => Promise.resolve({ count: 0 }),
  },
  user: {
    findUnique: ({ where }: { where: { id: string } }) => {
      const roleEntry = Object.entries(USER_IDS).find(([, id]) => id === where.id);
      if (!roleEntry) return Promise.resolve(null);
      const role = roleEntry[0];
      return Promise.resolve({ adminRole: role === 'NONE' ? null : role });
    },
  },
};

@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: stubPrisma }],
  exports: [PrismaService],
})
class StubPrismaModule {}

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [ProbeAdminController],
  providers: [AdminService, AdminGuard],
})
class ProbeAdminModule {}

describe('AdminGuard — capability enforcement', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: false, ignoreEnvFile: true }),
        StubPrismaModule,
        ProbeAdminModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const call = (path: string, role: keyof typeof TOKENS | null) => {
    const agent = request(app.getHttpServer()).get(path);
    return role === null ? agent : agent.set('Cookie', [`${SESSION_COOKIE_NAME}=${TOKENS[role]}`]);
  };

  it('FAIL-CLOSED: a route under AdminGuard with NO capability metadata is denied even for SUPER_ADMIN', async () => {
    await call('/probe-admin/unannotated', 'SUPER_ADMIN').expect(403);
    await call('/probe-admin/unannotated', 'ADMIN').expect(403);
  });

  it('AdminOnly() admits every role and refuses a non-administrator', async () => {
    await call('/probe-admin/any', 'SUPER_ADMIN').expect(200);
    await call('/probe-admin/any', 'ADMIN').expect(200);
    await call('/probe-admin/any', 'SUPPORT').expect(200);
    await call('/probe-admin/any', 'ANALYST').expect(200);
    await call('/probe-admin/any', 'NONE').expect(403);
    await call('/probe-admin/any', null).expect(401);
  });

  it('tax.settings is SUPER_ADMIN only', async () => {
    await call('/probe-admin/tax', 'SUPER_ADMIN').expect(200);
    await call('/probe-admin/tax', 'ADMIN').expect(403);
    await call('/probe-admin/tax', 'SUPPORT').expect(403);
    await call('/probe-admin/tax', 'ANALYST').expect(403);
  });

  it('evidence.export follows the approved matrix — ANALYST allowed, SUPPORT denied', async () => {
    await call('/probe-admin/export', 'SUPER_ADMIN').expect(200);
    await call('/probe-admin/export', 'ADMIN').expect(200);
    await call('/probe-admin/export', 'ANALYST').expect(200);
    await call('/probe-admin/export', 'SUPPORT').expect(403);
  });

  it('support.handle admits SUPPORT and refuses ANALYST', async () => {
    await call('/probe-admin/support', 'SUPPORT').expect(200);
    await call('/probe-admin/support', 'ANALYST').expect(403);
  });

  it('a route requiring TWO capabilities needs BOTH — ADMIN holds news.manage but not provider.configure', async () => {
    await call('/probe-admin/two', 'SUPER_ADMIN').expect(200);
    await call('/probe-admin/two', 'ADMIN').expect(403);
  });

  it('a denied administrator and a denied ordinary user receive byte-identical bodies', async () => {
    const deniedAdmin = await call('/probe-admin/tax', 'SUPPORT').expect(403);
    const deniedUser = await call('/probe-admin/tax', 'NONE').expect(403);

    expect(deniedAdmin.body).toEqual(deniedUser.body);
    expect(deniedAdmin.body).toEqual({ statusCode: 403, message: 'Forbidden' });
  });
});
