import { parseStoryBriefView } from '@/lib/api/storyBriefApi';

/*
  ASK D0.1 — the S05 Brief states through the REAL frontend parser, from the BACKEND raw shape
  (GET /stories/:storyId/brief). The picker never sees a fixture the parser would reject: these
  are the same raw objects the local screenshot backend serves.
*/
const rawBrief = (state: 'READY' | 'PARTIAL' | 'INSUFFICIENT') => ({
  state,
  version: 2,
  evidenceRevision: 'r1',
  asOf: '2026-10-10T10:00:00Z',
  generatedAt: '2026-10-10T10:00:00Z',
  blocks: {
    summary: 'Fixture explanation.',
    keyFacts: [{ claim: 'Import costs rose in October.', sourceArticleIds: ['e1'] }],
  },
  evidenceRefs: [{ id: 'e1', url: 'https://publisher.example/story-1', title: 'Fixture source one', publisher: 'Example Wire', publishedAt: '2026-10-09T00:00:00Z' }],
  coverageGaps: state === 'INSUFFICIENT' ? ['No local source is available.'] : [],
  uncertainty: [],
});
const rawView = (state: string, brief: unknown) => ({
  storyId: 'story-1',
  currentEvidenceRevision: 'r2',
  versions: 2,
  generationAvailable: false,
  state,
  brief,
  lastAttempt: null,
});

describe('D0.1 S05 · backend raw Brief shape → the real parser', () => {
  it('STALE with a stored READY brief is readable (an earlier brief, not a material change)', () => {
    const view = parseStoryBriefView(rawView('STALE', rawBrief('READY')));
    expect(view).toMatchObject({ state: 'STALE', brief: { summary: 'Fixture explanation.', evidence: [{ publisher: 'Example Wire' }] } });
  });

  it('INSUFFICIENT is readable and keeps its gaps (Erratum E1 Q3)', () => {
    const view = parseStoryBriefView(rawView('INSUFFICIENT', rawBrief('INSUFFICIENT')));
    expect(view).toMatchObject({ state: 'INSUFFICIENT', brief: { coverageGaps: ['No local source is available.'] } });
  });

  it('NOT_GENERATED and CHECKING are notice states', () => {
    expect(parseStoryBriefView(rawView('NOT_GENERATED', null))).toMatchObject({ state: 'NONE' });
    expect(parseStoryBriefView(rawView('CHECKING', null))).toMatchObject({ state: 'CHECKING', inspectable: null });
  });

  it('the frontend VIEW shape is NOT a valid backend response (the fixture mistake this spec prevents)', () => {
    const viewShaped = { ...rawView('STALE', null), brief: { conclusion: 'READY', summary: 'x', evidence: [] } };
    expect(parseStoryBriefView(viewShaped)).toBeNull();
  });
});
