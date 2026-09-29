import type { AskR2Payload } from '@/lib/api/askV2Api';
import { askR2Strings } from './askR2Strings';
import { askR2View } from './askR2View';

/**
 * CURRENT STATUS CORROBORATION R1 — a PARTIAL current-status answer states the as-of time of
 * the freshest corroborating report (deterministic backend fact), never the model's
 * generation time, and says "as of", never "verified now".
 */
const partial = (over: Partial<AskR2Payload> = {}): AskR2Payload =>
  ({
    schema: 'ask-r2-result/1',
    route: {
      questionClass: 'CURRENT_STATUS_VERIFICATION',
      terminalState: 'EXECUTABLE',
      scopedBy: 'TYPED_GEOGRAPHY',
      refusals: [],
      disclosures: ['PARTIAL_VERIFICATION_AS_OF_TIME'],
      clarification: [],
      normalization: 'QUALIFIED',
      questionLanguage: 'en',
      personalScope: null,
    },
    chips: { kind: 'NONE' },
    answer: { state: 'PARTIAL', basis: 'REPORTING_PARTIAL_VERIFICATION', missingRoles: [] },
    checkedAt: '2026-09-29T12:00:00Z',
    aiExecuted: true,
    modelPriorCitable: false,
    /* the model generated its text at 12:00 — that is NOT the evidence time */
    analysis: {
      analysis: { generatedAt: '2026-09-29T12:00:00Z' },
      articles: [{}, {}],
    } as never,
    verification: {
      outcome: 'CURRENT_REPORTING_PARTIAL_VERIFICATION',
      reason: 'CORROBORATED',
      family: 'OFFICE_HOLDER',
      reports: 2,
      asOf: '2026-09-29T09:30:00Z',
      fact: { family: 'OFFICE_HOLDER', value: 'Karol Nawrocki' },
    },
    ...over,
  }) as AskR2Payload;

describe('PARTIAL current-status freshness', () => {
  it('EN: as of the freshest corroborating report, with the independent-report count', () => {
    const v = askR2View(partial(), askR2Strings('en'), 'en');
    expect(v.badge).toBe('part');
    expect(v.freshness).toBe('As of 29 Sep 2026, 09:30 UTC · 2 independent reports agree');
    expect(v.freshness).not.toContain('12:00');
    expect(v.freshness.toLowerCase()).not.toContain('verified');
  });

  it('PL: "stan na", with Polish plural forms', () => {
    const s = askR2Strings('pl');
    expect(askR2View(partial(), s, 'pl').freshness).toBe(
      'Stan na 29 wrz 2026, 09:30 UTC · 2 niezależne doniesienia są zgodne',
    );
    expect(s.freshness.corroboratedAsOf(5)).toContain('5 niezależnych doniesień jest zgodnych');
    expect(s.freshness.corroboratedAsOf(12)).toContain('12 niezależnych doniesień');
    expect(s.freshness.corroboratedAsOf(22)).toContain('22 niezależne doniesienia');
  });

  it('an older PARTIAL payload with no verification block keeps the released line', () => {
    const v = askR2View(partial({ verification: undefined }), askR2Strings('en'), 'en');
    expect(v.freshness).toBe('Checked 29 Sep 2026, 12:00 UTC · 2 sources');
  });
});
