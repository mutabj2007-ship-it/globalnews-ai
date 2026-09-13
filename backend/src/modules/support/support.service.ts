import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  SupportCategory,
  SupportMessageView,
  SupportTicketDetail,
  SupportTicketStatus,
  SupportTicketSummary,
} from '@globalnews-ai/shared';
import { PrismaService } from '../../database/prisma.service';
import { SupportAiService, creationStateFor, type SupportAiLanguage } from './support-ai.service';
import { generateSupportReference } from './support-reference.util';

/**
 * S2 — the user-facing support service.
 *
 * OWNERSHIP IS ENFORCED IN THE QUERY, NEVER AFTER IT. Every
 * ownership-sensitive SupportTicket read and update carries the
 * authenticated `userId` in its `where` clause, so a row that is not
 * the caller's is never loaded, never mapped and never serialized. No
 * method here accepts a user identifier as an argument from anywhere
 * except the controller's `@CurrentUser()`.
 *
 * NO SupportMessage OPERATION HAPPENS UNTIL OWNERSHIP OF ITS PARENT
 * TICKET IS ESTABLISHED. Messages have no `userId` of their own — they
 * belong to a user only through their ticket — so the child operation
 * is only ever reached after the parent lookup has succeeded, inside
 * the same transaction.
 *
 * INTERNAL NOTES ARE FILTERED AT THE DATABASE, NOT IN A MAPPER. Every
 * message read on a user path carries `visibility: 'PUBLIC'` in its
 * `where`. An INTERNAL row is not merely hidden — it is never loaded,
 * so no future change to a response shape, a log line or a serializer
 * can leak one.
 *
 * MISSING AND FOREIGN ARE INDISTINGUISHABLE. Both raise a bare
 * NotFoundException, producing a byte-identical 404. A 403 would
 * confirm that a ticket exists, which is exactly what an enumeration
 * attempt is trying to learn.
 */

/**
 * The maximum number of simultaneously-open tickets one account may
 * hold. RESOLVED tickets do not count, so a user is never permanently
 * locked out by their own history.
 *
 * This is the REAL abuse control, and the route throttle is only a
 * backstop. The throttler keys on client IP, and B1's proxy-aware
 * resolution fails closed: TRUST_PROXY defaults to false, so behind a
 * reverse proxy every user presents the proxy's address and shares one
 * bucket. An IP limit there is a shared-denial lever rather than an
 * abuse control — one abusive submitter would exhaust everyone's quota.
 * A per-user cap enforced against the database has no such property.
 */
export const MAX_OPEN_TICKETS_PER_USER = 10;

/**
 * Bounded, and bounded for two different reasons at once.
 *
 * A single attempt can fail because of a reference collision (P2002 on
 * the reference target) or because PostgreSQL aborted the serializable
 * transaction (P2034 write conflict). Both are retryable and both are
 * counted against the same budget. Anything else propagates untouched,
 * and exhausting the budget throws rather than looping.
 */
const MAX_CREATE_ATTEMPTS = 5;

/** Prisma error codes this service reacts to, and no others. */
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const TRANSACTION_WRITE_CONFLICT = 'P2034';

/**
 * PostgreSQL's serialization-failure SQLSTATE, and the driver adapter's
 * name for it.
 *
 * These exist because the SAME database error reaches this code in more
 * than one shape, which the live PostgreSQL gate demonstrated and no
 * amount of reasoning about the client would have revealed.
 */
const SERIALIZATION_FAILURE_SQLSTATE = '40001';
const DRIVER_WRITE_CONFLICT_KIND = 'TransactionWriteConflict';
const DRIVER_ADAPTER_ERROR_NAME = 'DriverAdapterError';

interface PrismaErrorLike {
  code?: unknown;
  name?: unknown;
  message?: unknown;
  meta?: { target?: unknown; driverAdapterError?: { cause?: DriverConflictCause } };
  cause?: DriverConflictCause;
}

interface DriverConflictCause {
  originalCode?: unknown;
  kind?: unknown;
}

/**
 * The driver adapter's own description of what went wrong, wherever the
 * client happened to put it on this error.
 */
function driverCauseOf(error: unknown): DriverConflictCause | undefined {
  const candidate = error as PrismaErrorLike;
  return candidate?.meta?.driverAdapterError?.cause ?? candidate?.cause;
}

/**
 * True only for a unique-constraint violation on the reference column.
 *
 * Deliberately narrow. A P2002 on any other target means something this
 * service does not understand has happened, and regenerating a
 * reference would neither fix it nor make it visible.
 */
function isReferenceCollision(error: unknown): boolean {
  const candidate = error as PrismaErrorLike;
  if (candidate?.code !== UNIQUE_CONSTRAINT_VIOLATION) return false;

  const target = candidate.meta?.target;
  if (Array.isArray(target)) return target.includes('reference');
  if (typeof target === 'string') return target.includes('reference');

  // A P2002 with no usable target is NOT assumed to be ours.
  return false;
}

/**
 * True for a PostgreSQL serialization failure, in every shape the live
 * gate actually observed — and for nothing else.
 *
 * WHY THIS IS NOT SIMPLY `code === 'P2034'`, WHICH IS WHAT IT USED TO BE.
 * The same SQLSTATE 40001 arrives differently depending on WHEN
 * PostgreSQL detects the conflict:
 *
 *   detected during a statement inside the transaction
 *     -> PrismaClientKnownRequestError, code 'P2034', with the driver's
 *        cause nested under meta.driverAdapterError.cause
 *
 *   detected at COMMIT
 *     -> DriverAdapterError, code UNDEFINED, message
 *        'TransactionWriteConflict' — Prisma never maps it to P2034,
 *        because it did not happen inside a modelled query
 *
 * The second shape was escaping the retry and surfacing to the user as
 * an unhandled error instead of the intended 429. It was found by
 * running the real race against real PostgreSQL; the in-memory tests
 * could not find it, because they injected the error shape this code
 * already expected.
 *
 * NARROWNESS IS DELIBERATE AND MATTERS MORE THAN COVERAGE HERE. Each
 * branch below matches an exact value: the mapped Prisma code, the
 * SQLSTATE itself, the driver's own kind, or a DriverAdapterError whose
 * message is exactly that kind. No substring matching, no name-prefix
 * matching, no "contains conflict" heuristic. A deadlock, a unique
 * violation, a connection failure or an unrelated DriverAdapterError is
 * NOT a serialization failure and must not be retried into silence.
 *
 * SQLSTATE 40001 is checked before either wrapper, because it is
 * PostgreSQL's own vocabulary and is the one thing here that cannot be
 * changed by a client or adapter release.
 */
function isWriteConflict(error: unknown): boolean {
  const candidate = error as PrismaErrorLike;

  if (candidate?.code === TRANSACTION_WRITE_CONFLICT) return true;

  const cause = driverCauseOf(error);
  if (cause?.originalCode === SERIALIZATION_FAILURE_SQLSTATE) return true;
  if (cause?.kind === DRIVER_WRITE_CONFLICT_KIND) return true;

  return (
    candidate?.name === DRIVER_ADAPTER_ERROR_NAME &&
    candidate?.message === DRIVER_WRITE_CONFLICT_KIND
  );
}

const iso = (value: Date): string => value.toISOString();

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supportAi: SupportAiService,
  ) {}

  /**
   * Create a ticket and its first message.
   *
   * THE OPEN-TICKET CAP IS ATOMIC, NOT ADVISORY. A plain
   * count-then-create at the default READ COMMITTED isolation is not
   * safe: two concurrent requests can both observe nine open tickets
   * and both insert, leaving eleven. The count and both inserts run in
   * ONE transaction at SERIALIZABLE isolation, where PostgreSQL's
   * predicate locking sees that each transaction inserted a row
   * matching the other's count predicate and aborts one with a
   * serialization failure — surfaced by Prisma as P2034. The retry then
   * re-counts, sees the committed ticket, and refuses.
   *
   * `@prisma/adapter-pg` issues `SET TRANSACTION ISOLATION LEVEL
   * SERIALIZABLE` for this option on the installed 7.9.1 stack, so this
   * is the real database isolation level and not a client-side
   * approximation.
   *
   * The abort reaches this loop in either of two shapes depending on
   * whether PostgreSQL detected the conflict mid-statement or at commit
   * — see isWriteConflict below. Both are retried against the same
   * budget; neither is allowed to reach the caller as an error.
   *
   * The 429 raised inside the transaction is a DECISION, not a failure:
   * it rolls the transaction back and propagates immediately. It is
   * neither a P2002 nor a P2034, so the retry filter never sees it as
   * retryable.
   */
  async createTicket(
    userId: string,
    input: {
      category: SupportCategory;
      subject: string;
      message: string;
      language?: SupportAiLanguage;
    },
  ): Promise<SupportTicketDetail> {
    const language: SupportAiLanguage = input.language === 'pl' ? 'pl' : 'en';

    /*
      R4 SUPPORT UX CLOSURE — CREATION STORES THE REQUESTER'S MESSAGE AND
      NOTHING ELSE.

      SUPPORT-AI-1 also wrote a deterministic per-category
      acknowledgement in this transaction. It has been removed. It said
      the request had arrived, which the ticket reference and the status
      already say, and it occupied the first reply slot in the one place
      the requester looks for a real answer. Six of the seven categories
      now store no agent message at all; a news question stores exactly
      one, and it is a substantive answer or an honest statement that
      none could be produced.

      What survived is the state decision that used to travel with that
      copy: every category opens in AWAITING_ADMIN.
    */
    const creation = creationStateFor(input.category);

    const reference = await this.createTicketRow(userId, input, creation);

    /*
      EVERYTHING BELOW HAPPENS AFTER THE REQUEST IS DURABLE, and nothing
      below can lose it. answerNewsQuestion never throws, the append is
      best-effort, and every failure path leaves a committed ticket
      carrying the requester's own message in AWAITING_ADMIN -- which is
      exactly where a request nobody could answer automatically belongs.
    */
    if (creation.analysisEligible) {
      await this.appendAiAnswer(userId, reference, input, language);
    }

    return this.getTicket(userId, reference);
  }

  /**
   * The transactional half: cap, ticket and the user's message, in one
   * SERIALIZABLE transaction.
   *
   * Returns the reference rather than a projection, because the caller
   * re-reads the thread through getTicket -- the SAME ownership-scoped,
   * PUBLIC-filtered read path every other user surface uses. Building a
   * second projection here would be a second place for an internal note
   * to leak from.
   */
  private async createTicketRow(
    userId: string,
    input: { category: SupportCategory; subject: string; message: string },
    creation: { status: SupportTicketStatus },
  ): Promise<string> {
    for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt += 1) {
      const reference = generateSupportReference();

      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const openTickets = await tx.supportTicket.count({
              where: { userId, status: { not: 'RESOLVED' } },
            });

            if (openTickets >= MAX_OPEN_TICKETS_PER_USER) {
              // NestJS ships no TooManyRequestsException, so the status
              // is stated explicitly rather than approximated with a
              // 400 or a 409 that would misdescribe the condition.
              throw new HttpException(
                'You already have the maximum number of open support requests.',
                HttpStatus.TOO_MANY_REQUESTS,
              );
            }

            const ticket = await tx.supportTicket.create({
              data: {
                reference,
                userId,
                category: input.category,
                subject: input.subject,
                /*
                  SERVER-DERIVED, AND IT FAILS TOWARDS THE HUMAN. Every
                  category lands in AWAITING_ADMIN here, a news question
                  included; it moves to AWAITING_USER only once an answer
                  actually exists. Starting it at AWAITING_USER and moving
                  back would leave a ticket whose analysis step died
                  mid-flight waiting on a user with nothing to reply to,
                  and out of the operator's queue.

                  No caller can influence this. There is no status field
                  on any DTO and no route accepts one.
                */
                status: creation.status,
              },
              select: { reference: true },
            });

            // Reached only after the ticket exists, so the message's
            // ownership is established by construction.
            await tx.supportMessage.create({
              data: {
                ticket: { connect: { reference } },
                authorType: 'USER',
                authorId: userId,
                visibility: 'PUBLIC',
                body: input.message,
              },
            });

            /*
              AND THAT IS THE WHOLE WRITE. No automated acknowledgement
              follows it. A news question may gain ONE SYSTEM_AI message
              afterwards, post-commit, in appendAiAnswer -- and only if
              the agent actually has something to say.
            */
            return ticket.reference;
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (error) {
        const retryable = isReferenceCollision(error) || isWriteConflict(error);

        if (!retryable || attempt === MAX_CREATE_ATTEMPTS) {
          throw error;
        }
      }
    }

    // Unreachable: the loop either returns or throws. Present so the
    // function cannot fall through to undefined if the bound changes.
    throw new Error('Support ticket creation exhausted its bounded retries.');
  }

  /**
   * SUPPORT-AI-1 — ONE analysis attempt, after the ticket is durable.
   *
   * THE ORDER IS THE GUARANTEE. This runs after the transaction has
   * committed, so there is no path in which an analysis problem rolls
   * back, delays or loses a request somebody submitted. The worst case
   * here is a ticket that keeps its stored first response and stays with
   * the human Support team, which is exactly where an unanswerable
   * question belongs.
   *
   * NOTHING IS BACKGROUNDED. The await is real and the caller waits for
   * it, bounded by the agent's own timeout. This codebase does not have a
   * durable job runner, and a floating promise would be an asynchronous
   * pipeline that silently loses work on restart while looking like one
   * that does not -- a claim the CTO explicitly forbade making.
   *
   * ONE ATTEMPT. No retry, no second call, and this method is invoked
   * from ticket CREATION only -- never from addMessage. That is what
   * makes an AI-to-AI loop structurally impossible rather than merely
   * unlikely: the agent's own message cannot reach a code path that
   * calls the agent.
   */
  private async appendAiAnswer(
    userId: string,
    reference: string,
    input: { category: SupportCategory; subject: string; message: string },
    language: SupportAiLanguage,
  ): Promise<void> {
    const answer = await this.supportAi.answerNewsQuestion({
      userId,
      category: input.category,
      subject: input.subject,
      message: input.message,
      language,
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        /*
          THE TICKET IS ESTABLISHED FIRST, IN THIS TRANSACTION, exactly as
          it is on every other message-writing path in this file.

          It is not a formality. An analysis call can take seconds, and
          the account that opened the ticket can delete itself in that
          window -- SupportTicket cascades from User, so the row would be
          gone. Connecting a message to a missing reference would throw
          and be logged as a failure; looking first makes it the no-op it
          actually is.
        */
        const ticket = await tx.supportTicket.findFirst({
          // SCOPED BY userId TOO, even though nothing user-supplied reaches
          // this method and the reference was minted moments ago by this
          // same call. Every ticket read in this file is ownership-scoped
          // and a structural guard asserts it; an exception here would be
          // the first crack in a rule whose value is that it has none.
          where: { reference, userId },
          select: { reference: true },
        });

        if (!ticket) return;

        await tx.supportMessage.create({
          data: {
            ticket: { connect: { reference } },
            authorType: 'SYSTEM_AI',
            authorId: null,
            visibility: 'PUBLIC',
            body: answer.body,
          },
        });

        /*
          AWAITING_USER only when an answer was genuinely produced;
          AWAITING_ADMIN otherwise. RESOLVED is not reachable from here --
          `answer.status` is typed to exclude it, so writing it is a
          compile error rather than a policy somebody has to remember.
        */
        await tx.supportTicket.update({
          where: { reference },
          data: { status: answer.status },
        });
      });
    } catch (error) {
      // The ticket, the user's message and the first response are already
      // committed. Losing the follow-up costs an answer; it cannot cost
      // the request, and the ticket is already in AWAITING_ADMIN.
      this.logger.warn(
        `Support AI answer could not be stored for ${reference}: ${
          (error as Error)?.message ?? 'unknown'
        }. The request is unaffected and remains with the Support team.`,
      );
    }
  }

  /**
   * The caller's own tickets, newest first.
   *
   * Scoped by `userId` with no caller-supplied filter, no offset and no
   * identifier in the path, so there is no shape in which one account
   * can request another's list.
   *
   * Capped at the 100 most recent rather than paginated: a pagination
   * subsystem is not an existing convention in this codebase and MVP
   * does not need one. The cap is a bound on the response, not a hidden
   * truncation of the user's data — real pagination is recorded as
   * later work.
   */
  async listTickets(userId: string): Promise<SupportTicketSummary[]> {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        reference: true,
        category: true,
        status: true,
        subject: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: { where: { visibility: 'PUBLIC' } } } },
      },
    });

    return tickets.map((ticket) => ({
      reference: ticket.reference,
      category: ticket.category,
      status: ticket.status,
      subject: ticket.subject,
      messageCount: ticket._count.messages,
      createdAt: iso(ticket.createdAt),
      updatedAt: iso(ticket.updatedAt),
    }));
  }

  /**
   * One of the caller's tickets, with the conversation they may read.
   *
   * `reference` and `userId` are a single compound condition: a ticket
   * belonging to someone else is not fetched and then rejected, it is
   * not fetched.
   */
  async getTicket(userId: string, reference: string): Promise<SupportTicketDetail> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { reference, userId },
      select: {
        reference: true,
        category: true,
        status: true,
        subject: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          where: { visibility: 'PUBLIC' },
          orderBy: { createdAt: 'asc' },
          select: { id: true, authorType: true, body: true, createdAt: true },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException();
    }

    const messages: SupportMessageView[] = ticket.messages.map((message) => ({
      id: message.id,
      authorType: message.authorType,
      body: message.body,
      createdAt: iso(message.createdAt),
    }));

    return {
      reference: ticket.reference,
      category: ticket.category,
      status: ticket.status,
      subject: ticket.subject,
      messageCount: messages.length,
      createdAt: iso(ticket.createdAt),
      updatedAt: iso(ticket.updatedAt),
      messages,
    };
  }

  /**
   * Append the owner's reply.
   *
   * OWNERSHIP FIRST, MESSAGE SECOND, IN ONE TRANSACTION. The ticket is
   * located by `{ reference, userId }` inside the transaction; if that
   * finds nothing the transaction ends before any message exists. A
   * cross-user reply therefore cannot create a row — not "creates one
   * and hides it", but never reaches the insert at all.
   *
   * EVERY VALID REPLY LEAVES THE TICKET AWAITING_ADMIN, including a
   * reply to a RESOLVED ticket, which reopens it. That is a
   * deterministic server-side consequence of the user acting on their
   * own ticket (CTO decision H-4a) — the status is derived here and is
   * not expressible as input anywhere in the API.
   *
   * The ticket row is written on EVERY reply, even when the status is
   * already AWAITING_ADMIN. `@updatedAt` only fires when the ticket row
   * itself is written, so without this a follow-up would leave
   * `updatedAt` stale and "last activity" ordering wrong.
   */
  async addMessage(userId: string, reference: string, body: string): Promise<SupportTicketDetail> {
    await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findFirst({
        where: { reference, userId },
        select: { id: true },
      });

      if (!ticket) {
        throw new NotFoundException();
      }

      await tx.supportMessage.create({
        data: {
          ticketId: ticket.id,
          authorType: 'USER',
          authorId: userId,
          visibility: 'PUBLIC',
          body,
        },
      });

      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: { status: 'AWAITING_ADMIN' },
      });
    });

    return this.getTicket(userId, reference);
  }
}
