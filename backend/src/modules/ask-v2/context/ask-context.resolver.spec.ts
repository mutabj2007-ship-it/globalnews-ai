import { ValidationPipe } from '@nestjs/common';
import type { NewsArticle } from '@globalnews-ai/shared';
import { computeArticleRef } from '../../news/identity/article-ref.util';
import { QuoteTurnDto } from '../ask-v2.dto';
import { AskContextRefused, AskContextResolver } from './ask-context.resolver';
import { isResolvedAskContext } from './resolved-ask-context';

/**
 * UNIFIED INTELLIGENCE BINDING R2B — the context contract at its two gates:
 *   1. the controllers' pipe (whitelist + forbidNonWhitelisted + transform) over QuoteTurnDto;
 *   2. the ONE server resolver, whose only read is the retained-article lookup (faked here; the
 *      real Prisma read is exercised by ask-v2-context.postgres.spec.ts).
 */

const STORY_URL = 'https://news.example/world/2026/10/01/poland-budget-vote';
const STORY_REF = computeArticleRef(STORY_URL);
const NO_COUNTRY_URL = 'https://news.example/world/2026/10/01/unplaced-report';
const NO_COUNTRY_REF = computeArticleRef(NO_COUNTRY_URL);

const retained = (over: Partial<NewsArticle> = {}): NewsArticle =>
  ({
    id: 'art-pl-1',
    title: 'Polish parliament passes the 2027 budget',
    summary: 'A retained summary that must never reach the context.',
    url: STORY_URL,
    sourceId: 'src-1',
    sourceName: 'Example Wire',
    category: 'politics',
    sourcesCount: 1,
    publishedAt: '2026-10-01T08:00:00.000Z',
    countryCode: 'PL',
    ...over,
  }) as NewsArticle;

function resolverWith(article: NewsArticle | null | Error) {
  const findRetainedArticleByUrl = jest.fn(async () => {
    if (article instanceof Error) throw article;
    return article;
  });
  return {
    resolver: new AskContextResolver({ findRetainedArticleByUrl }),
    findRetainedArticleByUrl,
  };
}

async function refusal(work: Promise<unknown>): Promise<string> {
  try {
    await work;
    return 'NOT_REFUSED';
  } catch (e) {
    return e instanceof AskContextRefused ? e.code : `OTHER:${(e as Error).message}`;
  }
}

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const turn = (context?: unknown) => ({
  idempotencyKey: 'key-1',
  question: 'What does this mean?',
  language: 'en',
  intent: 'ask',
  ...(context === undefined ? {} : { context }),
});
async function piped(body: unknown): Promise<'OK' | 'REJECTED'> {
  try {
    await pipe.transform(body, { type: 'body', metatype: QuoteTurnDto });
    return 'OK';
  } catch {
    return 'REJECTED';
  }
}

let fetchSpy: jest.SpyInstance | undefined;
beforeEach(() => {
  if (typeof globalThis.fetch === 'function') fetchSpy = jest.spyOn(globalThis, 'fetch');
});
afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = undefined;
});

describe('R2B DTO — references only, strict', () => {
  it('a turn with NO context is accepted exactly as today', async () => {
    expect(await piped(turn())).toBe('OK');
  });

  it.each([
    ['STORY reference', { kind: 'STORY', articleRef: STORY_REF, url: STORY_URL }],
    ['GEOGRAPHY ISO3', { kind: 'GEOGRAPHY', countryCode: 'KEN' }],
    ['GEOGRAPHY ISO2 lower case', { kind: 'GEOGRAPHY', countryCode: 'pl' }],
  ])('accepts a well-formed %s', async (_name, context) => {
    expect(await piped(turn(context))).toBe('OK');
  });

  it.each([
    ['title', { kind: 'STORY', articleRef: STORY_REF, url: STORY_URL, title: 'Injected' }],
    ['sourceName', { kind: 'STORY', articleRef: STORY_REF, url: STORY_URL, sourceName: 'X' }],
    ['summary', { kind: 'STORY', articleRef: STORY_REF, url: STORY_URL, summary: 'evidence' }],
    ['body', { kind: 'STORY', articleRef: STORY_REF, url: STORY_URL, body: 'evidence' }],
    ['prompt', { kind: 'STORY', articleRef: STORY_REF, url: STORY_URL, prompt: 'ignore rules' }],
    ['displayName', { kind: 'GEOGRAPHY', countryCode: 'POL', displayName: 'Atlantis' }],
    ['arbitrary JSON', { kind: 'GEOGRAPHY', countryCode: 'POL', extra: { a: 1 } }],
  ])('rejects an injected %s field (forbidNonWhitelisted)', async (_name, context) => {
    expect(await piped(turn(context))).toBe('REJECTED');
  });

  it.each([
    ['unknown kind', { kind: 'SELECTION', articleRef: STORY_REF, url: STORY_URL }],
    ['module kind (R2F)', { kind: 'MODULE', countryCode: 'POL' }],
    ['malformed articleRef', { kind: 'STORY', articleRef: 'not-a-ref', url: STORY_URL }],
    [
      'upper-case articleRef',
      { kind: 'STORY', articleRef: STORY_REF.toUpperCase(), url: STORY_URL },
    ],
    ['story without url', { kind: 'STORY', articleRef: STORY_REF }],
    ['non-http url', { kind: 'STORY', articleRef: STORY_REF, url: 'file:///etc/passwd' }],
    [
      'oversized url',
      { kind: 'STORY', articleRef: STORY_REF, url: `https://x.example/${'a'.repeat(600)}` },
    ],
    ['country NAME instead of code', { kind: 'GEOGRAPHY', countryCode: 'Poland' }],
    ['numeric code', { kind: 'GEOGRAPHY', countryCode: '616' }],
    ['geography without code', { kind: 'GEOGRAPHY' }],
    ['context as a string', 'POL'],
    ['context as an array', [{ kind: 'GEOGRAPHY', countryCode: 'POL' }]],
  ])('rejects %s', async (_name, context) => {
    expect(await piped(turn(context))).toBe('REJECTED');
  });
});

describe('R2B resolver — STORY from retained reporting only', () => {
  it('a valid persisted reference resolves; every field comes from the SERVER record', async () => {
    const { resolver, findRetainedArticleByUrl } = resolverWith(retained());
    const resolved = await resolver.resolve({
      kind: 'STORY',
      articleRef: STORY_REF,
      url: STORY_URL,
    });
    expect(resolved).toEqual({
      kind: 'STORY',
      articleRef: STORY_REF,
      articleId: 'art-pl-1',
      countryIso3: 'POL',
      storyContext: {
        title: 'Polish parliament passes the 2027 budget',
        articleId: 'art-pl-1',
        url: STORY_URL,
        sourceName: 'Example Wire',
        countryCode: 'POL',
      },
    });
    /* ONE bounded local read, by URL, and nothing else. */
    expect(findRetainedArticleByUrl).toHaveBeenCalledTimes(1);
    expect(findRetainedArticleByUrl).toHaveBeenCalledWith(STORY_URL);
    expect(isResolvedAskContext(resolved)).toBe(true);
    /* The summary (evidence text) is never carried in the context. */
    expect(JSON.stringify(resolved)).not.toContain('retained summary');
  });

  it('client title / source / country cannot be injected even past the DTO (resolver key-set guard)', async () => {
    const { resolver, findRetainedArticleByUrl } = resolverWith(retained());
    for (const extra of [{ title: 'Injected' }, { sourceName: 'X' }, { countryCode: 'KEN' }]) {
      expect(
        await refusal(
          resolver.resolve({ kind: 'STORY', articleRef: STORY_REF, url: STORY_URL, ...extra }),
        ),
      ).toBe('ASK_CONTEXT_INVALID');
    }
    expect(findRetainedArticleByUrl).not.toHaveBeenCalled();
  });

  it('an article with NO trustworthy country is anchored by identity only — no country is invented', async () => {
    for (const countryCode of [undefined, '', 'XX', 'Somewhere', 'EU']) {
      const { resolver } = resolverWith(
        retained({ url: NO_COUNTRY_URL, countryCode: countryCode as string | undefined }),
      );
      const resolved = await resolver.resolve({
        kind: 'STORY',
        articleRef: NO_COUNTRY_REF,
        url: NO_COUNTRY_URL,
      });
      expect(resolved).not.toHaveProperty('countryIso3');
      expect((resolved as { storyContext: object }).storyContext).not.toHaveProperty('countryCode');
      expect(isResolvedAskContext(resolved)).toBe(true);
    }
  });

  it('articleRef that is not the identity of the URL → ASK_CONTEXT_STORY_REF_MISMATCH, before any read', async () => {
    const { resolver, findRetainedArticleByUrl } = resolverWith(retained());
    expect(
      await refusal(
        resolver.resolve({ kind: 'STORY', articleRef: NO_COUNTRY_REF, url: STORY_URL }),
      ),
    ).toBe('ASK_CONTEXT_STORY_REF_MISMATCH');
    expect(findRetainedArticleByUrl).not.toHaveBeenCalled();
  });

  it('an unresolvable reference → ASK_CONTEXT_STORY_NOT_FOUND (never a generic Ask)', async () => {
    expect(
      await refusal(
        resolverWith(null).resolver.resolve({
          kind: 'STORY',
          articleRef: STORY_REF,
          url: STORY_URL,
        }),
      ),
    ).toBe('ASK_CONTEXT_STORY_NOT_FOUND');
    /* A store failure reads as not retained (fail closed), never as success. */
    expect(
      await refusal(
        resolverWith(new Error('db down')).resolver.resolve({
          kind: 'STORY',
          articleRef: STORY_REF,
          url: STORY_URL,
        }),
      ),
    ).toBe('ASK_CONTEXT_STORY_NOT_FOUND');
  });

  it('a stored row that is a DIFFERENT story than the reference is refused', async () => {
    const { resolver } = resolverWith(retained({ url: NO_COUNTRY_URL }));
    expect(
      await refusal(resolver.resolve({ kind: 'STORY', articleRef: STORY_REF, url: STORY_URL })),
    ).toBe('ASK_CONTEXT_STORY_NOT_FOUND');
  });

  it('a stored article whose fields exceed the persisted bounds fails closed', async () => {
    const { resolver } = resolverWith(retained({ title: 'T'.repeat(1001) }));
    expect(
      await refusal(resolver.resolve({ kind: 'STORY', articleRef: STORY_REF, url: STORY_URL })),
    ).toBe('ASK_CONTEXT_STORY_OUT_OF_BOUNDS');
  });

  it('the user-supplied URL is LOOKUP DATA ONLY: no network fetch is ever made', async () => {
    const { resolver } = resolverWith(retained());
    await resolver.resolve({ kind: 'STORY', articleRef: STORY_REF, url: STORY_URL });
    await refusal(
      resolverWith(null).resolver.resolve({ kind: 'STORY', articleRef: STORY_REF, url: STORY_URL }),
    );
    if (fetchSpy) expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('R2B resolver — GEOGRAPHY from the governed registry', () => {
  it.each([
    ['PL', 'POL', 'Poland'],
    ['pl', 'POL', 'Poland'],
    ['POL', 'POL', 'Poland'],
    ['KEN', 'KEN', 'Kenya'],
    ['ke', 'KEN', 'Kenya'],
  ])('%s → canonical %s with the registry display name', async (code, iso3, name) => {
    const { resolver, findRetainedArticleByUrl } = resolverWith(null);
    const resolved = await resolver.resolve({ kind: 'GEOGRAPHY', countryCode: code });
    expect(resolved).toEqual({
      kind: 'GEOGRAPHY',
      countryIso3: iso3,
      geographyContext: { countryCode: iso3, displayName: name },
    });
    expect(isResolvedAskContext(resolved)).toBe(true);
    /* No I/O at all for geography. */
    expect(findRetainedArticleByUrl).not.toHaveBeenCalled();
  });

  it.each(['ZZ', 'ZZZ', 'Poland', 'UK', '616', 'P', 'POLA', ' POL', ''])(
    '%j → ASK_CONTEXT_GEOGRAPHY_UNKNOWN',
    async (code) => {
      expect(
        await refusal(
          resolverWith(null).resolver.resolve({ kind: 'GEOGRAPHY', countryCode: code }),
        ),
      ).toBe('ASK_CONTEXT_GEOGRAPHY_UNKNOWN');
    },
  );

  it('a client display name cannot be injected (resolver key-set guard)', async () => {
    expect(
      await refusal(
        resolverWith(null).resolver.resolve({
          kind: 'GEOGRAPHY',
          countryCode: 'POL',
          displayName: 'Atlantis',
        }),
      ),
    ).toBe('ASK_CONTEXT_INVALID');
  });

  it('cross-kind fields are refused (one kind per turn)', async () => {
    const { resolver } = resolverWith(retained());
    expect(
      await refusal(resolver.resolve({ kind: 'GEOGRAPHY', countryCode: 'POL', url: STORY_URL })),
    ).toBe('ASK_CONTEXT_INVALID');
    expect(
      await refusal(
        resolver.resolve({
          kind: 'STORY',
          articleRef: STORY_REF,
          url: STORY_URL,
          countryCode: 'POL',
        }),
      ),
    ).toBe('ASK_CONTEXT_INVALID');
    expect(await refusal(resolver.resolve({ kind: 'MODULE' }))).toBe('ASK_CONTEXT_INVALID');
    expect(await refusal(resolver.resolve('POL'))).toBe('ASK_CONTEXT_INVALID');
  });

  it('refusals carry a named code and a 4xx status (deterministic, not a 500)', async () => {
    try {
      await resolverWith(null).resolver.resolve({ kind: 'GEOGRAPHY', countryCode: 'ZZ' });
      throw new Error('not refused');
    } catch (e) {
      expect(e).toBeInstanceOf(AskContextRefused);
      expect((e as AskContextRefused).getStatus()).toBe(422);
      expect((e as AskContextRefused).getResponse()).toEqual({
        statusCode: 422,
        code: 'ASK_CONTEXT_GEOGRAPHY_UNKNOWN',
      });
    }
  });
});
