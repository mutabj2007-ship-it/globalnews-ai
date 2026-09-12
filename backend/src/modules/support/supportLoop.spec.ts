import type { PrismaService } from '../../database/prisma.service';
import { SupportService } from './support.service';
import { AdminSupportService } from './admin-support.service';
import { buildPrismaDouble, emptyStore, type Store, buildSupportAi } from './support.service.spec';
import { buildAdminPrismaDouble } from './admin-support.service.spec';

/**
 * SUPPORT CLOSURE — THE CONTINUOUS LOOP, AS ONE SEQUENCE.
 *
 * Every layer of this surface was already proven separately: 28 user-service
 * tests, 21 user-security, 29 admin-security, 15 admin-service, 37 contract,
 * 13 reference. What none of them did was walk the whole thing end to end:
 *
 *   member of the public submits -> reference -> admin queue -> open thread
 *   -> internal note -> public reply -> status change -> the requester reads it
 *
 * The composition is the thing the CTO asked to validate, and composition is
 * exactly where separately-correct layers go wrong.
 *
 * ONE STORE, TWO REAL SERVICES, TWO EXISTING DOUBLES. Both services run for
 * real over a SINGLE shared store, using the doubles they are each already
 * tested against (buildPrismaDouble / buildAdminPrismaDouble) rather than a
 * third double written for this test. That matters: a bespoke double would
 * prove the loop against a fiction of my own making. These two are exercised
 * by 43 existing tests.
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT.
 * It proves the two services compose: that a reference minted by one is
 * resolvable by the other, that an admin's PUBLIC reply reaches the requester,
 * that an INTERNAL note does not, and that status moves as the contract says.
 * It does NOT prove PostgreSQL behaviour. The doubles honour `where` on
 * `userId` and `visibility` because they were written to, not because Postgres
 * does — that guarantee lives in the schema and in the native gate. Said
 * plainly here so a green run is never mistaken for a database proof.
 */

const REQUESTER = 'user-public-1';
const OTHER_USER = 'user-public-2';
const OPERATOR = 'admin-1';

function buildLoop(): {
  store: Store;
  user: SupportService;
  admin: AdminSupportService;
} {
  const store = emptyStore();

  // buildPrismaDouble returns { prisma, stats }; the admin builder returns the
  // client directly. Both shapes are the ones their own specs already use.
  const { prisma } = buildPrismaDouble(store);

  return {
    store,
    user: new SupportService(prisma, buildSupportAi()),
    admin: new AdminSupportService(buildAdminPrismaDouble(store) as unknown as PrismaService),
  };
}

describe('SUPPORT LOOP — public request to visible answer, as one continuous sequence', () => {
  it('walks the whole loop: submit, queue, reply, status, and the requester sees it', async () => {
    const { user, admin } = buildLoop();

    /* 1. A member of the public opens a request. */
    const created = await user.createTicket(REQUESTER, {
      category: 'BUG_REPORT',
      subject: 'The map does not load',
      message: 'The world map stays blank after signing in.',
    });

    expect(created.reference).toMatch(/^GN-[0-9A-HJKMNP-TV-Z]{10}$/);
    // A new ticket is not OPEN: a human owes an answer, which is
    // AWAITING_ADMIN. R4 SUPPORT UX CLOSURE removed the automated
    // acknowledgement, so the thread is exactly what the requester wrote
    // -- and the status, not a boilerplate message, is what says the
    // request arrived and is with a person.
    expect(created.status).toBe('AWAITING_ADMIN');
    expect(created.messages).toHaveLength(1);
    expect(created.messages.map((message) => message.authorType)).toEqual(['USER']);

    /* 2. It reaches the admin queue, and can be found by its reference. */
    const queue = await admin.queue();
    expect(queue.tickets.map((ticket) => ticket.reference)).toContain(created.reference);

    /* 3. The operator opens the conversation and sees what was written. */
    const opened = await admin.ticket(created.reference);
    expect(opened.messages.map((message) => message.body)).toContain(
      'The world map stays blank after signing in.',
    );

    /* 4. An INTERNAL note. The requester must learn nothing from it. */
    await admin.addMessage(OPERATOR, created.reference, {
      visibility: 'INTERNAL',
      message: 'Reproduced locally. Probably the tile fetch, not auth.',
    });

    const afterNote = await user.getTicket(REQUESTER, created.reference);
    expect(afterNote.messages.map((message) => message.body)).not.toContain(
      'Reproduced locally. Probably the tile fetch, not auth.',
    );
    // One: the requester's own message. The internal note is not among
    // them, which is the point.
    expect(afterNote.messages).toHaveLength(1);
    expect(afterNote.messages[0].authorType).toBe('USER');
    // An internal note is not a reply, so the ticket does not move to the
    // reader. It rests with the operator.
    expect(afterNote.status).toBe('AWAITING_ADMIN');

    /* 5. A PUBLIC reply. */
    await admin.addMessage(OPERATOR, created.reference, {
      visibility: 'PUBLIC',
      message: 'Thanks — we can reproduce it and are looking into it.',
    });

    /* 6. The requester sees the reply, attributed to ADMIN, and still not the note. */
    const afterReply = await user.getTicket(REQUESTER, created.reference);
    const bodies = afterReply.messages.map((message) => message.body);

    expect(bodies).toContain('Thanks — we can reproduce it and are looking into it.');
    expect(bodies).not.toContain('Reproduced locally. Probably the tile fetch, not auth.');
    // Two: the requester's message and the operator's reply.
    expect(afterReply.messages).toHaveLength(2);
    expect(afterReply.messages[1].authorType).toBe('ADMIN');
    expect(afterReply.status).toBe('AWAITING_USER');

    /* 7. The operator resolves the REQUEST. */
    await admin.setStatus(created.reference, 'RESOLVED');
    const afterResolve = await user.getTicket(REQUESTER, created.reference);
    expect(afterResolve.status).toBe('RESOLVED');

    /* 8. Replying reopens it — the reader is never trapped behind a status. */
    const afterReopen = await user.addMessage(
      REQUESTER,
      created.reference,
      'It is still blank this morning.',
    );
    expect(afterReopen.status).not.toBe('RESOLVED');
    // Three: the original, the operator reply, and the reply that
    // reopened it.
    expect(afterReopen.messages).toHaveLength(3);
  });

  it('the loop never leaks an internal note, at any step, in any read path', async () => {
    const { user, admin } = buildLoop();

    const created = await user.createTicket(REQUESTER, {
      category: 'ACCOUNT_PROBLEM',
      subject: 'Cannot change my email',
      message: 'The form rejects my new address.',
    });

    await admin.addMessage(OPERATOR, created.reference, {
      visibility: 'INTERNAL',
      message: 'INTERNAL-ONLY-CANARY',
    });

    // Every user-facing read, checked for the canary.
    const list = await user.listTickets(REQUESTER);
    const detail = await user.getTicket(REQUESTER, created.reference);
    const afterReply = await user.addMessage(REQUESTER, created.reference, 'Any news?');

    expect(JSON.stringify(list)).not.toContain('INTERNAL-ONLY-CANARY');
    expect(JSON.stringify(detail)).not.toContain('INTERNAL-ONLY-CANARY');
    expect(JSON.stringify(afterReply)).not.toContain('INTERNAL-ONLY-CANARY');

    // And the shape carries no visibility field the note could arrive through.
    expect(Object.keys(detail.messages[0])).not.toContain('visibility');
  });

  it('the message count the requester sees counts PUBLIC messages only', async () => {
    const { user, admin } = buildLoop();

    const created = await user.createTicket(REQUESTER, {
      category: 'FEEDBACK',
      subject: 'A suggestion',
      message: 'Please add a dark mode.',
    });

    await admin.addMessage(OPERATOR, created.reference, {
      visibility: 'INTERNAL',
      message: 'Low priority.',
    });

    const [summary] = await user.listTickets(REQUESTER);
    // One message: the requester's own. The internal note is not
    // counted, or the list would advertise the existence of
    // correspondence they cannot read.
    expect(summary.messageCount).toBe(1);
  });

  it("another user's reference is indistinguishable from one that does not exist", async () => {
    const { user } = buildLoop();

    const created = await user.createTicket(REQUESTER, {
      category: 'OTHER',
      subject: 'Mine',
      message: 'This belongs to the first user.',
    });

    const outcome = async (reference: string): Promise<string> =>
      user.getTicket(OTHER_USER, reference).then(
        () => 'resolved',
        (error: Error) => error.constructor.name,
      );

    const foreign = await outcome(created.reference);
    const missing = await outcome('GN-ZZZZZZZZZZ');

    expect(foreign).toBe(missing);
    expect(foreign).not.toBe('resolved');
  });

  it('the admin queue is NOT ownership-scoped — an operator sees every requester', async () => {
    const { user, admin } = buildLoop();

    await user.createTicket(REQUESTER, {
      category: 'NEWS_QUESTION',
      subject: 'First',
      message: 'A question from the first user.',
    });
    await user.createTicket(OTHER_USER, {
      category: 'NEWS_QUESTION',
      subject: 'Second',
      message: 'A question from the second user.',
    });

    const queue = await admin.queue();
    expect(queue.tickets).toHaveLength(2);
  });

  it('a status filter narrows the queue without hiding a ticket from its owner', async () => {
    const { user, admin } = buildLoop();

    const created = await user.createTicket(REQUESTER, {
      category: 'CONTENT_REPORT',
      subject: 'Report',
      message: 'Something needs review.',
    });

    await admin.setStatus(created.reference, 'RESOLVED');

    expect((await admin.queue('OPEN')).tickets).toHaveLength(0);
    expect((await admin.queue('RESOLVED')).tickets).toHaveLength(1);
    // The requester can still read their own resolved thread.
    expect((await user.getTicket(REQUESTER, created.reference)).status).toBe('RESOLVED');
  });
});
