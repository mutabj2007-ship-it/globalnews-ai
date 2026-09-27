import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { fixture } from '@/components/analysis-frame/frameFixtures';
import { AskCompactResult } from './AskCompactResult';

/**
 * MY INTELLIGENCE COMPUTE CLOSURE R1 — the one optional prop on the governed
 * compact reader.
 *
 * A multi-story selection result cannot be reopened by the /search
 * transition, so that caller turns the link off. The declared source bound
 * exists only because that transition reaches the rest; without it, every
 * source must be listed, so nothing becomes unreachable.
 */

const render = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(
    createElement(AskCompactResult, { response: fixture() as AnalysisApiResponse, question: 'q', context: undefined, ...props }),
  );
const count = (html: string, marker: string): number => html.split(marker).length - 1;

describe('AskCompactResult — default behaviour is unchanged for every existing caller', () => {
  it('bounded source list, truncation note and the /search transition', () => {
    const html = render({});
    expect(fixture().analysis?.sources).toHaveLength(5);
    expect(count(html, 'data-ask="source"')).toBe(4);
    expect(html).toContain('data-ask="sources-truncated"');
    expect(html).toContain('data-ask="open-full"');
  });
});

describe('AskCompactResult — selection mode (showFullAnalysisLink = false)', () => {
  it('no /search transition, every source listed, and no note pointing at a missing link', () => {
    const html = render({ showFullAnalysisLink: false });
    expect(html).not.toContain('data-ask="open-full"');
    expect(count(html, 'data-ask="source"')).toBe(5);
    expect(html).not.toContain('data-ask="sources-truncated"');
  });
});
