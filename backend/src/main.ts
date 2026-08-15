import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { resolveFrontendOrigin } from './security/cors-startup-validator';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

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
