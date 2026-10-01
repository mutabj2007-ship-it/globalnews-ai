/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK TECHNICAL / SCIENTIFIC REASONING CONVERGENCE R1 — DETERMINISTIC COMPUTATION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * "A 400 V three-phase motor draws 32 A at a power factor of 0.84 and efficiency of 91%.
 * Estimate its mechanical output power and show the calculation." was sent to NEWS. A number is
 * not news, and a language model is not a calculator: the numerical result is owned HERE,
 * deterministically, from the values the reader supplied.
 *
 * BOUNDED BY DESIGN. Only formulas whose every input the reader stated are evaluated:
 *
 *   three-phase power     P_in = √3 · V_LL · I · PF      P_out = η · P_in
 *   single-phase AC power P = V · I · PF                   (P_out = η · P when η is given)
 *   DC power              P = V · I
 *   battery energy        E = V · Ah                       (Wh → kWh)
 *   percentage            p % of x
 *   arithmetic            + − × ÷ ^ and parentheses over literal numbers (a parser, never eval)
 *
 * A missing parameter is REPORTED, never assumed: a three-phase power question without a power
 * factor returns { missing: ['power factor'] }, and the plan stays unanswerable. Nothing outside
 * these shapes is attempted; `undefined` means "not a computation this engine owns".
 */

export interface ComputationQuantity {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  /** The reader's own words the value was read from. */
  readonly quoted: string;
}

export interface ComputationStep {
  readonly label: string;
  /** The formula with the reader's numbers substituted. */
  readonly expression: string;
  readonly value: number;
  readonly unit: string;
}

export interface ComputationResult {
  readonly kind:
    | 'THREE_PHASE_POWER'
    | 'SINGLE_PHASE_POWER'
    | 'DC_POWER'
    | 'BATTERY_ENERGY'
    | 'PERCENTAGE'
    | 'ARITHMETIC';
  readonly inputs: readonly ComputationQuantity[];
  readonly steps: readonly ComputationStep[];
  readonly result: { readonly name: string; readonly value: number; readonly unit: string };
  /** Stated, standard conventions the formula relies on (never an invented value). */
  readonly conventions: readonly string[];
}

export type ComputationOutcome =
  | { readonly status: 'SOLVED'; readonly result: ComputationResult }
  | {
      readonly status: 'MISSING_INPUTS';
      readonly kind: ComputationResult['kind'];
      readonly missing: readonly string[];
    };

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;

function num(raw: string): number {
  return Number(raw.replace(',', '.'));
}

function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function quantity(
  text: string,
  pattern: RegExp,
  name: string,
  unit: string,
  scale = 1,
): ComputationQuantity | undefined {
  const m = text.match(pattern);
  if (!m?.[1]) return undefined;
  return { name, value: num(m[1]) * scale, unit, quoted: m[0].trim() };
}

function voltage(text: string): ComputationQuantity | undefined {
  return (
    quantity(text, new RegExp(String.raw`${NUM}\s*kV\b`, 'i'), 'voltage', 'V', 1000) ??
    quantity(text, new RegExp(String.raw`${NUM}\s*(?:V|volts?)\b`, 'i'), 'voltage', 'V')
  );
}

function current(text: string): ComputationQuantity | undefined {
  return (
    quantity(text, new RegExp(String.raw`${NUM}\s*kA\b`, 'i'), 'current', 'A', 1000) ??
    quantity(text, new RegExp(String.raw`${NUM}\s*mA\b`, 'i'), 'current', 'A', 0.001) ??
    quantity(
      text,
      new RegExp(String.raw`${NUM}\s*(?:A|amps?|amperes?)\b(?!h)`, 'i'),
      'current',
      'A',
    )
  );
}

function powerFactor(text: string): ComputationQuantity | undefined {
  return quantity(
    text,
    new RegExp(
      String.raw`(?:power\s+factor|\bPF|cos\s*φ|cos\s*phi)\s*(?:of|=|:|is)?\s*(0?[.,]\d+|1(?:[.,]0+)?)`,
      'i',
    ),
    'power factor',
    '',
  );
}

function efficiency(text: string): ComputationQuantity | undefined {
  const pct =
    text.match(new RegExp(String.raw`efficiency\s*(?:of|=|:|is)?\s*${NUM}\s*%`, 'i')) ??
    text.match(new RegExp(String.raw`${NUM}\s*%\s*efficien`, 'i'));
  if (pct?.[1])
    return { name: 'efficiency', value: num(pct[1]) / 100, unit: '', quoted: pct[0].trim() };
  const frac = text.match(/efficiency\s*(?:of|=|:|is)?\s*(0?[.,]\d+)\b/i);
  if (frac?.[1])
    return { name: 'efficiency', value: num(frac[1]), unit: '', quoted: frac[0].trim() };
  return undefined;
}

function ampHours(text: string): ComputationQuantity | undefined {
  return (
    quantity(text, new RegExp(String.raw`${NUM}\s*mAh\b`, 'i'), 'capacity', 'Ah', 0.001) ??
    quantity(text, new RegExp(String.raw`${NUM}\s*Ah\b`, 'i'), 'capacity', 'Ah')
  );
}

/* ── a tiny safe arithmetic parser (recursive descent; no eval, no identifiers) ─────────── */
function evaluateArithmetic(expression: string): number | undefined {
  const src = expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
  if (!/^[\d.+\-*/^()]+$/.test(src) || !/\d/.test(src)) return undefined;
  let i = 0;
  const peek = () => src[i];
  const parsePrimary = (): number => {
    if (peek() === '(') {
      i += 1;
      const v = parseSum();
      if (peek() !== ')') throw new Error('paren');
      i += 1;
      return v;
    }
    if (peek() === '-') {
      i += 1;
      return -parsePrimary();
    }
    const m = src.slice(i).match(/^\d+(?:\.\d+)?/);
    if (!m) throw new Error('number');
    i += m[0].length;
    return Number(m[0]);
  };
  const parsePower = (): number => {
    const base = parsePrimary();
    if (peek() === '^') {
      i += 1;
      return base ** parsePower();
    }
    return base;
  };
  const parseProduct = (): number => {
    let v = parsePower();
    while (peek() === '*' || peek() === '/') {
      const op = src[i];
      i += 1;
      const rhs = parsePower();
      v = op === '*' ? v * rhs : v / rhs;
    }
    return v;
  };
  const parseSum = (): number => {
    let v = parseProduct();
    while (peek() === '+' || peek() === '-') {
      const op = src[i];
      i += 1;
      const rhs = parseProduct();
      v = op === '+' ? v + rhs : v - rhs;
    }
    return v;
  };
  try {
    const v = parseSum();
    return i === src.length && Number.isFinite(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

const POWER_ASKED = /\b(?:power|output|input|kW|watts?|how\s+much\s+power)\b/i;

export function solveComputation(question: string): ComputationOutcome | undefined {
  const text = question.replace(/\s+/g, ' ');

  /* three-phase power (and output via efficiency) */
  if (/\b(?:three|3)[\s-]?phase\b/i.test(text) && POWER_ASKED.test(text)) {
    const v = voltage(text);
    const i = current(text);
    const pf = powerFactor(text);
    const eta = efficiency(text);
    const missing = [
      v ? null : 'line voltage',
      i ? null : 'line current',
      pf ? null : 'power factor',
    ].filter((m): m is string => m !== null);
    const wantsOutput = /\b(?:output|mechanical|shaft)\b/i.test(text);
    if (wantsOutput && !eta) missing.push('efficiency');
    if (missing.length > 0) return { status: 'MISSING_INPUTS', kind: 'THREE_PHASE_POWER', missing };
    const pin = Math.sqrt(3) * v!.value * i!.value * pf!.value;
    const steps: ComputationStep[] = [
      {
        label: 'Electrical input power',
        expression: `P_in = √3 × ${v!.value} V × ${i!.value} A × ${pf!.value}`,
        value: round(pin / 1000, 2),
        unit: 'kW',
      },
    ];
    let result = { name: 'electrical input power', value: round(pin / 1000, 2), unit: 'kW' };
    if (eta) {
      const pout = eta.value * pin;
      steps.push({
        label: 'Mechanical output power',
        expression: `P_out = ${eta.value} × ${round(pin / 1000, 2)} kW`,
        value: round(pout / 1000, 2),
        unit: 'kW',
      });
      result = { name: 'mechanical output power', value: round(pout / 1000, 2), unit: 'kW' };
    }
    return {
      status: 'SOLVED',
      result: {
        kind: 'THREE_PHASE_POWER',
        inputs: [v!, i!, pf!, ...(eta ? [eta] : [])],
        steps,
        result,
        conventions: [
          'The stated voltage is taken as the line-to-line voltage and the stated current as the line current of a balanced three-phase supply.',
          ...(eta ? ['Efficiency = mechanical output power ÷ electrical input power.'] : []),
        ],
      },
    };
  }

  /* battery energy: V × Ah */
  const ah = ampHours(text);
  if (ah && /\b(?:energy|stored|capacity|kwh|wh)\b/i.test(text)) {
    const v = voltage(text);
    if (!v)
      return { status: 'MISSING_INPUTS', kind: 'BATTERY_ENERGY', missing: ['nominal voltage'] };
    const wh = v.value * ah.value;
    return {
      status: 'SOLVED',
      result: {
        kind: 'BATTERY_ENERGY',
        inputs: [v, ah],
        steps: [
          {
            label: 'Stored energy',
            expression: `E = ${v.value} V × ${ah.value} Ah`,
            value: round(wh, 2),
            unit: 'Wh',
          },
          {
            label: 'In kilowatt-hours',
            expression: `${round(wh, 2)} Wh ÷ 1000`,
            value: round(wh / 1000, 3),
            unit: 'kWh',
          },
        ],
        result: { name: 'stored energy (nominal)', value: round(wh / 1000, 3), unit: 'kWh' },
        conventions: [
          'Nominal energy at the stated nominal voltage; usable energy depends on depth of discharge.',
        ],
      },
    };
  }

  /* single-phase AC / DC power */
  if (POWER_ASKED.test(text)) {
    const v = voltage(text);
    const i = current(text);
    if (v && i) {
      const pf = powerFactor(text);
      const eta = efficiency(text);
      const singlePhase = /\bsingle[\s-]?phase\b|\bAC\b/i.test(text);
      if (singlePhase && !pf) {
        return { status: 'MISSING_INPUTS', kind: 'SINGLE_PHASE_POWER', missing: ['power factor'] };
      }
      const p = v.value * i.value * (pf?.value ?? 1);
      const steps: ComputationStep[] = [
        {
          label: singlePhase ? 'Real power' : 'Power',
          expression: singlePhase
            ? `P = ${v.value} V × ${i.value} A × ${pf!.value}`
            : `P = ${v.value} V × ${i.value} A`,
          value: round(p / 1000, 3),
          unit: 'kW',
        },
      ];
      let result = { name: 'power', value: round(p / 1000, 3), unit: 'kW' };
      if (eta) {
        steps.push({
          label: 'Output power',
          expression: `P_out = ${eta.value} × ${round(p / 1000, 3)} kW`,
          value: round((eta.value * p) / 1000, 3),
          unit: 'kW',
        });
        result = { name: 'output power', value: round((eta.value * p) / 1000, 3), unit: 'kW' };
      }
      return {
        status: 'SOLVED',
        result: {
          kind: singlePhase ? 'SINGLE_PHASE_POWER' : 'DC_POWER',
          inputs: [v, i, ...(pf ? [pf] : []), ...(eta ? [eta] : [])],
          steps,
          result,
          conventions: singlePhase
            ? []
            : ['Treated as a DC (or unity power factor) load because no power factor was stated.'],
        },
      };
    }
  }

  /* percentage: "p% of x" */
  const pct = text.match(new RegExp(String.raw`${NUM}\s*%\s+of\s+${NUM}`, 'i'));
  if (pct?.[1] && pct[2]) {
    const value = (num(pct[1]) / 100) * num(pct[2]);
    return {
      status: 'SOLVED',
      result: {
        kind: 'PERCENTAGE',
        inputs: [
          { name: 'percentage', value: num(pct[1]), unit: '%', quoted: `${pct[1]}%` },
          { name: 'base', value: num(pct[2]), unit: '', quoted: pct[2] },
        ],
        steps: [
          {
            label: 'Percentage',
            expression: `${pct[1]} ÷ 100 × ${pct[2]}`,
            value: round(value, 4),
            unit: '',
          },
        ],
        result: { name: 'value', value: round(value, 4), unit: '' },
        conventions: [],
      },
    };
  }

  /* pure arithmetic: "calculate (3 + 4) × 2" */
  const arithmetic = text.match(
    /(?:calculate|compute|evaluate|what\s+is|work\s+out)\s+([\d\s.+\-*/^()×÷]+)\??$/i,
  );
  if (arithmetic?.[1] && /[+\-*/^×÷]/.test(arithmetic[1])) {
    const value = evaluateArithmetic(arithmetic[1]);
    if (value !== undefined) {
      return {
        status: 'SOLVED',
        result: {
          kind: 'ARITHMETIC',
          inputs: [],
          steps: [
            {
              label: 'Evaluate',
              expression: arithmetic[1].trim(),
              value: round(value, 6),
              unit: '',
            },
          ],
          result: { name: 'value', value: round(value, 6), unit: '' },
          conventions: [],
        },
      };
    }
  }

  return undefined;
}
