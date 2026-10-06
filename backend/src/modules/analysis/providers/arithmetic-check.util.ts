/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK RELIABILITY R1 (C) — DETERMINISTIC CHECK OF WRITTEN-OUT ARITHMETIC
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The background prompt now requires every numerical example to show its steps
 * ("$2.10 × 1.02 = $2.142"). This pass recomputes each written step and corrects a wrong result in
 * place, so a model slip never reaches the reader as fact. It only touches explicit calculations:
 *
 *   A × F = B          (×, x, * ; F a plain factor such as 1.05)
 *   A × (1 + p%) = B   and   A × (1 − p%) = B
 *   A + p% = B         ("$2.10 + 2% = $2.142")
 *
 * Prose without a written calculation is left alone (the prompt keeps such prose consistent). A
 * corrected value keeps the original's currency sign and decimal style (at least the original's
 * decimals, up to 3 when needed to be exact).
 */
export interface ArithmeticCorrection {
  readonly expression: string;
  readonly written: string;
  readonly corrected: string;
}

const NUM = String.raw`([$€£]?\s?-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|[$€£]?\s?-?\d+(?:\.\d+)?)`;
const TIMES = String.raw`\s*(?:×|\*|x|X)\s*`;
const EQ = String.raw`\s*=\s*`;

function value(token: string): number {
  return Number(token.replace(/[$€£,\s]/g, ''));
}

function decimalsOf(token: string): number {
  const m = token.replace(/[$€£,\s]/g, '').match(/\.(\d+)$/);
  return m === null ? 0 : m[1].length;
}

function format(n: number, like: string): string {
  const sign = (like.match(/^[$€£]\s?/) ?? [''])[0];
  const base = Math.max(decimalsOf(like), 2);
  let d = base;
  while (d < 3 && Math.abs(Number(n.toFixed(d)) - n) > 1e-9) d++;
  const fixed = n.toFixed(Math.min(d, 3));
  return `${sign}${decimalsOf(like) === 0 && Number.isInteger(n) ? String(n) : fixed}`;
}

function close(a: number, b: number): boolean {
  /* the written result may be rounded to the precision it was written with */
  return Math.abs(a - b) <= 0.0051 + Math.abs(a) * 1e-9;
}

export function checkWrittenArithmetic(text: string): { text: string; corrections: ArithmeticCorrection[] } {
  const corrections: ArithmeticCorrection[] = [];
  let out = text;
  const patterns: Array<{ re: RegExp; compute: (m: RegExpExecArray) => number | null; result: (m: RegExpExecArray) => string }> = [
    {
      /* A × (1 + p%) = B / A × (1 − p%) = B */
      re: new RegExp(`${NUM}${TIMES}\\(\\s*1\\s*([+\\-−])\\s*(\\d+(?:\\.\\d+)?)\\s*%\\s*\\)${EQ}${NUM}`, 'g'),
      compute: (m) => value(m[1]) * (1 + ((m[2] === '+' ? 1 : -1) * Number(m[3])) / 100),
      result: (m) => m[4],
    },
    {
      /* A × F = B (F must be a factor, not a percentage) */
      re: new RegExp(`${NUM}${TIMES}(\\d+(?:\\.\\d+)?)(?!\\s*%)${EQ}${NUM}`, 'g'),
      compute: (m) => value(m[1]) * Number(m[2]),
      result: (m) => m[3],
    },
    {
      /* A + p% = B */
      re: new RegExp(`${NUM}\\s*([+\\-−])\\s*(\\d+(?:\\.\\d+)?)\\s*%${EQ}${NUM}`, 'g'),
      compute: (m) => value(m[1]) * (1 + ((m[2] === '+' ? 1 : -1) * Number(m[3])) / 100),
      result: (m) => m[4],
    },
  ];
  for (const { re, compute, result } of patterns) {
    out = out.replace(re, (...args: unknown[]) => {
      const m = args.slice(0, -2) as unknown as RegExpExecArray;
      const whole = m[0];
      const expected = compute(m);
      const written = result(m);
      if (expected === null || !Number.isFinite(expected) || close(value(written), expected)) return whole;
      const corrected = format(expected, written);
      corrections.push({ expression: whole, written: written.trim(), corrected });
      return whole.slice(0, whole.lastIndexOf(written)) + corrected + whole.slice(whole.lastIndexOf(written) + written.length);
    });
  }
  /* A corrected step's wrong result may be repeated later in the prose ("…to $2.04"): fix those
     exact repeats of the wrong written value too, so prose and calculation agree. */
  for (const c of corrections) {
    if (c.written === c.corrected) continue;
    const escaped = c.written.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(?<![\\d.])${escaped}(?!\\d|\\.\\d)`, 'g'), c.corrected);
  }
  return { text: out, corrections };
}
