import { AskObservationService } from './ask-observation.service';
import type { PrismaService } from '../../database/prisma.service';
import type { AskObservationRetentionService } from './ask-observation-retention.service';
import {
  ASK_OBSERVATION_SCHEMA,
  newAskObservationDraft,
  type AskObservationInput,
} from './ask-observation.contract';

/**
 * R1 — the writer's three promises, asserted rather than documented:
 *   1. it never fails the caller;
 *   2. it stores no question, and the input type gives it none to store;
 *   3. a duplicate is the uniqueness guarantee working, not an error to report.
 */
const input = (over: Partial<AskObservationInput> = {}): AskObservationInput => ({
  operationId: 'op-1',
  ...newAskObservationDraft('ask-r2-adapter/1', 'en'),
  ...over,
});

function harness(behaviour: { fail?: unknown; hang?: boolean; retentionThrows?: boolean } = {}) {
  const writes: unknown[] = [];
  const upserts: unknown[] = [];
  const prisma = {
    askObservation: {
      create: jest.fn(async (args: unknown) => {
        /* A promise that never settles and holds NO timer handle: the deadline must be
           what ends this, and a lingering timer would keep the runner alive afterwards. */
        if (behaviour.hang) await new Promise(() => undefined);
        if (behaviour.fail) throw behaviour.fail;
        writes.push(args);
        return {};
      }),
    },
    askAccessCounter: {
      upsert: jest.fn(async (args: unknown) => {
        if (behaviour.fail) throw behaviour.fail;
        upserts.push(args);
        return {};
      }),
    },
  } as unknown as PrismaService;
  /* Retention is offered by the writer and must never be able to affect it: a sweep that
     throws is handed a rejected promise here on purpose. */
  const retention = {
    sweepIfDue: jest.fn(async () => {
      if (behaviour.retentionThrows) throw new Error('retention down');
      return 0;
    }),
  } as unknown as AskObservationRetentionService;
  return {
    service: new AskObservationService(prisma, retention),
    prisma,
    writes,
    upserts,
    retention,
  };
}

describe('R1 — the observation writer cannot fail the reader', () => {
  it('a store failure is swallowed and reported as not-written, never thrown', async () => {
    const { service } = harness({ fail: new Error('store down') });
    await expect(service.record(input())).resolves.toBe(false);
  });

  it('a duplicate is not an error — the observation it wanted already exists', async () => {
    const { service } = harness({ fail: Object.assign(new Error('unique'), { code: 'P2002' }) });
    await expect(service.record(input())).resolves.toBe(false);
  });

  it('a hung store is bounded by the observation deadline rather than held forever', async () => {
    const { service } = harness({ hang: true });
    const started = Date.now();
    await expect(service.record(input())).resolves.toBe(false);
    expect(Date.now() - started).toBeLessThan(10_000);
  }, 20_000);

  it('a counter failure is swallowed too — an unauthenticated refusal must still be refused', async () => {
    const { service } = harness({ fail: new Error('store down') });
    await expect(service.countAccess('SIGNED_OUT_ATTEMPT')).resolves.toBe(false);
  });
});

describe('R1 — what the writer writes', () => {
  it('stamps the schema version, so a later shape is readable rather than ambiguous', async () => {
    const { service, writes } = harness();
    await service.record(input());
    expect((writes[0] as { data: { schemaVersion: string } }).data.schemaVersion).toBe(
      ASK_OBSERVATION_SCHEMA,
    );
  });

  it('refuses a geography value outside the governed vocabulary and counts the refusal', async () => {
    const { service, writes } = harness();
    await service.record(input({ geographyCodes: ['RWA', 'a place I typed'] }));
    const data = (
      writes[0] as {
        data: {
          geographyCodes: string[];
          geographyCodesDropped: number;
          geographyPresent: boolean;
        };
      }
    ).data;
    expect(data.geographyCodes).toEqual(['RWA']);
    expect(data.geographyCodesDropped).toBe(1);
    expect(data.geographyPresent).toBe(true);
  });

  it('an absent token measurement is written as null with tokensMeasured false — never as zero', async () => {
    const { service, writes } = harness();
    await service.record(input());
    const data = (
      writes[0] as {
        data: {
          promptTokens: number | null;
          completionTokens: number | null;
          tokensMeasured: boolean;
        };
      }
    ).data;
    expect(data.promptTokens).toBeNull();
    expect(data.completionTokens).toBeNull();
    expect(data.tokensMeasured).toBe(false);
  });

  it('a measurement of zero completion tokens is kept AS a measurement', async () => {
    const { service, writes } = harness();
    await service.record(input({ promptTokens: 1200, completionTokens: 0 }));
    const data = (writes[0] as { data: { tokensMeasured: boolean; completionTokens: number } })
      .data;
    expect(data.tokensMeasured).toBe(true);
    expect(data.completionTokens).toBe(0);
  });

  it('no value it writes is the reader question, because the input carries none', async () => {
    const { service, writes } = harness();
    await service.record(input());
    const serialised = JSON.stringify(writes[0]);
    ['question', 'prompt', 'rawQuestion', 'readerTerms', 'statedPeriod', 'matchedText'].forEach(
      (forbidden) => {
        /* `questionClass`, `questionLanguage`, `promptTokens` and `statedPeriodPresent` are
           the legitimate spellings; the bare names must not appear as keys. */
        expect(serialised).not.toContain(`"${forbidden}":`);
      },
    );
  });

  it('the access counter increments its hour rather than overwriting a total', async () => {
    const { service, upserts } = harness();
    await service.countAccess('SIGNED_OUT_ATTEMPT', new Date('2026-09-29T13:47:00.000Z'));
    const args = upserts[0] as {
      where: { event_bucketStart: { event: string; bucketStart: Date } };
      update: { count: { increment: number } };
    };
    expect(args.where.event_bucketStart.event).toBe('SIGNED_OUT_ATTEMPT');
    expect(args.where.event_bucketStart.bucketStart.toISOString()).toBe('2026-09-29T13:00:00.000Z');
    expect(args.update.count).toEqual({ increment: 1 });
  });
});

describe('R1 — retention is offered by the writer and can never affect it', () => {
  it('a successful write offers the store a sweep', async () => {
    const { service, retention } = harness();
    await service.record(input());
    expect(retention.sweepIfDue).toHaveBeenCalled();
  });

  it('a retention failure does not make the write fail', async () => {
    const { service } = harness({ retentionThrows: true });
    await expect(service.record(input())).resolves.toBe(true);
    await Promise.resolve();
  });

  it('a failed write does not sweep — nothing was added, so nothing needs removing', async () => {
    const { service, retention } = harness({ fail: new Error('store down') });
    await service.record(input());
    expect(retention.sweepIfDue).not.toHaveBeenCalled();
  });
});
