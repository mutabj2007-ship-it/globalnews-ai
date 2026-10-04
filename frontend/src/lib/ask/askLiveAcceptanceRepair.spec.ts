import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AskContribution, AskR2Payload } from '@/lib/api/askV2Api';
import { AskR2TurnView } from '@/components/ask-frame/AskR2TurnView';
import { ASK_SAVABLE_ANSWER_STATES } from '@/components/ask-frame/AskTurnSave';
import { askR2Strings } from './askR2Strings';
import { askR2View } from './askR2View';
import { askIntelligenceStrings, askIntelligenceView } from './askIntelligenceView';

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
      /* GAP REPAIR R1 — the retained corpus states NO unit for district final scores. */
      unit: null,
      period: '2024/2025',
      geography: 'nisr:district:56',
    }),
  ],
  disclosures: ['RETAINED_NOT_CURRENT', 'CLOSED_EVALUATION_CYCLE'],
});
const geography = (name: string) =>
  contribution({
    contributorId: 'GEOGRAPHY',
    domain: 'geography',
    applicability: 'CONTEXT',
    temporalBasis: 'REFERENCE_GEOGRAPHY',
    observations: [obs({ kind: 'NISR_DISTRICT', label: name })],
  });
const gasabo = contribution({
  contributorId: 'IMIHIGO',
  domain: 'governance',
  status: 'NO_MATCH',
  observations: [],
  temporalBasis: 'RETAINED_EVALUATION_CYCLE',
  disclosures: ['AGGREGATE_NOT_ASSIGNED_TO_DISTRICT'],
});

function render(p: AskR2Payload | null, failure?: string, question = 'Q?'): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      createElement(AskR2TurnView, {
        turn: {
          question,
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
/** Only what a reader can read: text nodes, never class names or data attributes. */
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

  /* GOVERNED ANSWER CONVERSATIONAL UX R1 — SUPERSEDED WITH UPDATED PROOF: the same governed
     facts, now voiced as a conversational answer with restrained provenance. */
  const said = (r: ReactTestRenderer) =>
    byData(r, 'governed-answer').map((n) => n.props.children as string);

  it('G3 Ngoma: a conversational answer — final Imihigo score 77.2 (no invented %), 2024/2025, closed cycle — then provenance', () => {
    const r = render(payload('RETAINED_RECORD', 'GOVERNED_RECORD', [ngoma]));
    expect(said(r)).toEqual([
      'Ngoma’s final Imihigo score for the 2024/2025 cycle was 77.2. This comes from the retained NISR final evaluation for that closed cycle, so it describes that evaluation period rather than the district’s current situation.',
    ]);
    expect(byData(r, 'governed-provenance')[0].props.children).toBe(
      'Retained record · NISR · 2024/2025 · No AI used',
    );
    expect(textOf(r)).not.toContain('77.2%');
    expect(byData(r, 'handoffs')).toHaveLength(0);
  });

  it('G4 Gasabo: the stated absence in plain language — never a score, never the Kigali aggregate — said once', () => {
    const r = render(
      payload('RETAINED_RECORD', 'GOVERNED_NO_RECORD', [geography('Gasabo'), gasabo]),
      undefined,
      "What was Gasabo's 2024/2025 Imihigo result?",
    );
    expect(said(r)).toEqual([
      'I don’t have an individual 2024/2025 Imihigo score for Gasabo in the retained NISR data. The available City of Kigali result is an aggregate, and GlobalNewsAI does not assign that city-level figure to Gasabo.',
    ]);
    expect(byData(r, 'intelligence-note')).toHaveLength(0);
    expect(visibleText(r)).not.toMatch(/\d+(\.\d+)?\s?%/);
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
      askIntelligenceStrings('en'),
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
      askIntelligenceStrings('en'),
      0,
    )!;
    expect(ted.lead[0]).toBe(
      '2 retained TED procurement notices from buyers in POL, published on 2026-09-24. This is one retained publication day, so it cannot show procurement changes or trends.',
    );
    expect(ted.lead.join(' ')).not.toMatch(/reform|trend(?!s\.)|increase|decrease/i);
  });
});

describe('A — official unavailable (G8) and a spent budget (live G3–G9) are named truthfully', () => {
  /* GOVERNED ANSWER CONVERSATIONAL UX R1 — SUPERSEDED WITH UPDATED PROOF: the same governed
     facts, now voiced as a conversational answer with restrained provenance. */
  const said = (r: ReactTestRenderer) =>
    byData(r, 'governed-answer').map((n) => n.props.children as string);

  it('G8: official source unavailable is a conversational answer naming the body from the question — never reporting as official', () => {
    const r = render(
      payload('CAPABILITY_UNAVAILABLE', 'OFFICIAL_SOURCE_UNAVAILABLE', null),
      undefined,
      "What is NBP's official reference rate?",
    );
    expect(said(r)).toEqual([
      'I can’t give you NBP’s official reference rate from an approved NBP source yet. Other reporting may provide context, but GlobalNewsAI will not present that as NBP’s official figure.',
    ]);
    expect(byData(r, 'unavailable')).toHaveLength(0);
    expect(byData(r, 'governed-provenance')[0].props.children).toBe(
      'Official source · not connected · No AI used',
    );
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
      askIntelligenceStrings('en'),
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
      askIntelligenceStrings('en'),
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

describe('GOVERNED RETAINED GAP REPAIR R1 — G9, the never-blank card, and the G4 scope', () => {
  const cpiGap = (disclosures: string[], status: AskContribution['status'] = 'NO_DATA') =>
    contribution({
      contributorId: 'ECONOMY_CPI',
      domain: 'economic',
      status,
      observations: [],
      temporalBasis: 'RETAINED_STATISTICAL_RELEASE',
      disclosures,
      degradationReason: 'NO_PRODUCER',
    });

  /* GOVERNED ANSWER CONVERSATIONAL UX R1 — SUPERSEDED WITH UPDATED PROOF: the same governed
     facts, now voiced as a conversational answer with restrained provenance. */
  const said = (r: ReactTestRenderer) =>
    byData(r, 'governed-answer').map((n) => n.props.children as string);

  it('G9 live state: an unreadable held CPI release is said plainly — never "no record", never internal vocabulary', () => {
    const r = render(
      payload('CAPABILITY_UNAVAILABLE', 'GOVERNED_RECORD_UNAVAILABLE', [
        cpiGap(['RETAINED_ARTIFACT_NOT_DISPLAYABLE']),
      ]),
    );
    expect(said(r)).toEqual([
      'I can’t safely give you Rwanda’s retained CPI value from this release right now. GlobalNewsAI holds the NISR release, but it cannot currently be read under the governed verification rules, so I won’t show an unverified number.',
    ]);
    expect(visibleText(r)).not.toMatch(
      /NO_PRODUCER|extractor|1\.1\.0|no retained record|GOVERNED_RECORD_UNAVAILABLE/i,
    );
    expect(byData(r, 'unavailable')).toHaveLength(0);
  });

  it('G9 no capture: a DISTINCT truthful sentence', () => {
    const r = render(
      payload('CAPABILITY_UNAVAILABLE', 'GOVERNED_RECORD_UNAVAILABLE', [
        cpiGap(['NO_RETAINED_CAPTURE']),
      ]),
    );
    expect(said(r)).toEqual([
      'I can’t give you Rwanda’s CPI figure from a retained NISR release, because GlobalNewsAI doesn’t currently hold one.',
    ]);
  });

  it('a failed read without a disclosure is "couldn’t read … just now" — not an absence', () => {
    const r = render(
      payload('CAPABILITY_UNAVAILABLE', 'GOVERNED_RECORD_UNAVAILABLE', [cpiGap([], 'DEGRADED')]),
    );
    expect(said(r)[0]).toMatch(/couldn’t read the retained record for this just now/);
  });

  it('G9 with a valid governed observation shows its exact value, unit, period and NISR provenance', () => {
    const view = askIntelligenceView(
      payload('RETAINED_RECORD', 'GOVERNED_RECORD', [
        contribution({
          contributorId: 'ECONOMY_CPI',
          domain: 'economic',
          temporalBasis: 'RETAINED_STATISTICAL_RELEASE',
          observations: [
            obs({
              reference: 'rw-nisr:cpi:all-rwanda',
              kind: 'HEADLINE_CPI_YOY',
              label: 'Rwanda headline CPI, year on year',
              value: '4.2',
              unit: 'PERCENT',
              period: '2026-08',
              source: {
                name: 'National Institute of Statistics of Rwanda',
                url: 'https://statistics.gov.rw/x.pdf',
                licence: 'CC BY 4.0',
              },
            }),
          ],
          disclosures: ['RETAINED_NOT_CURRENT'],
        }),
      ]),
      askIntelligenceStrings('en'),
      0,
    )!;
    expect(view.lead).toEqual([
      'Rwanda headline CPI, year on year: 4.2% for 2026-08 — a retained NISR release, not re-checked now.',
    ]);
    expect(view.sections[0].rows[0]).toMatchObject({
      value: '4.2 PERCENT',
      period: '2026-08',
      sourceName: 'National Institute of Statistics of Rwanda',
    });
  });

  /* GOVERNED ANSWER CONVERSATIONAL UX R1 — SUPERSEDED WITH UPDATED PROOF: the same governed
     facts, now voiced as a conversational answer with restrained provenance. */
  it.each([
    ['GOVERNED_RECORD', 'Here is what the retained governed record shows.'],
    ['GOVERNED_NO_RECORD', 'I don’t have an individual retained record for this.'],
  ])(
    'a %s answer without a voiceable value falls back to its own sentence — never blank',
    (basis, line) => {
      const r = render(
        payload('RETAINED_RECORD', basis, [
          contribution({
            contributorId: 'IMIHIGO',
            domain: 'governance',
            observations: [obs({ value: null })],
          }),
        ]),
      );
      expect(byData(r, 'governed-answer').map((n) => n.props.children)).toEqual([line]);
    },
  );

  it('G4: with no router geography chip, the governed place is the visible scope — never "no scope applied"', () => {
    const p = {
      ...payload('RETAINED_RECORD', 'GOVERNED_NO_RECORD', [
        contribution({
          contributorId: 'GEOGRAPHY',
          domain: 'geography',
          applicability: 'CONTEXT',
          temporalBasis: 'REFERENCE_GEOGRAPHY',
          observations: [obs({ kind: 'NISR_DISTRICT', label: 'Gasabo' })],
        }),
        gasabo,
      ]),
      chips: { kind: 'NONE' },
    } as unknown as AskR2Payload;
    const v = askR2View(p, askR2Strings('en'), 'en', (x) => x);
    expect(v.chips.items).toEqual([{ kind: 'GEOGRAPHY', label: 'Gasabo (NISR)', kept: false }]);
    expect(v.chips.note).toBeNull();
    /* a question with no governed place keeps the landed "no scope" note */
    const plain = askR2View(
      { ...p, intelligence: null } as AskR2Payload,
      askR2Strings('en'),
      'en',
      (x) => x,
    );
    expect(plain.chips.note).toBe('General question · no scope applied');
  });
});
