import { randomUUID } from 'node:crypto';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { PrismaClient } from '../generated/prisma/client';
import type { PrismaService } from '../database/prisma.service';
import { ArticlePersistenceService } from '../modules/news/persistence/article-persistence.service';
import { PublisherImageWithholdingInterceptor } from './publisher-image-withholding.interceptor';

/*
  U-1 R2 · E1-22 A-7 — containment is READ-PATH ONLY. A real stored Article (with an imageUrl) is
  read through the real repository and the global boundary: the response carries the article without
  the image, and the database row still holds its imageUrl afterwards (no delete, no UPDATE).
*/
const url = process.env.ASK_V2_TEST_DATABASE_URL;
if (url && !/^postgresql:\/\/askv2test@127\.0\.0\.1:\d+\/ask_v2_test$/.test(url)) {
  throw new Error('live tests require the dedicated loopback test database');
}
jest.setTimeout(60000);
const live = url ? describe : describe.skip;

const RUN = randomUUID().slice(0, 8);
const ID = `u1-a7-${RUN}`;
const IMAGE = `https://publisher.example/${RUN}.jpg`;

live('U-1 A-7 — the stored image URL is withheld on read and kept at rest', () => {
  let db: PrismaClient;
  let app: INestApplication;

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url!, max: 2 }) });
    await db.$connect();
    await db.article.create({
      data: {
        id: ID,
        title: `U1 A7 synthetic ${RUN}`,
        summary: 'Synthetic summary.',
        url: `https://publisher.example/a7-${RUN}`,
        imageUrl: IMAGE,
        sourceId: 'synthetic-publisher',
        sourceName: 'Synthetic Publisher',
        category: 'world',
        publishedAt: new Date(),
      },
    });
    const store = new ArticlePersistenceService(db as unknown as PrismaService);

    @Controller('u1-a7')
    class ReadController {
      @Get()
      async read() {
        const articles = await store.findRecent({ limit: 100, maxAgeMinutes: 60 });
        return { articles: articles.filter((a) => a.id === ID) };
      }
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [ReadController],
      providers: [{ provide: APP_INTERCEPTOR, useClass: PublisherImageWithholdingInterceptor }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await db?.article.deleteMany({ where: { id: ID } });
    await db?.$disconnect();
  });

  it('the repository returns it WITH the image (positive control); the HTTP body has the article WITHOUT it; the row keeps it', async () => {
    const direct = await new ArticlePersistenceService(db as unknown as PrismaService).findRecent({
      limit: 100,
      maxAgeMinutes: 60,
    });
    expect(direct.find((a) => a.id === ID)?.imageUrl).toBe(IMAGE);

    const res = await request(app.getHttpServer()).get('/u1-a7').expect(200);
    expect(res.body.articles).toHaveLength(1);
    expect(res.body.articles[0]).toMatchObject({
      id: ID,
      title: `U1 A7 synthetic ${RUN}`,
      sourceId: 'synthetic-publisher',
    });
    expect(res.body.articles[0]).not.toHaveProperty('imageUrl');
    expect(res.text).not.toContain(IMAGE);

    const row = await db.article.findUnique({ where: { id: ID }, select: { imageUrl: true } });
    expect(row?.imageUrl).toBe(IMAGE);
  });
});
