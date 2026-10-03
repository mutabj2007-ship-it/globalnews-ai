import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AskEvidenceTable } from './AskEvidenceTable';
import type { AskComparisonTable } from '@/lib/api/askV2Api';

const sources = [
  {
    articleId: 'a1',
    publisher: 'P1',
    title: 'T1',
    url: 'https://p1.example/1',
    publishedAt: '2026-10-01',
  },
  {
    articleId: 'a2',
    publisher: 'P2',
    title: 'T2',
    url: 'https://p2.example/2',
    publishedAt: '2026-10-02',
  },
];
const table: AskComparisonTable = {
  schema: 'ask-comparison-table/1',
  omittedRows: 1,
  rows: [
    {
      kind: 'DIFFERENCE',
      topic: 'Inflation',
      statement: 'Kenya: 4.1%',
      sourceArticleIds: ['a2', 'a1'],
    },
    { kind: 'AGREEMENT', topic: null, statement: 'Both held rates', sourceArticleIds: ['a1'] },
    { kind: 'AGREEMENT', topic: null, statement: 'Ghost-only row', sourceArticleIds: ['ghost'] },
  ],
};
const html = (t: AskComparisonTable | null, lang: 'en' | 'pl' = 'en') =>
  renderToStaticMarkup(createElement(AskEvidenceTable, { table: t, sources, language: lang }));

describe('R2-S1 — AskEvidenceTable', () => {
  it('renders an accessible table: caption, column headers, row headers', () => {
    const out = html(table);
    expect(out).toContain('<caption');
    expect(out.match(/scope="col"/g)).toHaveLength(3);
    expect(out.match(/scope="row"/g)).toHaveLength(2);
  });

  it('links every cell to the numbered source of analysis.sources, never an unknown id', () => {
    const out = html(table);
    expect(out).toContain('data-citation="1"');
    expect(out).toContain('data-citation="2"');
    expect(out).toContain('href="https://p2.example/2"');
    expect(out).not.toContain('Ghost-only row');
  });

  it('says that rows were omitted, in the reader language', () => {
    expect(html(table)).toContain('1 point is not shown');
    expect(html(table, 'pl')).toContain('Nie pokazano 1 punktu');
  });

  it('renders nothing when there is nothing to compare', () => {
    expect(html(null)).toBe('');
    expect(html({ ...table, rows: table.rows.slice(0, 1) })).toBe('');
  });

  it('stacks rows on a phone instead of scrolling sideways', () => {
    expect(html(table)).toMatch(/<tr[^>]*class="block[^"]*sm:table-row/);
  });

  it('composes nothing: no AI, no fetch, no effect in the component', () => {
    const src = readFileSync(join(__dirname, 'AskEvidenceTable.tsx'), 'utf8');
    expect(src).not.toMatch(/fetch\(|useEffect|analyzeNews|XMLHttpRequest/);
  });
});
