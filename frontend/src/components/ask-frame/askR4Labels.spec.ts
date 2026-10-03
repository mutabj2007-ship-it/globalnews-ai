import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { askR2Strings } from '@/lib/ask/askR2Strings';

/**
 * CTO R4 — a zero-source conceptual answer is labelled "Conceptual analysis · model reasoning"
 * (and work on the conversation — a plan, a table — as conversation work), in EN and PL. It is
 * never worded as a failure, an insufficiency or a sourced current fact.
 */
const view = readFileSync(join(__dirname, 'AskR2TurnView.tsx'), 'utf8');

describe('R4 labels', () => {
  it('EN / PL titles', () => {
    expect(askR2Strings('en').r4.conceptualNoteTitle).toBe('Conceptual analysis · model reasoning');
    expect(askR2Strings('pl').r4.conceptualNoteTitle).toBe('Analiza koncepcyjna · rozumowanie modelu');
    expect(askR2Strings('en').r4.workNoteTitle).toBe('Conversation work · model reasoning');
    expect(askR2Strings('pl').r4.workNoteTitle).toBe('Praca w rozmowie · rozumowanie modelu');
  });

  it.each(['en', 'pl'] as const)('%s copy never reads as a failure or as sourced current fact', (lang) => {
    const r4 = askR2Strings(lang).r4;
    for (const text of [r4.conceptualNoteTitle, r4.conceptualNoteBody, r4.workNoteTitle, r4.workNoteBody])
      expect(text).not.toMatch(/insufficient|unavailable|failed|niewystarczaj|niedostępn|nie udało/i);
  });

  it('the turn view selects the R4 note for both guidance kinds (title and body)', () => {
    expect(view).toMatch(/guidanceKind === 'CONCEPTUAL_ANALYSIS'\s*\?\s*s\.r4\.conceptualNoteTitle/);
    expect(view).toMatch(/guidanceKind === 'CONVERSATION_WORK'\s*\?\s*s\.r4\.workNoteTitle/);
    expect(view).toMatch(/guidanceKind === 'CONCEPTUAL_ANALYSIS'\s*\?\s*s\.r4\.conceptualNoteBody/);
    expect(view).toMatch(/guidanceKind === 'CONVERSATION_WORK'\s*\?\s*s\.r4\.workNoteBody/);
  });
});
