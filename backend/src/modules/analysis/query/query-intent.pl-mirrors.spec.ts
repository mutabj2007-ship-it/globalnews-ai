import { classifyQueryIntent } from './query-intent.util';
import { detectSourceAttributedIntent } from './derive-source-attributed-query.util';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE C — the landed classifiers' measured gaps.
 *
 * Each Polish frame added to `classifyQueryIntent` mirrors an English pattern already in
 * the same array, and each case below is the EN/PL twin that exposed the gap on L's
 * 49-pair corpus through frozen C. The English side is asserted too, so the pair — not
 * the Polish half — is what passes.
 */
describe('classifyQueryIntent — Polish mirrors of existing English frames', () => {
  it.each([
    ['How does a vaccine work?', 'Jak działa szczepionka?', 'EXPLANATION'],
    ['How does a suspension bridge work?', 'Jak działa most wiszący?', 'EXPLANATION'],
    [
      'How does public key encryption work?',
      'Jak działa szyfrowanie klucza publicznego?',
      'EXPLANATION',
    ],
    ['How does an induction motor work?', 'Jak działa silnik indukcyjny?', 'EXPLANATION'],
    ['What is the square root of 144?', 'Ile wynosi pierwiastek kwadratowy z 144?', 'EXPLANATION'],
    ['What is 15 percent of 240?', 'Ile to jest 15 procent z 240?', 'EXPLANATION'],
    ['What is the inflation rate?', 'Jaka jest stopa inflacji?', 'EXPLANATION'],
    ['Who is the president?', 'Kto jest prezydentem?', 'ENTITY_BACKGROUND'],
    ['Tell me more about that.', 'Powiedz mi o tym więcej.', 'ENTITY_BACKGROUND'],
  ])('%s  ≡  %s  → %s', (en, pl, intent) => {
    expect(classifyQueryIntent(en, {}).intent).toBe(intent);
    expect(classifyQueryIntent(pl, {}).intent).toBe(intent);
  });

  it.each([
    /* a current-event marker still outranks the new explanation frames, as in English */
    ['What is the security situation?', 'Jaka jest sytuacja bezpieczeństwa?'],
    ['What is the latest inflation figure?', 'Jaki jest najnowszy wskaźnik inflacji?'],
    [
      'What is the situation on the border right now?',
      'Jaka jest sytuacja na granicy w tej chwili?',
    ],
  ])('%s  ≡  %s  → still CURRENT_EVENT', (en, pl) => {
    expect(classifyQueryIntent(en, {}).intent).toBe('CURRENT_EVENT');
    expect(classifyQueryIntent(pl, {}).intent).toBe('CURRENT_EVENT');
  });

  it('"Ile okręgów zgłosiło wyniki?" (how many districts reported) is not a "what is" frame', () => {
    expect(classifyQueryIntent('Ile okręgów zgłosiło wyniki?', {}).intent).toBe('CURRENT_EVENT');
  });

  it('a comparison still wins over "kto jest": "Kto jest bardziej wpływowy?" asks for members', () => {
    expect(classifyQueryIntent('Kto jest bardziej wpływowy?', {}).intent).toBe(
      'CLARIFICATION_REQUIRED',
    );
  });
});

describe('detectSourceAttributedIntent — a passive names no source', () => {
  it.each([
    'What has not been reported about the audit?',
    'What has been reported about the audit?',
    'What have never been said about the election?',
  ])('%s → no source frame', (q) => {
    expect(detectSourceAttributedIntent(q)).toBeUndefined();
  });

  it('an active masthead is still read: "What has KT Press reported about the budget?"', () => {
    expect(
      detectSourceAttributedIntent('What has KT Press reported about the budget?')?.query,
    ).toEqual({
      sourcePhrase: 'KT Press',
      topic: 'budget',
    });
  });
});
