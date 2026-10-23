import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import type {
  AskV2BriefingVersion,
  AskV2FollowedAssessment,
  AskV2FollowedCheck,
  AskV2Outcome,
} from '@/lib/api/askV2Api';
import {
  LATEST_CHECK,
  changeClasses,
  checkComparisonHref,
  comparisonStatus,
  evidenceForClaim,
  isIncompleteCheck,
  recordStatus,
  selectCheck,
  versionReadOf,
  versionsToCompare,
} from '@/lib/ask/followComparison';
import { FOLLOW_COMPARISON_DRAFT_LOCALES, followComparisonStrings } from '@/lib/ask/followComparisonStrings';
import { AskCheckComparisonView } from './AskCheckComparison';

/**
 * ASK R3 · D09 — Before / Latest of ONE recorded check (CTO, 2026-10-10).
 * Same-check pairing only; truthful statuses when a side is missing, unreadable or withheld;
 * incomplete checks disclosed; new reporting never presented as a change; My updates kept.
 */
const read = (...p: string[]) => readFileSync(join(__dirname, ...p), 'utf8');
const textOf = (node: ReactTestInstance): string =>
  node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const byChange = (root: ReactTestInstance, id: string) =>
  root.findAll((n) => typeof n.type === 'string' && n.props['data-ask-change'] === id);

const assessment = (over: Partial<AskV2FollowedAssessment> = {}): AskV2FollowedAssessment => ({
  schema: 'followed-assessment/2',
  outcome: 'MATERIAL_CHANGE',
  reasons: ['KEY_POINT_CITES_NEW_EVIDENCE'],
  baselineVersion: 1,
  baselineAsOf: '2026-10-08T10:00:00Z',
  checkedAsOf: '2026-10-10T08:00:00Z',
  newEvidence: [
    { id: 'e1', url: 'https://example.org/e1', title: 'Rent index (fixture)', publisher: 'Wire A', publishedAt: '2026-10-09T08:00:00Z' },
  ],
  earlierReportingFoundNow: [],
  possibleCorrections: [],
  supportedChanges: [{ claim: 'Rents rose 1.1% month on month.', sourceArticleIds: ['e1'] }],
  carriedOverCount: 2,
  notSeenThisCheckCount: 0,
  unassessedSources: [],
  expiredNotices: 'NOT_ASSESSED',
  ...over,
});
const check = (over: Partial<AskV2FollowedCheck> = {}, a: Partial<AskV2FollowedAssessment> = {}): AskV2FollowedCheck => ({
  id: 'c-2',
  turnId: 't-2',
  outcome: 'MATERIAL_CHANGE',
  assessment: assessment(a),
  baselineVersion: 1,
  resultingVersion: 2,
  checkedAt: '2026-10-10T08:00:00Z',
  aiExecuted: false,
  ...over,
});
const version = (n: number, over: Partial<AskV2BriefingVersion['blocks']> = {}, refs = [] as AskV2BriefingVersion['evidenceRefs']): AskV2BriefingVersion => ({
  briefingId: 'b',
  title: 'What changed in living costs in Poland?',
  version: n,
  asOf: n === 1 ? '2026-10-08T10:00:00Z' : '2026-10-10T08:00:00Z',
  windowFrom: null,
  windowTo: null,
  blocks: { schema: 'briefing-blocks/1', answerState: 'CURRENT_REPORTING', summary: `Answer text of version ${n}.`, keyFacts: [], comparisonTable: null, background: null, ...over },
  evidenceRefs: refs,
  evidenceRevision: 'r',
  coverageGaps: [],
  createdAt: '2026-10-10T08:00:00Z',
  supersededBy: null,
  aiExecuted: false,
});
const latestRefs = [
  { id: 'e1', host: 'example.org', url: 'https://example.org/e1', title: 'Rent index (fixture)', publisher: 'Wire A', publishedAt: '2026-10-09T08:00:00Z' },
  { id: 'a0', host: 'example.org', url: 'https://example.org/a0', title: 'Earlier report', publisher: 'Wire B', publishedAt: '2026-10-07T08:00:00Z' },
];
const ok = <T,>(value: T): AskV2Outcome<T> => ({ ok: true, value });

function render(props: Parameters<typeof AskCheckComparisonView>[0]): ReactTestInstance {
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(createElement(AskCheckComparisonView, props));
  });
  return r.root;
}

describe('same-check pairing: only the baseline and resulting version of ONE recorded check', () => {
  it('reads exactly the two versions the check record names', () => {
    expect(versionsToCompare(check({ baselineVersion: 3, resultingVersion: 5 }))).toEqual({ before: 3, latest: 5 });
  });

  it('selects one recorded check by id, or the newest one — never versions from another check', () => {
    const older = check({ id: 'c-1', baselineVersion: 1, resultingVersion: 2, checkedAt: '2026-10-09T08:00:00Z' });
    const newer = check({ id: 'c-2', baselineVersion: 2, resultingVersion: 3, checkedAt: '2026-10-10T08:00:00Z' });
    const detail = { checks: [older, newer] };
    expect(selectCheck(detail, LATEST_CHECK)).toBe(newer);
    expect(selectCheck(detail, 'c-1')).toBe(older);
    expect(selectCheck(detail, 'c-9')).toBeNull();
    expect(selectCheck({}, LATEST_CHECK)).toBeNull();
    /* the pair stays the selected record's own pair (2 → 3), not "the latest two saved versions" */
    expect(versionsToCompare(selectCheck(detail, 'c-1')!)).toEqual({ before: 1, latest: 2 });
  });

  it('a read that returns a different version than requested is never used', () => {
    expect(versionReadOf(2, ok(version(3))).kind).toBe('UNAVAILABLE');
    expect(versionReadOf(2, ok(version(2))).kind).toBe('OK');
  });

  it('the container reads only versionsToCompare(check) and nothing else', () => {
    const src = read('AskCheckComparison.tsx');
    expect(src).toContain('const { before, latest } = versionsToCompare(check);');
    expect(src.match(/askV2Api\.briefingVersion\(/g)).toHaveLength(2);
    expect(src).toContain('askV2Api.briefingVersion(briefingId, before)');
    expect(src).toContain('askV2Api.briefingVersion(briefingId, latest)');
    expect(src).not.toMatch(/askV2Api\.(briefings|createBriefing|addBriefingVersion|recordFollowedCheck|updateBriefing|deleteBriefing)\(/);
  });

  it('READY: Before and Latest with each version’s recorded date, the change with its evidence links', () => {
    const c = check();
    const root = render({ check: c, status: 'READY', before: version(1), latest: version(2, {}, latestRefs), locale: 'en' });
    const before = byChange(root, 'before')[0]!;
    const latest = byChange(root, 'latest')[0]!;
    expect(before.props['data-ask-change-version']).toBe(1);
    expect(latest.props['data-ask-change-version']).toBe(2);
    expect(textOf(before)).toContain('Version 1 · recorded 8 Oct 2026');
    expect(textOf(before)).toContain('Answer text of version 1.');
    expect(textOf(latest)).toContain('Version 2 · recorded 10 Oct 2026');
    const change = byChange(root, 'change')[0]!;
    expect(textOf(change)).toContain('Rents rose 1.1% month on month.');
    const link = change.findAll((n) => n.type === 'a')[0]!;
    expect(link.props.href).toBe('https://example.org/e1');
    expect(textOf(change)).toContain('Wire A');
    expect(textOf(change)).toContain('9 Oct 2026');
  });

  it('a claim is linked only to references the latest version itself holds', () => {
    expect(evidenceForClaim(['e1', 'missing', 'e1'], version(2, {}, latestRefs)).map((r) => r.id)).toEqual(['e1']);
  });
});

describe('a missing or unreadable side: the truthful status, nothing compared', () => {
  it.each([
    [check({ baselineVersion: null }), 'NO_BASELINE'],
    [check({ resultingVersion: null }), 'NO_RESULT'],
    [check({ baselineVersion: 2, resultingVersion: 2 }), 'SAME_VERSION'],
    [null, 'CHECK_NOT_FOUND'],
  ] as const)('record → %s', (c, status) => {
    expect(recordStatus(c)).toBe(status);
    expect(comparisonStatus(c, null, null)).toBe(status);
  });

  it('a failed or not-found read is unavailable', () => {
    const failed = versionReadOf(1, { ok: false, reason: 'NETWORK' });
    const missing = versionReadOf(2, { ok: false, reason: 'REFUSED', status: 404 });
    expect(comparisonStatus(check(), failed, { kind: 'OK', version: version(2) })).toBe('BEFORE_UNAVAILABLE');
    expect(comparisonStatus(check(), { kind: 'OK', version: version(1) }, missing)).toBe('LATEST_UNAVAILABLE');
    expect(comparisonStatus(check(), { kind: 'OK', version: version(1) }, { kind: 'OK', version: version(2) })).toBe('READY');
  });

  it.each([
    ['NO_BASELINE', 'No earlier answer was recorded for this check, so there is nothing to compare it with.'],
    ['NO_RESULT', 'This check did not record a new answer, so there is no latest version to compare.'],
    ['BEFORE_UNAVAILABLE', 'The earlier version could not be loaded. Nothing is compared.'],
    ['LATEST_UNAVAILABLE', 'The latest version could not be loaded. Nothing is compared.'],
    ['CHECK_NOT_FOUND', 'This check is no longer recorded, so there is nothing to compare.'],
  ] as const)('%s renders its sentence and no Before / Latest', (status, sentence) => {
    const root = render({ check: status === 'CHECK_NOT_FOUND' ? null : check(), status, before: version(1), latest: version(2), locale: 'en' });
    expect(textOf(byChange(root, 'status')[0]!)).toBe(sentence);
    expect(byChange(root, 'pair')).toHaveLength(0);
    expect(byChange(root, 'before')).toHaveLength(0);
    expect(byChange(root, 'latest')).toHaveLength(0);
    expect(byChange(root, 'changes')).toHaveLength(0);
  });
});

describe('a withheld (source rights) version: shown withheld, never its text', () => {
  it('403 / 451 on a version read is withheld; withheld outranks unavailable', () => {
    expect(versionReadOf(1, { ok: false, reason: 'REFUSED', status: 451 }).kind).toBe('WITHHELD');
    expect(versionReadOf(1, { ok: false, reason: 'REFUSED', status: 403 }).kind).toBe('WITHHELD');
    expect(comparisonStatus(check(), { kind: 'WITHHELD' }, { kind: 'UNAVAILABLE' })).toBe('BEFORE_WITHHELD');
    expect(comparisonStatus(check(), { kind: 'OK', version: version(1) }, { kind: 'WITHHELD' })).toBe('LATEST_WITHHELD');
  });

  it('the withheld status shows no version text, no claim and no evidence', () => {
    const root = render({ check: check(), status: 'BEFORE_WITHHELD', before: version(1), latest: version(2, {}, latestRefs), locale: 'en' });
    const all = textOf(root);
    expect(textOf(byChange(root, 'status')[0]!)).toBe('The earlier version is withheld for source rights. Its text is not shown, and nothing is compared.');
    expect(all).not.toContain('Answer text of version');
    expect(all).not.toContain('Rents rose');
    expect(byChange(root, 'evidence')).toHaveLength(0);
  });
});

describe('incomplete check: disclosed, never read as "nothing changed"', () => {
  it('the outcome or a partial check is incomplete', () => {
    expect(isIncompleteCheck(check({ outcome: 'INCOMPLETE_CHECK' }))).toBe(true);
    expect(isIncompleteCheck(check({}, { reasons: ['NEW_REPORTING_AFTER_BASELINE', 'PARTIAL_CHECK', 'NEWS_PARTIAL'] }))).toBe(true);
    expect(isIncompleteCheck(check())).toBe(false);
  });

  it('an incomplete check with no resulting version: the disclosure and the truthful status', () => {
    const c = check({ outcome: 'INCOMPLETE_CHECK', resultingVersion: null }, { outcome: 'INCOMPLETE_CHECK', reasons: ['SEARCH_FAILED'], supportedChanges: [], newEvidence: [] });
    const root = render({ check: c, status: comparisonStatus(c, null, null), before: null, latest: null, locale: 'en' });
    expect(textOf(byChange(root, 'incomplete')[0]!)).toContain('This check did not finish.');
    expect(textOf(byChange(root, 'status')[0]!)).toBe('This check did not record a new answer, so there is no latest version to compare.');
  });

  it('a partial check that has a pair keeps its disclosure, with the sources it could not assess', () => {
    const c = check({}, { reasons: ['KEY_POINT_CITES_NEW_EVIDENCE', 'PARTIAL_CHECK', 'NEWS_PARTIAL'], unassessedSources: ['rss-feeds'] });
    const root = render({ check: c, status: 'READY', before: version(1), latest: version(2, {}, latestRefs), locale: 'en' });
    const note = textOf(byChange(root, 'incomplete')[0]!);
    expect(note).toContain('This check did not finish.');
    expect(note).toContain('rss-feeds');
    expect(byChange(root, 'pair')).toHaveLength(1);
  });
});

describe('new reporting vs an actual change', () => {
  it('NEW_EVIDENCE only: listed as new reporting, and the changes section says there is none', () => {
    const c = check({ outcome: 'NEW_EVIDENCE' }, { outcome: 'NEW_EVIDENCE', reasons: ['NEW_REPORTING_AFTER_BASELINE'], supportedChanges: [] });
    expect(changeClasses(c)).toEqual({ changes: 0, newReporting: 1 });
    const root = render({ check: c, status: 'READY', before: version(1), latest: version(2, {}, latestRefs), locale: 'en' });
    expect(byChange(root, 'change')).toHaveLength(0);
    expect(textOf(byChange(root, 'no-changes')[0]!)).toBe(
      'The latest answer makes no point that cites reporting published after your earlier answer.',
    );
    const news = byChange(root, 'new-reporting')[0]!;
    expect(textOf(news)).toContain('on its own it is not a change to the answer');
    expect(textOf(news)).toContain('Rent index (fixture)');
  });

  it('MATERIAL_CHANGE: the cited point is a change, its new reporting stays listed apart', () => {
    const root = render({ check: check(), status: 'READY', before: version(1), latest: version(2, {}, latestRefs), locale: 'en' });
    const changes = byChange(root, 'changes')[0]!;
    const news = byChange(root, 'new-reporting')[0]!;
    expect(textOf(changes)).toContain('Rents rose 1.1% month on month.');
    expect(textOf(news)).not.toContain('Rents rose');
  });

  it('nothing says reviewed / unread; the strings carry no number of their own', () => {
    for (const locale of ['en', 'pl', 'de', 'fr', 'es', 'pt', 'ar'] as const) {
      const s = followComparisonStrings(locale);
      for (const value of Object.values(s)) {
        if (typeof value === 'string') {
          expect(value).not.toMatch(/\d/);
          if (locale === 'en') expect(value).not.toMatch(/review|unread/i);
        }
      }
    }
    expect([...FOLLOW_COMPARISON_DRAFT_LOCALES].sort()).toEqual(['ar', 'de', 'es', 'fr', 'pl', 'pt']);
    expect(read('..', '..', 'lib', 'ask', 'followComparisonStrings.ts')).toContain('DRAFT_PENDING_CLAUDE_L');
  });
});

describe('My updates unchanged, plus one link per check', () => {
  const updates = read('MyUpdatesClient.tsx');
  it('every existing My updates control is still there', () => {
    for (const id of [
      'data-ask="my-updates"',
      'data-ask="followed-question"',
      'data-ask="followed-details"',
      'data-ask="followed-latest-outcome"',
      'data-ask="followed-check"',
      'data-ask="followed-pause"',
      'data-ask="followed-edit"',
      'data-ask="followed-history"',
      'data-ask="followed-remove"',
      'data-ask="followed-checks"',
      'data-ask="my-updates-summary"',
      '<AskFollowAssessment check={check} locale={locale} />',
      "briefingHref(row.id, row.latestVersion, 'updates')",
    ]) {
      expect(updates).toContain(id);
    }
  });
  it('the change detail is a link only (nothing runs), to one recorded check', () => {
    expect(updates).toContain('href={checkComparisonHref(row.id, LATEST_CHECK)}');
    expect(updates).toContain('href={checkComparisonHref(row.id, check.id)}');
    expect(checkComparisonHref('b-1', 'c-2')).toBe('/saved/briefing?id=b-1&check=c-2&from=updates');
  });
  it('the change detail page takes the check from the address; without it the version view is unchanged', () => {
    const detail = read('BriefingDetailClient.tsx');
    expect(detail).toContain('if (checkId !== null) return;');
    expect(detail).toContain('check={selectCheck(detail.value, checkId)}');
    expect(detail).toContain('{checkId === null && detail?.ok === true && version?.ok === true && (');
    const page = read('..', '..', 'app', 'saved', 'briefing', 'page.tsx');
    expect(page).toContain('checkId={checkId}');
  });
});
