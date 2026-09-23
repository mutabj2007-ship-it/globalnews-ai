import { dashboardContext, dashboardHref, sameAskContext } from './dashboardContext';
import { fullAnalysisHref } from './storyContextStore';
import { resolveAskStrings } from './askStrings';

describe('Dedicated Ask routing and subject identity', () => {
  it('opens a question as a draft without manufacturing story context', () => {
    expect(dashboardContext(new URLSearchParams('q=Why%3F'))).toBeUndefined();
  });
  it('preserves the subject separately from the follow-up through both entries', () => {
    const context = {
      title: 'Original subject',
      articleId: 'article-1',
      countryCode: 'POL',
      url: 'https://not-evidence.test',
    };
    const href = dashboardHref('Why?', context);
    expect(href.startsWith('/ask?')).toBe(true);
    const params = new URL(href, 'https://test.invalid').searchParams;
    expect(params.get('q')).toBe('Why?');
    const parsed = dashboardContext(params);
    expect(parsed).toEqual({ title: context.title, articleId: 'article-1', countryCode: 'POL' });
    expect(fullAnalysisHref('Why?', parsed)).toBe(href.replace('/ask?', '/search?'));
    expect(params.has('url')).toBe(false);
  });
  it.each(['', '   ', 'x'.repeat(401)])('fails closed for malformed storyTitle', (title) => {
    expect(
      dashboardContext(new URLSearchParams({ q: 'Why?', articleId: 'a', storyTitle: title })),
    ).toBeUndefined();
  });
  it('keeps the legacy absent-title path and either anchor', () => {
    expect(dashboardContext(new URLSearchParams('q=Poland&countryCode=POL'))).toEqual({
      title: 'Poland',
      countryCode: 'POL',
    });
    expect(dashboardContext(new URLSearchParams('q=Subject&articleId=a'))).toEqual({
      title: 'Subject',
      articleId: 'a',
    });
  });
  it('does not carry a prior question across a changed subject', () => {
    expect(sameAskContext({ title: 'A', articleId: 'a' }, { title: 'B', articleId: 'b' })).toBe(
      false,
    );
    expect(sameAskContext(undefined, undefined)).toBe(true);
  });
  it('has complete Polish keys with no frame fallback', () => {
    const en = resolveAskStrings('en');
    const pl = resolveAskStrings('pl');
    expect(pl.fellBack).toBe(false);
    for (const key of ['regions', 'controls', 'states', 'answerBlocks'] as const) {
      expect(Object.keys(pl.strings[key]).sort()).toEqual(Object.keys(en.strings[key]).sort());
    }
  });
});
