import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service';
import { AdminSupportService } from './admin-support.service';

/**
 * S3 — the admin support service, exercised against an in-memory
 * PostgreSQL double in exactly the style S2 established.
 *
 * The double implements the SEMANTICS the service depends on — where
 * clauses, relation selects, transaction rollback, and the P2025 Prisma
 * raises when an update matches no row — so a passing test here is a
 * test about behaviour rather than about which mock was called.
 *
 * The one thing this file does NOT try to prove is who is allowed to
 * call these methods. That is AdminGuard's job and it is proven in
 * `admin-support.security.spec.ts` and `admin.guard.spec.ts`; asserting
 * it against a service that never sees a request would be theatre.
 */

interface TicketRow {
  id: string;
  reference: string;
  userId: string;
  category: string;
  status: string;
  subject: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MessageRow {
  id: string;
  ticketId: string;
  authorType: string;
  authorId: string | null;
  visibility: string;
  body: string;
  createdAt: Date;
}

interface Store {
  tickets: TicketRow[];
  messages: MessageRow[];
}

/** What Prisma raises when an `update` matches no row. */
class PrismaRecordNotFound extends Error {
  readonly code = 'P2025';
  constructor() {
    super(
      'An operation failed because it depends on one or more records that were required but not found.',
    );
  }
}

export function buildAdminPrismaDouble(store: Store) {
  let sequence = 0;
  const nextId = (): string => `id-${(sequence += 1)}`;
  const stamp = (): Date => new Date(Date.UTC(2026, 7, 22, 12, 0, (sequence += 1)));

  const messagesOf = (ticketId: string): MessageRow[] =>
    store.messages
      .filter((message) => message.ticketId === ticketId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const client = {
    supportTicket: {
      findMany: ({
        where,
        take,
      }: {
        where: { status?: string };
        take: number;
      }): Promise<unknown[]> =>
        Promise.resolve(
          store.tickets
            .filter((ticket) => where.status === undefined || ticket.status === where.status)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, take)
            .map((ticket) => ({
              ...ticket,
              messages: messagesOf(ticket.id).map((message) => ({
                visibility: message.visibility,
              })),
            })),
        ),

      findUnique: ({
        where,
        select,
      }: {
        where: { reference: string };
        select?: { messages?: unknown };
      }): Promise<unknown | null> => {
        const ticket = store.tickets.find((row) => row.reference === where.reference);
        if (!ticket) return Promise.resolve(null);
        if (!select?.messages) return Promise.resolve(ticket);
        return Promise.resolve({ ...ticket, messages: messagesOf(ticket.id) });
      },

      update: ({
        where,
        data,
      }: {
        where: { id?: string; reference?: string };
        data: { status: string };
      }): Promise<TicketRow> => {
        const ticket = store.tickets.find(
          (row) => row.id === where.id || row.reference === where.reference,
        );
        if (!ticket) return Promise.reject(new PrismaRecordNotFound());
        ticket.status = data.status;
        // The database's @updatedAt fires because the ROW is written.
        ticket.updatedAt = new Date(ticket.updatedAt.getTime() + 1000);
        return Promise.resolve(ticket);
      },
    },

    supportMessage: {
      create: ({ data }: { data: Record<string, unknown> }): Promise<MessageRow> => {
        const row: MessageRow = {
          id: nextId(),
          ticketId: data.ticketId as string,
          authorType: data.authorType as string,
          authorId: (data.authorId as string | null) ?? null,
          visibility: data.visibility as string,
          body: data.body as string,
          createdAt: stamp(),
        };
        store.messages.push(row);
        return Promise.resolve(row);
      },
    },

    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      const snapshot: Store = {
        tickets: store.tickets.map((ticket) => ({ ...ticket })),
        messages: store.messages.map((message) => ({ ...message })),
      };

      try {
        return await fn(client);
      } catch (error) {
        store.tickets = snapshot.tickets;
        store.messages = snapshot.messages;
        throw error;
      }
    },
  };

  return client as unknown as PrismaService;
}

export function seedTicket(
  store: Store,
  overrides: Partial<TicketRow> & { reference: string },
): TicketRow {
  const now = new Date(Date.UTC(2026, 7, 22, 9, 0, 0));
  const ticket: TicketRow = {
    id: `ticket-${store.tickets.length + 1}`,
    userId: 'user-1',
    category: 'BUG_REPORT',
    status: 'AWAITING_ADMIN',
    subject: 'Sign in fails after the second attempt',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  store.tickets.push(ticket);
  return ticket;
}

export function seedMessage(
  store: Store,
  message: Partial<MessageRow> & { ticketId: string },
): void {
  store.messages.push({
    id: `message-${store.messages.length + 1}`,
    authorType: 'USER',
    authorId: 'user-1',
    visibility: 'PUBLIC',
    body: 'Signing in with Google returns me to the home page without a session.',
    createdAt: new Date(Date.UTC(2026, 7, 22, 9, 0, store.messages.length)),
    ...message,
  });
}

export const emptyStore = (): Store => ({ tickets: [], messages: [] });

describe('S3 — the admin queue', () => {
  it('returns every ticket, not only one administrator’s', async () => {
    const store = emptyStore();
    seedTicket(store, { reference: 'GN-AAAAAAAAAA', userId: 'user-1' });
    seedTicket(store, { reference: 'GN-BBBBBBBBBB', userId: 'user-2' });

    const queue = await new AdminSupportService(buildAdminPrismaDouble(store)).queue();

    expect(queue.tickets.map((ticket) => ticket.reference).sort()).toEqual([
      'GN-AAAAAAAAAA',
      'GN-BBBBBBBBBB',
    ]);
  });

  it('counts what the requester can see and what they cannot, separately', async () => {
    const store = emptyStore();
    const ticket = seedTicket(store, { reference: 'GN-AAAAAAAAAA' });
    seedMessage(store, { ticketId: ticket.id, visibility: 'PUBLIC' });
    seedMessage(store, { ticketId: ticket.id, visibility: 'PUBLIC', authorType: 'ADMIN' });
    seedMessage(store, { ticketId: ticket.id, visibility: 'INTERNAL', authorType: 'ADMIN' });

    const queue = await new AdminSupportService(buildAdminPrismaDouble(store)).queue();

    expect(queue.tickets[0].publicMessageCount).toBe(2);
    expect(queue.tickets[0].internalNoteCount).toBe(1);
  });

  it('carries NO requester identity — the summary has no field for one', async () => {
    const store = emptyStore();
    seedTicket(store, { reference: 'GN-AAAAAAAAAA', userId: 'user-secret' });

    const queue = await new AdminSupportService(buildAdminPrismaDouble(store)).queue();

    expect(Object.keys(queue.tickets[0]).sort()).toEqual([
      'category',
      'createdAt',
      'internalNoteCount',
      'publicMessageCount',
      'reference',
      'status',
      'subject',
      'updatedAt',
    ]);
    expect(JSON.stringify(queue.tickets)).not.toContain('user-secret');
  });

  it('filters by status when one is given, and by nothing when none is', async () => {
    const store = emptyStore();
    seedTicket(store, { reference: 'GN-AAAAAAAAAA', status: 'RESOLVED' });
    seedTicket(store, { reference: 'GN-BBBBBBBBBB', status: 'AWAITING_ADMIN' });

    const service = new AdminSupportService(buildAdminPrismaDouble(store));

    expect((await service.queue('RESOLVED')).tickets.map((row) => row.reference)).toEqual([
      'GN-AAAAAAAAAA',
    ]);
    expect((await service.queue()).tickets).toHaveLength(2);
  });
});

describe('S3 — reading one ticket', () => {
  it('returns the FULL conversation, internal notes included', async () => {
    const store = emptyStore();
    const ticket = seedTicket(store, { reference: 'GN-AAAAAAAAAA' });
    seedMessage(store, { ticketId: ticket.id, visibility: 'PUBLIC', body: 'the user speaks' });
    seedMessage(store, {
      ticketId: ticket.id,
      visibility: 'INTERNAL',
      authorType: 'ADMIN',
      authorId: 'admin-9',
      body: 'the note nobody outside may read',
    });

    const detail = await new AdminSupportService(buildAdminPrismaDouble(store)).ticket(
      'GN-AAAAAAAAAA',
    );

    expect(detail.messages).toHaveLength(2);
    expect(detail.messages.map((message) => message.visibility)).toEqual(['PUBLIC', 'INTERNAL']);
    expect(detail.messages[1].body).toBe('the note nobody outside may read');
  });

  it('discloses the ADMIN author id and nulls the requester’s', async () => {
    const store = emptyStore();
    const ticket = seedTicket(store, { reference: 'GN-AAAAAAAAAA' });
    seedMessage(store, { ticketId: ticket.id, authorType: 'USER', authorId: 'user-secret' });
    seedMessage(store, { ticketId: ticket.id, authorType: 'ADMIN', authorId: 'admin-9' });

    const detail = await new AdminSupportService(buildAdminPrismaDouble(store)).ticket(
      'GN-AAAAAAAAAA',
    );

    expect(detail.messages[0].authorId).toBeNull();
    expect(detail.messages[1].authorId).toBe('admin-9');
    expect(JSON.stringify(detail)).not.toContain('user-secret');
  });

  it('a reference that does not exist is a bare 404', async () => {
    const service = new AdminSupportService(buildAdminPrismaDouble(emptyStore()));

    await expect(service.ticket('GN-ZZZZZZZZZZ')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('S3 — an administrator posting a message', () => {
  it('stores a PUBLIC reply as ADMIN and moves the ticket to AWAITING_USER', async () => {
    const store = emptyStore();
    seedTicket(store, { reference: 'GN-AAAAAAAAAA', status: 'AWAITING_ADMIN' });

    await new AdminSupportService(buildAdminPrismaDouble(store)).addMessage(
      'admin-9',
      'GN-AAAAAAAAAA',
      { visibility: 'PUBLIC', message: 'We have reproduced this and a fix is on the way.' },
    );

    expect(store.messages).toHaveLength(1);
    expect(store.messages[0]).toMatchObject({
      authorType: 'ADMIN',
      authorId: 'admin-9',
      visibility: 'PUBLIC',
    });
    expect(store.tickets[0].status).toBe('AWAITING_USER');
  });

  it('stores an INTERNAL note and changes NOTHING the requester can observe', async () => {
    const store = emptyStore();
    seedTicket(store, { reference: 'GN-AAAAAAAAAA', status: 'AWAITING_ADMIN' });
    const before = { ...store.tickets[0] };

    await new AdminSupportService(buildAdminPrismaDouble(store)).addMessage(
      'admin-9',
      'GN-AAAAAAAAAA',
      { visibility: 'INTERNAL', message: 'Probably the same cause as the other report.' },
    );

    expect(store.messages[0].visibility).toBe('INTERNAL');

    // Status unchanged, AND updatedAt unchanged. The second half matters:
    // updatedAt is visible to the requester on their own ticket, so
    // bumping it would tell them something happened behind the scenes.
    expect(store.tickets[0].status).toBe(before.status);
    expect(store.tickets[0].updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  it('writes NO message when the ticket does not exist', async () => {
    const store = emptyStore();
    const service = new AdminSupportService(buildAdminPrismaDouble(store));

    await expect(
      service.addMessage('admin-9', 'GN-ZZZZZZZZZZ', {
        visibility: 'PUBLIC',
        message: 'a reply to nothing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(store.messages).toHaveLength(0);
  });

  it('never writes SYSTEM_AI — an administrator’s message is authored as ADMIN', async () => {
    const store = emptyStore();
    seedTicket(store, { reference: 'GN-AAAAAAAAAA' });

    await new AdminSupportService(buildAdminPrismaDouble(store)).addMessage(
      'admin-9',
      'GN-AAAAAAAAAA',
      { visibility: 'PUBLIC', message: 'a human wrote this' },
    );

    expect(store.messages.map((message) => message.authorType)).toEqual(['ADMIN']);
  });
});

describe('S3 — status transitions', () => {
  it('resolving sets RESOLVED', async () => {
    const store = emptyStore();
    seedTicket(store, { reference: 'GN-AAAAAAAAAA', status: 'AWAITING_ADMIN' });

    const detail = await new AdminSupportService(buildAdminPrismaDouble(store)).setStatus(
      'GN-AAAAAAAAAA',
      'RESOLVED',
    );

    expect(store.tickets[0].status).toBe('RESOLVED');
    expect(detail.status).toBe('RESOLVED');
  });

  it('reopening sets AWAITING_ADMIN', async () => {
    const store = emptyStore();
    seedTicket(store, { reference: 'GN-AAAAAAAAAA', status: 'RESOLVED' });

    await new AdminSupportService(buildAdminPrismaDouble(store)).setStatus(
      'GN-AAAAAAAAAA',
      'AWAITING_ADMIN',
    );

    expect(store.tickets[0].status).toBe('AWAITING_ADMIN');
  });

  it('a status change on a nonexistent ticket is the same bare 404, not a P2025 leak', async () => {
    const service = new AdminSupportService(buildAdminPrismaDouble(emptyStore()));

    await expect(service.setStatus('GN-ZZZZZZZZZZ', 'RESOLVED')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('OPEN is never reachable from an administrator action', async () => {
    const store = emptyStore();
    seedTicket(store, { reference: 'GN-AAAAAAAAAA', status: 'AWAITING_ADMIN' });
    const service = new AdminSupportService(buildAdminPrismaDouble(store));

    // The only two values the DTO admits. Neither produces OPEN, and
    // there is no third branch in the service that could.
    await service.setStatus('GN-AAAAAAAAAA', 'RESOLVED');
    expect(store.tickets[0].status).not.toBe('OPEN');

    await service.setStatus('GN-AAAAAAAAAA', 'AWAITING_ADMIN');
    expect(store.tickets[0].status).not.toBe('OPEN');

    await service.addMessage('admin-9', 'GN-AAAAAAAAAA', {
      visibility: 'PUBLIC',
      message: 'a reply cannot reopen a ticket as OPEN either',
    });
    expect(store.tickets[0].status).not.toBe('OPEN');
  });
});
