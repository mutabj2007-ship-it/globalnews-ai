import { AskV2Module } from './modules/ask-v2/ask-v2.module';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { NewsModule } from './modules/news/news.module';
import { EconomyModule } from './modules/economy/economy.module';
import { MarketReadModule } from './modules/market-ingest/market-read.module';
import { ConflictObservationModule } from './modules/conflict-observation/conflict-observation.module';
import { GeoModule } from './modules/geo/geo.module';
import { SignalsModule } from './modules/signals/signals.module';
import { CorsStartupValidator } from './security/cors-startup-validator';
import { TrustedProxyStartupValidator } from './security/trusted-proxy.config';
import { PublicBackendOriginStartupValidator } from './security/public-backend-origin.config';
import { PublicOAuthCallbackBaseStartupValidator } from './security/public-oauth-callback-base.config';
import { AuthSecretsStartupValidator } from './security/auth-secrets.config';
import { LoggingInterceptor } from './observability/logging.interceptor';
import { GlobalExceptionFilter } from './observability/global-exception.filter';
import { RequestIdMiddleware } from './observability/request-id.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HistoryModule } from './modules/history/history.module';
import { AdminModule } from './modules/admin/admin.module';
import { SupportModule } from './modules/support/support.module';
import { FollowsModule } from './modules/follows/follows.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { SituationModule } from './modules/situation/situation.module';
import { ConflictClaimModule } from './modules/conflict-claim/conflict-claim.module';
import { TelemetryInterceptor } from './modules/telemetry/telemetry.interceptor';
import {
  humanitarianModuleImports,
  HUMANITARIAN_PROVISIONING,
} from './modules/humanitarian/humanitarian.registration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Milestone #34: global default rate limit — 20 requests / 60s per
    // client (see ThrottlerGuard registration below, applied globally
    // via APP_GUARD). Individual routes override this with @Throttle()
    // (e.g. POST /analysis/news) or opt out with @SkipThrottle()
    // (e.g. GET /health).
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 20,
      },
    ]),
    PrismaModule,
    HealthModule,
    NewsModule,
    /*
      ECONOMY — ONE READ ROUTE OVER RETAINED EVIDENCE, AND NO PROVIDER.

      It serves the NISR CPI observation the governed pipeline retained. Registering it
      adds no transport, no scheduler and no provider: nothing in its dependency graph
      can issue a request, so ordinary navigation over this route contacts nobody and
      consumes no GNews quota.
    */
    EconomyModule,
    /*
      MARKET — RETAINED READ ONLY.

      This module exposes only MarketObservation rows already retained in Prisma.
      It imports no scheduler, provider registry, transport or adapter, so page
      navigation cannot activate TED, Eurostat, GLEIF or any other acquisition.
    */
    MarketReadModule,
    /*
      CONFLICT — RETAINED READ ONLY.

      No Conflict producer is activated here. Until Product Owner approval of a
      rights-cleared producer, this module can only return rows already retained
      in the provider-neutral ConflictObservation table.
    */
    ConflictObservationModule,
    /*
      GEO — the PUBLIC geographic resolution routes (E1-GEO-PUBLIC-REWRITE-REVIEW-1).

      Forward-ported byte-identical from formal C55 `3db5a09`. NO PROVIDERS AND
      NO DEPENDENCIES: the resolver is a pure function over a gazetteer loaded
      from disk, so registering it buys exactly one thing — the controller's
      routes — and buys it without touching Prisma, the schema or a migration.

      G-8 SEQUENCING: this registration comes FIRST. The `/geo/:path*` rewrite
      in `frontend/next.config.mjs` is second, because a rewrite to an
      unregistered route is still a 404 and is not integration.

      G-4/G-5: `/geo/map-feed` is a TEXT -> GAZETTEER RESOLVER. It is not
      authority to read stored or private evidence, and nothing here joins it
      to one. A future stored-evidence join requires its own security gate.
    */
    GeoModule,
    AnalysisModule,
    // M64.3 — Signals Runtime Orchestration Foundation. Internal only:
    // SignalsModule exports SignalsService, but registers no
    // controller and no public route. Importing it here makes the
    // already-built M64.1/M64.2 signal architecture (SignalProvider,
    // GdeltProvider) reachable via real NestJS DI for the first time,
    // without changing any existing endpoint's behavior. Constructing
    // this module performs zero GDELT HTTP requests and never
    // requires GDELT to be enabled or configured — see
    // signals.module.ts's own doc comment for the full reasoning.
    SignalsModule,
    // Milestone #57 — optional accounts & user continuity. None of
    // these three modules place a guard anywhere near the existing
    // News/Analysis/Health routes — every guest capability remains
    // exactly as unauthenticated as before this addition.
    AuthModule,
    UsersModule,
    HistoryModule,
    // Additive, authenticated, default-off; execution port remains on CTO HOLD.
    AskV2Module,
    // Milestone F1.a — administrative authorization foundation. This
    // is the ONLY line of any pre-existing file that F1.a changes.
    // Registering the module places no guard anywhere near an existing
    // route: every public capability (homepage, search, map, analysis,
    // news, health) remains exactly as unauthenticated as before, and
    // /users/me and /history keep the guards they already had.
    //
    // The admin surface additionally sits behind ADMIN_PLATFORM_ENABLED,
    // which is fail-closed: unset or anything other than "true" makes
    // every /admin route return 404, whoever is asking.
    AdminModule,
    // Support loop S1 — contracts and persistence only. The module
    // declares no controller and no provider, so this registration adds
    // no route and changes no behaviour; it is the reviewed landing
    // point for S2's controller and service.
    SupportModule,
    // R1/T3 — authenticated country follow. Adds three authenticated
    // routes and places no guard anywhere near an existing one; every
    // guest capability stays exactly as unauthenticated as before.
    FollowsModule,
    // R3/T7 — the telemetry foundation. Registers one public write
    // endpoint and the analysis interceptor below. Adds NO third-party
    // dependency: no analytics SDK, no beacon, no advertising tracker.
    TelemetryModule,
    /*
      ── SITUATION MEMORY SUBSTRATE — S1-R2 ──────────────────────────────

      Authorised by Product-Owner ruling 1 of
      MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1: "Authorize implementation of
      the Situation runtime substrate in the candidate." This single line is
      the activation that `situation.module.ts` has always said belongs to a
      later tranche, and the module's own file is byte-identical to the
      accepted authority — the activation is HERE, not inside it.

      WHAT REGISTERING THIS DOES, AND WHAT IT POINTEDLY DOES NOT.
      SituationModule declares NO controller, so this adds ZERO routes and
      changes no request path. It instantiates three providers over the five
      new tables and exports `SituationService` for the tranche that wires a
      call site. Nothing calls it yet.

      THE IDENTITY PORT STAYS UNWIRED, DELIBERATELY. It is bound to
      `UNWIRED_SITUATION_IDENTITY_PORT`, whose every method throws
      `SituationIdentityPortNotWiredError`. G's `situation-identity.contract.ts`
      IS now present in this worktree, so the real adapter could be bound —
      and it is not, because the accepted authority binds the unwired default
      and binding the adapter is a separate decision, not a side effect of
      converging the substrate. An inert substrate that throws if touched is
      the honest state; a silently live identity policy would not be.

      WATCH IS NOT ACTIVATED BY THIS. The ruling says so explicitly, and
      nothing here reaches Watch: no WatchModule, no scheduler, no route.
    */
    SituationModule,
    /*
      -- CONFLICT: THE SPECIALIST CLAIM BOUNDARY, RESTORED -------------------

      Forward-ported from canonical under Product-Owner ruling 3, which found
      that this lineage had DE-REGISTERED a capability canonical activates.
      Canonical's own words for this line: "P4 - Conflict's SS16 claim
      registration, and the line that activates the specialist claim boundary
      for the first time. ConflictClaimModule imports SpecialistModule and
      registers ONE row at initialisation."

      WHAT IT CHANGES, AND WHAT IT POINTEDLY DOES NOT. It adds no route, no
      controller and no provider to the live path. Nothing calls the registry.
      What changes is that the platform's canonical register stops being empty:
      `registeredDomains()` returns ['CONFLICT'] instead of [].

      THE CLOSURE WAS MEASURED, NOT GUESSED. conflict-claim and specialist
      import only each other, `@globalnews-ai/shared`, `@nestjs/common` and two
      geo utilities - `geo-normalize.util` and `geo-resolver` - both of which
      were already present here and byte-identical to canonical. No unrelated
      canonical backend file was copied.
    */
    ConflictClaimModule,

    /*
      HUMANITARIAN — AUTHORITY VALIDATION AT STARTUP, ACQUISITION STILL OFF.

      ALPHA-HUMANITARIAN-BOOT-INTAKE-R1 part B, wiring G's R1.2 composition root into
      the real module lifecycle. HumanitarianAuthorityBootstrap implements OnModuleInit,
      so the governed rows are read, digested and verified BEFORE this process serves
      anything — and a failure refuses the start rather than degrading.

      SPREAD, NOT IMPORTED DIRECTLY, and the difference is the control. Humanitarian
      runs only where its authority store is provisioned; where it is not, the module is
      absent entirely and nothing Humanitarian serves. The state that cannot be
      expressed here is "provisioned, validation failed, carry on" — see
      modules/humanitarian/humanitarian.registration.ts.

      Importing this buys the authority load and the capability registry. It registers
      no controller and no route, and buys nothing that can reach a publisher:
      COPERNICUS_PRODUCER_ENABLED is the literal false, and boot refuses to start if it
      ever is not.
    */
    ...humanitarianModuleImports(HUMANITARIAN_PROVISIONING),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Milestone #34: fail-closed startup guard, same registration
    // pattern as AnalysisStartupValidator (M30) / NewsStartupValidator
    // (M33) — see security/cors-startup-validator.ts.
    CorsStartupValidator,
    // B-1 - fail-closed guard for TRUST_PROXY, registered exactly like
    // CorsStartupValidator above so Nest's OnApplicationBootstrap lifecycle
    // invokes it automatically. It calls the same resolver main.ts calls, so
    // the two can never disagree about what a given TRUST_PROXY value means.
    TrustedProxyStartupValidator,
    // B-2 repair - fail-closed guard for PUBLIC_BACKEND_ORIGIN.
    //
    // THIS ONE IS NOT DEFENCE IN DEPTH, UNLIKE THE TWO ABOVE. main.ts calls the
    // CORS and trust-proxy resolvers directly before listen(), so those two are
    // already enforced by the time this lifecycle runs. The public backend origin
    // is consumed PER REQUEST inside AuthService, so without this provider nothing
    // would evaluate it at boot: a production deployment with PUBLIC_BACKEND_ORIGIN
    // unset would start healthy, pass its healthcheck, and fail only at the first
    // sign-in. That is the defect this repair exists to close, returning in a
    // different costume. Do not remove it without replacing the boot-time check.
    PublicBackendOriginStartupValidator,
    // M-ALPHA-AUTH Option A - fail-closed guard for PUBLIC_OAUTH_CALLBACK_BASE,
    // registered here for exactly the reason the validator above is: the value is
    // consumed PER REQUEST inside AuthService, so nothing else would evaluate it
    // at boot. A malformed base would start healthy and fail at the first sign-in.
    //
    // It is a SEPARATE provider rather than an addition to the one above because
    // the two guard differently-named variables with different contracts -
    // PUBLIC_BACKEND_ORIGIN is origin-only and unchanged; this one permits a
    // narrow path prefix because Option A's callback is served from <FRONTEND>/api.
    PublicOAuthCallbackBaseStartupValidator,
    // S1 - closes the one gap in this codebase's fail-closed pattern: every
    // other security-critical value already refuses to boot in production when
    // it is unusable, and the OAuth secrets did not. Registered alongside the
    // two validators above for the same reason they are here, and it calls the
    // same function main.ts calls before app.listen(), so the DI guard and the
    // real boot gate can never disagree. Outside production it is a no-op.
    AuthSecretsStartupValidator,
    // Milestone #55 (unmatched-route correlation fix) — must be
    // registered as a provider so Nest's DI can construct it for
    // consumer.apply() in configure() below.
    RequestIdMiddleware,
    // Milestone #34: applies the ThrottlerModule config above to every
    // route by default.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Milestone #55 — global request correlation + HTTP access
    // logging. Runs on every request (registered before the exception
    // filter so its own request-start log always precedes anything
    // the filter might log for the same request).
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Milestone #55 — catches every exception app-wide. Preserves the
    // existing status code/response body for any HttpException
    // (validation 400s, throttling 429s, health-check 503s, 404s,
    // etc.) unchanged; only genuinely unexpected errors are converted
    // to a sanitized generic 500 — see global-exception.filter.ts's
    // own doc comment for the full reasoning.
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // R3/T7 — persists AnalysisProvenance, which the analysis pipeline
    // already produces on every response, WITHOUT modifying one file
    // under modules/analysis/. Registered after the logging interceptor
    // so it observes the same responses that are already logged, and its
    // write is fire-and-forget: a telemetry failure can never fail a
    // user's analysis request. See telemetry.interceptor.ts.
    {
      provide: APP_INTERCEPTOR,
      useClass: TelemetryInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Milestone #55 (unmatched-route correlation fix) — RequestIdMiddleware
   * must run before Nest's router, so it (and therefore the
   * X-Request-Id header + AsyncLocalStorage context it establishes)
   * covers every request, including one that matches no route at all
   * and produces a 404 straight from GlobalExceptionFilter — a case
   * LoggingInterceptor (which only runs after routing succeeds) can
   * never reach.
   *
   * Wildcard syntax note: this repository's real installed
   * @nestjs/platform-express is ^10.3.0 (confirmed via direct
   * package.json inspection, not assumed), which uses Express 4 and
   * path-to-regexp v6. The newer named-wildcard form ('{*splat}') is
   * specific to path-to-regexp v8, paired with Express 5 / NestJS 11
   * — NOT what this repository runs. The classic '*' form is the
   * version-correct choice here.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
