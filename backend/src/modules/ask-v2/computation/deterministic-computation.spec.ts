import { solveComputation } from './deterministic-computation';
import { deriveKnowledgeRequirement } from '../../ask-router/knowledge-requirement';

/**
 * ASK TECHNICAL / SCIENTIFIC REASONING CONVERGENCE R1 — the deterministic engine owns the number;
 * the knowledge-requirement axis decides what kind of execution a question needs.
 */
describe('deterministic computation', () => {
  it('three-phase motor: P_in = √3·V·I·PF ≈ 18.62 kW, P_out = η·P_in ≈ 16.95 kW', () => {
    const outcome = solveComputation(
      'A 400 V three-phase motor draws 32 A at a power factor of 0.84 and efficiency of 91%. Estimate its mechanical output power and show the calculation.',
    );
    expect(outcome?.status).toBe('SOLVED');
    if (outcome?.status !== 'SOLVED') return;
    expect(outcome.result.inputs.map((i) => [i.name, i.value])).toEqual([
      ['voltage', 400],
      ['current', 32],
      ['power factor', 0.84],
      ['efficiency', 0.91],
    ]);
    expect(outcome.result.steps).toEqual([
      expect.objectContaining({
        expression: 'P_in = √3 × 400 V × 32 A × 0.84',
        value: 18.62,
        unit: 'kW',
      }),
      expect.objectContaining({ expression: 'P_out = 0.91 × 18.62 kW', value: 16.95, unit: 'kW' }),
    ]);
  });

  it('never invents a parameter: missing power factor / efficiency are reported', () => {
    expect(
      solveComputation(
        'A 400 V three-phase motor draws 32 A. Estimate its mechanical output power.',
      ),
    ).toEqual({
      status: 'MISSING_INPUTS',
      kind: 'THREE_PHASE_POWER',
      missing: ['power factor', 'efficiency'],
    });
  });

  it('battery energy, kV / mA scaling, percentage and safe arithmetic', () => {
    const battery = solveComputation('Calculate the energy stored in a 48 V 100 Ah battery.');
    expect(battery?.status === 'SOLVED' && battery.result.result).toEqual({
      name: 'stored energy (nominal)',
      value: 4.8,
      unit: 'kWh',
    });
    const hv = solveComputation(
      'What is the input power of a 11 kV three-phase feeder carrying 100 A at power factor 0.9?',
    );
    expect(hv?.status === 'SOLVED' && hv.result.result.value).toBe(1714.73);
    const pct = solveComputation('What is 15% of 240?');
    expect(pct?.status === 'SOLVED' && pct.result.result.value).toBe(36);
    const arithmetic = solveComputation('Calculate (3 + 4) * 2 ^ 3');
    expect(arithmetic?.status === 'SOLVED' && arithmetic.result.result.value).toBe(56);
  });

  it('nothing but literal arithmetic is ever evaluated', () => {
    expect(solveComputation('Calculate process.exit(1)')).toBeUndefined();
    expect(solveComputation('Calculate 2 + constructor')).toBeUndefined();
    expect(solveComputation('Explain how a transformer works.')).toBeUndefined();
  });
});

describe('the knowledge-requirement axis (orthogonal to domain)', () => {
  it.each([
    ['What is the difference between TCP and UDP?', 'STABLE_REFERENCE'],
    ['Why does a heat pump have a COP above 1?', 'STABLE_REFERENCE'],
    ["Why does increasing a pipe's diameter reduce pressure loss?", 'STABLE_REFERENCE'],
    ['Explain how lithium-ion batteries work.', 'STABLE_REFERENCE'],
    ['Calculate the energy stored in a 48 V 100 Ah battery.', 'COMPUTATION'],
    ['What is the current price of lithium carbonate?', 'CURRENT_REPORTING'],
    ['What changed today in lithium-ion battery safety regulation?', 'CURRENT_REPORTING'],
    ['Why is the dollar falling?', 'MIXED_REFERENCE_CURRENT'],
    ['Compare TCP adoption trends in 2026 enterprise networks', 'CURRENT_REPORTING'],
    ['What does the latest IEC battery-safety standard require?', 'OFFICIAL_REFERENCE'],
    ['What does IEC 61850-9-2 specify in the current edition?', 'OFFICIAL_REFERENCE'],
  ])('%s → %s', (question, expected) => {
    expect(deriveKnowledgeRequirement(question, 'en').requirement).toBe(expected);
  });

  it('English and Polish are mirrored so EN/PL twins route identically', () => {
    expect(deriveKnowledgeRequirement('Czym jest TCP?', 'pl').requirement).toBe('STABLE_REFERENCE');
    expect(
      deriveKnowledgeRequirement('Jaka jest sytuacja na granicy dzisiaj?', 'pl').requirement,
    ).toBe('CURRENT_REPORTING');
    expect(deriveKnowledgeRequirement('Czym jest TCP?', 'de').requirement).toBeNull();
  });
});
