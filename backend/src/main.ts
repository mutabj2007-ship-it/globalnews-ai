import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for the Next.js frontend during local development.
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
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
  // Milestone #30: makes the fail-closed startup path (see
  // AnalysisStartupValidator) explicit rather than relying on Node's
  // default unhandled-rejection behavior. error.message here is safe to
  // log as-is — the validator's thrown errors never include the
  // OPENAI_API_KEY value itself, only the fact that it's unusable.
  // eslint-disable-next-line no-console
  console.error(
    'GlobalNews AI backend failed to start:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
