import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AskR2TurnView } from './AskR2TurnView';
import { askProgressStrings, ASK_PROGRESS_LOCALES } from '@/lib/ask/askProgressStrings';

/*
  E1 §8.2 step 3 — an earlier answer withheld at read time (its sources' reuse rights are not
  cleared) tells the reader so. It never claims there was no relevant reporting.
*/
const WITHHELD = {
  schema: 'ask-r2-result/1',
  route: { questionClass: 'CURRENT_REPORTING', terminalState: 'EXECUTABLE' },
  answer: { state: 'INSUFFICIENT', basis: 'WITHHELD_SOURCE_RIGHTS', missingRoles: [] },
  analysis: null,
  background: null,
  chips: { kind: 'NONE' },
  withheld: { reason: 'SOURCE_RIGHTS', count: 2 },
};

const render = (payload: unknown) =>
  renderToStaticMarkup(
    createElement(AskR2TurnView as never, {
      turn: { question: 'Give any recent reports about Eric Prince in DRC.', payload },
      locale: 'en',
      context: undefined,
    } as never),
  );

describe('withheld earlier answer', () => {
  it('shows the withheld line and never "couldn’t verify relevant reporting"', () => {
    const html = render(WITHHELD);
    expect(html).toContain('data-ask="withheld-source-rights"');
    expect(html).toContain('This earlier answer is withheld while the rights to reuse its sources are reviewed.');
    expect(html).not.toContain('data-ask="insufficient-title"');
  });

  it('an ordinary insufficient answer is unchanged', () => {
    const { withheld: _w, ...plain } = WITHHELD;
    void _w;
    const html = render({ ...plain, answer: { state: 'INSUFFICIENT', basis: 'NO_REQUIRED_EVIDENCE_OBTAINED', missingRoles: ['REPORTING'] } });
    expect(html).toContain('data-ask="insufficient-title"');
    expect(html).not.toContain('data-ask="withheld-source-rights"');
  });

  it.each(ASK_PROGRESS_LOCALES)('%s carries a withheld-answer line', (locale) => {
    expect(askProgressStrings(locale).withheldAnswer.length).toBeGreaterThan(20);
  });
});
