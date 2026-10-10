import { readFileSync } from 'fs';
import { join } from 'path';
import { askPublisherStrings, ASK_PUBLISHER_LOCALES } from '@/lib/ask/askPublisherStrings';

/*
  P0 SOURCE-BACKED NEWS ANSWERS R1 — what the reader is told when they named a publisher (Claude G
  verdict) or wrote a reviewed spelling variant (P3). Recognition is not authorization and not
  retrieval: "not carried" says it was NOT searched; "Ask again without …" is a DRAFT, never a send.
*/
const view = readFileSync(join(__dirname, 'AskR2TurnView.tsx'), 'utf8');

describe('publisher verdict + spelling strings, 7 locales', () => {
  it.each(ASK_PUBLISHER_LOCALES)('%s: every line carries the names it is given', (locale) => {
    const s = askPublisherStrings(locale);
    expect(s.notCarried('Reuters')).toContain('Reuters');
    expect(s.unrecognised('the gazette')).toContain('the gazette');
    expect(s.carriedOnly('BBC')).toContain('BBC');
    expect(s.askWithout('Reuters')).toContain('Reuters');
    expect(s.withoutDraft('Erik Prince in Congo')).toContain('Erik Prince in Congo');
    const spelled = s.searchedAs('Erik Prince', 'Eric Prince');
    expect(spelled).toContain('Erik Prince');
    expect(spelled).toContain('Eric Prince');
  });

  it('EN wording of record (CTO review)', () => {
    const en = askPublisherStrings('en');
    expect(en.notCarried('Reuters')).toBe(
      'Reuters is a publisher Ask recognises but does not carry, so its reporting wasn’t searched. Reporting from other publishers wasn’t used in its place.',
    );
    expect(en.searchedAs('Erik Prince', 'Eric Prince')).toBe('Searched as Erik Prince (you wrote Eric Prince).');
  });

  it('an unknown locale falls back to EN', () => {
    expect(askPublisherStrings('xx').askWithout('Reuters')).toBe('Ask again without Reuters');
  });
});

describe('AskR2TurnView wiring', () => {
  it('the verdict reads only the stored research record, and "Ask again without" only drafts', () => {
    expect(view).toContain('payload.research?.requestedPublisher');
    expect(view).toMatch(/data-ask="ask-without-publisher" onClick=\{\(\) => onUseQuestion\(ps\.withoutDraft\(/);
    /* the verdict precedes "Edit question" */
    expect(view.indexOf('data-ask="requested-publisher"')).toBeLessThan(view.indexOf('data-ask="edit-question"'));
  });

  it('the spelling disclosure reads only the stored research record and sits before the answer footer', () => {
    expect(view).toContain('payload.research?.entitySpellings');
    expect(view.indexOf('data-ask="entity-spelling"')).toBeLessThan(view.indexOf('data-ask="answer-footer"'));
  });
});
