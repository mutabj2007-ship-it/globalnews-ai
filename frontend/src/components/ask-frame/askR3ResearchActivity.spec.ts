import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import type { AskR2Payload, AskResearchRecord } from '@/lib/api/askV2Api';
import { answerStep, searchActivityOf } from '@/lib/ask/askSearchActivity';
import { askProgressStrings, ASK_PROGRESS_LOCALES } from '@/lib/ask/askProgressStrings';
import { AskSearchActivity } from './AskProgressPanel';

/*
  ASK R3 RESEARCH ACTIVITY R1.1 — PO acceptance failure (Alpha 0717ff7, operation 7c7b9ecb…) and the
  CTO diagnosis review. The record claims only what persisted evidence establishes; a completed
  request is not a verified answer; reopening is read-only and unanimated.
*/
const read = (...p: string[]) => readFileSync(join(__dirname, ...p), 'utf8');
const textOf = (node: ReactTestInstance): string =>
  node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const byAsk = (root: ReactTestInstance, id: string) =>
  root.findAll((n) => typeof n.type === 'string' && n.props['data-ask'] === id);

const record = (over: Partial<AskResearchRecord>): AskResearchRecord => ({
  schema: 'ask-research/1',
  performed: true,
  outcome: 'MATCHED',
  reused: false,
  lanes: { attempted: ['gnews', 'rss-feeds'], succeeded: ['gnews', 'rss-feeds'], unavailable: [] },
  candidatesSeen: 0,
  candidatesAdmitted: 0,
  ...over,
});
const payload = (over: Partial<AskR2Payload> & { answer?: Partial<AskR2Payload['answer']> }): AskR2Payload =>
  ({
    schema: 'ask-r2-result/1',
    route: { terminalState: 'EXECUTABLE' },
    analysis: null,
    ...over,
    answer: { state: 'INSUFFICIENT', basis: 'NO_REQUIRED_EVIDENCE_OBTAINED', missingRoles: ['REPORTING'], ...(over.answer ?? {}) },
  }) as AskR2Payload;
const steps = (p: AskR2Payload) => searchActivityOf(p)?.steps.map((s) => [s.kind, s.status, s.found ?? s.answer ?? null]) ?? null;

/* THE OBSERVED 7c7b9ecb… COMBINATION (CTO diagnosis): providerCalls=2, modelCalls=1, retrievalOutcome NULL,
   seen/admitted NULL, reportingItems 0, analysis null, trace NULL, answer INSUFFICIENT / NO_ANSWER_PRODUCED;
   stored before R1, so the payload has no `research` field */
const OBSERVED_7C7B9ECB = payload({ answer: { state: 'INSUFFICIENT', basis: 'NO_ANSWER_PRODUCED', missingRoles: ['REPORTING'] } });

describe('the observed 7c7b9ecb… record — nothing claimed beyond the persisted evidence', () => {
  it('search attempted, detailed outcome unavailable; no answer produced', () => {
    expect(steps(OBSERVED_7C7B9ECB)).toEqual([['SEARCH', 'unknown', null], ['ANSWER', 'failed', 'NOT_PRODUCED']]);
    expect(searchActivityOf(OBSERVED_7C7B9ECB)!.basis).toBe('LEGACY_ATTEMPTED');
  });
  it('renders exactly "Search attempted; detailed retrieval outcome unavailable." — never "no matching reports", never a check', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(createElement(AskSearchActivity, { locale: 'en', activity: searchActivityOf(OBSERVED_7C7B9ECB)!, laneLabel: (l: string) => l }));
    });
    act(() => byAsk(r.root, 'search-activity')[0]!.props.onClick());
    const lines = byAsk(r.root, 'search-step').map(textOf);
    expect(lines).toEqual(['– Search attempted; detailed retrieval outcome unavailable.', '× Not completed · No answer was produced']);
    expect(lines.join(' ')).not.toMatch(/✓|No matching|Sources searched|Answer ready/);
  });
});

describe('new records (backend research-record, captured at the retrieval call)', () => {
  it('documented success: ✓ sources searched, ✓ answer ready (sourced)', () => {
    expect(steps(payload({ research: record({ outcome: 'MATCHED' }), answer: { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles: [] } }))).toEqual([
      ['SEARCH', 'completed', 'EVIDENCE'],
      ['ANSWER', 'completed', 'SOURCED'],
    ]);
  });
  it('documented no-match: ✓ sources searched (nothing found); the request completed WITHOUT a verified answer', () => {
    expect(steps(payload({ research: record({ outcome: 'COMPLETED_NO_MATCH' }) }))).toEqual([
      ['SEARCH', 'completed', 'NO_MATCH'],
      ['ANSWER', 'completed', 'COMPLETED_UNVERIFIED'],
    ]);
    expect(steps(payload({ research: record({ outcome: 'ALL_FILTERED' }) }))![0]).toEqual(['SEARCH', 'completed', 'FILTERED']);
  });
  it('documented failure: × could not finish searching; never a check on the search', () => {
    const a = searchActivityOf(payload({ research: record({ outcome: 'PROVIDER_FAILED', lanes: { attempted: ['gnews'], succeeded: [], unavailable: [{ lane: 'gnews', reason: 'unavailable' }] } }) }))!;
    expect(a.steps[0]).toMatchObject({ kind: 'SEARCH', status: 'failed', unreached: ['gnews'] });
  });
  it('partial: ! some sources searched, naming the lane', () => {
    const a = searchActivityOf(payload({ research: record({ outcome: 'PARTIAL_NO_MATCH', lanes: { attempted: ['gnews', 'gdelt-doc'], succeeded: ['gnews'], unavailable: [{ lane: 'gdelt-doc', reason: 'timeout' }] } }) }))!;
    expect(a.steps[0]).toMatchObject({ status: 'partial', unreached: ['gdelt-doc'] });
  });
  it('a call made without a typed outcome: attempted / unknown', () => {
    expect(steps(payload({ research: record({ outcome: 'OUTCOME_UNAVAILABLE' }) }))![0]).toEqual(['SEARCH', 'unknown', null]);
  });
  it('reused evidence: ✓ earlier sources reviewed', () => {
    expect(steps(payload({ research: record({ performed: false, outcome: null, reused: true }) }))![0]).toEqual(['REUSED', 'completed', null]);
  });
  it('background only (no research performed): no record', () => {
    expect(searchActivityOf(payload({ research: record({ performed: false, outcome: null }), background: { text: 'x' } }))).toBeNull();
  });
  it('NEVER inferred from analysis: a "not performed" record with an analysis shows nothing', () => {
    expect(searchActivityOf(payload({ research: record({ performed: false, outcome: null }), analysis: { retrievalContext: { providers: ['gnews'] }, articles: [] } as never }))).toBeNull();
  });
});

describe('a completed request is not a verified answer', () => {
  it.each([
    ['CURRENT_REPORTING', 'REQUIRED_EVIDENCE_OBTAINED', 'completed', 'SOURCED'],
    ['CURRENTLY_VERIFIED', 'OFFICIAL_CURRENT_EVIDENCE', 'completed', 'SOURCED'],
    ['RETAINED_REPORTING', 'RETAINED_REPORTING_ONLY', 'completed', 'SOURCED'],
    ['PARTIAL', 'SOME_REQUIRED_EVIDENCE_MISSING', 'partial', 'PARTLY_SOURCED'],
    ['REFERENCE_BACKGROUND', 'PARTIAL_CURRENT_NO_EVIDENCE', 'completed', 'COMPLETED_UNVERIFIED'],
    ['INSUFFICIENT', 'NO_REQUIRED_EVIDENCE_OBTAINED', 'completed', 'COMPLETED_UNVERIFIED'],
    ['INSUFFICIENT', 'NO_ANSWER_PRODUCED', 'failed', 'NOT_PRODUCED'],
    ['CAPABILITY_UNAVAILABLE', 'REFERENCE_UNAVAILABLE', 'failed', 'NOT_PRODUCED'],
  ] as const)('%s / %s → %s %s', (state, basis, status, answer) => {
    expect(answerStep(payload({ answer: { state, basis, missingRoles: [] } }))).toMatchObject({ status, answer });
  });
});

describe('answers stored before R1 — only facts the payload proves', () => {
  it('a stored retrieval TRACE is classified by the same rules', () => {
    const p = payload({ analysis: { articles: [], retrievalContext: { dataMode: 'live', providers: ['gnews'], retrievalTrace: { candidatesSeen: 0, lanesUnavailable: [] } } } as never });
    expect(searchActivityOf(p)!.basis).toBe('LEGACY_TRACE');
    expect(steps(p)![0]).toEqual(['SEARCH', 'completed', 'NO_MATCH']);
  });
  it('a retrieval context WITHOUT a trace: attempted / unknown, never "no match"', () => {
    expect(steps(payload({ analysis: { articles: [], retrievalContext: { providers: ['gnews'] } } as never }))![0]).toEqual(['SEARCH', 'unknown', null]);
  });
  it('guidance NO_EVIDENCE (set only after a retrieval): attempted / unknown', () => {
    expect(steps(payload({ guidance: { kind: 'MIXED_REFERENCE_CURRENT', currentEvidenceNeeded: [], currentPart: 'NO_EVIDENCE' } as never }))![0]).toEqual(['SEARCH', 'unknown', null]);
  });
  it('guidance UNAVAILABLE on an EXECUTABLE plan: attempted / unknown — never "could not finish searching"', () => {
    expect(steps(payload({ guidance: { kind: 'MIXED_REFERENCE_CURRENT', currentEvidenceNeeded: [], currentPart: 'UNAVAILABLE' } as never }))![0]).toEqual(['SEARCH', 'unknown', null]);
  });
  it('guidance UNAVAILABLE on a NON-executable plan (untransportable current part: no retrieval ran): no record', () => {
    const p = payload({ route: { terminalState: 'BROADENING_OFFERED' } as never, guidance: { kind: 'MIXED_REFERENCE_CURRENT', currentEvidenceNeeded: [], currentPart: 'UNAVAILABLE' } as never, background: { text: 'x' }, answer: { state: 'REFERENCE_BACKGROUND', basis: 'PARTIAL_CURRENT_UNAVAILABLE', missingRoles: ['REPORTING'] } });
    expect(searchActivityOf(p)).toBeNull();
  });
  it('a background answer with nothing implying retrieval: no record', () => {
    expect(searchActivityOf(payload({ background: { text: 'x' }, answer: { state: 'REFERENCE_BACKGROUND', basis: 'PLAN_NO_REQUIRED_EVIDENCE', missingRoles: [] } }))).toBeNull();
  });
});

describe('rendering — collapsed, static, glyphs per R3 ProgressPanel', () => {
  const render = (p: AskR2Payload) => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(createElement(AskSearchActivity, { locale: 'en', activity: searchActivityOf(p)!, laneLabel: (l: string) => ({ gnews: 'GNews', 'gdelt-doc': 'GDELT' })[l] ?? l }));
    });
    return r.root;
  };
  it('closed by default, "Search activity · 2 steps", static emblem, no live announcement', () => {
    const root = render(payload({ research: record({ outcome: 'COMPLETED_NO_MATCH' }) }));
    const b = byAsk(root, 'search-activity')[0]!;
    expect(b.props['aria-expanded']).toBe(false);
    expect(textOf(b)).toBe('Search activity · 2 stepsShow');
    expect(byAsk(root, 'static-emblem')).toHaveLength(1);
    expect(root.findAll((n) => n.props['aria-live'] !== undefined)).toHaveLength(0);
  });
  it('no-match: the request completed, with no verified answer said plainly', () => {
    const root = render(payload({ research: record({ outcome: 'COMPLETED_NO_MATCH' }) }));
    act(() => byAsk(root, 'search-activity')[0]!.props.onClick());
    expect(byAsk(root, 'search-step').map(textOf)).toEqual([
      '✓ Completed · Sources searchedNo matching reports were found.',
      '✓ Completed · Request completedNo verified answer from current reporting.',
    ]);
  });
  it('outage: "× Not completed · Could not finish searching sources"', () => {
    const root = render(payload({ research: record({ outcome: 'PROVIDER_FAILED', lanes: { attempted: ['gnews'], succeeded: [], unavailable: [{ lane: 'gnews', reason: 'unavailable' }] } }) }));
    act(() => byAsk(root, 'search-activity')[0]!.props.onClick());
    expect(textOf(byAsk(root, 'search-step')[0]!)).toBe('× Not completed · Could not finish searching sourcesNot reached: GNews.');
  });
  it('seven locales carry every key', () => {
    const keys = Object.keys(askProgressStrings('en')).sort();
    for (const l of ASK_PROGRESS_LOCALES) expect(Object.keys(askProgressStrings(l)).sort()).toEqual(keys);
  });
});

describe('wiring — every stored answer, live or reopened; read-only; no session state', () => {
  const turn = read('AskR2TurnView.tsx');
  const frame = read('AskFrameScreen.tsx');
  it('the turn view renders the record from its own payload (reopening shows it, unanimated)', () => {
    expect(turn).toMatch(/const activity = searchActivityOf\(payload\);/);
    const at = turn.indexOf('searchActivityOf(payload)');
    expect(at).toBeGreaterThan(turn.indexOf('data-ask="continuation"'));
    expect(at).toBeLessThan(turn.indexOf('data-ask="prior-incomplete"'));
  });
  it('the frame no longer decides it from a pending transition or from analysis', () => {
    expect(frame).not.toMatch(/searchCompletedKey|payload\.analysis != null/);
    expect(frame).toContain('<AskProgressRunning locale={interfaceLocale} label={r2s.working} />');
  });
  it('the record itself never animates and makes no request', () => {
    const panel = read('AskProgressPanel.tsx');
    const rec = panel.slice(panel.indexOf('export function AskSearchActivity'));
    expect(rec).not.toMatch(/AskWorkingEmblem|aria-live|setTimeout|setInterval|fetch\(/);
    expect(read('..', '..', 'lib', 'ask', 'askSearchActivity.ts')).not.toMatch(/fetch\(|askV2Api\./);
  });
});

/* MASTER CTO P0 RIGHTS CONTAINMENT R1 — withheld for rights is never told as "no matching reports" */
describe('rights-withheld research record', () => {
  const WITHHELD = payload({ research: record({ outcome: 'COMPLETED_NO_MATCH', rightsWithheld: 3 } as never) });
  it('the search step drops "no match" and carries the withheld count', () => {
    const step = searchActivityOf(WITHHELD)!.steps[0];
    expect(step.found).toBeUndefined();
    expect(step.rightsWithheld).toBe(3);
  });
  it('renders the rights line and never "No matching reports were found."', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(createElement(AskSearchActivity, { locale: 'en', activity: searchActivityOf(WITHHELD)!, laneLabel: (l: string) => l }));
    });
    act(() => byAsk(r.root, 'search-activity')[0]!.props.onClick());
    const text = byAsk(r.root, 'search-step').map(textOf).join(' ');
    expect(text).toContain('3 items found were not used because the source’s reuse rights are not cleared.');
    expect(text).not.toContain('No matching reports were found.');
  });
  it.each(ASK_PROGRESS_LOCALES)('%s carries a rights-withheld line naming the count', (locale) => {
    expect(askProgressStrings(locale).rightsWithheld(2)).toContain('2');
  });
});
