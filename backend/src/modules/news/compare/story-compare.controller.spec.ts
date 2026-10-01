import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { NewsArticle } from '@globalnews-ai/shared';
import { computeArticleRef } from '../identity/article-ref.util';
import {
  CompareReadEnabledGuard,
  ResolveStoriesDto,
  resolveStoriesForCompare,
} from './story-compare.controller';

/**
 * HOME R1 · STAGE A — the zero-AI Compare read model. Retained reads only; unresolved
 * references are returned as unavailable, never dropped; 404 until released.
 */

const URL_A = 'https://wire.example/a';
const URL_B = 'https://wire.example/b';
const REF_A = computeArticleRef(URL_A);
const REF_B = computeArticleRef(URL_B);
const retained: NewsArticle = {
  id: 'a',
  title: 'Retained title',
  summary: 'S',
  url: URL_A,
  sourceId: 'wire',
  sourceName: 'Wire',
  category: 'business',
  sourcesCount: 3,
  publishedAt: '2026-10-01T06:00:00.000Z',
  publishedAtBasis: 'observed',
  countryCode: 'KE',
  countryName: 'Kenya',
} as NewsArticle;

describe('POST /news/stories/resolve — Compare read model', () => {
  it('is a 404 unless COMPARE_READ_ENABLED is the literal "true"', () => {
    for (const value of [undefined, '', 'TRUE', '1', ' true']) {
      const guard = new CompareReadEnabledGuard({ get: () => value } as never);
      expect(() => guard.canActivate()).toThrow(NotFoundException);
    }
    expect(new CompareReadEnabledGuard({ get: () => 'true' } as never).canActivate()).toBe(true);
  });

  it('verifies each ref against its URL, reads retained reporting, and reports the rest', async () => {
    const lookups: string[] = [];
    const news = {
      findRetainedArticleByUrl: async (url: string) => {
        lookups.push(url);
        return url === URL_A ? retained : null;
      },
    };
    const out = await resolveStoriesForCompare(news, [
      { articleRef: REF_A, url: URL_A },
      { articleRef: REF_B, url: URL_B },
      { articleRef: REF_B, url: URL_A },
      { articleRef: REF_A, url: URL_A },
    ]);
    expect(lookups).toEqual([URL_A, URL_B]);
    expect(out).toEqual([
      {
        articleRef: REF_A,
        status: 'available',
        article: {
          title: 'Retained title',
          url: URL_A,
          imageUrl: null,
          sourceName: 'Wire',
          sourcesCount: 3,
          category: 'business',
          publishedAt: '2026-10-01T06:00:00.000Z',
          publishedAtBasis: 'observed',
          countryCode: 'KE',
          countryName: 'Kenya',
        },
      },
      { articleRef: REF_B, status: 'unavailable', reason: 'NOT_RETAINED' },
    ]);
  });

  it('a relabelled URL is refused without a lookup', async () => {
    const news = { findRetainedArticleByUrl: jest.fn() };
    const out = await resolveStoriesForCompare(news, [{ articleRef: REF_B, url: URL_A }]);
    expect(news.findRetainedArticleByUrl).not.toHaveBeenCalled();
    expect(out).toEqual([{ articleRef: REF_B, status: 'unavailable', reason: 'REF_URL_MISMATCH' }]);
  });

  it('a lookup failure is LOOKUP_FAILED, not an error page', async () => {
    const news = { findRetainedArticleByUrl: async () => Promise.reject(new Error('db down')) };
    expect(await resolveStoriesForCompare(news, [{ articleRef: REF_A, url: URL_A }])).toEqual([
      { articleRef: REF_A, status: 'unavailable', reason: 'LOOKUP_FAILED' },
    ]);
  });

  it('accepts 1–8 identities and nothing else', async () => {
    const errorsOf = async (body: unknown) =>
      validate(plainToInstance(ResolveStoriesDto, body) as object, { whitelist: true, forbidNonWhitelisted: true });
    expect(await errorsOf({ stories: [{ articleRef: REF_A, url: URL_A }] })).toEqual([]);
    expect((await errorsOf({ stories: [] })).length).toBeGreaterThan(0);
    const nine = Array.from({ length: 9 }, (_, i) => ({ articleRef: computeArticleRef(`${URL_A}${i}`), url: `${URL_A}${i}` }));
    expect((await errorsOf({ stories: nine })).length).toBeGreaterThan(0);
    expect((await errorsOf({ stories: [{ articleRef: REF_A, url: URL_A, title: 'x' }] })).length).toBeGreaterThan(0);
  });

  it('structurally cannot compute: no provider, model, analysis or write', () => {
    const code = readFileSync(join(__dirname, 'story-compare.controller.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(code).not.toMatch(/AnalysisService|analyzeNews|ANALYSIS_PROVIDER|openai|\.create\(|\.update\(|\.upsert\(|\.delete\(/);
    expect(code).not.toMatch(/topHeadlines|searchNews|\.search\(/);
  });
});
