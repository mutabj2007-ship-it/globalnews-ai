/**
 * ════════════════════════════════════════════════════════════════════════════
 * CANONICAL JSON NUMERIC SEMANTICS — ECON-NUMERIC-LEXICAL-SEAM-1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MAIN-ECONOMY-CANONICAL-CLOSEOUT-R1. PROPOSED for `shared/src/official-data/json-numeric.ts`.
 * Nothing lands without authorization. No provider. No activation. No deployment.
 *
 * ── THE DEFECT, AND WHY IT IS A CONFLATION AND NOT A BUG ──────────────────
 *
 * `json-strict.ts` classifies a numeric token by the LEXICAL round-trip
 *
 *     String(Number(token)) === token
 *
 * and its own comment already names the casualty:
 *
 *   "`1e400` (becomes Infinity), a 30-digit decimal (rounds) and `1.0` (renders as "1")
 *    all take this path — the last is harmless and is still recorded, because a rule
 *    with exceptions is a rule someone argues about later."
 *
 * The three cases are NOT the same fact, and collapsing them is what reaches the
 * Economy producer as a withheld observation:
 *
 *     1e400                  the double is NOT FINITE            — no value exists
 *     12345678901234567890   the double is a DIFFERENT NUMBER    — precision is lost
 *     1.0                    the double is THE SAME NUMBER,      — nothing is lost
 *                            rendered with different characters
 *
 * The lexical test answers "are these the same CHARACTERS". The question the pipeline
 * needs answered is "is this the same VALUE". `1.0` fails the first and passes the
 * second, and that single distinction is the whole of ECON-NUMERIC-LEXICAL-SEAM-1.
 *
 * ── WHY THE FIX IS HERE AND NOT DOWNSTREAM ────────────────────────────────
 *
 * The Product Owner's two prohibitions point at the same place:
 *
 *   "Do not make individual producers guess."     — so the answer travels as data
 *   "Do not normalize every numeric-looking       — so no downstream Number() call
 *    string blindly."                                may exist
 *
 * A blanket downstream `Number()` is unsafe exactly as Code proved:
 * `Number("12345678901234567890")` silently returns `12345678901234567000`. So the
 * classification is computed ONCE, at the parse boundary, where the characters still
 * exist — E1 · P-1, parse once — and is carried forward. **No producer calls `Number`
 * on a token at all.**
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · THE THREE CLASSES — CLOSED, AND DISTINGUISHABLE BY CONSTRUCTION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A-24's rule applies: distinguishable absences must not collapse. Three different
 * facts about a publisher's number get three different names, and a consumer that
 * cannot tell them apart cannot report honestly which one it hit.
 */
export const JSON_NUMERIC_CLASSES = [
  /** The IEEE-754 double denotes EXACTLY the decimal value the token denotes. */
  'EXACT_AS_DOUBLE',
  /** Finite, but the double denotes a DIFFERENT decimal value. The characters are the value. */
  'PRECISION_SENSITIVE',
  /** `Number(token)` is not finite. No double represents this token at all. */
  'NOT_FINITE_AS_DOUBLE',
] as const;
export type JsonNumericClass = (typeof JSON_NUMERIC_CLASSES)[number];

export interface ClassifiedNumericToken {
  /** The token exactly as it appeared in the bytes. Always present, always verbatim. */
  readonly token: string;
  readonly numericClass: JsonNumericClass;
  /**
   * The double, SET ONLY FOR `EXACT_AS_DOUBLE`.
   *
   * `null` for the other two, and that is the enforcement: a consumer cannot reach a
   * number for a precision-sensitive or non-finite token, because there is no number
   * on the object to reach. It does not have to remember not to call `Number`.
   */
  readonly value: number | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · EXACT DECIMAL COMPARISON — BigInt, NO FLOAT ARITHMETIC ANYWHERE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every JSON number literal is an exact base-10 rational: `sign × mantissa × 10^exp`.
 * Two literals denote the same value exactly when their normalized (mantissa, exp)
 * pairs agree. Comparing them with BigInt means the comparison itself never loses
 * precision — which matters, because the thing being tested IS precision loss.
 */

interface ExactDecimal {
  readonly negative: boolean;
  readonly mantissa: bigint;
  readonly exponent: number;
}

/*
 * JSON's OWN NUMBER GRAMMAR, not a permissive approximation.
 *
 * `(0|[1-9]\d*)` rather than `\d+`: JSON forbids leading zeros, and an earlier draft
 * used `\d+`, which accepted `01` and classified it EXACT with the value 1. That is a
 * CORRECT VALUE FOR A MALFORMED LITERAL — the worst shape a parser can have, because it
 * makes a caller defect indistinguishable from a clean parse. Caught by a probe.
 */
const JSON_NUMBER_LITERAL = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;

/** `null` when the string is not a JSON number literal at all. */
export function exactDecimalOf(literal: string): ExactDecimal | null {
  const m = JSON_NUMBER_LITERAL.exec(literal);
  if (m === null) return null;

  const [, sign, intPart, fracPart = '', expPart = '0'] = m;
  let mantissa = BigInt((intPart as string) + fracPart);
  let exponent = Number(expPart) - fracPart.length;

  /*
    NORMALIZE, so that `1.0`, `1`, `1e0` and `100e-2` all reduce to the same pair.
    This is the step that makes a trailing-zero decimal equal to its integer form
    WITHOUT any float ever being involved.
  */
  if (mantissa === 0n) return { negative: false, mantissa: 0n, exponent: 0 };
  while (mantissa % 10n === 0n) {
    mantissa /= 10n;
    exponent += 1;
  }

  return { negative: (sign as string) === '-', mantissa, exponent };
}

export function exactDecimalsEqual(a: ExactDecimal, b: ExactDecimal): boolean {
  return a.negative === b.negative && a.mantissa === b.mantissa && a.exponent === b.exponent;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · THE CLASSIFIER — ONE FUNCTION, TOTAL, NO EXCEPTIONS LIST
 * ═══════════════════════════════════════════════════════════════════════════ */

export class JsonNumericTokenMalformed extends Error {}

export function classifyJsonNumericToken(token: string): ClassifiedNumericToken {
  const tokenDecimal = exactDecimalOf(token);
  if (tokenDecimal === null) {
    throw new JsonNumericTokenMalformed(
      `ECON-NUM-1: '${token.slice(0, 32)}' is not a JSON number literal. The strict parser ` +
        'produces only well-formed literals, so reaching this is a caller defect, not a ' +
        'publisher defect — and classifying it would hide which.',
    );
  }

  const asDouble = Number(token);

  if (!Number.isFinite(asDouble)) {
    return { token, numericClass: 'NOT_FINITE_AS_DOUBLE', value: null };
  }

  /*
    THE VALUE ROUND-TRIP.

    `String(double)` is ECMAScript's shortest decimal that round-trips to that double.
    If it denotes the same decimal value the token denotes, then the double carries the
    publisher's number and nothing was lost in either direction. If it denotes a
    different value, the double is a different number and the characters are the only
    place the publisher's value still exists.

    This is NOT `String(Number(t)) === t`. That test asks whether the CHARACTERS
    survived. This asks whether the VALUE did.
  */
  const doubleDecimal = exactDecimalOf(String(asDouble));
  if (doubleDecimal !== null && exactDecimalsEqual(tokenDecimal, doubleDecimal)) {
    return { token, numericClass: 'EXACT_AS_DOUBLE', value: asDouble };
  }

  return { token, numericClass: 'PRECISION_SENSITIVE', value: null };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · THE CONSUMER SIDE — A TOTAL SWITCH, SO A FOURTH CLASS CANNOT BE IGNORED
 * ═══════════════════════════════════════════════════════════════════════════ */

export const ECON_NUMERIC_REFUSAL_CODES = [
  /**
   * NARROWED, NOT RETIRED. It was correct for `1e400` all along and wrong only because
   * it was also carrying two other conditions. Retiring a code that is right about one
   * thing, to replace it with a code that is right about the same thing, loses the
   * lineage of every row already refused under it.
   */
  'ECON-VALUE-NOT-FINITE',
  /** NEW. Finite, and the double is not the publisher's number. */
  'ECON-VALUE-PRECISION-SENSITIVE',
  /** NEW. The cell did not hold a number at all — a string, null, object or array. */
  'ECON-VALUE-NOT-NUMERIC',
] as const;
export type EconNumericRefusalCode = (typeof ECON_NUMERIC_REFUSAL_CODES)[number];

/**
 * The ONLY way an Economy producer obtains a number from a classified cell.
 *
 * Total over the three classes. A fourth class would not compile here, which is the
 * point: the exhaustiveness is the guard, not a comment asking callers to be careful.
 */
export function economyValueOrRefusal(
  cell: ClassifiedNumericToken | null,
): { readonly ok: true; readonly value: number } | { readonly ok: false; readonly code: EconNumericRefusalCode } {
  if (cell === null) return { ok: false, code: 'ECON-VALUE-NOT-NUMERIC' };

  switch (cell.numericClass) {
    case 'EXACT_AS_DOUBLE':
      /*
        `value` is non-null for exactly this class, by construction in the classifier.
        The assertion is narrow and local, and the probe suite proves the invariant
        across the whole fixture set rather than trusting this line.
      */
      return { ok: true, value: cell.value as number };
    case 'PRECISION_SENSITIVE':
      return { ok: false, code: 'ECON-VALUE-PRECISION-SENSITIVE' };
    case 'NOT_FINITE_AS_DOUBLE':
      return { ok: false, code: 'ECON-VALUE-NOT-FINITE' };
  }
}
