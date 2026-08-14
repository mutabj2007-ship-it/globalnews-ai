import { Controller, Get, INestApplication, Module, Query, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import helmet from 'helmet';
import request from 'supertest';
import { SearchNewsDto } from '../src/modules/news/dto/search-news.dto';

/**
 * Milestone #56 — focused regression coverage for the two approved
 * changes: SearchNewsDto.q's new @MaxLength(300), and Helmet's
 * default security headers.
 *
 * Placed under backend/test/ (not backend/src/) so it is actually
 * discovered by test/jest-e2e.json's rootDir/testRegex — the exact
 * lesson learned from the M55 test-placement correction, and the
 * same defect independently confirmed still present in the existing
 * backend/src/security/rate-limit.e2e-spec.ts during M56 investigation.
 *
 * Uses a minimal standalone probe module (matching the established
 * convention already used by rate-limit.e2e-spec.ts) with a trivial
 * handler that returns immediately once SearchNewsDto validation
 * passes — this proves DTO validation and Helmet header behavior in
 * isolation, without ever calling NewsService, GNewsProvider, or any
 * real external news/AI provider.
 */
@Controller('probe')
class ProbeController {
  @Get('search')
  search(@Query() query: SearchNewsDto): { q: string } {
    return { q: query.q };
  }
}

@Module({
  controllers: [ProbeController],
})
class ProbeModule {}

describe('SearchNewsDto length limit + Helmet security headers (Milestone #56)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
    app = moduleRef.createNestApplication();

    // Mirrors main.ts's real bootstrap exactly: Helmet registered,
    // then the same ValidationPipe options (whitelist,
    // forbidNonWhitelisted, transform) already used in production —
    // so this test exercises the real validation configuration, not
    // a weaker stand-in.
    app.use(helmet());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('A. search query over 300 characters is rejected', () => {
    it('returns HTTP 400 for a 301-character q', async () => {
      const tooLong = 'a'.repeat(301);

      await request(app.getHttpServer()).get('/probe/search').query({ q: tooLong }).expect(400);
    });
  });

  describe('B. a legitimate <=300-character query passes DTO validation', () => {
    it('returns 200 for a query at exactly the 300-character boundary', async () => {
      const atLimit = 'a'.repeat(300);

      const response = await request(app.getHttpServer())
        .get('/probe/search')
        .query({ q: atLimit })
        .expect(200);

      expect(response.body.q).toBe(atLimit);
    });

    it('returns 200 for an ordinary short, real-world-shaped query', async () => {
      const response = await request(app.getHttpServer())
        .get('/probe/search')
        .query({ q: 'Rwanda migration policy' })
        .expect(200);

      expect(response.body.q).toBe('Rwanda migration policy');
    });
  });

  describe('C. normal HTTP responses contain representative Helmet security headers', () => {
    it('a successful response includes Helmet\u2019s default headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/probe/search')
        .query({ q: 'Rwanda migration policy' })
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-dns-prefetch-control']).toBeDefined();
      expect(response.headers['x-download-options']).toBeDefined();
    });

    it('an error response (the 400 from requirement A) ALSO carries Helmet headers \u2014 not only successful ones', async () => {
      const tooLong = 'a'.repeat(301);

      const response = await request(app.getHttpServer())
        .get('/probe/search')
        .query({ q: tooLong })
        .expect(400);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('D. existing response contracts are otherwise preserved', () => {
    it('SearchNewsDto.limit validation (unchanged, pre-existing @Min/@Max) still behaves exactly as before', async () => {
      await request(app.getHttpServer())
        .get('/probe/search')
        .query({ q: 'valid query', limit: 51 })
        .expect(400);

      await request(app.getHttpServer())
        .get('/probe/search')
        .query({ q: 'valid query', limit: 50 })
        .expect(200);
    });

    it('a missing required q still fails validation exactly as before this change', async () => {
      await request(app.getHttpServer()).get('/probe/search').expect(400);
    });
  });
});
