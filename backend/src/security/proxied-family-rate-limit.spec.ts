import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Injectable,
  Module,
  UseGuards,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TrustedProxyStartupValidator,
  TrustProxyConfigurationError,
  type TrustProxySetting,
} from './trusted-proxy.config';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * E1-ALPHA-PROXY-RATELIMIT-R1 — WHAT THE FIRST-PARTY PROXY DID TO RATE-LIMIT
 * IDENTITY, AND WHY NONE OF EXPRESS'S THREE `trust proxy` FORMS FIXES IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE CHANGE THIS SPEC EXISTS TO CHARACTERIZE. Convergence commit 396d4a7
 * routes six route families through the public Next.js frontend as first-party
 * proxies (frontend/next.config.mjs rewrites): /api/auth, /api/users,
 * /api/history, /api/follows, /api/support and /api/admin. A `rewrites` entry
 * is a SERVER-SIDE fetch from the Next container, so from the backend's point
 * of view every visitor on those six families now arrives from exactly one
 * socket peer — the frontend.
 *
 * @nestjs/throttler 5.2.0 keys its buckets on `req.ip`:
 *
 *     key = md5(`${ClassName}-${handlerName}-${throttlerName}-${req.ip}`)
 *
 * (throttler.guard.js:122-131 — the default getTracker returns `req.ip`, and
 * generateKey folds it together with the controller class and handler name.)
 * So `req.ip` is not a diagnostic here. It is the whole identity.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A SPEC AND NOT A PATCH
 *
 * WHAT THE FRONTEND HOP ACTUALLY DOES. Measured in R2 with one canonical
 * experiment — a real `next build` + `next start` on 14.2.35, the six-family
 * rewrite topology copied from next.config.mjs, and the client binding source
 * address 127.0.0.2 so the socket peer is distinguishable from anything Next
 * might invent. See 01-canonical-rewrite.log in the R2 evidence pack.
 *
 *   1. `NextRequest.ip` is `undefined` when self-hosted, in `next dev` and in
 *      a real production build alike. It is assigned in exactly one place in
 *      the Next distribution — dist/server/web/adapter.js line 133,
 *      `ip: params.request.ip` — and nothing under dist/server/ populates that
 *      field outside a platform adapter. `geo` is `{}`.
 *
 *   2. A client-supplied X-Forwarded-For reaches the rewrite destination
 *      VERBATIM. Next does not append its own hop, in any configuration, for
 *      any of the six header cases tested.
 *
 *   3. WHETHER NEXT SYNTHESISES ONE WHEN THE CLIENT SENT NONE DEPENDS ON
 *      WHETHER MIDDLEWARE EXISTS, and R1 got this wrong by generalising a
 *      measurement taken at the wrong observation point:
 *
 *        no middleware  -> the destination receives NO X-Forwarded-For at all
 *                          (and no x-forwarded-proto)
 *        middleware     -> Next assembles the request for its own runtime,
 *                          synthesising X-Forwarded-For from the socket peer,
 *                          and `NextResponse.next()` re-emits THAT request, so
 *                          the synthesised value reaches the destination
 *
 *      396d4a7 has no frontend/src/middleware.ts, so the no-middleware row is
 *      production. An A/B/A run confirmed the difference is middleware, not
 *      build state: the two config-A runs were byte-identical.
 *
 *      Consequence worth stating on its own: ADDING ANY MIDDLEWARE TO THE
 *      FRONTEND CHANGES WHAT THE BACKEND RECEIVES. Any design that reads
 *      X-Forwarded-For is coupled to a frontend file that does not yet exist.
 *
 * WHAT THAT DOES AND DOES NOT PROVE. Point 2 means a forged header survives
 * the hop untouched, so where the client's own string is the ONLY entry in the
 * chain, every trusting form of `trust proxy` believes the forgery. It does
 * NOT mean the forgery wins in a topology where an X-Forwarded-For-setting
 * edge sits in front: Express resolves from the RIGHT of the chain, so an
 * edge's observation shadows anything the client prepended. Both halves are
 * asserted below — the second in `describe('an edge-present chain …')`, which
 * exists specifically so this file cannot be read as proving more than it does.
 *
 * NOTHING HERE ASSERTS A FIX. `describe('a validated-session key …')`
 * demonstrates the shape of the recommended architecture inside the spec file
 * only; no production code adopts it, because that architecture is not yet
 * authorized.
 */

/** How many requests the global default bucket admits — app.module.ts. */
const GLOBAL_DEFAULT_LIMIT = 20;

/**
 * Stand-ins for the six proxied families, carrying the throttle posture the
 * real controllers carry at 396d4a7. Five of the six declare no @Throttle at
 * all and therefore inherit the 20-per-60s global default; support declares
 * its own tighter limits. Using stand-ins rather than the real controllers
 * keeps this suite free of PrismaService, SessionService and OAuth config —
 * the same approach rate-limit.e2e-spec.ts already takes for M34.
 */
@Controller('users')
class UsersProbeController {
  /** The real GET /users/me: session bootstrap, called on page load. */
  @Get('me')
  me(): string {
    return 'ok';
  }
}

@Controller('history')
class HistoryProbeController {
  @Get()
  list(): string {
    return 'ok';
  }
}

/**
 * Records whether a ROUTE-level guard ran, so the ordering question a
 * session-keyed throttler depends on can be answered by observation rather
 * than by reading Nest's documentation.
 */
const routeGuardCalls: string[] = [];

@Injectable()
class RecordingRouteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    routeGuardCalls.push(context.getHandler().name);
    return true;
  }
}

@Controller('guarded')
class GuardedProbeController {
  @Get()
  @UseGuards(RecordingRouteGuard)
  get(): string {
    return 'ok';
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: GLOBAL_DEFAULT_LIMIT }]),
  ],
  controllers: [UsersProbeController, HistoryProbeController, GuardedProbeController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class ProxiedFamilyModule {}

/**
 * Builds the app with an explicit Express `trust proxy` setting, exactly as
 * backend/src/main.ts:112 does with resolveTrustProxySetting()'s return value.
 * A fresh app per test also means a fresh in-memory throttler store, so the
 * counters of one scenario cannot leak into the next.
 */
async function createApp(trustProxy: TrustProxySetting): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [ProxiedFamilyModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxy);
  await app.init();
  return app;
}

/** A different forged client address on every call. */
function forgedAddress(index: number): string {
  return `198.51.100.${(index % 250) + 1}`;
}

describe('E1-R1 — six proxied families behind ONE socket peer', () => {
  let app: INestApplication;

  afterEach(async () => {
    routeGuardCalls.length = 0;
    if (app) await app.close();
  });

  /**
   * ── 1. THE COLLAPSE ───────────────────────────────────────────────────
   *
   * TRUST_PROXY unset resolves to `false`, which is the deployed default and
   * the only setting this repository ships. `req.ip` is then the socket peer,
   * which is the frontend container for all six families.
   *
   * Every request below carries a DIFFERENT X-Forwarded-For — twenty-one
   * distinct visitors, relayed by the frontend. They share one bucket anyway.
   */
  it('P-1 — with trust proxy disabled, twenty-one distinct visitors share ONE bucket', async () => {
    app = await createApp(false);
    const server = app.getHttpServer();

    for (let visitor = 0; visitor < GLOBAL_DEFAULT_LIMIT; visitor += 1) {
      const response = await request(server)
        .get('/users/me')
        .set('X-Forwarded-For', forgedAddress(visitor));
      expect(response.status).toBe(200);
    }

    /*
     * The twenty-first visitor has made exactly one request in their life and
     * is refused. That is the finding: the limit is not wrong, the key is.
     */
    const nextVisitor = await request(server)
      .get('/users/me')
      .set('X-Forwarded-For', forgedAddress(GLOBAL_DEFAULT_LIMIT));

    expect(nextVisitor.status).toBe(429);
  });

  /**
   * The blast radius, stated precisely so the severity is neither overstated
   * nor understated. generateKey folds in the controller class and handler
   * name, so exhausting one route does not close the others.
   *
   * That is cold comfort for GET /users/me specifically, which the frontend
   * calls to establish session state: twenty page loads per minute site-wide
   * is not a rate limit, it is an outage threshold.
   */
  it('buckets are per controller+handler, so one exhausted family does not close another', async () => {
    app = await createApp(false);
    const server = app.getHttpServer();

    for (let i = 0; i < GLOBAL_DEFAULT_LIMIT; i += 1) {
      await request(server).get('/users/me');
    }
    expect((await request(server).get('/users/me')).status).toBe(429);

    expect((await request(server).get('/history')).status).toBe(200);
  });

  /**
   * ── 2. THE HOP-COUNT FORM IS A TOTAL BYPASS ───────────────────────────
   *
   * `trust proxy` = 1 believes the last entry of X-Forwarded-For from whatever
   * peer connects. It is safe ONLY while the backend origin cannot be reached
   * except through the proxy — a precondition trusted-proxy.config.ts already
   * states in prose, and which a Railway service with a public domain does not
   * meet.
   *
   * Here the socket peer is unchanged and only the forged header rotates. Sixty
   * consecutive requests — three times the limit — are all admitted.
   */
  it('trust proxy = 1 turns a forged header into an unlimited supply of identities', async () => {
    app = await createApp(1);
    const server = app.getHttpServer();

    for (let i = 0; i < GLOBAL_DEFAULT_LIMIT * 3; i += 1) {
      const response = await request(server)
        .get('/users/me')
        .set('X-Forwarded-For', forgedAddress(i));
      expect(response.status).toBe(200);
    }
  });

  /**
   * ── 3. THE ALLOWLIST FORM IS ALSO A BYPASS, IN THIS TOPOLOGY ──────────
   *
   * This is the result that closes off the whole `trust proxy` avenue, and it
   * deserves to be read carefully because it contradicts the usual advice.
   *
   * An allowlist is normally the SAFE form: an untrusted peer is not trusted
   * at all, so a forged header from a direct connection is ignored. That
   * safety rests on an assumption — that SOMETHING upstream APPENDS the
   * address it observed, so the rightmost entry is a measurement rather than
   * the client's assertion.
   *
   * The Next.js rewrite hop does not append (header, point 2). So where the
   * client's own string is the only entry in the chain, the rightmost entry
   * the backend trusts IS that string.
   *
   * READ THE SCOPE OF THIS CAREFULLY. It says the hop contributes nothing
   * trustworthy. It does NOT say the chain contains nothing trustworthy — an
   * edge in front of the frontend would contribute an entry of its own, and
   * `describe('an edge-present chain …')` below shows that entry winning.
   * These cases model the topology with no such edge.
   *
   * `loopback` stands in for "the frontend hop is on the allowlist" — under
   * supertest the socket peer is 127.0.0.1, so the allowlist matches, which is
   * exactly the configuration a correctly-allowlisted deployment would have.
   */
  it('an allowlisted first-party hop still yields forged identities, because the hop relays verbatim', async () => {
    app = await createApp(['loopback']);
    const server = app.getHttpServer();

    for (let i = 0; i < GLOBAL_DEFAULT_LIMIT * 3; i += 1) {
      const response = await request(server)
        .get('/users/me')
        .set('X-Forwarded-For', forgedAddress(i));
      expect(response.status).toBe(200);
    }
  });

  /**
   * The mirror image of the same fact, and the reason an allowlist cannot be
   * tuned out of the problem: with the SAME allowlist, a single forged value
   * repeated puts every request into one bucket. An attacker therefore chooses
   * which failure to inflict — evade the limit by rotating, or deny service to
   * a chosen address by repeating it. Both follow from believing a relayed
   * header.
   */
  it('the same allowlist lets an attacker force other traffic into a chosen bucket', async () => {
    app = await createApp(['loopback']);
    const server = app.getHttpServer();
    const victim = '203.0.113.9';

    for (let i = 0; i < GLOBAL_DEFAULT_LIMIT; i += 1) {
      expect((await request(server).get('/users/me').set('X-Forwarded-For', victim)).status).toBe(
        200,
      );
    }

    const genuineVisitorAtThatAddress = await request(server)
      .get('/users/me')
      .set('X-Forwarded-For', victim);

    expect(genuineVisitorAtThatAddress.status).toBe(429);

    /*
     * And the exhaustion is scoped to the address that was named, which is
     * what makes this targeting rather than the collapse of the first test.
     * Without this assertion the case would also pass with X-Forwarded-For
     * ignored entirely, since a single shared bucket refuses the twenty-first
     * request too — so it would prove nothing about the allowlist.
     */
    const bystander = await request(server).get('/users/me').set('X-Forwarded-For', '203.0.113.10');

    expect(bystander.status).toBe(200);
  });

  /**
   * ── 4. NO XFF AT ALL ──────────────────────────────────────────────────
   *
   * The behaviour when the header is absent, recorded because it is the case
   * every naive local test hits and it looks reassuring for the wrong reason:
   * the limit applies, but it applies to the socket peer, which in production
   * is the frontend rather than a visitor.
   */
  it('with no X-Forwarded-For the socket peer is the identity, under every trust setting', async () => {
    for (const setting of [false, 1, ['loopback']] as TrustProxySetting[]) {
      const scoped = await createApp(setting);
      const server = scoped.getHttpServer();

      for (let i = 0; i < GLOBAL_DEFAULT_LIMIT; i += 1) {
        expect((await request(server).get('/users/me')).status).toBe(200);
      }
      expect((await request(server).get('/users/me')).status).toBe(429);

      await scoped.close();
    }
  });
});

/**
 * ── 4b. THE EDGE-PRESENT CHAIN — THE COUNTER-EVIDENCE, ASSERTED ─────────
 *
 * This block exists because R1 concluded "for the six proxied families, NO
 * value of TRUST_PROXY produces a trustworthy per-visitor identity", and that
 * was overstated. It is true of the topology the cases above model — a client
 * talking to the frontend with nothing in between that touches the header. It
 * is not true once an X-Forwarded-For-setting edge is in front, and a public
 * HTTPS deployment has one by definition, because something has to terminate
 * TLS.
 *
 * Express resolves the chain from the RIGHT. So an entry the edge appended
 * shadows anything the client prepended, and the forgery never wins — which
 * is the whole reason the append convention exists.
 *
 * `'198.51.100.66, 203.0.113.7'` is exactly what an appending edge produces
 * when a client forges: the client's string first, the edge's observation
 * last. Under both trusting forms the resolved identity is the edge's.
 *
 * WHAT THIS DOES NOT ESTABLISH, and the reason R-1 is still recommended: that
 * the deployment actually has such an edge, that it appends or overwrites
 * rather than relaying, that it cannot be bypassed, and that the frontend's
 * own hop to the backend does not re-traverse it and overwrite the client
 * entry with the frontend's address. Those are four platform properties. None
 * is checkable from inside this process, none fails loudly, and each one
 * silently turns rate limiting off rather than on.
 */
describe('E1-R2 — an edge-present chain resolves to the edge observation, not the forgery', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) await app.close();
  });

  const FORGED_THEN_EDGE = '198.51.100.66, 203.0.113.7';

  it.each([
    ['hop count 1', 1 as TrustProxySetting],
    ["allowlist ['loopback']", ['loopback'] as TrustProxySetting],
  ])('%s — a forged entry left of the edge entry does NOT mint identities', async (_n, setting) => {
    app = await createApp(setting);
    const server = app.getHttpServer();

    /*
     * The forged half rotates on every request while the edge half stays put.
     * If the forgery were being believed, each request would land in its own
     * bucket and the 21st would be admitted. It is not: all of them resolve to
     * 203.0.113.7, so they share one bucket and the 21st is refused.
     */
    for (let i = 0; i < GLOBAL_DEFAULT_LIMIT; i += 1) {
      const response = await request(server)
        .get('/users/me')
        .set('X-Forwarded-For', `${forgedAddress(i)}, 203.0.113.7`);
      expect(response.status).toBe(200);
    }

    const rotatedAgain = await request(server)
      .get('/users/me')
      .set('X-Forwarded-For', `${forgedAddress(999)}, 203.0.113.7`);

    expect(rotatedAgain.status).toBe(429);
  });

  it('and a DIFFERENT edge observation still gets its own bucket, so real visitors are separated', async () => {
    app = await createApp(1);
    const server = app.getHttpServer();

    for (let i = 0; i < GLOBAL_DEFAULT_LIMIT; i += 1) {
      expect(
        (await request(server).get('/users/me').set('X-Forwarded-For', FORGED_THEN_EDGE)).status,
      ).toBe(200);
    }
    expect(
      (await request(server).get('/users/me').set('X-Forwarded-For', FORGED_THEN_EDGE)).status,
    ).toBe(429);

    const otherVisitor = await request(server)
      .get('/users/me')
      .set('X-Forwarded-For', '198.51.100.66, 203.0.113.99');

    expect(otherVisitor.status).toBe(200);
  });

  /**
   * The trap that makes "just set a hop count" unsafe even here. A count says
   * "believe the Nth-from-last entry". Set it to 2 in the expectation of
   * edge-plus-frontend, then receive a chain that is only two long because the
   * client forged one entry, and the count lands ON the forgery.
   *
   * Measured rather than argued: under hops=2 the same chain that hops=1
   * resolved to 203.0.113.7 resolves to the attacker's 198.51.100.66.
   */
  /**
   * ── THE TWO MODELS RAILWAY'S OWN STAFF HAVE DESCRIBED ─────────────────
   *
   * E1-C2. Railway has stated its edge behaviour two incompatible ways in
   * public support threads, and Express only ever resolves from the RIGHT, so
   * the difference decides whether a hop count is usable at all. Both models
   * are pinned here rather than one being chosen:
   *
   *   MODEL S — "we strip X-Forwarded-For at our edge and ensure clients
   *              cannot overwrite it". The chain contains exactly one entry,
   *              the edge's own observation, and no client-controlled entry
   *              exists at any position.
   *   MODEL A — "the real client IP will always be the entry our edge proxy
   *              appends to the chain". A client-supplied prefix survives; the
   *              edge's observation is last.
   *
   * Under BOTH, the rightmost entry is the edge's observation and hop count 1
   * resolves it. That agreement is the reason a hop count is proposable at all
   * — and it is why the third, unstated model (edge PREPENDS its observation
   * and preserves client entries to its right) is the one that would break it.
   * It is pinned last, failing loudly, so nobody adopts a hop count on the
   * assumption that all three behave alike.
   */
  it('MODEL S — a single edge-set entry resolves to the edge observation', async () => {
    app = await createApp(1);
    const server = app.getHttpServer();

    for (let i = 0; i < GLOBAL_DEFAULT_LIMIT; i += 1) {
      expect(
        (await request(server).get('/users/me').set('X-Forwarded-For', '203.0.113.7')).status,
      ).toBe(200);
    }
    expect(
      (await request(server).get('/users/me').set('X-Forwarded-For', '203.0.113.7')).status,
    ).toBe(429);
    expect(
      (await request(server).get('/users/me').set('X-Forwarded-For', '203.0.113.8')).status,
    ).toBe(200);
  });

  /**
   * MODEL P — the unstated one. If an edge ever PREPENDED its observation
   * while preserving what the client sent, the rightmost entry would be the
   * client's string and a hop count would hand it straight over.
   *
   * Asserted as a POSITIVE result rather than a comment: sixty rotating
   * forgeries to the right of a fixed edge entry are all admitted. Nothing
   * about this test is a recommendation — it records what the failure would
   * look like so it is recognisable if it ever appears.
   */
  it('MODEL P — an edge observation to the LEFT of client data is not protection', async () => {
    app = await createApp(1);
    const server = app.getHttpServer();

    for (let i = 0; i < GLOBAL_DEFAULT_LIMIT * 3; i += 1) {
      const response = await request(server)
        .get('/users/me')
        .set('X-Forwarded-For', `203.0.113.7, ${forgedAddress(i)}`);
      expect(response.status).toBe(200);
    }
  });

  it('over-counting hops hands the attacker exactly what under-counting refused', async () => {
    app = await createApp(2);
    const server = app.getHttpServer();

    for (let i = 0; i < GLOBAL_DEFAULT_LIMIT * 2; i += 1) {
      const response = await request(server)
        .get('/users/me')
        .set('X-Forwarded-For', `${forgedAddress(i)}, 203.0.113.7`);
      expect(response.status).toBe(200);
    }
  });
});

/**
 * ── 5. WHAT ORDERING PERMITS A FIX TO DO ────────────────────────────────
 *
 * Any identity-based repair has to know when it runs. Nest executes global
 * guards (APP_GUARD) before controller- and route-level ones, so the throttler
 * decides before RequireAuthGuard has attached `request.user`.
 *
 * The consequence is concrete rather than academic: a session-keyed throttler
 * cannot read `request.user`. It must resolve the session itself, paying its
 * own lookup — which is precisely the trade AnalysisRateLimitGuard already
 * makes (modules/analysis/security/analysis-rate-limit.guard.ts, constructor
 * takes SessionService and canActivate awaits resolveIdentity).
 *
 * Asserted here rather than assumed, because the recommendation rests on it.
 */
describe('E1-R1 — guard ordering, which constrains any identity-based fix', () => {
  let app: INestApplication;

  beforeEach(async () => {
    routeGuardCalls.length = 0;
    app = await createApp(false);
  });

  afterEach(async () => {
    await app.close();
  });

  it('the global throttler rejects BEFORE any route guard runs, so request.user is unavailable to it', async () => {
    const server = app.getHttpServer();

    for (let i = 0; i < GLOBAL_DEFAULT_LIMIT; i += 1) {
      expect((await request(server).get('/guarded')).status).toBe(200);
    }
    expect(routeGuardCalls).toHaveLength(GLOBAL_DEFAULT_LIMIT);

    expect((await request(server).get('/guarded')).status).toBe(429);

    // The rejected request never reached the route guard: no new entry.
    expect(routeGuardCalls).toHaveLength(GLOBAL_DEFAULT_LIMIT);
  });
});

/**
 * ── 6. THE RECOMMENDED SHAPE, DEMONSTRATED BUT NOT ADOPTED ──────────────
 *
 * Everything above is a defect characterization. This last block shows that
 * the architecture recommended in the R1 report actually behaves the way the
 * report claims, so the recommendation is not taken on trust.
 *
 * IT IS DELIBERATELY CONFINED TO THIS FILE. R1 is not authorized to add a
 * session-keyed tracker to production code, and does not.
 *
 * The tracker below keys on a VALIDATED session — a lookup that either returns
 * a user id or does not — and ignores X-Forwarded-For entirely. Two properties
 * matter and both are asserted: an authenticated visitor gets their own bucket
 * that another visitor's traffic cannot consume, and an unauthenticated client
 * gains nothing by rotating forged headers.
 */
const SESSIONS: ReadonlyMap<string, string> = new Map([
  ['token-anna', 'user-anna'],
  ['token-ben', 'user-ben'],
]);

@Injectable()
class SessionKeyedThrottlerGuard extends ThrottlerGuard {
  /**
   * Async on purpose: the real implementation would await SessionService,
   * which hashes the opaque token and reads the Session row. Session tokens in
   * this repository are randomBytes(32) validated by database lookup
   * (auth/session-token.util.ts), not offline-verifiable, so the lookup is
   * unavoidable — the same cost AnalysisRateLimitGuard already accepts.
   */
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req.headers ?? {}) as Record<string, string | undefined>;
    const token = headers['x-session-token'];
    const userId = token ? SESSIONS.get(token) : undefined;

    // Note what is NOT consulted: req.ip, x-forwarded-for, x-real-ip.
    return userId ? `user:${userId}` : 'anonymous';
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: GLOBAL_DEFAULT_LIMIT }]),
  ],
  controllers: [UsersProbeController],
  providers: [{ provide: APP_GUARD, useClass: SessionKeyedThrottlerGuard }],
})
class SessionKeyedModule {}

describe('E1-R1 — a validated-session key, demonstrated in-spec only', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [SessionKeyedModule] }).compile();
    app = moduleRef.createNestApplication();
    /*
     * Deliberately the MOST permissive trust setting, not the least. With
     * `['loopback']` the socket peer is allowlisted, so Express would happily
     * turn each forged X-Forwarded-For into a distinct `req.ip`. Any test
     * below that still refuses forged identities is therefore proving the
     * tracker ignores the header, rather than inheriting that result from a
     * trust setting that was ignoring it anyway.
     */
    app.getHttpAdapter().getInstance().set('trust proxy', ['loopback']);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('one visitor exhausting their bucket leaves another visitor untouched', async () => {
    const server = app.getHttpServer();

    for (let i = 0; i < GLOBAL_DEFAULT_LIMIT; i += 1) {
      expect(
        (await request(server).get('/users/me').set('X-Session-Token', 'token-anna')).status,
      ).toBe(200);
    }
    expect(
      (await request(server).get('/users/me').set('X-Session-Token', 'token-anna')).status,
    ).toBe(429);

    expect(
      (await request(server).get('/users/me').set('X-Session-Token', 'token-ben')).status,
    ).toBe(200);
  });

  it('rotating forged X-Forwarded-For buys an unauthenticated client nothing', async () => {
    const server = app.getHttpServer();

    for (let i = 0; i < GLOBAL_DEFAULT_LIMIT; i += 1) {
      expect(
        (await request(server).get('/users/me').set('X-Forwarded-For', forgedAddress(i))).status,
      ).toBe(200);
    }

    const stillAnonymous = await request(server)
      .get('/users/me')
      .set('X-Forwarded-For', forgedAddress(999));

    expect(stillAnonymous.status).toBe(429);
  });

  /**
   * And the reason the anonymous bucket must be sized deliberately rather than
   * inherited: it is shared by everyone who has not signed in. A limit written
   * to mean "per visitor" becomes a site-wide ceiling the moment it is applied
   * to a key that every anonymous visitor shares. The recommendation therefore
   * asks for an explicit bounded bucket on the unauthenticated /auth routes,
   * not for the 20/60s default to be reused there by accident.
   */
  it('the anonymous bucket is shared, which is why it needs a deliberately chosen size', async () => {
    const server = app.getHttpServer();

    for (let i = 0; i < GLOBAL_DEFAULT_LIMIT; i += 1) {
      expect((await request(server).get('/users/me')).status).toBe(200);
    }

    const differentAnonymousVisitor = await request(server)
      .get('/users/me')
      .set('X-Forwarded-For', '203.0.113.77');

    expect(differentAnonymousVisitor.status).toBe(429);
  });
});

/**
 * ── 7. THE BOOT-LOG CONTRACT, AND WHAT E1-C2-R2 CHANGED ─────────────────
 *
 * Tests for trusted-proxy.config.ts's startup validator live HERE rather than
 * beside it, because the reason they exist is the finding above and because
 * the authorized file list has always named this file and that one — not the
 * existing trusted-proxy spec, which stays byte-for-byte untouched.
 *
 * E1-R1 raised a production WARNING on the hop-count form. E1-C2-R2 downgraded
 * it to an informational log, after the deployment's topology was confirmed and
 * the operator reviewed and accepted the precondition it names. The reasoning
 * is in trusted-proxy.config.ts; the short version is that a warning firing on
 * every boot for an accepted condition trains people to ignore the channel,
 * which is the same argument that file already makes for NOT warning on the
 * allowlist form.
 *
 * THE POINT OF THE BLOCK BELOW IS THAT THE DOWNGRADE IS BOUNDED. It asserts
 * what still warns and what still throws, not merely what went quiet — because
 * "we softened a warning" is exactly the kind of change that should have to
 * show its blast radius. Resolution behaviour is untouched in both directions:
 * resolveTrustProxySetting returns the same value for every input it ever did.
 */
function configWith(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('E1-C2-R2 — the hop-count form is informational, and nothing else moved', () => {
  let logs: string[];
  let warnings: string[];

  beforeEach(() => {
    logs = [];
    warnings = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
      warnings.push(String(message));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('LOGS rather than warns in production, and still names the precondition', () => {
    new TrustedProxyStartupValidator(
      configWith({ NODE_ENV: 'production', TRUST_PROXY: '1' }),
    ).onApplicationBootstrap();

    expect(warnings).toEqual([]);

    /*
     * Downgraded, not deleted. The deployment must still say out loud what its
     * trust model depends on — a silent hop count would be the actual
     * regression here, and it would look identical to a correct one.
     */
    const text = logs.join(' ');
    expect(text).toContain('hop(s) trusted');
    expect(text).toContain('cannot be reached');
    expect(text).toContain('re-confirmed whenever ingress changes');
  });

  it('does not fail boot — a reviewed topology is a legitimate deployment', () => {
    expect(() =>
      new TrustedProxyStartupValidator(
        configWith({ NODE_ENV: 'production', TRUST_PROXY: '3' }),
      ).onApplicationBootstrap(),
    ).not.toThrow();
  });

  it('stays quiet outside production, where the topology assumption is not being relied on', () => {
    new TrustedProxyStartupValidator(
      configWith({ NODE_ENV: 'development', TRUST_PROXY: '1' }),
    ).onApplicationBootstrap();

    expect(warnings).toEqual([]);
    expect(logs.join(' ')).toContain('proxy hop');
  });

  /**
   * ── THE BLAST RADIUS OF THE DOWNGRADE, PINNED ─────────────────────────
   *
   * The CTO ruling was explicit: downgrade the reviewed hop-count warning, do
   * NOT weaken genuine malformed-config warnings. These three cases are what
   * makes that checkable rather than asserted, and they would fail if a later
   * edit quietly widened the quiet.
   */
  it('UNSET in production still WARNS — that condition is unreviewed', () => {
    new TrustedProxyStartupValidator(
      configWith({ NODE_ENV: 'production' }),
    ).onApplicationBootstrap();

    expect(warnings.join(' ')).toContain('share ONE rate-limit identity');
  });

  /**
   * Asserting the MESSAGE, not merely that something threw, and the reason is
   * a probe result rather than a preference. Emptying the by-name rejection set
   * still throws — an unrecognised token falls through to the allowlist branch
   * and fails validation there — so a test that only checked `toThrow` passed
   * happily with the guard removed and proved nothing about it.
   *
   * The by-name rejection exists so the error explains WHY rather than reading
   * as a typo, which is a property only the message can carry.
   */
  it('an unrestricted value still THROWS BY NAME — no log level would make it safe', () => {
    for (const token of ['true', 'yes', 'on', '*', 'all', 'any']) {
      expect(() =>
        new TrustedProxyStartupValidator(
          configWith({ NODE_ENV: 'production', TRUST_PROXY: token }),
        ).onApplicationBootstrap(),
      ).toThrow(TrustProxyConfigurationError);

      expect(() =>
        new TrustedProxyStartupValidator(
          configWith({ NODE_ENV: 'production', TRUST_PROXY: token }),
        ).onApplicationBootstrap(),
      ).toThrow(/forge a fresh rate-limit identity/);
    }

    expect(warnings).toEqual([]);
    expect(logs).toEqual([]);
  });

  it('a malformed value still THROWS, in production and outside it alike', () => {
    for (const nodeEnv of ['production', 'development']) {
      expect(() =>
        new TrustedProxyStartupValidator(
          configWith({ NODE_ENV: nodeEnv, TRUST_PROXY: 'not-an-address' }),
        ).onApplicationBootstrap(),
      ).toThrow(TrustProxyConfigurationError);

      expect(() =>
        new TrustedProxyStartupValidator(
          configWith({ NODE_ENV: nodeEnv, TRUST_PROXY: '99' }),
        ).onApplicationBootstrap(),
      ).toThrow(TrustProxyConfigurationError);
    }
  });

  /**
   * The allowlist form is NOT warned about. It is the correct choice wherever
   * the trusted peer appends its own observation, and warning on every boot
   * would train operators to ignore the channel. What the allowlist cannot do
   * for the six relayed families is recorded in the file's doc comment and
   * proven by the cases above, which is the honest place for it.
   */
  it('leaves the allowlist form logged rather than warned', () => {
    new TrustedProxyStartupValidator(
      configWith({ NODE_ENV: 'production', TRUST_PROXY: '10.0.0.0/8' }),
    ).onApplicationBootstrap();

    expect(warnings).toEqual([]);
    expect(logs.join(' ')).toContain('allowlist');
  });
});
