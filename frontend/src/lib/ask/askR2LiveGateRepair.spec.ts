import { askR2Strings } from './askR2Strings';
import { failedTurnCopy } from './askR2View';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ASK R2 LIVE-GATE REPAIR — reader-facing semantics (P0-5 timeout, P0-4 incomplete earlier turn).
 */
describe('P0-5 · MODEL_TIMEOUT reads "couldn’t finish in time", never "unavailable"', () => {
  it.each(['en', 'pl'] as const)('%s', (locale) => {
    const s = askR2Strings(locale);
    expect(failedTurnCopy('MODEL_TIMEOUT', s)).toBe(s.timedOut);
    expect(failedTurnCopy('MODEL_TIMEOUT', s)).not.toBe(s.unavailable);
    /* the other classes keep their own truth */
    expect(failedTurnCopy('BUDGET_REFUSED:account-day', s)).toBe(s.budgetRefused);
    expect(failedTurnCopy('NETWORK', s)).toBe(s.r3.networkFailed);
    expect(failedTurnCopy('MODEL_FAILURE', s)).toBe(s.unavailable);
  });

  it('the timeout copy does not imply a disabled capability, an unavailable provider or a spent quota', () => {
    const en = askR2Strings('en').timedOut;
    expect(en).toMatch(/in time/);
    expect(en).toMatch(/try again/);
    expect(en).not.toMatch(/unavailable|disabled|limit|quota/i);
  });
});

describe('P0-4 · a follow-up after an earlier request that did not complete says so', () => {
  it('the turn view renders the incomplete line for priorAnswer.outcome INCOMPLETE', () => {
    const view = readFileSync(join(__dirname, '..', '..', 'components', 'ask-frame', 'AskR2TurnView.tsx'), 'utf8');
    expect(view).toMatch(/payload\.priorAnswer\?\.outcome === 'INCOMPLETE'[\s\S]{0,200}s\.r4\.priorIncomplete/);
    expect(askR2Strings('en').r4.priorIncomplete).toMatch(/did not complete/);
  });
});
