import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SECURITY_COVERAGE_AXES, type NewsArticle } from '@globalnews-ai/shared';
import { ArticlePersistenceService } from '../news/persistence/article-persistence.service';
import { SecurityController } from './security.controller';
import { SecurityReadService } from './security-read.service';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE ROUTE, OVER REAL HTTP
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Asserted through the wire rather than by calling the controller method, because the two
 * behaviours that matter here are not properties of the method:
 *
 *   THE VALIDATION PIPE. `limit=999` and `limit=abc` must be refused with a 400 BEFORE any
 *   method body runs. Calling the method directly would skip the pipe entirely and the test
 *   would pass with no validation wired at all.
 *
 *   THE STATUS CODE FOR "NOTHING TO SHOW". A geography with nothing retained is a 200 with a
 *   stated absence, NOT a 404. A 404 says "we have no such country"; what is true is "we have
 *   nothing to show for this country", and those are the two sentences this contract exists
 *   to keep apart. Only an HTTP test can tell them apart.
 */

const KIGALI_SHOOTING: NewsArticle = {
  id: 'article-1',
  title: 'Man shot dead in Kigali robbery',
  summary: 'Police said a suspect was arrested after the attack on a shop.',
  url: 'https://example.test/a/1',
  sourceId: 'rwanda-times',
  sourceName: 'The Rwanda Times',
  category: 'world',
  sourcesCount: 1,
  publishedAt: '2026-09-20T08:00:00.000Z',
  publishedAtBasis: 'publisher',
  firstSeenAt: '2026-09-20T09:00:00.000Z',
  providerId: 'gnews',
  confidence: 82,
  countryCode: 'RW',
  countryName: 'Rwanda',
};

class FakeArticles {
  articles: NewsArticle[] = [];
  async findRecentByCountry(): Promise<NewsArticle[]> {
    return this.articles;
  }
}

describe('GET /security/observations/:countryCode', () => {
  let app: INestApplication;
  let articles: FakeArticles;

  beforeEach(async () => {
    articles = new FakeArticles();

    const moduleRef = await Test.createTestingModule({
      controllers: [SecurityController],
      providers: [SecurityReadService, { provide: ArticlePersistenceService, useValue: articles }],
    }).compile();

    app = moduleRef.createNestApplication();
    /*
      The same pipe configuration `main.ts` applies globally. Asserting validation against a
      different configuration than production runs would prove nothing about production.
    */
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('withholds retained content before public activation', async () => {
    articles.articles = [KIGALI_SHOOTING];

    const response = await request(app.getHttpServer())
      .get('/security/observations/RW')
      .expect(200);

    expect(response.body.observations).toHaveLength(0);
    expect(response.body.absence).toBe('NOT_ASSESSED');
  });

  /** A geography with nothing retained is a 200 and a stated absence. Never a 404. */
  it('answers 200 with an empty array and a stated absence when nothing is retained', async () => {
    const response = await request(app.getHttpServer())
      .get('/security/observations/KE')
      .expect(200);

    expect(response.body.observations).toEqual([]);
    expect(response.body.absence).toBe('NOT_ASSESSED');
    expect(response.body.geographyId).toBe('KE');
  });

  it('always reports all five axes, even with nothing to show', async () => {
    const response = await request(app.getHttpServer())
      .get('/security/observations/KE')
      .expect(200);

    expect(response.body.coverage).toHaveLength(SECURITY_COVERAGE_AXES.length);
    const axes = response.body.coverage.map((c: { axis: string }) => c.axis).sort();
    expect(axes).toEqual([...SECURITY_COVERAGE_AXES].sort());
  });

  it('always states the partial limitations and a null change state with its reason', async () => {
    const response = await request(app.getHttpServer())
      .get('/security/observations/KE')
      .expect(200);

    expect(response.body.limitations).toEqual([]);
    expect(response.body.changeState).toBeNull();
    expect(typeof response.body.changeStateReason).toBe('string');
    expect(response.body.changeStateReason.length).toBeGreaterThan(0);
  });

  it('accepts the two documented query parameters', async () => {
    articles.articles = [KIGALI_SHOOTING];

    await request(app.getHttpServer())
      .get('/security/observations/RW?limit=5&maxAgeMinutes=60')
      .expect(200);
  });

  it('refuses an out-of-range limit before the handler runs', async () => {
    await request(app.getHttpServer()).get('/security/observations/RW?limit=999').expect(400);
  });

  it('refuses a non-numeric limit', async () => {
    await request(app.getHttpServer()).get('/security/observations/RW?limit=abc').expect(400);
  });

  it('refuses an unbounded age window', async () => {
    await request(app.getHttpServer())
      .get('/security/observations/RW?maxAgeMinutes=999999')
      .expect(400);
  });

  it('exposes no write verb on the route', async () => {
    await request(app.getHttpServer()).post('/security/observations/RW').expect(404);
    await request(app.getHttpServer()).delete('/security/observations/RW').expect(404);
    await request(app.getHttpServer()).patch('/security/observations/RW').expect(404);
  });

  it('sends no internal-only absence state on the wire', async () => {
    const response = await request(app.getHttpServer())
      .get('/security/observations/KE')
      .expect(200);

    const payload = JSON.stringify(response.body);
    for (const internalOnly of [
      'EVIDENCE_WITHHELD',
      'SOURCE_NOT_CONNECTED',
      'SOURCE_TEMPORARILY_UNAVAILABLE',
    ]) {
      expect(payload).not.toContain(internalOnly);
    }
  });

  it('needs no session — it is a public, session-blind read', async () => {
    articles.articles = [KIGALI_SHOOTING];

    // No cookie, no CSRF header, no Authorization.
    await request(app.getHttpServer()).get('/security/observations/RW').expect(200);
  });
});
