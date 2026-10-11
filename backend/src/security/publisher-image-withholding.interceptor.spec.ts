import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get, Sse, type INestApplication, type MessageEvent } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { of, type Observable } from 'rxjs';
import request from 'supertest';
import {
  PublisherImageWithholdingInterceptor,
  WITHHELD_PUBLISHER_IMAGE_KEYS,
  withoutPublisherImages,
} from './publisher-image-withholding.interceptor';
import { HomeEditorialController } from '../modules/home-editorial/home-editorial.controller';
import { HomeEditorialService } from '../modules/home-editorial/home-editorial.service';
import { HomeEditorialGate } from '../modules/home-editorial/home-editorial.gate';
import { SessionService } from '../modules/auth/session.service';
import { AskV2Controller } from '../modules/ask-v2/ask-v2.controller';
import { AskV2Service } from '../modules/ask-v2/ask-v2.service';
import { GuestClaimService } from '../modules/ask-v2/guest/guest-claim.service';
import { RequireAuthGuard } from '../modules/auth/require-auth.guard';
import { AskRequestContextInterceptor } from '../modules/ask-v2/ask-request-context';
import { AskObservationService } from '../modules/ask-observability/ask-observation.service';

/*
  U-1 B-1 — PROOFS AT THE API BOUNDARY (E1-18 §6 P-2 and the backend half of P-4).

  P-2: the serialized response of a LIST surface (Home story search) and a DETAIL surface (an Ask
  operation reopened from a STORED payload written before this fix) contains no `imageUrl` /
  `thumbnailUrl` key at any depth.
  P-4 (positive control): the article is still returned — same count, same title, publisher,
  link, date and canonical sourceId — so containment never empties a surface.
*/

const IMAGE = 'https://publisher.example/photo.jpg';

function story(id: string) {
  return {
    articleRef: `ref-${id}`,
    storyId: null,
    url: `https://publisher.example/${id}`,
    title: `Synthetic headline ${id}`,
    summary: null,
    imageUrl: IMAGE,
    publisher: 'Synthetic Publisher',
    sourceId: 'synthetic-publisher',
    publishedAt: '2026-10-10T08:00:00.000Z',
    publishedAtBasis: 'publisher',
    firstSeenAt: '2026-10-10T09:00:00.000Z',
    category: 'world',
    primaryDomain: null,
    domains: [],
    signals: [],
    topics: [],
    countries: [],
    regions: [],
    freshness: 'LAST_72H',
    otherReports: { count: 0, publishers: [], firstReportedAt: '2026-10-10T08:00:00.000Z' },
    discussion: null,
    sourceStatus: 'RETAINED_PUBLISHER_REPORT',
  };
}

/** A stored Ask payload as written BEFORE the fix: the analysis carries article image URLs. */
const storedOperation = {
  id: 'op-1',
  status: 'COMPLETED',
  storedResultId: 'sr-1',
  result: {
    payload: {
      schema: 'ask-r2-result/1',
      analysis: {
        articles: [
          {
            id: 'a1',
            title: 'Stored headline one',
            url: 'https://publisher.example/a1',
            sourceId: 'synthetic-publisher',
            sourceName: 'Synthetic Publisher',
            publishedAt: '2026-10-09T08:00:00.000Z',
            imageUrl: IMAGE,
          },
          {
            id: 'a2',
            title: 'Stored headline two',
            url: 'https://publisher.example/a2',
            sourceId: 'synthetic-publisher',
            sourceName: 'Synthetic Publisher',
            publishedAt: '2026-10-09T09:00:00.000Z',
            imageUrl: IMAGE,
            nested: { thumbnailUrl: IMAGE },
          },
        ],
        analysis: {
          sources: [
            {
              articleId: 'a1',
              publisher: 'Synthetic Publisher',
              title: 'Stored headline one',
              url: 'https://publisher.example/a1',
            },
          ],
        },
      },
    },
  },
};

function keysAnywhere(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => keysAnywhere(item, found));
  else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      found.add(key);
      keysAnywhere(child, found);
    }
  }
  return found;
}

@Controller('u1-probe')
class ProbeController {
  @Sse('events')
  events(): Observable<MessageEvent> {
    return of({ data: { article: { title: 'Streamed', imageUrl: IMAGE } } });
  }

  @Get('buffer')
  buffer(): Buffer {
    return Buffer.from('not json');
  }
}

describe('U-1 B-1 · withoutPublisherImages (pure)', () => {
  it('removes every withheld key at any depth, keeps everything else, never mutates its input', () => {
    const input = {
      a: { imageUrl: IMAGE, keep: 1, list: [{ thumbnailUrl: IMAGE, title: 't' }] },
      imageUrl: IMAGE,
    };
    const before = JSON.stringify(input);
    const out = withoutPublisherImages(input);
    expect(out).toEqual({ a: { keep: 1, list: [{ title: 't' }] } });
    expect(JSON.stringify(input)).toBe(before);
    expect(withoutPublisherImages(out)).toEqual(out);
    expect([...WITHHELD_PUBLISHER_IMAGE_KEYS].sort()).toEqual(['imageUrl', 'thumbnailUrl']);
  });

  it('passes non-plain values through untouched and survives cycles', () => {
    const date = new Date('2026-10-12T00:00:00Z');
    const buffer = Buffer.from('x');
    const cyclic: Record<string, unknown> = { imageUrl: IMAGE, keep: true };
    cyclic.self = cyclic;
    const out = withoutPublisherImages({ date, buffer, cyclic }) as {
      date: Date;
      buffer: Buffer;
      cyclic: Record<string, unknown>;
    };
    expect(out.date).toBe(date);
    expect(out.buffer).toBe(buffer);
    expect(out.cyclic.keep).toBe(true);
    expect(out.cyclic).not.toHaveProperty('imageUrl');
    expect(out.cyclic.self).toBe(out.cyclic);
  });
});

describe('U-1 B-1 · the global boundary on real controllers (P-2, P-4)', () => {
  let app: INestApplication;
  const searchResult = {
    query: 'synthetic',
    scope: 'HOME_ELIGIBLE',
    region: null,
    domain: null,
    days: null,
    results: [story('s1'), story('s2')],
    matched: 2,
    relaxed: false,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HomeEditorialController, AskV2Controller, ProbeController],
      providers: [
        { provide: APP_INTERCEPTOR, useClass: PublisherImageWithholdingInterceptor },
        {
          provide: HomeEditorialService,
          useValue: { search: jest.fn().mockResolvedValue(searchResult), editorial: jest.fn() },
        },
        {
          provide: SessionService,
          useValue: { validateSession: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: AskV2Service,
          useValue: { getOperation: jest.fn().mockResolvedValue(storedOperation) },
        },
        { provide: GuestClaimService, useValue: {} },
        { provide: AskObservationService, useValue: { recordAccessRefusal: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => (key === 'ASK_V2_ENABLED' ? 'true' : undefined) },
        },
      ],
    })
      .overrideGuard(HomeEditorialGate)
      .useValue({ canActivate: () => true })
      .overrideGuard(RequireAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { user?: unknown } };
        }) => {
          context.switchToHttp().getRequest().user = { id: 'user-1' };
          return true;
        },
      })
      .overrideInterceptor(AskRequestContextInterceptor)
      .useValue({ intercept: (_c: unknown, next: { handle: () => unknown }) => next.handle() })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('P-2 list surface — GET /stories/search: no image key anywhere; P-4: both stories still returned intact', async () => {
    const response = await request(app.getHttpServer())
      .get('/stories/search')
      .query({ q: 'synthetic' })
      .expect(200);
    expect(response.text).not.toContain('publisher.example/photo.jpg');
    const keys = keysAnywhere(response.body);
    expect(keys.has('imageUrl')).toBe(false);
    expect(keys.has('thumbnailUrl')).toBe(false);
    expect(response.body.results).toHaveLength(2);
    expect(response.body.results[0]).toMatchObject({
      title: 'Synthetic headline s1',
      publisher: 'Synthetic Publisher',
      sourceId: 'synthetic-publisher',
      url: 'https://publisher.example/s1',
      publishedAt: '2026-10-10T08:00:00.000Z',
    });
    expect(response.body.matched).toBe(2);
  });

  it('P-2 detail surface — GET /ask-v2/operations/:id over a payload STORED before the fix; P-4: evidence still returned', async () => {
    const response = await request(app.getHttpServer()).get('/ask-v2/operations/op-1').expect(200);
    expect(response.text).not.toContain('publisher.example/photo.jpg');
    expect(keysAnywhere(response.body).has('imageUrl')).toBe(false);
    expect(keysAnywhere(response.body).has('thumbnailUrl')).toBe(false);
    const articles = response.body.result.payload.analysis.articles;
    expect(articles.map((a: { id: string }) => a.id)).toEqual(['a1', 'a2']);
    expect(articles[0]).toMatchObject({
      title: 'Stored headline one',
      sourceId: 'synthetic-publisher',
      url: 'https://publisher.example/a1',
    });
    expect(response.body.result.payload.analysis.analysis.sources).toHaveLength(1);
  });

  it('a server-sent event carrying an article is stripped too; a non-JSON body is untouched', async () => {
    const sse = await request(app.getHttpServer())
      .get('/u1-probe/events')
      .buffer(true)
      .parse((res, done) => {
        let text = '';
        res.on('data', (chunk: Buffer) => (text += chunk.toString()));
        res.on('end', () => done(null, text));
      });
    expect(String(sse.body)).toContain('Streamed');
    expect(String(sse.body)).not.toContain('imageUrl');
    const buffer = await request(app.getHttpServer()).get('/u1-probe/buffer').expect(200);
    expect(Buffer.from(buffer.body).toString()).toBe('not json');
  });
});

describe('U-1 B-1 · registration', () => {
  it('AppModule registers the interceptor globally, FIRST among its interceptors (outermost)', () => {
    const source = readFileSync(join(__dirname, '..', 'app.module.ts'), 'utf8');
    const first = source.indexOf('useClass: PublisherImageWithholdingInterceptor');
    const logging = source.indexOf('useClass: LoggingInterceptor');
    const telemetry = source.indexOf('useClass: TelemetryInterceptor');
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(logging);
    expect(first).toBeLessThan(telemetry);
    expect(source.slice(source.lastIndexOf('{', first), first)).toContain('APP_INTERCEPTOR');
  });
});
