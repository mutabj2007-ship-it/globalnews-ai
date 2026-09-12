import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service';
import { MAX_OPEN_TICKETS_PER_USER, SupportService } from './support.service';
import { ANALYSIS_ELIGIBLE_CATEGORY, SupportAiService } from './support-ai.service';
import { SUPPORT_CATEGORIES } from '@globalnews-ai/shared';
import type { AnalysisService } from '../analysis/service/analysis.service';
import type { ConfigService } from '@nestjs/config';

/**
 * SUPPORT-AI-1 — a real SupportAiService for the support specs.
 *
 * REAL, NOT A STUB OF THE AGENT. A support test that stubbed the agent
 * would prove nothing about whether a ticket survives an analysis
 * failure, which is the property that matters most here. This is the
 * genuine service wired to an analysis double that REJECTS, i.e. the
 * honest worst case: every assertion in these files therefore holds
 * while the provider is unavailable.
 *
 * It lives in this file because this is already where the shared support
 * doubles live -- and because importing a .spec file re-registers its
 * tests in every importing suite, so the agent's own spec is imported by
 * nobody.
 */
export function buildSupportAi(): SupportAiService {
  const analysis = {
    analyzeNews: (): Promise<never> => Promise.reject(new Error('analysis unavailable in test')),
  } as unknown as AnalysisService;

  return new SupportAiService(analysis, {
    get: (key: string): string | undefined => (key === 'SUPPORT_AI_ENABLED' ? 'true' : undefined),
  } as unknown as ConfigService);
}

/**
 * S2 — the user support service, exercised against an in-memory
 * PostgreSQL double rather than a pile of call assertions.
 *
 * The double implements the SEMANTICS the service depends on — where
 * clauses, relation filters, transaction rollback, unique-constraint
 * violations — so a test that passes here is a test about behaviour,
 * not about which mock happened to be called.
 *
 * ONE THING THE DOUBLE CANNOT DO IS BE POSTGRESQL. Serializable
 * isolation is emulated by INJECTING the write conflict PostgreSQL
 * would raise, which proves the service reacts correctly to it. It does
 * not prove PostgreSQL raises it — that is a property of the database
 * and is verified by the native gate, not here. The concurrency test
 * below says so in its own name.
 */

export interface TicketRow {
  id: string;
  reference: string;
  userId: string;
  category: string;
  status: string;
  subject: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageRow {
  id: string;
  ticketId: string;
  authorType: string;
  authorId: string | null;
  visibility: string;
  body: string;
  createdAt: Date;
}

export interface Store {
  tickets: TicketRow[];
  messages: MessageRow[];
}

class PrismaUniqueViolation extends Error {
  readonly code = 'P2002';
  constructor(readonly meta: { target: string[] }) {
    super('Unique constraint failed');
  }
}

/**
 * The shapes a PostgreSQL serialization failure was OBSERVED to take
 * during the live gate, reproduced here exactly.
 *
 * These are not invented. They were captured by instrumenting the real
 * error object from a real SQLSTATE 40001 against real PostgreSQL 16,
 * and the commit-time one is the shape that used to escape the retry
 * and reach the user as an unhandled error.
 */

/** Detected mid-statement: Prisma maps it, and nests the driver cause. */
class PrismaWriteConflict extends Error {
  readonly code = 'P2034';
  readonly meta = {
    modelName: 'SupportTicket',
    driverAdapterError: {
      name: 'DriverAdapterError',
      cause: {
        originalCode: '40001',
        originalMessage:
          'could not serialize access due to read/write dependencies among transactions',
        kind: 'TransactionWriteConflict',
      },
    },
  };

  constructor() {
    super('Invalid `tx.supportTicket.create()` invocation');
  }
}

/**
 * Detected at COMMIT: the driver adapter raises it, Prisma does NOT map
 * it, and the object carries no error code at all.
 *
 * THIS IS THE SHAPE THAT MADE THE NATIVE GATE FAIL.
 */
class DriverAdapterWriteConflict extends Error {
  readonly name = 'DriverAdapterError';

  constructor() {
    super('TransactionWriteConflict');
  }
}

/**
 * A DriverAdapterError that is NOT a serialization failure, so the
 * predicate is forced to match the KIND rather than the wrapper class.
 * A check that retried any DriverAdapterError would turn a closed
 * connection into a slow, silent failure.
 */
class DriverAdapterOtherError extends Error {
  readonly name = 'DriverAdapterError';

  constructor() {
    super('ConnectionClosed');
  }
}

interface DoubleOptions {
  /** Injected failures, consumed one per transaction attempt. */
  failAttempts?: Array<
    | 'P2034'
    | 'P2034-commit-time'
    | 'P2034-nested-sqlstate'
    | 'driver-other'
    | 'P2002-reference'
    | 'P2002-other'
  >;
  /** Runs before the transaction body of the given attempt (1-based). */
  beforeAttempt?: (attempt: number, store: Store) => void;
  /**
   * Runs AFTER the given attempt has rolled back. This is where a
   * competing request's already-committed write belongs: rollback must
   * undo only this transaction's writes, never somebody else's.
   */
  afterRollback?: (attempt: number, store: Store) => void;
}

/**
 * SUPPORT CLOSURE — EXPORTED so the continuous support-loop test can drive the
 * REAL SupportService and the REAL AdminSupportService over ONE shared store,
 * using the doubles those services are already tested against, rather than a
 * third double written specially for the loop. A pure `export` addition: the
 * function, its behaviour and every test in this file are untouched.
 */
export function buildPrismaDouble(store: Store, options: DoubleOptions = {}) {
  const isolationLevels: Array<string | undefined> = [];
  let attempts = 0;
  let sequence = 0;
  const nextId = (): string => `id-${(sequence += 1)}`;

  const publicMessagesOf = (ticketId: string): MessageRow[] =>
    store.messages
      .filter((message) => message.ticketId === ticketId && message.visibility === 'PUBLIC')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const client = {
    supportTicket: {
      count: ({
        where,
      }: {
        where: { userId: string; status?: { not?: string } };
      }): Promise<number> =>
        Promise.resolve(
          store.tickets.filter(
            (ticket) =>
              ticket.userId === where.userId &&
              (where.status?.not === undefined || ticket.status !== where.status.not),
          ).length,
        ),

      create: ({ data }: { data: Record<string, string> }): Promise<TicketRow> => {
        if (store.tickets.some((ticket) => ticket.reference === data.reference)) {
          return Promise.reject(new PrismaUniqueViolation({ target: ['reference'] }));
        }
        const now = new Date(Date.UTC(2026, 7, 22, 12, 0, sequence));
        const row: TicketRow = {
          id: nextId(),
          reference: data.reference,
          userId: data.userId,
          category: data.category,
          status: data.status,
          subject: data.subject,
          createdAt: now,
          updatedAt: now,
        };
        store.tickets.push(row);
        return Promise.resolve(row);
      },

      findMany: ({
        where,
        take,
      }: {
        where: { userId: string };
        take: number;
      }): Promise<unknown[]> =>
        Promise.resolve(
          store.tickets
            .filter((ticket) => ticket.userId === where.userId)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, take)
            .map((ticket) => ({
              ...ticket,
              _count: { messages: publicMessagesOf(ticket.id).length },
            })),
        ),

      findFirst: ({
        where,
        select,
      }: {
        where: { reference: string; userId: string };
        select?: { messages?: unknown };
      }): Promise<unknown | null> => {
        const ticket = store.tickets.find(
          (row) => row.reference === where.reference && row.userId === where.userId,
        );
        if (!ticket) return Promise.resolve(null);
        if (!select?.messages) return Promise.resolve(ticket);
        return Promise.resolve({ ...ticket, messages: publicMessagesOf(ticket.id) });
      },

      /*
        BY id OR BY reference. The service updates the status by
        reference from appendAiAnswer and by id elsewhere, and a double
        that supported only one of them silently failed the news path
        rather than testing it.
      */
      update: ({
        where,
        data,
      }: {
        where: { id?: string; reference?: string };
        data: { status: string };
      }): Promise<TicketRow> => {
        const ticket = store.tickets.find((row) =>
          where.id !== undefined ? row.id === where.id : row.reference === where.reference,
        );
        if (!ticket) return Promise.reject(new Error('no such ticket'));
        ticket.status = data.status;
        // The database's @updatedAt fires because the ROW is written.
        ticket.updatedAt = new Date(ticket.updatedAt.getTime() + 1000);
        return Promise.resolve(ticket);
      },
    },

    supportMessage: {
      create: ({ data }: { data: Record<string, unknown> }): Promise<MessageRow> => {
        const ticketId =
          (data.ticketId as string | undefined) ??
          store.tickets.find(
            (ticket) =>
              ticket.reference ===
              ((data.ticket as { connect?: { reference?: string } })?.connect?.reference ?? ''),
          )?.id;

        if (!ticketId) return Promise.reject(new Error('message without a ticket'));

        const row: MessageRow = {
          id: nextId(),
          ticketId,
          authorType: data.authorType as string,
          authorId: (data.authorId as string | null) ?? null,
          visibility: data.visibility as string,
          body: data.body as string,
          createdAt: new Date(Date.UTC(2026, 7, 22, 12, 0, sequence)),
        };
        store.messages.push(row);
        return Promise.resolve(row);
      },
    },

    async $transaction<T>(
      fn: (tx: unknown) => Promise<T>,
      opts?: { isolationLevel?: string },
    ): Promise<T> {
      attempts += 1;
      isolationLevels.push(opts?.isolationLevel);
      options.beforeAttempt?.(attempts, store);

      const snapshot: Store = {
        tickets: store.tickets.map((ticket) => ({ ...ticket })),
        messages: store.messages.map((message) => ({ ...message })),
      };

      const injected = options.failAttempts?.[attempts - 1];

      try {
        const result = await fn(client);

        if (injected === 'P2034') throw new PrismaWriteConflict();
        if (injected === 'P2034-commit-time') throw new DriverAdapterWriteConflict();
        if (injected === 'P2034-nested-sqlstate') {
          const wrapped = new Error('write conflict') as Error & {
            cause: { originalCode: string; kind: string };
          };
          wrapped.cause = { originalCode: '40001', kind: 'TransactionWriteConflict' };
          throw wrapped;
        }
        if (injected === 'driver-other') throw new DriverAdapterOtherError();
        if (injected === 'P2002-reference') {
          throw new PrismaUniqueViolation({ target: ['reference'] });
        }
        if (injected === 'P2002-other') {
          throw new PrismaUniqueViolation({ target: ['tokenHash'] });
        }

        return result;
      } catch (error) {
        // Rollback, exactly as an aborted transaction would.
        store.tickets = snapshot.tickets;
        store.messages = snapshot.messages;
        options.afterRollback?.(attempts, store);
        throw error;
      }
    },
  };

  return {
    prisma: client as unknown as PrismaService,
    stats: () => ({ attempts, isolationLevels }),
  };
}

export const emptyStore = (): Store => ({ tickets: [], messages: [] });

/*
  The one analysis-eligible category, taken from the agent rather than
  written out again, so a change there fails here instead of drifting.
*/
const NEWS_CATEGORY = ANALYSIS_ELIGIBLE_CATEGORY;
const NON_NEWS_CATEGORIES = SUPPORT_CATEGORIES.filter((category) => category !== NEWS_CATEGORY);

const NEW_TICKET = {
  category: 'BUG_REPORT' as const,
  subject: 'Sign in fails after the second attempt',
  message: 'Signing in with Google returns me to the home page without a session.',
};

describe('S2 — creating a ticket', () => {
  /*
    R4 SUPPORT UX CLOSURE CHANGED WHAT "TOGETHER" MEANS HERE, AND THE
    TEST SAYS SO RATHER THAN HAVING ITS NUMBERS QUIETLY BUMPED.

    SUPPORT-AI-1 wrote THREE rows in the one transaction: the ticket, the
    requester's message, and a deterministic agent acknowledgement. The
    acknowledgement is gone. Creation now writes TWO rows -- the ticket
    and the requester's own message -- and the conversation the requester
    sees contains exactly what they wrote.

    The status is AWAITING_ADMIN rather than OPEN, and now means what it
    says: nobody has answered this and a human owes one.

    The point of the original assertion survives intact: the ticket and
    its conversation are committed together or not at all.
  */
  it('stores the ticket and the requester’s message together, owned by the caller', async () => {
    const store = emptyStore();
    const { prisma } = buildPrismaDouble(store);

    const detail = await new SupportService(prisma, buildSupportAi()).createTicket(
      'user-1',
      NEW_TICKET,
    );

    expect(store.tickets).toHaveLength(1);
    expect(store.tickets[0].userId).toBe('user-1');
    expect(store.tickets[0].status).toBe('AWAITING_ADMIN');
    expect(detail.reference).toMatch(/^GN-[0-9A-HJKMNP-TV-Z]{10}$/);
    expect(detail.messageCount).toBe(1);

    expect(store.messages).toHaveLength(1);
    expect(store.messages[0]).toMatchObject({
      authorType: 'USER',
      authorId: 'user-1',
      visibility: 'PUBLIC',
      body: NEW_TICKET.message,
    });
  });

  it('a BUG_REPORT receives NO automated agent message at all', async () => {
    const store = emptyStore();
    const { prisma } = buildPrismaDouble(store);

    const detail = await new SupportService(prisma, buildSupportAi()).createTicket(
      'user-1',
      NEW_TICKET,
    );

    expect(store.messages.map((message) => message.authorType)).toEqual(['USER']);
    expect(detail.messages.map((message) => message.authorType)).toEqual(['USER']);
    expect(detail.status).toBe('AWAITING_ADMIN');
  });

  it.each(NON_NEWS_CATEGORIES)(
    '%s stores the requester’s message and nothing else',
    async (category) => {
      const store = emptyStore();
      const { prisma } = buildPrismaDouble(store);

      const detail = await new SupportService(prisma, buildSupportAi()).createTicket('user-1', {
        ...NEW_TICKET,
        category,
      });

      expect({ category, authors: detail.messages.map((message) => message.authorType) }).toEqual({
        category,
        authors: ['USER'],
      });
      expect({ category, status: detail.status }).toEqual({ category, status: 'AWAITING_ADMIN' });
    },
  );

  /*
    THE NEWS PATH IS THE ONE THAT STILL STORES AN AGENT MESSAGE, and
    exactly one. buildSupportAi wires an analysis double that REJECTS, so
    what lands here is the honest fallback -- the worst case, and the one
    a stubbed agent would never have exercised.
  */
  it('a NEWS_QUESTION receives exactly ONE agent message, and it is substantive', async () => {
    const store = emptyStore();
    const { prisma } = buildPrismaDouble(store);

    const detail = await new SupportService(prisma, buildSupportAi()).createTicket('user-1', {
      ...NEW_TICKET,
      category: NEWS_CATEGORY,
    });

    expect(detail.messages).toHaveLength(2);
    expect(detail.messages.map((message) => message.authorType)).toEqual(['USER', 'SYSTEM_AI']);
    expect(detail.messageCount).toBe(2);

    // SYSTEM_AI, never ADMIN, and with no author id: no account wrote it.
    expect(store.messages[1]).toMatchObject({
      authorType: 'SYSTEM_AI',
      authorId: null,
      visibility: 'PUBLIC',
    });

    /*
      AND IT IS NOT AN ACKNOWLEDGEMENT. The provider is unavailable here,
      so this is the fallback -- which says an answer could not be
      produced, not that the request was received.
    */
    expect(store.messages[1].body).not.toMatch(/has been received/i);
    expect(store.messages[1].body).toMatch(/could not produce an answer/i);
    expect(detail.status).toBe('AWAITING_ADMIN');
  });

  it('the agent message is written in the requested language', async () => {
    const store = emptyStore();
    const { prisma } = buildPrismaDouble(store);

    const detail = await new SupportService(prisma, buildSupportAi()).createTicket('user-1', {
      ...NEW_TICKET,
      category: NEWS_CATEGORY,
      language: 'pl',
    });

    expect(detail.messages[1].body).toMatch(/Nie udało mi się przygotować odpowiedzi/i);
  });

  it('runs the whole creation inside ONE serializable transaction', async () => {
    const store = emptyStore();
    const { prisma, stats } = buildPrismaDouble(store);

    await new SupportService(prisma, buildSupportAi()).createTicket('user-1', NEW_TICKET);

    expect(stats().attempts).toBe(1);
    expect(stats().isolationLevels).toEqual(['Serializable']);
  });

  it('writes NEITHER row when the transaction fails — no orphan ticket, no orphan message', async () => {
    const store = emptyStore();
    const { prisma } = buildPrismaDouble(store, {
      failAttempts: ['P2002-other'],
    });

    await expect(
      new SupportService(prisma, buildSupportAi()).createTicket('user-1', NEW_TICKET),
    ).rejects.toMatchObject({ code: 'P2002' });

    expect(store.tickets).toHaveLength(0);
    expect(store.messages).toHaveLength(0);
  });
});

describe('S2 — the open-ticket cap is atomic', () => {
  const fill = (store: Store, userId: string, count: number, status = 'OPEN'): void => {
    for (let index = 0; index < count; index += 1) {
      store.tickets.push({
        id: `seed-${userId}-${index}`,
        reference: `GN-SEED${String(index).padStart(6, '0')}`,
        userId,
        category: 'OTHER',
        status,
        subject: 'seeded',
        createdAt: new Date(Date.UTC(2026, 7, 22)),
        updatedAt: new Date(Date.UTC(2026, 7, 22)),
      });
    }
  };

  it('refuses the request past the cap, with 429 and no write', async () => {
    const store = emptyStore();
    fill(store, 'user-1', MAX_OPEN_TICKETS_PER_USER);
    const { prisma } = buildPrismaDouble(store);

    await expect(
      new SupportService(prisma, buildSupportAi()).createTicket('user-1', NEW_TICKET),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });

    expect(store.tickets).toHaveLength(MAX_OPEN_TICKETS_PER_USER);
    expect(store.messages).toHaveLength(0);
  });

  it('does not count RESOLVED tickets — history never locks an account out', async () => {
    const store = emptyStore();
    fill(store, 'user-1', 40, 'RESOLVED');
    const { prisma } = buildPrismaDouble(store);

    await expect(
      new SupportService(prisma, buildSupportAi()).createTicket('user-1', NEW_TICKET),
    ).resolves.toBeDefined();
  });

  it("counts only the caller's tickets", async () => {
    const store = emptyStore();
    fill(store, 'someone-else', MAX_OPEN_TICKETS_PER_USER);
    const { prisma } = buildPrismaDouble(store);

    await expect(
      new SupportService(prisma, buildSupportAi()).createTicket('user-1', NEW_TICKET),
    ).resolves.toBeDefined();
  });

  /**
   * THE CONCURRENCY REGRESSION.
   *
   * Two requests both read nine open tickets and both try to insert the
   * tenth and eleventh. Under SERIALIZABLE isolation PostgreSQL sees
   * that each transaction wrote a row matching the other's count
   * predicate and aborts one with a serialization failure (SQLSTATE
   * 40001 → Prisma P2034). That abort is injected here, and the
   * competing ticket is committed by "the other request" at the same
   * moment.
   *
   * What this proves: when the database does its job, the service's
   * retry RE-COUNTS rather than trusting its earlier read, sees the cap
   * is now reached, and refuses. The invariant survives.
   *
   * What this does not prove: that PostgreSQL raises 40001. That is the
   * database's contract, verified on the native gate, and the reason
   * the isolation level is asserted separately above.
   */
  it('cannot exceed the cap when a competing request commits mid-flight', async () => {
    const store = emptyStore();
    fill(store, 'user-1', MAX_OPEN_TICKETS_PER_USER - 1);

    const { prisma, stats } = buildPrismaDouble(store, {
      failAttempts: ['P2034'],
      afterRollback: (attempt, current) => {
        if (attempt === 1) {
          // The competing request's ticket is now committed and takes
          // the last slot. It survives this transaction's rollback
          // because it was never part of this transaction.
          current.tickets.push({
            id: 'competitor',
            reference: 'GN-COMPETE01',
            userId: 'user-1',
            category: 'OTHER',
            status: 'OPEN',
            subject: 'from the competing request',
            createdAt: new Date(Date.UTC(2026, 7, 22)),
            updatedAt: new Date(Date.UTC(2026, 7, 22)),
          });
        }
      },
    });

    await expect(
      new SupportService(prisma, buildSupportAi()).createTicket('user-1', NEW_TICKET),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });

    expect(stats().attempts).toBe(2);
    expect(store.tickets.filter((ticket) => ticket.status !== 'RESOLVED')).toHaveLength(
      MAX_OPEN_TICKETS_PER_USER,
    );
  });
});

describe('S2 — bounded retry', () => {
  it('retries a reference collision with a DIFFERENT reference and succeeds', async () => {
    const store = emptyStore();
    const { prisma, stats } = buildPrismaDouble(store, { failAttempts: ['P2002-reference'] });

    const summary = await new SupportService(prisma, buildSupportAi()).createTicket(
      'user-1',
      NEW_TICKET,
    );

    expect(stats().attempts).toBe(2);
    expect(store.tickets).toHaveLength(1);
    expect(summary.reference).toBe(store.tickets[0].reference);
  });

  it('retries a write conflict and succeeds', async () => {
    const store = emptyStore();
    const { prisma, stats } = buildPrismaDouble(store, { failAttempts: ['P2034'] });

    await expect(
      new SupportService(prisma, buildSupportAi()).createTicket('user-1', NEW_TICKET),
    ).resolves.toBeDefined();
    expect(stats().attempts).toBe(2);
  });

  /**
   * THE REGRESSION FOR THE NATIVE-GATE FAILURE.
   *
   * A serialization failure detected at COMMIT arrives as a
   * DriverAdapterError with no error code. The original predicate tested
   * only `code === 'P2034'`, so this shape was judged non-retryable and
   * reached the caller as an unhandled error instead of the intended
   * 429. Both shapes must retry, and both must spend the same budget.
   */
  it('retries the COMMIT-TIME conflict — a DriverAdapterError with no Prisma code', async () => {
    const store = emptyStore();
    const { prisma, stats } = buildPrismaDouble(store, { failAttempts: ['P2034-commit-time'] });

    await expect(
      new SupportService(prisma, buildSupportAi()).createTicket('user-1', NEW_TICKET),
    ).resolves.toBeDefined();
    expect(stats().attempts).toBe(2);
    expect(store.tickets).toHaveLength(1);
  });

  it('retries when SQLSTATE 40001 is reachable only through a nested cause', async () => {
    const store = emptyStore();
    const { prisma, stats } = buildPrismaDouble(store, {
      failAttempts: ['P2034-nested-sqlstate'],
    });

    await expect(
      new SupportService(prisma, buildSupportAi()).createTicket('user-1', NEW_TICKET),
    ).resolves.toBeDefined();
    expect(stats().attempts).toBe(2);
  });

  it('retries a MIXTURE of both shapes against the one shared budget', async () => {
    const store = emptyStore();
    const { prisma, stats } = buildPrismaDouble(store, {
      failAttempts: ['P2034', 'P2034-commit-time', 'P2034-nested-sqlstate'],
    });

    await expect(
      new SupportService(prisma, buildSupportAi()).createTicket('user-1', NEW_TICKET),
    ).resolves.toBeDefined();
    expect(stats().attempts).toBe(4);
    expect(store.tickets).toHaveLength(1);
  });

  it('gives up on the commit-time shape at five attempts too — the budget is shared, not per-shape', async () => {
    const store = emptyStore();
    const { prisma, stats } = buildPrismaDouble(store, {
      failAttempts: [
        'P2034-commit-time',
        'P2034-commit-time',
        'P2034-commit-time',
        'P2034-commit-time',
        'P2034-commit-time',
        'P2034-commit-time',
      ],
    });

    await expect(
      new SupportService(prisma, buildSupportAi()).createTicket('user-1', NEW_TICKET),
    ).rejects.toMatchObject({ name: 'DriverAdapterError', message: 'TransactionWriteConflict' });

    expect(stats().attempts).toBe(5);
    expect(store.tickets).toHaveLength(0);
  });

  it('does NOT retry a DriverAdapterError that is not a serialization failure', async () => {
    const store = emptyStore();
    const { prisma, stats } = buildPrismaDouble(store, { failAttempts: ['driver-other'] });

    await expect(
      new SupportService(prisma, buildSupportAi()).createTicket('user-1', NEW_TICKET),
    ).rejects.toMatchObject({ name: 'DriverAdapterError', message: 'ConnectionClosed' });

    expect(stats().attempts).toBe(1);
  });

  it('gives up after five attempts rather than looping forever', async () => {
    const store = emptyStore();
    const { prisma, stats } = buildPrismaDouble(store, {
      failAttempts: ['P2034', 'P2034', 'P2034', 'P2034', 'P2034', 'P2034'],
    });

    await expect(
      new SupportService(prisma, buildSupportAi()).createTicket('user-1', NEW_TICKET),
    ).rejects.toMatchObject({ code: 'P2034' });

    expect(stats().attempts).toBe(5);
  });

  it('does NOT swallow an unrelated unique violation', async () => {
    const store = emptyStore();
    const { prisma, stats } = buildPrismaDouble(store, { failAttempts: ['P2002-other'] });

    await expect(
      new SupportService(prisma, buildSupportAi()).createTicket('user-1', NEW_TICKET),
    ).rejects.toMatchObject({ code: 'P2002', meta: { target: ['tokenHash'] } });

    expect(stats().attempts).toBe(1);
  });

  it('does NOT retry the cap refusal — a decision is not a failure', async () => {
    const store = emptyStore();
    for (let index = 0; index < MAX_OPEN_TICKETS_PER_USER; index += 1) {
      store.tickets.push({
        id: `seed-${index}`,
        reference: `GN-SEEDX${String(index).padStart(5, '0')}`,
        userId: 'user-1',
        category: 'OTHER',
        status: 'OPEN',
        subject: 'seeded',
        createdAt: new Date(Date.UTC(2026, 7, 22)),
        updatedAt: new Date(Date.UTC(2026, 7, 22)),
      });
    }
    const { prisma, stats } = buildPrismaDouble(store);

    await expect(
      new SupportService(prisma, buildSupportAi()).createTicket('user-1', NEW_TICKET),
    ).rejects.toBeInstanceOf(HttpException);
    expect(stats().attempts).toBe(1);
  });
});

describe('S2 — reading tickets', () => {
  const seed = async (store: Store): Promise<SupportService> => {
    const { prisma } = buildPrismaDouble(store);
    const service = new SupportService(prisma, buildSupportAi());
    await service.createTicket('user-1', NEW_TICKET);
    await service.createTicket('user-2', { ...NEW_TICKET, subject: 'Another persons ticket' });
    return service;
  };

  it('lists only the caller’s own tickets', async () => {
    const store = emptyStore();
    const service = await seed(store);

    const mine = await service.listTickets('user-1');
    const theirs = await service.listTickets('user-2');

    expect(mine).toHaveLength(1);
    expect(theirs).toHaveLength(1);
    expect(mine[0].reference).not.toBe(theirs[0].reference);
    expect(mine[0].subject).toBe(NEW_TICKET.subject);
  });

  it('returns an empty list rather than an error for a user with no tickets', async () => {
    const store = emptyStore();
    const service = await seed(store);

    await expect(service.listTickets('user-3')).resolves.toEqual([]);
  });

  it('returns the ticket and its conversation to its owner', async () => {
    const store = emptyStore();
    const service = await seed(store);
    const [summary] = await service.listTickets('user-1');

    const detail = await service.getTicket('user-1', summary.reference);

    expect(detail.reference).toBe(summary.reference);
    // Two: the requester's message and the agent's first response.
    // A BUG_REPORT thread is the requester's message and nothing else
    // until a human or the requester adds to it.
    expect(detail.messages).toHaveLength(1);
    expect(detail.messages[0]).toMatchObject({ authorType: 'USER', body: NEW_TICKET.message });
  });

  it('never exposes authorId or visibility in the message view', async () => {
    const store = emptyStore();
    const service = await seed(store);
    const [summary] = await service.listTickets('user-1');

    const detail = await service.getTicket('user-1', summary.reference);

    expect(Object.keys(detail.messages[0]).sort()).toEqual([
      'authorType',
      'body',
      'createdAt',
      'id',
    ]);
  });

  it('tolerates a message with a null author — the shape a SYSTEM_AI reply will have', async () => {
    const store = emptyStore();
    const service = await seed(store);
    const [summary] = await service.listTickets('user-1');
    const ticket = store.tickets.find((row) => row.reference === summary.reference);

    store.messages.push({
      id: 'machine-1',
      ticketId: ticket?.id ?? '',
      authorType: 'SYSTEM_AI',
      authorId: null,
      visibility: 'PUBLIC',
      body: 'A machine-authored answer.',
      createdAt: new Date(Date.UTC(2026, 7, 22, 13)),
    });

    const detail = await service.getTicket('user-1', summary.reference);

    // Three now: the requester's message, the agent's first response, and
    // the seeded machine-authored answer this test appends itself.
    expect(detail.messages).toHaveLength(2);
    expect(detail.messages[1].authorType).toBe('SYSTEM_AI');
    expect(detail.messages[1].body).toBe('A machine-authored answer.');
  });
});

describe('S2 — replying', () => {
  const openTicket = async (
    store: Store,
  ): Promise<{ service: SupportService; reference: string }> => {
    const { prisma } = buildPrismaDouble(store);
    const service = new SupportService(prisma, buildSupportAi());
    const summary = await service.createTicket('user-1', NEW_TICKET);
    return { service, reference: summary.reference };
  };

  it('appends the reply as a PUBLIC message authored by the owner', async () => {
    const store = emptyStore();
    const { service, reference } = await openTicket(store);

    const detail = await service.addMessage('user-1', reference, 'Still happening this morning.');

    // The requester's original and the reply. Nothing else is stored on
    // a BUG_REPORT thread.
    expect(detail.messages).toHaveLength(2);
    expect(store.messages[1]).toMatchObject({
      authorType: 'USER',
      authorId: 'user-1',
      visibility: 'PUBLIC',
    });
  });

  it('moves the ticket to AWAITING_ADMIN', async () => {
    const store = emptyStore();
    const { service, reference } = await openTicket(store);

    const detail = await service.addMessage('user-1', reference, 'Any news on this?');

    expect(detail.status).toBe('AWAITING_ADMIN');
  });

  it('REOPENS a resolved ticket — every valid reply lands in the admin queue', async () => {
    const store = emptyStore();
    const { service, reference } = await openTicket(store);
    const ticket = store.tickets.find((row) => row.reference === reference);
    if (ticket) ticket.status = 'RESOLVED';

    const detail = await service.addMessage('user-1', reference, 'This came back again today.');

    expect(detail.status).toBe('AWAITING_ADMIN');
    expect(detail.messages).toHaveLength(2);
  });

  it('bumps updatedAt even when the status is already AWAITING_ADMIN', async () => {
    const store = emptyStore();
    const { service, reference } = await openTicket(store);
    await service.addMessage('user-1', reference, 'First follow-up message.');
    const afterFirst = store.tickets[0].updatedAt.getTime();

    await service.addMessage('user-1', reference, 'Second follow-up message.');

    expect(store.tickets[0].status).toBe('AWAITING_ADMIN');
    expect(store.tickets[0].updatedAt.getTime()).toBeGreaterThan(afterFirst);
  });

  it('a reply never changes the ticket owner or its category', async () => {
    const store = emptyStore();
    const { service, reference } = await openTicket(store);

    await service.addMessage('user-1', reference, 'Adding more detail here.');

    expect(store.tickets[0].userId).toBe('user-1');
    expect(store.tickets[0].category).toBe('BUG_REPORT');
  });

  it('rejects a reply to a reference that does not exist', async () => {
    const store = emptyStore();
    const { service } = await openTicket(store);

    await expect(service.addMessage('user-1', 'GN-ZZZZZZZZZZ', 'Hello?')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
