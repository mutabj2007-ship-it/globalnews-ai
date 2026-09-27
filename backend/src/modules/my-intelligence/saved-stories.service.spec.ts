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

/**
 * The Prisma double models a SERIALIZABLE transaction optimistically, the way
 * PostgreSQL's SSI behaves for this read-count-insert pattern: a transaction
 * works on the rows as they were when it began, its insert is buffered, and at
 * commit it is aborted with a write conflict (P2034) if another transaction
 * committed a SavedStory for the same account in the meantime. The
 * @@unique([userId, articleRef]) constraint is enforced at commit (P2002).
 * Every transaction yields between its count and its insert, so concurrent
 * saves genuinely interleave.
 */
function harness(retained: Array<{ article: NewsArticle; countryCodes: string[] }>) {
  const rows: Array<Record<string, unknown>> = [];
  const creates: Array<Record<string, unknown>> = [];
  const isolationLevels: unknown[] = [];
  const commitsByUser = new Map<string, number>();
  let transactions = 0;
  let writeConflicts = 0;

  const persistence = {
    findRetainedByUrl: jest.fn(async (url: string) => {
      const ref = computeArticleRef(url);
      return retained.find((entry) => computeArticleRef(entry.article.url) === ref) ?? null;
    }),
    findById: jest.fn(async (id: string) => retained.find((entry) => entry.article.id === id)?.article ?? null),
  } as unknown as ArticlePersistenceService;

  type Key = { userId_articleRef: { userId: string; articleRef: string } };
  const findIn = (source: Array<Record<string, unknown>>, where: Key) =>
    source.find(
      (row) => row.userId === where.userId_articleRef.userId && row.articleRef === where.userId_articleRef.articleRef,
    ) ?? null;
  const yieldTurn = () => new Promise((resolve) => setImmediate(resolve));

  /* Reads inside a transaction; exposed so a test can force a count. */
  const txCount = jest.fn(async (snapshot: Array<Record<string, unknown>>, userId: string) =>
    snapshot.filter((row) => row.userId === userId).length,
  );
  const txCreate = jest.fn();

  const prisma = {
    $transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>, options?: { isolationLevel?: unknown }) => {
      transactions += 1;
      isolationLevels.push(options?.isolationLevel);
      const snapshot = rows.map((row) => ({ ...row }));
      const startCommits = new Map(commitsByUser);
      const pending: Array<Record<string, unknown>> = [];

      const tx = {
        savedStory: {
          findUnique: async ({ where }: { where: Key }) => findIn(snapshot, where),
          count: async ({ where }: { where: { userId: string } }) => {
            const n = await txCount(snapshot, where.userId);
            await yieldTurn();
            return n;
          },
          create: async ({ data }: { data: Record<string, unknown> }) => {
            txCreate(data);
            const row = { ...data, savedAt: new Date('2026-09-27T09:00:00.000Z') };
            pending.push(row);
            return row;
          },
        },
      };

      const result = await work(tx);

      for (const row of pending) {
        const userId = row.userId as string;
        if ((commitsByUser.get(userId) ?? 0) !== (startCommits.get(userId) ?? 0)) {
          writeConflicts += 1;
          throw Object.assign(new Error('could not serialize access'), { code: 'P2034' });
        }
        if (findIn(rows, { userId_articleRef: { userId, articleRef: row.articleRef as string } })) {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        }
      }
      for (const row of pending) {
        rows.push(row);
        creates.push(Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'savedAt')));
        commitsByUser.set(row.userId as string, (commitsByUser.get(row.userId as string) ?? 0) + 1);
      }
      return result;
    }),
    savedStory: {
      findUnique: jest.fn(async ({ where }: { where: Key }) => findIn(rows, where)),
      findMany: jest.fn(async ({ where }: { where: { userId: string } }) => rows.filter((row) => row.userId === where.userId)),
      count: jest.fn(async ({ where }: { where: { userId: string } }) => rows.filter((row) => row.userId === where.userId).length),
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

  /** Seed `n` already-saved stories for an account (committed, outside any race). */
  const seed = (userId: string, n: number) => {
    for (let i = 0; i < n; i += 1) {
      rows.push({
        userId,
        articleRef: computeArticleRef(`https://seed.example.com/story-${i}`),
        savedAt: new Date('2026-09-01T00:00:00.000Z'),
      });
    }
  };

  return {
    service: new SavedStoriesService(prisma, persistence),
    rows,
    creates,
    persistence,
    prisma,
    txCount,
    txCreate,
    seed,
    isolationLevels,
    stats: () => ({ transactions, writeConflicts }),
  };
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
    expect(h.txCreate).toHaveBeenCalledTimes(1);
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
    h.txCount.mockResolvedValueOnce(MAX_SAVED_STORIES);
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

describe('R1.1 — the Saved Stories cap is concurrency-safe', () => {
  const storyA = article({ id: 'gnews-a', url: 'https://www.example.com/world/race-a' });
  const storyB = article({ id: 'gnews-b', url: 'https://www.example.com/world/race-b' });
  const savedBy = (h: ReturnType<typeof harness>, userId: string) => h.rows.filter((row) => row.userId === userId);

  it('count, cap check and insert run in ONE Serializable transaction', async () => {
    const h = harness([{ article: storyA, countryCodes: [] }]);
    await h.service.save('user-1', storyA.url);
    expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(h.isolationLevels).toEqual(['Serializable']);
    /* No count outside the transaction. */
    expect(h.prisma.savedStory.count).not.toHaveBeenCalled();
  });

  it(`at ${MAX_SAVED_STORIES - 1}, two distinct concurrent saves: one succeeds, one is refused, never above ${MAX_SAVED_STORIES}`, async () => {
    const h = harness([
      { article: storyA, countryCodes: [] },
      { article: storyB, countryCodes: [] },
    ]);
    h.seed('user-1', MAX_SAVED_STORIES - 1);

    const outcomes = await Promise.allSettled([
      h.service.save('user-1', storyA.url),
      h.service.save('user-1', storyB.url),
    ]);

    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const rejected = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    expect((rejected[0].reason as ConflictException).message).toBe(
      `Saved Stories is limited to ${MAX_SAVED_STORIES} stories.`,
    );
    expect(savedBy(h, 'user-1')).toHaveLength(MAX_SAVED_STORIES);
    /* The race really happened: both transactions read 199; one lost at commit, retried, and was refused. */
    expect(h.stats().writeConflicts).toBe(1);
  });

  it('many concurrent distinct saves at 199 still never exceed the cap', async () => {
    const stories = Array.from({ length: 6 }, (_, i) =>
      article({ id: `gnews-r${i}`, url: `https://www.example.com/world/race-many-${i}` }),
    );
    const h = harness(stories.map((story) => ({ article: story, countryCodes: [] })));
    h.seed('user-1', MAX_SAVED_STORIES - 1);

    const outcomes = await Promise.allSettled(stories.map((story) => h.service.save('user-1', story.url)));
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    for (const outcome of outcomes.filter((o): o is PromiseRejectedResult => o.status === 'rejected')) {
      expect(outcome.reason).toBeInstanceOf(ConflictException);
    }
    expect(savedBy(h, 'user-1')).toHaveLength(MAX_SAVED_STORIES);
  });

  it('a duplicate save never consumes a slot — even at the cap', async () => {
    const h = harness([{ article: storyA, countryCodes: [] }]);
    h.seed('user-1', MAX_SAVED_STORIES - 1);
    await h.service.save('user-1', storyA.url);
    expect(savedBy(h, 'user-1')).toHaveLength(MAX_SAVED_STORIES);

    const again = await h.service.save('user-1', `${storyA.url}?utm_source=newsletter`);
    expect(again.articleRef).toBe(computeArticleRef(storyA.url));
    expect(savedBy(h, 'user-1')).toHaveLength(MAX_SAVED_STORIES);
    expect(h.txCreate).toHaveBeenCalledTimes(1);
  });

  it('two concurrent saves of the SAME story at 199 both succeed with one row and one slot', async () => {
    const h = harness([{ article: storyA, countryCodes: [] }]);
    h.seed('user-1', MAX_SAVED_STORIES - 1);

    const [a, b] = await Promise.all([
      h.service.save('user-1', storyA.url),
      h.service.save('user-1', storyA.url),
    ]);
    expect(b.articleRef).toBe(a.articleRef);
    expect(h.rows.filter((row) => row.articleRef === a.articleRef)).toHaveLength(1);
    expect(savedBy(h, 'user-1')).toHaveLength(MAX_SAVED_STORIES);
  });

  it('the cap is per account: another account is unaffected by a full one', async () => {
    const h = harness([{ article: storyA, countryCodes: [] }]);
    h.seed('user-1', MAX_SAVED_STORIES);
    await expect(h.service.save('user-2', storyA.url)).resolves.toMatchObject({ title: storyA.title });
  });

  it('the @@unique([userId, articleRef]) constraint is preserved', () => {
    const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8');
    const block = schema.slice(schema.indexOf('model SavedStory {'));
    const body = block.slice(0, block.indexOf('\n}'));
    expect(body).toMatch(/@@unique\(\[userId,\s*articleRef\]\)/);
  });
});

describe('R1.1 — providerArticleId is the RESOLVED Article.id, never the caller hint', () => {
  it('a valid URL with a bogus hint stores the resolved Article.id', async () => {
    const h = harness([{ article: article(), countryCodes: [] }]);
    await h.service.save('user-1', article().url, 'bogus-client-hint');
    expect(h.creates[0].providerArticleId).toBe('gnews-123');
    expect(h.creates[0].articleRef).toBe(computeArticleRef(article().url));
  });

  it('a hint-only lookup resolving the same URL identity stores the resolved Article.id', async () => {
    /* The retained row is stored under a tracking-parameter spelling of the same story. */
    const stored = article({ id: 'gnews-777', url: 'https://www.example.com/world/story-1?utm_campaign=feed' });
    const h = harness([{ article: stored, countryCodes: [] }]);
    /* The URL lookup misses; the hint finds the row, whose identity matches the URL. */
    (h.persistence.findRetainedByUrl as jest.Mock).mockResolvedValueOnce(null);

    const view = await h.service.save('user-1', 'https://www.example.com/world/story-1', '  gnews-777  ');
    expect(h.persistence.findById).toHaveBeenCalledWith('gnews-777');
    expect(view.articleRef).toBe(computeArticleRef('https://www.example.com/world/story-1'));
    expect(h.creates[0].providerArticleId).toBe('gnews-777');
  });

  it('a mismatched hint cannot change identity: nothing is stored', async () => {
    const other = article({ id: 'gnews-999', url: 'https://other.example.org/unrelated' });
    const h = harness([{ article: other, countryCodes: [] }]);
    await expect(
      h.service.save('user-1', 'https://www.example.com/world/story-1', 'gnews-999'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(h.rows).toHaveLength(0);
    expect(h.txCreate).not.toHaveBeenCalled();
  });

  it('a mismatched hint alongside a retained URL cannot redirect the save or its provider id', async () => {
    const other = article({ id: 'gnews-999', url: 'https://other.example.org/unrelated' });
    const h = harness([
      { article: article(), countryCodes: [] },
      { article: other, countryCodes: [] },
    ]);
    const view = await h.service.save('user-1', article().url, 'gnews-999');
    expect(view.articleRef).toBe(computeArticleRef(article().url));
    expect(h.creates[0].providerArticleId).toBe('gnews-123');
  });
});
