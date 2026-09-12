import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { resolveFrontendOrigin } from './security/cors-startup-validator';
import { resolveTrustProxySetting } from './security/trusted-proxy.config';
import { createProxyChainDiagnostic } from './security/proxy-chain-diagnostic';
import { createAuthenticatedCacheHeaders } from './security/authenticated-cache-headers';
import { createPublicCacheHeaders } from './security/public-cache-headers';
import { resolveAuthSecretsMode } from './security/auth-secrets.config';

/**
 * S1 — explicit request body-size limit.
 *
 * Before S1 there was no body-parser configuration anywhere in this
 * repository, so body-parser's own default of '100kb' applied by INHERITANCE
 * rather than by decision. 100kb is a defensible number; inheriting it
 * silently is not, because nobody had checked it against what this API
 * actually accepts.
 *
 * 64kb is chosen from the largest legitimate payload, not from a round
 * number. The biggest DTO in the codebase is a support ticket — subject 200 +
 * description 5000 + message 5000 characters, roughly 10,200 characters of
 * user text. class-validator's @MaxLength counts UTF-16 code units while this
 * limit counts BYTES, so a submission written entirely in a multi-byte script
 * can be several times larger than its character count suggests: around
 * 20-25kB in the worst realistic case. 64kb clears that comfortably while
 * still refusing roughly a third of what was previously accepted, and it is
 * far below anything that could be used to make the parser do real work.
 *
 * Deliberately NOT an environment variable. This is a security bound, not a
 * tuning knob, and a deployment that needs to raise it has a DTO problem
 * rather than a configuration problem.
 */
const REQUEST_BODY_LIMIT = '64kb';

async function bootstrap(): Promise<void> {
  // S1 — fail closed BEFORE anything else happens, and specifically before the
  // port opens. Mirrors the timing note in cors-startup-validator.ts and
  // trusted-proxy.config.ts: the matching DI validator runs on Nest's
  // OnApplicationBootstrap hook, which fires AFTER the HTTP server is already
  // listening, so main.ts is where the real fail-closed effect has to live.
  // Both call the identical function, so they can never disagree.
  //
  // Refuses to start a PRODUCTION deployment whose OAuth secrets are missing,
  // blank, or still set to a placeholder shipped in .env.example — most
  // importantly OAUTH_FLOW_SECRET, the HMAC key authenticating the OAuth
  // flow-state cookie. Outside production it does nothing at all, so guest
  // development and a fresh checkout using .env.example verbatim are unchanged.
  resolveAuthSecretsMode(process.env.NODE_ENV, {
    OAUTH_CLIENT_ID: process.env.OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET,
    OAUTH_FLOW_SECRET: process.env.OAUTH_FLOW_SECRET,
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // S1 — see REQUEST_BODY_LIMIT above. Applied before every other middleware
  // registration below so the bound is in force for every route this process
  // ever serves, including routes added later by a lane that never reads this
  // file.
  app.useBodyParser('json', { limit: REQUEST_BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: REQUEST_BODY_LIMIT, extended: true });

  // Milestone #56 — Helmet's default configuration (no custom CSP or
  // header policy): this backend serves no HTML/static content that
  // would require CSP tuning, it's a pure JSON API, so the default
  // header set (X-Content-Type-Options, X-Frame-Options, etc.) is
  // appropriate as-is. Registered before enableCors()/ValidationPipe
  // below, which are both unchanged by this addition — Helmet only
  // adds response headers, it does not alter request parsing,
  // validation, or CORS behavior in any way.
  app.use(helmet());

  // Milestone #57 — required so incoming requests to authenticated
  // routes (RequireAuthGuard/CsrfGuard) can read req.cookies at all.
  // Setting cookies (response.cookie(...)) is already built into
  // Express and needed no new dependency; only READING an incoming
  // cookie header requires this middleware.
  app.use(cookieParser());

  // Milestone #34: origin resolution is shared with CorsStartupValidator
  // via resolveFrontendOrigin() — fails closed (throws) in production
  // when FRONTEND_ORIGIN is missing/empty/whitespace-only, rather than
  // silently falling back to the development localhost origin.
  //
  // Milestone #57 — credentials: true is now required so the browser
  // will send/receive the session and CSRF cookies on cross-origin
  // requests between the frontend and backend origins. This does NOT
  // weaken the existing origin restriction: the CORS spec itself
  // forbids a wildcard origin whenever credentials are enabled, and
  // resolveFrontendOrigin() already only ever returns a specific,
  // fail-closed-validated origin — never '*' — so this is additive,
  // not a loosening of the existing policy.
  // B-1 - bounded proxy trust, resolved from the same shared function the
  // TrustedProxyStartupValidator uses, and set BEFORE enableCors() so every
  // request this process ever serves is matched by the same client-address
  // model. Defaults to false, which is the pre-B-1 behaviour exactly: req.ip
  // stays the direct socket peer and no X-Forwarded-For header is believed.
  //
  // Why this matters beyond correctness of req.ip: @nestjs/throttler's default
  // tracker IS req.ip. Without this, every visitor behind a reverse proxy, CDN
  // or load balancer shares one rate-limit bucket per handler - including the
  // deliberately strict 5/60s limit on POST /analysis/news, which would be five
  // requests per minute for the entire site rather than five per person.
  //
  // resolveTrustProxySetting() rejects the string "true" outright: it would
  // trust the whole X-Forwarded-For chain and let any client forge a fresh
  // bucket per request. See that function's own doc comment.
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', resolveTrustProxySetting(process.env.NODE_ENV, process.env.TRUST_PROXY));

  // E1-C2 / Q-6 — the observation, immediately after the line above, because
  // this is where the trust model is decided and the diagnostic reports what
  // that decision produced in the real topology.
  //
  // Emits AT MOST TWO log lines for the life of the process — one for the first
  // request to a first-party proxy family, one for the first request to
  // anything else — each containing a path class and four integers: how many
  // entries the forwarded chain had, how many Express trusted, and which
  // position it resolved to counted from each end. NO ADDRESS IS RECORDED, in
  // any form, from any source.
  //
  // Two lines rather than one because this deployment USED TO HAVE two live
  // ingress paths — the families arrived through the Next frontend over
  // railway.internal, while analysis and news arrived straight from the edge —
  // and `trust proxy` is a single setting that had to be correct for both. One
  // sample could not tell you it was wrong for the other.
  //
  // E1-N-2 — THAT IS NO LONGER TRUE, AND AN EMPTY SECOND CLASS IS NOW EXPECTED.
  // R2 proxied analysis. The converged release proxies news as a PUBLIC,
  // non-/api family. With both moved, the Next frontend proxy is the SOLE
  // browser ingress and the two path classes collapse into one.
  //
  // A reader seeing the direct-from-edge path class go empty must NOT read it as
  // a broken diagnostic. It is the intended end state, and it STRENGTHENS the
  // TRUST_PROXY=1 position rather than threatening it: one setting now has to be
  // correct for one chain shape instead of two differently-shaped ones, which is
  // what makes M-20's "expect exactly ONE path class" achievable in production
  // and not only on alpha.
  //
  // TRUST_PROXY stays at 1 and is not reopened. The Next hop contributes nothing
  // to the chain — it forwards a client-supplied X-Forwarded-For verbatim and
  // never appends its own observation (see trusted-proxy.config.ts) — so a
  // request arriving via the proxy resolves to the same client address as one
  // arriving direct. Two lines are kept so the collapse itself stays observable.
  //
  // It exists because Railway's edge does not document its X-Forwarded-For
  // behaviour and its staff have described it two incompatible ways, and
  // Express resolves only from the right. A dashboard can show what the edge
  // saw; nothing outside this process can show what this process received.
  //
  // Registered as plain Express middleware rather than through the Nest
  // lifecycle so it runs BEFORE the global ThrottlerGuard: a request that is
  // about to be refused with 429 has just as much to say about the chain shape
  // as one that succeeds. See security/proxy-chain-diagnostic.ts.
  app.use(createProxyChainDiagnostic());

  // E1-M-4 / R-2 — cache privacy for the seven same-origin proxied API
  // families. Registered here, immediately after the diagnostic and BEFORE
  // enableCors(), for two reasons. Setting Cache-Control on the way in means
  // a 401 from RequireAuthGuard carries it just as an authenticated 200 does,
  // with no guard or controller having to remember. And res.vary() MERGES, so
  // the Vary: Origin that enableCors() adds immediately below survives
  // alongside Cookie rather than replacing it. See
  // security/authenticated-cache-headers.ts.
  app.use(createAuthenticatedCacheHeaders());

  // E1-N-4 — the public counterpart: /news is classified PUBLIC explicitly
  // rather than inheriting a default. It is stated here, not in next.config's
  // headers(), because the rehearsal measured that a rewritten response receives
  // nothing from that block. No Vary: Cookie — the response does not vary by
  // session, and news-session-blindness.spec.ts is what keeps that true.
  // See security/public-cache-headers.ts.
  app.use(createPublicCacheHeaders());

  app.enableCors({
    origin: resolveFrontendOrigin(process.env.NODE_ENV, process.env.FRONTEND_ORIGIN),
    credentials: true,
  });

  // Validates and transforms all incoming request DTOs (query params,
  // route params, bodies) using class-validator/class-transformer.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // S1 — let Nest run its shutdown hooks on SIGTERM/SIGINT instead of the
  // process dying mid-request. Without this a rolling deploy drops every
  // in-flight request at the moment the old container is signalled, which
  // shows up as intermittent user-visible failures that look like application
  // bugs. It also gives PrismaService.onModuleDestroy a chance to close the
  // connection pool rather than leaving sockets for the database to reap.
  app.enableShutdownHooks();

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`GlobalNews AI backend is running on: http://localhost:${port}`);
}

bootstrap().catch((error: unknown) => {
  // Milestone #30/#33/#34: makes the fail-closed startup paths (see
  // AnalysisStartupValidator, NewsStartupValidator, resolveFrontendOrigin)
  // explicit rather than relying on Node's default unhandled-rejection
  // behavior. error.message here is safe to log as-is — none of these
  // fail-closed errors ever include the underlying secret/config value
  // itself, only the fact that it's unusable.
  // eslint-disable-next-line no-console
  console.error(
    'GlobalNews AI backend failed to start:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
