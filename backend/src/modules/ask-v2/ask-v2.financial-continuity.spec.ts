import { anchorQuestionOf } from './ask-v2.service';
import {
  loanContinuationAnchor,
  loanRateComputation,
  loanScheduleChange,
  statedLoan,
} from './computation/cash-flow-rate';

/**
 * ASK FINANCIAL CONTINUITY P0 — the anchor the SERVICE hands the solver (Alpha op 0ec1717c).
 *
 * On 04889bb the follow-up below (18 words) failed the generic follow-up detectors' 16-word bound,
 * so `anchorQuestionOf` returned null, the solver saw no previous question and the turn was searched
 * as news. The executor-level spec missed it because its harness supplied the previous question
 * itself. These cases call the service's own anchor selection, as quote and execute do; the full
 * quote → execute path on PostgreSQL is `ask-v2.financial-continuity.postgres.spec.ts`.
 */
const Q1 =
  'I receive $950 today and repay $1,050 in a single payment after exactly one year, with no other fees. What is the effective annual rate?';
const Q2 =
  'And if I repay the $1,050 in 12 equal monthly instalments instead, is the rate still the same?';

describe('ASK FINANCIAL CONTINUITY P0 — loan schedule change binds to the reader\'s own earlier loan', () => {
  it('op 0ec1717c: the service anchors the 18-word follow-up to the earlier loan, and the solver completes it', () => {
    const anchor = anchorQuestionOf(Q2, [Q1]);
    expect(anchor).toBe(Q1);
    const loan = statedLoan(Q2, anchor)!;
    expect(loan.carried).toEqual(['amount received']);
    const c = loanRateComputation(loan)!;
    expect(c.steps.find((s) => s.label === 'Each monthly payment')?.value).toBe(87.5);
    expect(c.result).toEqual({ name: 'effective annual rate', value: 20.6173, unit: '%' });
    expect(c.conventions[0]).toBe(
      'The amount received (receive $950) is taken from your earlier question in this conversation.',
    );
  });

  it('binds to the nearest COMPLETE loan, past partial follow-ups and unrelated turns', () => {
    const third = 'What if I repay the $1,050 in 4 equal quarterly instalments instead, what is the rate then?';
    expect(anchorQuestionOf(third, [Q2, 'What is happening in Kenya?', Q1])).toBe(Q1);
  });

  it('with no earlier complete loan in the thread, no prior is passed (the executor asks instead)', () => {
    expect(anchorQuestionOf(Q2, [])).toBeNull();
    expect(anchorQuestionOf(Q2, ['What is happening in Kenya?', 'Explain the difference between APR and EAR.'])).toBeNull();
    expect(loanScheduleChange(Q2)).toEqual({ missing: ['amount received'] });
  });

  it('a schedule change with no amounts at all asks for both', () => {
    expect(loanScheduleChange('What is the rate if I repay in 12 equal monthly instalments?')).toEqual({
      missing: ['amount received', 'total repaid'],
    });
  });

  it('Polish schedule change binds the same way', () => {
    const pl1 = 'Otrzymuję 950 zł i spłacam 1050 zł w 4 równych ratach kwartalnych. Jakie jest oprocentowanie?';
    const pl2 = 'A jeśli spłacam 1050 zł w 12 równych ratach miesięcznych, czy oprocentowanie jest takie samo?';
    expect(anchorQuestionOf(pl2, [pl1])).toBe(pl1);
    expect(loanRateComputation(statedLoan(pl2, pl1)!)!.result.value).toBe(20.6173);
  });

  describe('narrow: everything that is not a loan schedule change is decided exactly as before', () => {
    it.each([
      Q1, // a complete loan is self-contained
      'What is happening to mortgage rates in Kenya?',
      'Will the central bank raise interest rates this month?',
      'Explain the difference between APR and the nominal interest rate on a loan.',
      'How many monthly payments are left on a 30-year mortgage after 12 years?',
      'What is happening in Kenya?',
    ])('%s', (q) => {
      expect(loanContinuationAnchor(q, [Q1])).toBeUndefined();
      expect(loanScheduleChange(q)).toBeUndefined();
    });

    it('a generic short follow-up still gets the generic anchor', () => {
      expect(anchorQuestionOf('Why did that happen?', ['What is happening in Kenya?'])).toBe('What is happening in Kenya?');
    });
  });
});
