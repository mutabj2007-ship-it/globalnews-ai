import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { comparisonTableOf, withComparisonTable } from './comparison-table';

function response(analysis: Record<string, unknown>): AnalysisApiResponse {
  return { analysis: { sources: [], agreements: [], differences: [], ...analysis } } as never;
}
const SOURCES = [
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

describe('R2-S1 — evidence-linked comparison table (deterministic projection)', () => {
  it('projects differences then agreements, each linked to resolvable sources in source order', () => {
    const table = comparisonTableOf(
      response({
        sources: SOURCES,
        differences: [
          {
            topic: 'Inflation',
            positions: [
              { description: 'Kenya: 4.1% in September', sourceArticleIds: ['a2', 'a1'] },
              { description: 'Tanzania: 3.0% in September', sourceArticleIds: ['a2'] },
            ],
          },
        ],
        agreements: [{ point: 'Both central banks held rates', sourceArticleIds: ['a1'] }],
      }),
    );
    expect(table).toEqual({
      schema: 'ask-comparison-table/1',
      omittedRows: 0,
      rows: [
        {
          kind: 'DIFFERENCE',
          topic: 'Inflation',
          statement: 'Kenya: 4.1% in September',
          sourceArticleIds: ['a1', 'a2'],
        },
        {
          kind: 'DIFFERENCE',
          topic: 'Inflation',
          statement: 'Tanzania: 3.0% in September',
          sourceArticleIds: ['a2'],
        },
        {
          kind: 'AGREEMENT',
          topic: null,
          statement: 'Both central banks held rates',
          sourceArticleIds: ['a1'],
        },
      ],
    });
  });

  it('missing stays missing: unknown ids are dropped and an unlinked row is omitted and counted', () => {
    const table = comparisonTableOf(
      response({
        sources: SOURCES,
        agreements: [
          { point: 'Linked one', sourceArticleIds: ['a1'] },
          { point: 'Linked two', sourceArticleIds: ['a2', 'ghost'] },
          { point: 'Unlinked', sourceArticleIds: ['ghost'] },
        ],
      }),
    );
    expect(table?.rows.map((r) => r.statement)).toEqual(['Linked one', 'Linked two']);
    expect(table?.rows[1].sourceArticleIds).toEqual(['a2']);
    expect(table?.omittedRows).toBe(1);
  });

  it('produces no table when there is nothing to compare', () => {
    expect(comparisonTableOf(null)).toBeNull();
    expect(comparisonTableOf(response({ sources: SOURCES }))).toBeNull();
    expect(
      comparisonTableOf(
        response({ sources: SOURCES, agreements: [{ point: 'One', sourceArticleIds: ['a1'] }] }),
      ),
    ).toBeNull();
  });

  it('applies only to ask-r2-result/1 payloads and never overwrites an existing table', () => {
    const analysis = response({
      sources: SOURCES,
      agreements: [
        { point: 'A', sourceArticleIds: ['a1'] },
        { point: 'B', sourceArticleIds: ['a2'] },
      ],
    });
    const other = { schema: 'something-else', analysis };
    expect(withComparisonTable(other)).toBe(other);
    const r2 = { schema: 'ask-r2-result/1', analysis };
    expect(
      (withComparisonTable(r2) as { comparisonTable?: unknown }).comparisonTable,
    ).toBeDefined();
    const pinned = { ...r2, comparisonTable: 'kept' };
    expect(withComparisonTable(pinned)).toBe(pinned);
  });

  it('is pure: no AI, network or clock in the projection module', () => {
    const src = readFileSync(join(__dirname, 'comparison-table.ts'), 'utf8');
    expect(src).not.toMatch(/openai|fetch\(|Date\.now|new Date\(|prisma|HttpService/i);
  });
});
