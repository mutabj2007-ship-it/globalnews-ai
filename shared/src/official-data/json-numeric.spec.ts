/**
 * ════════════════════════════════════════════════════════════════════════════
 * ECON-NUMERIC-LEXICAL-SEAM-1 — THE CLASSIFIER, ASSERTED AGAINST MAIN'S TABLE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The forms below are Main's `manifest/NUMERIC-CLASSIFICATION.tsv`, transcribed as
 * fixtures. They are asserted rather than trusted, and the cross-bytes control at the end
 * is what makes the result mean something: it measures how many of these the OLD predicate
 * rejected, so "the classifier is better" is a COUNT rather than a claim.
 */
import {
  ECON_NUMERIC_REFUSAL_CODES,
  JSON_NUMERIC_CLASSES,
  JsonNumericTokenMalformed,
  classifyJsonNumericToken,
  economyValueOrRefusal,
} from './json-numeric';

/** Main's table, column 1 → column 3. */
const EXACT: readonly string[] = [
  '1.0', '1.00', '-1.0', '0.0', '-0', '1e0', '1E0', '1e2', '100e-2', '-2.50',
  '1e21', '0.0000001', '1.000', '0.1', '3.14', '9007199254740991',
  /* ordinary forms the old predicate already accepted, kept so the set is not only the
     interesting half */
  '1', '0', '-1', '3.5', '61.6', '-2.5', '100', '2026',
];

const PRECISION_SENSITIVE: readonly string[] = [
  '12345678901234567890',
  '9007199254740993',
  '0.1234567890123456789',
  '1.0000000000000000001',
  '123456789012345678901234567890',
];

const NOT_FINITE: readonly string[] = [
  '1e400', '-1e400', '1e309', '-1e309',
  /*
    An absurd exponent OVERFLOWS; it is not a precision question. Written here after being
    measured — it was first filed under PRECISION_SENSITIVE by assumption and the suite
    caught it. The boundary is real and is asserted just below.
  */
  '1.7976931348623157e307999',
];

/** Not JSON number literals at all. A caller defect, not a publisher defect. */
const MALFORMED: readonly string[] = [
  '01', '1.', '.5', '+1', '1e', 'Infinity', 'NaN', '0x10', ' 1', '', '--1', '1e+', '1_000',
];

describe('the fixture sets are non-empty, so every loop below can fail', () => {
  it('EMPTY-1', () => {
    expect(EXACT.length).toBeGreaterThan(20);
    expect(PRECISION_SENSITIVE.length).toBeGreaterThan(4);
    expect(NOT_FINITE.length).toBeGreaterThan(3);
    expect(MALFORMED.length).toBeGreaterThan(8);
  });
});

describe('EXACT_AS_DOUBLE — ordinary decimal forms are usable', () => {
  it.each(EXACT)('%s classifies EXACT_AS_DOUBLE and yields a finite number', (token) => {
    const c = classifyJsonNumericToken(token);
    expect(`${token}: ${c.numericClass}`).toBe(`${token}: EXACT_AS_DOUBLE`);
    expect(typeof c.value).toBe('number');
    expect(Number.isFinite(c.value as number)).toBe(true);
  });

  it('1.0 is exactly 1 — the observed GDP case, and it publishes', () => {
    const c = classifyJsonNumericToken('1.0');
    expect(c.value).toBe(1);
    const r = economyValueOrRefusal(c);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(1);
  });

  it('-0 keeps its sign rather than being normalised away', () => {
    expect(Object.is(classifyJsonNumericToken('-0').value, -0)).toBe(true);
  });

  it('THE OVERFLOW BOUNDARY IS EXACT — MAX_VALUE publishes, one step past it refuses', () => {
    /*
      Worth pinning because it is where "precision" and "finiteness" are easy to confuse.
      Number.MAX_VALUE is carried exactly and publishes; anything that overflows is
      NOT_FINITE_AS_DOUBLE, not PRECISION_SENSITIVE — nothing was rounded, the value simply
      does not exist in a double.
    */
    expect(classifyJsonNumericToken('1.7976931348623157e308').numericClass).toBe('EXACT_AS_DOUBLE');
    expect(classifyJsonNumericToken('1.7976931348623157e309').numericClass).toBe('NOT_FINITE_AS_DOUBLE');
  });
});

describe('PRECISION_SENSITIVE — large values are NOT silently coerced', () => {
  it.each(PRECISION_SENSITIVE)('%s yields NO number, so nothing downstream can round it', (token) => {
    const c = classifyJsonNumericToken(token);
    expect(`${token}: ${c.numericClass}`).toBe(`${token}: PRECISION_SENSITIVE`);
    expect(c.value).toBeNull();
    const r = economyValueOrRefusal(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ECON-VALUE-PRECISION-SENSITIVE');
  });

  it('and the characters survive — the publisher value is not lost, only unpublished', () => {
    expect(classifyJsonNumericToken('12345678901234567890').token).toBe('12345678901234567890');
  });

  it('THE POINT: Number() would have corrupted this one silently', () => {
    /* This is why a blanket Number() in an adapter is the wrong repair: for 1.0 it is
       exact, and for this it is data loss that nothing would have reported. */
    expect(String(Number('12345678901234567890'))).not.toBe('12345678901234567890');
  });
});

describe('NOT_FINITE_AS_DOUBLE — overflow still refuses, and under the right code', () => {
  it.each(NOT_FINITE)('%s refuses as ECON-VALUE-NOT-FINITE', (token) => {
    const c = classifyJsonNumericToken(token);
    expect(`${token}: ${c.numericClass}`).toBe(`${token}: NOT_FINITE_AS_DOUBLE`);
    expect(c.value).toBeNull();
    const r = economyValueOrRefusal(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ECON-VALUE-NOT-FINITE');
  });

  it('the code was NARROWED, not retired — it was always correct for these', () => {
    expect(ECON_NUMERIC_REFUSAL_CODES).toContain('ECON-VALUE-NOT-FINITE');
  });
});

describe('malformed literals throw — a caller defect is not a publisher defect', () => {
  it.each(MALFORMED)('%s throws rather than classifying', (token) => {
    expect(() => classifyJsonNumericToken(token)).toThrow(JsonNumericTokenMalformed);
  });

  it('01 in particular — the draft that accepted it returned a CORRECT VALUE for a MALFORMED literal', () => {
    /*
      Main records this: an earlier grammar used `\d+`, accepted `01` and classified it
      EXACT_AS_DOUBLE with the value 1. A correct value for an invalid literal makes a
      caller defect indistinguishable from a clean parse.
    */
    expect(() => classifyJsonNumericToken('01')).toThrow(JsonNumericTokenMalformed);
  });
});

describe('the iff-invariant is what makes a downstream Number() unnecessary', () => {
  it('value !== null IF AND ONLY IF the class is EXACT_AS_DOUBLE', () => {
    for (const token of [...EXACT, ...PRECISION_SENSITIVE, ...NOT_FINITE]) {
      const c = classifyJsonNumericToken(token);
      expect(`${token}: ${c.value !== null} ${c.numericClass === 'EXACT_AS_DOUBLE'}`)
        .toBe(`${token}: ${c.numericClass === 'EXACT_AS_DOUBLE'} ${c.numericClass === 'EXACT_AS_DOUBLE'}`);
    }
  });

  it('the class vocabulary is closed at three', () => {
    expect([...JSON_NUMERIC_CLASSES].sort()).toEqual(
      ['EXACT_AS_DOUBLE', 'NOT_FINITE_AS_DOUBLE', 'PRECISION_SENSITIVE'],
    );
  });

  it('a non-numeric cell refuses as ECON-VALUE-NOT-NUMERIC', () => {
    const r = economyValueOrRefusal(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ECON-VALUE-NOT-NUMERIC');
  });

  it('three codes for three facts — A-24, and each is distinct', () => {
    expect(new Set(ECON_NUMERIC_REFUSAL_CODES).size).toBe(ECON_NUMERIC_REFUSAL_CODES.length);
    expect(ECON_NUMERIC_REFUSAL_CODES.length).toBe(3);
  });
});

describe('CROSS-BYTES CONTROL — the difference from the old predicate is a COUNT', () => {
  it('the old lexical test rejected at least 13 of the forms now published', () => {
    const oldTest = (t: string): boolean => String(Number(t)) === t;
    const rejectedByOld = EXACT.filter((t) => !oldTest(t));
    /*
      Every one of these is a value the product could have published all along and did
      not. The number is the size of the defect, and asserting a FLOOR rather than an
      exact count means adding another ordinary form to the fixture set cannot silently
      weaken the control.
    */
    expect(`rejected by the old predicate: ${rejectedByOld.length >= 13}`)
      .toBe('rejected by the old predicate: true');
    expect(rejectedByOld).toContain('1.0');
    expect(rejectedByOld).toContain('-2.50');
    expect(rejectedByOld).toContain('100e-2');
  });

  it('and the old predicate ACCEPTED nothing the classifier refuses — no regression', () => {
    const oldTest = (t: string): boolean => String(Number(t)) === t;
    const nowRefused = [...PRECISION_SENSITIVE, ...NOT_FINITE].filter(oldTest);
    expect(nowRefused).toEqual([]);
  });
});
