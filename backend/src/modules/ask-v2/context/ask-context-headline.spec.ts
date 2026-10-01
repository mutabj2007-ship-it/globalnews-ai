import { computeArticleRef } from '../../news/identity/article-ref.util';
import { isSameHeadline } from '../../news/identity/headline-identity.util';
import type { AskRequest } from '../ask-compute.contract';
import { AskR2ExecutionAdapter, routeContextOf } from '../ask-r2-execution.adapter';
import { askRequestContext } from '../ask-request-context';
import type { ResolvedAskContext } from './resolved-ask-context';

/**
 * UNIFIED INTELLIGENCE BINDING R2E — the anchored-story correction on the CANONICAL path.
 * A Map story launched with its own headline as the question is scoped by the story
 * (ARTICLE_ANCHOR), never by the places inside the publisher's headline; a place the reader
 * genuinely typed keeps TYPED_GEOGRAPHY precedence exactly as before.
 */

const HEADLINE =
  'Hotel worker charged with sexually assaulting Australian three-year-old in Penang';
const URL_ = 'https://news.example/2026/10/01/penang-hotel';
const STORY: ResolvedAskContext = {
  kind: 'STORY',
  articleRef: computeArticleRef(URL_),
  articleId: 'anchor-penang',
  countryIso3: 'MYS',
  storyContext: {
    title: HEADLINE,
    articleId: 'anchor-penang',
    url: URL_,
    sourceName: 'Wire',
    countryCode: 'MYS',
  },
};

function adapter(): AskR2ExecutionAdapter {
  return new AskR2ExecutionAdapter(
    {} as never,
    { id: 'openai' } as never,
    { id: 'openai' } as never,
    { config: { outputWeight: 4 } } as never,
    {} as never,
    {} as never,
    { get: () => ({ maxArticles: 8, maxArticleChars: 1200, maxCompletionTokens: 2000 }) } as never,
    { registeredDomains: () => ['CONFLICT'] } as never,
    { record: async () => true } as never,
    {
      boundSpecialistDomains: () => ['CONFLICT'],
      read: async () => ({ considered: [], contributions: [] }),
    } as never,
  );
}
const scopeOf = async (question: string, context?: ResolvedAskContext) => {
  const request: AskRequest = {
    question,
    language: 'en',
    intent: 'ask',
    ...(context ? { context } : {}),
  };
  const plan = await askRequestContext.run({ accountId: 'u', ipScope: 'ip:v4:192.0.2.3' }, () =>
    adapter().prepare(request),
  );
  return JSON.parse(plan.scope) as { scopedBy: string; geography: string[] };
};

describe('isSameHeadline — conservative equality', () => {
  it('folds case, punctuation and whitespace only', () => {
    expect(isSameHeadline(`  ${HEADLINE.toUpperCase()}!! `, HEADLINE)).toBe(true);
    expect(isSameHeadline(`${HEADLINE} — what about Kenya?`, HEADLINE)).toBe(false);
    expect(isSameHeadline('', HEADLINE)).toBe(false);
    expect(isSameHeadline(HEADLINE, undefined)).toBe(false);
  });
});

describe('routeContextOf — the headline signal comes from the SERVER-resolved title', () => {
  it('flags the story headline, and nothing else', () => {
    expect(routeContextOf(STORY, HEADLINE)).toMatchObject({ questionIsStoryHeadline: true });
    expect(routeContextOf(STORY, 'What does this mean?')).not.toHaveProperty(
      'questionIsStoryHeadline',
    );
  });

  it('a STORY never carries the Map country — the story’s own server country is the anchor', () => {
    const ctx = routeContextOf(STORY, HEADLINE);
    expect(ctx).not.toHaveProperty('mapContextCountry');
    expect(ctx).toMatchObject({ storyAnchorCountry: 'MYS', hasResolvedArticleAnchor: true });
  });
});

describe('the canonical route — before/after the correction', () => {
  it('BEFORE (no story): the headline’s own places read as typed scope', async () => {
    const scope = await scopeOf(HEADLINE);
    expect(scope.scopedBy).toBe('TYPED_GEOGRAPHY');
  });

  it('AFTER (story headline as the question): scoped by the STORY, not by its places', async () => {
    const scope = await scopeOf(HEADLINE, STORY);
    expect(scope.scopedBy).toBe('ARTICLE_ANCHOR');
    expect(scope.geography).toEqual(['STORY_ANCHOR:MYS']);
  });

  it('a place the reader genuinely TYPED keeps its precedence over the story', async () => {
    const scope = await scopeOf('What is happening in Kenya?', STORY);
    expect(scope.scopedBy).toBe('TYPED_GEOGRAPHY');
  });
});
