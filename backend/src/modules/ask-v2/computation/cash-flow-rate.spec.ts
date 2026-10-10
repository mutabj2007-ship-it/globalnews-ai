import { levelPaymentRate, loanRateComputation, readLoanStatement, statedLoan } from './cash-flow-rate';

/* The exact Alpha live-acceptance wordings (537a062, 2026-10-10) */
const C2 =
  'I receive $950 today and repay $1,050 in a single payment after exactly one year, with no other fees. What is the effective annual rate?';
const C3 = 'And if I repay the $1,050 in 12 equal monthly instalments instead, is the rate still the same?';

/* independent reference values (closed form / bisection outside this module, CTO figures) */
const EXPECTED = {
  single: 10.5263158,
  monthly: 1.5744,
  nominal: 18.8925,
  effective: 20.6173,
};

describe('ASK REASONING LIVE DEFECTS R1 — loan rate from stated cash flows', () => {
  it('op 1f437e26 (C2): the single repayment is read in full and solved to 10.526 %', () => {
    const loan = statedLoan(C2);
    expect(loan).toMatchObject({ received: 950, repaid: 1050, schedule: { kind: 'SINGLE', years: 1 } });
    const c = loanRateComputation(loan!)!;
    expect(c.kind).toBe('LOAN_RATE');
    expect(c.result).toEqual({ name: 'effective annual rate', value: 10.5263, unit: '%' });
    expect(Math.abs(c.result.value - EXPECTED.single)).toBeLessThan(0.0005);
  });

  it('op 63644aa1 (C3): the follow-up is completed from the previous question and solved', () => {
    expect(statedLoan(C3)).toBeUndefined(); // alone it does not state what was received
    const loan = statedLoan(C3, C2);
    expect(loan).toMatchObject({ received: 950, repaid: 1050, schedule: { kind: 'LEVEL', count: 12, perYear: 12 } });
    const c = loanRateComputation(loan!)!;
    const step = (label: RegExp) => c.steps.find((s) => label.test(s.label))!.value;
    expect(step(/Each monthly payment/)).toBe(87.5);
    expect(Math.abs(step(/Rate per month/) - EXPECTED.monthly)).toBeLessThan(0.0005);
    expect(Math.abs(step(/Nominal annual rate/) - EXPECTED.nominal)).toBeLessThan(0.0005);
    expect(Math.abs(c.result.value - EXPECTED.effective)).toBeLessThan(0.0005);
    /* "is the rate still the same?" is answered: no, and why */
    expect(c.conventions.join(' ')).toMatch(/not the same as repaying the same total in one payment at the end \(10\.5263 %/);
  });

  it('the solver agrees with the closed form and with the zero-cost case', () => {
    const r = levelPaymentRate(950, 87.5, 12)!;
    expect(Math.abs((87.5 * (1 - Math.pow(1 + r, -12))) / r - 950)).toBeLessThan(1e-9);
    expect(levelPaymentRate(1200, 100, 12)).toBe(0);
    expect(levelPaymentRate(1300, 100, 12)).toBeUndefined(); // repays less than received
  });

  it('a multi-year single repayment separates simple APR from the effective rate', () => {
    const c = loanRateComputation(statedLoan('I receive $1,000 and repay $1,210 in one payment after 2 years. What is the APR?')!)!;
    expect(c.steps.find((s) => /Simple annual rate/.test(s.label))!.value).toBe(10.5);
    expect(c.result.value).toBe(10);
  });

  it('PL: the same loan in Polish is read', () => {
    const loan = statedLoan('Otrzymuję 950 zł i spłacam 1050 zł w 12 równych ratach miesięcznych. Jakie jest oprocentowanie?');
    expect(loan).toMatchObject({ received: 950, repaid: 1050, schedule: { kind: 'LEVEL', count: 12 } });
  });

  it.each([
    ['no rate asked', 'I receive $950 today and repay $1,050 after one year in a single payment. Is that a good deal?'],
    ['no amount received', 'I repay $1,050 in a single payment after one year. What is the effective annual rate?'],
    ['no schedule', 'I receive $950 and repay $1,050. What is the APR?'],
    ['a market rate question', 'What is the current APR on mortgages in Kenya?'],
    ['repaying less than received', 'I receive $1,050 and repay $950 in a single payment after one year. What is the rate?'],
  ])('%s → not solved (nothing is assumed)', (_l, q) => {
    expect(statedLoan(q)).toBeUndefined();
  });

  it('a follow-up is never completed from a previous question that was not a complete loan', () => {
    expect(statedLoan(C3, 'Explain the difference between APR and the nominal interest rate on a loan.')).toBeUndefined();
    expect(statedLoan(C3, 'I receive $950 today. What is the APR?')).toBeUndefined();
  });

  it('reads the parts a follow-up restates', () => {
    expect(readLoanStatement(C3)).toMatchObject({ repaid: { value: 1050 }, schedule: { kind: 'LEVEL', count: 12 } });
    expect(readLoanStatement(C3).received).toBeUndefined();
  });
});
