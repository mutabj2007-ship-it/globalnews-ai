import { Global, INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AdminModule } from './admin.module';
import { PrismaService } from '../../database/prisma.service';
import { SESSION_COOKIE_NAME } from '../auth/cookie.util';
import { hashSessionToken } from '../auth/session-token.util';
import { ADMIN_PLATFORM_ENABLED_ENV } from './admin-platform.config';
import { capabilitiesFor } from './rbac/capabilities';

/**
 * F1.a — THE CENTRAL SECURITY TEST.
 *
 * Real AdminModule, real AuthModule, real RequireAuthGuard, real
 * AdminGuard, real HTTP status codes through a real Nest application.
 * Only PrismaService is replaced, by an in-memory stub — no database
 * is required and none is contacted.
 *
 * ADMIN_ROUTES is the table every denial case iterates. A new admin
 * route added without an entry here is caught by admin.contract.spec.ts,
 * which asserts the controller exposes nothing beyond this list.
 */
const ADMIN_ROUTES: ReadonlyArray<{ method: 'get'; path: string }> = [
  { method: 'get', path: '/admin/me' },
];

const ORDINARY_TOKEN = 'raw-token-ordinary-user';
const SUPER_TOKEN = 'raw-token-super-admin';
const ADMIN_TOKEN = 'raw-token-admin';
const SUPPORT_TOKEN = 'raw-token-support';
const ANALYST_TOKEN = 'raw-token-analyst';
const GHOST_TOKEN = 'raw-token-user-deleted-mid-session';
const EXPIRED_SUPER_TOKEN = 'raw-token-expired-super-admin';

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);
const PAST = new Date(Date.now() - 60 * 1000);

interface StubSession {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
}

const SESSIONS: StubSession[] = [
  {
    id: 's1',
    tokenHash: hashSessionToken(ORDINARY_TOKEN),
    userId: 'u-ordinary',
    expiresAt: FUTURE,
  },
  { id: 's2', tokenHash: hashSessionToken(SUPER_TOKEN), userId: 'u-super', expiresAt: FUTURE },
  { id: 's3', tokenHash: hashSessionToken(ADMIN_TOKEN), userId: 'u-admin', expiresAt: FUTURE },
  { id: 's4', tokenHash: hashSessionToken(SUPPORT_TOKEN), userId: 'u-support', expiresAt: FUTURE },
  { id: 's5', tokenHash: hashSessionToken(ANALYST_TOKEN), userId: 'u-analyst', expiresAt: FUTURE },
  { id: 's6', tokenHash: hashSessionToken(GHOST_TOKEN), userId: 'u-deleted', expiresAt: FUTURE },
  {
    id: 's7',
    tokenHash: hashSessionToken(EXPIRED_SUPER_TOKEN),
    userId: 'u-super',
    expiresAt: PAST,
  },
];

const USERS: ReadonlyArray<{ id: string; adminRole: string | null }> = [
  { id: 'u-ordinary', adminRole: null },
  { id: 'u-super', adminRole: 'SUPER_ADMIN' },
  { id: 'u-admin', adminRole: 'ADMIN' },
  { id: 'u-support', adminRole: 'SUPPORT' },
  { id: 'u-analyst', adminRole: 'ANALYST' },
  // 'u-deleted' deliberately absent — a valid session whose user row is gone.
];

const stubPrisma = {
  session: {
    findUnique: ({ where }: { where: { tokenHash: string } }) =>
      Promise.resolve(SESSIONS.find((s) => s.tokenHash === where.tokenHash) ?? null),
    delete: () => Promise.resolve(undefined),
    deleteMany: () => Promise.resolve({ count: 0 }),
  },
  user: {
    findUnique: ({ where }: { where: { id: string } }) => {
      const user = USERS.find((u) => u.id === where.id);
      return Promise.resolve(user ? { adminRole: user.adminRole } : null);
    },
  },
};

@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: stubPrisma }],
  exports: [PrismaService],
})
class StubPrismaModule {}

async function createApp(adminPlatformEnabled: string | undefined): Promise<INestApplication> {
  if (adminPlatformEnabled === undefined) {
    delete process.env[ADMIN_PLATFORM_ENABLED_ENV];
  } else {
    process.env[ADMIN_PLATFORM_ENABLED_ENV] = adminPlatformEnabled;
  }

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: false, ignoreEnvFile: true }),
      StubPrismaModule,
      AdminModule,
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  await app.init();
  return app;
}

function withSession(agent: request.Test, rawToken: string): request.Test {
  return agent.set('Cookie', [`${SESSION_COOKIE_NAME}=${rawToken}`]);
}

describe('admin API security boundary', () => {
  const originalFlag = process.env[ADMIN_PLATFORM_ENABLED_ENV];

  afterAll(() => {
    if (originalFlag === undefined) {
      delete process.env[ADMIN_PLATFORM_ENABLED_ENV];
    } else {
      process.env[ADMIN_PLATFORM_ENABLED_ENV] = originalFlag;
    }
  });

  describe('ADMIN_PLATFORM_ENABLED is on', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createApp('true');
    });

    afterAll(async () => {
      await app.close();
    });

    describe('unauthenticated caller', () => {
      ADMIN_ROUTES.forEach(({ method, path }) => {
        it(`${method.toUpperCase()} ${path} -> 401`, async () => {
          await request(app.getHttpServer())[method](path).expect(401);
        });
      });

      it('an unrecognised session cookie is also 401, never 403', async () => {
        await withSession(
          request(app.getHttpServer()).get('/admin/me'),
          'a-token-that-was-never-issued',
        ).expect(401);
      });
    });

    describe('ORDINARY AUTHENTICATED USER — the case this milestone exists to refuse', () => {
      ADMIN_ROUTES.forEach(({ method, path }) => {
        it(`signed-in user with adminRole = null: ${method.toUpperCase()} ${path} -> 403`, async () => {
          await withSession(request(app.getHttpServer())[method](path), ORDINARY_TOKEN).expect(403);
        });
      });

      it('the 403 body leaks no role, capability, user id or resource detail', async () => {
        const response = await withSession(
          request(app.getHttpServer()).get('/admin/me'),
          ORDINARY_TOKEN,
        ).expect(403);

        expect(response.body).toEqual({ statusCode: 403, message: 'Forbidden' });

        const serialised = JSON.stringify(response.body);
        [
          'SUPER_ADMIN',
          'ADMIN',
          'SUPPORT',
          'ANALYST',
          'adminRole',
          'capabilit',
          'u-ordinary',
        ].forEach((needle) => {
          expect(serialised).not.toContain(needle);
        });
      });
    });

    describe('authentication is resolved BEFORE authorization', () => {
      it('an EXPIRED session belonging to a SUPER_ADMIN returns 401, never 403 — the status code never reveals that the account was privileged', async () => {
        await withSession(
          request(app.getHttpServer()).get('/admin/me'),
          EXPIRED_SUPER_TOKEN,
        ).expect(401);
      });
    });

    describe('a valid session whose user row no longer exists', () => {
      it('is refused with 403 and does not crash', async () => {
        await withSession(request(app.getHttpServer()).get('/admin/me'), GHOST_TOKEN).expect(403);
      });
    });

    describe('administrators', () => {
      const cases: ReadonlyArray<[string, string]> = [
        [SUPER_TOKEN, 'SUPER_ADMIN'],
        [ADMIN_TOKEN, 'ADMIN'],
        [SUPPORT_TOKEN, 'SUPPORT'],
        [ANALYST_TOKEN, 'ANALYST'],
      ];

      cases.forEach(([token, role]) => {
        it(`${role} may read GET /admin/me and receives the server-derived capability list`, async () => {
          const response = await withSession(
            request(app.getHttpServer()).get('/admin/me'),
            token,
          ).expect(200);

          expect(response.body.role).toBe(role);
          expect(response.body.adminId).toBe(USERS.find((u) => u.adminRole === role)?.id);
          expect(response.body.capabilities).toEqual([
            ...capabilitiesFor(role as 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'ANALYST'),
          ]);
        });
      });

      it('SUPPORT does not receive evidence.export, and ANALYST does — the approved matrix, over the wire', async () => {
        const support = await withSession(
          request(app.getHttpServer()).get('/admin/me'),
          SUPPORT_TOKEN,
        ).expect(200);
        const analyst = await withSession(
          request(app.getHttpServer()).get('/admin/me'),
          ANALYST_TOKEN,
        ).expect(200);

        expect(support.body.capabilities).not.toContain('evidence.export');
        expect(analyst.body.capabilities).toContain('evidence.export');
      });
    });
  });

  describe('ADMIN_PLATFORM_ENABLED is off (fail-closed default)', () => {
    let app: INestApplication;

    afterEach(async () => {
      await app.close();
    });

    it('an unset flag makes every admin route 404 — for an administrator', async () => {
      app = await createApp(undefined);
      await withSession(request(app.getHttpServer()).get('/admin/me'), SUPER_TOKEN).expect(404);
    });

    it('an unset flag makes every admin route 404 — for an unauthenticated caller, so "disabled" means absent and not merely locked', async () => {
      app = await createApp(undefined);
      await request(app.getHttpServer()).get('/admin/me').expect(404);
    });

    it('a non-"true" value is also off', async () => {
      app = await createApp('1');
      await withSession(request(app.getHttpServer()).get('/admin/me'), SUPER_TOKEN).expect(404);
    });
  });
});
