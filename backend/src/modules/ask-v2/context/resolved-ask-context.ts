import {
  ARTICLE_REF_PATTERN,
  findCountryByIso3,
  MAX_SELECTED_STORIES,
  MULTI_STORY_ACTIONS,
  MULTI_STORY_MIN_STORIES,
  type GeographyContext,
  type MultiStoryAction,
  type StoryContext,
} from '@globalnews-ai/shared';
import { computeArticleRef } from '../../news/identity/article-ref.util';

/**
 * UNIFIED INTELLIGENCE BINDING R2B — the SERVER-RESOLVED context of one Ask V2 turn.
 *
 * Every field is established by a server authority: the story by the retained Article row
 * (title, articleId, url, sourceName, country), the geography by the shared COUNTRIES registry.
 * No client text is ever copied in. It travels on AskRequest.context and is persisted, as is,
 * in ComputeOperation.plan.context (Json) so a later execute restores it without re-reading any
 * client input.
 */
export type ResolvedAskContext =
  | {
      readonly kind: 'STORY';
      /** sha256(normalizeArticleUrl(url)) — the product's canonical story identity. */
      readonly articleRef: string;
      /** The retained Article row's primary key (what AnalysisService re-resolves). */
      readonly articleId: string;
      /** Only when the stored article's own country is a governed code; never invented. */
      readonly countryIso3?: string;
      readonly storyContext: StoryContext;
    }
  | {
      readonly kind: 'GEOGRAPHY';
      readonly countryIso3: string;
      readonly geographyContext: GeographyContext;
    }
  | {
      /** R2D — a My Intelligence selection, every story resolved from retained reporting. */
      readonly kind: 'SELECTION';
      readonly action: MultiStoryAction;
      readonly stories: readonly ResolvedSelectedStory[];
    };

/** R2D — one selected story as RESOLVED: its identity, its stored row id and stored URL. */
export interface ResolvedSelectedStory {
  readonly articleRef: string;
  readonly articleId: string;
  readonly url: string;
}

/** Bounds on server-sourced story fields carried in a persisted plan. */
export const RESOLVED_STORY_BOUNDS = {
  title: 1000,
  articleId: 200,
  url: 2048,
  sourceName: 200,
} as const;

/**
 * The canonical identity of a resolved context — what requestHash, planRevision and the
 * stored-result fingerprint pin. STORY is keyed by articleRef (the URL-derived story identity
 * the product uses everywhere; the provider article id is a weak 32-bit hash and never
 * identity). GEOGRAPHY is keyed by ISO3. SELECTION (R2D) is keyed by the action and the SORTED
 * set of articleRefs, so the same stories in any order are one selection, and Story Set A can
 * never be Story Set B.
 */
export type AskContextIdentity =
  readonly ['STORY', string] | readonly ['GEOGRAPHY', string] | readonly ['SELECTION', string];

export function contextIdentity(context: ResolvedAskContext): AskContextIdentity {
  if (context.kind === 'STORY') return ['STORY', context.articleRef] as const;
  if (context.kind === 'GEOGRAPHY') return ['GEOGRAPHY', context.countryIso3] as const;
  const refs = context.stories.map((story) => story.articleRef).sort();
  return ['SELECTION', `${context.action}:${refs.join(',')}`] as const;
}

/** A flat, deterministic token of the identity (used inside string tuples such as planRevision). */
export function contextIdentityToken(context: ResolvedAskContext): string {
  const [kind, value] = contextIdentity(context);
  return `context:${kind}:${value}`;
}

/** Same identity, or both absent. */
export function sameContextIdentity(
  a: ResolvedAskContext | undefined,
  b: ResolvedAskContext | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  const [ka, va] = contextIdentity(a);
  const [kb, vb] = contextIdentity(b);
  return ka === kb && va === vb;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const hasExactlyKeys = (o: Record<string, unknown>, allowed: readonly string[]): boolean =>
  Object.keys(o).every((k) => allowed.includes(k));

const boundedString = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

function isGovernedIso3(v: unknown): v is string {
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) return false;
  return findCountryByIso3(v)?.iso3 === v;
}

/**
 * Strict shape + bounds check of a resolved context, e.g. one read back from a persisted plan.
 * Anything unknown, oversized, inconsistent or not governed is rejected (the caller fails
 * closed with ASK_PLAN_INVALID). It re-proves the two server facts a stored plan could
 * otherwise drift from: articleRef is the identity of the stored URL, and the geography
 * display name is the registry's own.
 */
export function isResolvedAskContext(v: unknown): v is ResolvedAskContext {
  if (!isObject(v)) return false;
  if (v.kind === 'STORY') {
    if (!hasExactlyKeys(v, ['kind', 'articleRef', 'articleId', 'countryIso3', 'storyContext']))
      return false;
    if (typeof v.articleRef !== 'string' || !ARTICLE_REF_PATTERN.test(v.articleRef)) return false;
    if (!boundedString(v.articleId, RESOLVED_STORY_BOUNDS.articleId)) return false;
    if (v.countryIso3 !== undefined && !isGovernedIso3(v.countryIso3)) return false;
    const s = v.storyContext;
    if (!isObject(s)) return false;
    if (!hasExactlyKeys(s, ['title', 'articleId', 'url', 'sourceName', 'countryCode']))
      return false;
    if (!boundedString(s.title, RESOLVED_STORY_BOUNDS.title)) return false;
    if (s.articleId !== v.articleId) return false;
    if (!boundedString(s.url, RESOLVED_STORY_BOUNDS.url)) return false;
    if (computeArticleRef(s.url) !== v.articleRef) return false;
    if (
      s.sourceName !== undefined &&
      !boundedString(s.sourceName, RESOLVED_STORY_BOUNDS.sourceName)
    )
      return false;
    if (s.countryCode !== v.countryIso3) return false;
    return true;
  }
  if (v.kind === 'GEOGRAPHY') {
    if (!hasExactlyKeys(v, ['kind', 'countryIso3', 'geographyContext'])) return false;
    if (!isGovernedIso3(v.countryIso3)) return false;
    const g = v.geographyContext;
    if (!isObject(g) || !hasExactlyKeys(g, ['countryCode', 'displayName'])) return false;
    if (g.countryCode !== v.countryIso3) return false;
    if (g.displayName !== findCountryByIso3(v.countryIso3)?.name) return false;
    return true;
  }
  if (v.kind === 'SELECTION') {
    if (!hasExactlyKeys(v, ['kind', 'action', 'stories'])) return false;
    if (
      typeof v.action !== 'string' ||
      !(MULTI_STORY_ACTIONS as readonly string[]).includes(v.action)
    )
      return false;
    const stories = v.stories;
    if (!Array.isArray(stories) || stories.length > MAX_SELECTED_STORIES) return false;
    if (stories.length < MULTI_STORY_MIN_STORIES[v.action as MultiStoryAction]) return false;
    const refs = new Set<string>();
    for (const story of stories) {
      if (!isObject(story) || !hasExactlyKeys(story, ['articleRef', 'articleId', 'url']))
        return false;
      if (typeof story.articleRef !== 'string' || !ARTICLE_REF_PATTERN.test(story.articleRef))
        return false;
      if (!boundedString(story.articleId, RESOLVED_STORY_BOUNDS.articleId)) return false;
      if (!boundedString(story.url, RESOLVED_STORY_BOUNDS.url)) return false;
      if (computeArticleRef(story.url) !== story.articleRef) return false;
      if (refs.has(story.articleRef)) return false;
      refs.add(story.articleRef);
    }
    return true;
  }
  return false;
}
