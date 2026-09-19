/**
 * ════════════════════════════════════════════════════════════════════════════
 * AS-6 AND AS-7 — THE COHORT, AND THE CLOCK
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-HUMANITARIAN-GX14-AUTHORITY-STORE-R1 · AS-E1-5, AS-E1-6.
 *
 * These two rules are what stop the authority from becoming an oracle about the data it
 * protects. The structural rules in R3 close the question "which partitions are dark";
 * these close the two questions R3 could not reach: WHICH SET the darkness is declared
 * over, and WHEN the declaration appears.
 *
 * Both are timing/derivability properties, so neither can be enforced by a type. They
 * are enforced by assertions over the change log, which is what E1's `GA-45` measures.
 */

import type { ProtectedPartitionDeclaration } from './spatial-geometry';

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · AS-6 / AS-E1-5 — THE FOOTPRINT IS THIRD-PARTY DERIVABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * E1: "AS-6 is adopted. Its force comes ENTIRELY from the dark set being computable
 * from a published register by someone who holds none of our data."
 *
 * That sentence is the specification. If the cohort can only be reproduced by someone
 * with our records, then the cohort IS a statement about our records, and declaring it
 * leaks exactly what AS-6 exists to hide. So a declaration must name:
 *
 *   - WHICH published register,
 *   - WHICH level within it,
 *   - and the ELIGIBILITY PREDICATE, in terms a third party can apply.
 *
 * And the footprint is NEVER narrowed by anything we observed, counted or hold.
 */

export interface CohortDerivation {
  /** The published register, named so a third party can obtain the same one. */
  readonly registerId: string;
  /** Which edition of it. A register without an edition is not reproducible. */
  readonly registerEdition: string;
  /** The administrative level the cohort is drawn at. */
  readonly unitLevel: string;
  /**
   * The eligibility test, stated in the register's own terms.
   *
   * A STRING ON PURPOSE, and the limitation is acknowledged rather than hidden: this
   * cannot be machine-verified against the register here, because the register is not
   * in this process. What it CAN do — and what `GA-45` measures — is force the
   * predicate to be written down, so a third party can apply it and a reviewer can see
   * whether it references anything we hold.
   */
  readonly eligibilityPredicate: string;
}

export const COHORT_DERIVATION_FORBIDDEN_TERMS: readonly string[] = Object.freeze([
  'observed',
  'arrived',
  'reported',
  'our records',
  'record count',
  'present in',
  'seen',
  'incident',
]);

export class CohortNotDerivable extends Error {}

/**
 * AS-E1-5, enforced at declaration time.
 *
 * The forbidden-term check is deliberately crude, and its crudeness is the point: it
 * cannot prove a predicate is derivable, but it can catch the specific failure that
 * matters — a predicate that reaches for OUR data, in the words someone would naturally
 * use to write that. A reviewer still has to read it. This makes the common mistake
 * loud instead of invisible.
 */
export function assertCohortIsThirdPartyDerivable(derivation: CohortDerivation): void {
  for (const [field, value] of Object.entries(derivation)) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new CohortNotDerivable(
        `GEOMETRY_COHORT_DERIVATION_INCOMPLETE: '${field}' is empty. A cohort nobody else can ` +
          'reproduce is a statement about our own data wearing a register’s name.',
      );
    }
  }

  const predicate = derivation.eligibilityPredicate.toLowerCase();
  for (const term of COHORT_DERIVATION_FORBIDDEN_TERMS) {
    if (predicate.includes(term)) {
      throw new CohortNotDerivable(
        `GEOMETRY_COHORT_DERIVATION_OBSERVES_US: the predicate references '${term}'. The ` +
          'footprint is never narrowed by anything we observed, counted or hold — that is ' +
          'the oracle AS-6 closes.',
      );
    }
  }
}

/**
 * A governed declaration: R3's structural declaration plus its derivation and dates.
 *
 * `declaredAt` is R3's. `authoredAt` is new and is what AS-7's lag is measured against —
 * they differ because a declaration is written before it is published, and the gap is
 * the control.
 */
export interface GovernedPartitionDeclaration {
  readonly declaration: ProtectedPartitionDeclaration;
  readonly derivation: CohortDerivation;
  /** When a human authored it. ISO-8601. */
  readonly authoredAt: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · AS-7 / AS-E1-6 — THE CLOCK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * "A refresh that happens only when there is something to refresh ANNOUNCES that there
 * was something" — E1, applying R-B to timing.
 *
 * This is the rule people get wrong by optimising. Skipping a no-op refresh is the
 * obvious efficiency, it saves a trivial amount of work, and it converts the publication
 * schedule itself into a side channel: an observer who can see that a refresh happened
 * learns that something changed, without seeing what.
 */

/** Fixed, published in advance. AS-E1-6 §1. */
export const AUTHORITY_CADENCE_PERIOD_MS = 24 * 60 * 60 * 1000;

export const CADENCE_OUTCOMES = ['SUBSTANTIVE', 'NO_OP'] as const;
export type CadenceOutcome = (typeof CADENCE_OUTCOMES)[number];

export interface CadenceRun {
  readonly ranAt: string;
  readonly outcome: CadenceOutcome;
  readonly epoch: number;
}

export class CadenceViolation extends Error {}

/**
 * AS-E1-6 §3 · MINIMUM LAG.
 *
 * "A refresh at T incorporates only declarations authored before T − one cadence
 * period."
 *
 * Without it, a declaration authored minutes after a sensitive event and published at
 * the next refresh still carries the event's timing. The lag decouples the two, and
 * AS-6 makes it nearly costless because the common case needs no amendment at all.
 */
export function declarationIsEligibleForRefresh(
  authoredAt: string,
  refreshAt: string,
  periodMs: number = AUTHORITY_CADENCE_PERIOD_MS,
): boolean {
  const authored = Date.parse(authoredAt);
  const refresh = Date.parse(refreshAt);
  if (Number.isNaN(authored) || Number.isNaN(refresh)) return false;
  return refresh - authored >= periodMs;
}

export function assertRefreshRespectsLag(
  declarations: readonly GovernedPartitionDeclaration[],
  refreshAt: string,
  periodMs: number = AUTHORITY_CADENCE_PERIOD_MS,
): void {
  for (const d of declarations) {
    if (!declarationIsEligibleForRefresh(d.authoredAt, refreshAt, periodMs)) {
      throw new CadenceViolation(
        `GEOMETRY_CADENCE_LAG_VIOLATED: '${d.declaration.partitionKey}' was authored less than ` +
          'one cadence period before this refresh. A declaration published immediately after an ' +
          'event carries the event’s timing.',
      );
    }
  }
}

/**
 * AS-E1-6 §2 · THE SCHEDULE IS UNCONDITIONAL.
 *
 * Asserted over the run log rather than the scheduler code, because the property is
 * about what HAPPENED, not what was configured. A scheduler can be configured correctly
 * and still be skipped by an early return three layers down.
 */
export function assertCadenceRunsOnSchedule(
  runs: readonly CadenceRun[],
  windowStart: string,
  windowEnd: string,
  periodMs: number = AUTHORITY_CADENCE_PERIOD_MS,
): void {
  const start = Date.parse(windowStart);
  const end = Date.parse(windowEnd);
  const expected = Math.floor((end - start) / periodMs);

  const inWindow = runs
    .map((r) => Date.parse(r.ranAt))
    .filter((t) => !Number.isNaN(t) && t >= start && t <= end)
    .sort((a, b) => a - b);

  if (inWindow.length < expected) {
    throw new CadenceViolation(
      `GEOMETRY_CADENCE_RUN_MISSING: expected at least ${String(expected)} runs, saw ` +
        `${String(inWindow.length)}. A refresh that happens only when there is something to ` +
        'refresh announces that there was something.',
    );
  }

  for (let i = 1; i < inWindow.length; i += 1) {
    const gap = inWindow[i]! - inWindow[i - 1]!;
    if (gap > periodMs * 1.5) {
      throw new CadenceViolation(
        'GEOMETRY_CADENCE_GAP_TOO_LARGE: the interval between runs exceeded the published period.',
      );
    }
  }
}

/**
 * AS-E1-6 §2, the other half — A NO-OP MUST BE INDISTINGUISHABLE FROM A SUBSTANTIVE RUN.
 *
 * The outcome is recorded for operators, but nothing OBSERVABLE may differ: same
 * cadence, same epoch advance, same published artefact. This asserts the epoch advanced
 * on every run, including the no-ops — because an epoch that only moves when something
 * changed is the same side channel wearing a different hat.
 */
export function assertNoOpRunsAreIndistinguishable(runs: readonly CadenceRun[]): void {
  const ordered = [...runs].sort((a, b) => Date.parse(a.ranAt) - Date.parse(b.ranAt));

  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1]!;
    const current = ordered[i]!;
    if (current.epoch !== previous.epoch + 1) {
      throw new CadenceViolation(
        `GEOMETRY_CADENCE_EPOCH_NOT_UNIFORM: run at ${current.ranAt} moved the epoch from ` +
          `${String(previous.epoch)} to ${String(current.epoch)}. Every run advances it by one, ` +
          'or the epoch itself reports which runs were substantive.',
      );
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · AS-E1-6 §4 — EMERGENCIES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * "Emergency protection is escalation to an already-dark cohort, or withdrawal of the
 * surface. NEVER a new narrow declaration, WHICH IS ITSELF THE ARRIVAL SIGNAL."
 *
 * Withdrawal is an availability event and is indistinguishable from an outage — and E1
 * names that indistinguishability as the property that makes it safe. A surface that
 * goes down tells an observer nothing about why.
 */

export const EMERGENCY_ACTIONS = ['ESCALATE_INTO_DARK_COHORT', 'WITHDRAW_SURFACE'] as const;
export type EmergencyAction = (typeof EMERGENCY_ACTIONS)[number];

export class EmergencyActionRefused extends Error {}

export function assertEmergencyActionIsLawful(input: {
  readonly action: EmergencyAction;
  /** For escalation: the cohort the record is being moved INTO. */
  readonly targetPartitionKey?: string;
  /** Partition keys already dark under the CURRENT authority. */
  readonly alreadyDarkPartitionKeys: readonly string[];
}): void {
  if (input.action === 'WITHDRAW_SURFACE') return;

  const target = input.targetPartitionKey;
  if (target === undefined || target === '') {
    throw new EmergencyActionRefused(
      'GEOMETRY_EMERGENCY_TARGET_MISSING: escalation names the already-dark cohort it moves into.',
    );
  }
  if (!input.alreadyDarkPartitionKeys.includes(target)) {
    throw new EmergencyActionRefused(
      `GEOMETRY_EMERGENCY_COHORT_NOT_ALREADY_DARK: '${target}' is not dark under the current ` +
        'authority, so darkening it now IS the arrival signal. Escalate into an existing dark ' +
        'cohort, or withdraw the surface.',
    );
  }
}
