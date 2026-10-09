import type { AskContribution, AskContributionObservation } from '../../ask-intelligence/ask-contribution.contract';
import type { BriefingEvidenceRef, BriefingIntelligence } from './briefing-snapshot';
import {
  assessFollowedCheck,
  evidenceKey,
  type FollowedBaseline,
  type FollowedCandidate,
} from './followed-change';
import { compareStructured, periodStart } from './structured-change';

const BASE_AS_OF = '2026-10-01T08:00:00.000Z';
const CHECK_AS_OF = '2026-10-09T08:00:00.000Z';

const ref = (id: string, publishedAt: string | null, title = `Report ${id}`): BriefingEvidenceRef => ({
  id,
  host: 'news.example',
  url: `https://www.news.example/story/${id}/?utm_source=x`,
  title,
  publisher: 'Example News',
  publishedAt,
});

const obs = (reference: string, over: Partial<AskContributionObservation> = {}): AskContributionObservation => ({
  reference,
  kind: 'UCDP_STATE_BASED',
  label: `Event ${reference}`,
  value: '3',
  unit: 'best-estimate fatalities',
  period: '2026-08-20',
  geography: 'COD',
  source: { name: 'UCDP GED candidate', url: 'https://ucdp.uu.se/', licence: null },
  retainedAt: '2026-09-24T00:00:00.000Z',
  ...over,
});

const conflict = (
  status: AskContribution['status'],
  observations: AskContributionObservation[] = [],
  geographyBasis = 'COD',
): AskContribution => ({
  contributorId: 'CONFLICT',
  domain: 'security',
  status,
  applicability: 'SUPPLEMENTARY',
  observations,
  temporalBasis: 'RETAINED_EVENT_RECORD',
  geographyBasis,
  disclosures: ['RETAINED_NOT_CURRENT'],
  degradationReason: status === 'DEGRADED' ? 'TIMEOUT' : null,
});

const intel = (...contributions: AskContribution[]): BriefingIntelligence => ({
  considered: [...new Set(contributions.map((c) => c.contributorId))],
  contributions,
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
    asOf: CHECK_AS_OF,
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

describe('REASON TO RETURN R1 · §8 — news reporting in a followed-question check', () => {
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

  it('a key point citing new reporting → MATERIAL_CHANGE with that point listed', () => {
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

  it('C · an old article newly discovered → NEW_EVIDENCE (earlier-dated), never MATERIAL_CHANGE', () => {
    const lateFound = ref('d', '2026-09-20T10:00:00Z');
    const a = assessFollowedCheck(
      baseline([old1]),
      candidate([old1, lateFound], [{ claim: 'x', sourceArticleIds: ['d'] }]),
    );
    expect(a.outcome).toBe('NEW_EVIDENCE');
    expect(a.reasons).toContain('EARLIER_DATED_REPORTING_FOUND');
    expect(a.earlierReportingFoundNow.map((e) => e.id)).toEqual(['d']);
    expect(a.newEvidence).toEqual([]);
    expect(a.supportedChanges).toEqual([]);
  });

  it('an undated new report is never fresh: it is earlier-dated evidence, not a change', () => {
    const a = assessFollowedCheck(baseline([old1]), candidate([old1, ref('e', null)]));
    expect(a.newEvidence).toEqual([]);
    expect(a.outcome).toBe('NEW_EVIDENCE');
    expect(a.earlierReportingFoundNow.map((e) => e.id)).toEqual(['e']);
  });

  it('a fresh correction headline → CORRECTION (flagged, not adjudicated)', () => {
    const corr = ref('f', '2026-10-06T10:00:00Z', 'Correction: earlier figure for fuel prices was wrong');
    const pl = ref('g', '2026-10-06T11:00:00Z', 'Sprostowanie do artykułu o cenach');
    const a = assessFollowedCheck(baseline([old1]), candidate([old1, corr, pl]));
    expect(a.outcome).toBe('CORRECTION');
    expect(a.reasons[0]).toBe('CORRECTION_HEADLINE');
    expect(a.possibleCorrections.map((e) => e.id)).toEqual(['f', 'g']);
  });

  it('a failed search → INCOMPLETE_CHECK; it never reads as "nothing changed"', () => {
    const a = assessFollowedCheck(baseline([old1]), candidate([], [], { retrievalFailed: true }));
    expect(a.outcome).toBe('INCOMPLETE_CHECK');
    expect(a.reasons).toContain('NEWS_SEARCH_FAILED');
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

  it('a partial news search with nothing new cannot say UNCHANGED', () => {
    const a = assessFollowedCheck(baseline([old1]), candidate([old1], [], { unassessedSources: ['gdelt-doc'] }));
    expect(a.outcome).toBe('INCOMPLETE_CHECK');
    expect(a.unassessedSources).toEqual(['gdelt-doc']);
  });

  it('a partial news search that found new evidence reports it with the unassessed part', () => {
    const a = assessFollowedCheck(
      baseline([old1]),
      candidate([old1, ref('c', '2026-10-05T10:00:00Z')], [], { unassessedSources: ['gdelt-doc'] }),
    );
    expect(a.outcome).toBe('NEW_EVIDENCE');
    expect(a.reasons).toEqual(expect.arrayContaining(['PARTIAL_CHECK', 'NEWS_PARTIAL']));
  });

  it('evidence missing from this check is counted, never called a retraction', () => {
    const a = assessFollowedCheck(baseline([old1, old2]), candidate([old1]));
    expect(a.outcome).toBe('UNCHANGED');
    expect(a.notSeenThisCheckCount).toBe(1);
    expect(a.possibleCorrections).toEqual([]);
  });

  it('a baseline with no sourced answer → INSUFFICIENT_BASELINE; the check becomes the baseline', () => {
    const a = assessFollowedCheck(
      baseline([], { answerState: 'INSUFFICIENT', summaryPresent: false }),
      candidate([old1]),
    );
    expect(a.outcome).toBe('INSUFFICIENT_BASELINE');
    expect(a.reasons).toEqual(['BASELINE_HAD_NO_SOURCED_ANSWER', 'NEW_BASELINE_TAKEN']);
  });

  it('editing the followed question breaks comparability: no change is claimed', () => {
    const a = assessFollowedCheck(
      baseline([old1]),
      candidate([ref('c', '2026-10-05T10:00:00Z')], [], { scopeRevision: 1 }),
    );
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

  it('expired notices are never claimed; one key per report regardless of tracking params', () => {
    expect(assessFollowedCheck(baseline([old1]), candidate([old1])).expiredNotices).toBe('NOT_ASSESSED');
    expect(evidenceKey({ id: '1', url: 'https://www.x.test/a/?utm_source=z#top' })).toBe(
      evidenceKey({ id: '2', url: 'https://x.test/a' }),
    );
  });
});

describe('CTO R1-B §3 — governed specialist records in a followed-question check (A–J)', () => {
  const news = ref('a', '2026-09-30T10:00:00Z');
  const e1 = obs('ucdp:1');
  const e2 = obs('ucdp:2', { period: '2026-08-25' });

  it('A · a Conflict record changes with NO new news article → MATERIAL_CHANGE (never "unchanged")', () => {
    const newEvent = obs('ucdp:3', { period: '2026-10-04', retainedAt: '2026-10-06T00:00:00.000Z' });
    const a = assessFollowedCheck(
      baseline([news], { intelligence: intel(conflict('USED', [e1, e2])) }),
      candidate([news], [], {}, { intelligence: intel(conflict('USED', [e1, e2, newEvent])) }),
    );
    expect(a.outcome).toBe('MATERIAL_CHANGE');
    expect(a.reasons[0]).toBe('STRUCTURED_RECORD_NEW_PERIOD');
    expect(a.structured.newEvents.map((r) => r.reference)).toEqual(['ucdp:3']);
    expect(a.structured.compared).toEqual(['CONFLICT:COD']);
  });

  it('A′ · a contributor going NO_MATCH → USED with a newly admitted record is a change', () => {
    const newEvent = obs('ucdp:9', { period: '2026-10-03', retainedAt: '2026-10-05T00:00:00.000Z' });
    const a = assessFollowedCheck(
      baseline([news], { intelligence: intel(conflict('NO_MATCH')) }),
      candidate([news], [], {}, { intelligence: intel(conflict('USED', [newEvent])) }),
    );
    expect(a.outcome).toBe('MATERIAL_CHANGE');
  });

  it('B · news changes but structured evidence does not → the news outcome; structured carried over', () => {
    const a = assessFollowedCheck(
      baseline([news], { intelligence: intel(conflict('USED', [e1])) }),
      candidate([news, ref('c', '2026-10-05T10:00:00Z')], [], {}, { intelligence: intel(conflict('USED', [e1])) }),
    );
    expect(a.outcome).toBe('NEW_EVIDENCE');
    expect(a.structured.carriedOverCount).toBe(1);
    expect(a.structured.newEvents).toEqual([]);
    expect(a.structured.revised).toEqual([]);
  });

  it('C′ · a record admitted after the baseline about an EARLIER period → NEW_EVIDENCE (late-admitted)', () => {
    const late = obs('ucdp:4', { period: '2026-07-15', retainedAt: '2026-10-05T00:00:00.000Z' });
    const a = assessFollowedCheck(
      baseline([news], { intelligence: intel(conflict('USED', [e1])) }),
      candidate([news], [], {}, { intelligence: intel(conflict('USED', [e1, late])) }),
    );
    expect(a.outcome).toBe('NEW_EVIDENCE');
    expect(a.reasons[0]).toBe('STRUCTURED_RECORD_LATE_ADMITTED');
    expect(a.structured.lateAdmitted.map((r) => r.reference)).toEqual(['ucdp:4']);
  });

  it('C″ · a record retained BEFORE the baseline that was simply not shown then is not a change', () => {
    const hidden = obs('ucdp:5', { retainedAt: '2026-09-24T00:00:00.000Z' });
    const a = assessFollowedCheck(
      baseline([news], { intelligence: intel(conflict('USED', [e1])) }),
      candidate([news], [], {}, { intelligence: intel(conflict('USED', [hidden, e1])) }),
    );
    expect(a.outcome).toBe('UNCHANGED');
    expect(a.structured.notPreviouslyShownCount).toBe(1);
  });

  it('D · the source revises a record (same identity, new content) → CORRECTION', () => {
    const revised = obs('ucdp:1', { value: '7', retainedAt: '2026-10-06T00:00:00.000Z' });
    const a = assessFollowedCheck(
      baseline([news], { intelligence: intel(conflict('USED', [e1, e2])) }),
      candidate([news], [], {}, { intelligence: intel(conflict('USED', [revised, e2])) }),
    );
    expect(a.outcome).toBe('CORRECTION');
    expect(a.reasons[0]).toBe('STRUCTURED_RECORD_REVISED');
    expect(a.structured.revised.map((r) => r.reference)).toEqual(['ucdp:1']);
  });

  it('D′ · a record no longer returned is never treated as a retraction', () => {
    const a = assessFollowedCheck(
      baseline([news], { intelligence: intel(conflict('USED', [e1, e2])) }),
      candidate([news], [], {}, { intelligence: intel(conflict('USED', [e1])) }),
    );
    expect(a.outcome).toBe('UNCHANGED');
    expect(a.structured.notSeenThisCheckCount).toBe(1);
    expect(a.structured.revised).toEqual([]);
  });

  it('a re-ingest of identical content (only retainedAt moved) is not a change', () => {
    const reingested = obs('ucdp:1', { retainedAt: '2026-10-06T00:00:00.000Z' });
    const a = assessFollowedCheck(
      baseline([news], { intelligence: intel(conflict('USED', [e1])) }),
      candidate([news], [], {}, { intelligence: intel(conflict('USED', [reingested])) }),
    );
    expect(a.outcome).toBe('UNCHANGED');
  });

  it('E · the structured reader fails during an otherwise successful news check → INCOMPLETE_CHECK', () => {
    const a = assessFollowedCheck(
      baseline([news], { intelligence: intel(conflict('USED', [e1])) }),
      candidate([news], [], {}, { intelligence: intel(conflict('DEGRADED')) }),
    );
    expect(a.outcome).toBe('INCOMPLETE_CHECK');
    expect(a.reasons).toContain('STRUCTURED_NOT_ASSESSED');
    expect(a.structured.unassessed).toEqual(['CONFLICT:COD:DEGRADED']);
  });

  it('E′ · the whole structured read missing on the check while the baseline had it → INCOMPLETE_CHECK', () => {
    const a = assessFollowedCheck(
      baseline([news], { intelligence: intel(conflict('USED', [e1])) }),
      candidate([news], [], {}, { intelligence: null }),
    );
    expect(a.outcome).toBe('INCOMPLETE_CHECK');
    expect(a.structured.unassessed).toEqual(['CONFLICT:COD:NOT_READ']);
  });

  it('E″ · a structured hole with new news still reports the news, marked PARTIAL', () => {
    const a = assessFollowedCheck(
      baseline([news], { intelligence: intel(conflict('USED', [e1])) }),
      candidate([news, ref('c', '2026-10-05T10:00:00Z')], [], {}, { intelligence: intel(conflict('DEGRADED')) }),
    );
    expect(a.outcome).toBe('NEW_EVIDENCE');
    expect(a.reasons).toEqual(expect.arrayContaining(['PARTIAL_CHECK', 'STRUCTURED_NOT_ASSESSED']));
  });

  it('E‴ · a not-assessed reader (Humanitarian) and a non-displayable one (CPI NO_DATA) are holes, never "none"', () => {
    const hum: AskContribution = { ...conflict('NOT_ASSESSED'), contributorId: 'HUMANITARIAN', domain: 'humanitarian' };
    const cpi: AskContribution = { ...conflict('NO_DATA', [], 'RWA'), contributorId: 'ECONOMY_CPI', domain: 'economic' };
    const a = assessFollowedCheck(
      baseline([news], { intelligence: intel(hum, cpi) }),
      candidate([news], [], {}, { intelligence: intel(hum, cpi) }),
    );
    expect(a.outcome).toBe('INCOMPLETE_CHECK');
    expect(a.structured.unassessed).toEqual(['ECONOMY_CPI:RWA:NO_DATA', 'HUMANITARIAN:COD:NOT_ASSESSED']);
  });

  it('F · two countries named, the new record applies to one: it is attributed to that country only', () => {
    const newKen = obs('ucdp:k1', { geography: 'KEN', period: '2026-10-04', retainedAt: '2026-10-06T00:00:00.000Z' });
    const a = assessFollowedCheck(
      baseline([news], { intelligence: intel(conflict('USED', [e1], 'COD'), conflict('NO_MATCH', [], 'KEN')) }),
      candidate([news], [], {}, {
        intelligence: intel(conflict('USED', [e1], 'COD'), conflict('USED', [newKen], 'KEN')),
      }),
    );
    expect(a.outcome).toBe('MATERIAL_CHANGE');
    expect(a.structured.newEvents).toEqual([expect.objectContaining({ reference: 'ucdp:k1', scope: 'KEN', geography: 'KEN' })]);
    expect(a.structured.compared).toEqual(['CONFLICT:COD', 'CONFLICT:KEN']);
  });

  it('G · an unchanged baseline checked repeatedly stays UNCHANGED every time (deterministic)', () => {
    const b = baseline([news], { intelligence: intel(conflict('USED', [e1, e2])) });
    const c = candidate([news], [], {}, { intelligence: intel(conflict('USED', [e2, e1])) });
    const runs = [1, 2, 3].map(() => assessFollowedCheck(b, c));
    expect(runs.map((r) => r.outcome)).toEqual(['UNCHANGED', 'UNCHANGED', 'UNCHANGED']);
    expect(runs[1]).toEqual(runs[0]);
  });

  it('I · observations of a non-USED contribution (non-publishable / refused) are never compared or exposed', () => {
    const leaked = obs('hidden:1', { label: 'MUST NOT APPEAR', retainedAt: '2026-10-06T00:00:00.000Z', period: '2026-10-05' });
    const a = assessFollowedCheck(
      baseline([news], { intelligence: intel(conflict('USED', [e1])) }),
      candidate([news], [], {}, { intelligence: intel(conflict('USED', [e1]), { ...conflict('REFUSED', [leaked], 'UGA') }) }),
    );
    expect(JSON.stringify(a)).not.toContain('MUST NOT APPEAR');
    expect(a.outcome).toBe('INCOMPLETE_CHECK');
    expect(a.structured.unassessed).toEqual(['CONFLICT:UGA:REFUSED']);
  });

  it('J · a question with no specialist scope: the structured part is not applicable and changes nothing', () => {
    const a = assessFollowedCheck(baseline([news], { intelligence: null }), candidate([news], [], {}, { intelligence: null }));
    expect(a.structured.applicable).toBe(false);
    expect(a.outcome).toBe('UNCHANGED');
    /* GEOGRAPHY is context, never evidence of change */
    const geo: AskContribution = { ...conflict('USED', [obs('geo:1')]), contributorId: 'GEOGRAPHY', applicability: 'CONTEXT' };
    expect(compareStructured(intel(geo), intel(geo), BASE_AS_OF).applicable).toBe(false);
  });

  it('a baseline saved before the structured field existed is not a comparable structured baseline', () => {
    const a = assessFollowedCheck(
      baseline([news]),
      candidate([news], [], {}, { intelligence: intel(conflict('USED', [e1])) }),
    );
    expect(a.outcome).toBe('INCOMPLETE_CHECK');
    expect(a.structured.unassessed).toEqual(['CONFLICT:COD:NO_COMPARABLE_BASELINE']);
  });

  it('a baseline with only structured evidence (no news) is a valid baseline', () => {
    const a = assessFollowedCheck(
      baseline([], { answerState: 'CURRENT_REPORTING', summaryPresent: true, intelligence: intel(conflict('USED', [e1])) }),
      candidate([], [], {}, { intelligence: intel(conflict('USED', [e1])) }),
    );
    expect(a.outcome).toBe('UNCHANGED');
  });

  it('source periods parse at their own precision; a cycle is not a month', () => {
    expect(periodStart('2026-08-31')).toBe(Date.UTC(2026, 7, 31));
    expect(periodStart('2026-08')).toBe(Date.UTC(2026, 7, 1));
    expect(periodStart('2024/2025')).toBe(Date.UTC(2024, 0, 1));
    expect(periodStart('unknown')).toBeNull();
  });
});
