/**
 * ════════════════════════════════════════════════════════════════════════════
 * C · STATED PERIOD — closes the router's BF-09, `time.statedPeriod`
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THERE IS NO CLOCK IN THIS FILE, AND THAT IS THE DESIGN.
 *
 * "yesterday" is not a date. It is a date FUNCTION whose argument is the instant
 * the question was asked. Resolving it here would:
 *
 *   - make the producer untestable without freezing time, and a producer that
 *     needs a frozen clock to be tested is a producer whose output nobody can
 *     reproduce from the record;
 *   - convert what the reader SAID into what we CONCLUDED, in the one field whose
 *     entire job is to hold what they said;
 *   - and set the storage type more precise than the fact, which is the ruling
 *     this programme has now reached from three directions —
 *     `SnapshotRetrieval.referencePeriod`, Main's `time.statedPeriod`, and the
 *     NISR CPI parser's refusal to widen a stated period.
 *
 * So a relative period is recorded as `anchor: 'RELATIVE_TO_ASK'` with the
 * reader's words intact. Resolution against a real instant belongs to retrieval,
 * with an injected clock, where it can be recorded as a derived value beside the
 * stated one instead of replacing it.
 *
 * "PRESERVE ORIGINAL SEMANTICS AND PROVENANCE" IS THEREFORE LITERAL:
 * `statedPeriod` is a verbatim span of the normalized question, always.
 */

import type { StatedPeriod, PeriodBound, PeriodPrecision } from './ask-context-producers.contract';

interface Rule {
  readonly pattern: RegExp;
  readonly precision: PeriodPrecision;
  readonly anchor: 'ABSOLUTE' | 'RELATIVE_TO_ASK';
  readonly bound: PeriodBound;
}

const MONTH = '(?:january|february|march|april|may|june|july|august|september|october|november|december)';

/**
 * ORDER IS SIGNIFICANT AND IS THE MOST BREAKABLE THING HERE.
 * A range must be tried before the single dates it contains, or
 * "between 1 and 7 march 2026" is recorded as the day "1 march". A spec holds
 * this by asserting the range case directly, and a mutation reorders it to prove
 * the assertion bites.
 */
const RULES: readonly Rule[] = [
  /* ── ranges first ───────────────────────────────────────────────────────── */
  { pattern: new RegExp(`between\\s+\\d{1,2}\\s+and\\s+\\d{1,2}\\s+${MONTH}\\s+\\d{4}`, 'i'), precision: 'RANGE', anchor: 'ABSOLUTE', bound: 'CLOSED_PAST' },
  { pattern: new RegExp(`from\\s+\\d{1,2}\\s+${MONTH}\\s+\\d{4}\\s+to\\s+\\d{1,2}\\s+${MONTH}\\s+\\d{4}`, 'i'), precision: 'RANGE', anchor: 'ABSOLUTE', bound: 'CLOSED_PAST' },
  { pattern: /\d{4}-\d{2}-\d{2}\s+to\s+\d{4}-\d{2}-\d{2}/i, precision: 'RANGE', anchor: 'ABSOLUTE', bound: 'CLOSED_PAST' },

  /* ── explicit absolute dates ────────────────────────────────────────────── */
  { pattern: new RegExp(`\\d{1,2}\\s+${MONTH}\\s+\\d{4}`, 'i'), precision: 'DAY', anchor: 'ABSOLUTE', bound: 'POINT_IN_TIME' },
  { pattern: new RegExp(`${MONTH}\\s+\\d{1,2}\\s+\\d{4}`, 'i'), precision: 'DAY', anchor: 'ABSOLUTE', bound: 'POINT_IN_TIME' },
  { pattern: /\d{4}-\d{2}-\d{2}/, precision: 'DAY', anchor: 'ABSOLUTE', bound: 'POINT_IN_TIME' },
  { pattern: new RegExp(`${MONTH}\\s+\\d{4}`, 'i'), precision: 'MONTH', anchor: 'ABSOLUTE', bound: 'CLOSED_PAST' },

  /* ── relative, anchored to the instant of asking ────────────────────────── */
  { pattern: /\btoday\b/i, precision: 'DAY', anchor: 'RELATIVE_TO_ASK', bound: 'POINT_IN_TIME' },
  { pattern: /\byesterday\b/i, precision: 'DAY', anchor: 'RELATIVE_TO_ASK', bound: 'POINT_IN_TIME' },
  { pattern: /\blast week\b/i, precision: 'WEEK', anchor: 'RELATIVE_TO_ASK', bound: 'CLOSED_PAST' },
  { pattern: /\bthis week\b/i, precision: 'WEEK', anchor: 'RELATIVE_TO_ASK', bound: 'OPEN_RECENT' },
  { pattern: /\blast month\b/i, precision: 'MONTH', anchor: 'RELATIVE_TO_ASK', bound: 'CLOSED_PAST' },
  { pattern: /\bthis month\b/i, precision: 'MONTH', anchor: 'RELATIVE_TO_ASK', bound: 'OPEN_RECENT' },
  { pattern: /\bthis year\b/i, precision: 'YEAR', anchor: 'RELATIVE_TO_ASK', bound: 'OPEN_RECENT' },
  { pattern: /\blast year\b/i, precision: 'YEAR', anchor: 'RELATIVE_TO_ASK', bound: 'CLOSED_PAST' },

  /* ── a bare year, last: "in 2026" ───────────────────────────────────────── */
  { pattern: /\b(?:19|20)\d{2}\b/, precision: 'YEAR', anchor: 'ABSOLUTE', bound: 'CLOSED_PAST' },
];

function normalize(query: string): string {
  return query.toLowerCase().replace(/[^\p{L}\p{N}-]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Produce the reader's stated period, or null when they stated none.
 *
 * NULL, NOT A DEFAULT. There is no `UNBOUNDED` fallback object: a question with
 * no time is a question with no time, and manufacturing an `UNBOUNDED` record
 * would let a chip render a time the reader never asked for. `UNBOUNDED` exists
 * in the union for a caller that needs to say so explicitly, not as this
 * producer's floor.
 */
export function detectStatedPeriod(query: string): StatedPeriod | null {
  const normalized = normalize(query);
  if (normalized.length === 0) return null;

  for (const rule of RULES) {
    const match = rule.pattern.exec(normalized);
    if (match === null) continue;
    const statedPeriod = match[0];

    /* The verbatim guarantee, enforced rather than trusted: the value is a span
       of the normalized question or it is not returned. */
    if (!normalized.includes(statedPeriod)) continue;

    return {
      statedPeriod,
      precision: rule.precision,
      anchor: rule.anchor,
      bound: rule.bound,
      provenance: 'STATED',
    };
  }

  return null;
}

/**
 * THE ONE THING A CONSUMER MUST NOT DO, held as a named export so a spec can
 * assert it and a reviewer can cite it.
 *
 * A `RELATIVE_TO_ASK` period has no absolute meaning inside this module. Any code
 * that turns it into dates must take an explicit instant, record that instant,
 * and keep `statedPeriod` unchanged beside the result.
 */
export const RELATIVE_PERIODS_ARE_NEVER_RESOLVED_HERE = true as const;
