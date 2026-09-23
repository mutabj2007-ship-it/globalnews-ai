import type { StoryContext } from '@globalnews-ai/shared';
import { resolveStoryTitle, transportableContext, fullAnalysisHref } from './storyContextStore';

/** Same fail-closed subject/anchor contract as /search; q is only a draft here. */
export function dashboardContext(params: Pick<URLSearchParams, 'get'>): StoryContext | undefined {
  const subject = resolveStoryTitle(params.get('storyTitle'));
  if (subject.kind === 'malformed') return undefined;
  const articleId = params.get('articleId');
  const countryCode = params.get('countryCode');
  if (articleId === null && countryCode === null) return undefined;
  return transportableContext({
    title: subject.kind === 'valid' ? subject.title : (params.get('q') ?? ''),
    ...(articleId !== null ? { articleId } : {}),
    ...(countryCode !== null ? { countryCode } : {}),
  });
}
export function sameAskContext(a: StoryContext | undefined, b: StoryContext | undefined): boolean {
  return (
    a?.title === b?.title && a?.articleId === b?.articleId && a?.countryCode === b?.countryCode
  );
}

/** Same bounded URL contract, different destination; arrival remains a draft. */
export function dashboardHref(question: string, context: StoryContext | undefined): string {
  return fullAnalysisHref(question, context).replace(/^\/search/, '/ask');
}
