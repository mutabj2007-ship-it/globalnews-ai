import {
  financialRateRuleFor,
  isFinancialRateQuestion,
  singleRepaymentApr,
  statedSingleRepayment,
} from './financial-rate';

/** ASK FINANCE INTEGRITY R1 — Production op b3924ff0 (APR vs nominal rate). */
const MEASURED =
  'Explain the difference between APR and the nominal interest rate on a loan, using a simple numerical example. State your assumptions.';

describe('singleRepaymentApr', () => {
  it('the measured case: 950 received, 1,050 repaid once after one year ⇒ ≈10.526%', () => {
    expect(singleRepaymentApr(950, 1050, 1)).toBeCloseTo(10.526315789, 6);
  });
  it('annualises a shorter term (6 months: 1,000 → 1,030 ⇒ 6%)', () => {
    expect(singleRepaymentApr(1000, 1030, 0.5)).toBeCloseTo(6, 9);
  });
  it.each([
    [undefined, 1050, 1],
    [950, undefined, 1],
    [950, 1050, undefined],
    [0, 1050, 1],
    [950, 1050, 0],
    [950, Number.NaN, 1],
    [1050, 950, 1],
  ])('refuses (undefined) on missing / invalid inputs: %p %p %p', (r, p, y) => {
    expect(singleRepaymentApr(r, p, y)).toBeUndefined();
  });
});

describe('isFinancialRateQuestion', () => {
  it.each([
    MEASURED,
    'What is the APY on a savings account paying 4% compounded monthly?',
    'How do I compute the effective annual rate?',
    'Explain IRR for a project.',
    'Czym jest RRSO kredytu?',
    'Jak obliczyć rzeczywistą roczną stopę oprocentowania?',
  ])('recognises "%s"', (q) => expect(isFinancialRateQuestion(q)).toBe(true));
  it.each([
    'Explain the difference between weather and climate, using a simple example.',
    'My ear hurts, what should I do?',
    'Explain how compound interest works.',
    'What happened in April?',
  ])('ignores "%s"', (q) => expect(isFinancialRateQuestion(q)).toBe(false));
});

describe('financialRateRuleFor', () => {
  it('the measured question: explicit assumptions, simple % vs cash-flow rate, definitive vs illustrative', () => {
    const rule = financialRateRuleFor(MEASURED);
    expect(rule).toContain('payment timing');
    expect(rule).toContain('fee treatment');
    expect(rule).toContain('compounding');
    expect(rule).toContain('simple cost percentage');
    expect(rule).toContain('cash-flow-based annualised rate');
    expect(rule).toContain('definitive only when it is computed from fully stated cash flows');
    expect(rule).toContain('illustration of the method');
    expect(rule).toContain('APR = 1,050 ÷ 950 − 1 = 10.53%');
    expect(rule).toContain('(50 interest + 50 fee) ÷ 1,000 = 10% is not the APR');
    /* nothing is invented for the reader: no stated cash flows, no "your APR" line */
    expect(rule).not.toContain("reader's own stated cash flows");
  });

  it('non-financial questions get no rule (the prompt stays byte-identical)', () => {
    expect(financialRateRuleFor('Explain the difference between weather and climate.')).toBe('');
  });

  it('fully stated single-repayment cash flows are computed and supplied', () => {
    const q = 'What is the APR if I receive $950 and repay $1,050 in one payment after 1 year?';
    expect(statedSingleRepayment(q)).toEqual({ received: 950, repaid: 1050, years: 1 });
    expect(financialRateRuleFor(q)).toContain(
      "Computed from the reader's own stated cash flows (received 950, repaid 1050 in one payment after 1 year(s)): APR = 10.53%.",
    );
  });

  it('incomplete or instalment cash flows are never completed by assumption', () => {
    expect(statedSingleRepayment('What is the APR if I receive $950 and repay $1,050?')).toBeUndefined();
    expect(
      statedSingleRepayment('What is the APR if I receive $950 and repay $1,050 in 12 monthly instalments over 1 year?'),
    ).toBeUndefined();
    expect(statedSingleRepayment(MEASURED)).toBeUndefined();
  });
});
