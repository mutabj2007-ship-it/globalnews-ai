import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalysisSourceRef } from '@globalnews-ai/shared';
import { AskAnswerProse, governedSourceFor } from './AskAnswerProse';

/**
 * ASK RETRIEVAL / CONVERSATION R2 — a requested news table keeps its data on a phone and its
 * source cells are clickable through the GOVERNED sources only (contract §8/§9, TEST A/B).
 */
const sources: AnalysisSourceRef[] = [
  {
    articleId: 'a1',
    publisher: 'Business Daily Africa',
    title: 'KRA extends filing deadline for small traders',
    url: 'https://www.businessdailyafrica.com/bd/economy/kra-deadline',
    publishedAt: '2026-10-03T08:00:00Z',
  },
  {
    articleId: 'a2',
    publisher: 'Central Bank of Kenya',
    title: 'MPC holds rate',
    url: 'https://www.centralbank.go.ke/2026/10/02/mpc/',
    publishedAt: '2026-10-02T12:00:00Z',
  },
];

const table = [
  'Three developments in the past seven days.',
  '',
  '| Development | Date | Likely impact | Source |',
  '|---|---|---|---|',
  '| Filing deadline extended | 2026-10-03 | More time to file | Business Daily Africa |',
  '| Policy rate held | 2026-10-02 | Credit costs unchanged | Central Bank of Kenya |',
  '| Fuel prices | not reported | not reported | [made up](https://evil.example/phish) |',
].join('\n');

const html = renderToStaticMarkup(
  createElement(AskAnswerProse, { source: table, sources, language: 'en' }),
);

describe('ASK R2 · news tables: governed source links, readable on a phone', () => {
  it('a source cell naming exactly one cited source links to THAT source’s governed URL', () => {
    expect(html).toContain('href="https://www.businessdailyafrica.com/bd/economy/kra-deadline"');
    expect(html).toContain('href="https://www.centralbank.go.ke/2026/10/02/mpc/"');
    expect(html.match(/data-ask="table-source"/g)).toHaveLength(2);
  });

  it('a model-written URL is never followed (the label stays text)', () => {
    expect(html).not.toContain('evil.example');
    expect(html).toContain('made up');
  });

  it('ambiguous or unknown names stay text', () => {
    expect(governedSourceFor('Reuters', sources)).toBeNull();
    expect(governedSourceFor('', sources)).toBeNull();
    const twice = [...sources, { ...sources[0]!, articleId: 'a3' }];
    expect(governedSourceFor('Business Daily Africa', twice)).toBeNull();
  });

  it('the table scrolls inside its own labelled region with readable column widths', () => {
    expect(html).toMatch(/<div role="region" aria-label="Development · Date · Likely impact · Source" tabindex="0" data-ask="answer-table"[^>]*overflow-x-auto/);
    expect(html).toContain('min-width:32rem');
  });
});
