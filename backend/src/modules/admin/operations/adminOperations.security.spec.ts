import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AdminModule } from '../admin.module';
import { PrismaService } from '../../../database/prisma.service';
import { resolveAuthCookieNames } from '../../auth/cookie.util';
import { hashSessionToken } from '../../auth/session-token.util';
import { ADMIN_PLATFORM_ENABLED_ENV } from '../admin-platform.config';
import { DEPLOYMENT_ENVIRONMENT_VAR } from './deployment-environment';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADMIN OPERATIONS R1 — AUTHORIZATION ON THE ONLY ADMIN WRITE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The proposition this suite exists for: SEEING the switches and CHANGING one
 * are different privileges. Every admin role holds `analytics.view`, so if the
 * write reused it an ANALYST could stop new AI answers for every reader. Each
 * refusal below is asserted together with the switch store being untouched —
 * a 403 that still wrote the row would pass a status-code-only test.
 */

const STATE = '/admin/operations';
const SET = '/admin/operations/switches/ASK_PUBLIC_COMPUTE_ENABLED';

const ORDINARY = 'raw-ordinary';
const ANALYST = 'raw-analyst';
const SUPPORT = 'raw-support';
const ADMIN = 'raw-admin';
const SUPER = 'raw-super';
const EXPIRED = 'raw-expired-super';

const FUTURE = new Date(Date.now() + 3_600_000);
const PAST = new Date(Date.now() - 60_000);

const SESSIONS = [
  { id: 's1', tokenHash: hashSessionToken(ORDINARY), userId: 'u-ordinary', expiresAt: FUTURE },
  { id: 's2', tokenHash: hashSessionToken(ANALYST), userId: 'u-analyst', expiresAt: FUTURE },
  { id: 's3', tokenHash: hashSessionToken(SUPPORT), userId: 'u-support', expiresAt: FUTURE },
  { id: 's4', tokenHash: hashSessionToken(ADMIN), userId: 'u-admin', expiresAt: FUTURE },
  { id: 's5', tokenHash: hashSessionToken(SUPER), userId: 'u-super', expiresAt: FUTURE },
  { id: 's6', tokenHash: hashSessionToken(EXPIRED), userId: 'u-super', expiresAt: PAST },
];

const USERS: ReadonlyArray<{ id: string; adminRole: string | null }> = [
  { id: 'u-ordinary', adminRole: null },
  { id: 'u-analyst', adminRole: 'ANALYST' },
  { id: 'u-support', adminRole: 'SUPPORT' },
  { id: 'u-admin', adminRole: 'ADMIN' },
  { id: 'u-super', adminRole: 'SUPER_ADMIN' },
];

/** Records every write so a refusal can be asserted as "nothing happened". */
interface Row {
  name: string;
  enabled: boolean;
  setBy: string;
  reason: string | null;
  setAt: Date;
}
let switchRows: Map<string, Row>;
let auditRows: Row[];

const empty = async (): Promise<unknown[]> => [];
const zero = async (): Promise<number> => 0;

const stubPrisma = {
  $queryRaw: async () => [{ probe: 1 }],
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(stubPrisma),
  session: {
    findUnique: async ({ where }: { where: { tokenHash: string } }) =>
      SESSIONS.find((s) => s.tokenHash === where.tokenHash) ?? null,
    delete: async () => undefined,
    deleteMany: async () => ({ count: 0 }),
  },
  user: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const user = USERS.find((c) => c.id === where.id);
      return user ? { adminRole: user.adminRole } : null;
    },
  },
  operationalSwitch: {
    findUnique: async ({ where }: { where: { name: string } }) =>
      switchRows.get(where.name) ?? null,
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { name: string };
      create: Row;
      update: Partial<Row>;
    }) => {
      const existing = switchRows.get(where.name);
      const next = existing
        ? { ...existing, ...update, setAt: new Date() }
        : { ...create, setAt: new Date() };
      switchRows.set(where.name, next as Row);
      return next;
    },
  },
  operationalSwitchAudit: {
    create: async ({ data }: { data: Omit<Row, 'setAt'> }) => {
      const row = { ...data, setAt: new Date() };
      auditRows.push(row as Row);
      return row;
    },
    findMany: async () => [...auditRows].reverse(),
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
};

@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: stubPrisma }],
  exports: [PrismaService],
})
class StubPrismaModule {}

/**
 * The stub is installed with `overrideProvider` as well as through a @Global()
 * module. `PrismaModule` is itself @Global() and AdminModule's graph pulls it
 * in (EconomyModule, ComputeControlsModule), so a later global registration of
 * the same token replaces an earlier one; an override applies to the whole
 * graph and cannot be shadowed that way.
 */
async function createApp(platform: string | undefined, environment: string | undefined) {
  if (platform === undefined) delete process.env[ADMIN_PLATFORM_ENABLED_ENV];
  else process.env[ADMIN_PLATFORM_ENABLED_ENV] = platform;
  if (environment === undefined) delete process.env[DEPLOYMENT_ENVIRONMENT_VAR];
  else process.env[DEPLOYMENT_ENVIRONMENT_VAR] = environment;

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
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }),
  );
  await app.init();
  return app;
}

const names = resolveAuthCookieNames();
const auth = (token: string): string[] => [`${names.session}=${token}`, `${names.csrf}=csrf-value`];
const CSRF = 'csrf-value';

describe('R1 — the admin operations write is behind its own capability', () => {
  const originalPlatform = process.env[ADMIN_PLATFORM_ENABLED_ENV];
  const originalEnvironment = process.env[DEPLOYMENT_ENVIRONMENT_VAR];
  let app: INestApplication;

  beforeEach(async () => {
    switchRows = new Map([
      [
        'ASK_PUBLIC_COMPUTE_ENABLED',
        {
          name: 'ASK_PUBLIC_COMPUTE_ENABLED',
          enabled: true,
          setBy: 'seed',
          reason: 'seed',
          setAt: new Date(),
        },
      ],
    ]);
    auditRows = [];
    app = await createApp('true', 'ALPHA');
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(() => {
    if (originalPlatform === undefined) delete process.env[ADMIN_PLATFORM_ENABLED_ENV];
    else process.env[ADMIN_PLATFORM_ENABLED_ENV] = originalPlatform;
    if (originalEnvironment === undefined) delete process.env[DEPLOYMENT_ENVIRONMENT_VAR];
    else process.env[DEPLOYMENT_ENVIRONMENT_VAR] = originalEnvironment;
  });

  const unchanged = () => {
    expect(switchRows.get('ASK_PUBLIC_COMPUTE_ENABLED')?.enabled).toBe(true);
    expect(auditRows).toHaveLength(0);
  };

  it('an unauthenticated caller cannot read the operations state', async () => {
    await request(app.getHttpServer()).get(STATE).expect(401);
  });

  it('AN UNAUTHENTICATED CALLER CANNOT WRITE, AND NOTHING CHANGES', async () => {
    await request(app.getHttpServer())
      .post(SET)
      .set('X-CSRF-Token', CSRF)
      .send({ enabled: false, reason: 'unauthenticated attempt' })
      .expect(401);
    unchanged();
  });

  it('an ordinary signed-in reader is refused on both, and nothing changes', async () => {
    await request(app.getHttpServer()).get(STATE).set('Cookie', auth(ORDINARY)).expect(403);
    await request(app.getHttpServer())
      .post(SET)
      .set('Cookie', auth(ORDINARY))
      .set('X-CSRF-Token', CSRF)
      .send({ enabled: false, reason: 'ordinary reader attempt' })
      .expect(403);
    unchanged();
  });

  it('AN ANALYST MAY SEE THE SWITCHES AND MAY NOT CHANGE ONE — the asymmetry this suite exists for', async () => {
    const read = await request(app.getHttpServer())
      .get(STATE)
      .set('Cookie', auth(ANALYST))
      .expect(200);
    expect(read.body.mayOperate).toBe(false);
    expect(read.body.switches.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post(SET)
      .set('Cookie', auth(ANALYST))
      .set('X-CSRF-Token', CSRF)
      .send({ enabled: false, reason: 'analyst attempts an incident action' })
      .expect(403);
    unchanged();
  });

  it('SUPPORT is refused the write for the same reason', async () => {
    const read = await request(app.getHttpServer())
      .get(STATE)
      .set('Cookie', auth(SUPPORT))
      .expect(200);
    expect(read.body.mayOperate).toBe(false);
    await request(app.getHttpServer())
      .post(SET)
      .set('Cookie', auth(SUPPORT))
      .set('X-CSRF-Token', CSRF)
      .send({ enabled: false, reason: 'support attempts an incident action' })
      .expect(403);
    unchanged();
  });

  it('an expired SUPER_ADMIN session is 401, never 403 — the code never reveals privilege', async () => {
    await request(app.getHttpServer())
      .post(SET)
      .set('Cookie', auth(EXPIRED))
      .set('X-CSRF-Token', CSRF)
      .send({ enabled: false, reason: 'expired session attempt' })
      .expect(401);
    unchanged();
  });

  it('ADMIN may operate, and the change is recorded with the SERVER-DERIVED actor', async () => {
    const read = await request(app.getHttpServer())
      .get(STATE)
      .set('Cookie', auth(ADMIN))
      .expect(200);
    expect(read.body.mayOperate).toBe(true);

    const response = await request(app.getHttpServer())
      .post(SET)
      .set('Cookie', auth(ADMIN))
      .set('X-CSRF-Token', CSRF)
      .send({ enabled: false, reason: 'provider error rate above threshold' })
      .expect(201);

    expect(response.body.applied).toBe(true);
    expect(response.body.switch.requested).toBe(false);
    expect(switchRows.get('ASK_PUBLIC_COMPUTE_ENABLED')?.enabled).toBe(false);
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].setBy).toBe('u-admin');
    expect(auditRows[0].reason).toBe('provider error rate above threshold');
  });

  it('SUPER_ADMIN may operate too', async () => {
    await request(app.getHttpServer())
      .post(SET)
      .set('Cookie', auth(SUPER))
      .set('X-CSRF-Token', CSRF)
      .send({ enabled: false, reason: 'super admin pauses compute' })
      .expect(201);
    expect(auditRows[0].setBy).toBe('u-super');
  });

  it('THE ACTOR CANNOT BE SUPPLIED BY THE CALLER — a setBy in the body is ignored', async () => {
    await request(app.getHttpServer())
      .post(SET)
      .set('Cookie', auth(ADMIN))
      .set('X-CSRF-Token', CSRF)
      .send({
        enabled: false,
        reason: 'attempt to forge an actor',
        setBy: 'someone-else',
        userId: 'u-super',
      })
      .expect(201);
    expect(auditRows[0].setBy).toBe('u-admin');
  });

  it('a forged request without the CSRF header is refused and nothing changes', async () => {
    await request(app.getHttpServer())
      .post(SET)
      .set('Cookie', auth(ADMIN))
      .send({ enabled: false, reason: 'missing csrf header' })
      .expect(403);
    unchanged();
  });

  it('a mismatched CSRF token is refused and nothing changes', async () => {
    await request(app.getHttpServer())
      .post(SET)
      .set('Cookie', auth(ADMIN))
      .set('X-CSRF-Token', 'not-the-cookie')
      .send({ enabled: false, reason: 'mismatched csrf' })
      .expect(403);
    unchanged();
  });

  it('a missing reason is refused and nothing changes', async () => {
    await request(app.getHttpServer())
      .post(SET)
      .set('Cookie', auth(ADMIN))
      .set('X-CSRF-Token', CSRF)
      .send({ enabled: false })
      .expect(400);
    unchanged();
  });

  it('a blank reason is refused and nothing changes', async () => {
    await request(app.getHttpServer())
      .post(SET)
      .set('Cookie', auth(ADMIN))
      .set('X-CSRF-Token', CSRF)
      .send({ enabled: false, reason: '   ' })
      .expect(400);
    unchanged();
  });

  it('an unknown switch name is refused and nothing changes', async () => {
    await request(app.getHttpServer())
      .post('/admin/operations/switches/DISABLE_SECURITY')
      .set('Cookie', auth(ADMIN))
      .set('X-CSRF-Token', CSRF)
      .send({ enabled: true, reason: 'attempting an invented switch' })
      .expect(400);
    unchanged();
  });

  it('the payload carries no secret and no reader identity', async () => {
    const read = await request(app.getHttpServer())
      .get(STATE)
      .set('Cookie', auth(ADMIN))
      .expect(200);
    const body = JSON.stringify(read.body).toLowerCase();
    [
      'password',
      'secret',
      'token',
      'apikey',
      'api_key',
      'database_url',
      'connectionstring',
      'question',
      'email',
    ].forEach((forbidden) => expect(body).not.toContain(forbidden));
  });

  it('POSITIVE CONTROL — the same scan DOES condemn a payload carrying one', () => {
    const body = JSON.stringify({
      environment: 'ALPHA',
      databaseUrl: 'postgres://u:p@h/db',
    }).toLowerCase();
    expect(body).toContain('database');
  });

  it('every mutating verb other than the declared POST is refused', async () => {
    for (const verb of ['put', 'patch', 'delete'] as const) {
      await request(app.getHttpServer())
        [verb](SET)
        .set('Cookie', auth(SUPER))
        .set('X-CSRF-Token', CSRF)
        .send({ enabled: false, reason: 'verb probe' })
        .expect(404);
    }
    unchanged();
  });
});

describe('R1 — an unconfirmed environment refuses the write, server-side', () => {
  const originalPlatform = process.env[ADMIN_PLATFORM_ENABLED_ENV];
  const originalEnvironment = process.env[DEPLOYMENT_ENVIRONMENT_VAR];

  afterAll(() => {
    if (originalPlatform === undefined) delete process.env[ADMIN_PLATFORM_ENABLED_ENV];
    else process.env[ADMIN_PLATFORM_ENABLED_ENV] = originalPlatform;
    if (originalEnvironment === undefined) delete process.env[DEPLOYMENT_ENVIRONMENT_VAR];
    else process.env[DEPLOYMENT_ENVIRONMENT_VAR] = originalEnvironment;
  });

  beforeEach(() => {
    switchRows = new Map([
      [
        'ASK_PUBLIC_COMPUTE_ENABLED',
        {
          name: 'ASK_PUBLIC_COMPUTE_ENABLED',
          enabled: true,
          setBy: 'seed',
          reason: 'seed',
          setAt: new Date(),
        },
      ],
    ]);
    auditRows = [];
  });

  it.each([
    ['unset', undefined, 'NOT_SET'],
    ['an unrecognised value', 'staging', 'NOT_RECOGNISED'],
    ['the right word in the wrong case', 'alpha', 'NOT_RECOGNISED'],
    ['the right word with whitespace', ' ALPHA', 'NOT_RECOGNISED'],
  ])(
    '%s: the state reports unconfirmed and the write is refused',
    async (_label, value, reason) => {
      const app = await createApp('true', value as string | undefined);
      try {
        const read = await request(app.getHttpServer())
          .get(STATE)
          .set('Cookie', auth(SUPER))
          .expect(200);
        expect(read.body.environment.confirmed).toBe(false);
        expect(read.body.environment.environment).toBeNull();
        expect(read.body.environment.reason).toBe(reason);
        expect(read.body.switches[0].blockedReason).toBe('ENVIRONMENT_UNCONFIRMED');

        await request(app.getHttpServer())
          .post(SET)
          .set('Cookie', auth(SUPER))
          .set('X-CSRF-Token', CSRF)
          .send({ enabled: false, reason: 'attempt while environment unconfirmed' })
          .expect(403);

        expect(switchRows.get('ASK_PUBLIC_COMPUTE_ENABLED')?.enabled).toBe(true);
        expect(auditRows).toHaveLength(0);
      } finally {
        await app.close();
      }
    },
  );

  it('a confirmed environment reports its label and permits the write', async () => {
    const app = await createApp('true', 'PRODUCTION');
    try {
      const read = await request(app.getHttpServer())
        .get(STATE)
        .set('Cookie', auth(SUPER))
        .expect(200);
      expect(read.body.environment).toMatchObject({ confirmed: true, environment: 'PRODUCTION' });
      await request(app.getHttpServer())
        .post(SET)
        .set('Cookie', auth(SUPER))
        .set('X-CSRF-Token', CSRF)
        .send({ enabled: false, reason: 'confirmed environment' })
        .expect(201);
      expect(auditRows).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});

describe('R1 — the admin platform kill switch still hides the route entirely', () => {
  const originalPlatform = process.env[ADMIN_PLATFORM_ENABLED_ENV];
  const originalEnvironment = process.env[DEPLOYMENT_ENVIRONMENT_VAR];

  afterAll(() => {
    if (originalPlatform === undefined) delete process.env[ADMIN_PLATFORM_ENABLED_ENV];
    else process.env[ADMIN_PLATFORM_ENABLED_ENV] = originalPlatform;
    if (originalEnvironment === undefined) delete process.env[DEPLOYMENT_ENVIRONMENT_VAR];
    else process.env[DEPLOYMENT_ENVIRONMENT_VAR] = originalEnvironment;
  });

  beforeEach(() => {
    switchRows = new Map([
      [
        'ASK_PUBLIC_COMPUTE_ENABLED',
        {
          name: 'ASK_PUBLIC_COMPUTE_ENABLED',
          enabled: true,
          setBy: 'seed',
          reason: 'seed',
          setAt: new Date(),
        },
      ],
    ]);
    auditRows = [];
  });

  it.each([
    ['unset', undefined],
    ["the string '1'", '1'],
  ])(
    '%s: both routes are 404 for a SUPER_ADMIN, so disabled means absent',
    async (_label, flag) => {
      const app = await createApp(flag as string | undefined, 'ALPHA');
      try {
        await request(app.getHttpServer()).get(STATE).set('Cookie', auth(SUPER)).expect(404);
        await request(app.getHttpServer())
          .post(SET)
          .set('Cookie', auth(SUPER))
          .set('X-CSRF-Token', CSRF)
          .send({ enabled: false, reason: 'platform disabled attempt' })
          .expect(404);
        expect(auditRows).toHaveLength(0);
      } finally {
        await app.close();
      }
    },
  );
});
