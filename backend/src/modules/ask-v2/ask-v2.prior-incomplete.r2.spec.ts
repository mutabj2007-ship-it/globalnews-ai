import { priorArtifactIn } from './ask-v2.service';

/**
 * ASK R2 LIVE-GATE REPAIR (P0-4) — priorArtifactIn derives a bounded, no-findings, INCOMPLETE record
 * from a turn whose execution failed (live Alpha: the corridor turn released MODEL_FAILURE and the
 * next turn had nothing to bind). Derived from stored facts only: the turn's question, its plan's
 * typed places and its time. Never evidence.
 */
const B =
  'As of 6 October 2026, identify up to five developments reported in the past seven days affecting a small business importing into Rwanda via Mombasa or Dar es Salaam. Use a concise table: development, dates, route, facts, impact and source link. End with three practical checks. Under 600 words.';
const tx = (turns: unknown[]) =>
  ({ askTurn: { findMany: jest.fn(async () => turns) } }) as never;
const failedTurn = {
  operationId: 'op-b',
  question: B,
  createdAt: new Date('2026-10-06T10:42:10Z'),
  operation: {
    status: 'RELEASED',
    failureCode: 'MODEL_FAILURE',
    plan: {
      scope: JSON.stringify({
        scopedBy: 'TYPED_GEOGRAPHY',
        geography: ['TYPED_GEOGRAPHY:RWA', 'TYPED_GEOGRAPHY:KEN', 'TYPED_GEOGRAPHY:TZA'],
      }),
    },
    storedResult: null,
  },
};

describe('P0-4 · a failed turn still hands the reader\'s intent to the next turn', () => {
  it('RELEASED + failureCode + nothing stored ⇒ incomplete, no-findings record with the WHOLE question, places and window', async () => {
    const prior = await priorArtifactIn(tx([failedTurn]), 'thread-1');
    expect(prior).toMatchObject({
      kind: 'REASONED_ANSWER',
      provenance: 'MODEL_REASONING',
      citable: false,
      currentFindings: 'NONE',
      incomplete: true,
      sourceOperationId: 'op-b',
      scope: {
        countries: ['RWA', 'KEN', 'TZA'],
        window: {
          statedPeriod: 'in the past seven days',
          from: '2026-09-29T10:42:10.000Z',
          to: '2026-10-06T10:42:10.000Z',
        },
      },
    });
    /* the whole question, including its output contract at the end (was cut at 300) */
    expect(prior?.scope?.question).toContain('End with three practical checks');
    expect(prior?.evidenceRefs).toBeUndefined();
  });

  it('a turn that answered nothing for another reason (no failure code) still ends the walk, unchanged', async () => {
    const quoted = { ...failedTurn, operation: { ...failedTurn.operation, status: 'QUOTED', failureCode: null } };
    expect(await priorArtifactIn(tx([quoted]), 'thread-1')).toBeUndefined();
  });
});
