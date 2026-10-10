/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK REASONING LIVE DEFECTS R1 — the rate of a loan from the reader's OWN stated cash flows
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Alpha live acceptance of 537a062 (2026-10-10):
 *   op 1f437e26  "I receive $950 today and repay $1,050 in a single payment after exactly one year,
 *                with no other fees. What is the effective annual rate?" was sent to NEWS, and the
 *                model then explained EAR with an unrelated 5%-compounded-quarterly example (5.09%).
 *   op 63644aa1  "And if I repay the $1,050 in 12 equal monthly instalments instead, is the rate
 *                still the same?" was sent to NEWS and answered "couldn't verify reporting".
 *
 * A loan's rate from stated cash flows is a calculation, not news, and a language model is not a
 * calculator: it is solved HERE, deterministically, and answered through the existing
 * deterministic-computation seam (zero model, zero provider). Only fully stated cash flows are
 * solved — the amount received, the amount repaid and its schedule; anything missing is
 * `undefined`, never assumed. A follow-up that changes only the schedule ("…in 12 equal monthly
 * instalments instead") is completed from the reader's previous question, and only when that
 * question itself stated a complete loan.
 */
import type { ComputationQuantity, ComputationResult, ComputationStep } from './deterministic-computation';

export type LoanSchedule =
  | { readonly kind: 'SINGLE'; readonly years: number; readonly quoted: string }
  | {
      readonly kind: 'LEVEL';
      readonly count: number;
      readonly perYear: number;
      readonly period: string;
      readonly quoted: string;
    };

export interface StatedLoan {
  readonly received: number;
  readonly receivedQuoted: string;
  readonly repaid: number;
  readonly repaidQuoted: string;
  readonly schedule: LoanSchedule;
  /** inputs taken from the reader's previous question (disclosed with the answer) */
  readonly carried?: readonly ('amount received' | 'total repaid' | 'schedule')[];
}

type Partial3 = {
  received?: { value: number; quoted: string };
  repaid?: { value: number; quoted: string };
  schedule?: LoanSchedule;
};

const CURRENCY = String.raw`(?:[$€£]|USD|EUR|GBP|PLN|KES|RWF|zł)?`;
const AMOUNT = String.raw`${CURRENCY}\s?(\d{1,3}(?:[,\s]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?${CURRENCY}`;
const WORD_NUMBERS: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, eighteen: 18, twenty: 20, 'twenty-four': 24, thirty: 30, 'thirty-six': 36,
};
const PERIODS: ReadonlyArray<{ readonly pattern: RegExp; readonly perYear: number; readonly period: string }> = [
  { pattern: /^(?:monthly|miesięczn\p{L}*)$/iu, perYear: 12, period: 'month' },
  { pattern: /^(?:quarterly|kwartaln\p{L}*)$/iu, perYear: 4, period: 'quarter' },
  { pattern: /^(?:weekly|tygodniow\p{L}*)$/iu, perYear: 52, period: 'week' },
  { pattern: /^(?:annual|yearly|roczn\p{L}*)$/iu, perYear: 1, period: 'year' },
];

function amountOf(raw: string): number | undefined {
  const n = Number(raw.replace(/[,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function countOf(raw: string): number | undefined {
  const n = WORD_NUMBERS[raw.toLowerCase()] ?? Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** What one question states about a loan's cash flows (any subset). */
export function readLoanStatement(question: string): Partial3 {
  const text = question.replace(/\s+/g, ' ');
  const out: Partial3 = {};
  const received = new RegExp(
    String.raw`\b(?:receive|receives|received|receiving|get|gets|disbursed|net proceeds of|otrzymuj\p{L}*|otrzymał\p{L}*|dostaj\p{L}*)\s+(?:only\s+|the\s+)?${AMOUNT}`,
    'iu',
  ).exec(text);
  if (received) {
    const v = amountOf(received[1]);
    if (v !== undefined) out.received = { value: v, quoted: received[0].trim() };
  }
  const repaid = new RegExp(
    String.raw`\b(?:repay|repays|repaid|repaying|pay back|pays back|spłac\p{L}*|oddaj\p{L}*|zwracam)\s+(?:the\s+|a total of\s+)?${AMOUNT}`,
    'iu',
  ).exec(text);
  if (repaid) {
    const v = amountOf(repaid[1]);
    if (v !== undefined) out.repaid = { value: v, quoted: repaid[0].trim() };
  }
  /* "12 equal monthly instalments" / "12 równych rat miesięcznych" / "12 miesięcznych rat" — the
     Polish word "rat(y)" only next to a Polish period word, so "annual rate" is never a schedule */
  const lv =
    /\b(\d+|[a-z-]+)\s+(?:equal\s+)?(monthly|quarterly|weekly|annual|yearly)\s+(?:instal(?:l)?ments?|payments?|repayments?)\b/i.exec(text) ??
    /(\d+)\s+(?:równych\s+)?rat\p{L}*\s+(miesięczn\p{L}*|kwartaln\p{L}*|tygodniow\p{L}*|roczn\p{L}*)/iu.exec(text) ??
    /(\d+)\s+(?:równych\s+)?(miesięczn\p{L}*|kwartaln\p{L}*|tygodniow\p{L}*|roczn\p{L}*)\s+rat\p{L}*/iu.exec(text);
  const lvCount = lv === null ? undefined : countOf(lv[1]);
  const lvPeriod = lv === null ? undefined : PERIODS.find((x) => x.pattern.test(lv[2]));
  if (lv !== null && lvCount !== undefined && lvPeriod !== undefined) {
    out.schedule = { kind: 'LEVEL', count: lvCount, perYear: lvPeriod.perYear, period: lvPeriod.period, quoted: lv[0].trim() };
  } else if (/\b(?:single|one|lump[\s-]sum)\s+(?:re)?payment\b|\bjednorazow\p{L}*|\bjedn\p{L}*\s+(?:spłat\p{L}*|płatno\p{L}*)/iu.test(text)) {
    const term =
      /\b(?:after|in|over|for|po|za)\s+(?:exactly\s+|dokładnie\s+)?(\d+(?:\.\d+)?|[a-z-]+)\s+(years?|months?|lat\p{L}*|miesi\p{L}*)\b/iu.exec(text) ??
      /\b(?:after|in)\s+(?:exactly\s+)?(a|one)\s+(year)\b|\b(?:po|za)\s+(?:dokładnie\s+)?(roku|rok)()/iu.exec(text);
    if (term) {
      const [count, unit] = term[1] !== undefined ? [term[1], term[2]] : [term[3], 'year'];
      const n = /^(?:a|roku|rok)$/i.test(count) ? 1 : countOf(count);
      const years = n === undefined ? undefined : /^(?:month|miesi)/i.test(unit) ? n / 12 : n;
      if (years !== undefined && years > 0) out.schedule = { kind: 'SINGLE', years, quoted: term[0].trim() };
    }
  }
  return out;
}

const RATE_ASKED =
  /\b(?:APR|APY|EAR|IRR|RRSO)\b|\b(?:rate|interest|yield|cost of (?:the )?(?:loan|borrowing)|oprocentowani\p{L}*|stop[aęy]\p{L}*)\b/iu;

/**
 * The reader's complete loan, from this question alone or — for a follow-up that restates only part
 * of it — completed from the reader's previous question when THAT question stated a complete loan.
 * `undefined` unless a rate is asked about and every cash flow is stated.
 */
export function statedLoan(question: string, previousQuestion?: string | null): StatedLoan | undefined {
  if (!RATE_ASKED.test(question)) return undefined;
  const now = readLoanStatement(question);
  const complete = (s: Partial3): s is Required<Partial3> =>
    s.received !== undefined && s.repaid !== undefined && s.schedule !== undefined;
  let merged: Partial3 = now;
  if (!complete(now) && previousQuestion) {
    const before = readLoanStatement(previousQuestion);
    if (!complete(before) || !RATE_ASKED.test(previousQuestion)) return undefined;
    /* one loan, never two: the earlier loan must agree with every amount the reader restates */
    if (!restatesSameLoan(now, before)) return undefined;
    merged = {
      received: now.received ?? before.received,
      repaid: now.repaid ?? before.repaid,
      schedule: now.schedule ?? before.schedule,
    };
  }
  if (!complete(merged)) return undefined;
  if (merged.repaid.value < merged.received.value) return undefined;
  const carried = [
    ...(now.received === undefined ? (['amount received'] as const) : []),
    ...(now.repaid === undefined ? (['total repaid'] as const) : []),
    ...(now.schedule === undefined ? (['schedule'] as const) : []),
  ];
  return {
    received: merged.received.value,
    receivedQuoted: merged.received.quoted,
    repaid: merged.repaid.value,
    repaidQuoted: merged.repaid.quoted,
    schedule: merged.schedule,
    ...(carried.length === 0 ? {} : { carried }),
  };
}

/*
  ASK FINANCIAL CONTINUITY P0 (Alpha op 0ec1717c, after 8e7e0876) — "And if I repay the $1,050 in 12
  equal monthly instalments instead, is the rate still the same?" is 18 words: past the generic
  follow-up detectors' 16-word bound, so the service handed the solver no previous question and the
  turn was searched as news. A loan SCHEDULE CHANGE is recognised here instead, narrowly: a rate is
  asked about, a repayment schedule is stated, the reader restates at least one of their OWN amounts
  ("repay the $1,050"), and the question alone does not state the whole loan. A schedule with no
  amount of the reader's ("What rate do banks charge for 12 monthly payments?") is not one.
*/

/** The inputs a loan schedule-change question leaves unstated, or `undefined` if it is not one. */
export function loanScheduleChange(question: string): { readonly missing: readonly string[] } | undefined {
  if (!RATE_ASKED.test(question)) return undefined;
  const s = readLoanStatement(question);
  if (s.schedule === undefined) return undefined;
  if (s.received === undefined && s.repaid === undefined) return undefined;
  const missing = [
    ...(s.received === undefined ? ['amount received'] : []),
    ...(s.repaid === undefined ? ['total repaid'] : []),
  ];
  return missing.length === 0 ? undefined : { missing };
}

/*
  Independent Gate 4 preflight of eccbab0 (doc 24): after L1 "receive $950 … repay $1,050" and L2
  "receive $900 … repay $1,000", the follow-up "…repay the $1,050 in 12 equal monthly instalments…"
  bound the NEAREST complete loan, L2, and solved received 900 with repaid 1,050 — 33.7835 % for a
  loan the reader never stated. A follow-up continues only an earlier loan whose amounts agree, BY
  ROLE (received with received, repaid with repaid), with every amount the follow-up restates.
*/
const SAME_AMOUNT = 0.005;
function restatesSameLoan(now: Partial3, before: Partial3): boolean {
  const agrees = (restated?: { value: number }, earlier?: { value: number }) =>
    restated === undefined || (earlier !== undefined && Math.abs(restated.value - earlier.value) < SAME_AMOUNT);
  return agrees(now.received, before.received) && agrees(now.repaid, before.repaid);
}

/**
 * The earlier question a loan schedule change continues: of the reader's own earlier questions
 * (newest first, this thread only) that each stated a complete loan by themselves, those that agree
 * with every amount the follow-up restates. The nearest of them — unless they disagree on what the
 * follow-up would take from them, which is a genuinely ambiguous reference: no guess.
 * `null` when the question is a schedule change but no single consistent loan exists (the caller asks
 * for the missing input); `undefined` when it is not a schedule change (the caller decides as before).
 */
export function loanContinuationAnchor(
  question: string,
  newestFirst: readonly string[],
): string | null | undefined {
  if (loanScheduleChange(question) === undefined) return undefined;
  const consistent = newestFirst.filter(
    (q) => statedLoan(q) !== undefined && statedLoan(question, q) !== undefined,
  );
  if (consistent.length === 0) return null;
  const solved = (q: string) => {
    const loan = statedLoan(question, q)!;
    return `${loan.received}|${loan.repaid}`;
  };
  const nearest = solved(consistent[0]);
  return consistent.every((q) => solved(q) === nearest) ? consistent[0] : null;
}

/** The periodic rate r with  received = payment × (1 − (1 + r)^−n) / r  (bisection; r ≥ 0). */
export function levelPaymentRate(received: number, payment: number, n: number): number | undefined {
  if (!(received > 0 && payment > 0 && n > 0) || payment * n < received) return undefined;
  if (Math.abs(payment * n - received) < 1e-12) return 0;
  const pv = (r: number) => (r === 0 ? payment * n : (payment * (1 - Math.pow(1 + r, -n))) / r);
  let lo = 0;
  let hi = 1;
  while (pv(hi) > received) hi *= 2;
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > received) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const r4 = (v: number) => Math.round(v * 10000) / 10000;
const money = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number) => `${r4(v * 100).toFixed(4)} %`;

/** Which stated inputs came from the reader's earlier question — said with the answer, never hidden. */
function carriedConventions(loan: StatedLoan): string[] {
  return (loan.carried ?? []).map((input) =>
    input === 'amount received'
      ? `The amount received (${loan.receivedQuoted}) is taken from your earlier question in this conversation.`
      : input === 'total repaid'
        ? `The total repaid (${loan.repaidQuoted}) is taken from your earlier question in this conversation.`
        : `The repayment schedule (${loan.schedule.quoted}) is taken from your earlier question in this conversation.`,
  );
}

/** The deterministic answer for a stated loan, in the computation seam's shape. */
export function loanRateComputation(loan: StatedLoan): ComputationResult | undefined {
  const inputs: ComputationQuantity[] = [
    { name: 'amount received', value: loan.received, unit: '', quoted: loan.receivedQuoted },
    { name: 'total repaid', value: loan.repaid, unit: '', quoted: loan.repaidQuoted },
  ];
  const steps: ComputationStep[] = [
    { label: 'Cost of borrowing', expression: `${money(loan.repaid)} − ${money(loan.received)}`, value: Math.round((loan.repaid - loan.received) * 100) / 100, unit: '' },
  ];
  if (loan.schedule.kind === 'SINGLE') {
    const { years } = loan.schedule;
    const growth = loan.repaid / loan.received;
    const ear = Math.pow(growth, 1 / years) - 1;
    const simple = (growth - 1) / years;
    inputs.push({ name: 'term (years)', value: r4(years), unit: 'years', quoted: loan.schedule.quoted });
    steps.push({ label: 'Rate over the whole term', expression: `${money(loan.repaid)} ÷ ${money(loan.received)} − 1`, value: r4((growth - 1) * 100), unit: '%' });
    if (years !== 1)
      steps.push({ label: 'Simple annual rate (APR, no compounding)', expression: `${r4((growth - 1) * 100)} % ÷ ${r4(years)}`, value: r4(simple * 100), unit: '%' });
    steps.push({ label: 'Effective annual rate', expression: `(${money(loan.repaid)} ÷ ${money(loan.received)})^(1 ÷ ${r4(years)}) − 1`, value: r4(ear * 100), unit: '%' });
    return {
      kind: 'LOAN_RATE',
      inputs,
      steps,
      result: { name: 'effective annual rate', value: r4(ear * 100), unit: '%' },
      conventions: [
        ...carriedConventions(loan),
        'The rate is computed on the amount actually received, with one repayment at the end of the term.',
        'No fees or payments other than those stated.',
        ...(years === 1 ? ['For a one-year single repayment, the APR and the effective annual rate are the same.'] : []),
      ],
    };
  }
  const { count, perYear, period } = loan.schedule;
  const payment = loan.repaid / count;
  const r = levelPaymentRate(loan.received, payment, count);
  if (r === undefined) return undefined;
  const nominal = r * perYear;
  const ear = Math.pow(1 + r, perYear) - 1;
  inputs.push({ name: `equal ${period}ly payments`, value: count, unit: '', quoted: loan.schedule.quoted });
  steps.push({ label: `Each ${period}ly payment`, expression: `${money(loan.repaid)} ÷ ${count}`, value: Math.round(payment * 100) / 100, unit: '' });
  steps.push({ label: `Rate per ${period} (r)`, expression: `r solving ${money(loan.received)} = ${money(payment)} × (1 − (1 + r)^−${count}) ÷ r`, value: r4(r * 100), unit: '%' });
  steps.push({ label: 'Nominal annual rate (APR)', expression: `${r4(r * 100)} % × ${perYear}`, value: r4(nominal * 100), unit: '%' });
  steps.push({ label: 'Effective annual rate', expression: `(1 + ${r4(r * 100)} %)^${perYear} − 1`, value: r4(ear * 100), unit: '%' });
  const sameTotalSingle = Math.pow(loan.repaid / loan.received, 1 / (count / perYear)) - 1;
  return {
    kind: 'LOAN_RATE',
    inputs,
    steps,
    result: { name: 'effective annual rate', value: r4(ear * 100), unit: '%' },
    conventions: [
      ...carriedConventions(loan),
      `Payments are equal and made at the end of each ${period}; the first one ${period} after the money is received.`,
      'No fees or payments other than those stated.',
      `APR here is the ${period}ly rate × ${perYear} (nominal); the effective annual rate compounds it. Which one a lender must quote depends on the jurisdiction.`,
      `The rate is not the same as repaying the same total in one payment at the end (${pct(sameTotalSingle)} a year): instalments repay principal earlier, so the same cost is paid on a smaller average balance.`,
    ],
  };
}
