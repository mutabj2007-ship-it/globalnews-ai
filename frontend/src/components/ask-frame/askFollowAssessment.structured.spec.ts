import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AskFollowAssessment } from './AskFollowAssessment';
import type { AskV2FollowedCheck } from '@/lib/api/askV2Api';

/** CTO R1-B §3 — the reader sees governed record changes AND the classes a check could not assess. */
const rec = (reference: string, url: string | null) => ({
  contributorId: 'CONFLICT',
  scope: 'COD',
  reference,
  kind: 'UCDP_STATE_BASED',
  label: `Event ${reference}`,
  period: '2026-10-04',
  geography: 'COD',
  source: { name: 'UCDP GED candidate', url },
  retainedAt: '2026-10-06T00:00:00Z',
});

const check = (over: Partial<AskV2FollowedCheck['assessment']>): AskV2FollowedCheck => ({
  id: 'c1',
  turnId: 't1',
  outcome: over.outcome ?? 'MATERIAL_CHANGE',
  baselineVersion: 1,
  resultingVersion: 2,
  checkedAt: '2026-10-09T08:00:00Z',
  aiExecuted: false,
  assessment: {
    schema: 'followed-assessment/2',
    outcome: 'MATERIAL_CHANGE',
    reasons: [],
    baselineVersion: 1,
    baselineAsOf: '2026-10-01T08:00:00Z',
    checkedAsOf: '2026-10-09T08:00:00Z',
    newEvidence: [],
    earlierReportingFoundNow: [],
    possibleCorrections: [],
    supportedChanges: [],
    carriedOverCount: 0,
    notSeenThisCheckCount: 0,
    unassessedSources: [],
    expiredNotices: 'NOT_ASSESSED',
    structured: {
      applicable: true,
      newEvents: [rec('ucdp:3', 'https://ucdp.uu.se/'), rec('ucdp:4', 'javascript:alert(1)')],
      lateAdmitted: [],
      contentChanged: [],
      carriedOverCount: 2,
      notSeenThisCheckCount: 0,
      notPreviouslyShownCount: 0,
      unassessed: ['HUMANITARIAN:COD:NOT_ASSESSED'],
      compared: ['CONFLICT:COD'],
    },
    ...over,
  },
});

describe('AskFollowAssessment — governed specialist records (R1-B §3)', () => {
  let r: ReactTestRenderer;
  afterEach(() => act(() => r.unmount()));

  it('lists new governed records with period · place · label · source, and names the unassessed class', () => {
    act(() => {
      r = create(createElement(AskFollowAssessment, { check: check({}), locale: 'en' }));
    });
    const html = JSON.stringify(r.toJSON());
    expect(html).toContain('New governed records');
    expect(html).toContain('Event ucdp:3');
    expect(html).toContain('Structured evidence not assessed in this check: HUMANITARIAN:COD:NOT_ASSESSED.');
    expect(html).toContain('2 governed records unchanged');
    /* an unsafe source URL is text, never a link */
    const links = r.root.findAll((n) => n.type === 'a').map((n) => n.props.href);
    expect(links).toEqual(['https://ucdp.uu.se/']);
  });

  it('an older /1 assessment without a structured block still renders', () => {
    const c = check({ schema: 'followed-assessment/1', structured: undefined });
    act(() => {
      r = create(createElement(AskFollowAssessment, { check: c, locale: 'en' }));
    });
    expect(JSON.stringify(r.toJSON())).not.toContain('governed records');
  });
});
