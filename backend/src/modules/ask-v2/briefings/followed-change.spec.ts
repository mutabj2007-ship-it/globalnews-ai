import type { BriefingEvidenceRef } from './briefing-snapshot';
import {
  assessFollowedCheck,
  evidenceKey,
  type FollowedBaseline,
  type FollowedCandidate,
} from './followed-change';

const BASE_AS_OF = '2026-10-01T08:00:00.000Z';

const ref = (id: string, publishedAt: string | null, title = `Report ${id}`): BriefingEvidenceRef => ({
  id,
  host: 'news.example',
  url: `https://www.news.example/story/${id}/?utm_source=x`,
  title,
  publisher: 'Example News',
  publishedAt,
});

const baseline = (refs: BriefingEvidenceRef[], over: Partial<FollowedBaseline> = {}): FollowedBaseline => ({
  version: 1,
  asOf: BASE_AS_OF,
  answerState: 'CURRENT_REPORTING',
  summaryPresent: true,
  evidenceRefs: refs,
  scopeRevision: 0,
  ...over,
});

const candidate = (
  refs: BriefingEvidenceRef[],
  keyFacts: { claim: string; sourceArticleIds: string[] }[] = [],
  over: Partial<FollowedCandidate> = {},
  snapshotOver: Partial<NonNullable<FollowedCandidate['snapshot']>> = {},
): FollowedCandidate => ({
  snapshot: {
    asOf: '2026-10-09T08:00:00.000Z',
    answerState: 'CURRENT_REPORTING',
    summaryPresent: true,
    keyFacts,
    evidenceRefs: refs,
    ...snapshotOver,
  },
  retrievalFailed: false,
  unassessedSources: [],
  scopeRevision: 0,
  ...over,
});

describe('REASON TO RETURN R1 · §8 — followed-question change assessment', () => {
  const old1 = ref('a', '2026-09-30T10:00:00Z');
  const old2 = ref('b', '2026-09-29T10:00:00Z');

  it('same relevant evidence → UNCHANGED (new wording of the answer is not a change)', () => {
    const a = assessFollowedCheck(
      baseline([old1, old2]),
      candidate([old1, old2], [{ claim: 'Entirely reworded point', sourceArticleIds: ['a'] }]),
    );
    expect(a.outcome).toBe('UNCHANGED');
    expect(a.supportedChanges).toEqual([]);
    expect(a.carriedOverCount).toBe(2);
  });

  it('a report published after the baseline → NEW_EVIDENCE', () => {
    const fresh = ref('c', '2026-10-05T10:00:00Z');
    const a = assessFollowedCheck(baseline([old1]), candidate([old1, fresh]));
    expect(a.outcome).toBe('NEW_EVIDENCE');
    expect(a.newEvidence.map((e) => e.id)).toEqual(['c']);
  });

  it('a key point citing new evidence → MATERIAL_CHANGE with that point listed', () => {
    const fresh = ref('c', '2026-10-05T10:00:00Z');
    const a = assessFollowedCheck(
      baseline([old1]),
      candidate([old1, fresh], [
        { claim: 'Old point', sourceArticleIds: ['a'] },
        { claim: 'Fuel levy raised to 18%', sourceArticleIds: ['c'] },
      ]),
    );
    expect(a.outcome).toBe('MATERIAL_CHANGE');
    expect(a.supportedChanges.map((c) => c.claim)).toEqual(['Fuel levy raised to 18%']);
  });

  it('a newly found report published BEFORE the baseline is earlier reporting, not a change', () => {
    const lateFound = ref('d', '2026-09-20T10:00:00Z');
    const a = assessFollowedCheck(
      baseline([old1]),
      candidate([old1, lateFound], [{ claim: 'x', sourceArticleIds: ['d'] }]),
    );
    expect(a.outcome).toBe('UNCHANGED');
    expect(a.earlierReportingFoundNow.map((e) => e.id)).toEqual(['d']);
    expect(a.newEvidence).toEqual([]);
  });

  it('an undated new report is never treated as fresh', () => {
    const undated = ref('e', null);
    const a = assessFollowedCheck(baseline([old1]), candidate([old1, undated]));
    expect(a.newEvidence).toEqual([]);
    expect(a.earlierReportingFoundNow.map((e) => e.id)).toEqual(['e']);
  });

  it('a fresh correction headline → POSSIBLE_CORRECTION (flagged, not adjudicated)', () => {
    const corr = ref('f', '2026-10-06T10:00:00Z', 'Correction: earlier figure for fuel prices was wrong');
    const pl = ref('g', '2026-10-06T11:00:00Z', 'Sprostowanie do artykułu o cenach');
    const a = assessFollowedCheck(baseline([old1]), candidate([old1, corr, pl]));
    expect(a.outcome).toBe('POSSIBLE_CORRECTION');
    expect(a.possibleCorrections.map((e) => e.id)).toEqual(['f', 'g']);
  });

  it('a failed search → INCOMPLETE_CHECK; it never reads as "nothing changed"', () => {
    const a = assessFollowedCheck(baseline([old1]), candidate([], [], { retrievalFailed: true }));
    expect(a.outcome).toBe('INCOMPLETE_CHECK');
    expect(a.reasons).toContain('SEARCH_FAILED');
  });

  it('a check that did not complete → INCOMPLETE_CHECK', () => {
    const a = assessFollowedCheck(baseline([old1]), {
      snapshot: null,
      retrievalFailed: false,
      unassessedSources: [],
      scopeRevision: 0,
    });
    expect(a.outcome).toBe('INCOMPLETE_CHECK');
    expect(a.reasons).toEqual(['CHECK_NOT_COMPLETED']);
  });

  it('a partial check with no new evidence cannot say UNCHANGED', () => {
    const a = assessFollowedCheck(
      baseline([old1]),
      candidate([old1], [], { unassessedSources: ['gdelt-doc'] }),
    );
    expect(a.outcome).toBe('INCOMPLETE_CHECK');
    expect(a.unassessedSources).toEqual(['gdelt-doc']);
  });

  it('a partial check that found new evidence reports it together with the unassessed part', () => {
    const fresh = ref('c', '2026-10-05T10:00:00Z');
    const a = assessFollowedCheck(
      baseline([old1]),
      candidate([old1, fresh], [], { unassessedSources: ['gdelt-doc'] }),
    );
    expect(a.outcome).toBe('NEW_EVIDENCE');
    expect(a.reasons).toContain('PARTIAL_CHECK');
  });

  it('evidence missing from this check is counted, never called a retraction', () => {
    const a = assessFollowedCheck(baseline([old1, old2]), candidate([old1]));
    expect(a.outcome).toBe('UNCHANGED');
    expect(a.notSeenThisCheckCount).toBe(1);
    expect(a.possibleCorrections).toEqual([]);
  });

  it('a baseline with no sourced answer → INSUFFICIENT_BASELINE, and the check becomes the baseline', () => {
    const a = assessFollowedCheck(
      baseline([], { answerState: 'INSUFFICIENT', summaryPresent: false }),
      candidate([old1]),
    );
    expect(a.outcome).toBe('INSUFFICIENT_BASELINE');
    expect(a.reasons).toEqual(['BASELINE_HAD_NO_SOURCED_ANSWER', 'NEW_BASELINE_TAKEN']);
  });

  it('editing the followed question breaks comparability: no change is claimed', () => {
    const fresh = ref('c', '2026-10-05T10:00:00Z');
    const a = assessFollowedCheck(baseline([old1]), candidate([fresh], [], { scopeRevision: 1 }));
    expect(a.outcome).toBe('INSUFFICIENT_BASELINE');
    expect(a.reasons[0]).toBe('QUESTION_EDITED_SINCE_BASELINE');
    expect(a.newEvidence).toEqual([]);
  });

  it('a completed search with no relevant reporting → NO_RELEVANT_UPDATE', () => {
    const a = assessFollowedCheck(
      baseline([old1]),
      candidate([], [], {}, { answerState: 'INSUFFICIENT', summaryPresent: false }),
    );
    expect(a.outcome).toBe('NO_RELEVANT_UPDATE');
    expect(a.reasons).toEqual(['SEARCH_COMPLETED_NO_RELEVANT_REPORTING']);
  });

  it('expired notices are never claimed', () => {
    expect(assessFollowedCheck(baseline([old1]), candidate([old1])).expiredNotices).toBe('NOT_ASSESSED');
  });

  it('one key per report regardless of tracking parameters, www or trailing slash', () => {
    expect(evidenceKey({ id: '1', url: 'https://www.x.test/a/?utm_source=z#top' })).toBe(
      evidenceKey({ id: '2', url: 'https://x.test/a' }),
    );
  });
});
