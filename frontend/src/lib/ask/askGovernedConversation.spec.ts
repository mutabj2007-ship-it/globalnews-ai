import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AskContribution, AskR2Payload } from '@/lib/api/askV2Api';
import { AskR2TurnView } from '@/components/ask-frame/AskR2TurnView';
import { askGovernedConversation, isGovernedConversationTurn } from './askGovernedConversation';

/**
 * GOVERNED ANSWER CONVERSATIONAL UX R1 — conversation first, governance second, evidence third.
 * Deterministic copy from the governed payload only; zero model calls; follow-ups are drafts.
 */

const obs = (over: Partial<AskContribution['observations'][number]> = {}) => ({
  reference: 'r1',
  kind: 'K',
  label: null,
  value: null,
  unit: null,
  period: '',
  geography: 'RWA',
  source: { name: 'NISR', url: null, licence: null },
  retainedAt: null,
  ...over,
});
const c = (over: Partial<AskContribution>): AskContribution => ({
  contributorId: 'IMIHIGO',
  domain: 'governance',
  status: 'USED',
  applicability: 'SUPPLEMENTARY',
  observations: [],
  temporalBasis: 'RETAINED_EVALUATION_CYCLE',
  geographyBasis: null,
  disclosures: [],
  degradationReason: null,
  ...over,
});
const payload = (state: string, basis: string, contributions: AskContribution[] | null) =>
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
    checkedAt: '2026-09-30T08:00:00Z',
    aiExecuted: false,
    modelPriorCitable: false,
    analysis: null,
    background: null,
    intelligence:
      contributions === null
        ? null
        : { considered: contributions.map((x) => x.contributorId), contributions },
  }) as unknown as AskR2Payload;

const ngoma = c({
  observations: [
    obs({
      kind: 'IMIHIGO_DISTRICT_FINAL_SCORE',
      label: 'Ngoma',
      value: '77.2',
      period: '2024/2025',
    }),
  ],
});
const geography = (name: string) =>
  c({
    contributorId: 'GEOGRAPHY',
    domain: 'geography',
    applicability: 'CONTEXT',
    temporalBasis: 'REFERENCE_GEOGRAPHY',
    observations: [obs({ kind: 'NISR_DISTRICT', label: name })],
  });
const gasabo = c({ status: 'NO_MATCH', disclosures: ['AGGREGATE_NOT_ASSIGNED_TO_DISTRICT'] });
const cpiHeld = c({
  contributorId: 'ECONOMY_CPI',
  domain: 'economic',
  status: 'NO_DATA',
  temporalBasis: 'RETAINED_STATISTICAL_RELEASE',
  disclosures: ['RETAINED_ARTIFACT_NOT_DISPLAYABLE'],
  degradationReason: 'NO_PRODUCER',
});

describe('which turns are voiced', () => {
  it('only zero-AI governed answers; every other turn renders exactly as before', () => {
    expect(isGovernedConversationTurn(payload('RETAINED_RECORD', 'GOVERNED_RECORD', [ngoma]))).toBe(
      true,
    );
    expect(
      isGovernedConversationTurn(
        payload('CAPABILITY_UNAVAILABLE', 'GOVERNED_RECORD_UNAVAILABLE', []),
      ),
    ).toBe(true);
    expect(
      isGovernedConversationTurn(
        payload('CAPABILITY_UNAVAILABLE', 'OFFICIAL_SOURCE_UNAVAILABLE', null),
      ),
    ).toBe(true);
    for (const [state, basis] of [
      ['CURRENT_REPORTING', 'REQUIRED_EVIDENCE_OBTAINED'],
      ['CAPABILITY_UNAVAILABLE', 'PLAN_CAPABILITY_UNAVAILABLE'],
      ['CAPABILITY_UNAVAILABLE', 'EXECUTOR_NOT_WIRED'],
      ['REFERENCE_BACKGROUND', 'NO_REQUIRED_EVIDENCE'],
      ['INSUFFICIENT', 'NO_REQUIRED_EVIDENCE_OBTAINED'],
    ]) {
      expect(askGovernedConversation(payload(state, basis, null), 'en', 'Q?')).toBeNull();
    }
  });
});

describe('deterministic conversational copy (EN / PL)', () => {
  it('Ngoma — PL', () => {
    const g = askGovernedConversation(
      payload('RETAINED_RECORD', 'GOVERNED_RECORD', [ngoma]),
      'pl',
      'Q?',
    )!;
    expect(g.paragraphs[0]).toBe(
      'Końcowy wynik Imihigo dla Ngoma w cyklu 2024/2025 wyniósł 77.2. Pochodzi on z zachowanej końcowej oceny NISR dla tego zamkniętego cyklu, więc opisuje tamten okres oceny, a nie obecną sytuację dystryktu.',
    );
    expect(g.provenance).toBe('Zachowany zapis · NISR · 2024/2025 · Bez AI');
  });

  it('an absence without the aggregate disclosure never mentions Kigali; the cycle is the reader’s own, or omitted', () => {
    const absent = payload('RETAINED_RECORD', 'GOVERNED_NO_RECORD', [
      geography('Nyamasheke'),
      c({ status: 'NO_MATCH' }),
    ]);
    expect(
      askGovernedConversation(absent, 'en', "What was Nyamasheke's 2024-25 Imihigo result?")!
        .paragraphs[0],
    ).toBe(
      'I don’t have an individual 2024/2025 Imihigo score for Nyamasheke in the retained NISR data.',
    );
    /* no cycle named → none assumed */
    expect(
      askGovernedConversation(absent, 'en', 'How did Nyamasheke do in Imihigo?')!.paragraphs[0],
    ).toBe('I don’t have an individual Imihigo score for Nyamasheke in the retained NISR data.');
  });

  it('a valid CPI record is voiced with its exact value, unit and period (fixture value, never hard-coded)', () => {
    const g = askGovernedConversation(
      payload('RETAINED_RECORD', 'GOVERNED_RECORD', [
        c({
          contributorId: 'ECONOMY_CPI',
          domain: 'economic',
          temporalBasis: 'RETAINED_STATISTICAL_RELEASE',
          observations: [
            obs({
              label: 'Rwanda headline CPI, year on year',
              value: '4.2',
              unit: 'PERCENT',
              period: '2026-08',
            }),
          ],
        }),
      ]),
      'en',
      'Q?',
    )!;
    expect(g.paragraphs[0]).toBe(
      'Rwanda headline CPI, year on year was 4.2% for 2026-08, according to the retained NISR release. That is the latest figure GlobalNewsAI holds from that release, not a fresh check of today’s rate.',
    );
    expect(g.provenance).toBe('Retained record · NISR · 2026-08 · No AI used');
  });

  it('CPI held but unreadable — PL, with no implementation vocabulary', () => {
    const g = askGovernedConversation(
      payload('CAPABILITY_UNAVAILABLE', 'GOVERNED_RECORD_UNAVAILABLE', [cpiHeld]),
      'pl',
      'Q?',
    )!;
    expect(g.paragraphs[0]).toMatch(
      /^Nie mogę teraz bezpiecznie podać zachowanej wartości CPI dla Rwandy/,
    );
    expect(JSON.stringify(g)).not.toMatch(/NO_PRODUCER|extractor|1\.1\.0|GOVERNED_/);
    expect(g.followUps).toEqual(['Kiedy wartość CPI będzie dostępna?']);
  });

  it('one TED snapshot is voiced as a single day — never as change', () => {
    const g = askGovernedConversation(
      payload('RETAINED_RECORD', 'GOVERNED_RECORD', [
        c({
          contributorId: 'MARKET_PROCUREMENT',
          domain: 'economic',
          temporalBasis: 'RETAINED_PUBLICATION',
          observations: [
            obs({ geography: 'POL', period: '2026-09-24+02:00' }),
            obs({ reference: 'r2', geography: 'POL', period: '2026-09-24+02:00' }),
          ],
        }),
      ]),
      'en',
      'What are the important procurement changes in Poland?',
    )!;
    expect(g.paragraphs[0]).toBe(
      'GlobalNewsAI holds one retained snapshot of EU procurement notices for POL: 2 notices published on 2026-09-24. Because it covers a single publication day, it can’t show how procurement has changed or which changes matter most — the notices themselves are listed below.',
    );
    expect(g.provenance).toBe('Retained record · TED · 2026-09-24 · No AI used');
  });

  it('official unavailable names the body only when the reader named it', () => {
    const named = askGovernedConversation(
      payload('CAPABILITY_UNAVAILABLE', 'OFFICIAL_SOURCE_UNAVAILABLE', null),
      'en',
      'What is the official reference rate of the National Bank of Poland?',
    )!;
    expect(named.paragraphs[0]).toMatch(/^I can’t give you NBP’s official reference rate/);
    const unnamed = askGovernedConversation(
      payload('CAPABILITY_UNAVAILABLE', 'OFFICIAL_SOURCE_UNAVAILABLE', null),
      'en',
      'What is the official unemployment figure?',
    )!;
    expect(unnamed.paragraphs[0]).toBe(
      'I can’t give you the official figure from an approved official source yet. Other reporting may provide context, but GlobalNewsAI will not present it as the official figure.',
    );
    const pl = askGovernedConversation(
      payload('CAPABILITY_UNAVAILABLE', 'OFFICIAL_SOURCE_UNAVAILABLE', null),
      'pl',
      'Jaka jest oficjalna stopa referencyjna NBP?',
    )!;
    expect(pl.paragraphs[0]).toMatch(/^Nie mogę jeszcze podać oficjalnej stopy referencyjnej NBP/);
  });
});

describe('visual hierarchy and continuity', () => {
  function render(p: AskR2Payload, onUseQuestion?: (q: string) => void): ReactTestRenderer {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        createElement(AskR2TurnView, {
          turn: { question: "What was Ngoma's 2024/2025 Imihigo result?", payload: p } as never,
          locale: 'en',
          context: undefined,
          ...(onUseQuestion ? { onUseQuestion } : {}),
        }),
      );
    });
    return r;
  }
  const byData = (r: ReactTestRenderer, name: string) =>
    r.root.findAll((n) => typeof n.type === 'string' && n.props['data-ask'] === name);

  it('the conversational answer leads; the governance state is a restrained label; evidence stays below', () => {
    const r = render(payload('RETAINED_RECORD', 'GOVERNED_RECORD', [geography('Ngoma'), ngoma]));
    const badge = r.root.find(
      (n) => typeof n.type === 'string' && n.props['data-ask-badge'] === 'rec',
    );
    expect(badge.props['data-ask-badge-restrained']).toBe('true');
    expect(badge.props.className).not.toMatch(/rounded|border|bg-/);
    expect(byData(r, 'freshness')).toHaveLength(0);
    const answer = byData(r, 'answer')[0];
    expect(answer.props['data-ask-governed']).toBe('true');
    const order = answer
      .findAll((n) => typeof n.type === 'string' && typeof n.props['data-ask'] === 'string')
      .map((n) => n.props['data-ask']);
    expect(order.indexOf('governed-answer')).toBeLessThan(order.indexOf('governed-provenance'));
    /* provenance / evidence preserved below the answer */
    expect(byData(r, 'intelligence')).toHaveLength(1);
    expect(byData(r, 'intelligence-row').length).toBeGreaterThan(0);
    /* not a dead-end system notice */
    expect(r.root.findAll((n) => n.props.role === 'alert')).toHaveLength(0);
  });

  it('a follow-up only becomes a composer DRAFT — nothing is sent, no request is made', () => {
    const fetchSpy = jest.fn();
    (globalThis as { fetch?: unknown }).fetch = fetchSpy;
    const drafted: string[] = [];
    const r = render(
      payload('RETAINED_RECORD', 'GOVERNED_NO_RECORD', [geography('Gasabo'), gasabo]),
      (q) => drafted.push(q),
    );
    const [button] = byData(r, 'governed-follow-up');
    act(() => button.props.onClick());
    expect(drafted).toEqual(['Why is there no Gasabo score?']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
