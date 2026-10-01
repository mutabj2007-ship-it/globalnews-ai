import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import type { AskR2Payload } from '@/lib/api/askV2Api';
import { AskR2TurnView } from '@/components/ask-frame/AskR2TurnView';

/**
 * PUBLIC BETA HARDENING R1A — a deterministic COMPUTED_RESULT drew its calculation card AND,
 * underneath it, the generic Answer container with nothing in it (Production, 2026-10-01:
 * "A 400 V three-phase motor draws 32 A …" → 16.95 kW). One answer surface per answer: the
 * calculation card IS the answer. Every other answer state keeps its answer surface exactly.
 */

const MOTOR_Q =
  'A 400 V three-phase motor draws 32 A at a power factor of 0.84 and efficiency of 91%. Estimate its mechanical output power and show the calculation.';

const COMPUTATION = {
  kind: 'THREE_PHASE_MOTOR_OUTPUT',
  inputs: [
    { name: 'V', value: 400, unit: 'V', quoted: '400 V' },
    { name: 'I', value: 32, unit: 'A', quoted: '32 A' },
    { name: 'PF', value: 0.84, unit: '', quoted: 'power factor of 0.84' },
    { name: 'η', value: 0.91, unit: '', quoted: 'efficiency of 91%' },
  ],
  steps: [
    {
      label: 'electrical input power',
      expression: 'P_in = √3 × 400 V × 32 A × 0.84',
      value: 18.62,
      unit: 'kW',
    },
    {
      label: 'mechanical output power',
      expression: 'P_out = 0.91 × 18.62 kW',
      value: 16.95,
      unit: 'kW',
    },
  ],
  result: { name: 'mechanical output power', value: 16.95, unit: 'kW' },
  conventions: ['Line-to-line voltage; balanced three-phase load.'],
};

const ANALYSIS = {
  query: 'q',
  analysis: {
    summary: 'Fighting between M23 and the army displaced families near Goma.',
    generatedAt: '2026-10-01T04:00:00Z',
  },
  articles: [],
  retrievalContext: { dataMode: 'live', providers: ['gnews'] },
  provenance: {
    provider: 'openai',
    executionMode: 'production',
    analysisMode: 'live-ai',
    status: 'success',
    cached: false,
  },
} as unknown as AnalysisApiResponse;

function payload(
  state: string,
  over: Partial<Record<'analysis' | 'background' | 'computation', unknown>> = {},
  questionClass = 'CURRENT_REPORTING',
): AskR2Payload {
  return {
    schema: 'ask-r2-result/1',
    route: {
      questionClass,
      terminalState:
        questionClass === 'CURRENT_REPORTING' ? 'EXECUTABLE' : 'REFERENCE_BACKGROUND_ONLY',
      scopedBy: 'NONE',
      refusals: [],
      disclosures: [],
      clarification: [],
      normalization: 'QUALIFIED',
      questionLanguage: 'en',
    },
    chips: { kind: 'NONE' },
    answer: { state, basis: 'TEST', missingRoles: [] },
    checkedAt: '2026-10-01T04:00:00Z',
    aiExecuted: state !== 'COMPUTED_RESULT' && state !== 'INSUFFICIENT',
    modelPriorCitable: false,
    analysis: null,
    background: null,
    intelligence: null,
    ...over,
  } as unknown as AskR2Payload;
}

function render(p: AskR2Payload, locale: 'en' | 'pl' = 'en', question = 'Q?'): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      createElement(AskR2TurnView, {
        turn: { question, payload: p } as never,
        locale,
        context: undefined,
      }),
    );
  });
  return r;
}
const byData = (r: ReactTestRenderer, name: string) =>
  r.root.findAll((n) => typeof n.type === 'string' && n.props['data-ask'] === name);
/** The answer surfaces a reader sees: the generic Answer container and the calculation card. */
const answerSurfaces = (r: ReactTestRenderer) => [
  ...byData(r, 'answer'),
  ...byData(r, 'computation'),
];
const visibleText = (r: ReactTestRenderer): string => {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node !== null && typeof node === 'object')
      walk((node as { children?: unknown }).children);
  };
  walk(r.toJSON());
  return out.join(' ');
};

describe('PUBLIC BETA HARDENING R1A — COMPUTED_RESULT renders exactly one answer surface', () => {
  it.each(['en', 'pl'] as const)(
    '%s: the calculation card is the one answer surface — no empty Answer shell beneath it',
    (locale) => {
      const r = render(
        payload('COMPUTED_RESULT', { computation: COMPUTATION }, 'COMPUTATION'),
        locale,
        MOTOR_Q,
      );
      expect(answerSurfaces(r)).toHaveLength(1);
      expect(byData(r, 'computation')).toHaveLength(1);
      expect(byData(r, 'answer')).toHaveLength(0);
    },
  );

  it('the calculation itself is unchanged: result, inputs, formulas and steps', () => {
    const r = render(
      payload('COMPUTED_RESULT', { computation: COMPUTATION }, 'COMPUTATION'),
      'en',
      MOTOR_Q,
    );
    const text = visibleText(r);
    expect(text).toMatch(/mechanical output power\s*:\s*16\.95\s+kW/);
    expect(byData(r, 'computation-inputs')[0]!.findAllByType('li')).toHaveLength(4);
    const steps = byData(r, 'computation-steps')[0]!.findAllByType('li');
    expect(steps).toHaveLength(2);
    expect(text).toContain('P_in = √3 × 400 V × 32 A × 0.84');
    expect(text).toContain('P_out = 0.91 × 18.62 kW');
    expect(text).toContain('Line-to-line voltage; balanced three-phase load.');
    /* zero sources, zero news: no reporting, no background, no citable-sources line */
    expect(byData(r, 'background-text')).toHaveLength(0);
    expect(byData(r, 'no-citable')).toHaveLength(0);
    expect(byData(r, 'open-full-analysis')).toHaveLength(0);
    expect(byData(r, 'run-deeper')).toHaveLength(0);
  });

  it('CURRENT_REPORTING still renders its one Answer surface with the reporting analysis', () => {
    const r = render(payload('CURRENT_REPORTING', { analysis: ANALYSIS }));
    expect(answerSurfaces(r)).toHaveLength(1);
    expect(byData(r, 'answer')).toHaveLength(1);
    expect(byData(r, 'computation')).toHaveLength(0);
    expect(visibleText(r)).toContain(
      'Fighting between M23 and the army displaced families near Goma.',
    );
  });

  it('REFERENCE_BACKGROUND is unchanged: one Answer surface with its note and background text', () => {
    const r = render(
      payload(
        'REFERENCE_BACKGROUND',
        { background: { text: 'TCP is connection-oriented; UDP is connectionless.' } },
        'REFERENCE',
      ),
    );
    expect(answerSurfaces(r)).toHaveLength(1);
    expect(byData(r, 'answer')).toHaveLength(1);
    expect(byData(r, 'reference-note')).toHaveLength(1);
    expect(byData(r, 'background-text')[0]!.props.children).toBe(
      'TCP is connection-oriented; UDP is connectionless.',
    );
  });

  it('INSUFFICIENT is unchanged: one Answer surface carrying its title', () => {
    const r = render(payload('INSUFFICIENT'));
    expect(answerSurfaces(r)).toHaveLength(1);
    const [answer] = byData(r, 'answer');
    expect(answer).toBeDefined();
    expect(visibleText(r)).toMatch(/\S/);
    expect(answer!.findAllByType('p').length).toBeGreaterThanOrEqual(2);
  });
});
