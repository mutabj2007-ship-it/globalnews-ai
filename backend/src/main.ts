import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { resolveFrontendOrigin } from './security/cors-startup-validator';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Milestone #34: origin resolution is shared with CorsStartupValidator
  // via resolveFrontendOrigin() — fails closed (throws) in production
  // when FRONTEND_ORIGIN is missing/empty/whitespace-only, rather than
  // silently falling back to the development localhost origin.
  app.enableCors({
    origin: resolveFrontendOrigin(process.env.NODE_ENV, process.env.FRONTEND_ORIGIN),
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
