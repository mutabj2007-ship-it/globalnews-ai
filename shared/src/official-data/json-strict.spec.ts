/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE PARSE-BOUNDARY DELTA — ECON-NUMERIC-LEXICAL-SEAM-1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Classification happens ONCE, inside the single parse. These assert what the parser now
 * hands downstream, because that is what decides whether a producer can publish a figure
 * without ever calling `Number`.
 */
import { parseStrictJson } from './json-strict';

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

function parsed(body: string): {
  readonly value: unknown;
  readonly lexical: ReadonlyArray<{ path: string; token: string; numericClass: string }>;
} {
  const r = parseStrictJson(bytes(body)) as unknown as {
    ok: boolean;
    value: unknown;
    lexicalNumberTokens: ReadonlyArray<{ path: string; token: string; numericClass: string }>;
  };
  if (!r.ok) throw new Error('parse refused: ' + JSON.stringify(r));
  return { value: r.value, lexical: r.lexicalNumberTokens };
}

describe('an ordinary exact decimal arrives as a NUMBER and is not recorded as lexical', () => {
  it('1.0 yields the number 1 and NO lexicalNumberTokens entry', () => {
    const p = parsed('{"value":{"0":1.0}}');
    const v = (p.value as { value: Record<string, unknown> }).value['0'];
    expect(typeof v).toBe('number');
    expect(v).toBe(1);
    expect(p.lexical).toEqual([]);
  });

  it('and the same is true of the other trailing-zero forms that used to be withheld', () => {
    for (const [body, expected] of [
      ['{"v":1.00}', 1],
      ['{"v":-1.0}', -1],
      ['{"v":0.0}', 0],
      ['{"v":-2.50}', -2.5],
      ['{"v":100e-2}', 1],
    ] as const) {
      const p = parsed(body);
      const v = (p.value as Record<string, unknown>)['v'];
      expect(`${body}: ${v} ${typeof v} ${p.lexical.length}`).toBe(`${body}: ${expected} number 0`);
    }
  });

  it('the real HICP and debt values are unaffected — no regression on what already worked', () => {
    expect((parsed('{"v":3.5}').value as Record<string, unknown>)['v']).toBe(3.5);
    expect((parsed('{"v":61.6}').value as Record<string, unknown>)['v']).toBe(61.6);
  });
});

describe('a value a double cannot carry is kept as CHARACTERS and CLASSIFIED', () => {
  it('12345678901234567890 yields the string, and one entry carrying PRECISION_SENSITIVE', () => {
    const p = parsed('{"value":{"0":12345678901234567890}}');
    const v = (p.value as { value: Record<string, unknown> }).value['0'];
    expect(typeof v).toBe('string');
    expect(v).toBe('12345678901234567890');
    expect(p.lexical).toHaveLength(1);
    expect(p.lexical[0]?.token).toBe('12345678901234567890');
    expect(p.lexical[0]?.numericClass).toBe('PRECISION_SENSITIVE');
  });

  it('an overflowing exponent is recorded as NOT_FINITE_AS_DOUBLE, a different fact', () => {
    const p = parsed('{"v":1e400}');
    expect((p.value as Record<string, unknown>)['v']).toBe('1e400');
    expect(p.lexical[0]?.numericClass).toBe('NOT_FINITE_AS_DOUBLE');
  });

  it('THE CLASS IS WHY THE FIELD EXISTS — the two are not interchangeable', () => {
    /*
      Before the delta both took the same path and an operator reading an audit row could
      not tell which had happened. A rounded 20-digit integer and an overflow call for
      different decisions.
    */
    const a = parsed('{"v":9007199254740993}').lexical[0]?.numericClass;
    const b = parsed('{"v":1e309}').lexical[0]?.numericClass;
    expect([a, b]).toEqual(['PRECISION_SENSITIVE', 'NOT_FINITE_AS_DOUBLE']);
  });

  it('the path is recorded so an operator can find the cell', () => {
    const p = parsed('{"value":{"0":12345678901234567890}}');
    expect(typeof p.lexical[0]?.path).toBe('string');
    expect(p.lexical[0]?.path.length).toBeGreaterThan(0);
  });
});

describe('the parse-once rule is preserved', () => {
  it('a body with several numerics classifies each without a second pass over the bytes', () => {
    const p = parsed('{"a":1.0,"b":12345678901234567890,"c":3.5,"d":1e400}');
    const o = p.value as Record<string, unknown>;
    expect([typeof o['a'], typeof o['b'], typeof o['c'], typeof o['d']])
      .toEqual(['number', 'string', 'number', 'string']);
    expect(p.lexical.map((l) => l.numericClass))
      .toEqual(['PRECISION_SENSITIVE', 'NOT_FINITE_AS_DOUBLE']);
  });
});
