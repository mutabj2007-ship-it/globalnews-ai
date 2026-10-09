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

  describe('EAST AFRICA P0 · A — payload.intelligence is preserved, never rebuilt', () => {
    const intelligence = {
      considered: ['IMIHIGO'],
      contributions: [
        {
          contributorId: 'IMIHIGO',
          domain: 'governance',
          status: 'USED',
          applicability: 'REQUIRED',
          observations: [
            {
              reference: 'IMIHIGO:2024-25:56',
              kind: 'DISTRICT_SCORE',
              label: 'Gasabo',
              value: '81.2',
              unit: '%',
              period: '2024/25',
              geography: 'Gasabo',
              source: { name: 'MINALOC', url: 'https://minaloc.gov.rw/x', licence: null },
              retainedAt: '2026-09-01T00:00:00Z',
              detail: { place: null, parties: [], headline: null, citedOutlets: [] },
            },
          ],
          temporalBasis: 'RETAINED_CYCLE',
          geographyBasis: 'nisr:district:56',
          disclosures: ['RETAINED_NOT_CURRENT'],
          degradationReason: null,
        },
      ],
    };

    it('keeps the contribution set exactly as the answer carried it', () => {
      const s = briefingSnapshotOf({ ...base, intelligence })!;
      expect(s.blocks.intelligence).toEqual(intelligence);
      // A degraded/background-only answer keeps its specialist basis too.
      const bg = briefingSnapshotOf({
        ...base,
        analysis: null,
        background: { text: 'Background.' },
        intelligence,
      })!;
      expect(bg.blocks.intelligence).toEqual(intelligence);
    });

    it('records null when no specialist was considered or the field is malformed', () => {
      expect(briefingSnapshotOf(base)!.blocks.intelligence).toBeNull();
      for (const bad of [
        null,
        'x',
        { considered: 'IMIHIGO', contributions: [] },
        { considered: [1], contributions: [] },
        { considered: ['IMIHIGO'] },
        { considered: ['IMIHIGO'], contributions: [null] },
      ]) {
        expect(briefingSnapshotOf({ ...base, intelligence: bad })!.blocks.intelligence).toBeNull();
      }
    });

    it('is pure: the same payload gives the same snapshot', () => {
      expect(briefingSnapshotOf({ ...base, intelligence })).toEqual(
        briefingSnapshotOf({ ...base, intelligence }),
      );
    });
  });
});

describe('PRIMARILY STRUCTURED answers (Opportunities intake finding) — saveable on their governed basis', () => {
  const base = { schema: 'ask-r2-result/1', answer: { state: 'RETAINED_RECORD' }, checkedAt: '2026-10-09T08:00:00Z', analysis: null, background: null };
  const contribution = (contributorId: string, status: string, applicability = 'REQUIRED', observations: unknown[] = [{ reference: 'r1', kind: 'K', label: 'District score', value: '77.2', unit: null, period: '2024/2025', geography: 'RWA', source: { name: 'NISR', url: null, licence: 'CC BY 4.0' }, retainedAt: '2026-09-22T00:00:00Z' }]) => ({
    contributorId, domain: 'governance', status, applicability, observations, temporalBasis: 'RETAINED_EVALUATION_CYCLE', geographyBasis: 'RWA', disclosures: [], degradationReason: null,
  });

  it('a governed-record answer with no summary and no background is saved, its records verbatim', () => {
    const intelligence = { considered: ['IMIHIGO'], contributions: [contribution('IMIHIGO', 'USED')] };
    const s = briefingSnapshotOf({ ...base, intelligence });
    expect(s).not.toBeNull();
    expect(s!.blocks.summary).toBeNull();
    expect(s!.blocks.answerState).toBe('RETAINED_RECORD');
    expect(s!.blocks.intelligence).toEqual(intelligence);
    expect(s!.evidenceRefs).toEqual([]);
    /* sourced by its records: never labelled "no sourced answer" */
    expect(s!.coverageGaps).toEqual([]);
  });

  it('still refused when nothing governed was USED: GEOGRAPHY context only, NO_DATA, or no observations', () => {
    for (const contributions of [
      [contribution('GEOGRAPHY', 'USED', 'CONTEXT')],
      [contribution('ECONOMY_CPI', 'NO_DATA', 'REQUIRED', [])],
      [contribution('IMIHIGO', 'USED', 'REQUIRED', [])],
      [contribution('CONFLICT', 'REFUSED')],
    ]) {
      expect(briefingSnapshotOf({ ...base, intelligence: { considered: contributions.map((c) => c.contributorId), contributions } })).toBeNull();
    }
  });
});

describe('CTO continuation R2 — only a sourced, evidential governed record makes a structured answer citable', () => {
  const base = { schema: 'ask-r2-result/1', answer: { state: 'RETAINED_RECORD' }, checkedAt: '2026-10-09T08:00:00Z', analysis: null, background: null };
  const observation = (sourceName: string) => ({ reference: 'r1', kind: 'K', label: 'L', value: '1', unit: null, period: '2024/2025', geography: 'RWA', source: { name: sourceName, url: null, licence: null }, retainedAt: null });
  const contribution = (over: Record<string, unknown>) => ({
    contributorId: 'IMIHIGO', domain: 'governance', status: 'USED', applicability: 'REQUIRED', observations: [observation('NISR')],
    temporalBasis: 'RETAINED_EVALUATION_CYCLE', geographyBasis: 'RWA', disclosures: [], degradationReason: null, ...over,
  });
  const snap = (c: Record<string, unknown>) => briefingSnapshotOf({ ...base, intelligence: { considered: [String(c.contributorId)], contributions: [c] } });

  it('control: a USED, sourced, evidential record is saveable', () => {
    expect(snap(contribution({}))).not.toBeNull();
  });

  it.each([
    ['reference geography under another contributor id', { temporalBasis: 'REFERENCE_GEOGRAPHY' }],
    ['no temporal basis', { temporalBasis: 'NONE' }],
    ['disclosed as context, not evidence', { disclosures: ['CONTEXT_NOT_EVIDENCE'] }],
    ['a record that names no source', { observations: [observation('  ')] }],
    ['NO_MATCH', { status: 'NO_MATCH' }],
    ['DEGRADED', { status: 'DEGRADED' }],
    ['NOT_ASSESSED', { status: 'NOT_ASSESSED' }],
    ['CONTEXT applicability', { applicability: 'CONTEXT' }],
  ])('refused: %s', (_label, over) => {
    expect(snap(contribution(over))).toBeNull();
  });
});
