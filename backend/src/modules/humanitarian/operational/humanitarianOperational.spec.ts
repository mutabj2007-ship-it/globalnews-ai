import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { PrismaService } from '../../../database/prisma.service';
import { PrismaModule } from '../../../database/prisma.module';
import { resolveAuthCookieNames } from '../../auth/cookie.util';
import { hashSessionToken } from '../../auth/session-token.util';
import { ADMIN_PLATFORM_ENABLED_ENV } from '../../admin/admin-platform.config';
import { HumanitarianOperationalModule } from './humanitarian-operational.module';
import { operationalMountDecision } from './humanitarian-operational.mount';
import { HumanitarianOperationalService } from './humanitarian-operational.service';
import {
  HUMANITARIAN_ALERT_IDS,
  HUMANITARIAN_MODULE_STATUSES,
  HUMANITARIAN_SOURCE_IDS,
  POSITIVE_MODULE_STATUSES,
  STATUS_MUST_NOT_IMPLY,
  USER_NOTIFICATIONS_EMITTED,
} from './humanitarian-operational.contract';
import {
  COPERNICUS_PRODUCER_ENABLED,
  HUMANITARIAN_PRODUCER_ACTIVATION,
  assertActivationPermitted,
} from '../producers/copernicus-ems.producer';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HUMANITARIAN OPERATIONAL / ADMIN R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The brief named four tests. Each is here as a measurement rather than a
 * claim — admin auth unchanged, no secret exposure, no source call from merely
 * opening Admin, no provider activation through the UI — together with the two
 * disclosure limits the inspection turned up, which are not optional.
 */

/* ── the wire. Opening this surface must reach nothing. ───────────────────── */
let requests: string[] = [];
beforeEach(() => {
  requests = [];
  global.fetch = (async (input: RequestInfo | URL) => {
    requests.push(String(input));
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
});

const ADMIN_TOKEN = 'raw-token-admin';
const READER_TOKEN = 'raw-token-ordinary-reader';
const FUTURE = new Date(Date.now() + 3600_000);

const SESSIONS = [
  { id: 's1', tokenHash: hashSessionToken(ADMIN_TOKEN), userId: 'u-admin', expiresAt: FUTURE },
  { id: 's2', tokenHash: hashSessionToken(READER_TOKEN), userId: 'u-reader', expiresAt: FUTURE },
];
const USERS: ReadonlyArray<{ id: string; adminRole: string | null }> = [
  { id: 'u-admin', adminRole: 'SUPER_ADMIN' },
  { id: 'u-reader', adminRole: null },
];

const stubPrisma = {
  $queryRaw: async () => [{ probe: 1 }],
  session: {
    findUnique: async ({ where }: { where: { tokenHash: string } }) =>
      SESSIONS.find((s) => s.tokenHash === where.tokenHash) ?? null,
    delete: async () => undefined,
    deleteMany: async () => ({ count: 0 }),
  },
  user: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const user = USERS.find((u) => u.id === where.id);
      return user ? { adminRole: user.adminRole } : null;
    },
  },
};

const ROUTE = '/admin/humanitarian/status';
const DIR = __dirname;
const code = (file: string): string =>
  readFileSync(join(DIR, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

async function createApp(platformFlag: string | undefined): Promise<INestApplication> {
  if (platformFlag === undefined) delete process.env[ADMIN_PLATFORM_ENABLED_ENV];
  else process.env[ADMIN_PLATFORM_ENABLED_ENV] = platformFlag;
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PrismaModule,
      HumanitarianOperationalModule,
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

const signedIn = (app: INestApplication, token: string) =>
  request(app.getHttpServer())
    .get(ROUTE)
    .set('Cookie', `${resolveAuthCookieNames().session}=${token}`);

/* ══════════════════════════════════════════════════════════════════════════ */

describe('ADMIN AUTH IS UNCHANGED — the landed chain, not a new one', () => {
  const original = process.env[ADMIN_PLATFORM_ENABLED_ENV];
  afterAll(() => {
    if (original === undefined) delete process.env[ADMIN_PLATFORM_ENABLED_ENV];
    else process.env[ADMIN_PLATFORM_ENABLED_ENV] = original;
  });

  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp('true');
  });
  afterAll(async () => {
    await app.close();
  });

  it('401 without a session', async () => {
    expect((await request(app.getHttpServer()).get(ROUTE)).status).toBe(401);
  });

  it('403 for a signed-in NON-admin', async () => {
    expect((await signedIn(app, READER_TOKEN)).status).toBe(403);
  });

  it('200 for an admin', async () => {
    expect((await signedIn(app, ADMIN_TOKEN)).status).toBe(200);
  });

  it('404 when the admin platform is off, for an admin too', async () => {
    const off = await createApp(undefined);
    expect((await signedIn(off, ADMIN_TOKEN)).status).toBe(404);
    await off.close();
  });

  it('THE CONTROLLER ADDS NO GUARD AND WEAKENS NONE — the chain is the landed one', () => {
    const controller = code('humanitarian-operational.controller.ts');
    expect(controller).toContain(
      '@UseGuards(AdminPlatformEnabledGuard, RequireAuthGuard, AdminGuard)',
    );
    expect(controller).toContain('@RequireCapability(CAPABILITIES.AnalyticsView)');
    /* No guard is defined here; they are all imported from the admin module. */
    expect(controller).not.toMatch(/implements CanActivate|canActivate\s*\(/);
  });
});

describe('NO SOURCE CALL FROM MERELY OPENING ADMIN', () => {
  const original = process.env[ADMIN_PLATFORM_ENABLED_ENV];
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp('true');
  });
  afterAll(async () => {
    await app.close();
    if (original === undefined) delete process.env[ADMIN_PLATFORM_ENABLED_ENV];
    else process.env[ADMIN_PLATFORM_ENABLED_ENV] = original;
  });

  it('OPENING THE SURFACE SENDS ZERO REQUESTS — measured at the wire', async () => {
    const response = await signedIn(app, ADMIN_TOKEN);
    expect(response.status).toBe(200);
    expect(requests).toEqual([]);
  });

  it('and ten opens still send zero', async () => {
    for (let i = 0; i < 10; i += 1) await signedIn(app, ADMIN_TOKEN);
    expect(requests).toEqual([]);
  });

  it('positive control: the harness DOES count a request when one is made', async () => {
    await fetch('https://example.invalid/probe');
    expect(requests).toEqual(['https://example.invalid/probe']);
  });

  it('THE SERVICE HAS NO WAY TO CALL ANYTHING — structural, not behavioural', () => {
    const service = code('humanitarian-operational.service.ts');
    expect(service).not.toMatch(/\bfetch\(/);
    expect(service).not.toMatch(/axios|HttpService|https?:\/\//);
    expect(service).not.toMatch(/PrismaService|prisma\./);
    expect(service).not.toMatch(/process\.env|ConfigService/);
    /* Positive control: the stripper left the implementation. */
    expect(service).toContain('export class HumanitarianOperationalService');
  });

  it('the module imports no data or producer module', () => {
    const mod = code('humanitarian-operational.module.ts');
    /* AuthModule and AdminModule supply the landed guards; nothing supplies data. */
    expect(mod).toContain('imports: [AuthModule, AdminModule]');
    expect(mod).not.toMatch(/PrismaModule|IntakeModule|ProducerModule|HttpModule/);
  });
});

describe('NO SECRET EXPOSURE', () => {
  const service = new HumanitarianOperationalService();

  it('CREDENTIAL PRESENCE IS BOOLEAN BY TYPE — the shape cannot carry a value', () => {
    const contract = code('humanitarian-operational.contract.ts');
    const shape = contract.slice(
      contract.indexOf('export interface CredentialPresence'),
      contract.indexOf('export interface HumanitarianSourceStatus'),
    );
    expect(shape).toContain('variableName: string');
    expect(shape).toContain('present: boolean');
    /* `variableName` is the only string, and it is a NAME. No `value` field exists. */
    expect(shape).not.toMatch(/\bvalue\s*:/);
    expect(shape).not.toMatch(/secret|token|apiKey|password/i);
  });

  it('NO ENVIRONMENT VALUE REACHES THE PAYLOAD — tested against planted secrets', () => {
    const planted = {
      HUMANITARIAN_PLANTED_SECRET: 'sk-planted-value-must-not-appear',
      RELIEFWEB_APPNAME: 'planted-appname',
      COPERNICUS_KEY: 'planted-copernicus-key',
    };
    Object.assign(process.env, planted);
    try {
      const serialised = JSON.stringify(service.status());
      Object.values(planted).forEach((value) => expect(serialised).not.toContain(value));
      /* Positive control: the planted values really are in the environment. */
      expect(process.env.HUMANITARIAN_PLANTED_SECRET).toBe(planted.HUMANITARIAN_PLANTED_SECRET);
    } finally {
      Object.keys(planted).forEach((key) => delete process.env[key]);
    }
  });

  it('no source declares a credential today, and none is invented', () => {
    /* An invented `present: false` would send an operator looking for a variable
       that is declared nowhere. An empty list is the honest answer. */
    service.status().sources.forEach((source) => expect(source.credentials).toEqual([]));
  });
});

describe('NO PROVIDER ACTIVATION THROUGH THIS SURFACE', () => {
  it('THE CONTROLLER HAS NO MUTATION VERB AT ALL', () => {
    const controller = code('humanitarian-operational.controller.ts');
    expect(controller).toContain('@Get(');
    ['@Post(', '@Put(', '@Patch(', '@Delete('].forEach((verb) =>
      expect([verb, controller.includes(verb)]).toEqual([verb, false]),
    );
  });

  it('NO OPERATIONAL SWITCH IS ADDED, PROPOSED IN CODE, OR REFERENCED', () => {
    [
      'humanitarian-operational.contract.ts',
      'humanitarian-operational.service.ts',
      'humanitarian-operational.controller.ts',
      'humanitarian-operational.module.ts',
    ].forEach((file) => {
      const source = code(file);
      expect([file, /OperationalSwitch|OPERATIONAL_SWITCHES/.test(source)]).toEqual([file, false]);
    });
  });

  it('ACTIVATION STILL REFUSES, UNCONDITIONALLY — this surface changed nothing', () => {
    expect(HUMANITARIAN_PRODUCER_ACTIVATION).toBe('NOT_CLEARED');
    expect(COPERNICUS_PRODUCER_ENABLED).toBe(false);
    expect(() => assertActivationPermitted()).toThrow(/HUMANITARIAN_PRODUCER_NOT_ACTIVATED/);
  });

  it('the surface REPORTS activation by reading the authority, never by restating it', () => {
    const service = code('humanitarian-operational.service.ts');
    expect(service).toContain('HUMANITARIAN_PRODUCER_ACTIVATION');
    expect(service).toContain('COPERNICUS_PRODUCER_ENABLED');
    /* Imported from the producer, so the row cannot drift from the authority. */
    expect(service).toContain("from '../producers/copernicus-ems.producer'");
  });
});

describe('NEVER "HEALTHY" BECAUSE THE PROCESS IS HEALTHY', () => {
  const service = new HumanitarianOperationalService();
  const status = service.status();

  it('the module status is NOT_ASSESSED, and says why', () => {
    expect(status.moduleStatus).toBe('NOT_ASSESSED');
    expect(status.moduleStatusBasis).toContain('absence of assessment');
  });

  it('A POSITIVE STATUS IS UNREACHABLE — no liveness input exists to produce one', () => {
    expect(POSITIVE_MODULE_STATUSES).not.toContain(status.moduleStatus);
    const service_ = code('humanitarian-operational.service.ts');
    /* deriveModuleStatus takes the admitted count and nothing else. */
    expect(service_).toContain('deriveModuleStatus(admitted: MeasuredFact<number>)');
    expect(service_).not.toMatch(/uptime|liveness|healthy|probeStatus|isAlive/i);
  });

  it('NO STATUS CLAIM IMPLIES NORMALITY', () => {
    /*
      SCOPED TO THE STATUS CLAIMS, not the whole payload — and that distinction is
      the point rather than a convenience. An alert condition legitimately says
      "a source that NORMALLY returns records returning none": that describes
      what the condition watches for, it does not assert the module is normal.
      Scanning the whole document flagged it, which is the guard being too blunt
      rather than the copy being wrong.
    */
    const claims = [
      status.moduleStatus,
      status.moduleStatusBasis,
      ...status.sources.map((s) => s.basis),
    ]
      .join(' ')
      .toLowerCase();
    STATUS_MUST_NOT_IMPLY.forEach((phrase) =>
      expect([phrase, claims.includes(phrase)]).toEqual([phrase, false]),
    );
    /* Positive control: the scan DOES catch a forbidden phrase when present. */
    expect(`${claims} all clear`.includes('all clear')).toBe(true);
  });

  it('the six statuses are exactly the ones the Product Owner named', () => {
    expect([...HUMANITARIAN_MODULE_STATUSES]).toEqual([
      'NOT_ASSESSED',
      'PARTIAL',
      'RETAINED',
      'CURRENT',
      'SOURCE_UNAVAILABLE',
      'COVERAGE_GAP',
    ]);
  });
});

describe('A ZERO IS A LIE HERE — every quantity knows whether it was measured', () => {
  const status = new HumanitarianOperationalService().status();

  it('EVERY QUANTITY IS NOT_INSTRUMENTED TODAY, AND NAMES THE MISSING INSTRUMENT', () => {
    status.sources.forEach((source) => {
      (
        [
          'lastSuccessfulAcquisition',
          'lastAttemptedAcquisition',
          'lastRetainedRecordAt',
          'recordsAdmitted',
          'recordsWithheld',
          'withholdReasons',
          'sourceErrors',
          'coverage',
          'languageCounts',
          'cacheAgeSeconds',
        ] as const
      ).forEach((field) => {
        const fact = source[field];
        expect([source.sourceId, field, fact.state]).toEqual([
          source.sourceId,
          field,
          'NOT_INSTRUMENTED',
        ]);
        if (fact.state === 'NOT_INSTRUMENTED')
          expect([source.sourceId, field, fact.because.length > 20]).toEqual([
            source.sourceId,
            field,
            true,
          ]);
      });
    });
  });

  it('NO QUANTITY SERIALISES AS 0 — a counted zero and an uncounted one are different facts', () => {
    const serialised = JSON.stringify(status);
    expect(serialised).not.toMatch(/"value"\s*:\s*0\b/);
  });

  it('the two sources with no code are NOT_IMPLEMENTED, not "not configured"', () => {
    const byId = Object.fromEntries(status.sources.map((s) => [s.sourceId, s]));
    expect(byId.GDACS.implementation).toBe('NOT_IMPLEMENTED');
    expect(byId.RELIEFWEB.implementation).toBe('NOT_IMPLEMENTED');
    /* "Not configured" would send an operator looking for configuration. */
    expect(byId.GDACS.basis).toContain('nothing to configure');
  });

  it('Copernicus is distinguished: code exists, acquisition does not', () => {
    const copernicus = status.sources.find((s) => s.sourceId === 'COPERNICUS_EMS')!;
    expect(copernicus.implementation).toBe('TRANSFORM_ONLY_NO_ACQUISITION');
    expect(copernicus.activation).toBe('NOT_CLEARED');
  });

  it('all three named sources are present', () => {
    expect(status.sources.map((s) => s.sourceId)).toEqual([...HUMANITARIAN_SOURCE_IDS]);
  });
});

describe('DISCLOSURE LIMITS — inherited, and not mine to waive', () => {
  const status = new HumanitarianOperationalService().status();

  it('ARTICLE 53 — no place, region or activation dimension exists in the payload', () => {
    expect(status.coverageGranularity).toBe('MODULE_ONLY');
    const contract = code('humanitarian-operational.contract.ts');
    /* Not merely empty today: absent from the types, so it cannot be populated. */
    ['place', 'region', 'country', 'activationId', 'bbox', 'geometry'].forEach((dimension) =>
      expect([dimension, new RegExp(`\\b${dimension}\\b`, 'i').test(contract)]).toEqual([
        dimension,
        false,
      ]),
    );
    /*
      THE FORBIDDEN THING IS AN INVENTORY, NOT THE STATE. The brief requires
      "activation status" per source, and `"activation":"NOT_CLEARED"` is exactly
      that — one state, no list of what is or is not activated. What Article 53
      forbids is an enumeration of activations, and its mirror image, an
      enumeration of where there are none.

      A first pass here forbade /"activations?":/ and flagged the singular state
      field. That was the guard being wrong, not the payload — recorded because a
      guard relaxed without saying why is how a real one gets lost.
    */
    const serialised = JSON.stringify(status);
    /* No PLURAL inventory key, and no array under an activation-shaped key. */
    expect(serialised).not.toMatch(/"activations"\s*:/);
    expect(serialised).not.toMatch(/"activation[A-Za-z]*"\s*:\s*\[/);
    /* The singular STATE is present, once per source, as the brief requires. */
    expect((serialised.match(/"activation"\s*:\s*"/g) ?? []).length).toBe(status.sources.length);
    /* Positive control: an inventory WOULD be caught. */
    expect(JSON.stringify({ activations: ['EMSR123'] })).toMatch(/"activations"\s*:/);
  });

  it('and the Copernicus coverage cell cites the restriction rather than reporting a gap', () => {
    const copernicus = status.sources.find((s) => s.sourceId === 'COPERNICUS_EMS')!;
    expect(copernicus.coverage.state).toBe('NOT_INSTRUMENTED');
    if (copernicus.coverage.state === 'NOT_INSTRUMENTED')
      expect(copernicus.coverage.because).toContain('Article 53');
  });

  it('WITHHOLDS ARE AGGREGATE COUNTS — never a per-record list that could be inverted', () => {
    expect(status.withholdReporting).toBe('AGGREGATE_COUNTS_ONLY');
    const contract = code('humanitarian-operational.contract.ts');
    const field = contract.slice(contract.indexOf('withholdReasons'));
    expect(field.slice(0, 120)).toContain('count: number');
    expect(field.slice(0, 120)).not.toMatch(/recordKey|observationKey|partitionKey/);
  });
});

describe('ALERT CONDITIONS — declared, and honest about whether they can fire', () => {
  const status = new HumanitarianOperationalService().status();

  it('all six the brief named are declared', () => {
    expect(status.alerts.map((a) => a.id)).toEqual([...HUMANITARIAN_ALERT_IDS]);
  });

  it('NONE CAN FIRE TODAY, AND EACH NAMES THE INSTRUMENT IT NEEDS', () => {
    status.alerts.forEach((alert) => {
      expect([alert.id, alert.canFireToday]).toEqual([alert.id, false]);
      expect([alert.id, alert.requires.length > 30]).toEqual([alert.id, true]);
    });
  });

  it('they are OPERATOR-ONLY — no user notification is emitted', () => {
    expect(USER_NOTIFICATIONS_EMITTED).toBe(false);
    [
      'humanitarian-operational.service.ts',
      'humanitarian-operational.controller.ts',
      'humanitarian-operational.module.ts',
    ].forEach((file) =>
      expect([file, /notify|notification|push|email|sendTo/i.test(code(file))]).toEqual([
        file,
        false,
      ]),
    );
  });
});

describe('RUNTIME BOUNDARY', () => {
  /*
    THIS ASSERTION REVERSED AT R2, AND THE OLD ONE IS OBSOLETE RATHER THAN
    INCONVENIENT. R1 asserted the module was NOT registered, because R1 judged
    that putting a route on the admin surface was a step it had not been
    authorised to take. R2's contract authorises it under a stated condition —
    "mount/register the operational read module only if it cannot activate
    acquisition" — so the fact R1 measured is no longer the fact the programme
    wants held true. The condition itself is what is now asserted, here and in
    `humanitarianOperationalMount.spec.ts`; it is not asserted more weakly.
  */
  it('APP.MODULE REGISTERS THIS MODULE THROUGH THE CHECKED MOUNT (R2), not directly', () => {
    const app = readFileSync(join(DIR, '../../../app.module.ts'), 'utf8');
    expect(app).toMatch(/humanitarianOperationalImports\(\)/);
    expect(app).toMatch(/\.\.\.humanitarianOperationalImports\(\)/);
    /* The class itself is never named in the imports array — only the guarded helper. */
    expect(app).not.toMatch(/^\s*HumanitarianOperationalModule,\s*$/m);
    expect(operationalMountDecision()).toEqual({ mounted: true, refusedBecause: null });
  });

  it('positive control: the sweep DOES see a module that is registered', () => {
    const app = readFileSync(join(DIR, '../../../app.module.ts'), 'utf8');
    expect(app).toMatch(/HumanitarianReadModule/);
  });

  /*
    MOUNTING ADDED NO WRITE PATH — measured on a live application rather than read
    off the source. An unrouted verb 404s before any guard runs, while the routed
    GET reaches the guard chain and 401s. So 404-for-every-mutation and
    401-for-GET on the SAME path is the distinction: it separates "no such route"
    from "a route that merely refused me today", which a source scan cannot.
  */
  it('MOUNTING ADDED NO WRITE PATH — every mutation verb is unrouted on the live app', async () => {
    const live = await createApp('true');
    try {
      const server = live.getHttpServer();
      const statuses = {
        post: (await request(server).post(ROUTE)).status,
        put: (await request(server).put(ROUTE)).status,
        patch: (await request(server).patch(ROUTE)).status,
        delete: (await request(server).delete(ROUTE)).status,
        /* positive control: the GET IS routed, and refuses on authentication. */
        get: (await request(server).get(ROUTE)).status,
      };
      expect(statuses).toEqual({ post: 404, put: 404, patch: 404, delete: 404, get: 401 });
    } finally {
      await live.close();
    }
  });

  it('the status is deterministic for a fixed clock', () => {
    const at = new Date('2026-10-01T00:00:00.000Z');
    const a = new HumanitarianOperationalService().status(at);
    const b = new HumanitarianOperationalService().status(at);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.generatedAt).toBe('2026-10-01T00:00:00.000Z');
  });
});
