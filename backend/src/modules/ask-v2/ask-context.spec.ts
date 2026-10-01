import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { NewsArticle } from '@globalnews-ai/shared';
import { computeArticleRef } from '../news/identity/article-ref.util';
import {
  AskContextResolver,
  contextIdentity,
  readPlanContext,
  type ResolvedAskContext,
} from './ask-context';
import { QuoteTurnDto } from './ask-v2.dto';
import { fingerprint, type AskPlan, type AskRequest } from './ask-compute.contract';
import { askContextRevisionPart } from './ask-r2-execution.adapter';

/**
 * HOME, DISCUSSIONS, ALERTS & PAID R1 · STAGE A — the server-resolved context references.
 * Contract §6: governed identifiers only, verified server-side, resolution returned, never
 * silently dropped; gate OFF leaves every existing request byte-identical.
 */

const URL_A = 'https://wire.example/story-a';
const URL_B = 'https://wire.example/story-b';
const URL_C = 'https://wire.example/story-c';
const REF_A = computeArticleRef(URL_A);
const REF_B = computeArticleRef(URL_B);
const REF_C = computeArticleRef(URL_C);

const article = (url: string, title: string, countryCode?: string): NewsArticle =>
  ({
    id: `id-${title}`,
    title,
    summary: 'Publisher summary',
    url,
    sourceId: 'wire',
    sourceName: 'Wire',
    category: 'world',
    sourcesCount: 2,
    publishedAt: '2026-10-01T06:00:00.000Z',
    publishedAtBasis: 'publisher',
    ...(countryCode === undefined ? {} : { countryCode }),
  }) as NewsArticle;

const RETAINED: Record<string, NewsArticle> = {
  [URL_A]: article(URL_A, 'Port works extend dwell times', 'KE'),
  [URL_B]: article(URL_B, 'Corridor upgrades begin'),
};

function resolver(enabled: boolean, lookups: string[] = []): AskContextResolver {
  const news = {
    findRetainedArticleByUrl: async (url: string) => {
      lookups.push(url);
      return RETAINED[url] ?? null;
    },
  };
  const config = { get: (key: string) => (key === 'ASK_CONTEXT_REFS_ENABLED' && enabled ? 'true' : undefined) };
  return new AskContextResolver(news as never, config as never);
}

describe('AskContextRefDto — the one reviewed DTO change accepts identifiers only', () => {
  const base = { idempotencyKey: 'k1', question: 'What changed?', language: 'en', intent: 'ask' };
  const errorsOf = async (body: unknown) =>
    validate(plainToInstance(QuoteTurnDto, body) as object, { whitelist: true, forbidNonWhitelisted: true });

  it('a request without context is unchanged and valid', async () => {
    expect(await errorsOf(base)).toEqual([]);
  });

  it('accepts a governed bag', async () => {
    expect(
      await errorsOf({
        ...base,
        context: { entry: 'compare', action: 'ASK_SELECTED', stories: [{ articleRef: REF_A, url: URL_A }], country: 'RW' },
      }),
    ).toEqual([]);
  });

  it.each([
    ['a title (client-described evidence)', { entry: 'story', title: 'Fake headline' }],
    ['a comment body', { entry: 'story', comment: 'I think…' }],
    ['an evidence blob', { entry: 'story', evidence: [{ text: 'x' }] }],
    ['a thread id', { entry: 'story', threadId: '00000000-0000-0000-0000-000000000000' }],
    ['a return path', { entry: 'story', returnPath: '/x' }],
    ['a story id', { entry: 'story', storyId: 'abc' }],
    ['a story body inside a reference', { entry: 'story', stories: [{ articleRef: REF_A, url: URL_A, title: 'x' }] }],
  ])('refuses %s (forbidNonWhitelisted → 400)', async (_label, context) => {
    expect((await errorsOf({ ...base, context })).length).toBeGreaterThan(0);
  });

  it('refuses an unknown entry, a malformed ref, a ninth story and an unknown action', async () => {
    expect((await errorsOf({ ...base, context: { entry: 'alert' } })).length).toBeGreaterThan(0);
    expect(
      (await errorsOf({ ...base, context: { entry: 'story', stories: [{ articleRef: 'nothex', url: URL_A }] } })).length,
    ).toBeGreaterThan(0);
    const nine = Array.from({ length: 9 }, (_, i) => ({ articleRef: computeArticleRef(`${URL_A}/${i}`), url: `${URL_A}/${i}` }));
    expect((await errorsOf({ ...base, context: { entry: 'compare', stories: nine } })).length).toBeGreaterThan(0);
    expect((await errorsOf({ ...base, context: { entry: 'compare', action: 'RANK' } })).length).toBeGreaterThan(0);
  });

  it('QuoteTurnDto grew by exactly one declared, nested field', () => {
    const dto = readFileSync(join(__dirname, 'ask-v2.dto.ts'), 'utf8');
    const quote = dto.slice(dto.indexOf('class QuoteTurnDto'), dto.indexOf('}', dto.indexOf('class QuoteTurnDto')));
    expect([...quote.matchAll(/(\w+)[!?]:\s*\w+/g)].map((m) => m[1])).toEqual([
      'idempotencyKey',
      'question',
      'language',
      'intent',
      'context',
    ]);
    const bag = dto.slice(dto.indexOf('class AskContextRefDto'), dto.indexOf('\n}', dto.indexOf('class AskContextRefDto')));
    expect([...bag.matchAll(/(\w+)[!?]:\s*\w+/g)].map((m) => m[1])).toEqual(['entry', 'stories', 'action', 'country']);
  });
});

describe('AskContextResolver — resolution is returned, never silently dropped', () => {
  it('gate OFF: every reference is EXCLUDED with a reason; nothing is read', async () => {
    const lookups: string[] = [];
    const resolved = await resolver(false, lookups).resolve({
      entry: 'story',
      stories: [{ articleRef: REF_A, url: URL_A }],
      country: 'RW',
    });
    expect(lookups).toEqual([]);
    expect(resolved.scope).toBe('none');
    expect(resolved.refs).toEqual([
      { kind: 'story', ref: REF_A, status: 'excluded', reason: 'CONTEXT_REFS_DISABLED' },
      { kind: 'country', ref: 'RW', status: 'excluded', reason: 'CONTEXT_REFS_DISABLED' },
    ]);
    expect(await resolver(false).executionInputs(resolved)).toEqual({ route: {} });
  });

  it('a story anchor resolves from RETAINED reporting; its label is the server title', async () => {
    const resolved = await resolver(true).resolve({ entry: 'story', stories: [{ articleRef: REF_A, url: URL_A }] });
    expect(resolved.scope).toBe('story');
    expect(resolved.refs).toEqual([
      { kind: 'story', ref: REF_A, status: 'available', label: 'Port works extend dwell times' },
    ]);
    const inputs = await resolver(true).executionInputs(resolved);
    expect(inputs.storyContext).toEqual({
      title: 'Port works extend dwell times',
      articleId: 'id-Port works extend dwell times',
      url: URL_A,
      sourceName: 'Wire',
      countryCode: 'KE',
    });
    expect(inputs.route).toEqual({ hasResolvedArticleAnchor: true, storyAnchorCountry: 'KEN' });
    expect(inputs.selection).toBeUndefined();
    expect(inputs.geographyContext).toBeUndefined();
  });

  it('a relabelled URL is UNAVAILABLE (REF_URL_MISMATCH) and is never looked up', async () => {
    const lookups: string[] = [];
    const resolved = await resolver(true, lookups).resolve({ entry: 'story', stories: [{ articleRef: REF_B, url: URL_A }] });
    expect(lookups).toEqual([]);
    expect(resolved.scope).toBe('none');
    expect(resolved.refs[0]).toMatchObject({ status: 'unavailable', reason: 'REF_URL_MISMATCH' });
  });

  it('a story that is not retained is UNAVAILABLE (NOT_RETAINED), shown, not dropped', async () => {
    const resolved = await resolver(true).resolve({
      entry: 'compare',
      action: 'ASK_SELECTED',
      stories: [
        { articleRef: REF_A, url: URL_A },
        { articleRef: REF_C, url: URL_C },
      ],
    });
    expect(resolved.scope).toBe('selection');
    expect(resolved.stories).toEqual([{ articleRef: REF_A, url: URL_A }]);
    expect(resolved.refs.map((r) => [r.ref, r.status, r.reason])).toEqual([
      [REF_A, 'available', undefined],
      [REF_C, 'unavailable', 'NOT_RETAINED'],
    ]);
  });

  it('a selection below the action minimum says so on every member (no AI will run)', async () => {
    const resolved = await resolver(true).resolve({
      entry: 'my-intelligence',
      action: 'COMPARE',
      stories: [
        { articleRef: REF_A, url: URL_A },
        { articleRef: REF_C, url: URL_C },
      ],
    });
    expect(resolved.refs.map((r) => r.reason)).toEqual(['SELECTION_BELOW_MINIMUM', 'NOT_RETAINED']);
  });

  it('a selection feeds the landed AnalysisSelection and frozen C its refs + action', async () => {
    const resolved = await resolver(true).resolve({
      entry: 'compare',
      stories: [
        { articleRef: REF_A, url: URL_A },
        { articleRef: REF_B, url: URL_B },
      ],
    });
    expect(resolved.action).toBe('ASK_SELECTED');
    const inputs = await resolver(true).executionInputs(resolved);
    expect(inputs.selection).toEqual({
      action: 'ASK_SELECTED',
      stories: [
        { articleRef: REF_A, url: URL_A },
        { articleRef: REF_B, url: URL_B },
      ],
    });
    expect(inputs.route).toEqual({ articleRefs: [REF_A, REF_B], selectionAction: 'ASK_SELECTED' });
  });

  it('a map country is the weakest scope: outranked by a story, shown as EXCLUDED', async () => {
    const both = await resolver(true).resolve({
      entry: 'map',
      stories: [{ articleRef: REF_A, url: URL_A }],
      country: 'rw',
    });
    expect(both.scope).toBe('story');
    expect(both.refs[1]).toEqual({ kind: 'country', ref: 'RWA', status: 'excluded', reason: 'OUTRANKED_BY_STORY', label: 'Rwanda' });

    const alone = await resolver(true).resolve({ entry: 'map', country: 'RW' });
    expect(alone.scope).toBe('geography');
    const inputs = await resolver(true).executionInputs(alone);
    expect(inputs.geographyContext).toEqual({ countryCode: 'RWA', displayName: 'Rwanda' });
    expect(inputs.route).toEqual({ mapContextCountry: 'RWA' });
  });

  it('an ungoverned country code is UNAVAILABLE, never guessed', async () => {
    const resolved = await resolver(true).resolve({ entry: 'map', country: 'ZZZ' });
    expect(resolved.scope).toBe('none');
    expect(resolved.refs).toEqual([{ kind: 'country', ref: 'ZZZ', status: 'unavailable', reason: 'UNKNOWN_COUNTRY' }]);
  });

  it('a persisted plan context is narrowed defensively', () => {
    expect(readPlanContext({})).toBeNull();
    expect(readPlanContext({ context: { version: 2 } })).toBeNull();
    expect(readPlanContext(null)).toBeNull();
  });
});

describe('identity, fingerprint and revision — absent context is byte-identical', () => {
  const request: AskRequest = { question: 'What changed?', language: 'en', intent: 'ask' };
  const plan: AskPlan = {
    revision: 'r1',
    scope: 's',
    contract: 'c',
    executionKey: 'e',
    validUntil: new Date(Date.now() + 60000).toISOString(),
    contextual: false,
    deepRequested: false,
    reportRequested: false,
    countryCount: 0,
    domainCount: 0,
    timeWindowDays: 0,
  };
  const ctx: ResolvedAskContext = {
    version: 1,
    entry: 'story',
    scope: 'story',
    action: null,
    stories: [{ articleRef: REF_A, url: URL_A }],
    iso3: null,
    refs: [],
  };

  it('fingerprint without context equals the landed fingerprint; with context it differs', () => {
    expect(fingerprint(request, { ...plan })).toBe(fingerprint(request, plan));
    expect(fingerprint(request, { ...plan, context: ctx })).not.toBe(fingerprint(request, plan));
    expect(fingerprint(request, { ...plan, context: { ...ctx, stories: [{ articleRef: REF_B, url: URL_B }] } })).not.toBe(
      fingerprint(request, { ...plan, context: ctx }),
    );
  });

  it('contextIdentity is null for no bag and stable for the same identifiers', () => {
    expect(contextIdentity(undefined)).toBeNull();
    const a = contextIdentity({ entry: 'story', stories: [{ articleRef: REF_A, url: URL_A }] });
    expect(a).toBe(contextIdentity({ entry: 'story', stories: [{ articleRef: REF_A, url: URL_A }] }));
    expect(a).not.toBe(contextIdentity({ entry: 'story', stories: [{ articleRef: REF_B, url: URL_B }] }));
  });

  it('the plan-revision part is absent without context and distinguishes contexts', () => {
    expect(askContextRevisionPart(undefined)).toBeUndefined();
    expect(askContextRevisionPart({ route: {} })).toBe('context:none');
    expect(askContextRevisionPart({ route: { mapContextCountry: 'RWA' } })).not.toBe(
      askContextRevisionPart({ route: { mapContextCountry: 'KEN' } }),
    );
  });
});

describe('structural — no free text from the client can become evidence', () => {
  /* Code only: the file's own documentation names the analysis path it feeds. */
  const SOURCE = readFileSync(join(__dirname, 'ask-context.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  it('the story anchor title comes from the retained article, not the request', () => {
    expect(SOURCE).toContain('title: article.title');
    expect(SOURCE).not.toMatch(/input\.\w*title/i);
  });
  it('the resolver never reaches a provider, a model or the analysis path', () => {
    expect(SOURCE).not.toMatch(/AnalysisService|ANALYSIS_PROVIDER|analyzeNews|openai|fetch\(/);
  });
});
