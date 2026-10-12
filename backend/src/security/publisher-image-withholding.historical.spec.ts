import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  PublisherImageWithholdingInterceptor,
  withoutPublisherImages,
} from './publisher-image-withholding.interceptor';

/*
  U-1 · HISTORICAL StoredResult JSON — NEGATIVE TEST (CTO R3C), CLOSED BY R-b (E1-R4 §1.4.1).

  The D-1 completeness guard walks the response CONTRACT (shared/src + controllers). A stored Ask
  payload is not bound by today's contract: it is whatever an older build serialized, read back
  verbatim. In `9911fb1` this spec recorded, with `it.failing`, that a publisher URL under an image-like
  key no type ever declared (`image`, `urlToImage`, `ogImage`, `media`, `enclosure`) still reached the
  client. E1 ruled R-b: withhold an image-like, non-reviewed key whose value is an absolute URL. The
  negative assertion is now a normal test, and the positive controls E1 required sit beside it.
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
        socialimage: `${PUBLISHER}/gdelt-social.png`,
        leadPhoto: `//publisher.example/protocol-relative.webp`,
        media: { url: `${PUBLISHER}/media.jpg` },
        enclosure: { url: `${PUBLISHER}/enclosure.jpg`, type: 'image/jpeg' },
        thumbnails: [{ src: `${PUBLISHER}/t1.gif` }],
      },
    ],
  },
  /* first-party assets and non-image fields that must survive */
  presentation: {
    iconUrl: '/images/brief-icon.svg',
    heroImage: '/images/hero.webp',
    accent: 'linear-gradient(#000,#fff)',
  },
  officialData: { mediaType: 'text/csv', downloadUrl: 'https://data.example/series.csv' },
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
    expect(article).toMatchObject({
      id: 'gnews-1',
      title: 'Stored article',
      sourceId: 'publisher-example',
      url: `${PUBLISHER}/story-1`,
    });
    expect(res.body.analysis.summary).toBe('First-party answer text.');
    /* A-4 under R-b: image-like names holding RELATIVE first-party paths survive */
    expect(res.body.presentation).toEqual(historicalPayload.presentation);
    /* reviewed non-image name and a non-image-like key holding a URL survive */
    expect(res.body.officialData).toEqual(historicalPayload.officialData);
  });

  it('R-b: every undeclared image-like key carrying an absolute URL is withheld', async () => {
    const res = await request(app.getHttpServer()).get('/u1-historical').expect(200);
    const article = res.body.analysis.articles[0] as Record<string, unknown>;
    const passedThrough = [
      'image',
      'urlToImage',
      'ogImage',
      'socialimage',
      'leadPhoto',
      'media',
      'enclosure',
      'thumbnails',
    ].filter((k) => k in article);
    expect(passedThrough).toEqual([]);
  });

  it('NEGATIVE: no publisher image URL leaves the API under ANY key', async () => {
    const res = await request(app.getHttpServer()).get('/u1-historical').expect(200);
    const imageUrls =
      res.text.match(/(?:https:)?\/\/publisher\.example\/[^"]+\.(?:jpe?g|png|webp|gif)/gu) ?? [];
    expect(imageUrls).toEqual([]);
    /* positive control: the publisher LINK (attribution) is still there */
    expect(res.text).toContain(`${PUBLISHER}/story-1`);
  });

  it('the value half of R-b binds: an image-like name with a non-URL value is kept; a non-image name with a URL is kept', () => {
    expect(
      withoutPublisherImages({
        imageCaption: 'Traders outside the market',
        photoCredit: 'Staff photographer',
        mediaType: 'image/png',
        canonicalUrl: 'https://publisher.example/story',
        heroImage: '/images/hero.webp',
      }),
    ).toEqual({
      imageCaption: 'Traders outside the market',
      photoCredit: 'Staff photographer',
      mediaType: 'image/png',
      canonicalUrl: 'https://publisher.example/story',
      heroImage: '/images/hero.webp',
    });
  });
});
