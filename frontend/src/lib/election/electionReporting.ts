import {
  type ObservationAbsenceState,
  type ObservationRevision,
  type ReaderAbsenceState,
  degradeTo,
  readerAbsence,
} from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * KENYA ELECTIONS · REPORTING STATE AND THE FOUR STRUCTURAL GATES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Authority: `MAIN-IMIHIGO-KENYA-ELECTIONS-PLAN-B-R2/contracts/SEND-TO-H-KENYA-
 * ELECTIONS-R2.md` §5 and §6, and `rulings/REPORTING-STATE-DECOMPOSITION.md`.
 *
 * This file is the round's most important deliverable, and it is deliberately
 * not a component. E1 was asked what must be **structurally true, not merely
 * designed**, and answered literally:
 *
 *   *"a caption is not a control, a colour is not a control, and a disclaimer a
 *   reader scrolls past is not a control."*
 *
 * ── THE SIX MEMBERS, AND WHY TWO OF THEM ARE NOT HERE ─────────────────────
 *
 * R1 called the six "statuses". Two of them are not statuses:
 *
 *   NOT_REPORTED   an ABSENCE. No value to qualify.
 *   COVERAGE_GAP   an ABSENCE. No value to qualify.
 *
 * Both project through the **existing** M08 shared authority
 * (`readerAbsence`, the verified 7 → 3 projection), which this file imports and
 * does not reimplement. **No second absence vocabulary is created** — that is
 * exactly what the M08 closeout was convened to prevent, and folding these two
 * into a status product would have put `COVERAGE_GAP` in two authorities at
 * once.
 *
 * What remains is four VALUE-states, and only those take a decomposition.
 */

/* ═══ §5.1 · THE DECOMPOSITION ═══════════════════════════════════════════ */

/**
 * "How many units are in."
 *
 * The axis that stops `PARTIALLY_REPORTED` and `PROVISIONAL` competing for one
 * word. L measured that both collapse to `NIEPEŁNE` in Polish — idiomatic and
 * true of both — and they are **not the same incompleteness**: one is *some
 * units are missing*, the other is *all units are in and none of it is
 * certified*.
 *
 * **Separating the axes makes the collapse unrepresentable rather than
 * discouraged.** `NIEPEŁNE` can honestly render `PARTIAL` and cannot reach
 * `PROVISIONAL` at all, because `PROVISIONAL` is `COMPLETE` on this axis.
 */
export type Reportedness = 'PARTIAL' | 'COMPLETE';

/** "Has the authority certified it." Two members. Never three. */
export type Finality = 'UNCERTIFIED' | 'CERTIFIED';

/**
 * `corrected` IS NOT A MEMBER OF EITHER AXIS.
 *
 * A correction is already modelled — an `ObservationRevision` of kind
 * `CORRECTION`, appended, with the superseded figure surviving. Storing
 * *"this figure was corrected"* as a finality member would store the same fact
 * twice, and two copies drift. It is DERIVED from the revision chain, here,
 * once.
 */
export function correctionPresent(revisions: readonly ObservationRevision[]): boolean {
  return revisions.some((revision) => revision.revisionKind === 'CORRECTION');
}

/**
 * The four value-states, as a derived name.
 *
 * This is a projection FOR DISPLAY of the two axes plus the revision chain. It
 * is never stored, and nothing writes to it — which is what makes §5.1's table
 * a fact about the data rather than a convention two fields agree to follow.
 */
export type ElectionValueState =
  | 'PARTIALLY_REPORTED'
  | 'PROVISIONAL'
  | 'FINAL_CERTIFIED'
  | 'CORRECTED_REVISED';

/**
 * `{ PARTIAL, CERTIFIED }` is representable and NOT producible.
 *
 * It is a real electoral state — an authority certifying a partial count — and
 * **no authority has published one to us**. The contract: *"Do not render it,
 * and do not add it to a producible set."* So it is refused at construction
 * rather than given a name here, and the refusal carries the reason.
 */
export const NOT_PRODUCIBLE_COMBINATION = 'PARTIAL+CERTIFIED' as const;

function valueStateFor(
  reportedness: Reportedness,
  finality: Finality,
  corrected: boolean,
): ElectionValueState | typeof NOT_PRODUCIBLE_COMBINATION {
  if (reportedness === 'PARTIAL' && finality === 'CERTIFIED') return NOT_PRODUCIBLE_COMBINATION;
  if (reportedness === 'PARTIAL') return 'PARTIALLY_REPORTED';
  if (finality === 'UNCERTIFIED') return 'PROVISIONAL';
  return corrected ? 'CORRECTED_REVISED' : 'FINAL_CERTIFIED';
}

/* ═══ KE2-4 · PARTIAL REPORTING CARRIES ITS DENOMINATOR ══════════════════ */

/**
 * "X of Y units reported", as the authority published it.
 *
 * `PARTIALLY_REPORTED` without a denominator is a number with an unstated
 * scope. **Where the denominator is unavailable from the authority, the figure
 * is not shown** — and "not shown" is enforced by refusing to build the figure
 * at all, below, rather than by a renderer remembering to check.
 */
export interface ReportedDenominator {
  readonly reported: number;
  readonly total: number;
  /** The authority's own word for the unit. Never ours. */
  readonly unitLabel: string;
}

/* ═══ THE PUBLISHER'S STATEMENT — THE ONLY INPUT ═════════════════════════ */

/**
 * KE2-2 · STATUS IS PUBLISHER-STATED, AND THIS TYPE IS THE ONLY DOOR.
 *
 * There is no other constructor, no setter, no `promote`, no `certify`, no
 * `markFinal`, and no code path anywhere in this lane that writes `CERTIFIED`
 * from anything but a field of this object. The guard suite demonstrates that
 * refusal FAILING against a planted promotion path — *a guard not shown to bind
 * is not evidence.*
 */
export interface PublisherFigureStatement {
  /** The figure exactly as the authority published it, as a string. */
  readonly value: string;
  readonly reportedness: Reportedness;
  readonly finality: Finality;
  readonly denominator: ReportedDenominator | null;
  /** When the AUTHORITY stated it. Not when we fetched it. */
  readonly statedAtMs: number;
  /** The append-only chain. `CORRECTION` presence is read from here. */
  readonly revisions: readonly ObservationRevision[];
}

/** Why a figure could not be built. A refusal is a result, never an exception to swallow. */
export type FigureRefusal =
  | { readonly refused: 'DENOMINATOR_UNAVAILABLE' }
  | { readonly refused: 'NOT_PRODUCIBLE_COMBINATION' };

/* ═══ KE2-1 · A BARE NUMBER IS NOT OBTAINABLE FROM THE RECORD ════════════ */

/**
 * ── WHY THIS IS A CLASS WITH PRIVATE FIELDS AND NOT AN OBJECT ────────────
 *
 * R1's `K-7` said the value element is constructed from `{ value, qualifier }`.
 * **E1 found that insufficient and E1 is right.** `{ status, value }` is a
 * shape *from which a renderer can reach for `.value` alone* — and every
 * screenshot, embed, copy-paste and downstream consumer that takes the number
 * and drops the sibling field produces an unqualified figure **that the
 * platform produced**.
 *
 * `KE2-1` is therefore not "both fields are required". It is:
 *
 *   *A VOTE TOTAL IS UNREACHABLE EXCEPT THROUGH AN ACCESSOR THAT YIELDS ITS
 *   STATUS WITH IT. A BARE NUMBER MUST NOT BE OBTAINABLE FROM THE RECORD AT
 *   ALL.*
 *
 * ECMAScript `#private` fields are the mechanism: they are private at RUNTIME,
 * not only to the type checker. `figure.value` does not typecheck AND does not
 * exist. `Object.keys` does not see it. The spread operator does not copy it.
 *
 * ── AND THE THREE ESCAPE HATCHES ARE CLOSED TOO ──────────────────────────
 *
 * A private field alone is not enough, because three language features reach
 * into an object without naming a property, and each is exactly E1's
 * "screenshot, embed, copy-paste" vector:
 *
 *   `${figure}`            -> toString   carries the qualifier
 *   JSON.stringify(figure) -> toJSON     carries the whole reading
 *   console.log(figure)    -> inspect    carries the qualifier
 *
 * **None of them can yield a bare number**, and the guard suite asserts each
 * one rather than trusting the private field to be sufficient.
 */
export interface ReportedReading {
  readonly value: string;
  readonly reportedness: Reportedness;
  readonly finality: Finality;
  readonly corrected: boolean;
  readonly state: ElectionValueState;
  readonly denominator: ReportedDenominator | null;
  readonly statedAtMs: number;
  /** True for every state but `FINAL_CERTIFIED` — §5.2's mandatory qualifier. */
  readonly qualifierRequired: boolean;
  /**
   * §5.2 · the amber rung, and it applies to exactly one state.
   *
   * Amber is the accepted rule for slots *"expressing change or lateness"*.
   * `CORRECTED_REVISED` **is** a change. `PROVISIONAL` is **not** — it is an
   * incomplete certification. Using amber for both would make a correction and
   * a provisional figure look alike, and those are the two a reader most needs
   * to tell apart.
   */
  readonly amber: 'PRIMARY' | null;
}

export class ReportedFigure {
  readonly #value: string;
  readonly #reportedness: Reportedness;
  readonly #finality: Finality;
  readonly #corrected: boolean;
  readonly #state: ElectionValueState;
  readonly #denominator: ReportedDenominator | null;
  readonly #statedAtMs: number;

  private constructor(reading: ReportedReading) {
    this.#value = reading.value;
    this.#reportedness = reading.reportedness;
    this.#finality = reading.finality;
    this.#corrected = reading.corrected;
    this.#state = reading.state;
    this.#denominator = reading.denominator;
    this.#statedAtMs = reading.statedAtMs;
  }

  /**
   * The ONLY way a figure comes into existence, and the gates run here.
   *
   * KE2-4 and the `{ PARTIAL, CERTIFIED }` refusal are enforced at
   * construction rather than at render, so an unshowable figure **does not
   * exist** for a renderer to mishandle.
   */
  static fromPublisher(statement: PublisherFigureStatement): ReportedFigure | FigureRefusal {
    const corrected = correctionPresent(statement.revisions);
    const state = valueStateFor(statement.reportedness, statement.finality, corrected);

    if (state === NOT_PRODUCIBLE_COMBINATION) return { refused: 'NOT_PRODUCIBLE_COMBINATION' };

    /* KE2-4 — a partial figure without its denominator is not shown. */
    if (state === 'PARTIALLY_REPORTED' && statement.denominator === null) {
      return { refused: 'DENOMINATOR_UNAVAILABLE' };
    }

    return new ReportedFigure({
      value: statement.value,
      reportedness: statement.reportedness,
      /*
        KE2-2 — read straight through from the publisher's statement. There is
        no branch here, no default, and no computation. A promotion path would
        have to be written as a visible edit to this line.
      */
      finality: statement.finality,
      corrected,
      state,
      denominator: statement.denominator,
      statedAtMs: statement.statedAtMs,
      qualifierRequired: state !== 'FINAL_CERTIFIED',
      amber: state === 'CORRECTED_REVISED' ? 'PRIMARY' : null,
    });
  }

  /** The one accessor. It yields the status with the value, or it yields nothing. */
  read(): ReportedReading {
    return {
      value: this.#value,
      reportedness: this.#reportedness,
      finality: this.#finality,
      corrected: this.#corrected,
      state: this.#state,
      denominator: this.#denominator,
      statedAtMs: this.#statedAtMs,
      qualifierRequired: this.#state !== 'FINAL_CERTIFIED',
      amber: this.#state === 'CORRECTED_REVISED' ? 'PRIMARY' : null,
    };
  }

  /** `${figure}` — a template literal must not yield a bare number. */
  toString(): string {
    return `${this.#value} [${this.#state}]`;
  }

  /** `JSON.stringify(figure)` — an embed must not yield a bare number. */
  toJSON(): ReportedReading {
    return this.read();
  }

  /** `console.log(figure)` in Node — a paste from a log must not yield a bare number. */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `ReportedFigure(${this.toString()})`;
  }
}

/* ═══ KE2-3 · PROVISIONAL FIGURES EXPIRE ════════════════════════════════ */

/**
 * *"THIS IS THE COMMONEST REAL FAILURE AND NO DESIGN DECISION REACHES IT: an
 * election-night provisional still on screen three days later, every qualifier
 * technically present and nobody reading them. The platform's own staleness
 * becomes the misinformation."*
 *
 * So a provisional the authority has not restated within its declared window
 * **degrades to a governed absence** rather than persisting as the newest
 * number.
 *
 * ── WHICH ABSENCE, AND WHY IT IS AN INTERNAL MEMBER ──────────────────────
 *
 * `SOURCE_TEMPORARILY_UNAVAILABLE` — *"a wired source did not answer"* — is the
 * truthful internal fact: the authority exists, is wired, and has not restated.
 * It is an INTERNAL member, and the surface reaches the reader's view through
 * `readerAbsence`, which projects it to `COVERAGE_GAP` **alongside four other
 * states**. That is the anti-oracle property, used rather than bypassed.
 *
 * The M08 projection is imported. It is not widened, narrowed, reimplemented,
 * or read around.
 */
export const PROVISIONAL_EXPIRY_INTERNAL_STATE: ObservationAbsenceState =
  'SOURCE_TEMPORARILY_UNAVAILABLE';

export type ProvisionalOutcome =
  | { readonly kind: 'FIGURE'; readonly figure: ReportedFigure }
  | {
      readonly kind: 'EXPIRED';
      readonly internal: ObservationAbsenceState;
      readonly reader: ReaderAbsenceState;
    };

export function expireProvisional(
  figure: ReportedFigure,
  nowMs: number,
  windowMs: number,
): ProvisionalOutcome {
  const reading = figure.read();

  /*
    Only an UNCERTIFIED figure expires. A certified result does not become
    less true by sitting still, and expiring it would claim the authority had
    withdrawn something it did not.
  */
  if (reading.finality === 'CERTIFIED') return { kind: 'FIGURE', figure };
  if (nowMs - reading.statedAtMs <= windowMs) return { kind: 'FIGURE', figure };

  return {
    kind: 'EXPIRED',
    internal: PROVISIONAL_EXPIRY_INTERNAL_STATE,
    reader: readerAbsence(PROVISIONAL_EXPIRY_INTERNAL_STATE),
  };
}

/**
 * The degradation travels one way only — toward claiming less — and that is the
 * shared `degradeTo` primitive, not a local rule.
 *
 * Exported so a guard can assert the direction rather than assume it.
 */
export function expiryMayNotStrengthen(to: ObservationAbsenceState): ObservationAbsenceState | null {
  return degradeTo(PROVISIONAL_EXPIRY_INTERNAL_STATE, to);
}

/* ═══ KE2-5 · ORDERING — WHAT R3 WITHDREW, AND WHAT REPLACED IT ═════════ */

/**
 * ── TWO WITHDRAWALS FROM R1, BOTH MAIN'S OWN CORRECTIONS ─────────────────
 *
 * R1 carried `ADMISSIBLE_DEFAULT_ORDERINGS`, `defaultOrderingFor`,
 * `mustDeclareArbitraryOrder` and a local `ORDER_IS_ARBITRARY_AND_NOT_A_RANKING`
 * flag. **All four are gone**, and neither removal is a loosening.
 *
 * `MAIN-…-PLAN-B-R3` §0.1 · `TIE_BREAK_IS_ARBITRARY_AND_NOT_CHRONOLOGICAL` is
 * **WITHDRAWN, not promoted** — H's `F-2` is confirmed, and promoting a
 * chronology-framed boolean that is always `true` with no consumer able to
 * observe it false *"would move the defect rather than close it."* So the local
 * stand-in R1 declared in its place is withdrawn with it.
 *
 * `MAIN-…-PLAN-B-R3` §0.2 · **`K-8`'s "declared arbitrary" construction is
 * WITHDRAWN**, because the landed authority is stricter than the contract that
 * cited it:
 *
 *   *"A list rendered in an order we chose, captioned as meaningless, is still a
 *   list we ordered. The caption is read by some readers; the sequence by all of
 *   them."*
 *
 * ── WHAT REPLACES THEM ───────────────────────────────────────────────────
 *
 * `RC-2` · **the order's provenance is declared to the RECORD, on a REQUIRED
 * field** — `orderReason` on the list model in `electionPreview.ts`. *"A
 * reader-facing disclaimer is read by some readers; a required field is read by
 * the compiler."*
 *
 * **`queueWasOrderedUpstream` is not called anywhere in this lane**, and that is
 * an instruction rather than a preference: it answers *"did the shared
 * assessment service rank this"*, and its `false` is not this surface's
 * condition. `UPSTREAM_ASSESSED` is never available to either vertical, so the
 * predicate would be `false` forever and the landed behaviour for `false` is
 * *render the unavailable state* — which would blank a region that has subjects
 * to show.
 *
 * Nothing in this file orders anything. There is no comparator in this lane at
 * all, which `RC-1` requires and a guard asserts.
 */
export const KE2_5_ORDERING_LIVES_ON_THE_RECORD = true as const;
