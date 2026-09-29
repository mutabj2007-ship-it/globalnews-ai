import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AskContribution, AskR2Payload } from '@/lib/api/askV2Api';
import { AskR2TurnView } from '@/components/ask-frame/AskR2TurnView';
import { ASK_SAVABLE_ANSWER_STATES } from '@/components/ask-frame/AskTurnSave';
import { askR2Strings } from './askR2Strings';
import { askR2View } from './askR2View';
import { askIntelligenceView } from './askIntelligenceView';

/**
 * ASK INTELLIGENCE BINDING — LIVE ACCEPTANCE REPAIR R1: what the reader sees for the live
 * G1–G9 failures, decided by the pure views and drawn by the real turn component.
 */

const obs = (over: Partial<AskContribution['observations'][number]> = {}) => ({
  reference: 'r1',
  kind: 'EVENT_TYPE_NOT_CLASSIFIED',
  label: null,
  value: null,
  unit: null,
  period: '2026-08-31',
  geography: 'COD',
  source: { name: 'UCDP — Uppsala Conflict Data Program', url: null, licence: null },
  retainedAt: '2026-09-24T12:00:00Z',
  ...over,
});
const contribution = (over: Partial<AskContribution>): AskContribution => ({
  contributorId: 'CONFLICT',
  domain: 'security',
  status: 'USED',
  applicability: 'SUPPLEMENTARY',
  observations: [obs()],
  temporalBasis: 'RETAINED_EVENT_RECORD',
  geographyBasis: 'COD',
  disclosures: [],
  degradationReason: null,
  ...over,
});
const payload = (
  state: string,
  basis: string,
  contributions: AskContribution[] | null,
): AskR2Payload =>
  ({
    schema: 'ask-r2-result/1',
    route: {
      questionClass: 'CURRENT_REPORTING',
      terminalState: 'EXECUTABLE',
      scopedBy: 'TYPED_GEOGRAPHY',
      refusals: [],
      disclosures: [],
      clarification: [],
      normalization: 'QUALIFIED',
      questionLanguage: 'en',
    },
    chips: { kind: 'NONE' },
    answer: { state, basis, missingRoles: [] },
    checkedAt: '2026-09-29T20:00:00Z',
    aiExecuted: false,
    modelPriorCitable: false,
    analysis: null,
    background: null,
    intelligence:
      contributions === null
        ? null
        : { considered: contributions.map((c) => c.contributorId), contributions },
  }) as unknown as AskR2Payload;

const ngoma = contribution({
  contributorId: 'IMIHIGO',
  domain: 'governance',
  temporalBasis: 'RETAINED_EVALUATION_CYCLE',
  observations: [
    obs({
      kind: 'IMIHIGO_DISTRICT_FINAL_SCORE',
      label: 'Ngoma',
      value: '77.2',
      unit: '%',
      period: '2024/2025',
      geography: 'nisr:district:56',
    }),
  ],
  disclosures: ['RETAINED_NOT_CURRENT', 'CLOSED_EVALUATION_CYCLE'],
});
const gasabo = contribution({
  contributorId: 'IMIHIGO',
  domain: 'governance',
  status: 'NO_MATCH',
  observations: [],
  temporalBasis: 'RETAINED_EVALUATION_CYCLE',
  disclosures: ['AGGREGATE_NOT_ASSIGNED_TO_DISTRICT'],
});

function render(p: AskR2Payload | null, failure?: string): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      createElement(AskR2TurnView, {
        turn: {
          question: 'Q?',
          ...(p === null ? {} : { payload: p }),
          ...(failure ? { failure } : {}),
        } as never,
        locale: 'en',
        context: undefined,
      }),
    );
  });
  return r;
}
const byData = (r: ReactTestRenderer, name: string) =>
  r.root.findAll((n) => typeof n.type === 'string' && n.props['data-ask'] === name);
const textOf = (r: ReactTestRenderer) => JSON.stringify(r.toJSON());

describe('A — a retained-record answer (G2, G3, G4, G9): zero AI, stated truthfully', () => {
  it('RETAINED_RECORD is its own badge and tone, says no AI was used, and offers no compute hand-off', () => {
    const v = askR2View(
      payload('RETAINED_RECORD', 'GOVERNED_RECORD', [ngoma]),
      askR2Strings('en'),
      'en',
      (x) => x,
    );
    expect(v.badge).toBe('rec');
    expect(v.badgeText).toBe('RETAINED RECORD');
    expect(v.tone).toBe('retained');
    expect(v.freshness).toBe('Retained record · not current · no AI used');
    expect(v.handoffs).toEqual({ openFull: false, runDeeper: false });
    expect(askR2Strings('pl').badges.rec).toBe('ZACHOWANY ZAPIS');
    expect(ASK_SAVABLE_ANSWER_STATES.has('RETAINED_RECORD')).toBe(true);
  });

  it('G3 Ngoma: the lead restates the governed record verbatim — 77.2%, 2024/2025, closed cycle', () => {
    const r = render(payload('RETAINED_RECORD', 'GOVERNED_RECORD', [ngoma]));
    const lead = byData(r, 'retained-lead').map((n) => JSON.stringify(n.props.children));
    expect(lead).toHaveLength(1);
    expect(lead[0]).toContain('Ngoma: 77.2% — Imihigo 2024/2025');
    expect(lead[0]).toContain('closed cycle');
    expect(byData(r, 'retained-no-ai')).toHaveLength(1);
    expect(byData(r, 'handoffs')).toHaveLength(0);
  });

  it('G4 Gasabo: the answer is the stated absence — never a score, never the Kigali aggregate — shown once', () => {
    const r = render(payload('RETAINED_RECORD', 'GOVERNED_NO_RECORD', [gasabo]));
    const text = textOf(r);
    expect(byData(r, 'retained-lead').map((n) => n.props.children)).toEqual([
      'No individual NISR Imihigo record exists for this district; the City of Kigali aggregate is not assigned to its districts.',
    ]);
    expect(byData(r, 'intelligence-note')).toHaveLength(0);
    expect(text).not.toMatch(/\d+(\.\d+)?\s?%/);
  });

  it('G9 Rwanda CPI and G2 Poland procurement: the retained value with its period; one TED day is never a change series', () => {
    const cpi = askIntelligenceView(
      payload('RETAINED_RECORD', 'GOVERNED_RECORD', [
        contribution({
          contributorId: 'ECONOMY_CPI',
          domain: 'economic',
          temporalBasis: 'RETAINED_STATISTICAL_RELEASE',
          observations: [
            obs({
              kind: 'HEADLINE_CPI_YOY',
              label: 'Rwanda headline CPI, year on year',
              value: '15.9',
              unit: 'PERCENT',
              period: '2026-08',
            }),
          ],
          disclosures: ['RETAINED_NOT_CURRENT'],
        }),
      ]),
      'en',
      0,
    )!;
    expect(cpi.lead).toEqual([
      'Rwanda headline CPI, year on year: 15.9% for 2026-08 — a retained NISR release, not re-checked now.',
    ]);
    const ted = askIntelligenceView(
      payload('RETAINED_RECORD', 'GOVERNED_RECORD', [
        contribution({
          contributorId: 'MARKET_PROCUREMENT',
          domain: 'economic',
          temporalBasis: 'RETAINED_PUBLICATION',
          observations: [
            obs({ kind: 'cn-standard', geography: 'POL', period: '2026-09-24' }),
            obs({ reference: 'r2', geography: 'POL', period: '2026-09-24' }),
          ],
          disclosures: ['RETAINED_NOT_CURRENT', 'SNAPSHOT_NOT_CHANGE_SERIES'],
        }),
      ]),
      'en',
      0,
    )!;
    expect(ted.lead[0]).toBe(
      '2 retained TED procurement notices from buyers in POL, published on 2026-09-24. This is one retained publication day, so it cannot show procurement changes or trends.',
    );
    expect(ted.lead.join(' ')).not.toMatch(/reform|trend(?!s\.)|increase|decrease/i);
  });
});

describe('A — official unavailable (G8) and a spent budget (live G3–G9) are named truthfully', () => {
  it('G8: OFFICIAL_SOURCE_UNAVAILABLE says the official value cannot be given and reporting is not presented as official', () => {
    const r = render(payload('CAPABILITY_UNAVAILABLE', 'OFFICIAL_SOURCE_UNAVAILABLE', null));
    const [card] = byData(r, 'unavailable');
    expect(card.props.children).toMatch(/You asked for the official figure/);
    expect(card.props.children).toMatch(/news reporting is not presented as official/);
  });

  it('a BUDGET refusal is never "Ask is unavailable": it says today’s limit is reached and nothing was charged', () => {
    const [card] = byData(render(null, 'BUDGET_REFUSED:ip-day'), 'unavailable');
    expect(card.props.children).toMatch(/today’s Ask limit/);
    const [other] = byData(render(null, 'THREAD_UNAVAILABLE'), 'unavailable');
    expect(other.props.children).toBe('Ask is unavailable right now. Nothing was run.');
  });
});

describe('C — retained Conflict records as concise structured observations (G1)', () => {
  it('date · place · event · source, parties and cited outlets on their own line; the scope caveat is shown', () => {
    const view = askIntelligenceView(
      payload('CURRENT_REPORTING', 'REQUIRED_EVIDENCE_OBTAINED', [
        contribution({
          observations: [
            obs({
              kind: 'ARMED_CLASH',
              detail: {
                place: 'Beni territory, North Kivu',
                parties: ['ADF', 'Civilians'],
                headline: 'Attack near Beni',
                citedOutlets: ['Radio Okapi,2026-08-31', 'Actualite.cd,2026-09-01'],
              },
            }),
          ],
          disclosures: [
            'RETAINED_NOT_CURRENT',
            'SEVERITY_NOT_ASSESSED',
            'SUBNATIONAL_SCOPE_NOT_APPLIED',
          ],
        }),
      ]),
      'en',
      3,
    )!;
    const [row] = view.sections[0].rows;
    expect(row).toMatchObject({
      period: '2026-08-31',
      place: 'Beni territory, North Kivu',
      label: 'Armed clash — Attack near Beni',
      parties: 'ADF vs Civilians',
      cited: 'Radio Okapi,2026-08-31 · Actualite.cd,2026-09-01',
    });
    expect(view.sections[0].caveats).toContain(
      'Read at country level: the area you named is not resolved to provinces, so each record shows its own stated place.',
    );
    expect(view.lead).toEqual([]);
  });

  it('a record without retained detail shows its event type, never a raw citation string', () => {
    const view = askIntelligenceView(
      payload('CURRENT_REPORTING', 'x', [contribution({})]),
      'en',
      1,
    )!;
    expect(view.sections[0].rows[0]).toMatchObject({
      label: 'Conflict event (type not classified)',
      place: null,
      parties: null,
      cited: null,
    });
  });
});
