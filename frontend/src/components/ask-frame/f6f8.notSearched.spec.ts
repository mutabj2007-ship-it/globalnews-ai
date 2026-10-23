import { createElement } from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import type { AskR2Payload, AskResearchRecord } from '@/lib/api/askV2Api';
import { searchActivityOf } from '@/lib/ask/askSearchActivity';
import { askProgressStrings, ASK_PROGRESS_LOCALES } from '@/lib/ask/askProgressStrings';
import { AskSearchActivity } from './AskProgressPanel';

/*
  F6–F8 (E1 R96 R-6, EA fixture C) — what the reader SEES for a search that was refused because no
  source is cleared for the use: one plain "not searched" sentence. Never a check, never "failed" /
  "Could not finish", never "Search attempted", never the word "unavailable"; a genuine outage keeps
  "Could not finish searching sources" (R-8 control).
*/
const textOf = (node: ReactTestInstance): string =>
  node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const byAsk = (root: ReactTestInstance, id: string) =>
  root.findAll((n) => typeof n.type === 'string' && n.props['data-ask'] === id);

const REFUSED = ['gnews', 'gdelt-doc', 'rss-feeds'].map((lane) => ({ lane, reason: 'rights-not-cleared' }));
const payload = (research: Partial<AskResearchRecord>): AskR2Payload =>
  ({
    schema: 'ask-r2-result/1',
    route: { terminalState: 'EXECUTABLE' },
    analysis: null,
    answer: { state: 'INSUFFICIENT', basis: 'NO_REQUIRED_EVIDENCE_OBTAINED', missingRoles: ['REPORTING'] },
    research: { schema: 'ask-research/1', performed: true, reused: false, outcome: 'NOT_PERMITTED',
      lanes: { attempted: [], succeeded: [], unavailable: REFUSED }, ...research },
  }) as unknown as AskR2Payload;

const linesFor = (locale: string, p: AskR2Payload): string[] => {
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(createElement(AskSearchActivity, { locale: locale as never, activity: searchActivityOf(p)!, laneLabel: (l: string) => l }));
  });
  act(() => byAsk(r.root, 'search-activity')[0]!.props.onClick());
  return byAsk(r.root, 'search-step').map(textOf);
};

describe('F6–F8 — a refused search reads "not searched" in every locale', () => {
  it.each(ASK_PROGRESS_LOCALES)('%s: NOT_PERMITTED → the not-searched sentence; no check, no failure, no attempt, no unreached list', (locale) => {
    const s = askProgressStrings(locale);
    const [search] = linesFor(locale, payload({}));
    expect(search).toBe(`– ${s.searchNotPermitted}`);
    for (const forbidden of [s.couldNotFinish, s.searchAttemptedUnknown, s.notCompleted, s.outcomeUnavailable]) {
      expect(search).not.toContain(forbidden);
    }
    expect(search).not.toMatch(/✓|×|unavailable|rights-not-cleared|gnews|gdelt/i);
  });

  it('R-8 control: a genuine outage still reads "Could not finish searching sources"', () => {
    const s = askProgressStrings('en');
    const [search] = linesFor('en', payload({ outcome: 'PROVIDER_FAILED', lanes: { attempted: ['gnews'], succeeded: [], unavailable: [{ lane: 'gnews', reason: 'rate-limited' }] } }));
    expect(search).toContain(s.couldNotFinish);
  });
});
