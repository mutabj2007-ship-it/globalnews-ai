import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PublisherImageWithholdingInterceptor } from './publisher-image-withholding.interceptor';

/*
  U-1 · HISTORICAL StoredResult JSON — NEGATIVE TEST (CTO R3C, for E1).

  The D-1 completeness guard walks the response CONTRACT (shared/src + controllers). A stored Ask
  payload is not bound by today's contract: it is whatever an older build serialized, read back
  verbatim. So an image-like key that exists ONLY in historical JSON is invisible to the guard, and
  the interceptor withholds by key NAME (imageUrl / thumbnailUrl) only.

  Git history (all branches, shared/src + analysis interfaces + ask-v2): the only image key ever
  declared on a payload type is `imageUrl`. Whether stored rows carry other image-like keys (e.g. a
  raw provider `image`) can only be answered by a key inventory of real StoredResult rows, which
  needs an E1-approved aggregate query and PO authorization. This spec therefore pins the behaviour
  on synthetic historical shapes:
    - withheld keys are removed at any depth, and first-party content is preserved (passes);
    - a publisher URL under an UNDECLARED image-like key still reaches the client: that gap is
      recorded with `it.failing`, so this suite turns red the day the gap is closed and the
      expectation must be updated deliberately (E1 ruling).
*/

const PUBLISHER = 'https://publisher.example';
const historicalPayload = {
  kind: 'ASK_OPERATION',
  analysis: {
    summary: 'First-party answer text.',
    articles: [
      {
        id: 'gnews-1',
        title: 'Stored article',
        sourceId: 'publisher-example',
        url: `${PUBLISHER}/story-1`,
        imageUrl: `${PUBLISHER}/declared.jpg`,
        thumbnailUrl: `${PUBLISHER}/declared-thumb.jpg`,
        /* keys no payload type ever declared, as an older or raw-provider shape could carry them */
        image: `${PUBLISHER}/raw-provider-image.jpg`,
        urlToImage: `${PUBLISHER}/url-to-image.jpg`,
        ogImage: `${PUBLISHER}/og.jpg`,
        media: { url: `${PUBLISHER}/media.jpg` },
        enclosure: { url: `${PUBLISHER}/enclosure.jpg`, type: 'image/jpeg' },
      },
    ],
  },
  /* first-party assets that must survive */
  presentation: {
    iconUrl: '/images/brief-icon.svg',
    heroImage: '/images/hero.webp',
    accent: 'linear-gradient(#000,#fff)',
  },
};

describe('U-1 · historical StoredResult JSON with image-like keys the contract never declared', () => {
  let app: INestApplication;

  beforeAll(async () => {
    @Controller('u1-historical')
    class StoredReadController {
      @Get()
      read() {
        return structuredClone(historicalPayload);
      }
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [StoredReadController],
      providers: [{ provide: APP_INTERCEPTOR, useClass: PublisherImageWithholdingInterceptor }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(() => app?.close());

  it('withheld keys are removed at depth; the article, its link and all first-party content are preserved', async () => {
    const res = await request(app.getHttpServer()).get('/u1-historical').expect(200);
    const article = res.body.analysis.articles[0];
    expect(article).not.toHaveProperty('imageUrl');
    expect(article).not.toHaveProperty('thumbnailUrl');
    expect(res.text).not.toContain('declared.jpg');
    expect(res.text).not.toContain('declared-thumb.jpg');
    expect(article).toMatchObject({
      id: 'gnews-1',
      title: 'Stored article',
      url: `${PUBLISHER}/story-1`,
    });
    expect(res.body.analysis.summary).toBe('First-party answer text.');
    expect(res.body.presentation).toEqual(historicalPayload.presentation);
  });

  it('records exactly which undeclared image-like keys pass through today (characterization for E1)', async () => {
    const res = await request(app.getHttpServer()).get('/u1-historical').expect(200);
    const article = res.body.analysis.articles[0] as Record<string, unknown>;
    const passedThrough = ['image', 'urlToImage', 'ogImage', 'media', 'enclosure'].filter(
      (k) => k in article,
    );
    expect(passedThrough).toEqual(['image', 'urlToImage', 'ogImage', 'media', 'enclosure']);
  });

  /* THE GAP. Intended contract: no publisher image URL leaves a reader API, whatever the key. */
  it.failing(
    'NEGATIVE: no publisher image URL leaves the API under ANY key (open gap → E1 ruling)',
    async () => {
      const res = await request(app.getHttpServer()).get('/u1-historical').expect(200);
      const imageUrls =
        res.text.match(/https:\/\/publisher\.example\/[^"]+\.(?:jpe?g|png|webp|gif)/gu) ?? [];
      expect(imageUrls).toEqual([]);
    },
  );
});
