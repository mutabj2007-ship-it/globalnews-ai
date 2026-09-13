import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { NewsArticle } from '@globalnews-ai/shared';
import { formatObservationalTime, formatRelativeTime } from '@/lib/formatRelativeTime';
import { SourceArticleCard } from '@/components/search/SourceArticleCard';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * R4 GDELT — TEST X: A CONSUMER LABELS AN OBSERVED TIMESTAMP TRUTHFULLY.
 *
 * The captured Haberler record put GDELT's `seendate` 55 minutes after
 * the outlet's own publication time. That is close enough to look like
 * clock skew and far enough to be a false statement, so the reader is
 * told which kind of time they are looking at.
 */

const THREE_HOURS_AGO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

function article(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'a1',
    title: 'A story',
    summary: 'Summary',
    url: 'https://outlet.example/story',
    sourceId: 'outlet',
    sourceName: 'Outlet',
    category: 'world',
    sourcesCount: 1,
    publishedAt: THREE_HOURS_AGO,
    ...overrides,
  } as NewsArticle;
}

describe('X — formatObservationalTime states the basis', () => {
  it('an OBSERVED timestamp is prefixed and never says "published"', () => {
    const rendered = formatObservationalTime(THREE_HOURS_AGO, 'observed');

    expect(rendered).toContain('Seen');
    expect(rendered.toLowerCase()).not.toContain('published');
  });

  it('a PUBLISHER timestamp renders exactly as it always did', () => {
    expect(formatObservationalTime(THREE_HOURS_AGO, 'publisher')).toBe(
      formatRelativeTime(THREE_HOURS_AGO),
    );
  });

  /**
   * The weaker statement is the safe one. "3 hr ago" claims nothing about
   * WHICH kind of time it is and is true either way; "Seen 3 hr ago"
   * would make a claim an unproven basis is not entitled to make.
   */
  it('an ABSENT basis falls back to the plain form, which asserts nothing', () => {
    expect(formatObservationalTime(THREE_HOURS_AGO, undefined)).toBe(
      formatRelativeTime(THREE_HOURS_AGO),
    );
    expect(formatObservationalTime(THREE_HOURS_AGO, undefined)).not.toContain('Seen');
  });

  it('an unparseable timestamp stays empty rather than rendering a bare prefix', () => {
    expect(formatObservationalTime('not a date', 'observed')).toBe('');
  });

  it('the prefix is localized, not hard-coded English', () => {
    const polish = formatObservationalTime(THREE_HOURS_AGO, 'observed', 'pl');

    expect(polish).toContain(getDictionary('pl').formatRelativeTime.seenPrefix);
    expect(polish).not.toContain('Seen');
  });

  it('en and pl both define the prefix, so neither can fall through to a blank', () => {
    for (const language of ['en', 'pl'] as const) {
      const prefix = getDictionary(language).formatRelativeTime.seenPrefix;
      expect(typeof prefix).toBe('string');
      expect(prefix.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('X — the rendered source card carries the label', () => {
  it('shows the observed prefix for a GDELT-style article', () => {
    const html = renderToStaticMarkup(
      createElement(SourceArticleCard as never, {
        article: article({ publishedAtBasis: 'observed' }),
      } as never),
    );

    expect(html).toContain('Seen');
  });

  it('shows no prefix for a GNews-style article', () => {
    const html = renderToStaticMarkup(
      createElement(SourceArticleCard as never, {
        article: article({ publishedAtBasis: 'publisher' }),
      } as never),
    );

    expect(html).not.toContain('Seen');
  });
});
