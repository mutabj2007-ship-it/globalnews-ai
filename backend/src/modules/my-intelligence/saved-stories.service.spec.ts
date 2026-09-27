import { readFileSync } from 'fs';
import { join } from 'path';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_SAVED_STORIES, type NewsArticle } from '@globalnews-ai/shared';
import type { PrismaService } from '../../database/prisma.service';
import type { ArticlePersistenceService } from '../news/persistence/article-persistence.service';
import { computeArticleRef } from '../news/identity/article-ref.util';
import { SavedStoriesService } from './saved-stories.service';
import { SaveStoryDto } from './dto/save-story.dto';

/**
 * MY INTELLIGENCE R1 — Saved Stories: identity, idempotency, server-side
 * metadata and the no-body rule, against in-memory doubles.
 */

const article = (overrides: Partial<NewsArticle> = {}): NewsArticle =>
  ({
    id: 'gnews-123',
    title: 'Retained title',
    summary: 'PROVIDER SUMMARY THAT MUST NEVER BE STORED',
    url: 'https://www.example.com/world/story-1',
    sourceId: 'example',
    sourceName: 'Example Wire',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-09-25T10:00:00.000Z',
    publishedAtBasis: 'publisher',
    firstSeenAt: '2026-09-25T10:05:00.000Z',
    imageUrl: 'https://www.example.com/img.jpg',
    ...overrides,
  }) as NewsArticle;

function harness(retained: Array<{ article: NewsArticle; countryCodes: string[] }>) {
  const rows: Array<Record<string, unknown>> = [];
  const creates: Array<Record<string, unknown>> = [];
  const persistence = {
    findRetainedByUrl: jest.fn(async (url: string) => {
      const ref = computeArticleRef(url);
      return retained.find((entry) => computeArticleRef(entry.article.url) === ref) ?? null;
    }),
    findById: jest.fn(async (id: string) => retained.find((entry) => entry.article.id === id)?.article ?? null),
  } as unknown as ArticlePersistenceService;

  const prisma = {
    savedStory: {
      findUnique: jest.fn(async ({ where }: { where: { userId_articleRef: { userId: string; articleRef: string } } }) =>
        rows.find(
          (row) => row.userId === where.userId_articleRef.userId && row.articleRef === where.userId_articleRef.articleRef,
        ) ?? null,
      ),
      findMany: jest.fn(async ({ where }: { where: { userId: string } }) => rows.filter((row) => row.userId === where.userId)),
      count: jest.fn(async ({ where }: { where: { userId: string } }) => rows.filter((row) => row.userId === where.userId).length),
      upsert: jest.fn(async ({ create }: { create: Record<string, unknown> }) => {
        creates.push(create);
        const row = { ...create, savedAt: new Date('2026-09-27T09:00:00.000Z') };
        rows.push(row);
        return row;
      }),
      deleteMany: jest.fn(async ({ where }: { where: { userId: string; articleRef: string } }) => {
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          if (rows[i].userId === where.userId && rows[i].articleRef === where.articleRef) rows.splice(i, 1);
        }
        return { count: before - rows.length };
      }),
    },
    article: {
      findMany: jest.fn(async () =>
        retained.map((entry) => ({ url: entry.article.url, fetchedAt: new Date(entry.article.firstSeenAt as string) })),
      ),
    },
  } as unknown as PrismaService;

  return { service: new SavedStoriesService(prisma, persistence), rows, creates, persistence, prisma };
}

describe('Saved Story identity', () => {
  it('articleRef = sha256(normalizeArticleUrl(url)); tracking-parameter spellings are one story', async () => {
    const h = harness([{ article: article(), countryCodes: ['POL'] }]);
    const first = await h.service.save('user-1', 'https://www.example.com/world/story-1?utm_source=x');
    const second = await h.service.save('user-1', 'https://www.example.com/world/story-1');

    expect(first.articleRef).toMatch(/^[0-9a-f]{64}$/);
    expect(first.articleRef).toBe(computeArticleRef('https://www.example.com/world/story-1'));
    expect(second.articleRef).toBe(first.articleRef);
    expect(h.rows).toHaveLength(1);
  });

  it('a duplicate save is idempotent: one row, the same view', async () => {
    const h = harness([{ article: article(), countryCodes: [] }]);
    const a = await h.service.save('user-1', article().url);
    const b = await h.service.save('user-1', article().url);
    expect(b).toEqual(a);
    expect(h.rows).toHaveLength(1);
    expect(h.prisma.savedStory.upsert).toHaveBeenCalledTimes(1);
  });

  it('providerArticleId is a hint only: it can never make a different story be saved', async () => {
    const other = article({ id: 'gnews-999', url: 'https://other.example.org/unrelated' });
    const h = harness([{ article: other, countryCodes: [] }]);

    /* The URL is not retained; the hint points at a DIFFERENT story → refused. */
    await expect(
      h.service.save('user-1', 'https://www.example.com/world/story-1', 'gnews-999'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(h.rows).toHaveLength(0);
  });

  it('the stored identity is never the provider id', async () => {
    const h = harness([{ article: article(), countryCodes: [] }]);
    await h.service.save('user-1', article().url, 'gnews-123');
    expect(h.creates[0].articleRef).toBe(computeArticleRef(article().url));
    expect(h.creates[0].articleRef).not.toBe('gnews-123');
    expect(h.creates[0].providerArticleId).toBe('gnews-123');
  });
});

describe('Saved Story metadata is resolved server-side', () => {
  it('title, source, dates, image and governed countries come from the retained Article row', async () => {
    const h = harness([{ article: article(), countryCodes: ['POL', 'DEU'] }]);
    const view = await h.service.save('user-1', article().url);

    expect(view).toMatchObject({
      title: 'Retained title',
      sourceName: 'Example Wire',
      sourceDomain: 'www.example.com',
      canonicalUrl: expect.any(String),
      sourceUrl: article().url,
      publishedAt: '2026-09-25T10:00:00.000Z',
      publishedAtBasis: 'publisher',
      imageUrl: 'https://www.example.com/img.jpg',
      countryCodes: ['POL', 'DEU'],
      firstSeenAt: '2026-09-25T10:05:00.000Z',
    });
  });

  it('the save DTO accepts only url (+ hint): client-supplied title/source/summary are rejected', async () => {
    const dto = plainToInstance(SaveStoryDto, {
      url: 'https://www.example.com/world/story-1',
      title: 'Client title',
      sourceName: 'Client source',
      summary: 'Client body',
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property).sort()).toEqual(['sourceName', 'summary', 'title']);
  });

  it('a story not in retained reporting cannot be saved', async () => {
    const h = harness([]);
    await expect(h.service.save('user-1', 'https://nowhere.example/x')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('forbidden content is never persisted', () => {
  it('no summary, body, excerpt, AI answer or briefing is written', async () => {
    const h = harness([{ article: article(), countryCodes: [] }]);
    await h.service.save('user-1', article().url);
    const written = JSON.stringify(h.creates[0]);
    expect(written).not.toContain('PROVIDER SUMMARY');
    expect(Object.keys(h.creates[0]).sort()).toEqual(
      [
        'articleRef', 'canonicalUrl', 'countryCodes', 'imageUrl', 'providerArticleId', 'publishedAt',
        'publishedAtBasis', 'sourceDomain', 'sourceName', 'sourceUrl', 'title', 'userId',
      ].sort(),
    );
  });

  it('the SavedStory table has no column that could hold publisher text or an answer', () => {
    const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8');
    const block = schema.slice(schema.indexOf('model SavedStory {'));
    const body = block.slice(0, block.indexOf('\n}'));
    for (const forbidden of ['summary', 'body', 'excerpt', 'content', 'answer', 'briefing']) {
      expect(body).not.toMatch(new RegExp(`^\\s+${forbidden}\\w*\\s`, 'mi'));
    }
  });
});

describe('bounds and removal', () => {
  it(`is limited to ${MAX_SAVED_STORIES} stories per account`, async () => {
    const h = harness([{ article: article(), countryCodes: [] }]);
    (h.prisma.savedStory.count as jest.Mock).mockResolvedValueOnce(MAX_SAVED_STORIES);
    await expect(h.service.save('user-1', article().url)).rejects.toBeInstanceOf(ConflictException);
  });

  it('remove is idempotent and ignores anything that is not a sha256 identity', async () => {
    const h = harness([{ article: article(), countryCodes: [] }]);
    const saved = await h.service.save('user-1', article().url);
    await h.service.remove('user-1', saved.articleRef);
    await h.service.remove('user-1', saved.articleRef);
    await h.service.remove('user-1', 'not-a-ref');
    expect(h.rows).toHaveLength(0);
    expect(h.prisma.savedStory.deleteMany).toHaveBeenCalledTimes(2);
  });

  it('one account never sees another account’s saved stories', async () => {
    const h = harness([{ article: article(), countryCodes: [] }]);
    await h.service.save('user-1', article().url);
    expect((await h.service.list('user-2')).stories).toEqual([]);
    expect((await h.service.list('user-1')).stories).toHaveLength(1);
  });
});
