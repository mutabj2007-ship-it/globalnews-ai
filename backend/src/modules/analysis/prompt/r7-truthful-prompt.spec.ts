import type { NewsArticle } from '@globalnews-ai/shared';
import {
  buildAnalysisMessages,
  buildEvidenceStateInstruction,
  buildLiveEvidenceFreshnessInstruction,
  TRUTHFUL_ABSENCE_RULE,
} from './build-analysis-prompt.util';
import { WP6_PRESENTATION_RULES } from './presentation-rules.util';
import {
  NO_CURRENT_FINDINGS_RULE,
  RIGHTS_WITHHELD_RULE,
  SOURCES_UNAVAILABLE_RULE,
} from '../../ask-v2/job-execution';

/**
 * R7 X2 / X3 (#92) — what the model is TOLD about evidence age and absence (the PO's two current-news
 * field defects). X2 live freshness · X3 truthful absence (base, WP6 OFF). X4 (background
 * presentation) is a separate commit and spec: ask-v2/r7-background-presentation.spec.ts.
 * Pure prompt-text fixtures: no provider, model, DB or network.
 */
const T_PUB = '2026-10-10T16:01:00.000Z';
const article = (id: string, publishedAt: string): NewsArticle =>
  ({
    id,
    title: `Synthetic report ${id}`,
    summary: 'Synthetic summary text.',
    url: `https://news.example/${id}`,
    sourceId: 'synthetic',
    sourceName: 'Synthetic Desk',
    category: 'world',
    sourcesCount: 1,
    publishedAt,
    publishedAtBasis: 'publisher',
    evidenceId: 'S1',
  }) as unknown as NewsArticle;

const messages = (opts: {
  evidenceState?: 'live' | 'retained' | 'degraded-fallback';
  newest?: { timestamp: string; basis: 'publisher' | 'observed' | 'unknown' };
  window?: { statedPeriod: string; from: string; to: string };
  wp6?: boolean;
}) =>
  buildAnalysisMessages(
    'What are the most important current energy and transport developments in the European Union?',
    [article('a1', T_PUB)],
    1200,
    undefined,
    'en',
    undefined,
    undefined,
    undefined,
    opts.evidenceState,
    opts.newest,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    opts.window,
    undefined,
    undefined,
    opts.wp6,
  );

describe('R7 X2 · live evidence freshness (basis-honest, never an invented time)', () => {
  it('LIVE + publisher time: the model is told when the newest report was PUBLISHED', () => {
    const s = buildLiveEvidenceFreshnessInstruction('live', { timestamp: T_PUB, basis: 'publisher' });
    expect(s).toContain(`The newest report in this evidence set was published at ${T_PUB} (UTC)`);
    expect(s).toMatch(/only if its publication time falls inside that period/);
    expect(s).toMatch(/older than the period the reader asked about, say so plainly/);
  });

  it('LIVE + aggregator-observed time: never called a publication time', () => {
    const s = buildLiveEvidenceFreshnessInstruction('live', { timestamp: T_PUB, basis: 'observed' });
    expect(s).toMatch(/observed by a news aggregator/);
    expect(s).toMatch(/NOT the publication time/);
    expect(s).not.toMatch(/was published at/);
  });

  it('LIVE + unknown time: no time is stated or inferred', () => {
    const s = buildLiveEvidenceFreshnessInstruction('live', { timestamp: T_PUB, basis: 'unknown' });
    expect(s).toMatch(/is unverified/);
    expect(s).not.toContain(T_PUB);
  });

  it('no newest report → nothing (no invented time); non-live states → nothing (their own sentence stays)', () => {
    expect(buildLiveEvidenceFreshnessInstruction('live', undefined)).toBe('');
    expect(buildLiveEvidenceFreshnessInstruction('retained', { timestamp: T_PUB, basis: 'publisher' })).toBe('');
    expect(buildLiveEvidenceFreshnessInstruction('degraded-fallback', { timestamp: T_PUB, basis: 'publisher' })).toBe('');
    expect(buildLiveEvidenceFreshnessInstruction(undefined, { timestamp: T_PUB, basis: 'publisher' })).toBe('');
  });

  it('the pre-existing evidence-state instruction is UNCHANGED for live ("" as pinned before)', () => {
    expect(buildEvidenceStateInstruction('live', { timestamp: T_PUB, basis: 'publisher' })).toBe('');
  });

  it('retained evidence states its age ONCE (no duplicate freshness sentence)', () => {
    const { system } = messages({ evidenceState: 'retained', newest: { timestamp: T_PUB, basis: 'publisher' } });
    expect(system.match(/The newest report in this evidence set was published at/g)?.length).toBe(1);
  });

  it('inside a reporting window the authoritative window block still binds, and freshness is stated beside it', () => {
    const { system } = messages({
      evidenceState: 'live',
      newest: { timestamp: T_PUB, basis: 'publisher' },
      window: { statedPeriod: 'in the last 48 hours', from: '2026-10-11T10:00:00.000Z', to: '2026-10-13T10:00:00.000Z' },
    });
    expect(system).toContain('REPORTING WINDOW (authoritative)');
    expect(system).toContain('EVIDENCE FRESHNESS (authoritative)');
  });
});

describe('R7 X3 · truthful absence is a BASE rule (WP6 OFF)', () => {
  it('present in the prompt Alpha sends with WP6 OFF, for every evidence state', () => {
    for (const evidenceState of ['live', 'retained', 'degraded-fallback', undefined] as const) {
      const { system } = messages({ evidenceState, newest: { timestamp: T_PUB, basis: 'publisher' } });
      expect(system).toContain(TRUTHFUL_ABSENCE_RULE);
      expect(system).not.toContain('ANSWER PRESENTATION');
      expect(system).toMatch(/never state that an event did not happen because no report was found/i);
    }
  });

  it('names every absence cause: few, older than the period, incomplete, could not be used', () => {
    expect(TRUTHFUL_ABSENCE_RULE).toMatch(/Never state or imply that no developments occurred, that nothing changed, or that no reporting exists/);
    for (const cause of ['few', 'older than the period the reader asked about', 'incomplete', 'could not be used'])
      expect(TRUTHFUL_ABSENCE_RULE).toContain(cause);
  });

  it('WP6 ON (test only) keeps the base rule; WP6 adds its block after it', () => {
    const off = messages({ evidenceState: 'live', newest: { timestamp: T_PUB, basis: 'publisher' } });
    const on = messages({ evidenceState: 'live', newest: { timestamp: T_PUB, basis: 'publisher' }, wp6: true });
    expect(on.system).toContain(TRUTHFUL_ABSENCE_RULE);
    expect(on.system).toContain(WP6_PRESENTATION_RULES);
    expect(on.user).toBe(off.user);
  });

  /* The no-analysis states already carry their own anti-absence clause; X3 does not change them. */
  it.each([
    ['empty (completed no-match)', NO_CURRENT_FINDINGS_RULE, /Absence of reports is not evidence that conditions are normal/],
    ['partial / geo-held → sources unavailable', SOURCES_UNAVAILABLE_RULE, /Do not say that no reporting or no findings exist/],
    ['rights-held (F-1)', RIGHTS_WITHHELD_RULE, /Do not say that no reporting or no findings exist/],
  ])('%s: the existing rule already forbids an absence conclusion', (_label, rule, re) => {
    expect(rule).toMatch(re);
  });
});
