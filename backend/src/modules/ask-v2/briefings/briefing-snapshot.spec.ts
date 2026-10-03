import { briefingSnapshotOf } from './briefing-snapshot';

const base = {
  schema: 'ask-r2-result/1',
  checkedAt: '2026-10-03T12:00:00.000Z',
  answer: { state: 'CURRENT_REPORTING' },
  analysis: {
    articles: [{ id: 'a1', content: 'FULL TEXT' }],
    analysis: {
      summary: 'Sourced summary [1].',
      keyFacts: [
        { claim: 'Linked', sourceArticleIds: ['a1'] },
        { claim: 'Unlinked', sourceArticleIds: ['ghost'] },
      ],
      agreements: [],
      differences: [],
      unknowns: ['Gap one'],
      sources: [
        {
          articleId: 'a1',
          publisher: 'P',
          title: 'T',
          url: 'https://x.example/1',
          publishedAt: '2026-10-01',
        },
      ],
    },
  },
  background: null,
};

describe('R2 · D1 — briefing snapshot (our output + references only)', () => {
  it('keeps the summary, linked key facts, references and gaps — never article text', () => {
    const s = briefingSnapshotOf(base)!;
    expect(s.asOf).toBe(base.checkedAt);
    expect(s.blocks.summary).toBe('Sourced summary [1].');
    expect(s.blocks.keyFacts).toEqual([{ claim: 'Linked', sourceArticleIds: ['a1'] }]);
    expect(s.evidenceRefs).toEqual([
      {
        id: 'a1',
        host: 'x.example',
        url: 'https://x.example/1',
        title: 'T',
        publisher: 'P',
        publishedAt: '2026-10-01',
      },
    ]);
    expect(s.coverageGaps).toEqual(['Gap one']);
    expect(JSON.stringify(s)).not.toContain('FULL TEXT');
  });

  it('keeps model background only as non-citable', () => {
    const s = briefingSnapshotOf({ ...base, analysis: null, background: { text: 'Background.' } })!;
    expect(s.blocks.background).toEqual({ text: 'Background.', citable: false });
    expect(s.coverageGaps).toEqual(['NO_SOURCED_ANSWER']);
  });

  it('refuses anything that is not a completed Ask R2 answer', () => {
    expect(briefingSnapshotOf(null)).toBeNull();
    expect(briefingSnapshotOf({ ...base, schema: 'x' })).toBeNull();
    expect(briefingSnapshotOf({ ...base, checkedAt: undefined })).toBeNull();
    expect(briefingSnapshotOf({ ...base, analysis: null, background: null })).toBeNull();
  });
});
