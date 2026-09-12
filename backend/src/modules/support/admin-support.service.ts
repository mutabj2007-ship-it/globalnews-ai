import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminSupportMessageView,
  AdminSupportQueueResponse,
  AdminSupportStatusAction,
  AdminSupportTicketDetail,
  AdminSupportTicketSummary,
  SupportMessageVisibility,
  SupportTicketStatus,
} from '@globalnews-ai/shared';
import { PrismaService } from '../../database/prisma.service';

/**
 * S3 — the ADMIN support service.
 *
 * A SEPARATE CLASS FROM SupportService, AND THAT IS THE POINT. The
 * user-facing service has a property worth protecting: every ticket
 * query in it carries the caller's `userId`, and every message query in
 * it carries `visibility: 'PUBLIC'`. `support.security.spec.ts` asserts
 * both by scanning that file's source. If the admin reads — which are
 * neither ownership-scoped nor visibility-filtered, because an
 * administrator is not the owner and must see internal notes — lived in
 * the same file, those scans would have to be loosened to accommodate
 * them, and the property they protect would be gone. One file, one
 * audience; the guarantee survives intact in the file where it matters.
 *
 * THE REQUESTER IS NEVER IDENTIFIED (CTO decision, S3). `userId` is
 * never selected on any read in this file, and `authorId` is nulled on
 * every non-ADMIN message before it is mapped. An administrator sees a
 * ticket reference and a conversation, never an address, a name or an
 * identifier. The queue therefore cannot be used to enumerate users, and
 * a support operator cannot leak an identity they were never shown.
 *
 * STATUS IS DERIVED FROM THE ACTION, NEVER COPIED FROM A REQUEST. The
 * four transitions this milestone implements are stated once, below, and
 * nowhere else:
 *
 *   PUBLIC reply     -> AWAITING_USER   (the requester is expected next)
 *   INTERNAL note    -> unchanged       (the requester learns nothing)
 *   resolve          -> RESOLVED
 *   reopen           -> AWAITING_ADMIN
 *
 * OPEN is absent from that list because OPEN means "nobody has looked at
 * this yet" and no administrator action can make that true again.
 *
 * WHAT THIS FILE DOES NOT CONTAIN, and why: no priority (the schema has
 * no such column), no assignment (no `assigneeId` exists), no audit
 * history (no audit store exists, and inventing one would put a false
 * record in front of an administrator), no sample ticket, no AI call and
 * no outbound notification. Every one of those is out of scope by CTO
 * decision, and none is approximated here.
 */

/** The queue bound. Matches the user list's cap rather than inventing a second convention. */
const MAX_QUEUE_TICKETS = 100;

const iso = (value: Date): string => value.toISOString();

/**
 * The ticket columns every admin read selects.
 *
 * `userId` IS DELIBERATELY ABSENT. It is not selected, so it is never
 * loaded, never mapped and never serialized — the same discipline the
 * user service applies to INTERNAL messages, pointed the other way.
 */
const TICKET_FIELDS = {
  reference: true,
  category: true,
  status: true,
  subject: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface TicketFieldsRow {
  reference: string;
  category: AdminSupportTicketSummary['category'];
  status: SupportTicketStatus;
  subject: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MessageRow {
  id: string;
  authorType: AdminSupportMessageView['authorType'];
  authorId: string | null;
  visibility: SupportMessageVisibility;
  body: string;
  createdAt: Date;
}

/**
 * An administrator's identifier is disclosed; anybody else's is not.
 *
 * `authorId` on a USER message is the requester's user id — precisely
 * the identity this surface is not permitted to reveal. It is dropped
 * here rather than filtered in the query, because the column is needed
 * for ADMIN rows in the same result set. The admin response type still
 * declares `authorId: string | null`, so a null is a legitimate value
 * and not an absence the client must guess at.
 */
function disclosableAuthorId(message: MessageRow): string | null {
  return message.authorType === 'ADMIN' ? message.authorId : null;
}

@Injectable()
export class AdminSupportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The queue.
   *
   * Every ticket, because a holder of `support.handle` is authorized
   * over the whole queue — there is no per-ticket ownership on this
   * surface and no assignment model to scope it by. Bounded at the 100
   * most recently active, matching the user list rather than inventing a
   * second convention; a real pagination subsystem is later work and is
   * not faked with an offset here.
   */
  async queue(status?: SupportTicketStatus): Promise<AdminSupportQueueResponse> {
    const tickets = await this.prisma.supportTicket.findMany({
      where: status === undefined ? {} : { status },
      orderBy: { updatedAt: 'desc' },
      take: MAX_QUEUE_TICKETS,
      select: {
        ...TICKET_FIELDS,
        // Visibility only, never a body. Two counts of the SAME relation
        // cannot be expressed in one Prisma `_count` select, so the
        // discriminator column is read and the two totals are derived
        // here. Bounded by the 100-ticket cap above.
        messages: { select: { visibility: true } },
      },
    });

    return {
      tickets: tickets.map((ticket) => this.toSummary(ticket, ticket.messages)),
      generatedAt: iso(new Date()),
    };
  }

  /**
   * One ticket, with the FULL conversation.
   *
   * No `visibility` filter and no `userId` scope: this is the one read
   * in the codebase that is meant to return an internal note, and it is
   * reachable only through a route carrying AdminGuard and
   * `support.handle`. A reference that does not exist raises a bare
   * NotFoundException, the same shape the user path raises.
   */
  async ticket(reference: string): Promise<AdminSupportTicketDetail> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { reference },
      select: {
        ...TICKET_FIELDS,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            authorType: true,
            authorId: true,
            visibility: true,
            body: true,
            createdAt: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException();
    }

    return this.toDetail(ticket, ticket.messages);
  }

  /**
   * Post an administrator's message.
   *
   * `visibility` arrives from a REQUIRED request field with no default
   * anywhere on this path, so a message is never written as PUBLIC
   * because somebody forgot to say otherwise.
   *
   * The status consequence is derived here from that visibility and from
   * nothing else:
   *   PUBLIC   -> AWAITING_USER, and the ticket row is written, so
   *               `@updatedAt` fires and the queue's "last activity"
   *               ordering stays true.
   *   INTERNAL -> the ticket row is NOT written at all. An internal note
   *               must be invisible to the requester, and `updatedAt` is
   *               visible to them on their own ticket: bumping it would
   *               tell them, to the second, that something happened
   *               behind the scenes. Silence has to be silent.
   *
   * The lookup and the insert share one transaction, so a message is
   * never written against a ticket that vanished between the two.
   */
  async addMessage(
    adminId: string,
    reference: string,
    input: { visibility: SupportMessageVisibility; message: string },
  ): Promise<AdminSupportTicketDetail> {
    await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({
        where: { reference },
        select: { id: true },
      });

      if (!ticket) {
        throw new NotFoundException();
      }

      await tx.supportMessage.create({
        data: {
          ticketId: ticket.id,
          authorType: 'ADMIN',
          authorId: adminId,
          visibility: input.visibility,
          body: input.message,
        },
      });

      if (input.visibility === 'PUBLIC') {
        await tx.supportTicket.update({
          where: { id: ticket.id },
          data: { status: 'AWAITING_USER' },
        });
      }
    });

    return this.ticket(reference);
  }

  /**
   * Resolve a ticket, or reopen one.
   *
   * The DTO admits only RESOLVED and AWAITING_ADMIN, so the value
   * reaching this method has already been checked against the shared
   * declaration — there is no branch here that could widen it. The
   * update is written by `reference`, so a nonexistent ticket is a
   * P2025 from Prisma rather than a silent no-op; it is caught and
   * re-raised as the same bare 404 every other miss on this surface
   * produces.
   */
  async setStatus(
    reference: string,
    status: AdminSupportStatusAction,
  ): Promise<AdminSupportTicketDetail> {
    try {
      await this.prisma.supportTicket.update({
        where: { reference },
        data: { status },
      });
    } catch (error) {
      if ((error as { code?: unknown })?.code === 'P2025') {
        throw new NotFoundException();
      }
      throw error;
    }

    return this.ticket(reference);
  }

  private toSummary(
    ticket: TicketFieldsRow,
    messages: ReadonlyArray<{ visibility: SupportMessageVisibility }>,
  ): AdminSupportTicketSummary {
    return {
      reference: ticket.reference,
      category: ticket.category,
      status: ticket.status,
      subject: ticket.subject,
      publicMessageCount: messages.filter((message) => message.visibility === 'PUBLIC').length,
      internalNoteCount: messages.filter((message) => message.visibility === 'INTERNAL').length,
      createdAt: iso(ticket.createdAt),
      updatedAt: iso(ticket.updatedAt),
    };
  }

  private toDetail(
    ticket: TicketFieldsRow,
    messages: readonly MessageRow[],
  ): AdminSupportTicketDetail {
    return {
      ...this.toSummary(ticket, messages),
      messages: messages.map((message) => ({
        id: message.id,
        authorType: message.authorType,
        visibility: message.visibility,
        authorId: disclosableAuthorId(message),
        body: message.body,
        createdAt: iso(message.createdAt),
      })),
    };
  }
}
