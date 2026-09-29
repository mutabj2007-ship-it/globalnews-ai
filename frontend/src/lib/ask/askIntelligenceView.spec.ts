import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AskContribution, AskR2Payload } from '@/lib/api/askV2Api';
import { AskIntelligenceBasis } from '@/components/ask-frame/AskIntelligenceBasis';
import { askContinuityStrings } from './askContinuityStrings';
import { askIntelligenceView } from './askIntelligenceView';

/** ASK INTELLIGENCE BINDING R1 — the governed "Based on" projection of one answer. */

const observation = (over: Partial<AskContribution['observations'][number]> = {}) => ({
  reference: 'UCDP_GED:9102',
  kind: 'EVENT_TYPE_NOT_CLASSIFIED',
  label: null,
  value: null,
  unit: null,
  period: '2026-08-10',
  geography: 'COD',
  source: { name: 'UCDP Candidate Events Dataset', url: 'https://ucdp.uu.se', licence: null },
  retainedAt: '2026-09-24T12:00:00Z',
  ...over,
});

const contribution = (over: Partial<AskContribution>): AskContribution => ({
  contributorId: 'CONFLICT',
  domain: 'security',
  status: 'USED',
  applicability: 'SUPPLEMENTARY',
  observations: [observation()],
  temporalBasis: 'RETAINED_EVENT_RECORD',
  geographyBasis: 'COD',
  disclosures: ['RETAINED_NOT_CURRENT', 'SEVERITY_NOT_ASSESSED'],
  degradationReason: null,
  ...over,
});

const payload = (contributions: AskContribution[] | null): AskR2Payload =>
  ({
    schema: 'ask-r2-result/1',
    intelligence:
      contributions === null
        ? null
        : { considered: contributions.map((c) => c.contributorId), contributions },
  }) as unknown as AskR2Payload;

describe('askIntelligenceView — governed basis of one answer', () => {
  it('shows nothing when no contributor was considered', () => {
    expect(askIntelligenceView(payload(null), 'en', 3)).toBeNull();
    expect(askIntelligenceView(payload([]), 'en', 3)).toBeNull();
  });

  it('"Based on" lists current reports only when cited, and only contributors that were USED', () => {
    const view = askIntelligenceView(
      payload([
        contribution({}),
        contribution({
          contributorId: 'MARKET_PROCUREMENT',
          domain: 'economic',
          status: 'NO_MATCH',
          observations: [],
          temporalBasis: 'RETAINED_PUBLICATION',
          disclosures: [],
        }),
      ]),
      'en',
      2,
    )!;
    expect(view.basedOn).toEqual([
      'Current reports',
      'Conflict Intelligence (retained UCDP event records)',
    ]);
    expect(view.sections).toHaveLength(1);
    expect(view.sections[0].note).toMatch(/not current reporting/);
    expect(view.sections[0].caveats).toContain('Severity is not assessed from these records.');
    expect(view.notes).toEqual([
      'Retained EU procurement notices (TED): No governed record matched this question’s scope — this is not evidence that nothing happened.',
    ]);
    expect(askIntelligenceView(payload([contribution({})]), 'en', 0)!.basedOn).toEqual([
      'Conflict Intelligence (retained UCDP event records)',
    ]);
  });

  it('a USED contributor with zero observations is never listed as a basis', () => {
    const view = askIntelligenceView(payload([contribution({ observations: [] })]), 'en', 0)!;
    expect(view.basedOn).toBeNull();
    expect(view.sections).toEqual([]);
  });

  it('Humanitarian NOT_ASSESSED is a disclosed note, never a basis', () => {
    const view = askIntelligenceView(
      payload([
        contribution({
          contributorId: 'HUMANITARIAN',
          domain: 'humanitarian',
          status: 'NOT_ASSESSED',
          observations: [],
          temporalBasis: 'NONE',
          disclosures: ['HUMANITARIAN_NOT_ASSESSED', 'NO_GOVERNED_OBSERVATION_READER'],
        }),
      ]),
      'pl',
      1,
    )!;
    expect(view.basedOn).toEqual(['Bieżące doniesienia']);
    expect(view.notes[0]).toMatch(/^Wywiad humanitarny: nie oceniono/);
  });

  it('Imihigo: district score row, Kigali aggregate never assigned, geography is context only', () => {
    const used = askIntelligenceView(
      payload([
        contribution({
          contributorId: 'GEOGRAPHY',
          domain: 'geography',
          applicability: 'CONTEXT',
          observations: [
            observation({
              reference: 'nisr:district:56',
              kind: 'NISR_DISTRICT',
              label: 'Ngoma, Eastern Province',
            }),
          ],
          temporalBasis: 'REFERENCE_GEOGRAPHY',
          disclosures: ['CONTEXT_NOT_EVIDENCE'],
        }),
        contribution({
          contributorId: 'IMIHIGO',
          domain: 'governance',
          observations: [
            observation({
              reference: 'abc123def456:ngoma',
              kind: 'IMIHIGO_DISTRICT_FINAL_SCORE',
              label: 'Ngoma',
              value: '77.2',
              unit: '%',
              period: '2024/2025',
              geography: 'nisr:district:56',
            }),
          ],
          temporalBasis: 'RETAINED_EVALUATION_CYCLE',
          disclosures: ['RETAINED_NOT_CURRENT', 'CLOSED_EVALUATION_CYCLE'],
        }),
      ]),
      'en',
      0,
    )!;
    expect(used.basedOn).toEqual(['Retained NISR Imihigo evaluation']);
    expect(used.place).toBe('Ngoma, Eastern Province (NISR)');
    expect(used.sections[0].rows[0]).toMatchObject({ value: '77.2 %', period: '2024/2025' });
    expect(used.sections[0].note).toMatch(/closed cycle/);

    const gasabo = askIntelligenceView(
      payload([
        contribution({
          contributorId: 'IMIHIGO',
          domain: 'governance',
          status: 'NO_MATCH',
          observations: [],
          temporalBasis: 'RETAINED_EVALUATION_CYCLE',
          disclosures: ['AGGREGATE_NOT_ASSIGNED_TO_DISTRICT'],
        }),
      ]),
      'en',
      0,
    )!;
    expect(gasabo.basedOn).toBeNull();
    expect(gasabo.notes).toEqual([
      'No individual NISR Imihigo record exists for this district; the City of Kigali aggregate is not assigned to its districts.',
    ]);
  });

  it('caps rows per contributor', () => {
    const many = Array.from({ length: 9 }, (_, i) => observation({ reference: `UCDP_GED:${i}` }));
    const view = askIntelligenceView(payload([contribution({ observations: many })]), 'en', 0)!;
    expect(view.sections[0].rows).toHaveLength(5);
  });

  it('renders inside the turn with stable hooks and no Map/module links', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(AskIntelligenceBasis, {
          payload: payload([contribution({})]),
          locale: 'en',
          reportingSourceCount: 1,
        }),
      );
    });
    const byData = (name: string) =>
      renderer.root.findAll((n) => typeof n.type === 'string' && n.props['data-ask'] === name);
    expect(byData('intelligence')).toHaveLength(1);
    expect(byData('based-on')).toHaveLength(1);
    expect(byData('intelligence-row')).toHaveLength(1);
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('Based on: Current reports · Conflict Intelligence');
    expect(text).not.toMatch(/\/map|\/conflict|\/dashboard/);
  });

  it('a retained source URL reaches an href only through safeExternalHref', () => {
    const render = (url: string) => {
      let renderer!: ReactTestRenderer;
      act(() => {
        renderer = create(
          createElement(AskIntelligenceBasis, {
            payload: payload([
              contribution({
                observations: [observation({ source: { name: 'UCDP', url, licence: null } })],
              }),
            ]),
            locale: 'en',
            reportingSourceCount: 0,
          }),
        );
      });
      return renderer.root.findAll((n) => n.type === 'a').map((n) => n.props.href as string);
    };
    expect(render('https://ucdp.uu.se')).toEqual(['https://ucdp.uu.se/']);
    expect(render('javascript:alert(1)')).toEqual([]);
  });
});

describe('Ask continuity — localized operation state (contract §11)', () => {
  it('PL never shows the raw COMPLETED code', () => {
    expect(askContinuityStrings('pl').operationStates.COMPLETED).toBe('UKOŃCZONO');
    for (const value of Object.values(askContinuityStrings('pl').operationStates))
      expect(value).not.toMatch(/^[A-Z]+ED$|^RUNNING$/);
    expect(askContinuityStrings('en').operationStates.COMPLETED).toBe('COMPLETED');
  });
});
