import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import type { AskR2Payload, AskResearchRecord } from '@/lib/api/askV2Api';
import { searchActivityOf } from '@/lib/ask/askSearchActivity';
import { askProgressStrings, ASK_PROGRESS_LOCALES } from '@/lib/ask/askProgressStrings';
import { AskSearchActivity } from './AskProgressPanel';

/*
  ASK R3 RESEARCH ACTIVITY R1 — PO acceptance failure (Alpha 0717ff7, operation 7c7b9ecb…):
  "I couldn't verify relevant reporting" with no Search activity, live or reopened. The record is
  now derived from what the backend RECORDED about the search, never from whether an analysis
  exists, and is the same on reopen. A check only where a stage completed.
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
const payload = (over: Partial<AskR2Payload>): AskR2Payload =>
  ({ schema: 'ask-r2-result/1', answer: { state: 'INSUFFICIENT', basis: 'NO_REQUIRED_EVIDENCE_OBTAINED', missingRoles: ['REPORTING'] }, analysis: null, ...over }) as AskR2Payload;
const steps = (p: AskR2Payload) => searchActivityOf(p)?.steps.map((s) => [s.kind, s.status, s.found ?? null]) ?? null;

describe('searchActivityOf — four states from the stored record, never from `analysis`', () => {
  it('insufficient evidence after a real search (the PO case): ✓ searched, nothing found — even with analysis null', () => {
    const p = payload({ research: record({ outcome: 'COMPLETED_NO_MATCH' }) });
    expect(steps(p)).toEqual([['SEARCH', 'completed', 'NO_MATCH'], ['ANSWER', 'completed', null]]);
  });
  it('zero relevant articles among candidates: ✓ searched, none matched closely enough', () => {
    expect(steps(payload({ research: record({ outcome: 'ALL_FILTERED' }) }))![0]).toEqual(['SEARCH', 'completed', 'FILTERED']);
  });
  it('evidence found: ✓ searched', () => {
    expect(steps(payload({ research: record({ outcome: 'MATCHED' }) }))![0]).toEqual(['SEARCH', 'completed', 'EVIDENCE']);
  });
  it('some sources unreachable: ! partly completed, never a check, naming the lane', () => {
    const a = searchActivityOf(payload({ research: record({ outcome: 'PARTIAL_NO_MATCH', lanes: { attempted: ['gnews', 'gdelt-doc'], succeeded: ['gnews'], unavailable: [{ lane: 'gdelt-doc', reason: 'timeout' }] } }) }))!;
    expect(a.steps[0]).toMatchObject({ status: 'partial', found: 'NO_MATCH', unreached: ['gdelt-doc'] });
  });
  it('provider outage: × not completed, never a check', () => {
    const a = searchActivityOf(payload({ research: record({ outcome: 'PROVIDER_FAILED', lanes: { attempted: ['gnews'], succeeded: [], unavailable: [{ lane: 'gnews', reason: 'unavailable' }] } }) }))!;
    expect(a.steps[0]).toMatchObject({ kind: 'SEARCH', status: 'failed' });
    expect(a.steps.every((s) => s.kind === 'ANSWER' || s.status !== 'completed')).toBe(true);
  });
  it('background-only answer (no research performed): no record at all', () => {
    expect(searchActivityOf(payload({ research: record({ performed: false, outcome: null }), background: { text: 'x' } }))).toBeNull();
  });
  it('a follow-up that re-read earlier evidence: ✓ earlier sources reviewed, no new search', () => {
    expect(steps(payload({ research: record({ performed: false, outcome: null, reused: true }) }))).toEqual([['REUSED', 'completed', null], ['ANSWER', 'completed', null]]);
  });
  it('NEVER inferred from analysis: an analysis present with a "not performed" record shows nothing', () => {
    expect(searchActivityOf(payload({ research: record({ performed: false, outcome: null }), analysis: { retrievalContext: { providers: ['gnews'] }, articles: [] } as never }))).toBeNull();
  });
  it('answers stored before R1 (e.g. operation 7c7b9ecb…): the facts they DO carry', () => {
    const viaTrace = payload({ analysis: { articles: [], retrievalContext: { dataMode: 'live', providers: ['gnews'], retrievalTrace: { candidatesSeen: 0, lanesUnavailable: [] } } } as never });
    expect(searchActivityOf(viaTrace)).toMatchObject({ basis: 'LEGACY_TRACE' });
    expect(steps(viaTrace)![0]).toEqual(['SEARCH', 'completed', 'NO_MATCH']);
    const viaGuidance = payload({ analysis: null, background: { text: 'x' }, guidance: { kind: 'MIXED_REFERENCE_CURRENT', currentEvidenceNeeded: [], currentPart: 'NO_EVIDENCE' } as never });
    expect(searchActivityOf(viaGuidance)).toMatchObject({ basis: 'LEGACY_GUIDANCE' });
    const down = payload({ analysis: null, guidance: { kind: 'MIXED_REFERENCE_CURRENT', currentEvidenceNeeded: [], currentPart: 'UNAVAILABLE' } as never });
    expect(steps(down)![0]).toEqual(['SEARCH', 'failed', null]);
    expect(searchActivityOf(payload({ analysis: null, background: { text: 'x' } }))).toBeNull();
  });
});

describe('the record — collapsed, static, glyphs per R3 ProgressPanel', () => {
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
  it('opened: ✓ Sources searched + "No matching reports were found." then ✓ Answer ready', () => {
    const root = render(payload({ research: record({ outcome: 'COMPLETED_NO_MATCH' }) }));
    act(() => byAsk(root, 'search-activity')[0]!.props.onClick());
    expect(byAsk(root, 'search-step').map(textOf)).toEqual(['✓ Completed · Sources searchedNo matching reports were found.', '✓ Completed · Answer ready']);
  });
  it('partial: "! Partly completed · Some sources searched", naming the unreached lane', () => {
    const root = render(payload({ research: record({ outcome: 'PARTIAL', lanes: { attempted: ['gnews', 'gdelt-doc'], succeeded: ['gnews'], unavailable: [{ lane: 'gdelt-doc', reason: 'timeout' }] } }) }));
    act(() => byAsk(root, 'search-activity')[0]!.props.onClick());
    expect(textOf(byAsk(root, 'search-step')[0]!)).toBe('! Partly completed · Some sources searchedNot reached: GDELT.');
  });
  it('outage: "× Not completed · Could not finish searching sources"', () => {
    const root = render(payload({ research: record({ outcome: 'PROVIDER_FAILED', lanes: { attempted: ['gnews'], succeeded: [], unavailable: [{ lane: 'gnews', reason: 'unavailable' }] } }) }));
    act(() => byAsk(root, 'search-activity')[0]!.props.onClick());
    expect(textOf(byAsk(root, 'search-step')[0]!)).toBe('× Not completed · Could not finish searching sourcesNot reached: GNews.');
  });
  it('seven locales carry every new key', () => {
    const keys = Object.keys(askProgressStrings('en')).sort();
    for (const l of ASK_PROGRESS_LOCALES) expect(Object.keys(askProgressStrings(l)).sort()).toEqual(keys);
  });
});

describe('wiring — every stored answer, live or reopened; no session-only state', () => {
  const turn = read('AskR2TurnView.tsx');
  const frame = read('AskFrameScreen.tsx');
  it('the turn view renders the record from its own payload (so reopening shows it, unanimated)', () => {
    expect(turn).toMatch(/const activity = searchActivityOf\(payload\);/);
    const at = turn.indexOf('searchActivityOf(payload)');
    expect(at).toBeGreaterThan(turn.indexOf('data-ask="continuation"'));
    expect(at).toBeLessThan(turn.indexOf('data-ask="prior-incomplete"'));
  });
  it('the frame no longer decides it from a pending transition or from analysis', () => {
    expect(frame).not.toMatch(/searchCompletedKey|payload\.analysis != null/);
    expect(frame).toContain('<AskProgressRunning locale={interfaceLocale} label={r2s.working} />');
  });
  it('the record itself never animates', () => {
    const panel = read('AskProgressPanel.tsx');
    const record = panel.slice(panel.indexOf('export function AskSearchActivity'));
    expect(record).not.toMatch(/AskWorkingEmblem|aria-live|setTimeout|setInterval/);
  });
});
