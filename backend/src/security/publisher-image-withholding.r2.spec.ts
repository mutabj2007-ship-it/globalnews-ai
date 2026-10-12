import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Readable } from 'node:stream';
import { Controller, Get, Res, StreamableFile, type INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import request from 'supertest';
import {
  PublisherImageWithholdingInterceptor,
  REVIEWED_NON_IMAGE_KEYS,
  WITHHELD_PUBLISHER_IMAGE_KEYS,
  isImageLikeKey as isImageLike,
  withoutPublisherImages,
} from './publisher-image-withholding.interceptor';
import { AskV2GuestController } from '../modules/ask-v2/guest/ask-v2-guest.controller';
import { AskV2Service } from '../modules/ask-v2/ask-v2.service';
import { GuestSessionService } from '../modules/ask-v2/guest/guest-session.service';
import { GuestClaimService } from '../modules/ask-v2/guest/guest-claim.service';
import { SessionService } from '../modules/auth/session.service';
import { RequireGuestGuard } from '../modules/ask-v2/guest/guest.guards';
import { AskRequestContextInterceptor } from '../modules/ask-v2/ask-request-context';

/*
  U-1 R2 — E1-22 §2.3 corrections and §2.4 acceptance items not covered by the first spec:
    D-1 / A-6  completeness guard over the response contract (fails on a new image-like key)
    D-2        class-instance bodies are filtered in the shape JSON.stringify emits
    A-4        positive control: a first-party image field still reaches the client
    A-5        guest Ask route and an @Res({ passthrough: true }) handler are both covered
  (A-7, storage untouched, is the PostgreSQL spec beside this one.)
*/

const IMAGE = 'https://publisher.example/photo.jpg';
/* The image-like name predicate and the E1-reviewed exemptions live in the interceptor (one
   definition for this contract guard and the R-b runtime rule). Additions to the reviewed set need E1. */

const ROOT = join(__dirname, '..', '..', '..');
function sourcesUnder(dir: string, keep: (file: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourcesUnder(path, keep));
    else if (keep(path)) out.push(path);
  }
  return out;
}

/** Property names declared in TypeScript source text (interfaces, types, object literals). */
export function imageLikeKeysIn(source: string): string[] {
  const keys = [...source.matchAll(/^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/gmu)].map(
    (m) => m[1] as string,
  );
  return [
    ...new Set(
      keys.filter(
        (k) =>
          isImageLike(k) &&
          !WITHHELD_PUBLISHER_IMAGE_KEYS.has(k) &&
          !REVIEWED_NON_IMAGE_KEYS.has(k),
      ),
    ),
  ];
}

describe('U-1 R2 · D-1 / A-6 completeness guard over the response contract', () => {
  const contractFiles = [
    ...sourcesUnder(
      join(ROOT, 'shared', 'src'),
      (f) => f.endsWith('.ts') && !/\.(spec|test)\.ts$/u.test(f),
    ),
    ...sourcesUnder(join(ROOT, 'backend', 'src'), (f) => f.endsWith('.controller.ts')),
  ];

  it('scans a real contract (positive control: the withheld key itself is found where it is declared)', () => {
    expect(contractFiles.length).toBeGreaterThan(20);
    const declaring = contractFiles.filter((f) =>
      /^\s*(?:readonly\s+)?imageUrl\??\s*:/mu.test(readFileSync(f, 'utf8')),
    );
    expect(declaring.length).toBeGreaterThan(0);
  });

  it('no response-contract key is image-like unless it is withheld or E1-reviewed', () => {
    const offenders = contractFiles.flatMap((f) =>
      imageLikeKeysIn(readFileSync(f, 'utf8')).map((k) => `${relative(ROOT, f)}: ${k}`),
    );
    expect(offenders).toEqual([]);
  });

  it('fails on an injected new image-like key (the guard bites)', () => {
    const injected =
      'export interface X {\n  readonly leadImageUrl: string;\n  photoUrl?: string;\n  readonly media: string;\n  readonly mediaType: string;\n  readonly imageUrl?: string;\n}';
    expect(imageLikeKeysIn(injected).sort()).toEqual(['leadImageUrl', 'media', 'photoUrl']);
    expect(imageLikeKeysIn('  immediateImpacts: string;\n  medianMs: number;')).toEqual([]);
    expect(
      imageLikeKeysIn('  socialimage?: string;\n  ogImage: string;\n  LEAD_MEDIA: string;').sort(),
    ).toEqual(['LEAD_MEDIA', 'ogImage', 'socialimage']);
  });
});

class ArticleDto {
  constructor(
    public readonly title: string,
    public readonly imageUrl: string,
    public readonly nested: { thumbnailUrl: string; keep: number },
  ) {}
}
class WithToJson {
  toJSON() {
    return { title: 'serialized', imageUrl: IMAGE };
  }
}

describe('U-1 R2 · D-2 class instances are filtered as JSON.stringify would serialize them', () => {
  it('a DTO instance: own enumerable properties, image keys removed at depth', () => {
    const out = withoutPublisherImages({
      article: new ArticleDto('t', IMAGE, { thumbnailUrl: IMAGE, keep: 1 }),
    });
    expect(JSON.parse(JSON.stringify(out))).toEqual({
      article: { title: 't', nested: { keep: 1 } },
    });
  });

  it('an instance with toJSON(): its serialized shape, filtered', () => {
    expect(JSON.parse(JSON.stringify(withoutPublisherImages({ x: new WithToJson() })))).toEqual({
      x: { title: 'serialized' },
    });
  });

  it('dates, buffers, typed arrays, streams and StreamableFile pass through untouched', () => {
    const date = new Date('2026-10-12T00:00:00Z');
    const buffer = Buffer.from('b');
    const typed = new Uint8Array([1]);
    const stream = Readable.from(['x']);
    const file = new StreamableFile(Buffer.from('f'));
    const out = withoutPublisherImages({ date, buffer, typed, stream, file }) as Record<
      string,
      unknown
    >;
    expect(out.date).toBe(date);
    expect(out.buffer).toBe(buffer);
    expect(out.typed).toBe(typed);
    expect(out.stream).toBe(stream);
    expect(out.file).toBe(file);
    expect(withoutPublisherImages(file)).toBe(file);
  });
});

@Controller('u1-r2')
class ProbeController {
  @Get('first-party')
  firstParty() {
    return {
      iconUrl: '/images/brand/radar.svg',
      gradient: 'linear-gradient(#000,#111)',
      hero: { asset: '/images/hero.webp' },
      article: { title: 'kept', imageUrl: IMAGE },
    };
  }

  @Get('passthrough')
  passthrough(@Res({ passthrough: true }) response: Response) {
    response.setHeader('x-probe', '1');
    return { articles: [{ id: 'p1', title: 'passthrough', imageUrl: IMAGE }] };
  }
}

describe('U-1 R2 · A-4 first-party control, A-5 guest route + passthrough handler', () => {
  let app: INestApplication;
  const storedGuestOperation = {
    id: 'g-op',
    status: 'COMPLETED',
    result: {
      payload: {
        analysis: {
          articles: [
            {
              id: 'g1',
              title: 'Guest stored headline',
              url: 'https://publisher.example/g1',
              sourceId: 'synthetic-publisher',
              sourceName: 'Synthetic Publisher',
              imageUrl: IMAGE,
            },
          ],
        },
      },
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AskV2GuestController, ProbeController],
      providers: [
        { provide: APP_INTERCEPTOR, useClass: PublisherImageWithholdingInterceptor },
        {
          provide: AskV2Service,
          useValue: { getOperation: jest.fn().mockResolvedValue(storedGuestOperation) },
        },
        { provide: GuestSessionService, useValue: {} },
        { provide: GuestClaimService, useValue: {} },
        { provide: SessionService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => (key === 'ASK_V2_ENABLED' ? 'true' : undefined) },
        },
      ],
    })
      .overrideGuard(RequireGuestGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { guest?: unknown } };
        }) => {
          context.switchToHttp().getRequest().guest = { id: 'guest-1' };
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

  it('A-4: first-party image fields reach the client unchanged; only the publisher image is removed', async () => {
    const res = await request(app.getHttpServer()).get('/u1-r2/first-party').expect(200);
    expect(res.body).toEqual({
      iconUrl: '/images/brand/radar.svg',
      gradient: 'linear-gradient(#000,#111)',
      hero: { asset: '/images/hero.webp' },
      article: { title: 'kept' },
    });
  });

  it('A-5: the GUEST stored-answer read (GET /ask-v2/guest/operations/:id) carries no image; the article stays', async () => {
    const res = await request(app.getHttpServer()).get('/ask-v2/guest/operations/g-op').expect(200);
    expect(res.text).not.toContain('publisher.example/photo.jpg');
    expect(res.body.result.payload.analysis.articles).toEqual([
      {
        id: 'g1',
        title: 'Guest stored headline',
        url: 'https://publisher.example/g1',
        sourceId: 'synthetic-publisher',
        sourceName: 'Synthetic Publisher',
      },
    ]);
  });

  it('A-5: an @Res({ passthrough: true }) handler is covered too', async () => {
    const res = await request(app.getHttpServer()).get('/u1-r2/passthrough').expect(200);
    expect(res.headers['x-probe']).toBe('1');
    expect(res.body).toEqual({ articles: [{ id: 'p1', title: 'passthrough' }] });
  });
});
