import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { congoClarificationOf } from '@/lib/ask/askCongoClarification';
import { AskR2TurnView } from './AskR2TurnView';

/*
  MASTER CTO R47 / #95 · D04–D06 — the Product Owner's Alpha question named Kigali, "right now" and a
  bare "Congo", and got the generic "Add one specific place, topic or period". Offline fixture of the
  two server outcomes measured on Alpha 059cdb7 (codes only): NO_PRIOR_SUBJECT with no candidates
  (2026-10-13 12:27Z) and LANDED_AMBIGUOUS_COUNTRY with [COD, COG] (10-13 08:10Z).
*/
const PO_QUESTION = 'What is happening in Kigali right now, and how is it affecting neighboring Congo?';
const clar = (basis: string, candidates: string[]) => ({
  schema: 'ask-r2-result/1',
  route: { questionClass: 'CURRENT_REPORTING', terminalState: 'EXECUTABLE', clarification: [], disclosures: [] },
  answer: { state: 'CLARIFICATION_REQUIRED', basis, missingRoles: [], candidates },
  analysis: null,
  background: null,
  chips: { kind: 'NONE' },
});
const byAsk = (r: ReactTestRenderer, id: string) => r.root.findAll((n) => n.props['data-ask'] === id && typeof n.type === 'string');
const textOf = (node: ReactTestInstance): string => node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');

function render(question: string, payload: unknown, onUseQuestion = jest.fn()) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      createElement(AskR2TurnView as never, { turn: { question, payload }, locale: 'en', context: undefined, onUseQuestion } as never),
    );
  });
  return { r, onUseQuestion };
}

let fetchSpy: jest.SpyInstance;
beforeEach(() => {
  fetchSpy = jest.spyOn(globalThis, 'fetch' as never).mockImplementation((() => {
    throw new Error('no network expected');
  }) as never);
});
afterEach(() => fetchSpy.mockRestore());

describe('R47 · "Which Congo?" instead of "add a place" — the PO Kigali/Congo question', () => {
  it.each([
    ['live defect: NO_PRIOR_SUBJECT, no candidates', clar('NO_PRIOR_SUBJECT', [])],
    ['server ambiguity: LANDED_AMBIGUOUS_COUNTRY [COD, COG]', clar('LANDED_AMBIGUOUS_COUNTRY', ['COD', 'COG'])],
  ])('%s → one specific question; both drafts keep Kigali and "right now"; nothing is sent', (_label, payload) => {
    const { r, onUseQuestion } = render(PO_QUESTION, payload);
    const card = byAsk(r, 'clarification')[0];
    const text = textOf(card);
    expect(text).toContain('Which Congo do you mean? The rest of your question stays as you wrote it.');
    expect(text).not.toContain('Add one specific place, topic or period');
    const buttons = byAsk(r, 'clarification-choice');
    expect(buttons.map(textOf)).toEqual(['Democratic Republic of the Congo (Kinshasa)', 'Republic of the Congo (Brazzaville)']);
    act(() => buttons[0].props.onClick());
    act(() => buttons[1].props.onClick());
    expect(onUseQuestion.mock.calls).toEqual([
      ['What is happening in Kigali right now, and how is it affecting neighboring Democratic Republic of the Congo?'],
      ['What is happening in Kigali right now, and how is it affecting neighboring Republic of the Congo?'],
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a question that already says which Congo is never re-asked (no silent change either way)', () => {
    for (const q of ['What is happening in DR Congo right now?', 'Latest news from Brazzaville, Congo', 'Kinshasa and Congo today']) {
      expect(congoClarificationOf(q, 'en')).toBeNull();
    }
    const { r } = render('What is happening in DR Congo right now?', clar('NO_PRIOR_SUBJECT', []));
    expect(textOf(byAsk(r, 'clarification')[0])).toContain('Add one specific place, topic or period');
  });

  it('a question with no Congo keeps the existing clarification', () => {
    expect(congoClarificationOf('What about it?', 'en')).toBeNull();
    const { r } = render('What about it?', clar('NO_PRIOR_SUBJECT', []));
    expect(byAsk(r, 'clarification-choice')).toHaveLength(0);
  });

  it('only the word Congo is replaced, at its own position, in the reader\'s language', () => {
    const fr = congoClarificationOf('Que se passe-t-il au Congo maintenant ?', 'fr')!;
    expect(fr.choices.map((c) => c.question)).toEqual([
      'Que se passe-t-il au République démocratique du Congo maintenant ?',
      'Que se passe-t-il au République du Congo maintenant ?',
    ]);
    expect(congoClarificationOf('congo', 'en')!.choices.map((c) => c.iso3)).toEqual(['COD', 'COG']);
  });
});

describe('R47 · reopened failed requests and honest updates copy (D13/D15)', () => {
  it('a reopened failed / timed-out request keeps its recorded failure and says when it was made', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        createElement(AskR2TurnView as never, {
          turn: { question: 'Fuel prices in Kigali?', payload: null, failure: 'EXECUTION_TIMEOUT' },
          locale: 'en',
          context: undefined,
          reopenedAt: '2026-10-12T09:30:00Z',
        } as never),
      );
    });
    expect(textOf(byAsk(r, 'reopened-line')[0])).toMatch(/^Request from .+\. Nothing new was run\.$/);
    expect(byAsk(r, 'unavailable')).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it('the reopened operation carries its own failureCode into the turn (as earlier turns already do)', () => {
    const { readFileSync } = jest.requireActual('fs') as typeof import('fs');
    const { join } = jest.requireActual('path') as typeof import('path');
    const frame = readFileSync(join(__dirname, 'AskFrameScreen.tsx'), 'utf8');
    expect(frame).toContain('...(read.value.failureCode ? { failure: read.value.failureCode } : {}),');
  });
  it('Settings names the real action and never implies automatic checking', () => {
    const { askSettingsR2Strings } = jest.requireActual('@/lib/ask/askSettingsR2Strings') as typeof import('@/lib/ask/askSettingsR2Strings');
    expect(askSettingsR2Strings('en').updatesNote).toBe(
      'Nothing is checked automatically. A followed question is asked again only when you choose “Ask again”. There are no notifications.',
    );
  });
});
