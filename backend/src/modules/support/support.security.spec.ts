import { readFileSync } from 'fs';
import { join } from 'path';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service';
import { SupportService } from './support.service';
import { SupportAiService } from './support-ai.service';
import type { AnalysisService } from '../analysis/service/analysis.service';
import type { ConfigService } from '@nestjs/config';

/**
 * A real SupportAiService with an analysis double that REJECTS.
 *
 * DEFINED LOCALLY RATHER THAN IMPORTED FROM support.service.spec.
 * Importing a .spec module re-registers every test it declares inside
 * the importing suite, so sharing this six-line helper across files
 * would have run sixty-seven unrelated tests twice more per run. The
 * codebase already pays that cost once, deliberately, for the loop
 * spec's shared Prisma double; it is not worth paying again for this.
 */
function buildSupportAi(): SupportAiService {
  const analysis = {
    analyzeNews: (): Promise<never> => Promise.reject(new Error('analysis unavailable in test')),
  } as unknown as AnalysisService;

  return new SupportAiService(analysis, {
    get: (key: string): string | undefined => (key === 'SUPPORT_AI_ENABLED' ? 'true' : undefined),
  } as unknown as ConfigService);
}

/**
 * S2 — the ownership and privacy guarantees, which are the only part of
 * this milestone that cannot be fixed later without a breach first.
 *
 * The invariant, in the CTO's words: every ownership-sensitive
 * SupportTicket read or update is scoped to the authenticated userId,
 * and no SupportMessage operation happens unless ownership of its
 * parent ticket has already been established inside the protected
 * service flow.
 *
 * Behaviour is proven first and structure second. A structural check is
 * a guard against a future edit, never the guarantee itself — the
 * guarantee is that a foreign ticket produces nothing, which the
 * behavioural tests below demonstrate against a store that would
 * happily hand over another user's rows if the service asked for them.
 */

interface Row {
  [key: string]: unknown;
}

/**
 * A deliberately UNHELPFUL double: it applies exactly the filters the
 * service asks for and nothing more. If the service forgot `userId`,
 * this store would return another user's ticket — which is precisely
 * why these tests mean something.
 */
function buildStore() {
  const tickets: Row[] = [];
  const messages: Row[] = [];
  let sequence = 0;

  const matches = (row: Row, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([key, value]) => row[key] === value);

  const publicOf = (ticketId: unknown): Row[] =>
    messages.filter((message) => message.ticketId === ticketId && message.visibility === 'PUBLIC');

  const client = {
    supportTicket: {
      count: () => Promise.resolve(0),
      create: ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = {
          id: `t-${(sequence += 1)}`,
          createdAt: new Date(0),
          updatedAt: new Date(0),
          ...data,
        };
        tickets.push(row);
        return Promise.resolve(row);
      },
      findMany: ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          tickets
            .filter((ticket) => matches(ticket, where))
            .map((ticket) => ({ ...ticket, _count: { messages: publicOf(ticket.id).length } })),
        ),
      findFirst: ({
        where,
        select,
      }: {
        where: Record<string, unknown>;
        select?: { messages?: { where?: { visibility?: string } } };
      }) => {
        const ticket = tickets.find((row) => matches(row, where));
        if (!ticket) return Promise.resolve(null);
        if (!select?.messages) return Promise.resolve(ticket);

        const visibility = select.messages.where?.visibility;
        const scoped = messages.filter(
          (message) =>
            message.ticketId === ticket.id &&
            (visibility === undefined || message.visibility === visibility),
        );
        return Promise.resolve({ ...ticket, messages: scoped });
      },
      update: ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const ticket = tickets.find((row) => matches(row, where));
        if (!ticket) return Promise.reject(new Error('no such ticket'));
        Object.assign(ticket, data, { updatedAt: new Date(1000) });
        return Promise.resolve(ticket);
      },
    },
    supportMessage: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        const ticketId =
          data.ticketId ??
          tickets.find(
            (ticket) =>
              ticket.reference ===
              (data.ticket as { connect?: { reference?: string } })?.connect?.reference,
          )?.id;
        const row: Row = { id: `m-${(sequence += 1)}`, createdAt: new Date(0), ...data, ticketId };
        messages.push(row);
        return Promise.resolve(row);
      },
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(client),
  };

  return { prisma: client as unknown as PrismaService, tickets, messages };
}

const TICKET = {
  category: 'ACCOUNT_PROBLEM' as const,
  subject: 'I cannot change my display name',
  message: 'The display name field does not save when I press enter.',
};

describe('S2 — cross-user access is impossible', () => {
  it('one user’s list never contains another user’s ticket', async () => {
    const { prisma } = buildStore();
    const service = new SupportService(prisma, buildSupportAi());

    await service.createTicket('owner', TICKET);
    await service.createTicket('intruder', { ...TICKET, subject: 'The intruder’s own ticket' });

    const intruderList = await service.listTickets('intruder');

    expect(intruderList).toHaveLength(1);
    expect(intruderList[0].subject).toBe('The intruder’s own ticket');
  });

  it('reading another user’s ticket by reference fails closed', async () => {
    const { prisma } = buildStore();
    const service = new SupportService(prisma, buildSupportAi());
    const owned = await service.createTicket('owner', TICKET);

    await expect(service.getTicket('intruder', owned.reference)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('a foreign ticket and a nonexistent ticket are INDISTINGUISHABLE', async () => {
    const { prisma } = buildStore();
    const service = new SupportService(prisma, buildSupportAi());
    const owned = await service.createTicket('owner', TICKET);

    const foreign = await service.getTicket('intruder', owned.reference).catch((error) => error);
    const missing = await service.getTicket('intruder', 'GN-ZZZZZZZZZZ').catch((error) => error);

    // Same class, same status, same serialized body — nothing in the
    // response tells the caller whether the ticket exists.
    expect(foreign.constructor).toBe(missing.constructor);
    expect(foreign.getStatus()).toBe(missing.getStatus());
    expect(JSON.stringify(foreign.getResponse())).toBe(JSON.stringify(missing.getResponse()));
  });

  it('a cross-user reply CREATES NO MESSAGE — it never reaches the insert', async () => {
    const { prisma, messages } = buildStore();
    const service = new SupportService(prisma, buildSupportAi());
    const owned = await service.createTicket('owner', TICKET);
    const before = messages.length;

    await expect(
      service.addMessage('intruder', owned.reference, 'Let me in.'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(messages).toHaveLength(before);
    expect(messages.some((message) => message.authorId === 'intruder')).toBe(false);
  });

  it('a cross-user reply does not change the ticket’s status either', async () => {
    const { prisma, tickets } = buildStore();
    const service = new SupportService(prisma, buildSupportAi());
    const owned = await service.createTicket('owner', TICKET);

    await expect(service.addMessage('intruder', owned.reference, 'Let me in.')).rejects.toThrow();

    // AWAITING_ADMIN since SUPPORT-AI-1; the point of this test is that
    // the cross-user reply changed NOTHING, whatever the resting state is.
    expect(tickets[0].status).toBe('AWAITING_ADMIN');
  });
});

describe('S2 — internal notes are never disclosed to the ticket owner', () => {
  it('an INTERNAL message on the user’s OWN ticket is absent from the detail', async () => {
    const { prisma, tickets, messages } = buildStore();
    const service = new SupportService(prisma, buildSupportAi());
    const owned = await service.createTicket('owner', TICKET);

    messages.push({
      id: 'note-1',
      ticketId: tickets[0].id,
      authorType: 'ADMIN',
      authorId: 'admin-9',
      visibility: 'INTERNAL',
      body: 'Internal note: suspected duplicate of an earlier report.',
      createdAt: new Date(0),
    });

    const detail = await service.getTicket('owner', owned.reference);

    // ONE visible message -- the requester's own -- and the internal
    // note is not it. R4 SUPPORT UX CLOSURE removed the automated
    // acknowledgement that used to make this two.
    expect(detail.messages).toHaveLength(1);
    expect(detail.messages.map((message) => message.authorType)).toEqual(['USER']);
    expect(JSON.stringify(detail)).not.toContain('Internal note');
    expect(JSON.stringify(detail)).not.toContain('admin-9');
  });

  it('the INTERNAL message is not counted in the list either', async () => {
    const { prisma, tickets, messages } = buildStore();
    const service = new SupportService(prisma, buildSupportAi());
    await service.createTicket('owner', TICKET);

    messages.push({
      id: 'note-2',
      ticketId: tickets[0].id,
      authorType: 'ADMIN',
      authorId: 'admin-9',
      visibility: 'INTERNAL',
      body: 'Another internal note.',
      createdAt: new Date(0),
    });

    const [summary] = await service.listTickets('owner');

    // One visible: the requester's own. Not the note.
    expect(summary.messageCount).toBe(1);
  });

  it('the filter is applied by the QUERY, not by the mapper', async () => {
    // The store above only filters when the service asks it to. If the
    // service dropped `visibility` from the where clause, the INTERNAL
    // row would come back and this test would fail — which is the
    // difference between filtering at the database and hiding in code.
    const { prisma, tickets, messages } = buildStore();
    const service = new SupportService(prisma, buildSupportAi());
    const owned = await service.createTicket('owner', TICKET);

    messages.push({
      id: 'note-3',
      ticketId: tickets[0].id,
      authorType: 'ADMIN',
      authorId: 'admin-9',
      visibility: 'INTERNAL',
      body: 'Third internal note.',
      createdAt: new Date(0),
    });

    const detail = await service.getTicket('owner', owned.reference);

    expect(detail.messages.every((message) => message.body !== 'Third internal note.')).toBe(true);
  });
});

describe('S2 — structural guards against a future edit', () => {
  const read = (name: string): string => readFileSync(join(__dirname, name), 'utf-8');
  const stripComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  const service = stripComments(read('support.service.ts'));
  const controller = stripComments(read('support.controller.ts'));
  const dto = stripComments(read('dto/support.dto.ts'));

  it('every ownership-sensitive ticket read is scoped to userId', () => {
    // findMany and findFirst are the two ticket reads on a user path.
    const reads =
      service.match(/supportTicket\.(findMany|findFirst)\(\{[\s\S]*?where: \{[^}]*\}/g) ?? [];

    expect(reads.length).toBeGreaterThanOrEqual(2);
    reads.forEach((read_) => {
      expect({ read_, scoped: read_.includes('userId') }).toEqual({ read_, scoped: true });
    });
  });

  it('every message read filters visibility at the query level', () => {
    const messageReads = service.match(/messages: \{[\s\S]*?where: \{[^}]*\}/g) ?? [];
    const counts = service.match(/_count: \{[\s\S]*?\}\s*\}/g) ?? [];

    expect(messageReads.length).toBeGreaterThanOrEqual(1);
    messageReads.forEach((read_) => {
      expect({ read_, filtered: read_.includes("visibility: 'PUBLIC'") }).toEqual({
        read_,
        filtered: true,
      });
    });
    counts.forEach((count) => {
      expect({ count, filtered: count.includes("visibility: 'PUBLIC'") }).toEqual({
        count,
        filtered: true,
      });
    });
  });

  it('every message create is preceded by a ticket lookup inside the same transaction', () => {
    // Every create lives inside a $transaction callback, and in each the
    // ticket is established first — either by being created in that
    // same block, or by an ownership-scoped findFirst.
    //
    // SUPPORT-AI-1 adds a third: the agent's answer. It follows the same
    // rule as the other two rather than being exempted from it, which is
    // why this number moved and the assertion below did not.
    const transactions = service.split('$transaction').slice(1);

    expect(transactions).toHaveLength(3);
    transactions.forEach((block) => {
      const messageAt = block.indexOf('supportMessage.create');
      const ticketAt = Math.min(
        ...['supportTicket.create', 'supportTicket.findFirst']
          .map((marker) => block.indexOf(marker))
          .filter((index) => index !== -1),
      );

      expect(messageAt).toBeGreaterThan(-1);
      expect(ticketAt).toBeLessThan(messageAt);
    });
  });

  it('no message operation happens outside a transaction', () => {
    const outsideTransactions = service.split('$transaction')[0];
    expect(outsideTransactions).not.toContain('supportMessage');
  });

  it('no request contract accepts identity, visibility or status', () => {
    // These four are what a request must never be able to say. Ownership
    // comes from the session and status is derived by the server, so a
    // browser cannot express either — the global forbidNonWhitelisted
    // rejects the request outright rather than ignoring the field.
    ['userId', 'authorId', 'visibility', 'status'].forEach((forbidden) => {
      expect({ forbidden, present: dto.includes(forbidden) }).toEqual({
        forbidden,
        present: false,
      });
    });
  });

  it('the only identifier a request may carry is the ticket reference', () => {
    expect(dto).toMatch(/reference!: string;/);
    expect(dto).toContain('SUPPORT_REFERENCE_PATTERN');
  });

  it('the controller takes the user only from @CurrentUser, never from the body', () => {
    expect(controller).toContain('@CurrentUser()');
    expect(controller).not.toMatch(/body\.userId|params\.userId|query\.userId/);
  });

  it('every route is authenticated, and every mutation is CSRF-guarded', () => {
    expect(controller).toMatch(/@Controller\('support'\)\s*@UseGuards\(RequireAuthGuard\)/);

    const routes = controller.split(/@(?=Get\(|Post\(|Put\(|Patch\(|Delete\()/).slice(1);
    expect(routes).toHaveLength(4);

    routes
      .filter((route) => route.startsWith('Post('))
      .forEach((route) => {
        expect({ route: route.slice(0, 40), csrf: route.includes('CsrfGuard') }).toEqual({
          route: route.slice(0, 40),
          csrf: true,
        });
      });
  });

  it('S2 exposes no mutating verb other than POST, and no admin route', () => {
    expect(controller).not.toMatch(/@(Put|Patch|Delete)\(/);
    expect(controller).not.toMatch(/'admin/);
  });

  it('S2 performs no AI work and imports no analysis code', () => {
    [service, controller, dto].forEach((source) => {
      expect(source).not.toMatch(/AnalysisService|AnalysisModule|openai|OpenAi/i);
      expect(source).not.toMatch(/NEWS_QUESTION/);
    });
  });
});
