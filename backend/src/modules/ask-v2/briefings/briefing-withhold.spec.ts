import { UnprocessableEntityException } from '@nestjs/common';
import {
  BRIEFING_SNAPSHOT_CARRIES_SPECIALIST_EVIDENCE,
  BRIEFING_UNAVAILABLE_SPECIALIST_EVIDENCE,
  answerUsesSpecialistEvidence,
  briefingPreservesEvidence,
} from '@globalnews-ai/shared';
import { BriefingsService } from './briefings.service';
import { briefingSnapshotOf } from './briefing-snapshot';

/**
 * CTO Politics ruling (briefings) — ONE shared capability check: "can the briefing path preserve this answer's
 * evidence?". The snapshot does not carry governed specialist evidence, so an answer that rests on it is refused
 * before any write. Answers without specialist evidence stay saveable exactly as before.
 */
const payload = (contributions: unknown[] | null) => ({
  schema: 'ask-r2-result/1',
  checkedAt: '2026-10-04T12:00:00.000Z',
  answer: { state: 'CURRENT_REPORTING' },
  analysis: {
    analysis: {
      summary: 'Sourced summary [1].',
      keyFacts: [],
      unknowns: [],
      sources: [{ articleId: 'a1', publisher: 'P', title: 'T', url: 'https://x.example/1', publishedAt: '2026-10-01' }],
    },
  },
  background: null,
  intelligence:
    contributions === null
      ? null
      : { considered: contributions.map((c) => (c as { contributorId: string }).contributorId), contributions },
});
const obs = { reference: 'r1', kind: 'K', label: null, value: null, unit: null, period: '2026-09-18', geography: 'POL', source: { name: 'S', url: null, licence: null }, retainedAt: null };
const contribution = (contributorId: string, status: string, observations: unknown[] = [obs]) => ({ contributorId, status, observations, disclosures: [] });

describe('briefingPreservesEvidence (shared, pure)', () => {
  it('the snapshot does not carry specialist evidence today', () => {
    expect(BRIEFING_SNAPSHOT_CARRIES_SPECIALIST_EVIDENCE).toBe(false);
  });
  it.each(['POLITICS', 'CONFLICT', 'MARKET_PROCUREMENT', 'ECONOMY_CPI', 'IMIHIGO'])(
    'an answer that USED %s evidence cannot be preserved',
    (id) => {
      expect(answerUsesSpecialistEvidence(payload([contribution(id, 'USED')]))).toBe(true);
      expect(briefingPreservesEvidence(payload([contribution(id, 'USED')]))).toBe(false);
    },
  );
  it.each([
    ['no intelligence (plain news answer)', payload(null)],
    ['older payload without the field', (({ intelligence: _i, ...rest }) => rest)(payload([]))],
    ['consulted, nothing matched', payload([contribution('POLITICS', 'NO_MATCH', [])])],
    ['not assessed', payload([contribution('HUMANITARIAN', 'NOT_ASSESSED', [])])],
    ['degraded', payload([contribution('CONFLICT', 'DEGRADED', [])])],
    ['USED but zero observations', payload([contribution('POLITICS', 'USED', [])])],
    ['geography is context, not evidence', payload([contribution('GEOGRAPHY', 'USED')])],
  ])('%s → preservable (saveable as before)', (_name, p) => {
    expect(briefingPreservesEvidence(p)).toBe(true);
  });
  it('the snapshot projection itself is unchanged', () => {
    expect(briefingSnapshotOf(payload([contribution('POLITICS', 'USED')]))).toEqual(briefingSnapshotOf(payload(null)));
  });
});

describe('BriefingsService refuses an answer whose evidence the briefing cannot preserve, before writing', () => {
  function service(storedPayload: unknown) {
    const writes = { briefingCreate: jest.fn(), versionCreate: jest.fn() };
    const tx = {
      briefing: {
        count: jest.fn(async () => 0),
        findFirst: jest.fn(async () => ({ id: 'b1', scope: { kind: 'ASK_QUESTION' }, versions: [{ version: 1, asOf: new Date() }] })),
        create: writes.briefingCreate.mockResolvedValue({ id: 'b2', title: 't', createdAt: new Date() }),
      },
      briefingVersion: { create: writes.versionCreate.mockResolvedValue({ id: 'v2', version: 2, briefingId: 'b1', createdAt: new Date() }) },
      askTurn: {
        findFirst: jest.fn(async () => ({
          id: 't1', question: 'What did the Sejm decide?', language: 'en',
          operation: { status: 'COMPLETED', storedResult: { payload: storedPayload, evidenceRevision: 'r1' } },
        })),
      },
    };
    const prisma = { $transaction: async (work: (t: unknown) => unknown) => work(tx) };
    return { svc: new BriefingsService(prisma as never), writes };
  }

  it.each(['POLITICS', 'CONFLICT'])('create: %s USED → refused with the governed code, nothing written', async (id) => {
    const { svc, writes } = service(payload([contribution(id, 'USED')]));
    const err = await svc.create('u1', { turnId: 't1' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnprocessableEntityException);
    expect((err as UnprocessableEntityException).getResponse()).toEqual({ code: BRIEFING_UNAVAILABLE_SPECIALIST_EVIDENCE });
    expect(writes.briefingCreate).not.toHaveBeenCalled();
    expect(writes.versionCreate).not.toHaveBeenCalled();
  });

  it('addVersion: specialist evidence → refused, nothing written', async () => {
    const { svc, writes } = service(payload([contribution('POLITICS', 'USED')]));
    const err = await svc.addVersion('u1', 'b1', 't1').catch((e: unknown) => e);
    expect((err as UnprocessableEntityException).getResponse()).toEqual({ code: BRIEFING_UNAVAILABLE_SPECIALIST_EVIDENCE });
    expect(writes.versionCreate).not.toHaveBeenCalled();
  });

  it.each([
    ['a plain news answer', payload(null)],
    ['geography context only', payload([contribution('GEOGRAPHY', 'USED')])],
    ['a specialist consulted without match', payload([contribution('POLITICS', 'NO_MATCH', [])])],
  ])('create: %s → saved exactly as before', async (_n, p) => {
    const { svc, writes } = service(p);
    await expect(svc.create('u1', { turnId: 't1' })).resolves.toMatchObject({ id: 'b2', version: 1 });
    expect(writes.briefingCreate).toHaveBeenCalledTimes(1);
  });
});
