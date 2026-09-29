import { Global, INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AdminModule } from '../admin.module';
import { PrismaService } from '../../../database/prisma.service';
import { resolveAuthCookieNames } from '../../auth/cookie.util';
import { hashSessionToken } from '../../auth/session-token.util';
import { ADMIN_PLATFORM_ENABLED_ENV } from '../admin-platform.config';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK PUBLIC BETA OPERATIONS R1 — THE SECURITY BOUNDARY, OVER REAL HTTP
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Real AdminModule, real AuthModule, real RequireAuthGuard, real AdminGuard, real status
 * codes through a real Nest application. Only PrismaService is replaced, by an in-memory
 * stub: no database is required and none is contacted.
 *
 * THE NEGATIVE CASES ARE THE POINT. A new admin route inherits nothing by being written
 * carefully; it inherits it by being behind the same three guards, and the only way to know
 * it is behind them is to ask it while signed out, while signed in as an ordinary reader,
 * and while the platform is switched off.
 *
 * NO ADDRESS LITERAL APPEARS IN THIS FILE. `admin.contract.spec.ts` scans every source file
 * under `modules/admin` — specs included — and fails on anything shaped like an email
 * address. The stub identifies accounts by opaque id, which is all the guard chain reads.
 */
const ROUTE = '/admin/ai/ask-intelligence';

const ORDINARY_TOKEN = 'raw-token-ordinary-reader';
const ANALYST_TOKEN = 'raw-token-analyst';
const SUPPORT_TOKEN = 'raw-token-support';
const SUPER_TOKEN = 'raw-token-super-admin';
const EXPIRED_TOKEN = 'raw-token-expired-super-admin';
const GHOST_TOKEN = 'raw-token-user-row-removed';

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);
const PAST = new Date(Date.now() - 60 * 1000);

const SESSIONS = [
  {
    id: 's1',
    tokenHash: hashSessionToken(ORDINARY_TOKEN),
    userId: 'u-ordinary',
    expiresAt: FUTURE,
  },
  { id: 's2', tokenHash: hashSessionToken(ANALYST_TOKEN), userId: 'u-analyst', expiresAt: FUTURE },
  { id: 's3', tokenHash: hashSessionToken(SUPPORT_TOKEN), userId: 'u-support', expiresAt: FUTURE },
  { id: 's4', tokenHash: hashSessionToken(SUPER_TOKEN), userId: 'u-super', expiresAt: FUTURE },
  { id: 's5', tokenHash: hashSessionToken(EXPIRED_TOKEN), userId: 'u-super', expiresAt: PAST },
  { id: 's6', tokenHash: hashSessionToken(GHOST_TOKEN), userId: 'u-removed', expiresAt: FUTURE },
];

const USERS: ReadonlyArray<{ id: string; adminRole: string | null }> = [
  { id: 'u-ordinary', adminRole: null },
  { id: 'u-analyst', adminRole: 'ANALYST' },
  { id: 'u-support', adminRole: 'SUPPORT' },
  { id: 'u-super', adminRole: 'SUPER_ADMIN' },
  /* 'u-removed' deliberately absent — a valid session whose account row is gone. */
];

const empty = async (): Promise<unknown[]> => [];
const zero = async (): Promise<number> => 0;

const stubPrisma = {
  $queryRaw: async () => [{ probe: 1 }],
  session: {
    findUnique: async ({ where }: { where: { tokenHash: string } }) =>
      SESSIONS.find((session) => session.tokenHash === where.tokenHash) ?? null,
    delete: async () => undefined,
    deleteMany: async () => ({ count: 0 }),
  },
  user: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const user = USERS.find((candidate) => candidate.id === where.id);
      return user ? { adminRole: user.adminRole } : null;
    },
  },
  askObservation: {
    count: zero,
    groupBy: empty,
    findMany: empty,
    aggregate: async () => ({
      _count: { latencyMs: 0, promptTokens: 0, reportingItemCount: 0 },
      _avg: { latencyMs: null, reportingItemCount: null },
      _min: { latencyMs: null, reportingItemCount: null },
      _max: { latencyMs: null, reportingItemCount: null },
      _sum: {
        promptTokens: null,
        completionTokens: null,
        modelInvocationCount: null,
        providerCallCount: null,
      },
    }),
  },
  askAccessCounter: { findMany: empty },
  computeOperation: { count: zero },
  computeMeter: { findMany: empty },
  circuitBreakerState: { findMany: empty },
  operationalSwitch: { findUnique: async () => null },
};

@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: stubPrisma }],
  exports: [PrismaService],
})
class StubPrismaModule {}

async function createApp(adminPlatformEnabled: string | undefined): Promise<INestApplication> {
  if (adminPlatformEnabled === undefined) delete process.env[ADMIN_PLATFORM_ENABLED_ENV];
  else process.env[ADMIN_PLATFORM_ENABLED_ENV] = adminPlatformEnabled;

  /*
    THE STUB IS INSTALLED WITH `overrideProvider`, NOT ONLY AS A GLOBAL MODULE, AND THAT
    DIFFERENCE IS LOAD-BEARING. `AuthModule` imports `PrismaModule` itself, and a
    module-scoped provider beats a @Global() one — so a suite that supplies the stub only
    through a global module silently resolves the REAL PrismaService, connects to whatever
    `DATABASE_URL` points at, finds no session there and answers 401 to every request. An
    override is applied to the whole graph and cannot be shadowed that way.
  */
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: false, ignoreEnvFile: true }),
      StubPrismaModule,
      AdminModule,
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(stubPrisma)
    .compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  await app.init();
  return app;
}

/** The cookie name THIS process resolves, rather than the constant behind it. */
const sessionCookie = (rawToken: string): string =>
  `${resolveAuthCookieNames().session}=${rawToken}`;

describe('R1 — Ask Intelligence is behind the admin guard chain', () => {
  const originalFlag = process.env[ADMIN_PLATFORM_ENABLED_ENV];

  afterAll(() => {
    if (originalFlag === undefined) delete process.env[ADMIN_PLATFORM_ENABLED_ENV];
    else process.env[ADMIN_PLATFORM_ENABLED_ENV] = originalFlag;
  });

  describe('the admin platform is on', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await createApp('true');
    });
    afterAll(async () => {
      await app.close();
    });

    it('an unauthenticated caller is refused with 401 and receives no payload', async () => {
      const response = await request(app.getHttpServer()).get(ROUTE).expect(401);
      expect(response.body).not.toHaveProperty('health');
      expect(response.body).not.toHaveProperty('alerts');
    });

    it('an unrecognised session cookie is also 401, never 403', async () => {
      await request(app.getHttpServer())
        .get(ROUTE)
        .set('Cookie', [sessionCookie('raw-token-not-issued-by-anyone')])
        .expect(401);
    });

    it('AN ORDINARY SIGNED-IN READER IS REFUSED WITH 403 — the case this route exists behind', async () => {
      const response = await request(app.getHttpServer())
        .get(ROUTE)
        .set('Cookie', [sessionCookie(ORDINARY_TOKEN)])
        .expect(403);

      /* The body leaks no role, no capability and no resource detail. */
      expect(response.body).toEqual({ statusCode: 403, message: 'Forbidden' });
    });

    it('an EXPIRED session belonging to a SUPER_ADMIN is 401, never 403 — the code never reveals privilege', async () => {
      await request(app.getHttpServer())
        .get(ROUTE)
        .set('Cookie', [sessionCookie(EXPIRED_TOKEN)])
        .expect(401);
    });

    it('a valid session whose account row is gone is refused with 403 and does not crash', async () => {
      await request(app.getHttpServer())
        .get(ROUTE)
        .set('Cookie', [sessionCookie(GHOST_TOKEN)])
        .expect(403);
    });

    it.each([
      ['ANALYST', ANALYST_TOKEN],
      ['SUPPORT', SUPPORT_TOKEN],
      ['SUPER_ADMIN', SUPER_TOKEN],
    ])('%s holds analytics.view and may read the page', async (_role, token) => {
      const response = await request(app.getHttpServer())
        .get(ROUTE)
        .set('Cookie', [sessionCookie(token)])
        .expect(200);

      expect(response.body).toHaveProperty('health');
      expect(response.body).toHaveProperty('alerts');
      expect(response.body.disclosures.readOnly).toBe(true);
    });

    it('THE PAYLOAD CANNOT IDENTIFY A READER, AND CARRIES NO QUESTION', async () => {
      const response = await request(app.getHttpServer())
        .get(ROUTE)
        .set('Cookie', [sessionCookie(SUPER_TOKEN)])
        .expect(200);

      const serialised = JSON.stringify(response.body).toLowerCase();
      [
        '"question"',
        '"prompt"',
        '"query"',
        '"userid"',
        '"accountid"',
        '"operationid"',
        '"fingerprint"',
        '"setby"',
        'u-ordinary',
        'u-super',
        'u-analyst',
      ].forEach((forbidden) => {
        expect({ forbidden, present: serialised.includes(forbidden) }).toEqual({
          forbidden,
          present: false,
        });
      });
    });

    it('POSITIVE CONTROL — the same scan DOES find an identifier when one is present', () => {
      /* Without this, the sweep above could pass because the payload was empty or the
         needles were misspelled. */
      const contaminated = JSON.stringify({
        userId: 'u-super',
        question: 'what is X',
      }).toLowerCase();
      expect(contaminated.includes('"userid"')).toBe(true);
      expect(contaminated.includes('u-super')).toBe(true);
    });

    it('it is a READ — the route rejects every mutating verb', async () => {
      const agent = request(app.getHttpServer());
      await agent
        .post(ROUTE)
        .set('Cookie', [sessionCookie(SUPER_TOKEN)])
        .expect(404);
      await agent
        .put(ROUTE)
        .set('Cookie', [sessionCookie(SUPER_TOKEN)])
        .expect(404);
      await agent
        .patch(ROUTE)
        .set('Cookie', [sessionCookie(SUPER_TOKEN)])
        .expect(404);
      await agent
        .delete(ROUTE)
        .set('Cookie', [sessionCookie(SUPER_TOKEN)])
        .expect(404);
    });
  });

  describe('the admin platform is off — the fail-closed default', () => {
    it('an unset flag makes the route 404 for a SUPER_ADMIN, so disabled means absent', async () => {
      const app = await createApp(undefined);
      await request(app.getHttpServer())
        .get(ROUTE)
        .set('Cookie', [sessionCookie(SUPER_TOKEN)])
        .expect(404);
      await app.close();
    });

    it('and 404 for an unauthenticated caller too — not 401, which would confirm it exists', async () => {
      const app = await createApp(undefined);
      await request(app.getHttpServer()).get(ROUTE).expect(404);
      await app.close();
    });

    it('a value that is not the word true is also off', async () => {
      /*
        `'1'`, NOT `'TRUE'`. The landed parser is deliberately case-insensitive and
        whitespace-trimming — its own docblock says so — so `'TRUE'` is ON, and a test that
        expected it to be off would be asserting the opposite of the shipped contract. The
        values that are genuinely refused are the permissive spellings: `1`, `yes`, `on`.
      */
      const app = await createApp('1');
      await request(app.getHttpServer())
        .get(ROUTE)
        .set('Cookie', [sessionCookie(SUPER_TOKEN)])
        .expect(404);
      await app.close();
    });

    it('and the case-insensitive spelling IS accepted, which is the landed contract', async () => {
      const app = await createApp('TRUE');
      await request(app.getHttpServer())
        .get(ROUTE)
        .set('Cookie', [sessionCookie(SUPER_TOKEN)])
        .expect(200);
      await app.close();
    });
  });
});
