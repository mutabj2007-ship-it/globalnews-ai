/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK FINANCE INTEGRITY R1 — APR / effective-rate explanations (Production op b3924ff0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * "Explain the difference between APR and the nominal interest rate on a loan, using a simple
 * numerical example. State your assumptions." was answered with a $1,000 loan, 5% nominal, a $50
 * fee, one year, and "APR = (total cost − loan) / loan = 10%" — a simple cost percentage on face
 * principal presented as THE APR, with no payment timing and no statement of whether the fee was
 * deducted from the proceeds (fee deducted, single repayment of $1,050 on $950 received ⇒ ≈10.53%;
 * instalments ⇒ higher).
 *
 * Two deterministic pieces, no model:
 *   singleRepaymentApr   the APR of ONE advance repaid in ONE payment, from fully stated cash
 *                        flows only (undefined on anything missing — it never invents inputs)
 *   financialRateRuleFor the trusted rule the background reasoning call receives when the question
 *                        is about APR / APY / effective annual rate / IRR ('' otherwise, so every
 *                        other prompt is byte-identical)
 */

/**
 * APR (annual percentage, simple annualisation of the single-period rate — the convention for one
 * advance and one repayment) from the amount actually RECEIVED, the total REPAID and the term in
 * years. Returns a percentage, or undefined when any input is missing / not a positive finite
 * number or the repayment is below the amount received (not a loan cost).
 */
export function singleRepaymentApr(
  amountReceived: number | undefined,
  totalRepaid: number | undefined,
  termYears: number | undefined,
): number | undefined {
  const ok = (v: number | undefined): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
  if (!ok(amountReceived) || !ok(totalRepaid) || !ok(termYears)) return undefined;
  if (totalRepaid < amountReceived) return undefined;
  return ((totalRepaid / amountReceived - 1) / termYears) * 100;
}

/* acronyms are case-sensitive ("ear" is not EAR) */
const FINANCIAL_RATE_ACRONYM = /\b(?:APR|APY|EAR|IRR|RRSO)s?\b/u;
const FINANCIAL_RATE_WORDS =
  /annual\s+percentage\s+(?:rate|yield)|effective\s+(?:annual\s+)?(?:interest\s+)?rate|internal\s+rate\s+of\s+return|rzeczywist\p{L}*\s+roczn\p{L}*\s+stop\p{L}*|efektywn\p{L}*\s+(?:roczn\p{L}*\s+)?stop\p{L}*/iu;

/** Is this question about an annualised borrowing / return rate (APR, APY, EAR, IRR, RRSO)? */
export function isFinancialRateQuestion(question: string): boolean {
  return FINANCIAL_RATE_ACRONYM.test(question) || FINANCIAL_RATE_WORDS.test(question);
}

const AMOUNT = '\\$?\\s?([0-9][0-9,]*(?:\\.[0-9]+)?)';
const WORD_NUMBERS: Readonly<Record<string, number>> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

function amountOf(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * The reader's OWN fully stated single-repayment cash flows ("I receive $950 and repay $1,050 in one
 * payment after 1 year"), or undefined when any of the three is not stated or the loan is repaid in
 * instalments. Never a default, never a guess.
 */
export function statedSingleRepayment(
  question: string,
): { received: number; repaid: number; years: number } | undefined {
  if (/instal+ments?|monthly\s+payments?|per\s+month|each\s+month|raty|ratach/i.test(question))
    return undefined;
  const received = amountOf(
    new RegExp(`\\b(?:receives?|received|receiving|net\\s+proceeds\\s+(?:of|are|is)|disbursed)\\s+${AMOUNT}`, 'i').exec(question)?.[1],
  );
  const repaid = amountOf(
    new RegExp(`\\b(?:repays?|repaid|repaying|pays?\\s+back|single\\s+(?:re)?payment\\s+of)\\s+${AMOUNT}`, 'i').exec(question)?.[1],
  );
  const term = /\b(?:after|in|over|for)\s+(\d+(?:\.\d+)?|one|two|three|four|five)\s+(years?|months?)\b/i.exec(question);
  if (received === undefined || repaid === undefined || term === null) return undefined;
  const count = WORD_NUMBERS[term[1].toLowerCase()] ?? Number(term[1]);
  const years = /^month/i.test(term[2]) ? count / 12 : count;
  return singleRepaymentApr(received, repaid, years) === undefined
    ? undefined
    : { received, repaid, years };
}

function pct(value: number): string {
  return `${value.toFixed(2)}%`;
}

/* The reference illustration, computed (not written by hand): 1,000 face, 50 fee deducted from the
   proceeds, one repayment of 1,050 (principal + 5% nominal interest) after one year. */
const REFERENCE_APR = singleRepaymentApr(950, 1050, 1) as number;

/**
 * The trusted rule for an APR / effective-rate explanation ('' when the question is not one). When
 * the reader stated complete single-repayment cash flows, their APR is computed here and supplied.
 */
export function financialRateRuleFor(question: string): string {
  if (!isFinancialRateQuestion(question)) return '';
  const stated = statedSingleRepayment(question);
  const statedApr =
    stated === undefined ? undefined : singleRepaymentApr(stated.received, stated.repaid, stated.years);
  return (
    'FINANCIAL RATE CALCULATION: the reader asks about an annualised rate (APR / APY / effective ' +
    'annual rate / IRR). (1) Before any figure, state explicit assumptions for: payment timing ' +
    '(one repayment at the end of the term, or instalments — how many and how often); fee ' +
    'treatment (deducted from the amount the borrower receives, paid separately up front, or ' +
    'financed into the loan); and compounding (none, annual, monthly). (2) Distinguish a simple ' +
    'cost percentage (total borrowing cost ÷ principal) from a cash-flow-based annualised rate ' +
    '(the rate that equates the amount actually received with the payments actually made, ' +
    'annualised). Never present the simple cost percentage as the APR. (3) State a numeric APR as ' +
    'definitive only when it is computed from fully stated cash flows (the amount received and ' +
    'every payment with its timing); otherwise say plainly that the figure is an illustration of ' +
    'the method. (4) With instalments the APR is higher than with one repayment of the same total ' +
    'cost, because principal is repaid earlier; say so if you mention instalments. ' +
    'Reference illustration (computed deterministically; use it, or compute your own from fully ' +
    'stated cash flows): a 1,000 loan at 5% nominal for one year with a 50 fee deducted from the ' +
    'proceeds, repaid in a single payment of 1,050 at the end of the year: the borrower receives ' +
    `950, so APR = 1,050 ÷ 950 − 1 = ${pct(REFERENCE_APR)}; the simple cost percentage ` +
    '(50 interest + 50 fee) ÷ 1,000 = 10% is not the APR.' +
    (stated === undefined || statedApr === undefined
      ? ''
      : ` Computed from the reader's own stated cash flows (received ${stated.received}, repaid ` +
        `${stated.repaid} in one payment after ${Number(stated.years.toFixed(4))} year(s)): APR = ${pct(statedApr)}.`)
  );
}
